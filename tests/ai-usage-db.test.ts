import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  aiUsageReadQuery,
  readAiUsageRecords,
  type AiUsageReadQuery,
} from "../src/server/db/ai-usage";
import { aggregateAiUsage } from "../src/lib/ai-usage";
import { HttpError } from "../src/server/errors";

test("admin-only global meter read deduplicates before period filtering, respects DST and exposes narrow metadata", async () => {
  const pg = new PGlite(),
    dialect = new PgDialect();
  const query = async (actor: string, filter: AiUsageReadQuery) => {
    const parsed = dialect.sqlToQuery(aiUsageReadQuery(actor, filter));
    return (
      await pg.query<{
        authorized: boolean;
        invalidDateCount: number;
        records: Record<string, unknown>[];
      }>(parsed.sql, parsed.params)
    ).rows[0];
  };
  const insert = async (
    id: string,
    phase: "pending" | "final",
    startedAt: string,
    source = "responses",
    model = "gpt-5.6-terra",
  ) => {
    const observation = {
      event: {
        attemptId: id,
        provider: "openai",
        projectId: "project-not-in-admin-memberships",
        requestId: "PRIVATE-REQUEST",
        jobId: "PRIVATE-JOB",
        model,
        source: `fieldtrack-copilot-${source}`,
        startedAt,
        endedAt: startedAt,
        status: "success",
        usage: {
          inputTokens: 100,
          cachedInputTokens: 20,
          cacheWriteInputTokens: null,
          outputTokens: 10,
          reasoningOutputTokens: null,
          totalTokens: 110,
        },
        audioSeconds: 999,
      },
      audioSeconds: source === "transcription" ? 24 : null,
      outcome: phase === "pending" ? "started" : "completed",
      usageState: "partial",
      latencyMs: 20,
      providerRequestId: "PRIVATE-PROVIDER-REQUEST",
      token: "PRIVATE-TOKEN",
    };
    await pg.query(
      "INSERT INTO openai_meter_observations(attempt_id,phase,observation)VALUES($1,$2,$3::jsonb)",
      [id, phase, JSON.stringify(observation)],
    );
  };
  try {
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    for (const entry of journal.entries)
      await pg.exec(await readFile(`drizzle/${entry.tag}.sql`, "utf8"));
    await pg.exec(
      "INSERT INTO companies(id,name)VALUES('c','Test');INSERT INTO users(id,name,email,role,company_id)VALUES('a','Admin','a@test.invalid','admin','c'),('m','Manager','m@test.invalid','manager','c'),('s','Supervisor','s@test.invalid','supervisor','c'),('w','Worker','w@test.invalid','worker','c');",
    );
    const filter = {
      from: "2026-10-25",
      through: "2026-10-25",
      timezone: "Europe/Rome" as const,
    };
    await insert("start", "final", "2026-10-24T22:00:00.000Z");
    await insert(
      "end",
      "final",
      "2026-10-25T22:59:59.999Z",
      "transcription",
      "gpt-transcribe",
    );
    await insert("too-early", "final", "2026-10-24T21:59:59.999Z");
    await insert("too-late", "final", "2026-10-25T23:00:00.000Z");
    await insert("both", "pending", "2026-10-25T12:00:00.000Z");
    await insert("both", "final", "2026-10-25T12:00:00.000Z");
    await insert("pending", "pending", "2026-10-25T13:00:00.000Z");
    await insert("final-outside", "pending", "2026-10-25T14:00:00.000Z");
    await insert("final-outside", "final", "2026-10-26T14:00:00.000Z");
    const selected = await query("a", filter);
    assert(
      selected.authorized,
      "Administrator needs no project membership to see the full account's FieldTrack attempts",
    );
    assert.equal(selected.records.length, 4);
    assert.equal(selected.invalidDateCount, 0);
    assert.equal(
      selected.records.filter((row) => row.attemptId === "both").length,
      1,
    );
    assert.equal(
      selected.records.find((row) => row.attemptId === "both")?.phase,
      "final",
    );
    assert(!selected.records.some((row) => row.attemptId === "final-outside"));
    assert.equal(
      selected.records.find((row) => row.attemptId === "pending")?.phase,
      "pending",
    );
    const publicShape = JSON.stringify(selected.records);
    for (const secret of [
      "PRIVATE-REQUEST",
      "PRIVATE-JOB",
      "PRIVATE-PROVIDER-REQUEST",
      "PRIVATE-TOKEN",
      "project-not-in-admin-memberships",
    ])
      assert(!publicShape.includes(secret));
    assert(!("observation" in selected.records[0]));
    assert(!("event" in selected.records[0]));
    const audio = aggregateAiUsage(
      readAiUsageRecords(
        await query("a", { ...filter, source: "transcription" }),
      ),
      { ...filter, source: "transcription" },
    );
    assert.equal(audio.totals.attempts, 1);
    assert.equal(
      selected.records.find((row) => row.source === "transcription")
        ?.audioSeconds,
      24,
      "Audio duration comes from observation metadata, preserving the collector event contract",
    );
    assert.equal(audio.facets.models.length, 2);
    assert.deepEqual(audio.facets.sources, ["responses", "transcription"]);
    const model = aggregateAiUsage(
      readAiUsageRecords(
        await query("a", { ...filter, model: "gpt-transcribe" }),
      ),
      { ...filter, model: "gpt-transcribe" },
    );
    assert.equal(model.totals.attempts, 1);
    assert.equal(model.facets.models.length, 2);
    const utc = await query("a", { ...filter, timezone: "UTC" });
    assert(!utc.records.some((row) => row.attemptId === "start"));
    assert(utc.records.some((row) => row.attemptId === "too-late"));
    await insert("spring-start", "final", "2026-03-28T23:00:00Z");
    await insert("spring-end", "final", "2026-03-29T21:59:59Z");
    await insert("spring-too-late", "final", "2026-03-29T22:00:00Z");
    assert.equal(
      (
        await query("a", {
          from: "2026-03-29",
          through: "2026-03-29",
          timezone: "Europe/Rome",
        })
      ).records.length,
      2,
      "Spring day has 23 hours",
    );
    for (const actor of ["m", "s", "w", "missing"]) {
      const denied = await query(actor, filter);
      assert.equal(denied.authorized, false);
      assert.deepEqual(denied.records, []);
      assert.equal(denied.invalidDateCount, 0);
    }
    await pg.exec("UPDATE users SET role='manager' WHERE id='a'");
    assert.equal(
      (await query("a", filter)).authorized,
      false,
      "SQL checks role after an earlier HTTP authorization snapshot",
    );
    await pg.exec("UPDATE users SET role='admin' WHERE id='a'");
    await insert("invalid", "final", "not-a-date");
    await insert("invalid-day", "final", "2026-02-30T12:00:00Z");
    await insert("invalid-year", "final", "0000-01-01T12:00:00Z");
    const invalid = await query("a", filter);
    assert.equal(
      invalid.invalidDateCount,
      3,
      "Malformed dates are counted for a fail-closed response instead of silently omitted or cast errors",
    );
    assert.equal(invalid.records.length, 4);
    assert.throws(
      () => readAiUsageRecords(invalid),
      (error) => error instanceof HttpError && error.status === 503,
    );
    assert.equal(
      (
        await pg.query<{ count: number }>(
          "SELECT count(*)::integer count FROM openai_meter_observations",
        )
      ).rows[0].count,
      15,
      "The dashboard performs no accounting writes",
    );
  } finally {
    await pg.close();
  }
});

test("usage reader rejects revoked access, corrupt metadata and the explicit overflow bound without partial totals", () => {
  const record = {
    attemptId: "one",
    phase: "final",
    model: "gpt-5.6-terra",
    source: "responses",
    status: "success",
    outcome: "completed",
    startedAt: "2026-11-14T12:00:00.000Z",
    usageState: "partial",
    usage: {
      inputTokens: 100,
      cachedInputTokens: null,
      cacheWriteInputTokens: null,
      outputTokens: 10,
      reasoningOutputTokens: null,
      totalTokens: 110,
    },
  };
  const result = { authorized: true, invalidDateCount: 0, records: [record] };
  assert.equal(readAiUsageRecords(result).length, 1);
  for (const invalid of [
    { ...result, invalidDateCount: 1 },
    { ...result, records: Array(50001).fill(record) },
    { ...result, records: [{ ...record, usage: {} }] },
    { ...result, records: [{ ...record, model: "sk-private-credential" }] },
  ])
    assert.throws(
      () => readAiUsageRecords(invalid),
      (error) => error instanceof HttpError && error.status === 503,
    );
  assert.throws(
    () => readAiUsageRecords({ ...result, authorized: false }),
    (error) => error instanceof HttpError && error.status === 403,
  );
});
