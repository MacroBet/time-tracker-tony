import "server-only";
import { requireUser } from "./auth";
import { loadData } from "./repository";
import { requireCondition, HttpError } from "./errors";
import { json, readBody } from "./http";
import { canUseCopilot } from "@/lib/copilot";
import {
  COPILOT_AUDIO,
  transcribeCopilotWav,
  validateCopilotWav,
} from "@/lib/copilot-audio";
import { getCopilotConfig, getCopilotRuntimeStatus } from "./copilot-config";
import { recordOpenAIAttempt } from "./openai-metering";

export async function transcribeCopilot(request: Request, projectId: string) {
  const user = await requireUser();
  requireCondition(
    canUseCopilot(user),
    403,
    "Copilot requires task and commissioning management access.",
  );
  const data = await loadData(user);
  requireCondition(
    data.projects.some((project) => project.id === projectId),
    404,
    "Project not found.",
  );
  requireCondition(
    (await getCopilotRuntimeStatus()).state === "ready",
    503,
    "AI voice is not configured or enabled. You can still type your question.",
  );
  requireCondition(
    request.headers.get("content-type")?.split(";")[0] === "audio/wav",
    415,
    "Record a WAV voice query.",
  );
  const audio = await readBody(request, COPILOT_AUDIO.maxBytes);
  try {
    validateCopilotWav(audio);
  } catch (error) {
    throw new HttpError(400, (error as Error).message);
  }
  try {
    const text = await transcribeCopilotWav(audio, {
      apiKey: getCopilotConfig().apiKey!,
      projectId,
      recordAttempt: recordOpenAIAttempt,
    });
    return json({ text, requiresReview: true });
  } catch (error) {
    throw new HttpError(
      503,
      error instanceof Error
        ? error.message
        : "Voice transcription is unavailable.",
    );
  }
}
