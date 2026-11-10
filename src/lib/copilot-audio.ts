import {
  responseMeterMetadata,
  awaitMeterRecording,
  type AttemptObservation,
  type MeterRecorder,
} from "./openai-metering";

export const COPILOT_AUDIO = {
  sampleRate: 16000,
  seconds: 30,
  maxBytes: 960044,
  maxResponseBytes: 32000,
  maxText: 4000,
  timeoutMs: 20000,
  model: "gpt-transcribe",
} as const;

/** Narrow PCM format produced by our recorder: duration comes from bytes, not client claims. */
export function validateCopilotWav(buffer: Uint8Array) {
  if (buffer.byteLength < 46 || buffer.byteLength > COPILOT_AUDIO.maxBytes)
    throw new Error("Record between a moment and 30 seconds of audio.");
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  const marker = (at: number, value: string) =>
    [...value].every((c, i) => view.getUint8(at + i) === c.charCodeAt(0));
  if (
    !marker(0, "RIFF") ||
    !marker(8, "WAVE") ||
    !marker(12, "fmt ") ||
    !marker(36, "data") ||
    view.getUint32(4, true) !== buffer.byteLength - 8 ||
    view.getUint32(16, true) !== 16 ||
    view.getUint16(20, true) !== 1 ||
    view.getUint16(22, true) !== 1 ||
    view.getUint32(24, true) !== COPILOT_AUDIO.sampleRate ||
    view.getUint32(28, true) !== COPILOT_AUDIO.sampleRate * 2 ||
    view.getUint16(32, true) !== 2 ||
    view.getUint16(34, true) !== 16 ||
    view.getUint32(40, true) !== buffer.byteLength - 44 ||
    (buffer.byteLength - 44) % 2
  )
    throw new Error("Unsupported audio. Record a new voice query.");
  return (buffer.byteLength - 44) / 2 / COPILOT_AUDIO.sampleRate;
}

export function encodeCopilotWav(chunks: Float32Array[], sampleRate: number) {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000)
    throw new Error("This browser cannot record audio at a supported rate.");
  const length = Math.min(
    chunks.reduce((n, chunk) => n + chunk.length, 0),
    Math.floor(sampleRate * COPILOT_AUDIO.seconds),
  );
  const all = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk.subarray(0, Math.max(0, length - offset)), offset);
    offset += Math.min(chunk.length, length - offset);
    if (offset >= length) break;
  }
  const samples = Math.floor((length * COPILOT_AUDIO.sampleRate) / sampleRate);
  const bytes = new Uint8Array(44 + samples * 2),
    view = new DataView(bytes.buffer);
  const marker = (at: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  marker(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  marker(8, "WAVE");
  marker(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, COPILOT_AUDIO.sampleRate, true);
  view.setUint32(28, COPILOT_AUDIO.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  marker(36, "data");
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    const sample = Math.max(
      -1,
      Math.min(
        1,
        all[Math.floor((i * sampleRate) / COPILOT_AUDIO.sampleRate)] ?? 0,
      ),
    );
    view.setInt16(
      44 + i * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    );
  }
  return bytes;
}

/** No audio/text is logged or retained. A meter intent must succeed before the paid call. */
export async function transcribeCopilotWav(
  audio: Uint8Array,
  config: {
    apiKey: string;
    projectId: string;
    recordAttempt: MeterRecorder;
    timeoutMs?: number;
    meterTimeoutMs?: number;
  },
  transport: typeof fetch = fetch,
) {
  validateCopilotWav(audio);
  const started = Date.now(),
    attemptId = crypto.randomUUID(),
    stamp = new Date(started).toISOString();
  const observation: AttemptObservation = {
    event: {
      schemaVersion: 1,
      eventId: attemptId,
      provider: "openai",
      requestId: crypto.randomUUID(),
      attemptId,
      projectId: config.projectId,
      jobId: null,
      model: COPILOT_AUDIO.model,
      status: "failure",
      startedAt: stamp,
      endedAt: stamp,
      observedAt: stamp,
      source: "fieldtrack-copilot-transcription",
      usage: responseMeterMetadata(null).usage,
      estimate: null,
      billed: null,
    },
    outcome: "started",
    usageState: "missing",
    latencyMs: null,
    providerRequestId: null,
    attemptNumber: 1,
  };
  const save = async () => {
    try {
      await awaitMeterRecording(
        config.recordAttempt,
        observation,
        config.meterTimeoutMs,
      );
    } catch {
      throw new Error("API usage recording is unavailable.");
    }
  };
  await save();
  const controller = new AbortController();
  const duration = Math.min(
    COPILOT_AUDIO.timeoutMs,
    Math.max(1, config.timeoutMs ?? COPILOT_AUDIO.timeoutMs),
  );
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Voice transcription timed out. Please try again."));
    }, duration);
  });
  try {
    const work = async () => {
      const form = new FormData();
      form.set("model", COPILOT_AUDIO.model);
      form.set(
        "file",
        new Blob([audio as Uint8Array<ArrayBuffer>], { type: "audio/wav" }),
        "voice-query.wav",
      );
      const response = await transport(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${config.apiKey}` },
          body: form,
          signal: controller.signal,
          redirect: "error",
        },
      );
      observation.providerRequestId = response.headers.get("x-request-id");
      if (!response.ok) {
        observation.outcome = "http_error";
        void response.body?.cancel().catch(() => {});
        throw new Error(
          "Voice transcription is unavailable. You can still type your question.",
        );
      }
      const reader = response.body?.getReader();
      if (!reader)
        throw new Error("The voice service returned an empty response.");
      const cancel = () => {
        void reader.cancel().catch(() => {});
      };
      controller.signal.addEventListener("abort", cancel, { once: true });
      let bytes = 0,
        text = "";
      const decoder = new TextDecoder();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.length;
          if (bytes > COPILOT_AUDIO.maxResponseBytes)
            throw new Error("Voice transcript exceeded the limit.");
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        controller.signal.removeEventListener("abort", cancel);
        cancel();
        reader.releaseLock();
      }
      let result: { text?: unknown };
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("The voice service returned an unreadable response.");
      }
      const metadata = responseMeterMetadata(result);
      observation.event.usage = metadata.usage;
      observation.usageState = metadata.usageState;
      if (
        typeof result?.text !== "string" ||
        !result.text.trim() ||
        result.text.length > COPILOT_AUDIO.maxText
      ) {
        observation.outcome = "invalid_response";
        throw new Error(
          "No usable transcript. Record again or type your question.",
        );
      }
      return result.text.trim();
    };
    const transcript = await Promise.race([work(), deadline]);
    observation.event.status = "success";
    observation.outcome = "completed";
    return transcript;
  } catch (error) {
    if (controller.signal.aborted) {
      observation.event.status = "timeout";
      observation.outcome = "timeout";
    } else if (observation.outcome === "started")
      observation.outcome = "transport_error";
    // Provider bodies and transport messages may contain sensitive content; never forward them.
    if (
      error instanceof Error &&
      /^(Voice |The voice |No usable |API usage)/.test(error.message)
    )
      throw error;
    throw new Error(
      "Voice transcription is unavailable. You can still type your question.",
    );
  } finally {
    clearTimeout(timer!);
    controller.abort();
    observation.latencyMs = Math.max(0, Date.now() - started);
    observation.event.endedAt = new Date().toISOString();
    observation.event.observedAt = observation.event.endedAt;
    await save();
  }
}
