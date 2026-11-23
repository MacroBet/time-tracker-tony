"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Curve } from "recharts";
import { apiRequest } from "@/lib/api-client";
import { hasModule } from "@/lib/commissioning";
import type { ProjectProgress } from "@/lib/project-progress";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";
import { InfoPopover } from "./InfoPopover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const percent = (value: number | null) =>
  value === null ? "Unavailable" : `${Number(value.toFixed(1))}%`;
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

/** The aggregate is authorized and computed from the complete Schedule on the server. */
export function ProjectProgressCurve({
  projectId,
  version,
  initialComparison = "overall",
  onComparisonChange,
  hideComparisonPicker = false,
}: {
  projectId: string;
  version: number;
  initialComparison?: "overall" | "current" | "critical";
  onComparisonChange?: (comparison: "overall" | "current" | "critical") => void;
  hideComparisonPicker?: boolean;
}) {
  const { currentUser, memberships } = useApp();
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<{
    key: string;
    result?: ProjectProgress;
    error?: string;
  } | null>(null);
  const access = JSON.stringify([
    currentUser.id,
    currentUser.role,
    currentUser.modules,
    memberships
      .filter((member) => member.userId === currentUser.id)
      .map((member) => member.projectId)
      .sort(),
  ]);
  const key = `${projectId}:${version}:${access}:${retry}`;
  const loaded = response?.key === key ? response : null;
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<ProjectProgress>(
      `/api/projects/${encodeURIComponent(projectId)}/progress`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) setResponse({ key, result });
      })
      .catch((problem: unknown) => {
        if (!controller.signal.aborted)
          setResponse({
            key,
            error:
              problem instanceof Error
                ? problem.message
                : "The project curve could not load.",
          });
      });
    return () => controller.abort();
  }, [projectId, key]);
  const result = loaded?.result;
  return (
    <section
      aria-label="Overall project progress"
      className="order-[-1] min-w-0 rounded-xl border bg-white"
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <h3 className="text-lg font-semibold">Project progress</h3>
            <InfoPopover label="How project progress is calculated">
              <ProgressInformation result={result} />
            </InfoPopover>
          </div>
        </div>
        {hasModule(currentUser, "commissioning") && (
          <Link
            href={`/schedule?projectId=${encodeURIComponent(projectId)}`}
            aria-label="View Schedule"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 text-sm font-medium text-blue-700 hover:underline focus-visible:outline-blue-700"
          >
            <span className="hidden sm:inline">View Schedule</span>
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="p-4 sm:p-5">
        {!loaded ? (
          <div
            role="status"
            className="flex h-64 items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-600"
          >
            Loading overall project progress…
          </div>
        ) : loaded.error ? (
          <div role="alert" className="space-y-3 py-8 text-sm">
            <p className="text-red-700">
              {loaded.error} The curve is unavailable.
            </p>
            <Button
              variant="outline"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry project progress
            </Button>
          </div>
        ) : result?.sourceUnavailable ? (
          <p role="alert" className="py-8 text-sm text-amber-950">
            The source Schedule is unavailable. Overall progress cannot be
            calculated from a partial population. Refresh the project and try
            again.
          </p>
        ) : result && result.total > 0 ? (
          initialComparison === "critical" && !result.criticalPath ? (
            <p role="status" className="py-8 text-sm leading-6 text-slate-600">
              No saved P6 critical activities are available. Review the import
              to check the classification and coverage; a current critical path
              has not been calculated.
            </p>
          ) : (
            <ProgressPlot
              result={result}
              initialComparison={initialComparison}
              onComparisonChange={onComparisonChange}
              hideComparisonPicker={hideComparisonPicker}
              key={`${key}:${result.asOf}:${initialComparison}`}
            />
          )
        ) : (
          <p className="py-8 text-sm leading-6 text-slate-600">
            No Schedule activities are recorded yet. Add the project programme
            and planned dates to compare planned and actual completion here.
          </p>
        )}
      </div>
    </section>
  );
}

type CurveView = "overall" | "current" | "critical";
type CurveField = "planned" | "actual" | "current";

function ProgressPlot({
  result,
  initialComparison,
  onComparisonChange,
  hideComparisonPicker,
}: {
  result: ProjectProgress;
  initialComparison: CurveView;
  onComparisonChange?: (comparison: CurveView) => void;
  hideComparisonPicker: boolean;
}) {
  const inspectionHelpId = useId();
  const [view, setView] = useState<CurveView>(initialComparison);
  const [selected, setSelected] = useState<number | null>(null);
  const series = view === "critical" ? result.criticalPath!.series : result;
  const points = series.points;
  const asOfIndex = Math.max(
    0,
    points.findIndex((point) => point.date === result.asOf),
  );
  const point = points[selected ?? asOfIndex];
  const first = points[0],
    last = points.at(-1);
  const start = first ? Date.parse(first.date) : 0;
  const span = last ? Date.parse(last.date) - start : 0;
  const x = (date: string) =>
    span ? ((Date.parse(date) - start) / span) * 1000 : 0;
  const y = (value: number) => 200 - value * 2;
  const fields: {
    field: CurveField;
    label: string;
    color: string;
    dashed?: boolean;
    partial: boolean;
  }[] = [
    {
      field: "planned",
      label: view === "overall" ? "Planned" : "Original",
      color: "#2563eb",
      dashed: true,
      partial: series.plannedRecorded < series.total,
    },
    view === "current"
      ? {
          field: "current",
          label: "Current",
          color: "#7e22ce",
          partial: series.currentRecorded < series.total,
        }
      : {
          field: "actual",
          label: "Actual",
          color: "#047857",
          partial: series.actualCoveragePartial || series.futureActualDates > 0,
        },
  ];
  const figures = (item: typeof point) =>
    fields
      .map(
        ({ field, label, partial }) =>
          `${label}${partial ? " (partial)" : ""} ${field === "actual" && item.date > result.asOf ? "future" : percent(item[field])}`,
      )
      .join("; ");
  const inspect = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const target = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left) / bounds.width),
    );
    const at = start + target * span;
    let nearest = 0;
    for (let i = 1; i < points.length; i++)
      if (
        Math.abs(Date.parse(points[i].date) - at) <
        Math.abs(Date.parse(points[nearest].date) - at)
      )
        nearest = i;
    setSelected(nearest);
  };
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
        {!hideComparisonPicker && (
          <Select
            value={view}
            onValueChange={(value) => {
              setView(value as CurveView);
              setSelected(null);
              onComparisonChange?.(value as CurveView);
            }}
          >
            <SelectTrigger
              aria-label="Progress curve comparison"
              className="w-56"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overall">Overall</SelectItem>
              <SelectItem value="current" disabled={!result.currentRecorded}>
                Original vs current
              </SelectItem>
              <SelectItem
                value="critical"
                disabled={!result.criticalPath?.series.total}
              >
                Critical path · saved P6
              </SelectItem>
            </SelectContent>
          </Select>
        )}
        <div
          className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs tabular-nums text-slate-700"
          aria-live="off"
        >
          {fields.map(({ field, label, color, dashed, partial }) => (
            <span key={field} className="flex items-center gap-2">
              <svg aria-hidden="true" width="20" height="8">
                <line
                  x1="0"
                  x2="20"
                  y1="4"
                  y2="4"
                  stroke={color}
                  strokeWidth="2.5"
                  strokeDasharray={dashed ? "5 3" : undefined}
                />
              </svg>
              <span>
                {label}
                {partial ? " · partial" : ""}{" "}
                <strong className="font-semibold">
                  {point && field === "actual" && point.date > result.asOf
                    ? "Future"
                    : percent(point?.[field] ?? null)}
                </strong>
              </span>
            </span>
          ))}
          <span>{dateLabel(point?.date ?? result.asOf)}</span>
        </div>
      </div>
      {points.length > 1 ? (
        <>
          <div className="flex h-56 sm:h-72">
            <div
              aria-hidden="true"
              className="flex w-10 shrink-0 flex-col justify-between pr-2 text-right text-xs tabular-nums text-slate-600"
            >
              {[100, 50, 0].map((value) => (
                <span key={value}>{value}%</span>
              ))}
            </div>
            <p id={inspectionHelpId} className="sr-only">
              Use Left and Right arrows to inspect dates, Home for the first
              date and End for the last. Touch or point at the curve to inspect.
              Values use recorded dates; lines are smoothed between samples.
            </p>
            <svg
              role="slider"
              tabIndex={0}
              aria-label={
                view === "critical"
                  ? "Inspect saved P6 critical activity curves"
                  : "Inspect project progress curves"
              }
              aria-describedby={inspectionHelpId}
              aria-valuemin={0}
              aria-valuemax={points.length - 1}
              aria-valuenow={selected ?? asOfIndex}
              aria-valuetext={
                point
                  ? `${dateLabel(point.date)}; ${figures(point)}`
                  : "No dated points"
              }
              aria-orientation="horizontal"
              viewBox="0 -4 1000 208"
              preserveAspectRatio="none"
              className="h-full min-w-0 flex-1 cursor-crosshair touch-pan-y rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
              onPointerMove={inspect}
              onPointerDown={(event) => {
                event.currentTarget.focus({ preventScroll: true });
                inspect(event);
              }}
              onPointerLeave={(event) => {
                if (document.activeElement !== event.currentTarget)
                  setSelected(null);
              }}
              onFocus={() => setSelected((value) => value ?? asOfIndex)}
              onBlur={() => setSelected(null)}
              onKeyDown={(event) => {
                const changes: Record<string, number> = {
                  ArrowLeft: -1,
                  ArrowDown: -1,
                  ArrowRight: 1,
                  ArrowUp: 1,
                };
                if (
                  event.key === "Home" ||
                  event.key === "End" ||
                  event.key in changes
                ) {
                  event.preventDefault();
                  setSelected(
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? points.length - 1
                        : Math.max(
                            0,
                            Math.min(
                              points.length - 1,
                              (selected ?? asOfIndex) + changes[event.key],
                            ),
                          ),
                  );
                }
              }}
            >
              <title>
                {view === "critical"
                  ? "Saved P6 critical activities"
                  : "Project activity completion"}
              </title>
              {[0, 50, 100].map((value) => (
                <line
                  key={value}
                  x1="0"
                  x2="1000"
                  y1={y(value)}
                  y2={y(value)}
                  stroke="#e2e8f0"
                  strokeDasharray={value ? "3 4" : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <line
                x1={x(result.asOf)}
                x2={x(result.asOf)}
                y1="0"
                y2="200"
                stroke="#94a3b8"
                strokeDasharray="2 4"
                vectorEffect="non-scaling-stroke"
              />
              {fields.map(({ field, color, dashed }) => (
                <Curve
                  key={field}
                  type="monotoneX"
                  points={points
                    .filter((item) => item[field] !== null)
                    .map((item) => ({ x: x(item.date), y: y(item[field]!) }))}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                  strokeDasharray={dashed ? "7 4" : undefined}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  data-progress-curve={field}
                />
              ))}
              {selected !== null && point && (
                <g aria-hidden="true">
                  <line
                    x1={x(point.date)}
                    x2={x(point.date)}
                    y1="0"
                    y2="200"
                    stroke="#0f172a"
                    strokeOpacity="0.4"
                    vectorEffect="non-scaling-stroke"
                  />
                  {fields.map(
                    ({ field, color }) =>
                      point[field] !== null && (
                        <circle
                          key={field}
                          cx={x(point.date)}
                          cy={y(point[field]!)}
                          r="2"
                          fill={color}
                          vectorEffect="non-scaling-stroke"
                        />
                      ),
                  )}
                </g>
              )}
            </svg>
          </div>
          <div className="mt-2 flex justify-between gap-2 pl-10 text-xs text-slate-600 tabular-nums">
            <span>{dateLabel(first.date)}</span>
            <span>{dateLabel(last!.date)}</span>
          </div>
        </>
      ) : (
        <p className="py-6 text-sm text-slate-600">
          Planned and actual dates are needed to draw the curve.
        </p>
      )}
    </>
  );
}

function ProgressInformation({ result }: { result?: ProjectProgress }) {
  return (
    <>
      <p>
        Each Schedule activity has equal weight. Planned uses saved P6 targets
        or managed baseline finishes. The original plan is not an approved
        baseline unless one was recorded. Current uses saved Schedule finishes,
        including working date changes.
      </p>
      <p>
        Actual uses recorded actual finishes and stops at the as of date.
        Missing dates are not estimated. Lines are smoothed between sampled
        dates; inspected values and figures use the saved dates.
      </p>
      <p>
        Point at the curve, touch it or use the arrow keys to inspect a date.
      </p>
      {result && (
        <>
          <p className="tabular-nums">
            Overall as of {dateLabel(result.asOf)} ·{" "}
            {result.total.toLocaleString("en-GB")} activities · revision{" "}
            {result.revision.register}. Planned dates: {result.plannedRecorded}/
            {result.total}; current dates: {result.currentRecorded}/
            {result.total}; recorded actual finishes: {result.actualRecorded}.
            Completed without an actual date:{" "}
            {result.completedWithoutActualDate}. Future actual dates excluded:{" "}
            {result.futureActualDates}. Partial coverage can understate
            progress.
          </p>
          <p>
            Critical path compares activities classified critical by the saved
            P6 total-float rule. This is the saved classification, without a new
            critical path calculation.
            {result.criticalPath
              ? ` Coverage: ${result.criticalPath.coverage.critical} critical, ${result.criticalPath.coverage.nonCritical} non-critical, ${result.criticalPath.coverage.unknown} unknown. ${result.criticalPath.workingStale ? "Working changes have made the saved classification stale." : ""}`
              : " No saved P6 critical activities are available."}{" "}
            A path to Phase 1 requires an identified finish milestone.
          </p>
          {!!result.points.length && (
            <details>
              <summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:outline-blue-700">
                Overall figures by date
              </summary>
              <div className="overflow-auto">
                <table className="w-full text-left text-xs tabular-nums">
                  <caption className="sr-only">
                    Overall sampled cumulative activity completion percentages
                  </caption>
                  <thead>
                    <tr>
                      {["Date", "Planned", "Current", "Actual"].map((label) => (
                        <th key={label} scope="col" className="py-2 pr-2">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.points.map((item) => (
                      <tr key={item.date} className="border-t">
                        <th scope="row" className="py-2 pr-2 font-normal">
                          {dateLabel(item.date)}
                        </th>
                        <td className="py-2 pr-2">{percent(item.planned)}</td>
                        <td className="py-2 pr-2">{percent(item.current)}</td>
                        <td className="py-2">
                          {item.date > result.asOf
                            ? "Future"
                            : percent(item.actual)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </>
  );
}
