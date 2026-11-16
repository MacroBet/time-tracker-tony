import test from "node:test";
import assert from "node:assert/strict";
import {
  createVoiceQuestionSession,
  parseVoiceQuestionCommand,
  voiceSetupKey,
} from "../src/lib/voice-commands";
import { installLocalVoice } from "../src/lib/voice-device";
import type { LocalRecognitionConstructor } from "../src/lib/live-dictation";
test("only standalone Send/Edit utterances are commands; quotes, sentences and mutation confirmations remain text", () => {
  for (const text of ["send", "Send.", "send question"])
    assert.equal(parseVoiceQuestionCommand(text), "send");
  for (const text of ["edit", "Edit!", "edit question"])
    assert.equal(parseVoiceQuestionCommand(text), "edit");
  for (const text of [
    '"send"',
    "Please send",
    "Find the word send",
    "Don't send",
    "send and approve",
    "confirm",
    "Approve changes",
    "edit the chiller",
  ])
    assert.equal(parseVoiceQuestionCommand(text), null, text);
});
test("one live capture automatically reviews a final question then permits a single Send after a stable pause", () => {
  const flow = createVoiceQuestionSession("", false, 0);
  flow.phrase(
    {
      index: 0,
      text: "Show chillers",
      before: "",
      hasInterim: false,
      now: 100,
    },
    "",
  );
  assert.equal(
    flow.phrase(
      {
        index: 1,
        text: "Send",
        before: "Show chillers",
        hasInterim: false,
        now: 500,
      },
      "",
    ),
    "omit",
  );
  assert.equal(
    flow.phrase(
      {
        index: 2,
        text: "Send",
        before: "Show chillers",
        hasInterim: false,
        now: 1500,
      },
      "",
    ),
    "finish",
  );
  assert.equal(flow.complete("Show chillers", "").send, true);
  assert.equal(flow.complete("Show chillers", "").send, false);
});
test("no draft, quoted command, unfinished interim and changed typed draft cannot trigger a send", () => {
  const empty = createVoiceQuestionSession("", false, 0);
  assert.equal(
    empty.phrase(
      { index: 0, text: "Send", before: "", hasInterim: false, now: 5000 },
      "",
    ),
    undefined,
  );
  assert.equal(empty.complete("Send", "").send, false);
  const typed = createVoiceQuestionSession("Original", false, 0);
  assert.equal(
    typed.phrase(
      { index: 0, text: "Send", before: "", hasInterim: false, now: 1500 },
      "Changed",
    ),
    "omit",
  );
  assert.equal(typed.complete("", "Changed").send, false);
  const partial = createVoiceQuestionSession("Original", false, 0);
  assert.equal(
    partial.phrase(
      { index: 0, text: "Send", before: "", hasInterim: true, now: 1500 },
      "Original",
    ),
    "omit",
  );
});
test("Edit replaces the full dictated question in the same capture; cancellation never sends", () => {
  const flow = createVoiceQuestionSession("old draft", false, 0);
  flow.phrase(
    {
      index: 0,
      text: "plus old words",
      before: "",
      hasInterim: false,
      now: 100,
    },
    "old draft",
  );
  assert.equal(
    flow.phrase(
      {
        index: 1,
        text: "Edit",
        before: "plus old words",
        hasInterim: false,
        now: 1500,
      },
      "old draft",
    ),
    "replace",
  );
  flow.phrase(
    {
      index: 2,
      text: "Replacement question",
      before: "",
      hasInterim: false,
      now: 2000,
    },
    "old draft",
  );
  assert.equal(
    flow.phrase(
      {
        index: 3,
        text: "Send question",
        before: "Replacement question",
        hasInterim: false,
        now: 3500,
      },
      "old draft",
    ),
    "finish",
  );
  assert.deepEqual(flow.complete("Replacement question", "old draft"), {
    draft: "Replacement question",
    send: true,
    replaced: true,
    changedDuringCapture: false,
  });
  const cancelled = createVoiceQuestionSession("old draft", false, 0);
  cancelled.cancel();
  assert.equal(cancelled.complete("words", "old draft").send, false);
  assert.notEqual(voiceSetupKey("user one"), voiceSetupKey("user two"));
});
test("language setup can call install only through its explicit user-action entry; readiness never starts a microphone", async () => {
  let installs = 0,
    checks = 0;
  const options: unknown[] = [];
  const engine = {
    prototype: { processLocally: true },
    install: async (value: unknown) => {
      installs++;
      options.push(value);
      return true;
    },
    available: async () => {
      checks++;
      return "available";
    },
  } as unknown as LocalRecognitionConstructor & {
    install: () => Promise<boolean>;
  };
  assert.equal(await installLocalVoice(engine, false), "unsupported");
  assert.equal(installs, 0);
  assert.equal(checks, 0);
  assert.equal(await installLocalVoice(engine, true), "available");
  assert.equal(installs, 1);
  assert.equal(checks, 1);
  assert.deepEqual(options, [{ langs: ["en-GB"], processLocally: true }]);
  assert.equal(await installLocalVoice(undefined, true), "unsupported");
});

test("leaving setup stops waiting and ignores a late pack-install result without probing or starting another action", async () => {
  let finish!: (value: boolean) => void,
    checks = 0,
    installs = 0;
  const engine = {
    prototype: { processLocally: true },
    install: () => {
      installs++;
      return new Promise<boolean>((resolve) => {
        finish = resolve;
      });
    },
    available: async () => {
      checks++;
      return "available";
    },
  } as unknown as LocalRecognitionConstructor & {
    install: () => Promise<boolean>;
  };
  const before = new AbortController();
  before.abort();
  assert.equal(
    await installLocalVoice(engine, true, before.signal),
    "cancelled",
  );
  assert.equal(installs, 0);
  const controller = new AbortController(),
    pending = installLocalVoice(engine, true, controller.signal);
  controller.abort();
  assert.equal(await pending, "cancelled");
  finish(true);
  await Promise.resolve();
  assert.equal(checks, 0);
  assert.equal(installs, 1);
});
