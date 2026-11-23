"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { commissioning, hasModule } from "@/lib/commissioning";
import type { Project } from "@/lib/domain";
import { canManage } from "@/lib/permissions";
import type { ProjectReportQuery } from "@/lib/project-reports";
import {
  canRequestDashboardView,
  dashboardViewCommandEvent,
  dashboardViewCommandResultEvent,
  dashboardViewCommandSchema,
  resolveDashboardViewCommand,
  type DashboardViewCommand,
  type DashboardViewRequest,
} from "@/lib/dashboard-view-context";
import {
  dashboardViewHref,
  dashboardViewFromParams,
  dashboardReportQuery,
  dashboardReportLabels,
} from "@/lib/dashboard-views";
import { useApp } from "../contexts/AppContext";
import { PersonalViewSettings } from "./ProjectViewSettings";
import { ProjectProgressCurve } from "./ProjectProgressCurve";
import { DashboardTagGraphics } from "./DashboardGraphics";
import { DashboardIssues } from "./DashboardIssues";
import {
  CommissioningReport,
  type ReportRequest,
  type ReportView,
} from "./CommissioningReport";
import { ProjectReportView } from "./ProjectReportView";
import { ReportReadinessPanel } from "./ReportReadinessPanel";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const legacy = new Set<string>([
  "tasks",
  "tags",
  "schedule",
  "handover",
  "conformance",
  "equipment",
  "trend",
]);
const viewKey = (view: DashboardViewRequest) =>
  view.kind === "progress"
    ? `progress:${view.comparison}`
    : view.kind === "report"
      ? `report:${view.report}`
      : view.kind;
const sameView = (a: DashboardViewRequest, b: DashboardViewRequest) =>
  JSON.stringify(a) === JSON.stringify(b);
const defaultView = { kind: "overview" } as const;

