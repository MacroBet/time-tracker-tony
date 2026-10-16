"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, AlertTriangle } from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { AppShell } from "./AppShell";
import { Button } from "./ui/button";
import {
  isClosed,
  isOverdue,
  projectDate,
  statusLabels,
  type Project,
  type TaskStatus,
} from "@/lib/domain";
import {
  commissioning,
  dueDateFor,
  tagSummary,
  tagTimeline,
  taskKind,
  hasModule,
} from "@/lib/commissioning";
import { ReportDialog, type ReportRequest } from "./CommissioningReport";
import { TagProgressMatrix } from "./TagProgressMatrix";
import { taskProgress } from "@/lib/dashboard-progress";
import { filterTasks, type TaskFilters } from "@/lib/commissioning";

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
      <AppShell title="Overview">
        <p className="text-sm text-slate-600">
          No project access yet. A project administrator can add you to the
          project team.
        </p>
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
  const hasTags = tags.total > 0;
  const canPlan = hasModule(data.currentUser, "commissioning");
  const canWork = hasModule(data.currentUser, "tasks");
  const gettingStarted =
    !state.assets.length || !state.schedule.length || !tasks.length;
  if (!state.assets.length && !state.schedule.length && !tasks.length) {
    return (
      <AppShell title="Overview" wide>
        <ProjectGettingStarted
          project={project}
          taskCount={0}
          canPlan={canPlan}
          canWork={canWork}
        />
      </AppShell>
    );
  }
  return (
    <AppShell title="Overview" wide>
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold">Project progress</h2>
          <p className="text-sm text-slate-500 mt-1">
            {project.location} · As of {projectDate()} · Schedule revision{" "}
            {state.version}
          </p>
        </div>
        {canPlan && (
          <Button asChild className="min-h-11">
            <Link href="/schedule">
              Open programme <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        )}
      </div>
      {gettingStarted && (
        <ProjectGettingStarted
          project={project}
          taskCount={tasks.length}
          canPlan={canPlan}
          canWork={canWork}
          compact
        />
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {tasks.length > 0 && (
          <section
            aria-label="Tasks by status"
            className="rounded-xl border bg-white p-4"
          >
            <h3 className="font-semibold text-sm mb-3">Tasks by status</h3>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => open("All project activities")}
                aria-label="View all project activities"
                className="size-28 shrink-0 rounded-full grid place-items-center"
                style={{
                  background: tasks.length
                    ? `conic-gradient(${gradient})`
                    : "#edf1f7",
                }}
              >
                <span className="size-20 rounded-full bg-white flex flex-col justify-center">
                  <strong className="text-2xl">{tasks.length}</strong>
                  <span className="text-xs text-slate-500">Activities</span>
                </span>
              </button>
              <div className="grid w-full max-w-80 min-w-0 grid-cols-2 gap-x-2 gap-y-1">
                {statuses.map((s) => (
                  <button
                    key={s.status}
                    onClick={() =>
                      open(statusLabels[s.status], { status: s.status })
                    }
                    className="w-full flex items-center gap-2 min-h-11 px-2 rounded hover:bg-slate-50 text-xs"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
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
        )}
        <section
          aria-label="Project summary"
          className="rounded-xl border bg-white p-4"
        >
          <h3 className="text-sm font-semibold">Project summary</h3>
          <p className="mt-1 text-xs text-slate-600">
            {project.name} · saved task records
          </p>
          <div className="mt-4">
            <ProgressCounters
              label="Project"
              summary={taskProgress(tasks)}
              onOpen={(metric) =>
                open(
                  `Project · ${metric === "total" ? "all" : metric} activities`,
                  metricFilters(metric),
                )
              }
            />
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Completion excludes N/A. Late means open and due before today, using
            the programme date where recorded, otherwise the task deadline.
          </p>
          <Link
            href="/overdue"
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue-700 underline underline-offset-4"
          >
            Open overdue list <ArrowUpRight className="size-4" />
          </Link>
          <details className="mt-2 border-t pt-2 text-xs text-slate-600">
            <summary className="min-h-11 cursor-pointer py-3">
              Project Health · awaiting definition
            </summary>
            <p className="pb-2">
              On Track, At Risk and Off Track criteria and project scope still
              need to be agreed. No health rating has been calculated.
            </p>
          </details>
        </section>
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
        ]
          .filter((metric) =>
            metric.view === "tags" ? hasTags : tasks.length > 0,
          )
          .map((m) =>
            m.label === "Overdue activities" ? (
              <Link
                key={m.label}
                href="/overdue"
                className="rounded-xl border bg-white p-4 text-left hover:border-blue-300 focus-visible:outline-blue-600"
              >
                <p className="text-xs text-slate-500">{m.label}</p>
                <p className={`mt-2 text-2xl font-semibold ${m.color}`}>
                  {m.count}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Open separate list
                </p>
              </Link>
            ) : (
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
            ),
          )}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
        {tasks.length > 0 && (
          <button
            className="hover:text-blue-600"
            onClick={() =>
              open("Completed activities", { status: "completed" })
            }
          >
            <strong>
              {tasks.filter((t) => t.status === "completed").length}
            </strong>{" "}
            completed activities
          </button>
        )}
        {tasks.length > 0 && (
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
        )}
        {state.assets.length > 0 && (
          <span>
            <strong>{state.assets.length}</strong> assets
          </span>
        )}
        {unlinked > 0 && (
          <span>
            <strong>{unlinked}</strong> activities missing asset or schedule
            links
          </span>
        )}
      </div>
      <div className="grid gap-5">
        {hasTags && (
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
              {state.config.levels
                .filter((level) => tagSummary(project, tasks, level).total > 0)
                .map((level) => {
                  const s = tagSummary(project, tasks, level);
                  return (
                    <Ring
                      key={level}
                      percent={s.percent}
                      label={level}
                      detail={`${s.completed} / ${s.total} approved`}
                      onClick={() =>
                        open(`${level} tag status`, { level }, "tags")
                      }
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
              Approved tags / applicable asset-level records. A counts as
              explicit approval; tags without review status retain legacy
              completed-workflow approval. Testing and review are tracked
              separately.
            </p>
          </section>
        )}
      </div>
      {(hasTags || tasks.some((task) => task.cx?.level)) && (
        <section
          aria-label="Programme overview"
          className="rounded-xl border bg-white p-5"
        >
          <h3 className="text-sm font-semibold">Programme overview</h3>
          <p className="mt-1 text-xs text-slate-600">
            Task completion by recorded commissioning stage. Tag approval is
            shown separately above.
          </p>
          <div className="mt-4 divide-y">
            {state.config.levels
              .filter(
                (level) =>
                  tasks.some((task) => task.cx?.level === level) ||
                  tagSummary(project, tasks, level).total > 0,
              )
              .map((level) => {
                const presentation = state.config.phasePresentation?.[level];
                const label =
                  presentation?.label && presentation.label !== level
                    ? `${level} · ${presentation.label}`
                    : level;
                const filters = { level };
                const summary = taskProgress(
                  filterTasks(tasks, project, filters),
                );
                return (
                  <div
                    key={level}
                    className="grid items-center gap-x-4 py-2 first:pt-0 sm:grid-cols-[minmax(12rem,1fr)_minmax(20rem,1.5fr)]"
                  >
                    <button
                      className="min-h-11 text-left text-sm font-medium hover:text-blue-700 focus-visible:outline-blue-600"
                      onClick={() => open(`${label} activities`, filters)}
                    >
                      {label}
                    </button>
                    <ProgressCounters
                      label={label}
                      summary={summary}
                      onOpen={(metric) =>
                        open(
                          `${label} · ${metric === "total" ? "all" : metric} activities`,
                          { ...filters, ...metricFilters(metric) },
                        )
                      }
                    />
                    <div
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 sm:col-span-2"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${summary.percent ?? 0}%`,
                          backgroundColor: presentation?.color ?? "#2563eb",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
          <p className="mt-3 text-xs text-slate-600">
            TOTAL includes N/A; completion % excludes N/A. Only saved tasks with
            an explicit stage are counted; missing tag records are not tasks.{" "}
            {
              tasks.filter(
                (task) =>
                  !task.cx?.level ||
                  !state.config.levels.includes(task.cx.level),
              ).length
            }{" "}
            activities have no enabled stage. No Energisation Gate or IST
            mapping is inferred.
          </p>
        </section>
      )}
      {construction.length > 0 && (
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
              {completedConstruction} / {applicableConstruction.length}{" "}
              applicable activities completed
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
                    (100 * completedConstruction) /
                      applicableConstruction.length,
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
      )}
      {hasTags && (
        <TagProgressMatrix
          key={`${project.id}-all`}
          project={project}
          tasks={tasks}
          onOpen={setReport}
        />
      )}
      {hasTags &&
        state.assets.some((asset) => asset.clientSupplied === true) && (
          <TagProgressMatrix
            key={`${project.id}-client`}
            project={project}
            tasks={tasks}
            clientSupplied
            onOpen={setReport}
          />
        )}
      <div className="grid gap-5">
        {issues.length > 0 && (
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
            <div className="divide-y">
              {[
                ...new Set([
                  ...state.config.priorities,
                  ...issues.flatMap((task) =>
                    task.priority ? [task.priority] : [],
                  ),
                ]),
              ].map((priority) => {
                const filters = { kind: "issue", priority };
                const summary = taskProgress(
                  filterTasks(tasks, project, filters),
                );
                return (
                  <div
                    key={priority}
                    className="grid gap-2 py-2 sm:grid-cols-[5rem_1fr] sm:items-center"
                  >
                    <button
                      className="min-h-11 text-left text-sm font-medium hover:text-blue-700 focus-visible:outline-blue-600"
                      onClick={() => open(`${priority} issues`, filters)}
                    >
                      {priority}
                    </button>
                    <ProgressCounters
                      label={`${priority} issues`}
                      summary={summary}
                      onOpen={(metric) =>
                        open(
                          `${priority} · ${metric === "total" ? "all" : metric} issues`,
                          { ...filters, ...metricFilters(metric) },
                        )
                      }
                    />
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Completion counts completed issues, excluding N/A. Late uses the
              recorded programme date or task deadline.{" "}
              {issues.filter((task) => !task.priority).length} issues have no
              priority and remain in the issue register. No stage is inferred
              from priority.
            </p>
          </section>
        )}
      </div>
      {blocked.length > 0 && (
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
      )}
      {hasTags &&
        (timeline.scheduled > 0 ||
          timeline.baselineRecorded > 0 ||
          timeline.points.some((point) => point.achieved > 0)) && (
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
              {timeline.scheduled} of {timeline.total} applicable tags have
              forecast dates. {timeline.baselineRecorded} have baseline dates.
              Approval uses the recorded workflow completion date for approved
              tags; approvals without that date are not placed on the trend.
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
        )}
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

function ProjectGettingStarted({
  project,
  taskCount,
  canPlan,
  canWork,
  compact = false,
}: {
  project: Project;
  taskCount: number;
  canPlan: boolean;
  canWork: boolean;
  compact?: boolean;
}) {
  const state = commissioning(project);
  const steps = [
    {
      title: "Assets",
      description:
        "The equipment in your project, with its location and commissioning stages.",
      href: "/commissioning",
      action: state.assets.length ? "Open assets" : "Add equipment",
      count: state.assets.length,
      unit: "equipment records",
      allowed: canPlan,
    },
    {
      title: "Programme",
      description:
        "The dates, durations and dependencies that sequence the work.",
      href: "/schedule",
      action: state.schedule.length ? "Open programme" : "Plan activities",
      count: state.schedule.length,
      unit: "planned activities",
      allowed: canPlan,
    },
    {
      title: "Tasks",
      description:
        "The work and test records assigned to your team, including tag reviews.",
      href: "/supervisor",
      action: taskCount ? "Open tasks" : "Create work records",
      count: taskCount,
      unit: "work records",
      allowed: canWork,
    },
  ];
  const Heading = compact ? "h3" : "h2";
  const nextStep = steps.find((step) => step.allowed && !step.count);
  return (
    <section
      className="rounded-xl border bg-white p-5 sm:p-6"
      aria-labelledby="project-start-title"
    >
      <Heading
        id="project-start-title"
        className={`${compact ? "text-base" : "text-xl"} font-semibold`}
      >
        {compact ? "Complete project setup" : "Build your project workspace"}
      </Heading>
      {!compact && (
        <p className="mt-2 max-w-prose text-sm text-slate-600">
          Start with the equipment, plan the programme, then assign work to your
          team. Your progress will appear here as records are added.
        </p>
      )}
      <ul className="mt-4 divide-y">
        {steps.map((step) => (
          <li
            key={step.title}
            className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {step.title}
                {step.count > 0 && (
                  <span className="ml-2 text-xs font-normal text-slate-600">
                    {step.count} {step.unit}
                  </span>
                )}
              </p>
              <p className="mt-1 max-w-prose text-sm text-slate-600">
                {step.description}
              </p>
            </div>
            {step.allowed ? (
              <Button
                variant={step === nextStep ? "default" : "outline"}
                asChild
                className="min-h-11 self-start sm:self-auto"
              >
                <Link href={step.href}>
                  {step.action}
                  <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <span className="text-xs text-slate-600 sm:shrink-0">
                Managed by your project administrator
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

type ProgressMetric = "total" | "completed" | "late";
function metricFilters(metric: ProgressMetric): TaskFilters {
  return metric === "completed"
    ? { status: "completed" }
    : metric === "late"
      ? { attention: "overdue" }
      : {};
}
function ProgressCounters({
  label,
  summary,
  onOpen,
}: {
  label: string;
  summary: ReturnType<typeof taskProgress>;
  onOpen: (metric: ProgressMetric) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {(
        [
          ["total", "TOTAL", summary.total],
          ["completed", "COMP", summary.completed],
          ["late", "LATE", summary.late],
        ] as const
      ).map(([metric, text, value]) => (
        <button
          key={metric}
          title={`${label}: ${value} ${metric === "total" ? "records, including N/A" : metric === "completed" ? "completed records" : "open records due before today"}. Open list.`}
          aria-label={`${label}: ${value} ${text}. View activities`}
          onClick={() => onOpen(metric)}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded px-1 text-xs hover:bg-slate-50 focus-visible:outline-blue-600 ${metric === "late" && value > 0 ? "text-red-700" : "text-slate-600"}`}
        >
          {text} <strong className="text-sm tabular-nums">{value}</strong>
        </button>
      ))}
      <button
        className="ml-auto inline-flex min-h-11 items-center gap-1 rounded px-1 text-sm font-semibold tabular-nums text-slate-900 hover:bg-slate-50 focus-visible:outline-blue-600"
        onClick={() => onOpen("completed")}
        aria-label={`${label}: ${summary.percent === null ? "no applicable tasks" : `${summary.percent}% completed`}. View completed activities`}
        title={`${summary.completed} completed / ${summary.applicable} applicable. ${summary.notApplicable} N/A excluded.`}
      >
        {summary.percent === null ? "—" : `${summary.percent}%`}
        <span className="text-xs font-normal text-slate-600">complete</span>
      </button>
    </div>
  );
}
