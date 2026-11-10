import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  createDatabaseMeterRecorder,
  ensureDatabaseMeterReady,
  readDatabaseMeterExport,
  type MeterDatabase,
} from "../src/server/openai-meter-db";
import { runCopilotTurn } from "../src/lib/copilot-provider";
import {
  encodeCopilotWav,
  transcribeCopilotWav,
} from "../src/lib/copilot-audio";
import type { AttemptObservation } from "../src/lib/openai-metering";
const migration = new URL(
  "../drizzle/0006_openai_meter_observations.sql",
  import.meta.url,
);
const turn = {
  message: "PRIVATE_PROMPT",
  history: [],
  projectName: "PRIVATE_NAME",
  tools: [],
  executeTool: async () => ({}),
};
const config = {
  enabled: true,
  apiKey: "synthetic-private-key",
  model: "test-model",
  projectId: "project-a",
};
const response = () =>
  Response.json({
    status: "completed",
    usage: { input_tokens: 5, output_tokens: 3 },
    output: [
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "PRIVATE_ANSWER" }],
      },
    ],
  });
function observation(
  outcome: "started" | "completed" = "started",
): AttemptObservation {
  const id = randomUUID(),
    stamp = "2026-11-10T19:00:00.000Z";
  return {
    event: {
      schemaVersion: 1,
      eventId: id,
      provider: "openai",
      requestId: randomUUID(),
      attemptId: id,
      projectId: "project-a",
      jobId: null,
      model: null,
      status: outcome === "started" ? "failure" : "success",
      startedAt: stamp,
      endedAt: stamp,
      observedAt: stamp,
      source: "fieldtrack-copilot-responses",
      usage: {
        inputTokens: null,
        cachedInputTokens: null,
        cacheWriteInputTokens: null,
        outputTokens: null,
        reasoningOutputTokens: null,
        totalTokens: null,
      },
      estimate: null,
      billed: null,
    },
    outcome,
    usageState: "missing",
    latencyMs: null,
    providerRequestId: null,
    attemptNumber: 1,
  };
}
async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = new PGlite();
  t.after(() => pg.close());
  const dialect = new PgDialect();
  const execute: MeterDatabase = async (query) => {
    const compiled = dialect.sqlToQuery(query);
    return pg.query(compiled.sql, compiled.params);
  };
  return { pg, execute };
}

test("additive migration and real readiness query leave existing project/task rows untouched", async (t) => {
  const { pg, execute } = await fixture(t);
  await assert.rejects(ensureDatabaseMeterReady(execute), /does not exist/);
  await pg.exec(
    "CREATE TABLE projects(id text PRIMARY KEY, commissioning jsonb); CREATE TABLE tasks(id text PRIMARY KEY, project_id text); INSERT INTO projects VALUES ('project-a','{\"version\":4}'); INSERT INTO tasks VALUES('keep-task','project-a')",
  );
  await pg.exec(await readFile(migration, "utf8"));
  await ensureDatabaseMeterReady(execute);
  assert.deepEqual((await pg.query("SELECT * FROM projects")).rows, [
    { id: "project-a", commissioning: { version: 4 } },
  ]);
  assert.deepEqual((await pg.query("SELECT * FROM tasks")).rows, [
    { id: "keep-task", project_id: "project-a" },
  ]);
  assert.equal((await readDatabaseMeterExport(execute)).events.length, 0);
});

test("database intent/final are idempotent, conflicting duplicates reject, pending survives missing final", async (t) => {
  const { pg, execute } = await fixture(t);
  await pg.exec(await readFile(migration, "utf8"));
  const record = createDatabaseMeterRecorder(execute),
    started = observation();
  await record(started);
  await record(started);
  assert.equal(
    (await readDatabaseMeterExport(execute)).pendingAttempts.length,
    1,
  );
  await assert.rejects(record({ ...started, attemptNumber: 2 }), /conflict/);
  const final = {
    ...started,
    outcome: "completed" as const,
    providerRequestId: "PRIVATE_HEADER",
    event: { ...started.event, status: "success" as const },
  };
  await assert.rejects(
    record({ ...final, event: { ...final.event, jobId: "other-job" } }),
    /persisted intent/,
  );
  await record(final);
  await record(final);
  const exported = await readDatabaseMeterExport(execute);
  assert.equal(exported.pendingAttempts.length, 0);
  assert.equal(exported.events.length, 1);
  assert.equal(exported.events[0].estimate, null);
  assert.equal(exported.events[0].billed, null);
  assert.match(
    exported.observations[0].providerRequestId!,
    /^sha256:[a-f0-9]{64}$/,
  );
  assert(!JSON.stringify(exported).includes("PRIVATE_HEADER"));
  await assert.rejects(record({ ...final, outcome: "timeout" }), /conflict/);
  await assert.rejects(record(observation("completed")), /persisted intent/);
  assert.equal(
    (await pg.query("SELECT * FROM openai_meter_observations")).rows.length,
    2,
  );
});

