import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  realpathSync,
  rmSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  runCopilotTurn,
  type CopilotTransport,
} from "../src/lib/copilot-provider";
import {
  createOpenAIMeterRecorder,
  readOpenAIMeterExport,
} from "../src/server/openai-meter-store";
import type { AttemptObservation } from "../src/lib/openai-metering";
const turn = {
  message: "PRIVATE_PROMPT",
  history: [],
  projectName: "PRIVATE_PROJECT",
  tools: [],
  executeTool: async () => ({}),
};
const config = {
  enabled: true,
  apiKey: "synthetic-credential",
  model: "test-model",
};
const usage = {
  input_tokens: 20,
  output_tokens: 10,
  total_tokens: 30,
  input_tokens_details: { cached_tokens: 5, cache_write_tokens: 2 },
  output_tokens_details: { reasoning_tokens: 4 },
};
const payload = {
  status: "completed",
  model: "test-model-resolved",
  usage,
  output: [
    {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "PRIVATE_RESPONSE" }],
    },
  ],
};
function setup(t: { after: (fn: () => void) => void }) {
  const directory = realpathSync(
    mkdtempSync(path.join(tmpdir(), "fieldtrack-meter-")),
  );
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const recordAttempt = createOpenAIMeterRecorder(directory);
  return {
    directory,
    recordAttempt,
    read: () => readOpenAIMeterExport(directory),
  };
}
test("provider success persists only metadata and exports after restart", async (t) => {
  const s = setup(t);
  await runCopilotTurn(
    turn,
    { ...config, recordAttempt: s.recordAttempt },
    async () =>
      Response.json(payload, {
        headers: { "x-request-id": "PRIVATE_REQUEST_HEADER" },
      }),
  );
  const snapshot = s.read();
  assert.equal(snapshot.events.length, 1);
  assert.equal(snapshot.pendingAttempts.length, 0);
  assert.deepEqual(snapshot.events[0].usage, {
    inputTokens: 20,
    cachedInputTokens: 5,
    cacheWriteInputTokens: 2,
    outputTokens: 10,
    reasoningOutputTokens: 4,
    totalTokens: 30,
  });
  assert.equal(snapshot.events[0].model, "test-model-resolved");
  assert.equal(snapshot.events[0].estimate, null);
  assert.equal(snapshot.observations[0].usageState, "complete");
  const disk = readdirSync(s.directory)
    .map((f) => readFileSync(path.join(s.directory, f), "utf8"))
    .join("");
  for (const value of [
    "PRIVATE_PROMPT",
    "PRIVATE_PROJECT",
    "PRIVATE_RESPONSE",
    "PRIVATE_REQUEST_HEADER",
    config.apiKey,
    "Authorization",
  ])
    assert.ok(!disk.includes(value));
  const result = execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `import {readOpenAIMeterExport} from './src/server/openai-meter-store.ts'; console.log(readOpenAIMeterExport(process.argv[1]).events.length)`,
      s.directory,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.trim(), "1");
});
test("missing usage is null; incomplete retains measured usage without claiming success", async (t) => {
  const s = setup(t);
  await runCopilotTurn(
    turn,
    { ...config, recordAttempt: s.recordAttempt },
    async () => Response.json({ ...payload, usage: undefined }),
  );
  await assert.rejects(
    runCopilotTurn(
      turn,
      { ...config, recordAttempt: s.recordAttempt },
      async () => Response.json({ ...payload, status: "incomplete" }),
    ),
  );
  const rows = s.read();
  assert.equal(rows.events.length, 2);
  assert.ok(
    rows.events.some(
      (e) =>
        e.status === "success" &&
        Object.values(e.usage).every((v) => v === null),
    ),
  );
  assert.ok(rows.observations.some((e) => e.outcome === "incomplete"));
});
test("body interruptions, transport cancel, HTTP errors and timeout are distinct", async (t) => {
  const s = setup(t);
  const transports: CopilotTransport[] = [
    async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.error(new Error("PRIVATE_RAW_ERROR"));
          },
        }),
      ),
    async () => {
      throw new DOMException("PRIVATE_RAW_ERROR", "AbortError");
    },
    async () => new Response("PRIVATE_RAW_ERROR", { status: 429 }),
    async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode('{"status":'));
          },
        }),
      ),
  ];
  for (const transport of transports)
    await assert.rejects(
      runCopilotTurn(
        turn,
        { ...config, timeoutMs: 15, recordAttempt: s.recordAttempt },
        transport,
      ),
    );
  const snapshot = s.read();
  assert.deepEqual(
    snapshot.observations.map((v) => v.outcome).sort(),
    ["body_interrupted", "cancel", "http_error", "timeout"].sort(),
  );
  assert.equal(snapshot.pendingAttempts.length, 0);
  assert.ok(!JSON.stringify(snapshot).includes("PRIVATE_RAW_ERROR"));
});
test("duplicate identical final is idempotent, conflicting final is rejected, retry is separate", async (t) => {
  const s = setup(t);
  const observed: AttemptObservation[] = [];
  const recordAttempt = (v: AttemptObservation) => {
    observed.push(v);
    s.recordAttempt(v);
  };
  for (let i = 0; i < 2; i++)
    await runCopilotTurn(turn, { ...config, recordAttempt }, async () =>
      Response.json(payload),
    );
  s.recordAttempt(observed[1]);
  assert.equal(s.read().events.length, 2);
  assert.notEqual(s.read().events[0].attemptId, s.read().events[1].attemptId);
  assert.throws(
    () => s.recordAttempt({ ...observed[1], outcome: "http_error" }),
    /conflict/,
  );
});
test("pending attempt survives interrupted process; disabled provider never records", async (t) => {
  const s = setup(t);
  let pending: AttemptObservation | undefined;
  await runCopilotTurn(
    turn,
    {
      ...config,
      recordAttempt: (v) => {
        if (v.outcome === "started") pending = v;
      },
    },
    async () => Response.json(payload),
  );
  s.recordAttempt(pending!);
  assert.equal(s.read().pendingAttempts.length, 1);
  assert.equal(s.read().events.length, 0);
  let calls = 0;
  await assert.rejects(
    runCopilotTurn(
      turn,
      { ...config, enabled: false, recordAttempt: () => calls++ },
      async () => {
        calls++;
        return Response.json(payload);
      },
    ),
  );
  assert.equal(calls, 0);
});
test("audit storage failure prevents request and never exposes its raw error", async () => {
  let calls = 0;
  await assert.rejects(
    runCopilotTurn(
      turn,
      {
        ...config,
        recordAttempt: () => {
          throw new Error("PRIVATE_STORAGE_ERROR");
        },
      },
      async () => {
        calls++;
        return Response.json(payload);
      },
    ),
    (e) =>
      e instanceof Error && e.message === "API usage recording is unavailable.",
  );
  assert.equal(calls, 0);
});
test("multiple tool rounds share logical request, never sum cumulative detail tokens", async (t) => {
  const s = setup(t);
  let calls = 0;
  const tool = {
    type: "function" as const,
    name: "summary",
    description: "Summary",
    strict: true as const,
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  };
  await runCopilotTurn(
    { ...turn, tools: [tool] },
    { ...config, recordAttempt: s.recordAttempt },
    async () =>
      Response.json(
        ++calls === 1
          ? {
              ...payload,
              output: [
                {
                  type: "function_call",
                  name: "summary",
                  call_id: "call-1",
                  arguments: "{}",
                },
              ],
            }
          : payload,
      ),
  );
  const rows = s.read().events;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].requestId, rows[1].requestId);
  assert.notEqual(rows[0].attemptId, rows[1].attemptId);
  assert.equal(
    rows.reduce((n, e) => n + e.usage.totalTokens!, 0),
    60,
  );
});

