"use client";

import { ArrowUpRight } from "lucide-react";
import {
  statusLabels,
  type Project,
  type Task,
  type TaskStatus,
} from "@/lib/domain";
import {
  commissioning,
  filterTasks,
  tagSummary,
  tagTimeline,
} from "@/lib/commissioning";
import { taskProgress } from "@/lib/dashboard-progress";
import type { ReportRequest } from "./CommissioningReport";
import { InfoPopover } from "./InfoPopover";

const statusSeries: { status: TaskStatus; color: string }[] = [
  { status: "completed", color: "#059669" },
  { status: "in-progress", color: "#2563eb" },
  { status: "review", color: "#7c3aed" },
  { status: "pending", color: "#d97706" },
  { status: "blocked", color: "#dc2626" },
  { status: "not-applicable", color: "#94a3b8" },
];
type OpenReport = (request: ReportRequest) => void;
const number = (value: number) => value.toLocaleString("en-GB");
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

export function DashboardTaskGraphics({
  project,
  tasks,
  onOpen,
}: {
  project: Project;
  tasks: Task[];
  onOpen: OpenReport;
}) {
  const summary = taskProgress(tasks);
  const state = commissioning(project);
  const series = statusSeries.map((entry) => ({
    ...entry,
    count: tasks.filter((task) => task.status === entry.status).length,
  }));
  const stages = state.config.levels.map((level) => ({
    level,
    summary: taskProgress(filterTasks(tasks, project, { level })),
    label: state.config.phasePresentation?.[level]?.label,
  }));
  const unstaged = tasks.filter(
    (task) => !task.cx?.level || !state.config.levels.includes(task.cx.level),
  ).length;
  return (
    <section
      aria-label="Project summary"
      className="overflow-hidden rounded-xl border bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 border-b px-4 py-2 sm:px-5 sm:py-3">
        <div className="flex items-center gap-1">
          <h3 className="text-base font-semibold">Project progress</h3>
          <InfoPopover label="How progress is counted">
            <p>
              Charts count saved tasks in this project. Completion excludes N/A.
              Late means open and due before today, using the saved schedule
              date or task deadline.
            </p>
            <p>
              Task completion and tag approval are separate. No Project Health
              rating has been calculated; its criteria have not been agreed.
            </p>
          </InfoPopover>
        </div>
        <p className="hidden text-xs text-slate-600 sm:block">
          Current project · saved tasks
        </p>
      </div>
      <div className="grid grid-cols-4 divide-x divide-slate-200 border-b">
        {[
          { label: "Total tasks", value: number(summary.total), filters: {} },
          {
            label: "Completed",
            value: number(summary.completed),
            filters: { status: "completed" },
          },
          {
            label: "Overdue",
            value: number(summary.late),
            filters: { attention: "overdue" },
            late: true,
          },
          {
            label: "Completion",
            value: summary.percent === null ? "—" : `${summary.percent}%`,
            filters: { status: "completed" },
          },
        ].map((metric) => (
          <button
            key={metric.label}
            onClick={() =>
              onOpen({
                view: "tasks",
                title: `${metric.label} · saved tasks`,
                filters: metric.filters,
              })
            }
            className="group flex min-h-20 items-center justify-between gap-2 px-2 py-3 sm:min-h-24 sm:py-4 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700 sm:px-5"
            aria-label={`${metric.label}: ${metric.value}. View tasks`}
          >
            <span>
              <span className="block text-xs font-medium text-slate-600">
                {metric.label}
              </span>
              <strong
                className={`mt-1 block text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums ${metric.late && summary.late ? "text-red-700" : "text-slate-950"}`}
              >
                {metric.value}
              </strong>
            </span>
            <ArrowUpRight
              aria-hidden="true"
              className="hidden size-4 shrink-0 text-slate-500 group-hover:text-blue-700 sm:block"
            />
          </button>
        ))}
      </div>
      <div className="grid divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <div className="min-w-0 p-4 sm:p-5">
          <div className="mb-3 sm:mb-5 flex items-baseline justify-between gap-3">
            <h4 className="text-sm font-semibold">Task status</h4>
            <span className="text-xs text-slate-600">
              {number(summary.total)} tasks
            </span>
          </div>
          <div
            className="flex h-6 sm:h-11 w-full gap-0.5 overflow-hidden rounded-md bg-slate-100"
            aria-hidden="true"
          >
            {series
              .filter((entry) => entry.count > 0)
              .map((entry) => (
                <div
                  key={entry.status}
                  style={{
                    width: `${(100 * entry.count) / summary.total}%`,
                    backgroundColor: entry.color,
                  }}
                />
              ))}
          </div>
          <div
            className="mt-3 grid grid-cols-3 gap-x-2 sm:grid-cols-2 sm:gap-x-5"
            role="group"
            aria-label="Tasks by status"
          >
            {series.map((entry) => (
              <button
                key={entry.status}
                onClick={() =>
                  onOpen({
                    view: "tasks",
                    title: statusLabels[entry.status],
                    filters: { status: entry.status },
                  })
                }
                className="group flex min-h-11 min-w-0 items-center gap-1.5 rounded text-left text-xs sm:text-sm hover:bg-slate-50 focus-visible:outline-blue-700"
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="min-w-0 flex-1 text-slate-600 group-hover:text-slate-950">
                  {statusLabels[entry.status]}
                </span>
                <strong className="tabular-nums">{number(entry.count)}</strong>
              </button>
            ))}
          </div>
          {!tasks.length && (
            <p className="mt-3 text-sm text-slate-600">
              Create or assign tasks to see the project’s work take shape.
            </p>
          )}
        </div>
        <div className="min-w-0 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold">Completion by stage</h4>
            <span className="text-xs text-slate-600">
              Completed / applicable tasks
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {stages
              .filter((stage) => stage.summary.total > 0)
              .map((stage) => (
                <button
                  key={stage.level}
                  onClick={() =>
                    onOpen({
                      view: "tasks",
                      title: `${stage.level} activities`,
                      filters: { level: stage.level },
                    })
                  }
                  className="group grid min-h-11 grid-cols-[2.5rem_minmax(0,1fr)_3rem] items-center gap-3 rounded py-1 text-left hover:bg-slate-50 focus-visible:outline-blue-700"
                  aria-label={`${stage.level}${stage.label ? ` · ${stage.label}` : ""}: ${stage.summary.completed} of ${stage.summary.applicable} tasks completed. ${stage.summary.notApplicable} not applicable. View activities`}
                >
                  <span className="text-xs font-semibold">{stage.level}</span>
                  <span
                    className="flex h-5 overflow-hidden rounded-sm bg-slate-100"
                    aria-hidden="true"
                  >
                    <span
                      className="h-full bg-blue-600 group-hover:bg-blue-700"
                      style={{ width: `${stage.summary.percent ?? 0}%` }}
                    />
                  </span>
                  <span className="text-right text-xs font-semibold tabular-nums">
                    {stage.summary.percent === null
                      ? "—"
                      : `${stage.summary.percent}%`}
                  </span>
                </button>
              ))}
            {!stages.some((stage) => stage.summary.total > 0) && (
              <p className="py-4 text-sm text-slate-600">
                No tasks have a configured stage yet. Assign a stage to compare
                progress here.
              </p>
            )}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            {number(unstaged)} tasks without a configured stage ·{" "}
            {number(summary.notApplicable)} N/A excluded from completion.
          </p>
        </div>
      </div>
      <p className="border-t bg-slate-50 px-5 py-3 text-xs leading-5 text-slate-600">
        {state.sourceProgrammeSummary
          ? `${number(state.sourceProgrammeSummary.activities)} imported source activities · `
          : ""}
        {number(state.schedule.length)} managed activities ·{" "}
        {number(state.assets.length)} assets. Schedule activities are separate
        from task counts.
      </p>
    </section>
  );
}

