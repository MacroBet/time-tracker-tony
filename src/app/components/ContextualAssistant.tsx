"use client";
import { useEffect, useRef, useReducer } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { canUseCopilot } from "@/lib/copilot";
import {
  ASSISTANT_OPEN_EVENT,
  type AssistantEntryRequest,
} from "@/lib/assistant-entry";
import { useApp } from "../contexts/AppContext";
import {
  assistantIntentScope,
  initialAssistantIntent,
  reduceAssistantIntent,
} from "@/lib/assistant-intent";
import { Button } from "./ui/button";

const Session = dynamic(
  () => import("./CopilotWorkspace").then((module) => module.CopilotSession),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="p-4 text-sm">
        Opening assistant…
      </p>
    ),
  },
);
export function ContextualAssistant() {
  const { currentUser, selectedProjectId, projects } = useApp();
  const scope = assistantIntentScope(
    currentUser,
    selectedProjectId,
    projects.map((project) => project.id),
  );
  const [intent, dispatchIntent] = useReducer(
    reduceAssistantIntent,
    scope,
    initialAssistantIntent,
  );
  const request = intent.scope === scope ? intent.request : null;
  const voiceIntent = intent.sequence;
  const focus = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const allowed =
    canUseCopilot(currentUser) &&
    projects.some((project) => project.id === request?.projectId);
  const visible =
    !!request && allowed && request.projectId === selectedProjectId;
  function close() {
    dispatchIntent({ type: "close" });
    focus.current?.focus({ preventScroll: true });
  }
  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<AssistantEntryRequest>).detail;
      if (
        !detail ||
        detail.projectId !== selectedProjectId ||
        !canUseCopilot(currentUser)
      )
        return;
      focus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dispatchIntent({ type: "open", scope, request: detail });
    };
    window.addEventListener(ASSISTANT_OPEN_EVENT, open);
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, open);
  }, [currentUser, selectedProjectId, scope]);
  useEffect(() => {
    if (visible) heading.current?.focus({ preventScroll: true });
  }, [visible]);
  if (intent.scope !== scope) {
    dispatchIntent({ type: "scope", scope });
    return null;
  }
  if (!visible || !request) return null;
  const project = projects.find((item) => item.id === request.projectId)!;
  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="context-assistant-title"
      aria-describedby="context-assistant-description"
      className="fixed right-2 top-3 z-40 flex h-[min(46rem,calc(100dvh-5rem))] w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-xl sm:right-4 sm:top-20 sm:h-[min(46rem,calc(100dvh-7rem))] sm:w-[min(42rem,calc(100vw-2rem))]"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <h2
            ref={heading}
            tabIndex={-1}
            id="context-assistant-title"
            className="text-sm font-semibold focus:outline-none"
          >
            Project assistant
          </h2>
          <p
            id="context-assistant-description"
            className="truncate text-xs text-slate-600"
          >
            {project.name} ·{" "}
            {request.sourceView ? "Current Schedule view" : "Current project"}
          </p>
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" asChild>
            <Link
              aria-label="Open full assistant"
              href={`/copilot?projectId=${encodeURIComponent(project.id)}${request.sourceView ? "&sourceView=1" : ""}`}
            >
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close assistant"
            onClick={close}
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3">
        <Session
          key={`${project.id}:${currentUser.id}:${currentUser.role}:${JSON.stringify(currentUser.modules ?? null)}`}
          projectId={project.id}
          embedded
          input={request.input}
          voiceIntent={voiceIntent}
          sourceView={request.sourceView}
        />
      </div>
    </section>
  );
}
