"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  statusLabels,
  type Project,
  type Task,
  type TaskStatus,
} from "@/lib/domain";
import { commissioning, filterTasks, tagTimeline } from "@/lib/commissioning";
import { taskProgress } from "@/lib/dashboard-progress";
import type { ReportRequest } from "./CommissioningReport";
import { InfoPopover } from "./InfoPopover";
import { TagLevel } from "./TagLevel";
import {
  dashboardTags,
  type DashboardTagFilters,
  type DashboardTagGroupBy,
} from "@/lib/dashboard-tags";
import { MISSING_TAG_VALUE } from "@/lib/tag-progress";

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
          <h3 className="text-base font-semibold">Task progress</h3>
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

type TagGraphicsProps = {
  project: Project;
  tasks: Task[];
  onOpen: OpenReport;
  initialFilters?: DashboardTagFilters;
  initialGroupBy?: DashboardTagGroupBy;
};
export function DashboardTagGraphics(props: TagGraphicsProps) {
  return (
    <DashboardTagSession
      key={`${props.project.id}:${JSON.stringify(props.initialFilters ?? {})}`}
      {...props}
    />
  );
}
function DashboardTagSession({
  project,
  tasks,
  onOpen,
  initialFilters = {},
  initialGroupBy = "level",
}: TagGraphicsProps) {
  const [filters, setFilters] = useState<DashboardTagFilters>(initialFilters);
  const [groupBy, setGroupBy] = useState<DashboardTagGroupBy>(initialGroupBy);
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [showBlockers, setShowBlockers] = useState(true);
  const [showFigures, setShowFigures] = useState(false);
  const scoped = dashboardTags(project, tasks, filters, groupBy);
  const state = commissioning(project);
  const total = {
    completed: scoped.summary.approved,
    total: scoped.summary.total,
  };
  const timeline = tagTimeline(scoped.project, tasks);
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
      aria-label="Tag progress"
      className="overflow-hidden rounded-xl border bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <div className="flex items-center gap-1">
          <h3 className="text-base font-semibold">Tag progress</h3>
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
          onClick={() =>
            onOpen({
              title: "Matching asset tags",
              view: "tags",
              filters: { ...filters, applicableOnly: true },
            })
          }
        >
          View tag register{" "}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid gap-3 border-b bg-slate-50 px-4 py-3 sm:grid-cols-3 sm:px-5">
        <label className="min-w-0 text-xs font-medium text-slate-700">
          Group tags by
          <select
            className="field-select mt-1 w-full"
            value={groupBy}
            onChange={(event) => {
              setGroupBy(event.target.value as DashboardTagGroupBy);
              setShowAllGroups(false);
            }}
          >
            <option value="level">Tag level</option>
            <option value="vendor">Vendor</option>
            <option value="discipline">Discipline</option>
          </select>
        </label>
        <label className="min-w-0 text-xs font-medium text-slate-700">
          Vendor · equipment supplier
          <select
            className="field-select mt-1 w-full"
            value={filters.vendor ?? ""}
            onChange={(event) => {
              setFilters({
                ...filters,
                vendor: event.target.value || undefined,
              });
              setShowAllGroups(false);
            }}
          >
            <option value="">All vendors</option>
            {scoped.vendors.map((vendor) => (
              <option key={vendor} value={vendor}>
                {vendor}
              </option>
            ))}
            {scoped.missingVendor && (
              <option value={MISSING_TAG_VALUE}>Vendor not recorded</option>
            )}
          </select>
        </label>
        <label className="min-w-0 text-xs font-medium text-slate-700">
          Discipline
          <select
            className="field-select mt-1 w-full"
            value={filters.discipline ?? ""}
            onChange={(event) => {
              setFilters({
                ...filters,
                discipline: event.target.value || undefined,
              });
              setShowAllGroups(false);
            }}
          >
            <option value="">All disciplines</option>
            {scoped.disciplines.map((discipline) => (
              <option key={discipline} value={discipline}>
                {discipline}
              </option>
            ))}
            {scoped.missingDiscipline && (
              <option value={MISSING_TAG_VALUE}>Discipline not recorded</option>
            )}
          </select>
        </label>
      </div>
      <div className="grid divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <div className="min-w-0 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold">Approvals by level</h4>
            <span className="text-xs text-slate-600">
              {total.completed} / {total.total} approved
            </span>
          </div>
          <div className="space-y-4">
            {(showAllGroups ? scoped.groups : scoped.groups.slice(0, 5)).map(
              (group) => (
                <div key={group.key}>
                  {groupBy !== "level" && (
                    <h5 className="mb-1 break-words text-sm font-semibold">
                      {group.label}
                    </h5>
                  )}
                  {group.levels.map((level) => (
                    <button
                      key={level.level}
                      onClick={() =>
                        onOpen({
                          title: `${level.level} tag status`,
                          filters: {
                            ...group.filter,
                            level: level.level,
                            applicableOnly: true,
                          },
                          view: "tags",
                        })
                      }
                      aria-label={`${group.label}, ${level.level}: ${level.approved} of ${level.total} tags approved. View details`}
                      className="grid min-h-11 w-full grid-cols-[minmax(4rem,0.8fr)_minmax(0,1fr)_4.5rem] items-center gap-3 rounded text-left hover:bg-slate-50 focus-visible:outline-blue-700"
                    >
                      <span className="text-xs font-semibold">
                        <TagLevel
                          level={level.level}
                          presentation={state.config.phasePresentation}
                        />
                      </span>
                      <span
                        className="h-5 overflow-hidden rounded-sm bg-slate-100"
                        aria-hidden="true"
                      >
                        <span
                          className="block h-full rounded-sm border border-slate-400"
                          style={{
                            width: `${level.percent ?? 0}%`,
                            backgroundColor:
                              state.config.phasePresentation?.[level.level]
                                ?.color ?? "#64748b",
                          }}
                        />
                      </span>
                      <span className="text-right text-xs tabular-nums">
                        {level.percent}%
                        <span className="block text-slate-600">
                          {level.approved} / {level.total}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ),
            )}
            {!scoped.groups.length && (
              <p className="py-4 text-sm text-slate-600">
                No applicable tags match these filters.
              </p>
            )}
            {scoped.groups.length > 5 && (
              <button
                className="min-h-11 text-sm font-medium text-blue-700 hover:underline focus-visible:outline-blue-700"
                onClick={() => setShowAllGroups(!showAllGroups)}
              >
                {showAllGroups
                  ? "Show first 5 groups"
                  : `Show all ${scoped.groups.length} groups`}
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Each level is independent: L3 can progress while L2 is incomplete.
            Colours come from this project; unconfigured levels are grey.
            Approval is separate from task completion and passed test steps.
          </p>
        </div>
        <div className="min-w-0 p-4 sm:p-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h4 className="text-sm font-semibold">Approval schedule</h4>
            <button
              className="min-h-11 text-xs font-medium text-blue-700 hover:underline focus-visible:outline-blue-700"
              aria-expanded={showFigures}
              onClick={() => setShowFigures(!showFigures)}
            >
              {showFigures ? "Hide figures" : "View figures"}
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
          {showFigures && (
            <div
              className="mt-3 max-h-64 overflow-auto rounded border"
              tabIndex={0}
              aria-label="Matching tag schedule figures"
            >
              <table className="w-full text-left text-xs tabular-nums">
                <caption className="p-2 text-left text-slate-600">
                  Cumulative counts for the matching applicable tags.
                </caption>
                <thead>
                  <tr>
                    {["Date", "Baseline", "Forecast", "Approved"].map(
                      (heading) => (
                        <th key={heading} className="border-b p-2 font-medium">
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {timeline.points.map((point) => (
                    <tr key={point.date}>
                      <td className="whitespace-nowrap p-2">{point.date}</td>
                      <td className="p-2">{point.baseline}</td>
                      <td className="p-2">{point.forecast}</td>
                      <td className="p-2">{point.achieved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <div className="border-t px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Linked blockers</h4>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-blue-700"
              checked={showBlockers}
              onChange={(event) => setShowBlockers(event.target.checked)}
            />
            Show blocker records
          </label>
        </div>
        <p className="text-sm tabular-nums text-slate-700">
          {scoped.blockedTasks.length} blocked tasks ·{" "}
          {scoped.openIssues.length} open issues · {scoped.openWorks.length}{" "}
          open works
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Linked to matching assets with applicable tags. Categories can overlap
          and are counted separately; they do not change approval percentages.
        </p>
        {showBlockers && (
          <div className="mt-3 grid gap-x-6 gap-y-3 lg:grid-cols-3">
            <BlockerList
              title="Blocked tasks"
              records={scoped.blockedTasks.map((task) => ({
                id: task.id,
                title: task.title,
                href: `/tasks/${encodeURIComponent(task.id)}`,
              }))}
            />
            <BlockerList
              title="Open issues"
              records={scoped.openIssues.map((task) => ({
                id: task.id,
                title: task.title,
                href: `/tasks/${encodeURIComponent(task.id)}`,
              }))}
            />
            <BlockerList
              title="Open works"
              records={scoped.openWorks.map((work) => ({
                id: work.id,
                title: work.title,
                href: `/checksheets?projectId=${encodeURIComponent(project.id)}&work=${encodeURIComponent(work.id)}`,
              }))}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function BlockerList({
  title,
  records,
}: {
  title: string;
  records: { id: string; title: string; href: string }[];
}) {
  const [showAll, setShowAll] = useState(false);
  return (
    <div className="min-w-0">
      <h5 className="text-xs font-semibold text-slate-700">{title}</h5>
      {records.length ? (
        <ul className="mt-1 divide-y">
          {(showAll ? records : records.slice(0, 3)).map((record) => (
            <li key={record.id}>
              <Link
                href={record.href}
                className="flex min-h-11 items-center gap-2 break-words py-2 text-sm text-blue-700 underline underline-offset-4"
              >
                <span className="min-w-0 flex-1 break-words">
                  {record.title}
                </span>
                <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-2 text-sm text-slate-600">None recorded.</p>
      )}
      {records.length > 3 && (
        <button
          className="min-h-11 text-sm font-medium text-blue-700 hover:underline focus-visible:outline-blue-700"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Show first 3" : `Show all ${records.length}`}
        </button>
      )}
    </div>
  );
}
