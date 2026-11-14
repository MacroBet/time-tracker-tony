import { z } from "zod";
import type {
  ApiMeterEvent,
  AttemptObservation,
  TokenUsage,
} from "./openai-metering";
import { safeMeterReference } from "./openai-metering";

export const MAX_AI_USAGE_DAYS = 366;
export const AI_USAGE_DEFAULT_DAYS = 30;
export const aiUsageSources = ["responses", "transcription"] as const;
export type AiUsageSource = (typeof aiUsageSources)[number];
export type AiUsageTimezone = "Europe/Rome" | "UTC";

const DAY_MS = 86_400_000;
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Use a valid calendar date (YYYY-MM-DD)");
function dateNumber(value: string) {
  return new Date(`${value}T00:00:00.000Z`).getTime();
}
function addDays(value: string, days: number) {
  return new Date(dateNumber(value) + days * DAY_MS).toISOString().slice(0, 10);
}
export const aiUsageQuerySchema = z
  .object({
    from: calendarDate,
    through: calendarDate,
    timezone: z.enum(["Europe/Rome", "UTC"]),
    model: z.string().trim().min(1).max(200).optional(),
    source: z.enum(aiUsageSources).optional(),
  })
  .superRefine((query, context) => {
    const days =
      (dateNumber(query.through) - dateNumber(query.from)) / DAY_MS + 1;
    if (days < 1 || days > MAX_AI_USAGE_DAYS)
      context.addIssue({
        code: "custom",
        path: ["through"],
        message: `Select 1–${MAX_AI_USAGE_DAYS} calendar days, inclusive`,
      });
  });
export type AiUsageQuery = z.infer<typeof aiUsageQuerySchema>;

function dateFormatter(timezone: AiUsageTimezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
function formattedDate(
  timestamp: string | Date,
  formatter: Intl.DateTimeFormat,
) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Invalid AI usage timestamp");
  const parts = formatter.formatToParts(date);
  const part = (name: string) =>
    parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}
export function aiUsageDate(
  timestamp: string | Date,
  timezone: AiUsageTimezone,
) {
  return formattedDate(timestamp, dateFormatter(timezone));
}

/** Calendar dates are resolved once, so a copied URL describes the same period. */
export function parseAiUsageQuery(
  raw: unknown,
  now = new Date(),
): AiUsageQuery {
  const input = raw instanceof URLSearchParams ? Object.fromEntries(raw) : raw;
  const defaults = z
    .object({
      from: calendarDate.optional(),
      through: calendarDate.optional(),
      timezone: z.enum(["Europe/Rome", "UTC"]).default("Europe/Rome"),
      model: z.preprocess(
        (value) => (value === "" ? undefined : value),
        z.string().trim().min(1).max(200).optional(),
      ),
      source: z.preprocess(
        (value) => (value === "" ? undefined : value),
        z.enum(aiUsageSources).optional(),
      ),
    })
    .parse(input ?? {});
  const through = defaults.through ?? aiUsageDate(now, defaults.timezone);
  return aiUsageQuerySchema.parse({
    ...defaults,
    through,
    from: defaults.from ?? addDays(through, 1 - AI_USAGE_DEFAULT_DAYS),
  });
}

const token = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .nullable();
const tokenUsageSchema = z.object({
  inputTokens: token,
  cachedInputTokens: token,
  cacheWriteInputTokens: token,
  outputTokens: token,
  reasoningOutputTokens: token,
  totalTokens: token,
});
/** Internal identifiers are used only for deduplication and never reach the result DTO. */
export const aiUsageRecordSchema = z.object({
  attemptId: z.string().min(1).max(200),
  phase: z.enum(["pending", "final"]),
  model: z
    .string()
    .min(1)
    .max(200)
    .refine(
      (value) => safeMeterReference(value) === value,
      "Invalid model metadata",
    )
    .nullable(),
  source: z.enum(aiUsageSources),
  status: z.enum(["success", "failure", "cancel", "timeout"]),
  outcome: z.enum([
    "started",
    "completed",
    "incomplete",
    "http_error",
    "transport_error",
    "body_interrupted",
    "invalid_response",
    "cancel",
    "timeout",
  ]),
  startedAt: z.iso.datetime({ offset: true }),
  usageState: z.enum(["missing", "partial", "complete"]),
  usage: tokenUsageSchema,
  audioSeconds: z.number().finite().nonnegative().nullable().optional(),
});
export type AiUsageRecord = {
  attemptId: string;
  phase: "pending" | "final";
  model: string | null;
  source: AiUsageSource;
  status: ApiMeterEvent["status"];
  outcome: AttemptObservation["outcome"];
  startedAt: string;
  usageState: AttemptObservation["usageState"];
  usage: TokenUsage;
  audioSeconds?: number | null;
};