/** One mounted Dashboard canvas receives version-scoped display requests and acknowledges its own render. */
export function DashboardWorkspace({
  project,
  children,
  onOpen,
}: {
  project: Project;
  children: ReactNode;
  onOpen: (request: ReportRequest) => void;
}) {
  const { currentUser, tasks } = useApp();
  const params = useSearchParams();
  const state = commissioning(project),
    version = state.version;
  const canDashboard =
      canManage(currentUser) && hasModule(currentUser, "dashboard"),
    canReports = canManage(currentUser) && hasModule(currentUser, "reports");
  const search = params.toString();
  const parsed = useMemo(
    () => dashboardViewFromParams(new URLSearchParams(search), canDashboard),
    [search, canDashboard],
  );
  const view: DashboardViewRequest = parsed.success ? parsed.data : defaultView;
  const [pending, setPending] = useState<DashboardViewCommand | null>(null);
  const acknowledged = useRef("");
  const canvas = useRef<HTMLDivElement>(null);
  const navigate = (target: DashboardViewRequest) =>
    window.history.replaceState(
      null,
      "",
      dashboardViewHref(project.id, target),
    );
  useEffect(() => {
    const receive = (event: Event) => {
      const input = dashboardViewCommandSchema.safeParse(
        (event as CustomEvent).detail,
      );
      if (!input.success || input.data.projectId !== project.id) return;
      try {
        const requested = resolveDashboardViewCommand(input.data, {
          projectId: project.id,
          projectVersion: version,
        });
        const allowed = canRequestDashboardView(currentUser, requested);
        if (!allowed)
          throw Error("This Dashboard view is not available to your account.");
        setPending(input.data);
        window.history.replaceState(
          null,
          "",
          dashboardViewHref(project.id, requested),
        );
      } catch (error) {
        window.dispatchEvent(
          new CustomEvent(dashboardViewCommandResultEvent, {
            detail: {
              requestId: input.data.requestId,
              projectId: project.id,
              projectVersion: input.data.projectVersion,
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : "The Dashboard view could not change.",
            },
          }),
        );
      }
    };
    window.addEventListener(dashboardViewCommandEvent, receive);
    return () => window.removeEventListener(dashboardViewCommandEvent, receive);
  }, [project.id, version, currentUser]);
  useEffect(() => {
    if (
      !pending ||
      pending.requestId === acknowledged.current ||
      !parsed.success ||
      !sameView(view, pending.view)
    )
      return;
    acknowledged.current = pending.requestId;
    const ok =
      pending.projectId === project.id &&
      pending.projectVersion === version &&
      canRequestDashboardView(currentUser, view);
    window.dispatchEvent(
      new CustomEvent(dashboardViewCommandResultEvent, {
        detail: {
          requestId: pending.requestId,
          projectId: project.id,
          projectVersion: pending.projectVersion,
          ok,
          ...(!ok
            ? {
                error:
                  "The project or view access changed. Reopen the Dashboard.",
              }
            : {}),
        },
      }),
    );
    if (ok)
      canvas.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [pending, view, parsed.success, project.id, version, currentUser]);
  let content: ReactNode;
  if (!parsed.success || !canRequestDashboardView(currentUser, view))
    content = (
      <p role="alert" className="text-sm text-red-700">
        This view or its filters are not available. Choose another Dashboard
        view.
      </p>
    );
  else if (view.kind === "overview") content = children;
  else if (view.kind === "issues")
    content = <DashboardIssues key={project.id} projectId={project.id} />;
  else if (view.kind === "progress")
    content = (
      <ProjectProgressCurve
        key={`${project.id}:${view.comparison}`}
        projectId={project.id}
        version={version}
        initialComparison={view.comparison}
        hideComparisonPicker
        onComparisonChange={(comparison) =>
          navigate({ kind: "progress", comparison })
        }
      />
    );
  else if (view.kind === "readiness")
    content = <ReportReadinessPanel projectId={project.id} version={version} />;
  else if (view.kind === "vendor-progress") {
    const vendor = state.assets.find(
      (asset) =>
        asset.vendor?.trim().toLowerCase() === view.vendor.trim().toLowerCase(),
    )?.vendor;
    content = vendor ? (
      <DashboardTagGraphics
        project={project}
        tasks={tasks.filter((task) => task.projectId === project.id)}
        onOpen={onOpen}
        initialFilters={{ vendor }}
        initialGroupBy="vendor"
      />
    ) : (
      <p role="status" className="text-sm leading-6 text-slate-600">
        No equipment supplier named “{view.vendor}” is recorded in this project.
        Review the import or select a recorded supplier in the tag progress
        filters. This is missing supplier mapping, rather than zero progress.
      </p>
    );
  } else if (view.kind === "report" && legacy.has(view.report))
    content = (
      <CommissioningReport
        key={`${project.id}:${view.report}`}
        project={project}
        request={{
          view: view.report as ReportView,
          title: dashboardReportLabels[view.report],
        }}
      />
    );
  else {
    let query: ProjectReportQuery | undefined;
    try {
      query = dashboardReportQuery(
        new URLSearchParams(params.toString()),
        view,
      );
    } catch {
      /* Invalid filters are presented below, without changing them silently. */
    }
    content = query ? (
      <ProjectReportView
        key={`${project.id}:${query.report}`}
        projectId={project.id}
        initialQuery={query}
        externalQuery={query}
        hideReportPicker
        onQueryChange={(nextQuery) => {
          const target: DashboardViewRequest =
            view.kind === "lookahead"
              ? { kind: "lookahead", weeks: nextQuery.weeks ?? 2 }
              : view;
          const next = new URL(
            dashboardViewHref(project.id, target),
            window.location.origin,
          );
          for (const [key, value] of Object.entries(nextQuery))
            if (value !== undefined) next.searchParams.set(key, String(value));
          window.history.replaceState(null, "", next.pathname + next.search);
        }}
      />
    ) : (
      <p role="alert" className="text-sm text-red-700">
        Invalid report filters. Choose a view again to reset them.
      </p>
    );
  }
  const choices: {
    value: string;
    label: string;
    view: DashboardViewRequest;
  }[] = [
    ...(canDashboard
      ? [
          {
            value: "overview",
            label: "Overview",
            view: { kind: "overview" } as DashboardViewRequest,
          },
          {
            value: "progress:overall",
            label: "Project curves",
            view: {
              kind: "progress",
              comparison: "overall",
            } as DashboardViewRequest,
          },
          {
            value: "progress:current",
            label: "Original vs current",
            view: {
              kind: "progress",
              comparison: "current",
            } as DashboardViewRequest,
          },
          {
            value: "progress:critical",
            label: "Critical path · saved P6",
            view: {
              kind: "progress",
              comparison: "critical",
            } as DashboardViewRequest,
          },
        ]
      : []),
    ...(canReports
      ? [
          {
            value: "lookahead",
            label: "Schedule lookahead",
            view: { kind: "lookahead", weeks: 2 } as DashboardViewRequest,
          },
          ...Object.entries(dashboardReportLabels).map(([report, label]) => ({
            value: `report:${report}`,
            label,
            view: { kind: "report", report } as DashboardViewRequest,
          })),
        ]
      : []),
    ...(canRequestDashboardView(currentUser, { kind: "issues" })
      ? [
          {
            value: "issues",
            label: "Issues overview",
            view: { kind: "issues" } as const,
          },
        ]
      : []),
    ...(view.kind === "vendor-progress"
      ? [{ value: "vendor-progress", label: `Vendor: ${view.vendor}`, view }]
      : []),
    {
      value: "readiness",
      label: "Import & report data",
      view: { kind: "readiness" },
    },
  ];
  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Select
            value={parsed.success ? viewKey(view) : ""}
            onValueChange={(value) => {
              const choice = choices.find((item) => item.value === value);
              if (choice) navigate(choice.view);
            }}
          >
            <SelectTrigger
              aria-label="Dashboard view"
              className="w-60 max-w-full"
            >
              <SelectValue placeholder="Choose a view" />
            </SelectTrigger>
            <SelectContent>
              {choices.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {view.kind !== "readiness" && (
            <Button
              className="hidden sm:inline-flex"
              variant="ghost"
              onClick={() => navigate({ kind: "readiness" })}
            >
              Review import
            </Button>
          )}
        </div>
        {canDashboard && view.kind === "overview" && (
          <PersonalViewSettings project={project} />
        )}
      </div>
      <div
        key={pending?.requestId ?? "manual"}
        ref={canvas}
        className="min-w-0 scroll-mt-24"
        aria-label="Dashboard canvas"
        aria-live="polite"
      >
        {content}
      </div>
    </div>
  );
}
