"use client";
import {
  schedulePanelCommandEvent,
  schedulePanelCommandResultEvent,
  schedulePanelCommandResultSchema,
  schedulePanelCommandSchema,
  scheduleViewCommandEvent,
  scheduleViewCommandResultEvent,
  type SchedulePanel,
  type ScheduleViewSnapshot,
} from "@/lib/schedule-view-context";
import type { AssistantViewIntent } from "@/lib/assistant-view-commands";
import { assertScheduleViewCommands } from "@/lib/source-gantt";

export async function applySchedulePanel(
  panel: SchedulePanel,
  projectId: string,
  projectVersion: number,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const request = schedulePanelCommandSchema.parse({
    panel,
    projectId,
    projectVersion,
    requestId: crypto.randomUUID(),
  });
  await new Promise<void>((resolve, reject) => {
    const close = () => {
      clearTimeout(timeout);
      window.removeEventListener(schedulePanelCommandResultEvent, onResult);
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      close();
      reject(signal.reason);
    };
    const onResult = (event: Event) => {
      const result = schedulePanelCommandResultSchema.safeParse(
        (event as CustomEvent<unknown>).detail,
      );
      if (
        !result.success ||
        result.data.requestId !== request.requestId ||
        result.data.projectId !== projectId ||
        result.data.projectVersion !== projectVersion
      )
        return;
      close();
      if (result.data.ok) resolve();
      else
        reject(
          Error(result.data.error || "The Schedule panel could not open."),
        );
    };
    const timeout = setTimeout(() => {
      close();
      reject(Error("Open the project Schedule and try the command again."));
    }, 1000);
    window.addEventListener(schedulePanelCommandResultEvent, onResult);
    signal.addEventListener("abort", onAbort, { once: true });
    window.dispatchEvent(
      new CustomEvent(schedulePanelCommandEvent, { detail: request }),
    );
  });
  return {
    mode: "view" as const,
    text: `Opened the Schedule ${panel} panel.`,
    sources: [],
    proposals: [],
  };
}

/** An acknowledgement comes from the currently mounted Schedule, never a model claim. */
export async function applyAssistantView(
  intent: AssistantViewIntent,
  snapshot: ScheduleViewSnapshot | undefined,
  projectId: string,
  version: number,
  signal: AbortSignal,
) {
  if (
    !snapshot ||
    snapshot.projectId !== projectId ||
    snapshot.projectVersion !== version
  )
    throw Error(
      "Open the current working Schedule before changing its view. The saved view is missing or out of date.",
    );
  assertScheduleViewCommands(
    intent.commands,
    snapshot.sourceSha256 === "managed" ? "managed" : "source",
  );
  for (const command of intent.commands) {
    await new Promise<void>((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const cleanup = () => {
        clearTimeout(timeout);
        window.removeEventListener(scheduleViewCommandResultEvent, result);
        signal.removeEventListener("abort", abort);
      };
      const abort = () => {
        cleanup();
        reject(new DOMException("Cancelled", "AbortError"));
      };
      const result = (event: Event) => {
        const detail = (
          event as CustomEvent<{
            requestId: string;
            projectId: string;
            ok: boolean;
            error?: string;
          }>
        ).detail;
        if (detail?.requestId !== requestId || detail.projectId !== projectId)
          return;
        cleanup();
        if (detail.ok) resolve();
        else
          reject(
            Error(
              detail.error ||
                "The Schedule view could not change. Refresh it and try again.",
            ),
          );
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(
          Error(
            "The working Schedule is not ready. Open its timeline and try again.",
          ),
        );
      }, 1000);
      window.addEventListener(scheduleViewCommandResultEvent, result);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) {
        abort();
        return;
      }
      window.dispatchEvent(
        new CustomEvent(scheduleViewCommandEvent, {
          detail: {
            projectId,
            sourceSha256: snapshot.sourceSha256,
            projectVersion: snapshot.projectVersion,
            requestId,
            command,
          },
        }),
      );
    });
  }
  return {
    mode: "view" as const,
    text: `Schedule view command · no AI generation.\n\n${intent.description}\n\nThis changes display only. Tasks, dates, assignments and approvals are unchanged.`,
    sources: [],
    proposals: [],
  };
}