/** Public standard rates, not account billing. Exact model names only; no inferred aliases. */
export const AI_USAGE_PRICING = {
  asOf: "2026-11-14",
  currency: "USD",
  basis: "public-standard-rate-estimate",
  cacheWriteLifetime: "30m-default",
  rates: {
    "gpt-5.6-terra": {
      inputPerMillion: 2,
      cachedInputPerMillion: 0.2,
      cacheWriteInputPerMillion: 2.5,
      outputPerMillion: 12,
      longInputThreshold: 272000,
      longInputMultiplier: 2,
      longOutputMultiplier: 1.5,
    },
    "gpt-transcribe": { audioPerMinute: 0.0045 },
  },
  sources: [
    "https://developers.openai.com/api/docs/models/gpt-5.6-terra",
    "https://developers.openai.com/api/docs/models/gpt-transcribe",
    "https://developers.openai.com/api/docs/guides/prompt-caching",
  ],
  note: "Estimates use public standard USD rates, with default 30-minute cache writes. They exclude account discounts, taxes, other services and unrecorded usage. They are not billed costs.",
} as const;

const tokenFields = [
  "inputTokens",
  "cachedInputTokens",
  "cacheWriteInputTokens",
  "outputTokens",
  "reasoningOutputTokens",
  "totalTokens",
] as const;
export type AiUsageTokenCounts = Record<keyof TokenUsage, number>;
export type AiUsageTotals = {
  attempts: number;
  completedAttempts: number;
  failedAttempts: number;
  pendingAttempts: number;
  incompleteAttempts: number;
  completeUsageAttempts: number;
  partialUsageAttempts: number;
  missingUsageAttempts: number;
  invalidUsageAttempts: number;
  /** A field is null if any attempt lacks it. Known subtotals remain separate. */
  tokens: TokenUsage;
  knownTokens: AiUsageTokenCounts;
  unknownTokenAttempts: AiUsageTokenCounts;
  estimatedUsdMin: number | null;
  estimatedUsdMax: number | null;
  pricedAttempts: number;
  unpricedAttempts: number;
  rangedPriceAttempts: number;
  billedUsd: null;
};
export type AiUsageResult = {
  schemaVersion: 1;
  query: AiUsageQuery;
  generatedAt: string;
  scope: "all-fieldtrack-projects";
  coverage: "recorded-fieldtrack-attempts-only";
  totals: AiUsageTotals;
  days: (AiUsageTotals & { date: string })[];
  byModel: (AiUsageTotals & { model: string | null })[];
  bySource: (AiUsageTotals & { source: AiUsageSource })[];
  facets: { models: string[]; sources: AiUsageSource[] };
  pricing: typeof AI_USAGE_PRICING;
};
export type AiAttemptCost = {
  estimatedUsdMin: number | null;
  estimatedUsdMax: number | null;
  reason:
    | "priced"
    | "pending"
    | "unknown-model"
    | "missing-usage"
    | "invalid-usage"
    | "unfinished-audio"
    | "missing-audio-duration";
};

function checkedUsage(raw: TokenUsage) {
  const usage = { ...raw };
  let invalid = false;
  for (const field of tokenFields) {
    const value = usage[field];
    if (value !== null && (!Number.isSafeInteger(value) || value < 0)) {
      usage[field] = null;
      invalid = true;
    }
  }
  const input = usage.inputTokens,
    output = usage.outputTokens;
  const read = usage.cachedInputTokens,
    write = usage.cacheWriteInputTokens;
  if (
    input !== null &&
    ((read !== null && read > input) ||
      (write !== null && write > input) ||
      (read !== null && write !== null && read + write > input))
  ) {
    usage.cachedInputTokens = null;
    usage.cacheWriteInputTokens = null;
    invalid = true;
  }
  if (
    output !== null &&
    usage.reasoningOutputTokens !== null &&
    usage.reasoningOutputTokens > output
  ) {
    usage.reasoningOutputTokens = null;
    invalid = true;
  }
  if (input !== null && output !== null) {
    const total = input + output;
    if (!Number.isSafeInteger(total)) {
      usage.totalTokens = null;
      invalid = true;
    } else {
      if (usage.totalTokens !== null && usage.totalTokens !== total)
        invalid = true;
      usage.totalTokens = total;
    }
  }
  return { usage, invalid };
}

