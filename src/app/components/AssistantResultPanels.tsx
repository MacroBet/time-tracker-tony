"use client";
import { useState } from "react";
import Link from "next/link";
import type { CopilotAnswer } from "@/lib/copilot";
import type { WorkingScheduleDraft } from "@/lib/schedule-working";
import { WorkingScheduleEditor } from "./WorkingScheduleEditor";
import { Button } from "./ui/button";
const titles = {
  tagging: "Tagging status",
  "works-to-go": "Works to go",
  lookahead: "Next 14 days",
  vendors: "Equipment suppliers needed",
};
export function AssistantResultPanels({
  answer,
  projectId,
  onSaved,
}: {
  answer: CopilotAnswer;
  projectId: string;
  onSaved: () => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      {answer.reports?.map((report, i) => (
        <section
          key={i}
          className="space-y-3 border-t border-slate-200 pt-4"
          aria-label={`${titles[report.report]} results`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{titles[report.report]}</h3>
            <span className="text-sm tabular-nums">
              {report.total} matching records
            </span>
          </div>
          <p className="text-sm text-slate-600">
            {[
              report.query.vendor &&
                `Supplier: ${report.query.vendor === "__missing__" ? "Not recorded" : report.query.vendor}`,
              report.query.level,
              report.query.late !== "all" &&
                `Date status: ${report.query.late}`,
              report.query.discipline &&
                `Discipline: ${report.query.discipline}`,
              (report.report === "lookahead" || report.report === "vendors") &&
                `${report.window.from} to ${report.window.through}`,
            ]
              .filter(Boolean)
              .join(" · ") || "All project records"}
          </p>
          <p className="text-xs text-slate-600">
            Snapshot {new Date(report.generatedAt).toLocaleString("en-GB")} ·
            Revision {report.revision.register}. Showing{" "}
            {Math.min(report.rows.length, 5)} of {report.total}.
          </p>
          <ul className="divide-y divide-slate-200">
            {report.rows.slice(0, 5).map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2 text-sm text-blue-800 underline underline-offset-4"
                >
                  <span className="min-w-0 break-words">{row.name}</span>
                  {row.kind === "tagging" && (
                    <span className="tabular-nums">
                      {row.progress.percent === null
                        ? "Progress not recorded"
                        : `${row.progress.percent}% steps passed`}
                    </span>
                  )}
                  {row.kind === "lookahead" && (
                    <span>
                      {row.start ?? "Start unknown"} →{" "}
                      {row.finish ?? "Finish unknown"}
                    </span>
                  )}
                  {row.kind === "vendors" && (
                    <span>{row.activities} activities</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {report.notes.map((note, n) => (
            <p key={n} className="text-xs leading-5 text-slate-600">
              {note}
            </p>
          ))}
          <Link
            href={report.href}
            className="inline-flex min-h-11 items-center text-sm font-medium text-blue-800 underline"
          >
            Open the full filtered report
          </Link>
        </section>
      ))}
      {answer.librarySearches?.map((result, i) => (
        <section
          key={i}
          aria-label="Project library results"
          className="space-y-3 border-t border-slate-200 pt-4"
        >
          <h3 className="font-semibold">
            Project library · {result.total} matches
          </h3>
          <p className="text-xs text-slate-600">
            Showing {result.results.length} records from projects you can
            access.
          </p>
          <ul className="divide-y divide-slate-200">
            {result.results.map((row) => (
              <li key={row.key} className="py-2">
                <Link
                  href={row.sourceHref}
                  className="inline-flex min-h-11 items-center break-words text-sm text-blue-800 underline"
                >
                  {row.projectName} · {row.title}
                </Link>
                <p className="text-sm text-slate-600 break-words">
                  {row.snippet}
                </p>
              </li>
            ))}
          </ul>
          <Link
            href="/library"
            className="inline-flex min-h-11 items-center text-sm text-blue-800 underline"
          >
            Open project library
          </Link>
        </section>
      ))}
      {answer.scheduleProposals?.map((draft, i) => (
        <ScheduleDraft
          key={i}
          projectId={projectId}
          draft={draft}
          onSaved={onSaved}
        />
      ))}
    </div>
  );
}
function ScheduleDraft({
  projectId,
  draft,
  onSaved,
}: {
  projectId: string;
  draft: WorkingScheduleDraft;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section
      aria-label="Suggested schedule change"
      className="space-y-3 border-t border-slate-200 pt-4"
    >
      <h3 className="text-sm font-semibold">
        Suggested Schedule change ·{" "}
        {draft.kind === "create-asset-activity"
          ? draft.title
          : draft.internalId}
      </h3>
      {open ? (
        <WorkingScheduleEditor
          projectId={projectId}
          sourceSha256={draft.sourceSha256}
          initialDraft={draft}
          onSaved={onSaved}
          onClose={() => setOpen(false)}
        />
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          Review suggested Schedule change
        </Button>
      )}
    </section>
  );
}
