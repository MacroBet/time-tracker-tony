import "server-only";
import path from "node:path";
import { createOpenAIMeterRecorder } from "./openai-meter-store";
import type { AttemptObservation } from "../lib/openai-metering";

export function recordOpenAIAttempt(observation: AttemptObservation) {
  // Cloud persistence must be explicitly provisioned; never claim ephemeral /tmp is durable.
  const directory =
    process.env.OPENAI_METER_DIRECTORY ||
    (process.env.NODE_ENV !== "production"
      ? path.resolve(process.cwd(), "output/api-metering-private")
      : null);
  if (!directory)
    throw new Error("Durable API meter storage is not configured");
  createOpenAIMeterRecorder(directory)(observation);
}
