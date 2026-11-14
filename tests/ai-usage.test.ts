import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_USAGE_PRICING,
  aggregateAiUsage,
  aiUsageDate,
  aiUsageRecordSchema,
  estimateAiAttemptCost,
  parseAiUsageQuery,
  type AiUsageRecord,
} from "../src/lib/ai-usage";
import type { TokenUsage } from "../src/lib/openai-metering";

const now = new Date("2026-11-14T23:30:00.000Z");
const query = (overrides = {}) =>
  parseAiUsageQuery(
    {
      from: "2026-11-01",
      through: "2026-11-30",
      timezone: "UTC",
      ...overrides,
    },
    now,
  );
const missing: TokenUsage = {
  inputTokens: null,
  cachedInputTokens: null,
  cacheWriteInputTokens: null,
  outputTokens: null,
  reasoningOutputTokens: null,
  totalTokens: null,
};
function record(overrides: Partial<AiUsageRecord> = {}): AiUsageRecord {
  return {
    attemptId: "attempt-1",
    phase: "final",
    model: "gpt-5.6-terra",
    source: "responses",
    status: "success",
    outcome: "completed",
    startedAt: "2026-11-10T12:00:00.000Z",
    usageState: "complete",
    usage: {
      inputTokens: 1000,
      cachedInputTokens: 200,
      cacheWriteInputTokens: 100,
      outputTokens: 100,
      reasoningOutputTokens: 30,
      totalTokens: 1100,
    },
    ...overrides,
  };
}
const close = (actual: number | null, expected: number) => {
  assert.notEqual(actual, null);
  assert.ok(Math.abs(actual! - expected) < 1e-12, `${actual} != ${expected}`);
};

test("query defaults are timezone calendar days; date bounds are strict and inclusive through 366 days", () => {
  assert.deepEqual(parseAiUsageQuery({}, now), {
    from: "2026-10-17",
    through: "2026-11-15",
    timezone: "Europe/Rome",
  });
  assert.equal(
    parseAiUsageQuery({ timezone: "UTC" }, now).through,
    "2026-11-14",
  );
  assert.equal(
    parseAiUsageQuery({ through: "2026-03-01" }, now).from,
    "2026-01-31",
  );
  assert.equal(
    parseAiUsageQuery(
      new URLSearchParams(
        "from=2026-01-01&through=2027-01-01&timezone=UTC&model=&source=",
      ),
      now,
    ).from,
    "2026-01-01",
  );
  assert.throws(
    () => query({ from: "2026-01-01", through: "2027-01-02" }),
    /366/,
  );
  assert.throws(() => query({ from: "2026-02-30" }));
  assert.throws(() => query({ from: "2026-11-20", through: "2026-11-19" }));
  assert.throws(() => query({ timezone: "America/New_York" }));
  assert.throws(() => query({ from: "2026-1-01" }));
});

test("Rome spring and autumn DST group by local calendar date without dropping or repeating days", () => {
  const spring = aggregateAiUsage(
    [
      record({ attemptId: "before", startedAt: "2026-03-28T23:30:00Z" }),
      record({ attemptId: "after", startedAt: "2026-03-29T22:30:00Z" }),
      record({ attemptId: "excluded", startedAt: "2026-03-28T22:59:59Z" }),
    ],
    query({
      from: "2026-03-29",
      through: "2026-03-30",
      timezone: "Europe/Rome",
    }),
    now,
  );
  assert.deepEqual(
    spring.days.map(({ date, attempts }) => ({ date, attempts })),
    [
      { date: "2026-03-29", attempts: 1 },
      { date: "2026-03-30", attempts: 1 },
    ],
  );
  const autumn = aggregateAiUsage(
    [
      record({ attemptId: "summer", startedAt: "2026-10-25T00:30:00Z" }),
      record({ attemptId: "winter", startedAt: "2026-10-25T01:30:00Z" }),
    ],
    query({
      from: "2026-10-25",
      through: "2026-10-26",
      timezone: "Europe/Rome",
    }),
    now,
  );
  assert.deepEqual(
    autumn.days.map(({ attempts }) => attempts),
    [2, 0],
  );
  assert.equal(
    aiUsageDate("2026-10-25T23:30:00Z", "Europe/Rome"),
    "2026-10-26",
  );
});

