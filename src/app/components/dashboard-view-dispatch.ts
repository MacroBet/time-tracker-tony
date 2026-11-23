"use client";

import type { DashboardViewIntent } from "@/lib/dashboard-view-commands";
import {
  dashboardViewCommandEvent,
  dashboardViewCommandResultEvent,
  dashboardViewCommandSchema,
  dashboardViewCommandResultSchema,
} from "@/lib/dashboard-view-context";

/** A view is claimed only after the live Dashboard acknowledges its matching revision. */
export async function applyDashboardView(
  intent: DashboardViewIntent,
  projectId: string,
  version: number,
  signal: AbortSignal,
) {
  const request = dashboardViewCommandSchema.parse({
    projectId,
    projectVersion: version,
    requestId: crypto.randomUUID(),
    view: intent.view,
  });
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener(dashboardViewCommandResultEvent, result);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const result = (event: Event) => {
      const parsed = dashboardViewCommandResultSchema.safeParse(
        (event as CustomEvent).detail,
      );
      if (
        !parsed.success ||
        parsed.data.requestId !== request.requestId ||
        parsed.data.projectId !== request.projectId ||
        parsed.data.projectVersion !== request.projectVersion
      )
        return;
      cleanup();
      if (parsed.data.ok) resolve();
      else
        reject(
          Error(
            parsed.data.error ||
              "The Dashboard view could not change. Refresh it and try again.",
          ),
        );
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        Error(
          "The Dashboard is not ready. Open the current project Dashboard and try again.",
        ),
      );
    }, 1000);
    window.addEventListener(dashboardViewCommandResultEvent, result);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    window.dispatchEvent(
      new CustomEvent(dashboardViewCommandEvent, { detail: request }),
    );
  });
  return {
    mode: "view" as const,
    text: `Dashboard view command · no AI generation.\n\n${intent.description}\n\nThis changes display only. Tasks, dates, assignments and approvals are unchanged.`,
    sources: [],
    proposals: [],
  };
}
