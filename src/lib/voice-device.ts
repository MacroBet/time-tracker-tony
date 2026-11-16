import {
  checkLocalDictationAvailability,
  LIVE_DICTATION,
  type LocalRecognitionConstructor,
} from "./live-dictation";
export type InstallableLocalRecognition = LocalRecognitionConstructor & {
  install?: (options: {
    langs: string[];
    processLocally: true;
  }) => Promise<boolean>;
};
/** Called exclusively by the explicit download/setup button, never by readiness or recording. */
export async function installLocalVoice(
  Recognition: InstallableLocalRecognition | undefined,
  userInitiated: boolean,
  signal?: AbortSignal,
) {
  if (signal?.aborted) return "cancelled" as const;
  if (userInitiated !== true || typeof Recognition?.install !== "function")
    return "unsupported" as const;
  let stopWaiting: (() => void) | undefined;
  try {
    const operation = Recognition.install({
      langs: [LIVE_DICTATION.language],
      processLocally: true,
    });
    const installed = await Promise.race([
      operation,
      new Promise<"cancelled">((resolve) => {
        stopWaiting = () => resolve("cancelled");
        signal?.addEventListener("abort", stopWaiting, { once: true });
      }),
    ]);
    if (installed === "cancelled" || signal?.aborted)
      return "cancelled" as const;
    return installed
      ? await checkLocalDictationAvailability(Recognition, { signal })
      : ("error" as const);
  } catch {
    return "error" as const;
  } finally {
    if (stopWaiting) signal?.removeEventListener("abort", stopWaiting);
  }
}