test("terminal observation wins globally before date/model filters; different attempts sharing request metadata remain distinct", () => {
  const pending = record({
    phase: "pending",
    outcome: "started",
    status: "failure",
    model: null,
    usage: missing,
  });
  const final = record({ startedAt: "2026-12-01T12:00:00Z" });
  assert.equal(
    aggregateAiUsage([pending, final], query(), now).totals.attempts,
    0,
  );
  const sameRequest = { requestId: "private-shared-request" };
  const result = aggregateAiUsage(
    [
      { ...pending, ...sameRequest },
      { ...record(), ...sameRequest },
      { ...record({ attemptId: "attempt-2" }), ...sameRequest },
    ],
    query({ model: "gpt-5.6-terra" }),
    now,
  );
  assert.equal(result.totals.attempts, 2);
  assert.equal(result.totals.pendingAttempts, 0);
  assert.equal(
    aggregateAiUsage([record(), pending], query(), now).totals.attempts,
    1,
  );
  assert.equal(result.totals.completedAttempts, 2);
  assert.equal(
    JSON.stringify(result).includes("private-shared-request"),
    false,
  );
  assert.equal(JSON.stringify(result).includes("attempt-1"), false);
});

test("pricing subtracts cache subsets and reasoning is already included in output", () => {
  const item = record();
  const expected = (700 * 2 + 200 * 0.2 + 100 * 2.5 + 100 * 12) / 1e6;
  close(estimateAiAttemptCost(item).estimatedUsdMin, expected);
  close(estimateAiAttemptCost(item).estimatedUsdMax, expected);
  const result = aggregateAiUsage([item], query(), now);
  assert.equal(result.totals.tokens.totalTokens, 1100);
  assert.equal(result.totals.tokens.inputTokens, 1000);
  assert.equal(result.totals.tokens.outputTokens, 100);
  assert.equal(result.totals.tokens.reasoningOutputTokens, 30);
  assert.equal(result.totals.billedUsd, null);
  assert.equal(result.pricing.asOf, "2026-11-14");
  assert.equal(AI_USAGE_PRICING.currency, "USD");
});

test("missing cache writes produce a range rather than an assumed zero; absent reads can reduce the lower bound", () => {
  const item = record();
  const noWrite = record({
    usage: { ...item.usage, cacheWriteInputTokens: null },
  });
  const cost = estimateAiAttemptCost(noWrite);
  close(cost.estimatedUsdMin, (800 * 2 + 200 * 0.2 + 100 * 12) / 1e6);
  close(cost.estimatedUsdMax, (800 * 2.5 + 200 * 0.2 + 100 * 12) / 1e6);
  const neither = estimateAiAttemptCost(
    record({
      usage: {
        ...item.usage,
        cachedInputTokens: null,
        cacheWriteInputTokens: null,
      },
    }),
  );
  close(neither.estimatedUsdMin, (1000 * 0.2 + 100 * 12) / 1e6);
  close(neither.estimatedUsdMax, (1000 * 2.5 + 100 * 12) / 1e6);
  const noRead = estimateAiAttemptCost(
    record({ usage: { ...item.usage, cachedInputTokens: null } }),
  );
  close(noRead.estimatedUsdMin, (900 * 0.2 + 100 * 2.5 + 100 * 12) / 1e6);
  close(noRead.estimatedUsdMax, (900 * 2 + 100 * 2.5 + 100 * 12) / 1e6);
  assert.equal(
    aggregateAiUsage([noWrite], query(), now).totals.rangedPriceAttempts,
    1,
  );
});

