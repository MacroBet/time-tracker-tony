"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api-client";
import type { ProjectReportResult } from "@/lib/project-reports";
import { Button } from "./ui/button";
import { InfoPopover } from "./InfoPopover";

/** Same complete population and drilldowns as Reports; only the displayed preview is bounded. */
export function DashboardLookahead({ projectId }: { projectId: string }) {
  const [result, setResult] = useState<ProjectReportResult | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<ProjectReportResult>(
      `/api/projects/${encodeURIComponent(projectId)}/reports?report=lookahead&limit=5`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setResult(value);
          setError("");
        }
      })
      .catch((problem: unknown) => {
        if (!controller.signal.aborted)
          setError(
            problem instanceof Error
              ? problem.message
              : "Could not load the next 14 days.",
          );
      });
    return () => controller.abort();
  }, [projectId, retry]);
  return (
    <section
      aria-label="Upcoming schedule activities"
      className="rounded-xl border bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h3 className="text-base font-semibold">Next 14 days</h3>
          <InfoPopover label="Lookahead population">
            <p>
              Saved working Schedule activities overlapping the report window,
              including activities already in progress. App tasks and equipment
              are separate populations. Undated and overdue activities are
              counted separately.
            </p>
          </InfoPopover>
        </div>
        {result && (
          <Link
            className="inline-flex min-h-11 items-center text-sm text-blue-800 underline"
            href={result.href}
          >
            Open complete report
          </Link>
        )}
      </div>
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
