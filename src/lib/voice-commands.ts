/** Exact standalone utterances only. Embedded words, quoted commands and mutation confirmations are text. */
export function parseVoiceQuestionCommand(
  text: string,
): "send" | "edit" | null {
  const value = text
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "")
    .trim();
  return value === "send" || value === "send question"
    ? "send"
    : value === "edit" || value === "edit question"
      ? "edit"
      : null;
}
export const VOICE_REVIEW_PAUSE_MS = 1200;
export type VoiceFinalPhrase = {
  index: number;
  text: string;
  before: string;
  hasInterim: boolean;
  now: number;
};
export function voiceSetupKey(userId: string) {
  return `fieldtrack:voice-setup:v1:${encodeURIComponent(userId)}`;
}
const compose = (base: string, text: string, replace: boolean) =>
  (replace
    ? text
    : [base.trim(), text.trim()].filter(Boolean).join(" ")
  ).trim();
/** One capture owns its visible base draft and can submit at most once. No mutation-confirmation action exists. */
export function createVoiceQuestionSession(
  baseDraft: string,
  replaceInitially = false,
  startedAt = Date.now(),
) {
  let replace = replaceInitially,
    stableAt = startedAt,
    question = replaceInitially ? "" : baseDraft.trim(),
    pendingSend: string | null = null,
    consumed = false;
  return {
    phrase(
      event: VoiceFinalPhrase,
      currentDraft: string,
    ): "finish" | "replace" | "omit" | undefined {
      if (consumed || pendingSend) return "omit";
      const command = parseVoiceQuestionCommand(event.text),
        candidate = compose(baseDraft, event.before, replace);
      if (command && candidate) {
        if (
          currentDraft.trim() !== baseDraft.trim() ||
          event.hasInterim ||
          event.now - stableAt < VOICE_REVIEW_PAUSE_MS
        )
          return "omit";
        if (command === "send") {
          pendingSend = candidate;
          return "finish";
        }
        replace = true;
        question = "";
        stableAt = event.now;
        return "replace";
      }
      question = compose(
        baseDraft,
        [event.before, event.text].filter(Boolean).join(" "),
        replace,
      );
      stableAt = event.now;
      return undefined;
    },
    complete(text: string, currentDraft: string) {
      const draft = compose(baseDraft, text, replace),
        send =
          !!pendingSend &&
          !consumed &&
          pendingSend === draft &&
          currentDraft.trim() === baseDraft.trim();
      consumed = true;
      return {
        draft,
        send,
        replaced: replace,
        changedDuringCapture: currentDraft.trim() !== baseDraft.trim(),
      };
    },
    get question() {
      return question;
    },
    get replacing() {
      return replace;
    },
    cancel() {
      consumed = true;
      pendingSend = null;
    },
  };
}
