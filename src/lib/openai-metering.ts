/** Metadata-only boundary shared by the transport and its server-side recorder. */
export type TokenUsage = {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteInputTokens: number | null;
  outputTokens: number | null;
  reasoningOutputTokens: number | null;
  totalTokens: number | null;
};
export type ApiMeterEvent = {
  schemaVersion: 1;
  eventId: string;
  provider: "openai";
  requestId: string;
  attemptId: string;
  projectId: string | null;
  jobId: string | null;
  model: string | null;
  status: "success" | "failure" | "cancel" | "timeout";
  startedAt: string;
  endedAt: string;
  observedAt: string;
  source: "fieldtrack-copilot-responses";
  usage: TokenUsage;
  estimate: null;
  billed: null;
};
export type AttemptObservation = {
  event: ApiMeterEvent;
  outcome:
    | "started"
    | "completed"
    | "incomplete"
    | "http_error"
    | "transport_error"
    | "body_interrupted"
    | "invalid_response"
    | "cancel"
    | "timeout";
  usageState: "missing" | "partial" | "complete";
  latencyMs: number | null;
  providerRequestId: string | null;
  attemptNumber: number;
};
export type MeterRecorder = (observation: AttemptObservation) => void;
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const count = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) >= 0
    ? (value as number)
    : null;
export function safeMeterReference(value: unknown): string | null {
  return typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(value) &&
    !/sk-|bearer|api[_-]?key|secret|password/i.test(value)
    ? value
    : null;
}
export function responseMeterMetadata(value: unknown) {
  const response = object(value),
    raw = object(response.usage);
  const input = object(raw.input_tokens_details),
    output = object(raw.output_tokens_details);
  const usage: TokenUsage = {
    inputTokens: count(raw.input_tokens),
    outputTokens: count(raw.output_tokens),
    cachedInputTokens: count(input.cached_tokens),
    cacheWriteInputTokens: count(input.cache_write_tokens),
    reasoningOutputTokens: count(output.reasoning_tokens),
    totalTokens: count(raw.total_tokens),
  };
  for (const [subset, parent] of [
    ["cachedInputTokens", "inputTokens"],
    ["cacheWriteInputTokens", "inputTokens"],
    ["reasoningOutputTokens", "outputTokens"],
  ] as const) {
    if (
      usage[subset] !== null &&
      usage[parent] !== null &&
      usage[subset]! > usage[parent]!
    )
      usage[subset] = null;
  }
  if (usage.inputTokens !== null && usage.outputTokens !== null)
    usage.totalTokens = count(usage.inputTokens + usage.outputTokens);
  const usageState = Object.values(usage).every((v) => v === null)
    ? "missing"
    : Object.values(usage).every((v) => v !== null)
      ? "complete"
      : "partial";
  return {
    model: safeMeterReference(response.model),
    usage,
    usageState: usageState as AttemptObservation["usageState"],
  };
}
