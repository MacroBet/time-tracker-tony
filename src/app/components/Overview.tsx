"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, AlertTriangle, CalendarClock } from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { AppShell } from "./AppShell";
import { Button } from "./ui/button";
import {
  isClosed,
  isOverdue,
  projectDate,
  statusLabels,
  type TaskStatus,
} from "@/lib/domain";
import {
  commissioning,
  dueDateFor,
  tagSummary,
  tagTimeline,
  taskKind,
} from "@/lib/commissioning";
import { ReportDialog, type ReportRequest } from "./CommissioningReport";
import { TagProgressMatrix } from "./TagProgressMatrix";

const statuses: { status: TaskStatus; color: string }[] = [
  { status: "pending", color: "#ffb347" },
  { status: "in-progress", color: "#2867ff" },
  { status: "review", color: "#8c74f4" },
  { status: "blocked", color: "#ef6670" },
  { status: "completed", color: "#14b87a" },
  { status: "not-applicable", color: "#cbd5e1" },
];
function Ring({
  percent,
  label,
  detail,
  onClick,
}: {
  percent: number | null;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center rounded-xl p-3 hover:bg-slate-50 focus-visible:outline-blue-600"
      aria-label={`${label}: ${percent === null ? "no applicable assets" : `${percent}% complete`}. View details`}
    >
      <div
        className="size-24 rounded-full grid place-items-center"
        style={{
          background: `conic-gradient(#2463eb ${(percent ?? 0) * 3.6}deg, #edf1f7 0)`,
        }}
      >
        <div className="size-[76px] rounded-full bg-white grid place-items-center font-semibold text-xl">
          {percent === null ? "—" : `${percent}%`}
        </div>
      </div>
      <span className="mt-3 font-semibold text-sm group-hover:text-blue-600">
        {label}
      </span>
      <span className="mt-1 text-xs text-slate-500">{detail}</span>
    </button>
  );
}
export function Overview() {
  const data = useApp();
  const { selectedProjectId, projects } = data;
  const project = projects.find((p) => p.id === selectedProjectId);
  const [report, setReport] = useState<ReportRequest | null>(null);
  if (!project)
    return (
      <AppShell title="Dashboard">
        <p>No project assigned.</p>
      </AppShell>
    );
  const state = commissioning(project),
    tasks = data.tasks.filter((t) => t.projectId === project.id);
  const issues = tasks.filter((t) => taskKind(t) === "issue"),
    overdue = tasks
      .filter((t) => isOverdue(t))
      .sort((a, b) => (dueDateFor(a) ?? "").localeCompare(dueDateFor(b) ?? ""));
  const blocked = tasks.filter((t) => t.status === "blocked"),
    failed = tasks.filter(
      (t) => !isClosed(t) && ["failed", "retest"].includes(t.cx?.result ?? ""),
    );
  const tags = tagSummary(project, tasks);
  const construction = tasks.filter((task) => taskKind(task) === "task");
  const applicableConstruction = construction.filter(
    (task) => task.status !== "not-applicable",
  );
  const completedConstruction = applicableConstruction.filter(
    (task) => task.status === "completed",
  ).length;
  const timeline = tagTimeline(project, tasks);
  const open = (
    title: string,
    filters: ReportRequest["filters"] = {},
    view: ReportRequest["view"] = "tasks",
  ) => setReport({ title, filters, view });
  let offset = 0;
  const gradient = statuses
    .map((s) => {
      const start = offset;
      offset += tasks.length
        ? (100 * tasks.filter((t) => t.status === s.status).length) /
          tasks.length
        : 0;
      return `${s.color} ${start}% ${offset}%`;
    })
    .join(",");
  const unlinked = tasks.filter(
    (t) => !t.cx?.assetId || !t.cx.activityId,
  ).length;
  return (
    <AppShell
      title="Commissioning dashboard"
      subtitle="Project progress, readiness and actions."
      wide
    >
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{project.name}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {project.location} · As of {projectDate()} · Schedule revision{" "}
            {state.version}
          </p>
        </div>
        <Button asChild>
          <Link href="/supervisor">
            Open task planner <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Overdue activities",
            count: overdue.length,
            caption: "Against current schedule",
            color: "text-red-600",
            filters: { attention: "overdue" },
          },
          {
            label: "Blockers",
            count: blocked.length,
            caption: "Require action to proceed",
            color: "text-amber-600",
            filters: { attention: "blocked" },
          },
          {
            label: "Failed / retest",
            count: failed.length,
            caption: "Open test follow-ups",
            color: "text-rose-600",
            filters: { attention: "failed" },
          },
          {
            label: "Approved tags",
            count: `${tags.completed} / ${tags.total}`,
            caption:
              tags.percent === null
                ? "Register applicable assets to begin"
                : `${tags.percent}% of applicable asset tags`,
            color: "text-blue-600",
            view: "tags" as const,
          },
        ].map((m) => (
          <button
            key={m.label}
            className="rounded-xl border bg-white p-4 text-left hover:border-blue-300"
            onClick={() => open(m.label, m.filters, m.view)}
          >
            <p className="text-xs text-slate-500">{m.label}</p>
            <p className={`text-2xl font-semibold mt-2 ${m.color}`}>
              {m.count}
            </p>
            <p className="text-xs text-slate-500 mt-2">{m.caption}</p>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
        <button
          className="hover:text-blue-600"
          onClick={() => open("Completed activities", { status: "completed" })}
        >
          <strong>
            {tasks.filter((t) => t.status === "completed").length}
          </strong>{" "}
          completed activities
        </button>
        <button
          className="hover:text-blue-600"
          onClick={() =>
            open("Activities needing assignment", { attention: "unassigned" })
          }
        >
          <strong>
            {tasks.filter((t) => !t.assignedTo && !isClosed(t)).length}
          </strong>{" "}
          need assignment
        </button>
        <span>
          <strong>{state.assets.length}</strong> assets
        </span>
        <span>
          <strong>{unlinked}</strong> activities missing asset or schedule links
        </span>
      </div>
      <div className="grid xl:grid-cols-[1fr_1.35fr] gap-5">
        <section className="rounded-xl border bg-white p-5">
          <h3 className="font-semibold text-sm mb-5">Tasks by status</h3>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => open("All project activities")}
              aria-label="View all project activities"
              className="size-44 rounded-full grid place-items-center"
              style={{
                background: tasks.length
                  ? `conic-gradient(${gradient})`
                  : "#edf1f7",
              }}
            >
              <span className="size-28 rounded-full bg-white flex flex-col justify-center">
                <strong className="text-3xl">{tasks.length}</strong>
                <span className="text-xs text-slate-500">Activities</span>
              </span>
            </button>
            <div className="w-full max-w-56 min-w-40 space-y-1">
              {statuses.map((s) => (
                <button
                  key={s.status}
                  onClick={() =>
                    open(statusLabels[s.status], { status: s.status })
                  }
                  className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-50 text-xs"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: s.color }}
                  />
                  <span className="text-left text-slate-600">
                    {statusLabels[s.status]}
                  </span>
                  <strong className="ml-auto tabular-nums">
                    {tasks.filter((t) => t.status === s.status).length}
                  </strong>
                </button>
              ))}
            </div>
          </div>
        </section>
        <section className="rounded-xl border bg-white p-5">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">Tag completion by level</h3>
            <button
              className="text-xs text-blue-600"
              onClick={() => open("Asset tag register", {}, "tags")}
            >
              View register
            </button>
          </div>
          <div className="flex flex-wrap justify-around mt-3">
            {state.config.levels.map((level) => {
              const s = tagSummary(project, tasks, level);
              return (
                <Ring
                  key={level}
                  percent={s.percent}
                  label={level}
                  detail={`${s.completed} / ${s.total} approved`}
                  onClick={() => open(`${level} tag status`, { level }, "tags")}
                />
              );
            })}
          </div>
          {!state.config.levels.length && (
            <p className="py-10 text-center text-sm text-slate-500">
              Configure this project’s commissioning levels in project setup.
            </p>
          )}
          <p className="text-xs text-slate-500 mt-3">
            Approved tags / applicable asset-level records. A counts as explicit
            approval; tags without review status retain legacy
            completed-workflow approval. Testing and review are tracked
            separately.
          </p>
        </section>
      </div>
      <section className="rounded-xl border bg-white p-5">
        <h3 className="text-sm font-semibold">Programme overview</h3>
        <p className="mt-1 text-xs text-slate-600">
          Approval progress by configured commissioning stage. Stage names and
          colours are managed in project setup.
        </p>
        <div className="mt-5 space-y-4">
          {state.config.levels.map((level) => {
            const summary = tagSummary(project, tasks, level);
            const presentation = state.config.phasePresentation?.[level];
            return (
              <button
                key={level}
                className="block w-full rounded px-1 py-1 text-left hover:bg-slate-50 focus-visible:outline-blue-600"
                onClick={() =>
                  open(
                    `${presentation?.label || level} tag progress`,
                    { level },
                    "tags",
                  )
                }
              >
                <span className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {level}
                    {presentation?.label && presentation.label !== level
                      ? ` · ${presentation.label}`
                      : ""}
                  </span>
                  <span className="tabular-nums text-slate-600">
                    {summary.completed} / {summary.total} approved ·{" "}
                    <strong className="text-slate-900">
                      {summary.percent === null ? "—" : `${summary.percent}%`}
                    </strong>
                  </span>
                </span>
                <span className="block h-2 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${summary.percent ?? 0}%`,
                      backgroundColor: presentation?.color ?? "#2563eb",
                    }}
                  />
                </span>
              </button>
            );
          })}
        </div>
        {!state.config.levels.length && (
          <p className="py-6 text-sm text-slate-600">
            Configure commissioning stages and register applicable assets to
            show project progress.
          </p>
        )}
        <p className="mt-4 text-xs text-slate-600">
          Percentages use applicable asset-level tag obligations. Explicit A or
          legacy completed-workflow approval counts; I, R and AC do not. Passed
          tests alone do not approve a tag. Missing records remain incomplete.
        </p>
      </section>
      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">
              Construction / general work
            </h3>
            <p className="mt-1 max-w-prose text-xs text-slate-600">
              Activities classified as Task, excluding tags, issues and
              documentation. Completion is separate from tag approval.
            </p>
          </div>
          <button
            className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 focus-visible:outline-blue-600"
            onClick={() =>
              open("Construction / general work", { kind: "task" })
            }
          >
            View {construction.length} activities
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <strong className="text-xl tabular-nums">
            {applicableConstruction.length
              ? `${Math.round((100 * completedConstruction) / applicableConstruction.length)}%`
              : "—"}
          </strong>
          <span className="text-sm text-slate-600">
            {completedConstruction} / {applicableConstruction.length} applicable
            activities completed
          </span>
          <span className="text-xs text-slate-600">
            {construction.length - applicableConstruction.length} N/A excluded
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Construction and general task completion"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={
            applicableConstruction.length
              ? Math.round(
                  (100 * completedConstruction) / applicableConstruction.length,
                )
              : 0
          }
          aria-valuetext={
            applicableConstruction.length
              ? `${completedConstruction} of ${applicableConstruction.length} complete`
              : "No applicable activities"
          }
          className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
        >
          <div
            className="h-full bg-emerald-600"
            style={{
              width: `${applicableConstruction.length ? (100 * completedConstruction) / applicableConstruction.length : 0}%`,
            }}
          />
        </div>
      </section>
      <TagProgressMatrix
        key={`${project.id}-all`}
        project={project}
        tasks={tasks}
        onOpen={setReport}
      />
      <TagProgressMatrix
        key={`${project.id}-client`}
        project={project}
        tasks={tasks}
        clientSupplied
        onOpen={setReport}
      />
      <div className="grid xl:grid-cols-2 gap-5">
        <section className="rounded-xl border bg-white p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-sm flex gap-2 items-center">
              <CalendarClock className="size-4 text-red-500" />
              Overdue as of today
            </h3>
            <button
              className="text-xs text-blue-600"
              onClick={() =>
                open("Overdue activities", { attention: "overdue" })
              }
            >
              View all {overdue.length}
            </button>
          </div>
          <div className="divide-y">
            {overdue.slice(0, 5).map((t) => (
              <Link
                key={t.id}
                href={`/tasks/${t.id}`}
                className="flex justify-between gap-4 py-3 hover:text-blue-600"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">
                    {t.title}
                  </span>
                  <span className="text-xs text-slate-500">
                    {t.cx?.assetId ?? "Asset unlinked"} ·{" "}
                    {t.cx?.level ?? "No level"} · {t.priority ?? "No priority"}
                  </span>
                </span>
                <span className="text-xs text-red-600 shrink-0">
                  {dueDateFor(t)}
                </span>
              </Link>
            ))}
          </div>
          {!overdue.length && (
            <p className="py-6 text-sm text-slate-500">
              No overdue activities with a recorded deadline.
            </p>
          )}
        </section>
        <section className="rounded-xl border bg-white p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-sm">Issues by priority</h3>
            <button
              className="text-xs text-blue-600"
              onClick={() => open("Issue register", { kind: "issue" })}
            >
              View all issues
            </button>
          </div>
          <div className="space-y-4">
            {state.config.priorities.map((priority) => {
              const items = issues.filter((t) => t.priority === priority),
                active = items.filter((t) => !isClosed(t)).length;
              return (
                <button
                  key={priority}
                  className="w-full text-left group"
                  onClick={() =>
                    open(`${priority} issues`, { kind: "issue", priority })
                  }
                >
                  <span className="flex justify-between text-xs mb-2">
                    <span className="font-medium group-hover:text-blue-600">
                      {priority}
                    </span>
                    <span className="text-slate-500">
                      {active} open · {items.length} total
                    </span>
                  </span>
                  <span className="block h-2 rounded-full bg-slate-100">
                    <span
                      className="block h-2 rounded-full bg-blue-500"
                      style={{
                        width: `${items.length ? (100 * active) / items.length : 0}%`,
                      }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-4">
            {issues.filter((t) => !t.priority).length} issues without a
            priority. Disabled priorities remain in the issue register.
          </p>
        </section>
      </div>
      <section className="rounded-xl border bg-white p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            Blockers & risks
          </h3>
          <button
            className="text-xs text-blue-600"
            onClick={() =>
              open("Blockers and impact", { attention: "blocked" })
            }
          >
            Open report
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {blocked.slice(0, 4).map((t) => (
            <Link
              key={t.id}
              href={`/tasks/${t.id}`}
              className="border-l-2 border-amber-400 pl-3"
            >
              <p className="font-medium text-sm">{t.title}</p>
              <p className="text-xs text-slate-500 mt-1">
                {t.cx?.blockerRisk || t.notes || "Impact not recorded"}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                {t.cx?.assetId ?? "Asset unlinked"} ·{" "}
                {data.users.find((u) => u.id === t.assignedTo)?.name ??
                  "Unassigned"}
              </p>
            </Link>
          ))}
        </div>
        {!blocked.length && (
          <p className="text-sm text-slate-500">
            No activities currently marked as blocked.
          </p>
        )}
      </section>
      <section className="rounded-xl border bg-white p-5">
        <div className="flex justify-between gap-3">
          <h3 className="text-sm font-semibold">
            Tag programme · planned, forecast & approved
          </h3>
          <button
            className="text-xs text-blue-600"
            onClick={() => open("Tag programme trend", {}, "trend")}
          >
            View figures
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {timeline.scheduled} of {timeline.total} applicable tags have forecast
          dates. {timeline.baselineRecorded} have baseline dates. Approval uses
          the recorded workflow completion date for approved tags; approvals
          without that date are not placed on the trend.
        </p>
        {timeline.points.length > 1 ? (
          <>
            <svg
              role="img"
              aria-label="Cumulative tag programme: baseline, forecast and approved tags"
              viewBox="0 0 800 180"
              className="w-full h-44 mt-4"
            >
              <line x1="20" y1="155" x2="780" y2="155" stroke="#e2e8f0" />
              {(
                [
                  ["baseline", "#94a3b8"],
                  ["forecast", "#2563eb"],
                  ["achieved", "#10b981"],
                ] as const
              )
                .filter(([key]) =>
                  key === "baseline"
                    ? timeline.baselineRecorded > 0
                    : key === "forecast"
                      ? timeline.scheduled > 0
                      : true,
                )
                .map(([key, color]) => (
                  <polyline
                    key={key}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    points={timeline.points
                      .map(
                        (p) =>
                          `${20 + (760 * (Date.parse(p.date) - Date.parse(timeline.points[0].date))) / (Date.parse(timeline.points.at(-1)!.date) - Date.parse(timeline.points[0].date))},${155 - (135 * p[key]) / Math.max(timeline.total, 1)}`,
                      )
                      .join(" ")}
                  />
                ))}
              <text x="20" y="178" fontSize="11" fill="#64748b">
                {timeline.points[0].date}
              </text>
              <text
                x="780"
                y="178"
                textAnchor="end"
                fontSize="11"
                fill="#64748b"
              >
                {timeline.points.at(-1)?.date}
              </text>
            </svg>
            <div className="flex gap-5 text-xs">
              <span className="text-slate-500">Baseline</span>
              <span className="text-blue-600">Forecast</span>
              <span className="text-emerald-600">Approved</span>
            </div>
          </>
        ) : (
          <p className="py-6 text-sm text-slate-500">
            Link tag activities to dated schedule records to compare the
            programme with approvals.
          </p>
        )}
      </section>
      <section className="flex flex-wrap gap-2" aria-label="Management reports">
        {[
          ["Tag status", "tags"],
          ["Tags by equipment type", "equipment"],
          ["Programme schedule", "schedule"],
          ["O&M, training & sign-off", "handover"],
          ["Checklist conformance", "conformance"],
        ].map(([title, view]) => (
          <Button
            variant="outline"
            key={view}
            onClick={() => open(title, {}, view as ReportRequest["view"])}
          >
            {title}
            <ArrowUpRight className="size-4" />
          </Button>
        ))}
      </section>
      <ReportDialog
        key={project.id}
        project={project}
        request={report}
        onClose={() => setReport(null)}
      />
    </AppShell>
  );
}