/** Cache and reasoning counts are subsets, never extra input/output tokens. */
export function estimateAiAttemptCost(record: AiUsageRecord): AiAttemptCost {
  const unknown = (reason: AiAttemptCost["reason"]): AiAttemptCost => ({
    estimatedUsdMin: null,
    estimatedUsdMax: null,
    reason,
  });
  if (record.phase === "pending" || record.outcome === "started")
    return unknown("pending");
  if (record.source === "transcription") {
    if (record.model !== "gpt-transcribe") return unknown("unknown-model");
    if (record.outcome !== "completed" || record.status !== "success")
      return unknown("unfinished-audio");
    if (
      record.audioSeconds === null ||
      record.audioSeconds === undefined ||
      !Number.isFinite(record.audioSeconds) ||
      record.audioSeconds < 0
    )
      return unknown("missing-audio-duration");
    const cost =
      (record.audioSeconds / 60) *
      AI_USAGE_PRICING.rates["gpt-transcribe"].audioPerMinute;
    return { estimatedUsdMin: cost, estimatedUsdMax: cost, reason: "priced" };
  }
  if (record.model !== "gpt-5.6-terra") return unknown("unknown-model");
  const { usage, invalid } = checkedUsage(record.usage);
  if (invalid) return unknown("invalid-usage");
  const {
    inputTokens: input,
    outputTokens: output,
    cachedInputTokens: read,
    cacheWriteInputTokens: write,
  } = usage;
  if (input === null || output === null) return unknown("missing-usage");
  const rates = AI_USAGE_PRICING.rates["gpt-5.6-terra"];
  const long = input > rates.longInputThreshold;
  const inputMultiplier = long ? rates.longInputMultiplier : 1;
  const inputRate = rates.inputPerMillion * inputMultiplier;
  const readRate = rates.cachedInputPerMillion * inputMultiplier;
  const writeRate = rates.cacheWriteInputPerMillion * inputMultiplier;
  const outputCost =
    output * rates.outputPerMillion * (long ? rates.longOutputMultiplier : 1);
  const remainder = input - (read ?? 0) - (write ?? 0);
  const fixedCost =
    (read ?? 0) * readRate + (write ?? 0) * writeRate + outputCost;
  // Unknown cache counts describe a range of partitions of the remaining input.
  // If writes alone are absent, the minimum is ordinary input, not a fabricated zero write count.
  const minimumRate = read === null ? readRate : inputRate;
  const maximumRate = write === null ? writeRate : inputRate;
  return {
    estimatedUsdMin: (fixedCost + remainder * minimumRate) / 1_000_000,
    estimatedUsdMax: (fixedCost + remainder * maximumRate) / 1_000_000,
    reason: "priced",
  };
}

