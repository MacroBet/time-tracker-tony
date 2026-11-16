"use client";

import { usePathname } from "next/navigation";
import { Keyboard, Mic } from "lucide-react";
import { canUseCopilot } from "@/lib/copilot";
import {
  ASSISTANT_OPEN_EVENT,
  type AssistantEntryRequest,
} from "@/lib/assistant-entry";
import { useApp } from "../contexts/AppContext";

/** Voice opens the contextual setup/capture flow from this explicit user action; keyboard stays silent. */
export function AssistantEntry() {
  const { currentUser, selectedProjectId } = useApp();
  const pathname = usePathname();
  if (!selectedProjectId || !canUseCopilot(currentUser)) return null;
  const open = (input: AssistantEntryRequest["input"]) =>
    window.dispatchEvent(
      new CustomEvent<AssistantEntryRequest>(ASSISTANT_OPEN_EVENT, {
        detail: {
          input,
          projectId: selectedProjectId,
          sourceView: pathname === "/schedule",
        },
      }),
    );
  const style =
    "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-2.5 text-blue-800 hover:bg-blue-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700";
  return (
    <nav
      aria-label="Project assistant"
      className="flex shrink-0 overflow-hidden rounded-lg border border-blue-200 bg-blue-50"
    >
      <button
        type="button"
        onClick={() => open("voice")}
        aria-label="Ask by voice in this page"
        className={style}
      >
        <Mic className="size-4" aria-hidden="true" />
        <span className="text-xs font-semibold">AI</span>
      </button>
      <button
        type="button"
        onClick={() => open("text")}
        aria-label="Ask with keyboard in this page"
        className={`${style} border-l border-blue-200`}
      >
        <Keyboard className="size-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
