/** Browser on-device recognition only. This module never installs packs or opens a cloud transport. */
export const LIVE_DICTATION = {
  language: "en-GB",
  maxCharacters: 4000,
  maxMs: 30000,
  availabilityMs: 3000,
  permissionMs: 10000,
  finalMs: 3000,
} as const;
export type LocalRecognitionResult = {
  isFinal: boolean;
  [index: number]: { transcript: string };
};
export type LocalRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<LocalRecognitionResult>;
};
export type LocalRecognition = {
  processLocally: boolean;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: LocalRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
export type LocalRecognitionConstructor = {
  new (): LocalRecognition;
  prototype: { processLocally?: boolean };
  available?: (options: {
    langs: string[];
    processLocally: true;
  }) => Promise<string>;
};
export type LocalAvailability =
  | "available"
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "unsupported"
  | "timeout"
  | "error"
  | "cancelled";
/** Readiness query only: never constructs/starts recognition, installs a pack or falls back to remote. */
export async function checkLocalDictationAvailability(
  Recognition: LocalRecognitionConstructor | undefined,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<LocalAvailability> {
  if (
    !Recognition ||
    typeof Recognition.available !== "function" ||
    !Recognition.prototype ||
    !("processLocally" in Recognition.prototype)
  )
    return "unsupported";
  return new Promise((resolve) => {
    let ended = false;
    const finish = (status: LocalAvailability) => {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
      resolve(status);
    };
    const cancel = () => finish("cancelled");
    const timer = setTimeout(
      () => finish("timeout"),
      options.timeoutMs ?? LIVE_DICTATION.availabilityMs,
    );
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (options.signal?.aborted) {
      cancel();
      return;
    }
    Promise.resolve()
      .then(() =>
        ended
          ? "cancelled"
          : Recognition.available!({
              langs: [LIVE_DICTATION.language],
              processLocally: true,
            }),
      )
      .then(
        (status) =>
          finish(
            [
              "available",
              "unavailable",
              "downloadable",
              "downloading",
            ].includes(status)
              ? (status as LocalAvailability)
              : "error",
          ),
        () => finish("error"),
      );
  });
}

export type LocalFinalPhrase = {
  index: number;
  text: string;
  before: string;
  hasInterim: boolean;
  now: number;
};
export type LocalPhraseControl =
  "finish" | "accept-and-finish" | "replace" | "omit" | undefined;
export type LocalDictationState =
  "idle" | "checking" | "permission" | "recording" | "finalizing";

/** Results are snapshots, not deltas: interim revisions replace the same index and finals never regress. */
export function localTranscriptAssembler(
  maxCharacters = LIVE_DICTATION.maxCharacters,
) {
  const finals = new Map<number, string>();
  let interim = new Map<number, string>();
  return {
    apply(event: LocalRecognitionEvent) {
      if (
        !Number.isInteger(event.results.length) ||
        event.results.length < 0 ||
        event.results.length > 1000
      )
        throw Error(
          "The live transcript exceeded the supported limit. Type your question instead.",
        );
      interim = new Map();
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i],
          text = result?.[0]?.transcript;
        if (typeof text !== "string")
          throw Error(
            "No usable live transcript. Type your question or record again.",
          );
        if (finals.has(i)) continue;
        if (result.isFinal) finals.set(i, text.trim());
        else interim.set(i, text.trim());
      }
      const ordered = (items: Map<number, string>) =>
        [...items]
          .sort((a, b) => a[0] - b[0])
          .map(([, text]) => text)
          .filter(Boolean)
          .join(" ");
      const text = ordered(new Map([...finals, ...interim]));
      if (text.length > maxCharacters)
        throw Error(
          "The live transcript exceeded 4,000 characters. Use a shorter question.",
        );
      return {
        text,
        finalText: ordered(finals),
        pending: [...interim.values()].some(Boolean),
      };
    },
  };
}