function zeroCounts(): AiUsageTokenCounts {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 0,
  };
}
function emptyTotals(): AiUsageTotals {
  return {
    attempts: 0,
    completedAttempts: 0,
    failedAttempts: 0,
    pendingAttempts: 0,
    incompleteAttempts: 0,
    completeUsageAttempts: 0,
    partialUsageAttempts: 0,
    missingUsageAttempts: 0,
    invalidUsageAttempts: 0,
    tokens: zeroCounts(),
    knownTokens: zeroCounts(),
    unknownTokenAttempts: zeroCounts(),
    estimatedUsdMin: 0,
    estimatedUsdMax: 0,
    pricedAttempts: 0,
    unpricedAttempts: 0,
    rangedPriceAttempts: 0,
    billedUsd: null,
  };
}
function addAttempt(totals: AiUsageTotals, record: AiUsageRecord) {
  totals.attempts++;
  if (record.phase === "pending" || record.outcome === "started")
    totals.pendingAttempts++;
  else if (record.outcome === "incomplete") totals.incompleteAttempts++;
  else if (record.status === "success" && record.outcome === "completed")
    totals.completedAttempts++;
  else totals.failedAttempts++;
  const { usage, invalid } = checkedUsage(record.usage);
  if (invalid) totals.invalidUsageAttempts++;
  const known = tokenFields.filter((field) => usage[field] !== null).length;
  if (known === 0) totals.missingUsageAttempts++;
  else if (known === tokenFields.length) totals.completeUsageAttempts++;
  else totals.partialUsageAttempts++;
  for (const field of tokenFields) {
    const value = usage[field];
    if (value === null) totals.unknownTokenAttempts[field]++;
    else {
      const sum = totals.knownTokens[field] + value;
      if (!Number.isSafeInteger(sum))
        throw new Error("AI usage token total exceeds safe numeric bounds");
      totals.knownTokens[field] = sum;
    }
    totals.tokens[field] = totals.unknownTokenAttempts[field]
      ? null
      : totals.knownTokens[field];
  }
  const cost = estimateAiAttemptCost(record);
  if (cost.estimatedUsdMin === null || cost.estimatedUsdMax === null)
    totals.unpricedAttempts++;
  else {
    totals.estimatedUsdMin =
      (totals.estimatedUsdMin ?? 0) + cost.estimatedUsdMin;
    totals.estimatedUsdMax =
      (totals.estimatedUsdMax ?? 0) + cost.estimatedUsdMax;
    totals.pricedAttempts++;
    if (cost.estimatedUsdMin !== cost.estimatedUsdMax)
      totals.rangedPriceAttempts++;
  }
  if (totals.pricedAttempts === 0) {
    totals.estimatedUsdMin = null;
    totals.estimatedUsdMax = null;
  }
}

/** Canonicalize attempts before every filter; retries sharing a request are separate attempts. */
export function aggregateAiUsage(
  records: readonly AiUsageRecord[],
  rawQuery: AiUsageQuery,
  now = new Date(),
): AiUsageResult {
  const query = aiUsageQuerySchema.parse(rawQuery);
  const canonical = new Map<string, AiUsageRecord>();
  for (const raw of records) {
    const record = aiUsageRecordSchema.parse(raw);
    const existing = canonical.get(record.attemptId);
    if (!existing || (existing.phase === "pending" && record.phase === "final"))
      canonical.set(record.attemptId, record);
  }
  const formatter = dateFormatter(query.timezone);
  const dateScoped = [...canonical.values()]
    .map((record) => ({
      record,
      date: formattedDate(record.startedAt, formatter),
    }))
    .filter(({ date }) => date >= query.from && date <= query.through);
  const facets = {
    models: [
      ...new Set(
        dateScoped.flatMap(({ record }) =>
          record.model === null ? [] : [record.model],
        ),
      ),
    ].sort(),
    sources: aiUsageSources.filter((source) =>
      dateScoped.some(({ record }) => record.source === source),
    ),
  };
  const totals = emptyTotals();
  const dayTotals = new Map<string, AiUsageTotals>();
  const dayCount =
    (dateNumber(query.through) - dateNumber(query.from)) / DAY_MS + 1;
  for (let index = 0; index < dayCount; index++)
    dayTotals.set(addDays(query.from, index), emptyTotals());
  const models = new Map<string | null, AiUsageTotals>();
  const sources = new Map<AiUsageSource, AiUsageTotals>();
  for (const { record, date } of dateScoped) {
    if (
      (query.model !== undefined && query.model !== record.model) ||
      (query.source !== undefined && query.source !== record.source)
    )
      continue;
    if (!models.has(record.model)) models.set(record.model, emptyTotals());
    if (!sources.has(record.source)) sources.set(record.source, emptyTotals());
    for (const target of [
      totals,
      dayTotals.get(date)!,
      models.get(record.model)!,
      sources.get(record.source)!,
    ])
      addAttempt(target, record);
  }
  return {
    schemaVersion: 1,
    query,
    generatedAt: now.toISOString(),
    scope: "all-fieldtrack-projects",
    coverage: "recorded-fieldtrack-attempts-only",
    totals,
    days: [...dayTotals].map(([date, totals]) => ({ date, ...totals })),
    byModel: [...models]
      .sort(([a], [b]) =>
        a === null ? 1 : b === null ? -1 : a.localeCompare(b),
      )
      .map(([model, totals]) => ({ model, ...totals })),
    bySource: aiUsageSources
      .filter((source) => sources.has(source))
      .map((source) => ({ source, ...sources.get(source)! })),
    facets,
    pricing: AI_USAGE_PRICING,
  };
}
