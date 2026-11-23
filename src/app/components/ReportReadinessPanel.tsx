"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api-client";
import type { ReportReadiness } from "@/lib/report-readiness";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";

const stateLabels = {
  ready: "Data available",
  partial: "Partial data",
  missing: "Data needed",
  unavailable: "Unavailable",
};

/** A saved-data check: no generated answers, inferred mappings or automatic repairs. */
export function ReportReadinessPanel({
  projectId,
  version,
}: {
  projectId: string;
  version: number;
}) {
  const { currentUser, memberships } = useApp();
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([
    projectId,
    version,
    retry,
    currentUser.id,
    currentUser.role,
    currentUser.modules,
    memberships,
  ]);
  const [response, setResponse] = useState<{
    key: string;
    result?: ReportReadiness;
    error?: string;
  } | null>(null);
  const current = response?.key === key ? response : null;
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<ReportReadiness>(
      `/api/projects/${encodeURIComponent(projectId)}/report-readiness`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) setResponse({ key, result });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResponse({
            key,
            error:
              error instanceof Error
                ? error.message
                : "The report data check could not load.",
          });
      });
    return () => controller.abort();
  }, [key, projectId]);
  const result = current?.result;
  return (
    <section
      aria-label="Import and report data review"
      className="min-w-0 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Import & report data</h2>
        <Button
          variant="outline"
          onClick={() => setRetry((value) => value + 1)}
        >
          Check again
        </Button>
      </div>
      <p className="max-w-prose text-sm leading-6 text-slate-600">
        Checks the saved project against each report’s data requirements. A
        programme import does not create equipment, tag obligations, test sheets
        or supplier links.
      </p>
      {!current ? (
        <p role="status" className="py-8 text-sm text-slate-600">
          Checking saved project data…
        </p>
      ) : current.error ? (
        <p role="alert" className="py-4 text-sm text-red-700">
          {current.error} Use Check again to retry.
        </p>
      ) : (
        result && (
          <>
            <p className="text-sm text-slate-700 tabular-nums">
              {
                result.reports.filter((report) => report.state !== "ready")
                  .length
              }{" "}
              of {result.reports.length} reports need data or a coverage review.
              Saved-data check · no AI generation.
            </p>
            <div className="divide-y rounded-xl border bg-white">
              {result.reports.map((report) => (
                <details key={report.id} className="group px-4 sm:px-5">
                  <summary className="flex min-h-14 cursor-pointer flex-wrap items-center justify-between gap-2 py-3 text-sm focus-visible:outline-blue-700">
                    <span className="font-semibold">{report.title}</span>
                    <span
                      className={
                        report.state === "ready"
                          ? "text-emerald-800"
                          : "text-slate-600"
                      }
                    >
                      {stateLabels[report.state]}
                      {report.records === null
                        ? ""
                        : ` · ${report.records.toLocaleString("en-GB")} records`}
                    </span>
                  </summary>
                  <ul className="divide-y pb-3 text-sm">
                    {report.criteria.map((criterion) => (
                      <li
                        key={criterion.id}
                        className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:gap-5"
                      >
                        <div className="min-w-0 max-w-prose">
                          <p className="font-medium">
                            {criterion.label}{" "}
                            <span className="font-normal text-slate-600 tabular-nums">
                              {criterion.recorded}/{criterion.total}
                            </span>
                          </p>
                          {(criterion.recorded < criterion.total ||
                            criterion.total === 0) && (
                            <p className="mt-1 leading-6 text-slate-600">
                              {criterion.remedy}
                            </p>
                          )}
                        </div>
                        <Link
                          href={criterion.href}
                          className="inline-flex min-h-11 shrink-0 items-center text-blue-700 underline underline-offset-4 focus-visible:outline-blue-700"
                        >
                          Review records
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
            {result.notes.length > 0 && (
              <ul className="max-w-prose list-disc space-y-2 pl-5 text-xs leading-5 text-slate-600">
                {result.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </>
        )
      )}
    </section>
  );
}