export function DashboardTagGraphics({
  project,
  tasks,
  onOpen,
}: {
  project: Project;
  tasks: Task[];
  onOpen: OpenReport;
}) {
  const state = commissioning(project);
  const total = tagSummary(project, tasks);
  const timeline = tagTimeline(project, tasks);
  const first = timeline.points[0],
    last = timeline.points.at(-1);
  const days =
    first && last ? Date.parse(last.date) - Date.parse(first.date) : 0;
  const chart = { left: 38, right: 572, top: 18, bottom: 176 };
  const max = Math.max(timeline.total, 1);
  const x = (date: string) =>
    chart.left +
    (days ? (Date.parse(date) - Date.parse(first.date)) / days : 0) *
      (chart.right - chart.left);
  const y = (value: number) =>
    chart.bottom - (value / max) * (chart.bottom - chart.top);
  return (
    <section
      aria-label="Tag approval graphics"
      className="overflow-hidden rounded-xl border bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <div className="flex items-center gap-1">
          <h3 className="text-base font-semibold">Tag approvals</h3>
          <InfoPopover label="About tag approval charts">
            <p>
              Approved / applicable asset-level tags, including tags with no
              task yet. Explicit approval takes precedence; legacy completed
              workflows count only when no review status is recorded. Test
              progress is separate.
            </p>
            <p>
              The trend uses saved baseline and forecast dates. Approvals
              without a recorded completion date are not plotted. Missing dates
              are not treated as zero.
            </p>
          </InfoPopover>
        </div>
        <button
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue-700 hover:underline focus-visible:outline-blue-700"
          onClick={() => onOpen({ title: "Asset tag register", view: "tags" })}
        >
          View tag register{" "}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <div className="min-w-0 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold">Approvals by level</h4>
            <span className="text-xs text-slate-600">
              {total.completed} / {total.total} approved
            </span>
          </div>
          <div className="space-y-1">
            {state.config.levels
              .map((level) => ({ level, ...tagSummary(project, tasks, level) }))
              .filter((level) => level.total > 0)
              .map((level) => (
                <button
                  key={level.level}
                  onClick={() =>
                    onOpen({
                      title: `${level.level} tag status`,
                      filters: { level: level.level },
                      view: "tags",
                    })
                  }
                  aria-label={`${level.level}: ${level.completed} of ${level.total} tags approved. View details`}
                  className="grid min-h-11 w-full grid-cols-[2.5rem_minmax(0,1fr)_4rem] items-center gap-3 rounded text-left hover:bg-slate-50 focus-visible:outline-blue-700"
                >
                  <span className="text-xs font-semibold">{level.level}</span>
                  <span
                    className="h-5 overflow-hidden rounded-sm bg-slate-100"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full bg-emerald-600"
                      style={{ width: `${level.percent ?? 0}%` }}
                    />
                  </span>
                  <span className="text-right text-xs tabular-nums">
                    {level.completed} / {level.total}
                  </span>
                </button>
              ))}
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Approval is separate from task completion and passed test steps.
          </p>
        </div>
        <div className="min-w-0 p-4 sm:p-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h4 className="text-sm font-semibold">Approval schedule</h4>
            <button
              className="min-h-11 text-xs font-medium text-blue-700 hover:underline focus-visible:outline-blue-700"
              onClick={() =>
                onOpen({ title: "Tag schedule trend", view: "trend" })
              }
            >
              View figures
            </button>
          </div>
          {timeline.points.length > 1 ? (
            <>
              <div className="flex h-36 items-stretch sm:h-44">
                <div
                  aria-hidden="true"
                  className="flex w-9 shrink-0 flex-col justify-between pr-2 text-right text-xs tabular-nums text-slate-600"
                >
                  <span>{timeline.total}</span>
                  <span>{Math.round(timeline.total / 2)}</span>
                  <span>0</span>
                </div>
                <svg
                  role="img"
                  aria-label={`Cumulative tag schedule. ${timeline.baselineRecorded} tags have baseline dates; ${timeline.scheduled} have forecast dates. ${last?.achieved ?? 0} dated approvals. From ${first.date} to ${last!.date}. Open View figures for the complete data.`}
                  viewBox="38 18 534 158"
                  preserveAspectRatio="none"
                  className="block h-full min-w-0 flex-1"
                >
                  {[0, 0.5, 1].map((fraction) => (
                    <g key={fraction}>
                      <line
                        x1={chart.left}
                        x2={chart.right}
                        y1={y(fraction * max)}
                        y2={y(fraction * max)}
                        stroke="#e2e8f0"
                        strokeDasharray={fraction ? "3 4" : undefined}
                      />
                    </g>
                  ))}
                  {(
                    [
                      ["baseline", "#64748b", timeline.baselineRecorded > 0],
                      ["forecast", "#2563eb", timeline.scheduled > 0],
                      ["achieved", "#059669", (last?.achieved ?? 0) > 0],
                    ] as const
                  )
                    .filter(([, , exists]) => exists)
                    .map(([key, color]) => (
                      <polyline
                        key={key}
                        fill="none"
                        stroke={color}
                        strokeWidth="2.5"
                        strokeDasharray={key === "baseline" ? "6 4" : undefined}
                        points={timeline.points
                          .map((point) => `${x(point.date)},${y(point[key])}`)
                          .join(" ")}
                      />
                    ))}
                </svg>
              </div>
              <div className="mb-3 mt-2 flex justify-between gap-3 pl-9 text-xs tabular-nums text-slate-600">
                <span>{dateLabel(first.date)}</span>
                <span>{dateLabel(last!.date)}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="w-4 border-t-2 border-dashed border-slate-500"
                  />
                  Baseline
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="w-4 border-t-2 border-blue-600"
                  />
                  Forecast
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="w-4 border-t-2 border-emerald-600"
                  />
                  Approved
                </span>
              </div>
            </>
          ) : (
            <p className="flex min-h-40 items-center text-sm leading-6 text-slate-600">
              Link tags to dated schedule activities to compare baseline,
              forecast and approvals.
            </p>
          )}
          <p className="mt-3 text-xs leading-5 text-slate-600">
            {timeline.scheduled} / {timeline.total} tags have forecast dates ·{" "}
            {timeline.baselineRecorded} have baselines.
            {!last?.achieved && " No dated approvals to plot."}
          </p>
        </div>
      </div>
    </section>
  );
}