test("atomic collector projection contains only v1 final events and strips injected fields", async (t) => {
  const s = setup(t);
  let final: AttemptObservation | undefined;
  await runCopilotTurn(
    turn,
    {
      ...config,
      recordAttempt: (v) => {
        if (v.outcome !== "started") final = v;
      },
    },
    async () => Response.json(payload),
  );
  const injected = {
    ...final!,
    prompt: "PRIVATE_EXTRA",
    event: {
      ...final!.event,
      output: "PRIVATE_EXTRA",
      usage: { ...final!.event.usage, raw: "PRIVATE_EXTRA" },
    },
  };
  s.recordAttempt(injected);
  const projection = JSON.parse(
    readFileSync(path.join(s.directory, "collector-v1.json"), "utf8"),
  );
  assert.deepEqual(Object.keys(projection), [
    "schemaVersion",
    "events",
    "pendingAttempts",
  ]);
  assert.equal(projection.events.length, 1);
  assert.ok(!JSON.stringify(projection).includes("PRIVATE_EXTRA"));
  s.recordAttempt(injected);
  assert.equal(
    JSON.parse(
      readFileSync(path.join(s.directory, "collector-v1.json"), "utf8"),
    ).events.length,
    1,
  );
});

test("collector sees pending before HTTP and final replaces it without a second attempt", async (t) => {
  const s = setup(t);
  const projectId = "project-meter-test";
  let pendingId: string | undefined;
  await runCopilotTurn(
    turn,
    { ...config, projectId, recordAttempt: s.recordAttempt },
    async () => {
      const snapshot = JSON.parse(
        readFileSync(path.join(s.directory, "collector-v1.json"), "utf8"),
      );
      assert.equal(snapshot.events.length, 0);
      assert.equal(snapshot.pendingAttempts.length, 1);
      const pending = snapshot.pendingAttempts[0];
      assert.equal(pending.provider, "openai");
      assert.equal(pending.projectId, projectId);
      assert.equal(pending.model, undefined);
      assert.equal(pending.source, "fieldtrack-copilot-responses");
      assert.equal(pending.jobId, null);
      pendingId = pending.attemptId;
      // A separate process sees the same durable intent, independently of live process memory.
      const restarted = execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `import {readFileSync} from 'node:fs'; const s=JSON.parse(readFileSync(process.argv[1],'utf8')); console.log(s.pendingAttempts[0].attemptId);`,
          path.join(s.directory, "collector-v1.json"),
        ],
        { encoding: "utf8" },
      );
      assert.equal(restarted.trim(), pendingId);
      return Response.json(payload);
    },
  );
  const terminal = JSON.parse(
    readFileSync(path.join(s.directory, "collector-v1.json"), "utf8"),
  );
  assert.equal(terminal.events.length, 1);
  assert.equal(terminal.pendingAttempts.length, 0);
  assert.equal(terminal.events[0].attemptId, pendingId);
});

