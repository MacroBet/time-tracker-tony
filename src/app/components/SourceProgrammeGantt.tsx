"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CalendarClock, Eye, EyeOff } from "lucide-react";
import type {
  SourceActivityView,
  SourceProgrammePage,
} from "@/lib/programme-source";
import { ganttAxis, type GanttScale } from "@/lib/gantt-axis";
import { sourceBar } from "@/lib/source-gantt";
import { dayNumber } from "@/lib/scheduling";
import { GanttRuler } from "./GanttRuler";
import { InfoPopover } from "./InfoPopover";

// Same 48px body rows and 56px ruler as the editable Schedule Gantt.
const rowHeight = 48;
export function SourceProgrammeGantt({
  data,
  anchor,
  scale,
  showLinks,
  loading,
  controls,
  durationMode,
  onDurationModeChange,
  resetViewKey,
  onSelect,
  onGoTo,
}: {
  data: SourceProgrammePage | null;
  anchor: string;
  scale: GanttScale;
  showLinks: boolean;
  loading: boolean;
  controls: ReactNode;
  durationMode: "days" | "hours" | "hidden";
  onDurationModeChange: (mode: "days" | "hours" | "hidden") => void;
  resetViewKey: number;
  onSelect: (id: string, trigger: HTMLElement) => void;
  onGoTo: (row: SourceActivityView) => void;
}) {
  const showDuration = durationMode !== "hidden";
  const otherColumnsWidth = 44 + (showDuration ? 80 : 0) + 96 + 96;
  const marker = useId().replace(/:/g, "");
  const scroller = useRef<HTMLDivElement>(null);
  const axis = ganttAxis(anchor, scale),
    rows = data?.activities ?? [];
  const positions = new Map(
    rows.map((row, index) => [row.internalId, { row, index }]),
  );
  const x = (date: string) => (dayNumber(date) - dayNumber(anchor)) * axis.unit;
  const links = data?.pageLinks ?? [];
  const [visiblePixels, setVisiblePixels] = useState({ from: 0, to: 0 });
  function updateViewport() {
    const el = scroller.current;
    if (!el) return;
    const nameWidth = parseFloat(
      getComputedStyle(el).getPropertyValue("--source-activity-width"),
    );
    const tableWidth = nameWidth + otherColumnsWidth;
    setVisiblePixels({
      from: Math.max(0, el.scrollLeft + nameWidth - tableWidth),
      to: Math.max(
        0,
        Math.min(axis.width, el.scrollLeft + el.clientWidth - tableWidth),
      ),
    });
  }
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const resize = () => {
      if (el.clientWidth < 500 && el.scrollLeft === 0)
        el.scrollLeft = otherColumnsWidth;
      updateViewport();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    return () => observer.disconnect();
    // Axis width changes only with the explicitly selected calendar scale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axis.width, otherColumnsWidth]);
  useEffect(() => {
    if (resetViewKey > 0 && scroller.current) {
      scroller.current.scrollLeft =
        scroller.current.clientWidth < 500 ? otherColumnsWidth : 0;
      updateViewport();
    }
    // Explicitly re-centre even when the automatic page anchor has not changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetViewKey]);
  const inWindow = rows.filter((row) => {
    const bar = sourceBar(row, anchor, axis.span, axis.unit);
    return (
      bar &&
      bar.left + bar.width > visiblePixels.from &&
      bar.left < visiblePixels.to
    );
  }).length;
  const outsideLinks =
    rows.reduce((n, row) => n + row.predecessorCount + row.successorCount, 0) -
    2 * links.length;
  function goTo(row: SourceActivityView) {
    onGoTo(row);
    if (scroller.current)
      scroller.current.scrollLeft =
        scroller.current.clientWidth < 500 ? otherColumnsWidth : 0;
  }
  return (
    <section
      aria-label="Source schedule Gantt"
      className="relative isolate z-0 [--source-activity-width:220px] sm:[--source-activity-width:360px] overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b px-4 py-3">
        {controls}
      </div>
      <div
        ref={scroller}
        onScroll={updateViewport}
        role="region"
        aria-label="Scrollable schedule table and timeline"
        aria-busy={loading}
        tabIndex={0}
        className="relative overflow-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700"
        style={{ height: "min(60dvh, 560px)", minHeight: 240 }}
      >
        <table
          className="table-fixed border-collapse text-sm tabular-nums"
          style={{
            width: `calc(var(--source-activity-width) + ${otherColumnsWidth + axis.width}px)`,
          }}
        >
          <caption className="sr-only">
            Source schedule in source order. Select an activity for its original
            fields. Days use the hours per day saved in the activity calendar;
            missing conversions remain in source hours. Scroll inside this table
            to keep the date ruler visible.
          </caption>
          <colgroup>
            <col style={{ width: "var(--source-activity-width)" }} />
            <col style={{ width: 44 }} />
            {showDuration && <col style={{ width: 80 }} />}
            <col style={{ width: 96 }} />
            <col style={{ width: 96 }} />
            <col style={{ width: axis.width }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-slate-600">
            <tr className="h-14">
              <th className="sticky left-0 z-10 border-b bg-slate-50 px-3">
                <div className="flex items-center justify-between gap-2">
                  Activity
                  {!showDuration && (
                    <button
                      type="button"
                      className="grid min-h-11 min-w-11 place-items-center rounded-md hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-blue-700"
                      aria-label="Show duration column"
                      title="Show duration column"
                      onClick={() => onDurationModeChange("days")}
                    >
                      <Eye className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </th>
              <th className="border-b">
                <span className="sr-only">Show activity dates</span>
              </th>
              {showDuration && (
                <th className="border-b px-1">
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between gap-1 rounded-md px-1 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-blue-700"
                    aria-label="Hide duration column"
                    title="Hide duration column"
                    onClick={() => onDurationModeChange("hidden")}
                  >
                    {durationMode === "days" ? "Days" : "Hours"}
                    <EyeOff className="size-3.5 shrink-0" aria-hidden="true" />
                  </button>
                </th>
              )}
              <th className="border-b px-2">Start</th>
              <th className="border-b px-2">Finish</th>
              <th className="border-b border-l p-0">
                <GanttRuler start={anchor} scale={scale} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.internalId}
                data-source-row={row.internalId}
                className="h-12 border-b border-slate-200 hover:bg-blue-50/40"
                style={{ height: rowHeight }}
              >
                <td className="sticky left-0 z-[1] bg-white px-3">
                  <button
                    className="flex h-[47px] w-full flex-col justify-center text-left hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-700"
                    onClick={(e) => onSelect(row.internalId, e.currentTarget)}
                    title={`${row.name}\n${row.activityId}\n${row.wbsPath}`}
                  >
                    <strong className="line-clamp-2 text-sm leading-4 text-slate-950">
                      {row.name}
                    </strong>
                    <span className="block truncate text-xs leading-3 text-slate-600">
                      {row.activityId}
                      {row.milestone ? " · Milestone" : ""}
                    </span>
                  </button>
                </td>
                <td className="px-0">
                  <button
                    className="grid min-h-11 min-w-11 place-items-center rounded-md text-blue-800 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-700"
                    disabled={!row.start && !row.finish}
                    aria-label={`Show dates for ${row.activityId}`}
                    title="Show this activity on the timeline"
                    onClick={() => goTo(row)}
                  >
                    <CalendarClock className="size-4" aria-hidden="true" />
                  </button>
                </td>
                {showDuration && (
                  <td
                    className="px-2"
                    title={
                      durationMode === "days" && row.durationDays !== undefined
                        ? `${row.durationHours} source hours ÷ ${row.calendarHoursPerDay} saved calendar hours per day`
                        : durationMode === "days"
                          ? "Original source duration in hours; day conversion unavailable without saved calendar hours per day"
                          : "Original source duration in hours"
                    }
                  >
                    {durationMode === "days" && row.durationDays !== undefined
                      ? `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(row.durationDays)} d`
                      : row.durationHours
                        ? `${row.durationHours} h`
                        : "—"}
                  </td>
                )}
                <td className="whitespace-nowrap px-2 text-[13px]">
                  {row.start ?? "Not set"}
                </td>
                <td className="whitespace-nowrap px-2 text-[13px]">
                  {row.finish ?? "Not set"}
                </td>
                {index === 0 && (
                  <td
                    rowSpan={rows.length}
                    className="relative border-l p-0 align-top"
                  >
                    <div
                      className="relative"
                      style={{
                        width: axis.width,
                        height: rows.length * rowHeight,
                      }}
                    >
                      <svg
                        className="pointer-events-none absolute inset-0"
                        width={axis.width}
                        height={rows.length * rowHeight}
                        aria-hidden="true"
                      >
                        <defs>
                          <marker
                            id={marker}
                            viewBox="0 0 10 10"
                            refX="8"
                            refY="5"
                            markerWidth="5"
                            markerHeight="5"
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                          </marker>
                        </defs>
                        {axis.columns.map((col) => (
                          <g key={col.date}>
                            {scale === "day" && col.weekend && (
                              <rect
                                x={col.left}
                                y={0}
                                width={axis.unit}
                                height={rows.length * rowHeight}
                                fill="#f1f5f9"
                              />
                            )}
                            <line
                              x1={col.left}
                              x2={col.left}
                              y1={0}
                              y2={rows.length * rowHeight}
                              stroke="#e2e8f0"
                            />
                          </g>
                        ))}
                        {showLinks &&
                          links.map((link) => {
                            const from = positions.get(link.predecessorId),
                              to = positions.get(link.successorId);
                            if (
                              !from ||
                              !to ||
                              !["PR_FS", "PR_SS", "PR_FF", "PR_SF"].includes(
                                link.type,
                              )
                            )
                              return null;
                            const startFrom =
                                link.type === "PR_SS" || link.type === "PR_SF",
                              finishTo =
                                link.type === "PR_FF" || link.type === "PR_SF";
                            const a = startFrom
                                ? from.row.start
                                : from.row.finish,
                              b = finishTo ? to.row.finish : to.row.start;
                            if (!a || !b) return null;
                            const left = x(a) + (startFrom ? 0 : axis.unit),
                              right = x(b) + (finishTo ? axis.unit : 0);
                            if (
                              left < 0 ||
                              right < 0 ||
                              left > axis.width ||
                              right > axis.width
                            )
                              return null;
                            const mid = Math.max(left + 6, right - 8);
                            return (
                              <path
                                data-source-link={link.sourceLine}
                                key={link.sourceLine}
                                d={`M ${left} ${from.index * rowHeight + 24} H ${mid} V ${to.index * rowHeight + 24} H ${right}`}
                                fill="none"
                                stroke="#64748b"
                                strokeWidth="1.25"
                                markerEnd={`url(#${marker})`}
                              />
                            );
                          })}
                      </svg>
                      {rows.map((row) => {
                        const bar = sourceBar(
                          row,
                          anchor,
                          axis.span,
                          axis.unit,
                        );
                        const visualWidth = bar ? Math.max(6, bar.width) : 0;
                        const hitWidth = Math.max(44, visualWidth);
                        const hitLeft = bar
                          ? Math.min(
                              bar.left,
                              Math.max(0, axis.width - hitWidth),
                            )
                          : 0;
                        return (
                          <div
                            key={row.internalId}
                            data-timeline-row={row.internalId}
                            className="relative h-12 border-b border-slate-200"
                          >
                            {bar ? (
                              <button
                                onClick={(e) =>
                                  onSelect(row.internalId, e.currentTarget)
                                }
                                aria-label={`View ${row.activityId}: ${row.name}`}
                                title={`${row.name}; ${row.start ?? row.finish} → ${row.finish ?? row.start}; ${row.durationHours} source hours`}
                                className="group absolute top-0.5 h-11 text-left text-xs text-blue-950 focus-visible:outline-2 focus-visible:outline-blue-700"
                                style={{
                                  left: hitLeft,
                                  width: hitWidth,
                                }}
                              >
                                {row.milestone ? (
                                  <span
                                    className="absolute top-2.5 grid h-6 place-items-center"
                                    style={{
                                      left: bar.left - hitLeft,
                                      width: visualWidth,
                                    }}
                                  >
                                    <span className="size-3 rotate-45 bg-slate-800" />
                                  </span>
                                ) : (
                                  <span
                                    className="absolute top-2.5 flex h-6 items-center overflow-hidden rounded-sm border border-blue-400 bg-blue-100 px-1 whitespace-nowrap group-hover:bg-blue-200"
                                    style={{
                                      left: bar.left - hitLeft,
                                      width: visualWidth,
                                    }}
                                  >
                                    {row.activityId}
                                  </span>
                                )}
                              </button>
                            ) : (
                              <button
                                className="absolute top-0 left-3 min-h-11 text-left text-xs text-blue-800 underline underline-offset-2 disabled:text-slate-500 disabled:no-underline"
                                disabled={!row.start && !row.finish}
                                onClick={() => goTo(row)}
                                aria-label={`Go to timeline dates for ${row.activityId}`}
                              >
                                {row.start || row.finish
                                  ? "Go to activity dates"
                                  : "Dates not recorded"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-1 text-xs text-slate-600">
        <p className="tabular-nums">
          {inWindow} of {rows.length} loaded activities in the visible date area
        </p>
        <InfoPopover label="About the source timeline">
          <p>
            Activities retain source order. The date window follows the most
            common saved start on this page. Days use each activity’s saved
            calendar hours per day; missing conversions stay in source hours. No
            dates or source durations are recalculated.
          </p>
          <p>
            {links.length} source relationships connect loaded activities;{" "}
            {Math.max(0, outsideLinks)} connections lead outside this page.{" "}
            {showLinks
              ? "Arrows show saved endpoints within the date window."
              : "Dependency arrows are hidden."}
          </p>
          <p>
            Select a name or bar for details. Use the calendar button to locate
            an activity outside the window. Scroll horizontally for columns and
            dates.
          </p>
        </InfoPopover>
      </div>
    </section>
  );
}
