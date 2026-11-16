import type { AssistantEntryRequest } from "./assistant-entry";
export type AssistantIntentState = {
  scope: string;
  request: AssistantEntryRequest | null;
  sequence: number;
};
export type AssistantIntentAction =
  | { type: "scope"; scope: string }
  | { type: "open"; scope: string; request: AssistantEntryRequest }
  | { type: "close" };
export const initialAssistantIntent = (
  scope: string,
): AssistantIntentState => ({ scope, request: null, sequence: 0 });
/** A context transition consumes the old gesture; returning to an old project cannot resurrect it. */
export function reduceAssistantIntent(
  state: AssistantIntentState,
  action: AssistantIntentAction,
): AssistantIntentState {
  if (action.type === "scope")
    return action.scope === state.scope
      ? state
      : { scope: action.scope, request: null, sequence: state.sequence };
  if (action.type === "close") return { ...state, request: null };
  return action.scope === state.scope
    ? { ...state, request: action.request, sequence: state.sequence + 1 }
    : state;
}
export function assistantIntentScope(
  user: { id: string; role: string; modules?: string[] },
  projectId: string,
  projectIds: string[],
) {
  return JSON.stringify([
    user.id,
    user.role,
    [...(user.modules ?? [])].sort(),
    projectId,
    [...projectIds].sort(),
  ]);
}
