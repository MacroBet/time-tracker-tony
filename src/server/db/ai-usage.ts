import { sql } from "drizzle-orm";
import { aiUsageRecordSchema, type AiUsageRecord } from "@/lib/ai-usage";
import { safeMeterReference } from "@/lib/openai-metering";
import { HttpError, requireCondition } from "../errors";

export type AiUsageReadQuery = {
  from: string;
  through: string;
  timezone: "Europe/Rome" | "UTC";
  model?: string;
  source?: "responses" | "transcription";
};
export const MAX_AI_USAGE_ATTEMPTS = 50000;

/** Fail closed on corrupt/incomplete storage and the explicit bound; never publish partial totals. */
export function readAiUsageRecords(
  result: Record<string, unknown> | undefined,
): AiUsageRecord[] {
  requireCondition(
    result?.authorized === true,
    403,
    "Only administrators can view AI usage.",
  );
  requireCondition(
    result.invalidDateCount === 0,
    503,
    "Stored AI usage contains invalid dates and requires review. No partial totals were returned.",
  );
  requireCondition(
    Array.isArray(result.records) &&
      result.records.length <= MAX_AI_USAGE_ATTEMPTS,
    503,
    "This period contains too many AI attempts to summarize safely. Choose a shorter period; no partial totals were returned.",
  );
  try {
    return result.records.map((value) => {
      const record = aiUsageRecordSchema.parse(value);
      if (record.model !== null && safeMeterReference(record.model) === null)
        throw new Error("Invalid model metadata");
      return record;
    });
  } catch {
    throw new HttpError(
      503,
      "Stored AI usage metadata requires review. No partial totals were returned.",
    );
  }
}

/** Read-only, global FieldTrack accounting. Membership never narrows an administrator's totals. */
export function aiUsageReadQuery(actorId: string, query: AiUsageReadQuery) {
  return sql`WITH authorized AS MATERIALIZED (
    SELECT 1 FROM users WHERE id=${actorId} AND role='admin'
  ), canonical AS MATERIALIZED (
    SELECT meter.phase,meter.observation,meter.attempt_id
    FROM openai_meter_observations meter
    WHERE EXISTS(SELECT 1 FROM authorized)
      AND (meter.phase='final' OR (meter.phase='pending' AND NOT EXISTS (
        SELECT 1 FROM openai_meter_observations terminal WHERE terminal.attempt_id=meter.attempt_id AND terminal.phase='final')))
  ), extracted AS (
    SELECT *, observation#>>'{event,startedAt}' AS started_at FROM canonical
  ), dated AS MATERIALIZED (
    SELECT *, CASE WHEN started_at ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,9})?Z$'
      THEN CASE WHEN substring(started_at,1,4)::integer BETWEEN 1 AND 9999
        THEN CASE WHEN substring(started_at,9,2)::integer <= extract(day FROM (make_date(substring(started_at,1,4)::integer,substring(started_at,6,2)::integer,1)+interval '1 month'-interval '1 day'))
          THEN started_at::timestamptz END END END AS started_time
    FROM extracted
  ), selected AS MATERIALIZED (
    SELECT * FROM dated
    WHERE started_time >= (${query.from}::date::timestamp AT TIME ZONE ${query.timezone})
      AND started_time < ((${query.through}::date+1)::timestamp AT TIME ZONE ${query.timezone})
    ORDER BY started_time,attempt_id LIMIT ${MAX_AI_USAGE_ATTEMPTS + 1}
  ), metadata AS (
    SELECT jsonb_build_object(
      'attemptId',attempt_id,'phase',phase,'model',observation#>'{event,model}',
      'source',CASE observation#>>'{event,source}' WHEN 'fieldtrack-copilot-responses' THEN 'responses' WHEN 'fieldtrack-copilot-transcription' THEN 'transcription' END,
      'outcome',observation->'outcome','status',observation#>'{event,status}',
      'startedAt',observation#>'{event,startedAt}',
      'usageState',observation->'usageState',
      'audioSeconds',observation->'audioSeconds',
      'usage',jsonb_build_object(
        'inputTokens',observation#>'{event,usage,inputTokens}',
        'cachedInputTokens',observation#>'{event,usage,cachedInputTokens}',
        'cacheWriteInputTokens',observation#>'{event,usage,cacheWriteInputTokens}',
        'outputTokens',observation#>'{event,usage,outputTokens}',
        'reasoningOutputTokens',observation#>'{event,usage,reasoningOutputTokens}',
        'totalTokens',observation#>'{event,usage,totalTokens}'
      )
    ) AS value, started_time,attempt_id FROM selected
  ) SELECT EXISTS(SELECT 1 FROM authorized) AS authorized,
    (SELECT count(*)::integer FROM dated WHERE started_time IS NULL) AS "invalidDateCount",
    coalesce((SELECT jsonb_agg(value ORDER BY started_time,attempt_id) FROM metadata),'[]'::jsonb) AS records`;
}
