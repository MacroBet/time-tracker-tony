import "server-only";
import { copilotStatus, type CopilotConfig } from "@/lib/copilot-provider";

/** Read only the explicitly provisioned server environment; never reuse Codex credentials. */
export function getCopilotConfig(): CopilotConfig {
  return {
    apiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
    model: process.env.OPENAI_MODEL?.trim() || undefined,
    enabled: process.env.COPILOT_ENABLED === "true",
  };
}

/** Safe public metadata. Never spread or return the provider configuration. */
export function getCopilotStatus() {
  return copilotStatus(getCopilotConfig());
}
