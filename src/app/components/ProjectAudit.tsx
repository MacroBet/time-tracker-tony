"use client";
import { useEffect, useState } from "react";
import { Download, History, Pencil, Upload } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import type { ProjectAuditEvent, ProjectAuditPage } from "@/lib/project-audit";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";

const icons = { edit: Pencil, upload: Upload, download: Download };
export function ProjectAudit({
  projectId,
  refreshKey,
}: {
  projectId: string;
  refreshKey?: string | number;
}) {
  return (
    <AuditHistory
      key={projectId}
      projectId={projectId}
      refreshKey={refreshKey}
    />
  );
}
function AuditHistory({
  projectId,
  refreshKey,
}: {
  projectId: string;
  refreshKey?: string | number;
}) {
  const { lastSyncTime } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState<ProjectAuditPage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const limit = expanded ? 20 : 3;
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<ProjectAuditPage>(
      `/api/projects/${encodeURIComponent(projectId)}/audit?limit=${limit}`,
      { signal: controller.signal },
    )
      .then((result) => {
        setPage((previous) =>
          expanded && previous
            ? {
                total: result.total,
                events: [
                  ...new Map(
                    [...result.events, ...previous.events].map((event) => [
                      event.id,
                      event,
                    ]),
                  ).values(),
                ],
              }
            : result,
        );
        setError("");
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "History could not load.",
          );
      });
    return () => controller.abort();
  }, [projectId, refreshKey, expanded, limit, lastSyncTime, retry]);
  async function loadMore() {
    if (!page || busy) return;
    setBusy(true);
    try {
      const next = await apiRequest<ProjectAuditPage>(
        `/api/projects/${encodeURIComponent(projectId)}/audit?limit=20&offset=${page.events.length}`,
      );
      setPage({
        total: next.total,
        events: [
          ...new Map(
            [...page.events, ...next.events].map((event) => [event.id, event]),
          ).values(),
        ],
      });
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "More history could not load.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Project history"
      className="rounded-xl border bg-white p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <History className="size-4" aria-hidden="true" />
            Project history
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {expanded
              ? "Edits, imports, evidence and exports for this project."
              : "The three most recent project events."}
          </p>
        </div>
        {!!page?.total && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? "Show latest three"
              : `View full history (${page.total})`}
          </Button>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="text-sm text-red-700 flex flex-wrap gap-2 items-center"
        >
          <span>{error}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRetry(retry + 1)}
          >
            Retry
          </Button>
        </div>
      )}
      {!page && !error && (
        <p className="text-sm text-slate-600" role="status">
          Loading project history…
        </p>
      )}
      {page && page.total === 0 && (
        <p className="text-sm text-slate-600">
          No changes recorded yet. Saved edits, imports and prepared downloads
          appear here.
        </p>
      )}
      {page && (
        <ol className="divide-y divide-slate-200">
          {page.events.slice(0, expanded ? undefined : 3).map((event) => (
            <HistoryRow key={event.id} event={event} />
          ))}
        </ol>
      )}
      {expanded && page && page.events.length < page.total && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void loadMore()}
        >
          {busy
            ? "Loading…"
            : `Load more (${page.events.length} of ${page.total})`}
        </Button>
      )}
      <p className="text-xs text-slate-600">
        Downloads record when the server prepares a file. Browser receipt is not
        confirmed. Historical register revisions appear as edits when their
        original record has no action type.
      </p>
    </section>
  );
}
function HistoryRow({ event }: { event: ProjectAuditEvent }) {
  const Icon = icons[event.action];
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex gap-3">
        <Icon
          className="size-4 shrink-0 mt-0.5 text-slate-600"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
            <p className="text-sm font-medium break-words">{event.label}</p>
            <time
              dateTime={event.at}
              className="text-xs text-slate-600 tabular-nums"
            >
              {new Date(event.at).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </time>
          </div>
          <p className="text-sm text-slate-600 break-words">
            {event.actor} · {event.object}
          </p>
          {event.detail && (
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700">
                View details
              </summary>
              <p className="mt-2 whitespace-pre-wrap break-words text-slate-600">
                {event.detail}
              </p>
            </details>
          )}
        </div>
      </div>
    </li>
  );
}
