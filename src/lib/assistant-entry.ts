export const ASSISTANT_OPEN_EVENT = "fieldtrack:open-assistant";
export type AssistantEntryRequest = {
  input: "voice" | "text";
  projectId: string;
  sourceView: boolean;
};
