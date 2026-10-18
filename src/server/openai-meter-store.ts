/** Node-only local spool. No network or remote database access. */
import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  lstatSync,
  realpathSync,
  openSync,
  writeFileSync,
  fsyncSync,
  closeSync,
  linkSync,
  renameSync,
  existsSync,
  unlinkSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  safeMeterReference,
  type AttemptObservation,
} from "../lib/openai-metering";
const ref = z.string().refine((v) => safeMeterReference(v) !== null);
const token = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .nullable();
const stamp = z.iso.datetime();
const eventSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.uuid(),
  provider: z.literal("openai"),
  requestId: z.uuid(),
  attemptId: z.uuid(),
  projectId: ref.nullable(),
  jobId: ref.nullable(),
  model: ref.nullable(),
  status: z.enum(["success", "failure", "cancel", "timeout"]),
  startedAt: stamp,
  endedAt: stamp,
  observedAt: stamp,
  source: z.literal("fieldtrack-copilot-responses"),
  usage: z.object({
    inputTokens: token,
    cachedInputTokens: token,
    cacheWriteInputTokens: token,
    outputTokens: token,
    reasoningOutputTokens: token,
    totalTokens: token,
  }),
  estimate: z.null(),
  billed: z.null(),
});
const schema = z.object({
  event: eventSchema,
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
  usageState: z.enum(["missing", "partial", "complete"]),
  latencyMs: z.number().nonnegative().nullable(),
  providerRequestId: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .nullable(),
  attemptNumber: z.number().int().positive(),
});
function privateDirectory(directory: string) {
  if (
    !path.isAbsolute(directory) ||
    directory.split(path.sep).includes("public")
  )
    throw new Error("Private absolute meter directory required");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = lstatSync(directory);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    stat.mode & 0o077 ||
    realpathSync(directory) !== directory
  )
    throw new Error("Private canonical meter directory required");
}
function readObservation(file: string) {
  const stat = lstatSync(file);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.mode & 0o077 ||
    stat.size > 16000
  )
    throw new Error("Invalid meter file");
  return schema.parse(JSON.parse(readFileSync(file, "utf8")));
}
function projectCollectorSnapshot(directory: string) {
  // Serialize cross-process projection updates so an older snapshot cannot replace a newer one.
  // A stale crash lock requires explicit operator recovery; never steal another writer's lock.
  const lock = path.join(directory, "projection.lock");
  const handle = openSync(lock, "wx", 0o600);
  const temp = path.join(directory, `${randomUUID()}.tmp`);
  try {
    const { events, pendingAttempts } = readOpenAIMeterExport(directory);
    const fd = openSync(temp, "wx", 0o600);
    try {
      writeFileSync(
        fd,
        JSON.stringify({ schemaVersion: 1, events, pendingAttempts }) + "\n",
      );
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temp, path.join(directory, "collector-v1.json"));
    const parent = openSync(directory, "r");
    try {
      fsyncSync(parent);
    } finally {
      closeSync(parent);
    }
  } finally {
    if (existsSync(temp)) unlinkSync(temp);
    closeSync(handle);
    unlinkSync(lock);
  }
}
export function createOpenAIMeterRecorder(directory: string) {
  return (input: AttemptObservation) => {
    // Rebuild via a closed schema; discard all unrecognized fields, including nested payloads.
    const observation = schema.parse({
      ...input,
      providerRequestId:
        input.providerRequestId === null
          ? null
          : `sha256:${createHash("sha256").update(input.providerRequestId).digest("hex")}`,
    });
    privateDirectory(directory);
    const suffix = observation.outcome === "started" ? "pending" : "final";
    const filename = path.join(
      directory,
      `${observation.event.attemptId}.${suffix}.json`,
    );
    const serialized = JSON.stringify(observation);
    const temp = path.join(directory, `${randomUUID()}.tmp`);
    const fd = openSync(temp, "wx", 0o600);
    try {
      writeFileSync(fd, serialized);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    try {
      try {
        linkSync(temp, filename);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (JSON.stringify(readObservation(filename)) !== serialized)
          throw new Error("Meter idempotency conflict");
      }
      const parent = openSync(directory, "r");
      try {
        fsyncSync(parent);
      } finally {
        closeSync(parent);
      }
    } finally {
      unlinkSync(temp);
    }
    // Publish durable intent before transport as well as final state.
    projectCollectorSnapshot(directory);
  };
}
/** Finite export for an explicit collector import; never a watcher or public API. */
export function readOpenAIMeterExport(directory: string) {
  privateDirectory(directory);
  const files = readdirSync(directory).filter((name) =>
    /^[a-f0-9-]{36}\.(pending|final)\.json$/.test(name),
  );
  const observations = files.map((name) =>
    readObservation(path.join(directory, name)),
  );
  const finals = observations.filter((item) => item.outcome !== "started");
  const ids = new Set(finals.map((item) => item.event.attemptId));
  return {
    schemaVersion: 1,
    coverage: "local-fieldtrack-attempts-only",
    events: finals.map((item) => item.event),
    pendingAttempts: observations
      .filter(
        (item) => item.outcome === "started" && !ids.has(item.event.attemptId),
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
