/** Finite local metadata export, with no env loading, network or collector mutation. */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { readOpenAIMeterExport } from "../src/server/openai-meter-store";
const [directory, destination, offsetText = "0"] = process.argv.slice(2);
try {
  const offset = Number(offsetText);
  if (
    !directory ||
    !destination ||
    !path.isAbsolute(directory) ||
    !path.isAbsolute(destination) ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  )
    throw new Error();
  const snapshot = readOpenAIMeterExport(directory);
  const events = snapshot.events
    .sort(
      (a, b) =>
        a.observedAt.localeCompare(b.observedAt) ||
        a.attemptId.localeCompare(b.attemptId),
    )
    .slice(offset, offset + 1000);
  writeFileSync(
    destination,
    JSON.stringify({ schemaVersion: 1, events }) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      exported: events.length,
      pendingAttempts: snapshot.pendingAttempts.length,
      remaining: Math.max(0, snapshot.events.length - offset - events.length),
      coverage: snapshot.coverage,
    }),
  );
} catch {
  console.error(
    "Metadata export failed. Use absolute private directory and new output file paths; optional offset must be a nonnegative integer.",
  );
  process.exitCode = 1;
}