test("process exit during transport leaves exported pending, then same-attempt final supersedes it", (t) => {
  const s = setup(t);
  execFileSync(process.execPath, [
    "--import",
    "tsx",
    "--input-type=module",
    "-e",
    `
 import {runCopilotTurn} from './src/lib/copilot-provider.ts';
 import {createOpenAIMeterRecorder} from './src/server/openai-meter-store.ts';
 await runCopilotTurn({message:'Synthetic',history:[],projectName:'Synthetic',tools:[],executeTool:async()=>({})},
 {enabled:true,apiKey:'synthetic',model:'test-model',recordAttempt:createOpenAIMeterRecorder(process.argv[1])},
 async()=>process.exit(0));`,
    s.directory,
  ]);
  const before = JSON.parse(
    readFileSync(path.join(s.directory, "collector-v1.json"), "utf8"),
  );
  assert.equal(before.events.length, 0);
  assert.equal(before.pendingAttempts.length, 1);
  const id = before.pendingAttempts[0].attemptId;
  const pending = JSON.parse(
    readFileSync(path.join(s.directory, `${id}.pending.json`), "utf8"),
  ) as AttemptObservation;
  // Synthetic recovered terminal evidence; real recovery must never invent measured usage.
  s.recordAttempt({
    ...pending,
    outcome: "timeout",
    event: { ...pending.event, status: "timeout" },
  });
  const after = JSON.parse(
    readFileSync(path.join(s.directory, "collector-v1.json"), "utf8"),
  );
  assert.equal(after.pendingAttempts.length, 0);
  assert.equal(after.events.length, 1);
  assert.equal(after.events[0].attemptId, id);
  assert.equal(after.events[0].estimate, null);
  assert.ok(Object.values(after.events[0].usage).every((v) => v === null));
});
