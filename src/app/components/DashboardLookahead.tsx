"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api-client";
import {
  LOOKAHEAD_WEEKS,
  type ProjectReportResult,
} from "@/lib/project-reports";
import { Button } from "./ui/button";
import { InfoPopover } from "./InfoPopover";

/** Same complete population and drilldowns as Reports; only the displayed preview is bounded. */
export function DashboardLookahead({ projectId }: { projectId: string }) {
  return <LookaheadSession key={projectId} projectId={projectId} />;
}

function LookaheadSession({ projectId }: { projectId: string }) {
  const [weeks, setWeeks] = useState<2 | 4 | 6>(2);
  const [response, setResponse] = useState<{
    key: string;
    result?: ProjectReportResult;
    error?: string;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const loadKey = `${projectId}:${weeks}:${retry}`;
  const current = response?.key === loadKey ? response : null;
  const result = current?.result;
  const error = current?.error;
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<ProjectReportResult>(
      `/api/projects/${encodeURIComponent(projectId)}/reports?report=lookahead&weeks=${weeks}&limit=5`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setResponse({ key: loadKey, result: value });
        }
      })
      .catch((problem: unknown) => {
        if (!controller.signal.aborted)
          setResponse({
            key: loadKey,
            error:
              problem instanceof Error
                ? problem.message
                : `Could not load the next ${weeks} weeks.`,
          });
      });
    return () => controller.abort();
  }, [projectId, weeks, loadKey]);
  return (
    <section
      aria-label="Upcoming schedule activities"
      className="rounded-xl border bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h3 className="text-base font-semibold">Schedule lookahead</h3>
          <InfoPopover label="Lookahead population">
            <p>
              Saved working Schedule activities overlapping the report window,
              including activities already in progress. App tasks and equipment
              are separate populations. Undated and overdue activities are
              counted separately.
            </p>
          </InfoPopover>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          Window
          <select
            aria-label="Lookahead window"
            className="field-select min-h-11"
            value={weeks}
            onChange={(event) =>
              setWeeks(Number(event.target.value) as 2 | 4 | 6)
            }
          >
            {LOOKAHEAD_WEEKS.map((value) => (
              <option key={value} value={value}>
                {value} weeks
              </option>
            ))}
          </select>
        </label>
      </div>
      {result && (
        <Link
          className="inline-flex min-h-11 items-center text-sm text-blue-800 underline"
          href={result.href}
        >
          Open complete report
        </Link>
      )}
      {error ? (
        <div role="alert" className="space-y-2 text-sm text-red-700">
          <p>{error} The count is unavailable.</p>
          <Button
            variant="outline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry lookahead
          </Button>
        </div>
      ) : !result ? (
        <p role="status" className="py-3 text-sm text-slate-600">
          Loading saved Schedule…
        </p>
      ) : result.coverage.sourceUnavailable ? (
        <p role="alert" className="text-sm text-amber-950">
          The source Schedule is unavailable. The complete activity count is
          unknown. Open the report to retry.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            <strong className="text-slate-950 tabular-nums">
              {result.total}
            </strong>{" "}
            activities · {result.window.from}–{result.window.through}
          </p>
          <ul className="divide-y">
            {result.rows
              .filter((row) => row.kind === "lookahead")
              .map((row) => (
                <li key={row.id}>
                  <Link
                    className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-blue-800 focus-visible:outline-blue-700"
                    href={row.href}
                  >
                    <span className="min-w-0 break-words">
                      {row.name}
                      <span className="block text-xs text-slate-600">
                        {row.activityId}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-600">
                      {row.finish ?? "Finish not recorded"}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
          {!result.total && (
            <p className="py-2 text-sm text-slate-600">
              No saved activities overlap this window.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-600">
            Showing {result.rows.length} of {result.total}. Full population:{" "}
            {result.coverage.activities} Schedule activities;{" "}
            {result.coverage.undatedActivities} undated ·{" "}
            {result.coverage.overdueActivities} open overdue. Updated{" "}
            {result.generatedAt.slice(0, 10)}.
          </p>
        </>
      )}
    </section>
  );
}
