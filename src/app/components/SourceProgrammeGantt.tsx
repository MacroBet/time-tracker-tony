"use client";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowRight } from "lucide-react";
import type {
  SourceActivityView,
  SourceProgrammePage,
} from "@/lib/programme-source";
import {
  ganttAxis,
  type GanttScale,
  type GanttHorizon,
} from "@/lib/gantt-axis";
import {
  sourceBar,
  sourceCriticalityLabel,
  sourceViewport,
  shiftSourceDate,
  type SourceGanttColumn,
} from "@/lib/source-gantt";
import { dayNumber } from "@/lib/scheduling";
import { formatScheduleDate } from "@/lib/schedule-date";
import { GanttRuler } from "./GanttRuler";
import { useGanttPan } from "./useGanttPan";
import { InfoPopover } from "./InfoPopover";
import type { ActivityStepProgress } from "@/lib/project-reports";
import { GanttProgress } from "./GanttProgress";
import { useGanttDateDrag } from "./useGanttDateDrag";
import type { GanttDateRange, GanttDragRow } from "@/lib/gantt-date-drag";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

// Same 48px body rows and 56px ruler as the editable Schedule Gantt.
const rowHeight = 48;
export function SourceProgrammeGantt({
  data,
  anchor,
  scale,
  horizon = null,
  today,
  columns,
  onViewportDateChange,
  showLinks,
  loading,
  controls,
  durationMode,
  resetViewKey,
  projectId,
  progress,
  firstRowNumber,
  onSelect,
  onGoTo,
  onDateChange,
  dateChangeReview,
  onPanToDate,
  onPageChange,
  pagingKey,
}: {
  data: SourceProgrammePage | null;
  anchor: string;
  scale: GanttScale;
  horizon?: GanttHorizon;
  today: string;
  columns: SourceGanttColumn[];
  onViewportDateChange: (date: string) => void;
  showLinks: boolean;
  loading: boolean;
  controls: ReactNode;
  durationMode: "days" | "hours" | "hidden";
  resetViewKey: number;
  projectId: string;
  progress?: Record<string, ActivityStepProgress>;
  firstRowNumber: number;
  onSelect: (id: string, trigger: HTMLElement) => void;
  onGoTo: (row: SourceActivityView) => void;
  onDateChange?: (
    row: SourceActivityView,
    dates: GanttDateRange,
    trigger: HTMLElement,
  ) => void;
  dateChangeReview?: ReactNode;
  onPanToDate?: (date: string) => void;
  onPageChange?: (page: number) => void;
  pagingKey?: string;
}) {
  const showDuration = durationMode !== "hidden";
  const show = (column: SourceGanttColumn) => columns.includes(column);
  const otherColumnsWidth =
    (show("progress") ? 56 : 0) +
    (showDuration ? 72 : 0) +
    (show("start") ? 96 : 0) +
    (show("finish") ? 96 : 0) +
    (show("wbs") ? 120 : 0) +
    (show("calendar") ? 120 : 0);
  const marker = useId().replace(/:/g, "");
  const scroller = useRef<HTMLDivElement>(null);
  const requestedPage = useRef(0);
  const axis = ganttAxis(anchor, scale, horizon),
    rows = data?.activities ?? [];
  const columnCount = 2 + columns.length + Number(showDuration);
  const beforeRows = onPageChange && data ? data.page * data.pageSize : 0;
  const afterRows =
    onPageChange && data
      ? Math.max(0, data.total - beforeRows - rows.length)
      : 0;
  const dateDrag = useGanttDateDrag({
    pixelsPerDay: axis.unit,
    onPropose(item, dates, trigger) {
      const row = rows.find((entry) => entry.internalId === item.id);
      if (row && !loading && row.status !== "TK_Complete")
        onDateChange?.(row, dates, trigger);
    },
  });
  const positions = new Map(
    rows.map((row, index) => [row.internalId, { row, index }]),
  );
  const x = (date: string) => (dayNumber(date) - dayNumber(anchor)) * axis.unit;
  const links = data?.pageLinks ?? [];
  const [visiblePixels, setVisiblePixels] = useState({ from: 0, to: 0 });
  const lastViewport = useRef({ from: 0, scrollLeft: 0, otherColumnsWidth });
  const pan = useGanttPan({
    scroller,
    pixelsPerDay: axis.unit,
    getDate: () =>
      shiftSourceDate(
        anchor,
        Math.floor(lastViewport.current.from / axis.unit),
      ),
    onDate: (date) => onPanToDate?.(date),
  });
  function updateViewport() {
    const el = scroller.current;
    if (!el) return;
    const nameWidth = parseFloat(
      getComputedStyle(el).getPropertyValue("--source-activity-width"),
    );
    const viewport = sourceViewport({
      scrollLeft: el.scrollLeft,
      clientWidth: el.clientWidth,
      nameWidth,
      otherColumnsWidth,
      axisWidth: axis.width,
      unit: axis.unit,
    });
    lastViewport.current = {
      from: viewport.from,
      scrollLeft: el.scrollLeft,
      otherColumnsWidth,
    };
    setVisiblePixels((previous) =>
      previous.from === viewport.from && previous.to === viewport.to
        ? previous
        : { from: viewport.from, to: viewport.to },
    );
    onViewportDateChange(shiftSourceDate(anchor, viewport.dayOffset));
  }
  function requestVisiblePage(scrollTop: number) {
    if (!onPageChange || !data?.total) return;
    const page = Math.min(
      Math.floor(Math.max(0, scrollTop) / (rowHeight * data.pageSize)),
      Math.ceil(data.total / data.pageSize) - 1,
    );
    if (page === requestedPage.current) return;
    requestedPage.current = page;
    onPageChange(page);
  }
  function goToRow(row: number) {
    const el = scroller.current;
    if (!el || !data?.total) return;
    const safeRow = Math.max(1, Math.min(data.total, row));
    el.scrollTop = (safeRow - 1) * rowHeight;
    requestVisiblePage(el.scrollTop);
    el.focus({ preventScroll: true });
  }
  useLayoutEffect(() => {
    requestedPage.current = 0;
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [pagingKey, projectId]);
  // Explicit date, scale and project changes must clear the old horizontal offset.
  // Otherwise a Today input can still display December columns after a November reset.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = el.clientWidth < 500 ? otherColumnsWidth : 0;
    updateViewport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, scale, horizon, resetViewKey, projectId]);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const previous = lastViewport.current;
    el.scrollLeft =
      previous.from +
      (el.clientWidth < 500 || previous.scrollLeft >= previous.otherColumnsWidth
        ? otherColumnsWidth
        : 0);
    updateViewport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherColumnsWidth]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(updateViewport);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, axis.width, axis.unit, otherColumnsWidth]);
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
  function goToDate(row: SourceActivityView, date: string) {
    if (onPanToDate) onPanToDate(date);
    else goTo({ ...row, start: date, finish: date });
  }
  return (
    <section
      aria-label="Source schedule Gantt"
      className="relative isolate z-0 [--source-activity-width:180px] sm:[--source-activity-width:280px] overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex items-start gap-2 border-b px-3 py-2">
        {controls}
        <InfoPopover label="About the source timeline" className="ml-auto">
          {onPageChange && (
            <p>
              Scroll the table to browse all matching activities. Focus the
              table and use Home or End to jump to the first or last activity.
            </p>
          )}
          {onPageChange && data && data.total > 0 && (
            <form
              className="space-y-1"
              onSubmit={(event) => {
                event.preventDefault();
                const row = Number(
                  new FormData(event.currentTarget).get("row"),
                );
                if (Number.isInteger(row)) goToRow(row);
              }}
            >
              <label htmlFor={`${marker}-row`} className="text-xs font-medium">
                Go to activity row (1–{data.total.toLocaleString("en-GB")})
              </label>
              <div className="flex gap-2">
                <Input
                  id={`${marker}-row`}
                  name="row"
                  type="number"
                  min="1"
                  max={data.total}
                  required
                />
                <Button type="submit" variant="outline">
                  Go
                </Button>
              </div>
            </form>
          )}
          {!loading && rows.length > 0 && inWindow === 0 && (
            <p>
              To bring an activity’s bar into view, choose Activity dates or use
              the arrow next to the activity name.
            </p>
          )}
          <p>
            Drag the ruler or empty timeline to browse dates. Days use each
            activity’s saved calendar hours per day. Missing conversions stay in
            source hours.
          </p>
          <p>
            {links.length} relationships within the loaded rows and{" "}
            {Math.max(0, outsideLinks)} outside them. Dependency arrows are{" "}
            {showLinks ? "shown when both endpoints are in view" : "hidden"}.
          </p>
          <p>
            Select an activity name or bar for details.{" "}
            {dateChangeReview
              ? "Review or cancel the current proposal before dragging another activity."
              : onDateChange &&
                "Drag a bar to propose moving it or drag either end to resize it. Alt+arrow keys move it by one day. Shift+Alt+arrows change the finish. Review and confirm to save."}
          </p>
        </InfoPopover>
      </div>
      {loading && (
        <p role="status" className="border-b px-3 py-3 text-sm text-slate-600">
          Loading activities…
        </p>
      )}
      <div
        ref={scroller}
        {...(onPanToDate ? pan.handlers : {})}
        onScroll={(event) => {
          const { scrollTop, scrollLeft } = event.currentTarget;
          if (lastViewport.current.scrollLeft !== scrollLeft) updateViewport();
          requestVisiblePage(scrollTop);
        }}
        onKeyDown={(event) => {
          if (
            onPageChange &&
            data?.total &&
            event.target === event.currentTarget &&
            ["Home", "End"].includes(event.key)
          ) {
            event.preventDefault();
            goToRow(event.key === "Home" ? 1 : data.total);
          } else if (onPanToDate) pan.handlers.onKeyDown(event);
        }}
        role="region"
        aria-label="Scrollable schedule table and timeline"
        aria-busy={loading}
        tabIndex={0}
        className="relative max-h-[min(65dvh,640px)] overflow-auto overscroll-contain [overflow-anchor:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700"
        style={{
          touchAction: "pan-y",
          userSelect: pan.dragging ? "none" : undefined,
        }}
      >
        <table
          className="table-fixed border-collapse text-sm tabular-nums"
          aria-rowcount={onPageChange && data ? data.total + 1 : undefined}
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
            {show("progress") && <col style={{ width: 56 }} />}
            {showDuration && <col style={{ width: 72 }} />}
            {show("start") && <col style={{ width: 96 }} />}
            {show("finish") && <col style={{ width: 96 }} />}
            {show("wbs") && <col style={{ width: 120 }} />}
            {show("calendar") && <col style={{ width: 120 }} />}
            <col style={{ width: axis.width }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-slate-600">
            <tr className="h-14">
              <th className="sticky left-0 z-10 border-b bg-slate-50 px-3">
                Activity / ID
              </th>
              {show("progress") && (
                <th
                  className="border-b px-1"
                  aria-label="Step completion percentage"
                  title="Passed required applicable steps; approval is separate"
                >
                  %
                </th>
              )}
              {showDuration && (
                <th className="border-b px-2">
                  {durationMode === "days" ? "Days" : "Hours"}
                </th>
              )}
              {show("start") && <th className="border-b px-2">Start</th>}
              {show("finish") && <th className="border-b px-2">Finish</th>}
              {show("wbs") && <th className="border-b px-2">WBS</th>}
              {show("calendar") && <th className="border-b px-2">Calendar</th>}
              <th className="border-b border-l p-0">
                <GanttRuler
                  start={anchor}
                  scale={scale}
                  horizon={horizon}
                  today={today}
                  viewport={visiblePixels}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {beforeRows > 0 && (
              <tr aria-hidden="true">
                <td
                  className="p-0"
                  colSpan={columnCount}
                  style={{ height: beforeRows * rowHeight }}
                />
              </tr>
            )}
            {rows.map((row, index) => (
              <tr
                key={row.internalId}
                data-source-row={row.internalId}
                aria-rowindex={
                  onPageChange ? firstRowNumber + index + 1 : undefined
                }
                className="h-12 border-b border-slate-200 hover:bg-blue-50/40"
                style={{ height: rowHeight }}
              >
                <td className="sticky left-0 z-[1] bg-white px-3">
                  <div className="flex items-center">
                    <button
                      className="min-w-0 flex h-[47px] w-full flex-col justify-center text-left hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-700"
                      onClick={(e) => onSelect(row.internalId, e.currentTarget)}
                      title={`${row.name}\n${row.activityId}\n${row.wbsPath}\n${sourceCriticalityLabel(row.criticality)}`}
                    >
                      <strong className="line-clamp-2 text-sm leading-4 text-slate-950">
                        {row.name}
                      </strong>
                      <span className="block truncate text-xs leading-3 text-slate-600">
                        <span className="mr-1 font-medium tabular-nums">
                          {firstRowNumber + index}.
                        </span>
                        {row.activityId}
                        {row.milestone ? " · Milestone" : ""}
                        {row.criticality?.state === "critical" && (
                          <span className="text-red-700"> · P6 critical</span>
                        )}
                      </span>
                    </button>
                    <button
                      className="grid min-h-11 min-w-11 place-items-center rounded-md text-blue-800 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-700"
                      disabled={!row.start && !row.finish}
                      aria-label={`Show dates for ${row.activityId}`}
                      title="Show this activity on the timeline"
                      onClick={() => goTo(row)}
                    >
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </td>
                {show("progress") && (
                  <td className="px-1">
                    <GanttProgress
                      percent={progress?.[row.internalId]?.percent ?? null}
                      status={
                        progress?.[row.internalId]?.status ?? {
                          status: "unknown",
                          colour: null,
                          label:
                            "No verified activity-to-asset progress mapping",
                        }
                      }
                      href={`/reports?report=tagging&projectId=${encodeURIComponent(projectId)}&activity=${encodeURIComponent(`source:${data?.summary.sha256}:${row.internalId}`)}`}
                      description={progress?.[row.internalId]?.unknownReason}
                      notApplicable={
                        progress?.[row.internalId]?.coverage ===
                        "not-applicable"
                      }
                    />
                  </td>
                )}
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
                {show("start") && (
                  <td className="whitespace-nowrap px-2 text-[13px]">
                    {row.start ? (
                      <button
                        className="min-h-11 w-full text-left hover:text-blue-700 hover:underline focus-visible:outline-blue-700"
                        onClick={() => goToDate(row, row.start!)}
                        aria-label={`Show start date for ${row.activityId}: ${formatScheduleDate(row.start)}`}
                      >
                        {formatScheduleDate(row.start)}
                      </button>
                    ) : (
                      "Not set"
                    )}
                  </td>
                )}
                {show("finish") && (
                  <td className="whitespace-nowrap px-2 text-[13px]">
                    {row.finish ? (
                      <button
                        className="min-h-11 w-full text-left hover:text-blue-700 hover:underline focus-visible:outline-blue-700"
                        onClick={() => goToDate(row, row.finish!)}
                        aria-label={`Show finish date for ${row.activityId}: ${formatScheduleDate(row.finish)}`}
                      >
                        {formatScheduleDate(row.finish)}
                      </button>
                    ) : (
                      "Not set"
                    )}
                  </td>
                )}
                {show("wbs") && (
                  <td className="truncate px-2 text-xs" title={row.wbsPath}>
                    {row.wbsPath || "Not recorded"}
                  </td>
                )}
                {show("calendar") && (
                  <td
                    className="truncate px-2 text-xs"
                    title={row.calendarName}
                  >
                    {row.calendarName || "Not recorded"}
                  </td>
                )}
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
                        {x(today) >= 0 && x(today) < axis.width && (
                          <line
                            data-today-line={today}
                            x1={x(today)}
                            x2={x(today)}
                            y1={0}
                            y2={rows.length * rowHeight}
                            stroke="#1d4ed8"
                            strokeWidth="2"
                          />
                        )}
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
                        const item: GanttDragRow = {
                          id: row.internalId,
                          start: row.start,
                          finish: row.finish,
                          milestone: row.milestone,
                        };
                        const editable =
                          !!onDateChange &&
                          !loading &&
                          row.status !== "TK_Complete";
                        const proposed =
                          dateDrag.preview?.id === row.internalId
                            ? dateDrag.preview
                            : null;
                        const display = proposed
                          ? { ...row, ...proposed }
                          : row;
                        const originalBar = sourceBar(
                          row,
                          anchor,
                          axis.span,
                          axis.unit,
                        );
                        const bar =
                          sourceBar(display, anchor, axis.span, axis.unit) ??
                          (originalBar && proposed
                            ? {
                                ...originalBar,
                                left:
                                  (display.finish ?? display.start)! < anchor
                                    ? 0
                                    : axis.width - 6,
                                width: 6,
                              }
                            : undefined);
                        const originalDeadlineX =
                          !row.start &&
                          row.finish &&
                          row.taskType === "FT_Deadline"
                            ? x(row.finish)
                            : undefined;
                        const deadlineX =
                          originalDeadlineX !== undefined && proposed?.finish
                            ? Math.max(
                                0,
                                Math.min(axis.width - 44, x(proposed.finish)),
                              )
                            : originalDeadlineX;
                        const visualWidth = bar ? Math.max(6, bar.width) : 0;
                        const hitWidth = Math.max(44, visualWidth);
                        const hitLeft = bar
                          ? Math.min(
                              bar.left,
                              Math.max(0, axis.width - hitWidth),
                            )
                          : 0;
                        const startX = display.start ? x(display.start) : -1;
                        const finishX = display.finish
                          ? x(display.finish) + axis.unit
                          : -1;
                        // Hit areas sit outside the bar so moving short activities remains possible.
                        const canResizeStart =
                          editable &&
                          !!row.start &&
                          !!row.finish &&
                          !row.milestone &&
                          x(row.start) >= 44 &&
                          x(row.start) < axis.width;
                        const canResizeFinish =
                          editable &&
                          !!row.start &&
                          !!row.finish &&
                          !row.milestone &&
                          x(row.finish) + axis.unit > 0 &&
                          x(row.finish) + axis.unit <= axis.width - 44;
                        return (
                          <div
                            key={row.internalId}
                            data-timeline-row={row.internalId}
                            data-gantt-pan
                            className="relative h-12 border-b border-slate-200"
                          >
                            {bar ? (
                              <>
                                <button
                                  {...(editable
                                    ? dateDrag.bindings(item, "move")
                                    : {})}
                                  data-date-drag={
                                    editable ? row.internalId : undefined
                                  }
                                  draggable={false}
                                  onClick={(event) => {
                                    if (!dateDrag.consumeClick())
                                      onSelect(
                                        row.internalId,
                                        event.currentTarget,
                                      );
                                  }}
                                  aria-label={`View ${row.activityId}: ${row.name}. ${sourceCriticalityLabel(row.criticality)}${editable ? ". Drag to propose new dates; Alt and arrow keys move one day" : ""}`}
                                  aria-keyshortcuts={
                                    editable
                                      ? "Alt+ArrowLeft Alt+ArrowRight Alt+Shift+ArrowLeft Alt+Shift+ArrowRight"
                                      : undefined
                                  }
                                  title={`${row.name}; ${display.start ?? display.finish} → ${display.finish ?? display.start}; ${row.durationHours} source hours; ${sourceCriticalityLabel(row.criticality)}${editable ? "; Drag to move. Alt+arrows moves one day; Shift+Alt+arrows resizes finish. Changes require review." : ""}`}
                                  className={`group absolute top-0.5 h-11 text-left text-xs text-blue-950 focus-visible:outline-2 focus-visible:outline-blue-700 ${editable ? "cursor-grab active:cursor-grabbing select-none" : ""}`}
                                  style={{
                                    left: hitLeft,
                                    width: hitWidth,
                                    touchAction: editable ? "pan-y" : undefined,
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
                                      <span
                                        className={`size-3 rotate-45 ${row.criticality?.state === "critical" ? "bg-red-700" : "bg-slate-800"}`}
                                      />
                                    </span>
                                  ) : (
                                    <span
                                      className={`absolute top-2.5 flex h-6 items-center overflow-hidden rounded-sm border px-1 whitespace-nowrap ${proposed ? "border-blue-700 bg-blue-200 text-blue-950" : row.criticality?.state === "critical" ? "border-red-400 bg-red-100 text-red-950 group-hover:bg-red-200" : "border-blue-400 bg-blue-100 group-hover:bg-blue-200"}`}
                                      style={{
                                        left: bar.left - hitLeft,
                                        width: visualWidth,
                                      }}
                                    >
                                      <span className="min-w-0 truncate">
                                        {row.name}
                                      </span>
                                    </span>
                                  )}
                                </button>
                                {canResizeStart && (
                                  <button
                                    {...dateDrag.bindings(item, "start")}
                                    data-date-drag-start={row.internalId}
                                    draggable={false}
                                    aria-label={`Resize start date for ${row.activityId}`}
                                    aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                                    title="Drag to change start; Alt+arrows adjusts one day. Changes require review."
                                    className="absolute top-0.5 z-[1] h-11 w-11 touch-pan-y select-none cursor-ew-resize text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700"
                                    style={{
                                      left: Math.max(
                                        0,
                                        Math.min(axis.width - 44, startX - 44),
                                      ),
                                    }}
                                    onClick={(event) => {
                                      if (!dateDrag.consumeClick())
                                        onSelect(
                                          row.internalId,
                                          event.currentTarget,
                                        );
                                    }}
                                  >
                                    <span
                                      aria-hidden="true"
                                      className="absolute right-0 top-3 h-5 border-r-2 border-current"
                                    />
                                  </button>
                                )}
                                {canResizeFinish && (
                                  <button
                                    {...dateDrag.bindings(item, "finish")}
                                    data-date-drag-finish={row.internalId}
                                    draggable={false}
                                    aria-label={`Resize finish date for ${row.activityId}`}
                                    aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                                    title="Drag to change finish; Alt+arrows adjusts one day. Changes require review."
                                    className="absolute top-0.5 z-[1] h-11 w-11 touch-pan-y select-none cursor-ew-resize text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700"
                                    style={{
                                      left: Math.max(
                                        0,
                                        Math.min(axis.width - 44, finishX),
                                      ),
                                    }}
                                    onClick={(event) => {
                                      if (!dateDrag.consumeClick())
                                        onSelect(
                                          row.internalId,
                                          event.currentTarget,
                                        );
                                    }}
                                  >
                                    <span
                                      aria-hidden="true"
                                      className="absolute left-0 top-3 h-5 border-l-2 border-current"
                                    />
                                  </button>
                                )}
                              </>
                            ) : deadlineX !== undefined &&
                              deadlineX >= 0 &&
                              deadlineX < axis.width ? (
                              <button
                                {...(editable
                                  ? dateDrag.bindings(item, "move")
                                  : {})}
                                data-date-drag={
                                  editable ? row.internalId : undefined
                                }
                                draggable={false}
                                className={`absolute top-0.5 flex h-11 min-w-11 items-center justify-center text-xs text-blue-900 focus-visible:outline-2 focus-visible:outline-blue-700 ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
                                style={{
                                  left: Math.min(deadlineX, axis.width - 44),
                                  touchAction: editable ? "pan-y" : undefined,
                                }}
                                aria-label={`Deadline ${display.finish} for ${row.activityId}; start and duration not recorded`}
                                title={`Deadline ${display.finish}; start and duration not recorded${editable ? "; Drag to propose a new deadline" : ""}`}
                                onClick={(event) => {
                                  if (!dateDrag.consumeClick())
                                    onSelect(
                                      row.internalId,
                                      event.currentTarget,
                                    );
                                }}
                              >
                                <span className="h-6 border-l-2 border-blue-700 px-1">
                                  Due
                                </span>
                              </button>
                            ) : !row.start && !row.finish ? (
                              <span className="absolute top-4 left-3 text-xs text-slate-600">
                                Dates not recorded
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {afterRows > 0 && (
              <tr aria-hidden="true">
                <td
                  className="p-0"
                  colSpan={columnCount}
                  style={{ height: afterRows * rowHeight }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {dateChangeReview}
      <p role="status" className="sr-only">
        {dateDrag.preview
          ? `Proposed dates: ${formatScheduleDate(dateDrag.preview.start)} to ${formatScheduleDate(dateDrag.preview.finish)}. Release to review the change.`
          : ""}
      </p>
    </section>
  );
}
