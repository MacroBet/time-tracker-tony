import "server-only";
import path from "node:path";
import { access, constants, mkdir } from "node:fs/promises";
import { createOpenAIMeterRecorder } from "./openai-meter-store";
import {
  createDatabaseMeterRecorder,
  ensureDatabaseMeterReady,
  type MeterDatabase,
} from "./openai-meter-db";
import { db } from "./db/client";
import type { AttemptObservation } from "../lib/openai-metering";

const execute: MeterDatabase = async (query) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      db().execute(query),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Meter database operation timed out")),
          5000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};
const localDirectory = () =>
  process.env.OPENAI_METER_DIRECTORY ||
  path.resolve(process.cwd(), "output/api-metering-private");

/** Production always requires the existing Neon table; /tmp is never a fallback. */
export async function ensureMeterReady() {
  try {
    if (process.env.NODE_ENV === "production")
      await ensureDatabaseMeterReady(execute);
    else {
      const directory = localDirectory();
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await access(directory, constants.R_OK | constants.W_OK);
    }
  } catch {
    throw new Error(
      "API usage storage is unavailable. Apply the meter migration before enabling AI.",
    );
  }
}

export async function recordOpenAIAttempt(observation: AttemptObservation) {
  if (process.env.NODE_ENV === "production")
    await createDatabaseMeterRecorder(execute)(observation);
  else createOpenAIMeterRecorder(localDirectory())(observation);
}
