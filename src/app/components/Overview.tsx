"use client";
import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, AlertTriangle, ChevronDown } from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { AppShell } from "./AppShell";
import { Button } from "./ui/button";
import { isClosed, isOverdue, projectDate, type Project } from "@/lib/domain";
import {
  commissioning,
  dueDateFor,
  tagSummary,
  taskKind,
  hasModule,
} from "@/lib/commissioning";
import {
  CommissioningReport,
  ReportDialog,
  type ReportRequest,
  type ReportView,
} from "./CommissioningReport";
import { TagProgressMatrix } from "./TagProgressMatrix";
import { WorksToGoOverview } from "./WorksToGoWorkspace";
import { taskProgress } from "@/lib/dashboard-progress";
import { filterTasks, type TaskFilters } from "@/lib/commissioning";

import { ProjectReportView } from "./ProjectReportView";
import { reportQuerySchema } from "@/lib/project-reports";
import {
  DashboardPanel,
  DashboardLayout,
  PersonalViewSettings,
  useProjectView,
} from "./ProjectViewSettings";
import { useLinkedProject } from "./useLinkedProject";
import { DashboardLookahead } from "./DashboardLookahead";
import {
  DashboardTaskGraphics,
  DashboardTagGraphics,
} from "./DashboardGraphics";

