import test from "node:test";
import assert from "node:assert/strict";
import {
  createLocalDictation,
  checkLocalDictationAvailability,
  localTranscriptAssembler,
  LIVE_DICTATION,
  type LocalRecognition,
  type LocalRecognitionEvent,
} from "../src/lib/live-dictation";
import { parseVoiceReviewCommand } from "../src/lib/assistant-view-commands";
const event = (...rows: [string, boolean][]): LocalRecognitionEvent => ({
  resultIndex: 0,
  results: rows.map(([transcript, isFinal]) => ({
    isFinal,
    0: { transcript },
  })),
});
function harness(status: string | Promise<string> = "available") {
  const instances: Mock[] = [];
  let checks = 0,
    installs = 0;
  const options: unknown[] = [];
  class Mock implements LocalRecognition {
    declare processLocally: boolean;
    continuous = false;
    interimResults = false;
    lang = "";
    onstart: (() => void) | null = null;
    onresult: ((event: LocalRecognitionEvent) => void) | null = null;
    onerror: ((event: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    starts = 0;
    stops = 0;
    aborts = 0;
    static available = async (input: unknown) => {
      checks++;
      options.push(input);
      return status;
    };
    static install = async () => {
      installs++;
      return true;
    };
    constructor() {
      instances.push(this);
    }
    start() {
      this.starts++;
    }
    stop() {
      this.stops++;
    }
    abort() {
      this.aborts++;
    }
  }
  Object.defineProperty(Mock.prototype, "processLocally", {
    value: false,
    writable: true,
    configurable: true,
  });
  const output: {
    partial: string[];
    final: string[];
    errors: string[];
    states: string[];
    captures: boolean[];
    order: string[];
  } = {
    partial: [],
    final: [],
    errors: [],
    states: [],
    captures: [],
    order: [],
  };
  const callbacks = {
    onState: (state: string) => output.states.push(state),
    onPartial: (text: string) => output.partial.push(text),
    onTranscript: (text: string) => {
      output.final.push(text);
      output.order.push("final");
    },
    onCaptureChange: (active: boolean) => {
      output.captures.push(active);
      output.order.push(`capture:${active}`);
    },
    onError: (message: string) => output.errors.push(message),
  };
  return {
    Mock,
    instances,
    output,
    callbacks,
    options,
    counts: () => ({ checks, installs }),
  };
}
test("the availability probe queries en-GB local-only without constructing recognition, installing packs or starting capture", async () => {
  for (const status of [
    "available",
    "downloadable",
    "downloading",
    "unavailable",
  ]) {
    const h = harness(status);
    assert.equal(await checkLocalDictationAvailability(h.Mock), status);
    assert.deepEqual(h.options, [{ langs: ["en-GB"], processLocally: true }]);
    assert.equal(h.instances.length, 0);
    assert.deepEqual(h.counts(), { checks: 1, installs: 0 });
  }
  assert.equal(await checkLocalDictationAvailability(undefined), "unsupported");
  const h = harness(new Promise(() => {}));
  assert.equal(
    await checkLocalDictationAvailability(h.Mock, { timeoutMs: 5 }),
    "timeout",
  );
  assert.equal(h.instances.length, 0);
});
test("partial snapshots revise text and duplicate/final/out-of-order old snapshots never append repeated words or regress finalized text", () => {
  const a = localTranscriptAssembler();
  assert.equal(
    a.apply(event(["Show me two we", false])).text,
    "Show me two we",
  );
  assert.equal(
    a.apply(event(["Show me two weeks", false])).text,
    "Show me two weeks",
  );
  const final = a.apply(event(["Show me two weeks", true]));
  assert.equal(final.pending, false);
  assert.deepEqual(a.apply(event(["Show me two weeks", true])), final);
  assert.deepEqual(a.apply(event(["Show me two we", false])), final);
  assert.equal(
    a.apply(event(["Show me two weeks", true], ["look ahead", true])).finalText,
    "Show me two weeks look ahead",
  );
  assert.throws(
    () => localTranscriptAssembler().apply(event(["x".repeat(4001), false])),
    /4,000/,
  );
});
test("live recognition is local-only and publishes the complete final session once after Stop/end, with capture=false before terminal transcript", async (t) => {
  const h = harness(),
    c = createLocalDictation(h.Mock, h.callbacks);
  t.after(() => c.cancel());
  await c.start();
  const r = h.instances[0];
  assert.equal(r.processLocally, true);
  assert.equal(r.interimResults, true);
  assert.equal(r.continuous, true);
  assert.equal(r.lang, "en-GB");
  r.onstart!();
  r.onresult!(event(["Show me", false]));
  r.onresult!(event(["Show me", true], ["chillers", false]));
  assert.deepEqual(h.output.final, []);
  c.stop();
  assert.equal(r.stops, 1);
  r.onresult!(event(["Show me", true], ["chillers", true]));
  const end = r.onend!;
  end();
  end();
  assert.deepEqual(h.output.final, ["Show me chillers"]);
  assert.equal(h.output.partial.at(-1), "");
  assert.deepEqual(h.output.order.slice(-2), ["capture:false", "final"]);
  assert.equal(h.counts().installs, 0);
});
test("unavailable, downloadable, unknown or failed readiness never starts recognition and never automatically installs/falls back", async () => {
  for (const status of [
    "downloadable",
    "downloading",
    "unavailable",
    "unexpected",
  ]) {
    const h = harness(status),
      c = createLocalDictation(h.Mock, h.callbacks);
    await c.start();
    assert.equal(h.instances.length, 0);
    assert.equal(h.output.captures.at(-1), false);
    assert.equal(h.output.final.length, 0);
    assert.equal(h.output.errors.length, 1);
    assert.equal(h.counts().installs, 0);
    c.cancel();
  }
  const h = harness();
  h.Mock.available = async () => {
    throw Error("opaque local error");
  };
  const c = createLocalDictation(h.Mock, h.callbacks);
  await c.start();
  assert.equal(h.instances.length, 0);
  assert(!h.output.errors[0].includes("opaque"));
  c.cancel();
});
test("cancel during readiness settles even a stalled query; stale recognition events cannot change a later generation or emit a final", async (t) => {
  let resolve!: (value: string) => void;
  const h = harness(
      new Promise<string>((r) => {
        resolve = r;
      }),
    ),
    c = createLocalDictation(h.Mock, h.callbacks);
  t.after(() => c.cancel());
  const pending = c.start();
  c.cancel();
  await pending;
  resolve("available");
  await Promise.resolve();
  assert.equal(h.instances.length, 0);
  const ready = harness(),
    controller = createLocalDictation(ready.Mock, ready.callbacks);
  t.after(() => controller.cancel());
  await controller.start();
  const old = ready.instances[0],
    late = old.onresult!,
    lateEnd = old.onend!;
  old.onstart!();
  old.onresult!(event(["old", false]));
  controller.cancel();
  await controller.start();
  const current = ready.instances[1];
  current.onstart!();
  current.onresult!(event(["current", true]));
  late(event(["old terminal", true]));
  lateEnd();
  assert.deepEqual(ready.output.final, []);
  controller.stop();
  current.onend!();
  assert.deepEqual(ready.output.final, ["current"]);
});
test("a browser that does not honor local-only mode is rejected before its recognition start method", async () => {
  const h = harness();
  Object.defineProperty(h.Mock.prototype, "processLocally", {
    get: () => false,
    set: () => {},
  });
  const controller = createLocalDictation(h.Mock, h.callbacks);
  await controller.start();
  assert.equal(h.instances[0].starts, 0);
  assert.equal(h.output.final.length, 0);
  assert.equal(h.output.captures.at(-1), false);
  controller.cancel();
});
test("permission denial, incomplete final, readiness/permission timeout and 30-second stop cap are terminal without promoting partials", async (t) => {
  assert.equal(LIVE_DICTATION.maxMs, 30000);
  const h = harness(),
    c = createLocalDictation(h.Mock, h.callbacks, { permissionMs: 5 });
  t.after(() => c.cancel());
  await c.start();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(h.output.captures.at(-1), false);
  assert.equal(h.output.final.length, 0);
  assert(h.instances[0].aborts > 0);
  const denied = harness(),
    d = createLocalDictation(denied.Mock, denied.callbacks);
  t.after(() => d.cancel());
  await d.start();
  denied.instances[0].onerror!({ error: "not-allowed" });
  assert(denied.output.errors[0].includes("not allowed"));
  assert.equal(denied.output.final.length, 0);
  const capped = harness(),
    cap = createLocalDictation(capped.Mock, capped.callbacks, {
      maxMs: 5,
      finalMs: 20,
    });
  t.after(() => cap.cancel());
  await cap.start();
  const r = capped.instances[0];
  r.onstart!();
  r.onresult!(event(["partial only", false]));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(r.stops, 1);
  r.onend!();
  assert.equal(capped.output.final.length, 0);
  assert(capped.output.errors[0].includes("incomplete"));
  const wait = harness(),
    f = createLocalDictation(wait.Mock, wait.callbacks, { finalMs: 5 });
  t.after(() => f.cancel());
  await f.start();
  wait.instances[0].onstart!();
  f.stop();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(wait.output.captures.at(-1), false);
  assert(wait.output.errors[0].includes("did not finish"));
});
test("live interim Send question is only preview; the command parser accepts exact separate final phrases and never mutation confirmations", async (t) => {
  const h = harness(),
    c = createLocalDictation(h.Mock, h.callbacks);
  t.after(() => c.cancel());
  await c.start();
  const r = h.instances[0];
  r.onstart!();
  r.onresult!(event(["Send question", false]));
  assert.equal(h.output.final.length, 0);
  c.cancel();
  assert.equal(h.output.final.length, 0);
  for (const text of [
    "send",
    "Please send question",
    "The note says Send question",
    "Send question and approve",
    "Confirm changes",
  ])
    assert.equal(parseVoiceReviewCommand(text), null);
  assert.equal(parseVoiceReviewCommand("Send question."), "send");
  assert.equal(parseVoiceReviewCommand("Edit question"), "edit");
});

test("real native controller routes stable standalone Send once after Stop while excluding command words from the question", async (t) => {
  const { createVoiceQuestionSession } =
    await import("../src/lib/voice-commands");
  const h = harness(),
    flow = createVoiceQuestionSession("", false, 0);
  let clock = 100,
    sends = 0;
  const c = createLocalDictation(h.Mock, {
    ...h.callbacks,
    onFinalPhrase: (phrase) => flow.phrase({ ...phrase, now: clock }, ""),
    onTranscript: (text) => {
      h.callbacks.onTranscript(text);
      if (flow.complete(text, "").send) sends++;
    },
  });
  t.after(() => c.cancel());
  await c.start();
  const r = h.instances[0];
  r.onstart!();
  r.onresult!(event(["Find records containing send", true]));
  assert.equal(sends, 0);
  clock = 1600;
  r.onresult!(event(["Find records containing send", true], ["Send", true]));
  assert.equal(r.stops, 1);
  assert.equal(sends, 0);
  const end = r.onend!;
  end();
  end();
  assert.equal(sends, 1);
  assert.deepEqual(h.output.final, ["Find records containing send"]);
});
test("real native controller clears earlier words for Edit and records the replacement within the same recognition instance", async (t) => {
  const { createVoiceQuestionSession } =
    await import("../src/lib/voice-commands");
  const h = harness(),
    flow = createVoiceQuestionSession("", false, 0);
  let clock = 100;
  const c = createLocalDictation(h.Mock, {
    ...h.callbacks,
    onFinalPhrase: (phrase) => flow.phrase({ ...phrase, now: clock }, ""),
  });
  t.after(() => c.cancel());
  await c.start();
  const r = h.instances[0];
  r.onstart!();
  r.onresult!(event(["Old question", true]));
  clock = 1600;
  r.onresult!(event(["Old question", true], ["Edit", true]));
  assert.equal(r.stops, 0);
  assert.equal(h.instances.length, 1);
  clock = 2000;
  r.onresult!(
    event(["Old question", true], ["Edit", true], ["New question", true]),
  );
  c.stop();
  r.onend!();
  assert.deepEqual(h.output.final, ["New question"]);
  assert.equal(flow.complete("New question", "").replaced, true);
});