test("closed metadata boundary strips injected private payloads and exports bounded pages", async (t) => {
  const { pg, execute } = await fixture(t);
  await pg.exec(await readFile(migration, "utf8"));
  const record = createDatabaseMeterRecorder(execute),
    started = observation();
  await record({
    ...started,
    prompt: "PRIVATE_PROMPT",
    event: {
      ...started.event,
      audio: "PRIVATE_AUDIO",
      usage: { ...started.event.usage, raw: "PRIVATE_RAW" },
    },
  } as AttemptObservation);
  await record(observation());
  const data = JSON.stringify(
    (await pg.query("SELECT observation FROM openai_meter_observations")).rows,
  );
  for (const value of ["PRIVATE_PROMPT", "PRIVATE_AUDIO", "PRIVATE_RAW"])
    assert(!data.includes(value));
  const first = await readDatabaseMeterExport(execute, 1);
  assert.equal(first.pendingAttempts.length, 1);
  assert.equal(first.nextOffset, 1);
  assert.equal((await readDatabaseMeterExport(execute, 1, 1)).nextOffset, null);
  await assert.rejects(readDatabaseMeterExport(execute, 5001));
});

test("async intent rejection blocks Responses HTTP and final rejection fails closed with persisted pending", async (t) => {
  let calls = 0;
  await assert.rejects(
    runCopilotTurn(
      turn,
      {
        ...config,
        recordAttempt: async () => {
          throw new Error("PRIVATE_DB_ERROR");
        },
      },
      async () => {
        calls++;
        return response();
      },
    ),
    /API usage recording is unavailable/,
  );
  assert.equal(calls, 0);
  const { pg, execute } = await fixture(t);
  await pg.exec(await readFile(migration, "utf8"));
  const durable = createDatabaseMeterRecorder(execute);
  await assert.rejects(
    runCopilotTurn(
      turn,
      {
        ...config,
        recordAttempt: async (item) => {
          if (item.outcome !== "started")
            throw new Error("PRIVATE_FINAL_ERROR");
          await durable(item);
        },
      },
      async () => {
        calls++;
        assert.equal(
          (await readDatabaseMeterExport(execute)).pendingAttempts.length,
          1,
        );
        return response();
      },
    ),
    /API usage recording is unavailable/,
  );
  assert.equal(calls, 1);
  const rows = await readDatabaseMeterExport(execute);
  assert.equal(rows.events.length, 0);
  assert.equal(rows.pendingAttempts.length, 1);
});

test("async transcription intent/final are awaited and final failure does not pretend success", async () => {
  let calls = 0,
    finished = false;
  const wav = encodeCopilotWav([new Float32Array(1600)], 16000);
  await assert.rejects(
    transcribeCopilotWav(
      wav,
      {
        apiKey: "synthetic",
        projectId: "project-a",
        recordAttempt: async () => {
          throw new Error("PRIVATE_DB_ERROR");
        },
      },
      async () => {
        calls++;
        return Response.json({ text: "ignored" });
      },
    ),
    /API usage recording is unavailable/,
  );
  assert.equal(calls, 0);
  await assert.rejects(
    transcribeCopilotWav(
      wav,
      {
        apiKey: "synthetic",
        projectId: "project-a",
        recordAttempt: async (item) => {
          if (item.outcome === "started") {
            await Promise.resolve();
            finished = true;
          } else throw new Error("PRIVATE_FINAL_ERROR");
        },
      },
      async () => {
        assert(finished);
        calls++;
        return Response.json({ text: "private spoken question" });
      },
    ),
    /API usage recording is unavailable/,
  );
  assert.equal(calls, 1);
});

test("hanging async final persistence is bounded, preserves pending and never repeats transport", async (t) => {
  const { pg, execute } = await fixture(t);
  await pg.exec(await readFile(migration, "utf8"));
  const durable = createDatabaseMeterRecorder(execute);
  let calls = 0;
  await assert.rejects(
    runCopilotTurn(
      turn,
      {
        ...config,
        meterTimeoutMs: 15,
        recordAttempt: async (item) => {
          if (item.outcome === "started") await durable(item);
          else await new Promise<void>(() => {});
        },
      },
      async () => {
        calls++;
        return response();
      },
    ),
    /API usage recording is unavailable/,
  );
  assert.equal(calls, 1);
  const exported = await readDatabaseMeterExport(execute);
  assert.equal(exported.pendingAttempts.length, 1);
  assert.equal(exported.events.length, 0);
  const wav = encodeCopilotWav([new Float32Array(1600)], 16000);
  await assert.rejects(
    transcribeCopilotWav(
      wav,
      {
        apiKey: "synthetic",
        projectId: "project-a",
        meterTimeoutMs: 15,
        recordAttempt: async (item) => {
          if (item.outcome !== "started") await new Promise<void>(() => {});
        },
      },
      async () => {
        calls++;
        return Response.json({ text: "synthetic" });
      },
    ),
    /API usage recording is unavailable/,
  );
  assert.equal(calls, 2);
});