function OverviewDetails({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-sm font-semibold focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-slate-600 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="mt-3 space-y-4">{children}</div>
    </details>
  );
}
export function Overview() {
  const router = useRouter();
  const data = useApp();
  const params = useSearchParams();
  const linked = useLinkedProject();
  const project = linked.project;
  const preferences = useProjectView(project);
  const canDashboard = hasModule(data.currentUser, "dashboard");
  const canReports = hasModule(data.currentUser, "reports");
  const reportsTab =
    canReports && (params.get("tab") === "reports" || !canDashboard);
  const [report, setReport] = useState<ReportRequest | null>(null);
  if (!project || linked.unavailable || linked.opening)
    return (
      <AppShell title="Dashboard">
        <p className="text-sm text-slate-600">
          {linked.unavailable
            ? "This project is not available to your account."
            : linked.opening
              ? "Opening the linked project…"
              : "No project access yet. Ask your administrator to add you to the project team."}
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
  const open = (
    title: string,
    filters: ReportRequest["filters"] = {},
    view: ReportRequest["view"] = "tasks",
  ) => setReport({ title, filters, view });
  const hasTags = tags.total > 0;
  const canPlan = hasModule(data.currentUser, "commissioning");
  if (reportsTab)
    return (
      <AppShell title="Dashboard" wide>
        <DashboardNavigation
          projectId={project.id}
          reports
          canDashboard={canDashboard}
          canReports={canReports}
        />
        <DashboardReports project={project} />
      </AppShell>
    );
  return (
    <AppShell title="Dashboard" wide>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <DashboardNavigation
          projectId={project.id}
          reports={false}
          canDashboard={canDashboard}
          canReports={canReports}
        />
        <PersonalViewSettings project={project} />
      </div>
      <DashboardLayout panels={preferences.value.dashboardPanels}>
        <div className="order-[-1] flex justify-between items-center gap-3">
          <div>
            <h2 className="text-xl font-semibold">Project overview</h2>
            <p className="hidden sm:block text-sm text-slate-600 mt-1">
              {project.location} · As of {projectDate()} · Schedule revision{" "}
              {state.version}
            </p>
            <p className="mt-1 text-xs text-slate-600 sm:hidden">
              As of {projectDate().split("-").reverse().join("/")} · Revision{" "}
              {state.version}
            </p>
          </div>
          {canPlan && (
            <Button asChild className="min-h-11">
              <Link href="/schedule" aria-label="Open schedule">
                <span className="hidden sm:inline">Open schedule</span>{" "}
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>
        <DashboardPanel id="summary" panels={preferences.value.dashboardPanels}>
          <DashboardTaskGraphics
            project={project}
            tasks={tasks}
            onOpen={setReport}
          />
        </DashboardPanel>
        <DashboardPanel id="reports" panels={preferences.value.dashboardPanels}>
          <section
            aria-label="Management reports"
            className="border-y border-slate-200 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Reports</h2>
              {hasModule(data.currentUser, "reports") && (
                <Link
                  href={`/overview?tab=reports&projectId=${encodeURIComponent(project.id)}&report=tagging`}
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue-700 hover:underline focus-visible:outline-blue-600"
                >
                  Open reports <ArrowUpRight className="size-4" />
                </Link>
              )}
            </div>
            {hasModule(data.currentUser, "reports") && (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {(
                  [
                    ["tagging", "Tagging step progress"],
                    ["works-to-go", "Works to go"],
                    ["lookahead", "Next 14 days"],
                    ["vendors", "Equipment suppliers needed"],
                  ] as const
                ).map(([kind, label]) => (
                  <Link
                    key={kind}
                    href={`/overview?tab=reports&projectId=${encodeURIComponent(project.id)}&report=${kind}`}
                    className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue-700 underline underline-offset-4"
                  >
                    {label}
                    <ArrowUpRight className="size-4" />
                  </Link>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {[
                [
                  "Tag approvals",
                  "tags",
                  `${tags.completed} / ${tags.total} approved`,
                ],
                ["Equipment", "equipment", `${state.assets.length} assets`],
                [
                  "Schedule",
                  "schedule",
                  `${state.schedule.length} managed activities`,
                ],
                ["O&M, training & sign-off", "handover", ""],
                ["Checklist conformance", "conformance", ""],
              ].map(([title, view, detail]) => (
                <button
                  key={view}
                  onClick={() => open(title, {}, view as ReportRequest["view"])}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-left text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <span>
                    {title}
                    {detail && (
                      <span className="ml-2 font-normal text-slate-600 tabular-nums">
                        {detail}
                      </span>
                    )}
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                </button>
              ))}
            </div>
          </section>
        </DashboardPanel>
        <DashboardPanel id="works" panels={preferences.value.dashboardPanels}>
          {canPlan && (
            <WorksToGoOverview
              state={state.checksheets}
              onOpen={() => router.push("/checksheets")}
            />
          )}
        </DashboardPanel>
        <DashboardPanel
          id="attention"
          panels={preferences.value.dashboardPanels}
        >
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            {canReports && (
              <DashboardLookahead
                key={`${project.id}:${state.version}:${projectDate()}`}
                projectId={project.id}
              />
            )}
            {tasks.length > 0 && (
              <section
                aria-label="Work needing attention"
                className="rounded-xl border bg-white p-4 sm:p-5"
              >
                <h3 className="text-base font-semibold">Needs attention</h3>
                <div className="mt-3 divide-y">
                  {[
                    {
                      label: "Overdue activities",
                      count: overdue.length,
                      caption: "Open overdue list",
                      color: "text-red-600",
                      filters: { attention: "overdue" },
                    },
                    {
                      label: "Blockers",
                      count: blocked.length,
                      caption: "Require action to proceed",
                      color: "text-amber-700",
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
                      label: "Need assignment",
                      count: tasks.filter((t) => !t.assignedTo && !isClosed(t))
                        .length,
                      caption: "Open activities without an assignee",
                      color: "text-slate-900",
                      filters: { attention: "unassigned" },
                    },
                  ].map((metric) => {
                    const content = (
                      <>
                        <span className="flex items-center justify-between gap-3 text-sm">
                          <span>{metric.label}</span>
                          <strong
                            className={`text-lg tabular-nums ${metric.count > 0 ? metric.color : "text-slate-600"}`}
                          >
                            {metric.count}
                          </strong>
                        </span>
                        <span className="mt-1 block text-xs text-slate-600">
                          {metric.caption}
                        </span>
                      </>
                    );
                    const className =
                      "block w-full min-h-11 rounded-lg px-2 py-4 text-left hover:bg-slate-50 focus-visible:outline-blue-600";
                    return metric.label === "Overdue activities" ? (
                      <Link
                        key={metric.label}
                        href="/schedule?view=overdue"
                        className={className}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        key={metric.label}
                        className={className}
                        onClick={() =>
                          open(
                            metric.label === "Need assignment"
                              ? "Activities needing assignment"
                              : metric.label,
                            metric.filters,
                          )
                        }
                      >
                        {content}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
          {blocked.length > 0 && (
            <OverviewDetails
              title={`Blockers and risks · ${blocked.length} activities`}
            >
              <section className="rounded-xl border bg-white p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <AlertTriangle className="size-4 text-amber-500" />
                    Blockers & risks
                  </h3>
                  <button
                    className="min-h-11 text-xs text-blue-700 focus-visible:outline-blue-600"
                    onClick={() =>
                      open("Blockers and impact", { attention: "blocked" })
                    }
                  >
                    Open report
                  </button>
                </div>
                <div className="grid gap-x-6 sm:grid-cols-2">
                  {blocked.slice(0, 4).map((t) => (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      className="rounded-lg px-2 py-3 hover:bg-slate-50 focus-visible:outline-blue-600"
                    >
                      <p className="font-medium text-sm">{t.title}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {t.cx?.blockerRisk || t.notes || "Impact not recorded"}
                      </p>
                      <p className="text-xs text-slate-600 mt-2">
                        {t.cx?.assetId ?? "Asset unlinked"} ·{" "}
                        {data.users.find((u) => u.id === t.assignedTo)?.name ??
                          "Unassigned"}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            </OverviewDetails>
          )}
        </DashboardPanel>
        <DashboardPanel id="tags" panels={preferences.value.dashboardPanels}>
          {hasTags && (
            <DashboardTagGraphics
              project={project}
              tasks={tasks}
              onOpen={setReport}
            />
          )}
        </DashboardPanel>
        <DashboardPanel id="details" panels={preferences.value.dashboardPanels}>
          {(hasTags ||
            tasks.some((task) => task.cx?.level) ||
            construction.length > 0) && (
            <OverviewDetails title="Schedule and construction progress">
              {(hasTags || tasks.some((task) => task.cx?.level)) && (
                <section
                  aria-label="Schedule overview"
                  className="rounded-xl border bg-white p-5"
                >
                  <h3 className="text-base font-semibold">Schedule overview</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Task completion by recorded commissioning stage. Tag
                    approval is shown separately above.
                  </p>
                  <div className="mt-4 divide-y">
                    {state.config.levels
                      .filter(
                        (level) =>
                          tasks.some((task) => task.cx?.level === level) ||
                          tagSummary(project, tasks, level).total > 0,
                      )
                      .map((level) => {
                        const presentation =
                          state.config.phasePresentation?.[level];
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
                              onClick={() =>
                                open(`${label} activities`, filters)
                              }
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
                                  backgroundColor:
                                    presentation?.color ?? "#2563eb",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  <p className="mt-3 text-xs text-slate-600">
                    TOTAL includes N/A; completion % excludes N/A. Only saved
                    tasks with an explicit stage are counted; missing tag
                    records are not tasks.{" "}
                    {
                      tasks.filter(
                        (task) =>
                          !task.cx?.level ||
                          !state.config.levels.includes(task.cx.level),
                      ).length
                    }{" "}
                    activities have no enabled stage. No Energisation Gate or
                    IST mapping is inferred.
                  </p>
                </section>
              )}
              {construction.length > 0 && (
                <section className="rounded-xl border bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">
                        Construction / general work
                      </h3>
                      <p className="mt-1 max-w-prose text-xs text-slate-600">
                        Activities classified as Task, excluding tags, issues
                        and documentation. Completion is separate from tag
                        approval.
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
                      {construction.length - applicableConstruction.length} N/A
                      excluded
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
            </OverviewDetails>
          )}
          {hasTags && (
            <OverviewDetails title="Tag progress by asset and equipment">
              <TagProgressMatrix
                key={`${project.id}-all`}
                project={project}
                tasks={tasks}
                onOpen={setReport}
              />
              {state.assets.some((asset) => asset.clientSupplied === true) && (
                <TagProgressMatrix
                  key={`${project.id}-client`}
                  project={project}
                  tasks={tasks}
                  clientSupplied
                  onOpen={setReport}
                />
              )}
            </OverviewDetails>
          )}
          {issues.length > 0 && (
            <OverviewDetails
              title={`Issues by priority · ${issues.length} issues`}
            >
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
                  Completion counts completed issues, excluding N/A. Late uses
                  the recorded schedule date or task deadline.{" "}
                  {issues.filter((task) => !task.priority).length} issues have
                  no priority and remain in the issue register. No stage is
                  inferred from priority.
                </p>
              </section>
            </OverviewDetails>
          )}
        </DashboardPanel>
      </DashboardLayout>
      <ReportDialog
        key={project.id}
        project={project}
        request={report}
        onClose={() => setReport(null)}
      />
    </AppShell>
  );
}

function DashboardNavigation({
  projectId,
  reports,
  canDashboard,
  canReports,
}: {
  projectId: string;
  reports: boolean;
  canDashboard: boolean;
  canReports: boolean;
}) {
  return (
    <nav aria-label="Dashboard views" className="flex flex-wrap gap-1 border-b">
      {canDashboard && (
        <Link
          className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium ${!reports ? "border-blue-600 text-blue-800" : "border-transparent text-slate-600"}`}
          aria-current={!reports ? "page" : undefined}
          href={`/overview?projectId=${encodeURIComponent(projectId)}`}
        >
          Dashboard
        </Link>
      )}
      {canReports && (
        <Link
          className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium ${reports ? "border-blue-600 text-blue-800" : "border-transparent text-slate-600"}`}
          aria-current={reports ? "page" : undefined}
          href={`/overview?projectId=${encodeURIComponent(projectId)}&tab=reports`}
        >
          Reports
        </Link>
      )}
    </nav>
  );
}
function DashboardReports({ project }: { project: Project }) {
  const params = useSearchParams();
  const legacy = params.get("view");
  const legacyViews: ReportView[] = [
    "tasks",
    "tags",
    "schedule",
    "handover",
    "conformance",
    "equipment",
    "trend",
  ];
  const query = reportQuerySchema.safeParse(
    Object.fromEntries(
      Array.from(params.entries()).filter(
        ([key]) => key in reportQuerySchema.shape,
      ),
    ),
  );
  return (
    <div className="min-w-0 space-y-4">
      <nav aria-label="Report collections" className="flex flex-wrap gap-x-4">
        <Link
          className="inline-flex min-h-11 items-center text-sm text-blue-800 underline"
          href={`/overview?tab=reports&projectId=${encodeURIComponent(project.id)}`}
        >
          Project reports
        </Link>
        {legacyViews.map((view) => (
          <Link
            key={view}
            className="inline-flex min-h-11 items-center text-sm text-blue-800 underline"
            href={`/overview?tab=reports&projectId=${encodeURIComponent(project.id)}&view=${view}`}
          >
            {view === "tags"
              ? "Tag approvals"
              : view.charAt(0).toUpperCase() + view.slice(1)}
          </Link>
        ))}
      </nav>
      {legacy ? (
        legacyViews.includes(legacy as ReportView) ? (
          <CommissioningReport
            key={`${project.id}:${legacy}`}
            project={project}
            request={{ view: legacy as ReportView, title: "Project report" }}
          />
        ) : (
          <p role="alert">Unknown report view. Choose a report above.</p>
        )
      ) : query.success ? (
        <ProjectReportView
          key={`${project.id}:${JSON.stringify(query.data)}`}
          projectId={project.id}
          initialQuery={query.data}
        />
      ) : (
        <p role="alert">
          Invalid report filters. Choose a report above to reset them.
        </p>
      )}
    </div>
  );
}

export function ProjectGettingStarted({
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
      title: "Schedule",
      description:
        "The dates, durations and dependencies that sequence the work.",
      href: "/schedule",
      action:
        (state.sourceProgrammeSummary?.activities ?? state.schedule.length)
          ? "Open schedule"
          : "Plan activities",
      count: state.sourceProgrammeSummary?.activities ?? state.schedule.length,
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
          Start with the equipment, plan the schedule, then assign work to your
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
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
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
          className={`inline-flex min-h-11 items-center gap-1 rounded px-1 text-xs sm:text-sm hover:bg-slate-50 focus-visible:outline-blue-600 ${metric === "late" && value > 0 ? "text-red-700" : "text-slate-600"}`}
        >
          {text} <strong className="text-base tabular-nums">{value}</strong>
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