test("long pricing applies to the entire request strictly above the 272000 input threshold", () => {
  const usage = { ...record().usage, inputTokens: 272000, totalTokens: 272100 };
  close(
    estimateAiAttemptCost(record({ usage })).estimatedUsdMax,
    ((272000 - 300) * 2 + 200 * 0.2 + 100 * 2.5 + 100 * 12) / 1e6,
  );
  const long = { ...usage, inputTokens: 272001, totalTokens: 272101 };
  close(
    estimateAiAttemptCost(record({ usage: long })).estimatedUsdMax,
    ((272001 - 300) * 4 + 200 * 0.4 + 100 * 5 + 100 * 18) / 1e6,
  );
});

test("invalid overlapping cache counts and out-of-parent reasoning are flagged and never priced", () => {
  const invalid = record({
    usage: {
      ...record().usage,
      cachedInputTokens: 900,
      cacheWriteInputTokens: 200,
    },
  });
  assert.equal(estimateAiAttemptCost(invalid).reason, "invalid-usage");
  const result = aggregateAiUsage([invalid], query(), now);
  assert.equal(result.totals.invalidUsageAttempts, 1);
  assert.equal(result.totals.tokens.cachedInputTokens, null);
  assert.equal(result.totals.unknownTokenAttempts.cacheWriteInputTokens, 1);
  assert.equal(result.totals.estimatedUsdMax, null);
  assert.equal(
    estimateAiAttemptCost(
      record({ usage: { ...record().usage, reasoningOutputTokens: 101 } }),
    ).reason,
    "invalid-usage",
  );
  assert.equal(
    estimateAiAttemptCost(
      record({ usage: { ...record().usage, totalTokens: 5000 } }),
    ).reason,
    "invalid-usage",
  );
});

test("unknown usage is never displayed as zero and partially known totals keep explicit subtotals", () => {
  const unknown = record({ attemptId: "unknown", usage: missing });
  const noUsage = aggregateAiUsage([unknown], query(), now).totals;
  assert.equal(noUsage.tokens.inputTokens, null);
  assert.equal(noUsage.tokens.totalTokens, null);
  assert.equal(noUsage.estimatedUsdMin, null);
  assert.equal(noUsage.missingUsageAttempts, 1);
  const partial = aggregateAiUsage([record(), unknown], query(), now).totals;
  assert.equal(partial.tokens.inputTokens, null);
  assert.equal(partial.knownTokens.inputTokens, 1000);
  assert.equal(partial.unknownTokenAttempts.inputTokens, 1);
  assert.equal(partial.pricedAttempts, 1);
  assert.equal(partial.unpricedAttempts, 1);
  close(
    partial.estimatedUsdMax,
    estimateAiAttemptCost(record()).estimatedUsdMax!,
  );
  const empty = aggregateAiUsage([], query(), now);
  assert.equal(empty.totals.tokens.totalTokens, 0);
  assert.equal(empty.totals.estimatedUsdMax, 0);
  assert.equal(empty.days.length, 30);
  assert.ok(
    empty.days.every((day) => day.attempts === 0 && day.estimatedUsdMin === 0),
  );
});

test("pending is not failure, final statuses reconcile, and known response usage can price an interrupted attempt", () => {
  const result = aggregateAiUsage(
    [
      record({
        attemptId: "pending",
        phase: "pending",
        outcome: "started",
        status: "failure",
        usage: missing,
      }),
      record({
        attemptId: "failure",
        outcome: "http_error",
        status: "failure",
        usage: missing,
      }),
      record({
        attemptId: "cancel",
        outcome: "cancel",
        status: "cancel",
        usage: missing,
      }),
      record({
        attemptId: "incomplete",
        outcome: "incomplete",
        status: "failure",
      }),
      record({ attemptId: "completed" }),
    ],
    query(),
    now,
  ).totals;
  assert.equal(result.attempts, 5);
  assert.equal(result.pendingAttempts, 1);
  assert.equal(result.failedAttempts, 2);
  assert.equal(result.incompleteAttempts, 1);
  assert.equal(result.completedAttempts, 1);
  assert.equal(result.pricedAttempts, 2);
  assert.equal(result.unpricedAttempts, 3);
});

