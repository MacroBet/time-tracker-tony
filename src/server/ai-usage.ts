import "server-only";
import {
  aggregateAiUsage,
  parseAiUsageQuery,
  type AiUsageRecord,
} from "@/lib/ai-usage";
import { requireUser } from "./auth";
import { dataMode } from "./config";
import { db } from "./db/client";
import { HttpError, requireCondition } from "./errors";
import { json } from "./http";
import { aiUsageReadQuery, readAiUsageRecords } from "./db/ai-usage";

/** Local demonstration only: deterministic metadata, never a substitute for hosted accounting. */
function syntheticUsage(now: Date): AiUsageRecord[] {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const end = new Date(`${today}T12:00:00.000Z`),
    records: AiUsageRecord[] = [];
  const emptyUsage = {
    inputTokens: null,
    cachedInputTokens: null,
    cacheWriteInputTokens: null,
    outputTokens: null,
    reasoningOutputTokens: null,
    totalTokens: null,
  };
  for (let day = 0; day < 30; day++) {
    const startedAt = new Date(end.getTime() - day * 86400000).toISOString();
    const common = {
      startedAt,
      status: "success" as const,
      outcome: "completed" as const,
      phase: "final" as const,
      usageState: "partial" as const,
    };
    const usage = {
      inputTokens: 1800 + day * 73,
      cachedInputTokens: day % 4 === 0 ? null : 400 + day * 20,
      cacheWriteInputTokens: null,
      outputTokens: 260 + day * 11,
      reasoningOutputTokens: null,
      totalTokens: 2060 + day * 84,
    };
    records.push({
      ...common,
      attemptId: `demo-response-${day}`,
      model: "gpt-5.6-terra",
      source: "responses",
      usage,
    });
    records.push({
      ...common,
      attemptId: `demo-audio-${day}`,
      model: "gpt-transcribe",
      source: "transcription",
      audioSeconds: day % 5 === 0 ? null : 15 + (day % 6) * 3,
      usage: emptyUsage,
      usageState: "missing",
    });
    if (day % 4 === 0)
      records.push({
        ...common,
        attemptId: `demo-unknown-${day}`,
        model: "unpriced-model",
        source: "responses",
        usage,
      });
    if (day % 5 === 0)
      records.push({
        ...common,
        attemptId: `demo-failed-${day}`,
        model: "gpt-5.6-terra",
        source: "responses",
        status: "failure",
        outcome: "http_error",
        usage: emptyUsage,
        usageState: "missing",
      });
    if (day % 7 === 0)
      records.push({
        ...common,
        attemptId: `demo-pending-${day}`,
        phase: "pending",
        outcome: "started",
        model: "gpt-5.6-terra",
        source: "responses",
        usage: emptyUsage,
        usageState: "missing",
      });
  }
  return records;
}

export async function getAiUsage(request: Request) {
  const user = await requireUser();
  requireCondition(
    user.role === "admin",
    403,
    "Only administrators can view AI usage.",
  );
  const now = new Date(),
    query = parseAiUsageQuery(
      Object.fromEntries(new URL(request.url).searchParams),
      now,
    ),
    mode = dataMode();
  if (mode === "demo")
    return json({
      ...aggregateAiUsage(syntheticUsage(now), query, now),
      dataSource: "synthetic-demo",
    });
  requireCondition(
    mode === "neon",
    503,
    "AI usage storage is not configured. No usage totals are available.",
  );
  let result: Record<string, unknown> | undefined;
  try {
    result = (await db().execute(aiUsageReadQuery(user.id, query))).rows[0];
  } catch {
    throw new HttpError(
      503,
      "AI usage storage is unavailable. No usage totals were returned.",
    );
  }
  const records = readAiUsageRecords(result);
  try {
    return json({
      ...aggregateAiUsage(records, query, now),
      dataSource: "database",
    });
  } catch {
    throw new HttpError(
      503,
      "Stored AI usage metadata requires review. No partial totals were returned.",
    );
  }
}