export function createLocalDictation(
  Recognition: LocalRecognitionConstructor | undefined,
  callbacks: {
    onState: (state: LocalDictationState) => void;
    onPartial: (text: string) => void;
    onTranscript: (text: string) => void;
    onFinalPhrase?: (phrase: LocalFinalPhrase) => LocalPhraseControl;
    onCaptureChange: (active: boolean) => void;
    onError: (message: string) => void;
  },
  limits: {
    availabilityMs?: number;
    permissionMs?: number;
    finalMs?: number;
    maxMs?: number;
  } = {},
) {
  let generation = 0,
    recognition: LocalRecognition | undefined;
  let finishAvailability: (() => void) | undefined;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let state: LocalDictationState = "idle";
  const update = (next: LocalDictationState) => {
    state = next;
    callbacks.onState(next);
  };
  const later = (work: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      work();
    }, ms);
    timers.add(timer);
    return timer;
  };
  const cleanup = () => {
    finishAvailability?.();
    finishAvailability = undefined;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    const previous = recognition;
    recognition = undefined;
    if (previous) {
      previous.onstart = null;
      previous.onresult = null;
      previous.onerror = null;
      previous.onend = null;
    }
    return previous;
  };
  const settle = (text?: string, error?: string) => {
    generation++;
    const previous = cleanup();
    try {
      previous?.abort();
    } catch {
      /* Already stopped. */
    }
    update("idle");
    callbacks.onPartial("");
    callbacks.onCaptureChange(false);
    if (error) callbacks.onError(error);
    else if (text) callbacks.onTranscript(text);
  };
  const stop = () => {
    if (!recognition || state === "finalizing") return;
    const token = generation;
    update("finalizing");
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    later(() => {
      if (token === generation)
        settle(
          undefined,
          "The live transcript did not finish. Type your question or record again.",
        );
    }, limits.finalMs ?? LIVE_DICTATION.finalMs);
    try {
      recognition.stop();
    } catch {
      settle(
        undefined,
        "Live dictation could not stop cleanly. Type your question or record again.",
      );
    }
  };
  return {
    async start() {
      if (state !== "idle") return;
      const token = ++generation;
      callbacks.onCaptureChange(true);
      callbacks.onPartial("");
      update("checking");
      try {
        const availability = new AbortController();
        finishAvailability = () => availability.abort();
        const status = await checkLocalDictationAvailability(Recognition, {
          signal: availability.signal,
          timeoutMs: limits.availabilityMs,
        });
        finishAvailability = undefined;
        if (token !== generation) return;
        if (status !== "available") {
          settle(
            undefined,
            status === "timeout"
              ? "The on-device availability check timed out. Type your question or choose audio after stop."
              : "On-device English (UK) dictation is not ready here. No language pack was downloaded. Type your question or choose audio after stop.",
          );
          return;
        }
        recognition = new Recognition!();
        recognition.processLocally = true;
        if (recognition.processLocally !== true)
          throw Error("local-only-unavailable");
        recognition.lang = LIVE_DICTATION.language;
        recognition.continuous = true;
        recognition.interimResults = true;
        let assembler = localTranscriptAssembler();
        const seen = new Set<number>(),
          omitted = new Set<number>(),
          accepted = new Map<number, string>();
        let excludedThrough = -1;
        let snapshot = { text: "", finalText: "", pending: false };
        recognition.onstart = () => {
          if (
            token !== generation ||
            state === "finalizing" ||
            state === "recording"
          )
            return;
          for (const timer of timers) clearTimeout(timer);
          timers.clear();
          update("recording");
          later(() => {
            if (token === generation) stop();
          }, limits.maxMs ?? LIVE_DICTATION.maxMs);
        };
        recognition.onresult = (event) => {
          if (token !== generation) return;
          try {
            let finishRequested = false;
            for (let i = 0; i < event.results.length; i++) {
              const result = event.results[i];
              if (i <= excludedThrough || !result?.isFinal || seen.has(i))
                continue;
              seen.add(i);
              const text = result[0]?.transcript;
              if (typeof text !== "string") continue;
              const before = [...accepted]
                .sort((a, b) => a[0] - b[0])
                .map(([, value]) => value)
                .join(" ");
              const hasInterim = Array.from(
                { length: event.results.length },
                (_, j) => event.results[j],
              ).some((row) => !row.isFinal && row[0]?.transcript.trim());
              const control = callbacks.onFinalPhrase?.({
                index: i,
                text,
                before,
                hasInterim,
                now: Date.now(),
              });
              if (control === "replace") {
                excludedThrough = i;
                accepted.clear();
                assembler = localTranscriptAssembler();
              } else if (control === "finish" || control === "omit") {
                omitted.add(i);
                if (control === "finish") finishRequested = true;
              } else {
                accepted.set(i, text.trim());
                if (control === "accept-and-finish") finishRequested = true;
              }
            }
            const results = Array.from(
              { length: event.results.length },
              (_, i) => ({ i, row: event.results[i] }),
            )
              .filter(({ i }) => i > excludedThrough && !omitted.has(i))
              .map(({ row }) => row);
            snapshot = assembler.apply({ resultIndex: 0, results });
            callbacks.onPartial(snapshot.text);
            if (finishRequested) stop();
          } catch (error) {
            settle(
              undefined,
              error instanceof Error
                ? error.message
                : "The live transcript could not be read.",
            );
          }
        };
        recognition.onerror = (event) => {
          if (token !== generation) return;
          settle(
            undefined,
            ["not-allowed", "service-not-allowed"].includes(event.error)
              ? "Microphone access was not allowed. You can still type your question."
              : event.error === "language-not-supported"
                ? "On-device English (UK) is unavailable. No download or cloud fallback was started."
                : "Live dictation stopped before a complete transcript was ready. Type your question or record again.",
          );
        };
        recognition.onend = () => {
          if (token !== generation) return;
          if (snapshot.pending)
            settle(
              undefined,
              "The final live transcript was incomplete. Type your question or record again.",
            );
          else if (!snapshot.finalText.trim())
            settle(
              undefined,
              "No final speech was recognized. Type your question or record again.",
            );
          else settle(snapshot.finalText);
        };
        update("permission");
        later(() => {
          if (token === generation)
            settle(
              undefined,
              "Microphone access did not start. Check browser permission or type your question.",
            );
        }, limits.permissionMs ?? LIVE_DICTATION.permissionMs);
        recognition.start();
      } catch {
        if (token === generation)
          settle(
            undefined,
            "On-device live dictation is unavailable. No cloud fallback was started. Type your question or choose audio after stop.",
          );
      }
    },
    stop,
    cancel() {
      settle();
    },
  };
}
