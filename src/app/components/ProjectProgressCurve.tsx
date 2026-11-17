"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { hasModule } from "@/lib/commissioning";
import type { ProjectProgress } from "@/lib/project-progress";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";
import { InfoPopover } from "./InfoPopover";

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
}: {
  projectId: string;
  version: number;
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
              <p>
                Each Schedule activity has equal weight. Planned is the share
                due to finish by each date; actual is the share with a recorded
                actual finish. Partial activity percentages are not counted as
                completions.
              </p>
              <p>
                Imported activities use their saved planned target, which is not
                an approved baseline. Managed activities use their saved
                baseline finish. Working date changes do not rewrite this plan.
                Missing dates remain visible in coverage.
              </p>
            </InfoPopover>
          </div>
          <p className="text-xs text-slate-600 sm:text-sm">
            Overall Schedule · activities with equal weight
          </p>
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
          <ProgressPlot result={result} key={`${key}:${result.asOf}`} />
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

function ProgressPlot({ result }: { result: ProjectProgress }) {
  const points = result.points;
  const asOfIndex = Math.max(
    0,
    points.findIndex((point) => point.date === result.asOf),
  );
  const [selected, setSelected] = useState(asOfIndex);
  const point = points[selected];
  const first = points[0],
    last = points.at(-1);
  const start = first ? Date.parse(first.date) : 0;
  const span = last ? Date.parse(last.date) - start : 0;
  const x = (date: string) =>
    span ? ((Date.parse(date) - start) / span) * 1000 : 0;
  const y = (value: number) => 200 - value * 2;
  const line = (field: "planned" | "actual") => {
    let previous: number | null = null;
    return points
      .map((item) => {
        const value = item[field];
        if (value === null) {
          previous = null;
          return "";
        }
        const command =
          previous === null
            ? `M ${x(item.date)} ${y(value)}`
            : `H ${x(item.date)} V ${y(value)}`;
        previous = value;
        return command;
      })
      .join(" ");
  };
  const plannedPartial = result.plannedRecorded < result.total;
  const completeCoverage =
    !plannedPartial &&
    !result.actualCoveragePartial &&
    !result.futureActualDates;
  const gap =
    completeCoverage &&
    result.plannedToday !== null &&
    result.actualToday !== null
      ? result.actualToday - result.plannedToday
      : null;
  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <dl className="flex flex-wrap gap-x-7 gap-y-3 tabular-nums">
          <div>
            <dt className="text-xs text-slate-600">
              Planned{plannedPartial ? " · partial dates" : ""}
            </dt>
            <dd className="mt-1 text-2xl font-semibold text-blue-800">
              {percent(result.plannedToday)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-600">
              Actual
              <span className="hidden sm:inline"> · dated completions</span>
            </dt>
            <dd className="mt-1 text-2xl font-semibold text-emerald-800">
              {percent(result.actualToday)}
            </dd>
          </div>
          {gap !== null && (
            <div className="hidden sm:block">
              <dt className="text-xs text-slate-600">Actual minus planned</dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-950">
                {gap > 0 ? "+" : ""}
                {Number(gap.toFixed(1))}{" "}
                <span className="text-sm font-normal">pp</span>
              </dd>
            </div>
          )}
        </dl>
        <p className="text-xs leading-5 text-slate-600 tabular-nums">
          As of {dateLabel(result.asOf)}
          <br />
          {result.total.toLocaleString("en-GB")} activities
          <span className="hidden sm:inline">
            {" "}
            · revision {result.revision.register}
          </span>
        </p>
      </div>
      <p className="mb-4 text-xs leading-5 text-slate-600 tabular-nums">
        {result.plannedRecorded} / {result.total} planned dates ·{" "}
        {result.actualRecorded - result.futureActualDates} dated actual finishes
        {result.completedWithoutActualDate > 0 &&
          ` · ${result.completedWithoutActualDate} completions without an actual date`}
        {result.futureActualDates > 0 &&
          ` · ${result.futureActualDates} future actual dates excluded`}
      </p>
      {points.length > 1 ? (
        <>
          <div className="flex h-48 sm:h-60">
            <div
              aria-hidden="true"
              className="flex w-10 shrink-0 flex-col justify-between pr-2 text-right text-xs tabular-nums text-slate-600"
            >
              {[100, 75, 50, 25, 0].map((value) => (
                <span key={value}>{value}%</span>
              ))}
            </div>
            <svg
              role="img"
              aria-label={`Cumulative project activity completion. Planned ${percent(result.plannedToday)}, dated actual ${percent(result.actualToday)} as of ${result.asOf}. Use Inspect progress date below to read figures.`}
              viewBox="0 -4 1000 208"
              preserveAspectRatio="none"
              className="h-full min-w-0 flex-1 overflow-visible"
            >
              {[0, 25, 50, 75, 100].map((value) => (
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
              {(["planned", "actual"] as const).map((field) => (
                <path
                  key={field}
                  d={line(field)}
                  fill="none"
                  stroke={field === "planned" ? "#2563eb" : "#047857"}
                  strokeWidth="2.5"
                  strokeDasharray={field === "planned" ? "7 4" : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {point && (
                <line
                  x1={x(point.date)}
                  x2={x(point.date)}
                  y1="0"
                  y2="200"
                  stroke="#0f172a"
                  strokeOpacity="0.4"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
          </div>
          <div className="mt-2 flex justify-between gap-2 pl-10 text-xs text-slate-600 tabular-nums">
            <span>{dateLabel(first.date)}</span>
            <span>{dateLabel(last!.date)}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-700">
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="w-5 border-t-2 border-dashed border-blue-600"
              />
              Planned
            </span>
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="w-5 border-t-2 border-emerald-700"
              />
              Actual · stops at as of date
            </span>
          </div>
          <div className="mt-4 border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
              <label
                htmlFor="project-progress-date"
                className="text-sm font-medium"
              >
                Inspect progress date
              </label>
              <output htmlFor="project-progress-date">
                {point
                  ? `${dateLabel(point.date)} · planned ${percent(point.planned)} · actual ${point.date > result.asOf ? "future" : percent(point.actual)}`
                  : "No dated points"}
              </output>
            </div>
            <input
              id="project-progress-date"
              aria-label="Inspect progress date"
              type="range"
              min="0"
              max={points.length - 1}
              step="1"
              value={selected}
              onChange={(event) => setSelected(Number(event.target.value))}
              className="mt-1 min-h-11 w-full cursor-pointer accent-blue-700 focus-visible:outline-blue-700"
            />
          </div>
        </>
      ) : (
        <p className="py-6 text-sm text-slate-600">
          Planned and actual dates are needed to draw the curve.
        </p>
      )}
      <details className="mt-2 border-t text-sm">
        <summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:outline-blue-700">
          Calculation, coverage & figures
        </summary>
        <p className="max-w-prose leading-6 text-slate-600">
          Each activity counts once. Planned dates: {result.plannedRecorded} /{" "}
          {result.total}; missing: {result.total - result.plannedRecorded}.
          Recorded actual finishes: {result.actualRecorded}. Completed without
          an actual date: {result.completedWithoutActualDate}. Future actual
          dates excluded: {result.futureActualDates}. Missing dates are not
          estimated; partial coverage can understate progress.
        </p>
        <p className="mt-2 max-w-prose leading-6 text-slate-600">
          Imported saved planned targets and managed baseline finishes form the
          plan. The actual curve uses dated completions only and ends at the as
          of date. Task completion, tag approvals and test steps remain separate
          below.
        </p>
        {!!points.length && (
          <div className="mt-3 max-h-64 overflow-auto rounded-lg border">
            <table className="w-full text-left text-xs tabular-nums">
              <caption className="sr-only">
                Sampled cumulative activity completion percentages
              </caption>
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th scope="col" className="p-3">
                    Date
                  </th>
                  <th scope="col" className="p-3">
                    Planned
                  </th>
                  <th scope="col" className="p-3">
                    Actual
                  </th>
                </tr>
              </thead>
              <tbody>
                {points.map((item) => (
                  <tr key={item.date} className="border-t">
                    <th scope="row" className="p-3 font-normal">
                      {dateLabel(item.date)}
                    </th>
                    <td className="p-3">{percent(item.planned)}</td>
                    <td className="p-3">
                      {item.date > result.asOf
                        ? "Future"
                        : percent(item.actual)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </>
  );
}
