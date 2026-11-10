import "server-only";
import { recordOpenAIAttempt, ensureMeterReady } from "./openai-metering";
import { copilotStatus, type CopilotConfig } from "@/lib/copilot-provider";

/** Read only the explicitly provisioned server environment; never reuse Codex credentials. */
export function getCopilotConfig(): CopilotConfig {
  return {
    apiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
    model: process.env.OPENAI_MODEL?.trim() || "gpt-5.6-terra",
    enabled: process.env.COPILOT_ENABLED === "true",
    recordAttempt: recordOpenAIAttempt,
  };
}

/** Safe public metadata. Never spread or return the provider configuration. */
export function getCopilotStatus() {
  return copilotStatus(getCopilotConfig());
}

/** Readiness is established from storage, never inferred from DATABASE_URL. */
export async function getCopilotRuntimeStatus() {
  const status = getCopilotStatus();
  if (status.state !== "ready") return status;
  try {
    await ensureMeterReady();
    return status;
  } catch {
    return {
      ...status,
      state: "not_configured" as const,
      configured: false,
      missing: [...status.missing, "API_USAGE_STORAGE"],
    };
  }
}
