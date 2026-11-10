"use client";

import Link from "next/link";
import { Keyboard, Mic } from "lucide-react";
import { canUseCopilot } from "@/lib/copilot";
import { useApp } from "../contexts/AppContext";

/** Opening the assistant never opens the microphone or sends a question. */
export function AssistantEntry() {
  const { currentUser, selectedProjectId } = useApp();
  if (!selectedProjectId || !canUseCopilot(currentUser)) return null;
  const href = `/copilot?projectId=${encodeURIComponent(selectedProjectId)}`;
  const style =
    "inline-flex min-h-11 items-center justify-center gap-1.5 px-2.5 text-blue-800 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
  return (
    <nav
      aria-label="Project assistant"
      className="flex shrink-0 overflow-hidden rounded-lg border border-blue-200 bg-blue-50"
    >
      <Link
        href={`${href}&input=voice`}
        aria-label="Open AI assistant with voice input"
        className={style}
      >
        <Mic className="size-4" aria-hidden="true" />
        <span className="text-xs font-semibold">AI</span>
      </Link>
      <Link
        href={`${href}&input=text`}
        aria-label="Open AI assistant with keyboard input"
        className={`${style} border-l border-blue-200`}
      >
        <Keyboard className="size-4" aria-hidden="true" />
      </Link>
    </nav>
  );
}
