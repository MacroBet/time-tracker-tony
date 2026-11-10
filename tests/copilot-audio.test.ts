import test from "node:test";
import assert from "node:assert/strict";
import {
  COPILOT_AUDIO,
  encodeCopilotWav,
  validateCopilotWav,
  transcribeCopilotWav,
} from "../src/lib/copilot-audio";
import type { AttemptObservation } from "../src/lib/openai-metering";
const wave = () => encodeCopilotWav([new Float32Array(1600)], 16000);

test("voice PCM duration is derived from actual bounded bytes and headers", () => {
  assert.equal(validateCopilotWav(wave()), 0.1);
  assert.equal(
    validateCopilotWav(encodeCopilotWav([new Float32Array(48000)], 48000)),
    1,
  );
  const long = encodeCopilotWav([new Float32Array(16000 * 40)], 16000);
  assert.equal(validateCopilotWav(long), 30);
  assert.equal(long.byteLength, COPILOT_AUDIO.maxBytes);
  const corrupt = wave();
  new DataView(corrupt.buffer).setUint32(40, 1, true);
  assert.throws(() => validateCopilotWav(corrupt), /Unsupported/);
  assert.throws(
    () => validateCopilotWav(new Uint8Array(COPILOT_AUDIO.maxBytes + 1)),
    /30 seconds/,
  );
});

test("transcription records metadata only and never submits query automatically", async () => {
  const observations: AttemptObservation[] = [];
  const text = await transcribeCopilotWav(
    wave(),
    {
      apiKey: "synthetic-key",
      projectId: "project-a",
      recordAttempt: (v) => observations.push(v),
    },
    async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/audio/transcriptions");
      assert.equal((init?.body as FormData).get("model"), "gpt-transcribe");
      assert.ok((init?.body as FormData).get("file") instanceof Blob);
      return Response.json({
        text: "list all chillers",
        usage: { input_tokens: 5, output_tokens: 4 },
      });
    },
  );
  assert.equal(text, "list all chillers");
  assert.equal(observations.length, 2);
  assert.equal(observations[0].outcome, "started");
  assert.equal(observations[1].outcome, "completed");
  assert.equal(
    observations[1].event.source,
    "fieldtrack-copilot-transcription",
  );
  assert.equal(observations[1].event.usage.totalTokens, 9);
  assert.ok(!JSON.stringify(observations).includes(text));
  assert.ok(!JSON.stringify(observations).includes("synthetic-key"));
});

test("failed meter prevents any paid call; oversized and provider failures are bounded/redacted", async () => {
  let calls = 0;
  await assert.rejects(
    transcribeCopilotWav(
      wave(),
      {
        apiKey: "synthetic",
        projectId: "p",
        recordAttempt() {
          throw new Error("disk");
        },
      },
      async () => {
        calls++;
        return Response.json({});
      },
    ),
    /usage recording/,
  );
  assert.equal(calls, 0);
  const observations: AttemptObservation[] = [];
  await assert.rejects(
    transcribeCopilotWav(
      wave(),
      {
        apiKey: "synthetic",
        projectId: "p",
        recordAttempt: (v) => observations.push(v),
      },
      async () => new Response("private provider error", { status: 401 }),
    ),
    /unavailable/,
  );
  assert.equal(observations.at(-1)?.outcome, "http_error");
  await assert.rejects(
    transcribeCopilotWav(
      wave(),
      { apiKey: "synthetic", projectId: "p", recordAttempt() {} },
      async () => Response.json({ text: "x".repeat(5000) }),
    ),
    /No usable transcript/,
  );
});

test("timeout releases a hanging provider response and records timeout once", async () => {
  const observations: AttemptObservation[] = [];
  await assert.rejects(
    transcribeCopilotWav(
      wave(),
      {
        apiKey: "synthetic",
        projectId: "p",
        timeoutMs: 10,
        recordAttempt: (v) => observations.push(v),
      },
      async () => new Promise<Response>(() => {}),
    ),
    /timed out/,
  );
  assert.equal(observations.at(-1)?.event.status, "timeout");
  assert.equal(observations.length, 2);
});