test("transcription prices only completed exact-model calls with measured duration; legacy and failed calls are unpriced", () => {
  const audio = record({
    model: "gpt-transcribe",
    source: "transcription",
    usage: missing,
    usageState: "missing",
    audioSeconds: 90,
  });
  close(estimateAiAttemptCost(audio).estimatedUsdMax, 0.0045 * 1.5);
  assert.equal(
    estimateAiAttemptCost({ ...audio, audioSeconds: undefined }).reason,
    "missing-audio-duration",
  );
  assert.equal(
    estimateAiAttemptCost({
      ...audio,
      status: "failure",
      outcome: "http_error",
    }).reason,
    "unfinished-audio",
  );
  assert.equal(
    estimateAiAttemptCost({ ...audio, phase: "pending", outcome: "started" })
      .reason,
    "pending",
  );
  assert.equal(
    estimateAiAttemptCost({ ...audio, model: "gpt-transcribe-2026-11-14" })
      .reason,
    "unknown-model",
  );
  assert.equal(
    estimateAiAttemptCost(record({ model: "gpt-5.6-terra-2026-11-14" })).reason,
    "unknown-model",
  );
  const totals = aggregateAiUsage([audio], query(), now).totals;
  assert.equal(totals.tokens.inputTokens, null);
  assert.equal(totals.pricedAttempts, 1);
  assert.equal(totals.missingUsageAttempts, 1);
});

test("model/source filters, complete daily population and facets reconcile without leaking metadata", () => {
  const response = {
    ...record(),
    projectId: "PRIVATE_PROJECT",
    userId: "PRIVATE_USER",
    requestId: "PRIVATE_REQUEST",
    prompt: "PRIVATE_PROMPT",
    answer: "PRIVATE_ANSWER",
  };
  const audio = record({
    attemptId: "audio",
    source: "transcription",
    model: "gpt-transcribe",
    audioSeconds: 60,
    usage: missing,
  });
  const unknown = record({ attemptId: "unknown-model", model: null });
  const all = aggregateAiUsage([response, audio, unknown], query(), now);
  assert.equal(all.totals.attempts, 3);
  assert.equal(
    all.days.reduce((sum, day) => sum + day.attempts, 0),
    3,
  );
  assert.equal(
    all.byModel.reduce((sum, model) => sum + model.attempts, 0),
    3,
  );
  assert.equal(
    all.bySource.reduce((sum, source) => sum + source.attempts, 0),
    3,
  );
  assert.equal(all.byModel.at(-1)?.model, null);
  assert.equal(all.totals.unpricedAttempts, 1);
  const filtered = aggregateAiUsage(
    [response, audio, unknown],
    query({ source: "transcription", model: "gpt-transcribe" }),
    now,
  );
  assert.equal(filtered.totals.attempts, 1);
  assert.deepEqual(filtered.facets.models, ["gpt-5.6-terra", "gpt-transcribe"]);
  assert.deepEqual(filtered.facets.sources, ["responses", "transcription"]);
  assert.equal(/PRIVATE|attempt-1/.test(JSON.stringify(all)), false);
  const stripped = aiUsageRecordSchema.parse(response);
  assert.equal("prompt" in stripped, false);
  assert.equal("requestId" in stripped, false);
  assert.throws(() =>
    aiUsageRecordSchema.parse(record({ startedAt: "not-a-date" })),
  );
  assert.throws(() =>
    aiUsageRecordSchema.parse(record({ model: "sk-private-secret" })),
  );
});
