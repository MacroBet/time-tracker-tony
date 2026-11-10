import { sql, type SQL } from "drizzle-orm";
import { sanitizeMeterObservation } from "./openai-meter-store";
import type { AttemptObservation } from "../lib/openai-metering";

export type MeterDatabase = (
  query: SQL,
) => Promise<{ rows: Record<string, unknown>[] }>;

/** A real read of the migrated table; connection-string presence is not readiness. */
export async function ensureDatabaseMeterReady(execute: MeterDatabase) {
  await execute(
    sql`SELECT attempt_id, phase, observation FROM openai_meter_observations LIMIT 0`,
  );
}

/** Append one immutable intent and terminal observation per attempt. No project audit writes. */
export function createDatabaseMeterRecorder(
  execute: MeterDatabase,
): (input: AttemptObservation) => Promise<void> {
  return async (input) => {
    const observation = sanitizeMeterObservation(input);
    const phase = observation.outcome === "started" ? "pending" : "final";
    const attemptId = observation.event.attemptId;
    if (phase === "final") {
      const pending =
        await execute(sql`SELECT observation FROM openai_meter_observations
        WHERE attempt_id=${attemptId} AND phase='pending'`);
      const intent = pending.rows[0]?.observation as
        AttemptObservation | undefined;
      if (
        !intent ||
        intent.event.requestId !== observation.event.requestId ||
        intent.event.eventId !== observation.event.eventId ||
        intent.event.jobId !== observation.event.jobId ||
        intent.event.projectId !== observation.event.projectId ||
        intent.event.source !== observation.event.source ||
        intent.event.startedAt !== observation.event.startedAt
      )
        throw new Error("Meter final does not match a persisted intent");
    }
    const serialized = JSON.stringify(observation);
    // Separate statements intentionally give a retry a fresh read snapshot after a
    // concurrent INSERT conflict. Never overwrite a different observation.
    await execute(sql`INSERT INTO openai_meter_observations (attempt_id, phase, observation)
      VALUES (${attemptId}, ${phase}, ${serialized}::jsonb)
      ON CONFLICT (attempt_id, phase) DO NOTHING`);
    const same =
      await execute(sql`SELECT observation=${serialized}::jsonb AS identical
      FROM openai_meter_observations WHERE attempt_id=${attemptId} AND phase=${phase}`);
    if (same.rows[0]?.identical !== true)
      throw new Error("Meter idempotency conflict");
  };
}

/** Explicit private export, never a public endpoint or a recurring collector. */
export async function readDatabaseMeterExport(
  execute: MeterDatabase,
  limit = 1000,
  offset = 0,
) {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 5000 ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 1_000_000
  )
    throw new Error("Invalid meter export bounds");
  const result =
    await execute(sql`SELECT observation FROM openai_meter_observations AS meter
    WHERE phase='final' OR (phase='pending' AND NOT EXISTS (
      SELECT 1 FROM openai_meter_observations AS terminal WHERE terminal.attempt_id=meter.attempt_id AND terminal.phase='final'))
    ORDER BY recorded_at, attempt_id, phase LIMIT ${limit + 1} OFFSET ${offset}`);
  const hasMore = result.rows.length > limit;
  result.rows = result.rows.slice(0, limit);
  const observations = result.rows.map(
    (row) => row.observation as AttemptObservation,
  );
  const finals = observations.filter((item) => item.outcome !== "started");
  const completed = new Set(finals.map((item) => item.event.attemptId));
  return {
    schemaVersion: 1,
    coverage: "database-fieldtrack-attempts-only",
    nextOffset: hasMore ? offset + limit : null,
    events: finals.map((item) => item.event),
    pendingAttempts: observations
      .filter(
        (item) =>
          item.outcome === "started" && !completed.has(item.event.attemptId),
      )
      .map((item) => ({
        provider: item.event.provider,
        attemptId: item.event.attemptId,
        projectId: item.event.projectId,
        jobId: item.event.jobId,
        source: item.event.source,
        startedAt: item.event.startedAt,
        requestId: item.event.requestId,
      })),
    observations: finals.map(({ event, ...item }) => ({
      attemptId: event.attemptId,
      ...item,
    })),
  };
}
