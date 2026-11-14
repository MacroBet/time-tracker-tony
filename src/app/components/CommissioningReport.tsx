"use client";
import { csvCell } from "@/lib/csv";
import { useState } from "react";
import Link from "next/link";
import { useApp } from "../contexts/AppContext";
import {
  commissioning,
  dueDateFor,
  filterTasks,
  tagRows,
  tagTimeline,
  taskAsset,
  taskKind,
  isTagApproved,
  TAG_REVIEWS,
  tagReviewLabels,
  type TaskFilters,
} from "@/lib/commissioning";
import { isOverdue, statusLabels, type Project } from "@/lib/domain";
import { filterTagProgress, type TagProgressFilter } from "@/lib/tag-progress";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { InfoPopover } from "./InfoPopover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

export type ReportView =
  | "tasks"
  | "tags"
  | "schedule"
  | "handover"
  | "conformance"
  | "equipment"
  | "trend";
export type ReportRequest = {
  view: ReportView;
  title: string;
  filters?: TaskFilters & TagProgressFilter;
};
export function downloadReport(name: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ReportDialog({
  project,
  request,
  onClose,
}: {
  project: Project;
  request: ReportRequest | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="!max-w-[96vw] w-[96vw] max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          <DialogDescription>
            {project.name} · Current project records
          </DialogDescription>
        </DialogHeader>
        {request && (
          <CommissioningReport
            key={JSON.stringify(request)}
            project={project}
            request={request}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
export function CommissioningReport({
  project,
  request,
}: {
  project: Project;
  request: ReportRequest;
}) {
  const { tasks, users } = useApp();
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<TaskFilters & TagProgressFilter>(
    request.filters ?? {},
  );
  const state = commissioning(project);
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const matches = filterTasks(projectTasks, project, filters).sort((a, b) =>
    (dueDateFor(a) ?? "9999").localeCompare(dueDateFor(b) ?? "9999"),
  );
  const owner = (id?: string) =>
    users.find((u) => u.id === id)?.name ?? "Unassigned";
  const set = (key: keyof TaskFilters, value: string) => {
    setPage(0);
    setFilters({ ...filters, [key]: value });
  };
  let headers: string[] = [],
    rows: (string | number)[][] = [],
    links: (string | undefined)[] = [];
  if (
    request.view === "tasks" ||
    request.view === "handover" ||
    request.view === "conformance"
  ) {
    const items = matches.filter((t) =>
      request.view === "handover"
        ? taskKind(t) === "documentation"
        : request.view === "conformance"
          ? t.cx?.conforming !== undefined || t.cx?.nonConforming !== undefined
          : true,
    );
    headers =
      request.view === "conformance"
        ? [
            "Activity",
            "Asset",
            "Schedule Activity ID",
            "Level",
            "Conforming",
            "Non-conforming",
            "Conformance",
          ]
        : [
            "Activity / issue ID",
            "Asset",
            "Schedule Activity ID",
            "Level",
            "Priority",
            "Status",
            "Test result",
            "Tag review",
            "Due",
            "Responsible",
            "Progress",
            request.view === "handover" ? "Document type" : "Blocker / risk",
          ];
    rows = items.map((t) =>
      request.view === "conformance"
        ? [
            t.title,
            taskAsset(t, project)?.id ?? "Unlinked",
            t.cx?.activityId ?? "Unlinked",
            t.cx?.level ?? "—",
            t.cx?.conforming ?? "Not recorded",
            t.cx?.nonConforming ?? "Not recorded",
            t.cx?.conforming !== undefined &&
            t.cx.nonConforming !== undefined &&
            t.cx.conforming + t.cx.nonConforming > 0
              ? `${Math.round((100 * t.cx.conforming) / (t.cx.conforming + t.cx.nonConforming))}%`
              : "Not available",
          ]
        : [
            `${t.externalId ? `#${t.externalId} · ` : ""}${t.title}`,
            taskAsset(t, project)?.id ?? "Unlinked",
            t.cx?.activityId ?? "Unlinked",
            t.cx?.level ?? "—",
            t.priority ?? "Unspecified",
            statusLabels[t.status],
            t.cx?.result ?? "untested",
            t.cx?.tagReview
              ? tagReviewLabels[t.cx.tagReview]
              : taskKind(t) === "tag"
                ? "Not recorded (legacy workflow)"
                : "—",
            `${dueDateFor(t) ?? "No date"}${isOverdue(t) ? " · Overdue" : ""}`,
            owner(t.assignedTo),
            t.status === "completed"
              ? "100%"
              : t.cx?.progress !== undefined
                ? `${t.cx.progress}%`
                : "Not recorded",
            request.view === "handover"
              ? (t.cx?.handoverType ?? "Unclassified")
              : (t.cx?.blockerRisk ??
                (t.status === "blocked"
                  ? (t.notes ?? "No reason recorded")
                  : "—")),
          ],
    );
    links = items.map((t) => `/tasks/${t.id}`);
  } else if (request.view === "tags") {
    const items = filterTagProgress(
      tagRows(project, projectTasks),
      filters,
    ).filter(
      (r) =>
        (!filters.level || r.level === filters.level) &&
        (!filters.equipmentType ||
          r.asset.equipmentType === filters.equipmentType) &&
        (!filters.query ||
          `${r.asset.id} ${r.asset.name}`
            .toLowerCase()
            .includes(filters.query.toLowerCase())) &&
        (!filters.status || r.status === filters.status),
    );
    headers = [
      "Asset",
      "Equipment type",
      "Location",
      "Level",
      "Quality tag",
      "Status",
      "Tag review",
      "Counted approval",
      "Test result",
      "Schedule Activity ID",
      "Due",
    ];
    rows = items.map((r) => [
      r.asset.id,
      r.asset.equipmentType,
      r.asset.location || "Not recorded",
      r.level,
      r.task?.cx?.qualityTag ?? "—",
      r.task ? statusLabels[r.task.status] : "Not recorded",
      r.task?.cx?.tagReview
        ? tagReviewLabels[r.task.cx.tagReview]
        : "Not recorded",
      isTagApproved(r.task)
        ? r.task?.cx?.tagReview === "approved"
          ? "A · Explicit approval"
          : "Legacy · Completed workflow"
        : "No",
      r.task?.cx?.result ?? "untested",
      r.task?.cx?.activityId ?? "Unlinked",
      r.task ? (dueDateFor(r.task) ?? "No date") : "No date",
    ]);
    links = items.map((r) => (r.task ? `/tasks/${r.task.id}` : undefined));
  } else if (request.view === "equipment") {
    const tagRecords = tagRows(project, projectTasks);
    const types = [...new Set(state.assets.map((a) => a.equipmentType))].filter(
      (type) => !filters.equipmentType || filters.equipmentType === type,
    );
    headers = [
      "Equipment type",
      "Assets",
      ...state.config.levels.map((l) => `${l} approved / applicable`),
    ];
    rows = types.map((type) => [
      type,
      state.assets.filter((a) => a.equipmentType === type).length,
      ...state.config.levels.map((level) => {
        const items = tagRecords.filter(
          (r) =>
            r.asset.equipmentType === type && r.level === level && r.applicable,
        );
        return items.length
          ? `${items.filter((r) => isTagApproved(r.task)).length} / ${items.length}`
          : "N/A";
      }),
    ]);
  } else if (request.view === "trend") {
    headers = [
      "Date",
      "Baseline cumulative tags",
      "Forecast cumulative tags",
      "Approved cumulative tags",
    ];
    const timeline = tagTimeline(project, projectTasks);
    rows = timeline.points.map((p) => [
      p.date,
      timeline.baselineRecorded ? p.baseline : "Not recorded",
      timeline.scheduled ? p.forecast : "Not recorded",
      p.achieved,
    ]);
  } else {
    const items = state.schedule.filter(
      (s) =>
        (!filters.query ||
          `${s.activityId} ${s.name}`
            .toLowerCase()
            .includes(filters.query.toLowerCase())) &&
        (!filters.dueFrom || (!!s.finish && s.finish >= filters.dueFrom)) &&
        (!filters.dueTo || (!!s.finish && s.finish <= filters.dueTo)),
    );
    headers = [
      "Schedule Activity ID",
      "Activity",
      "Baseline start",
      "Baseline finish",
      "Forecast start",
      "Forecast finish",
      "Actual finish",
      "Schedule progress",
      "Linked tasks",
    ];
    rows = items.map((s) => [
      s.activityId,
      s.name,
      s.baselineStart ?? "—",
      s.baselineFinish ?? "—",
      s.start ?? "—",
      s.finish ?? "—",
      s.actualFinish ?? "Not recorded",
      s.progress === undefined ? "Not recorded" : `${s.progress}%`,
      projectTasks.filter((t) => t.cx?.activityId === s.activityId).length,
    ]);
  }
  // Each exported row retains its programme provenance without changing Activity IDs.
  headers = [...headers, "Schedule ID"];
  rows = rows.map((row) => [...row, state.programmeId || "Not recorded"]);
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / 50) - 1),
  );
  function select(label: string, field: keyof TaskFilters, options: string[]) {
    return (
      <label className="min-w-0 text-sm text-slate-600">
        {label}
        <select
          aria-label={label}
          className="field-select mt-1"
          value={filters[field] ?? ""}
          onChange={(e) => set(field, e.target.value)}
        >
          <option value="">All</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {field === "status"
                ? statusLabels[o as keyof typeof statusLabels]
                : o}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <div className="min-w-0 w-full space-y-4 report-print">
      <p className="break-words text-sm text-slate-600">
        Schedule ID:{" "}
        <span className="font-medium break-words">
          {state.programmeId || "Not recorded"}
        </span>
      </p>
      {!["equipment", "trend"].includes(request.view) && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 print:hidden">
          <label className="min-w-0 text-sm text-slate-600 col-span-2">
            Search ID, asset or activity
            <Input
              aria-label="Search report"
              className="mt-1"
              value={filters.query ?? ""}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Activity ID, asset tag…"
            />
          </label>
          {request.view !== "schedule" && (
            <>
              {select("Level", "level", state.config.levels)}
              {select(
                "Equipment type",
                "equipmentType",
                [...new Set(state.assets.map((a) => a.equipmentType))].sort(),
              )}
              {select("Status", "status", Object.keys(statusLabels))}
              {request.view === "tags" && (
                <label className="min-w-0 text-sm text-slate-600">
                  Tag review
                  <select
                    className="field-select mt-1"
                    value={filters.tagReview ?? ""}
                    onChange={(event) => {
                      setPage(0);
                      setFilters({ ...filters, tagReview: event.target.value });
                    }}
                  >
                    <option value="">All review states</option>
                    {TAG_REVIEWS.map((review) => (
                      <option key={review} value={review}>
                        {tagReviewLabels[review]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
          {request.view === "tasks" && (
            <>
              {select("Priority", "priority", [
                ...new Set([
                  ...state.config.priorities,
                  ...projectTasks.flatMap((t) =>
                    t.priority ? [t.priority] : [],
                  ),
                ]),
              ])}
              {select("Attention", "attention", [
                "overdue",
                "blocked",
                "failed",
                "unassigned",
              ])}
            </>
          )}
          {request.view !== "tags" &&
            ["dueFrom", "dueTo"].map((field, i) => (
              <label key={field} className="min-w-0 text-sm text-slate-600">
                {i ? "Due through" : "Due from"}
                <Input
                  aria-label={i ? "Due through" : "Due from"}
                  className="mt-1"
                  type="date"
                  value={filters[field as keyof TaskFilters] ?? ""}
                  onChange={(e) =>
                    set(field as keyof TaskFilters, e.target.value)
                  }
                />
              </label>
            ))}
        </div>
      )}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <p className="break-words text-sm text-slate-600" aria-live="polite">
          {rows.length} records · {project.name}
        </p>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPage(0);
              setFilters(request.filters ?? {});
            }}
          >
            Reset filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadReport(`commissioning-${request.view}`, [
                headers,
                ...rows,
              ])
            }
          >
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Print this page
          </Button>
        </div>
      </div>
      {request.view === "tags" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-slate-200 py-1 text-sm text-slate-600">
          <p>
            One row per applicable asset and level
            {filters.supply === "client" ? " · Client supplied only" : ""}
            {filters.assetLocation !== undefined
              ? ` · ${filters.assetLocation || "No location recorded"}`
              : ""}
          </p>
          <InfoPopover label="How tagging status is counted">
            <p>
              Missing tag records remain incomplete; N/A records are excluded
              from completion percentages. I = Issued; R = Rejected; AC =
              Approved with comments; A = Approved.
            </p>
            <p>
              Approval counts use A when recorded; legacy tags without a review
              status retain completed-workflow approval. Workflow and test
              result remain separate.
            </p>
          </InfoPopover>
        </div>
      )}
      <div
        className="relative isolate max-h-[65dvh] overflow-auto overscroll-contain rounded-xl border bg-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700 print:max-h-none print:overflow-visible"
        role="region"
        aria-label={`${request.title} report records`}
        tabIndex={0}
      >
        <table className="w-full text-sm text-left">
          <caption className="sr-only">
            {request.title} · Filtered records for {project.name}
          </caption>
          <thead className="sticky top-0 z-20 bg-slate-50">
            <tr>
              {headers.map((h, index) => (
                <th
                  scope="col"
                  className={`p-3 whitespace-nowrap font-medium text-slate-700 ${index === 0 ? "sticky left-0 z-30 bg-slate-50" : ""}`}
                  key={h}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .slice(currentPage * 50, currentPage * 50 + 50)
              .map((row, index) => {
                const i = index + currentPage * 50;
                return (
                  <tr key={i} className="border-t hover:bg-slate-50">
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className={`p-3 break-words [overflow-wrap:anywhere] ${j === 0 ? "sticky left-0 z-10 min-w-52 max-w-96 bg-white font-medium" : "min-w-24 max-w-80"}`}
                      >
                        {j === 0 && links[i] ? (
                          <Link
                            className="inline-flex min-h-11 items-center text-blue-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                            href={links[i]!}
                          >
                            {cell}
                          </Link>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-6 text-center text-sm text-slate-600">
            No matching records. Import the register or adjust the filters.
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-between items-center gap-3 text-sm text-slate-600">
        <span>
          {rows.length ? currentPage * 50 + 1 : 0}–
          {Math.min((currentPage + 1) * 50, rows.length)} of {rows.length}{" "}
          records · Page {currentPage + 1} of{" "}
          {Math.max(1, Math.ceil(rows.length / 50))}
          <span className="mt-1 block text-xs">
            CSV includes all filtered records.
          </span>
        </span>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={(currentPage + 1) * 50 >= rows.length}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
