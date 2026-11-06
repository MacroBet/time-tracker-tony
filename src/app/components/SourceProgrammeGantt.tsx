"use client";
import { useId } from "react";
import type { SourceProgrammePage } from "@/lib/programme-source";
import { ganttAxis, type GanttScale } from "@/lib/gantt-axis";
import { sourceBar } from "@/lib/source-gantt";
import { dayNumber } from "@/lib/scheduling";

const rowHeight = 64;
export function SourceProgrammeGantt({
  data,
  anchor,
  scale,
  showLinks,
  loading,
  onSelect,
}: {
  data: SourceProgrammePage | null;
  anchor: string;
  scale: GanttScale;
  showLinks: boolean;
  loading: boolean;
  onSelect: (id: string, trigger: HTMLElement) => void;
}) {
  const marker = useId().replace(/:/g, "");
  const axis = ganttAxis(anchor, scale);
  const rows = data?.activities ?? [];
  const positions = new Map(
    rows.map((row, index) => [row.internalId, { row, index }]),
  );
  const x = (date: string) => (dayNumber(date) - dayNumber(anchor)) * axis.unit;
  const links = data?.pageLinks ?? [];
  return (
    <section
      aria-label="Source programme Gantt"
      aria-busy={loading}
      tabIndex={0}
      className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white focus-visible:outline-2 focus-visible:outline-blue-700"
    >
      <div className="flex" style={{ minWidth: axis.width + 320 }}>
        <div className="sticky left-0 z-20 w-60 shrink-0 bg-white sm:w-80">
          <div className="sticky top-0 z-30 flex h-16 items-center border-b bg-slate-50 px-3 text-sm font-semibold">
            Activity / saved dates
          </div>
          {rows.map((row) => (
            <button
              key={row.internalId}
              onClick={(e) => onSelect(row.internalId, e.currentTarget)}
              className="block h-16 w-full border-b border-slate-200 px-3 text-left hover:bg-blue-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700"
              title={`${row.activityId} · ${row.name}\n${row.wbsPath}\n${row.start ?? "Not recorded"} – ${row.finish ?? "Not recorded"}\n${row.durationHours} source hours`}
            >
              <span className="block truncate text-xs font-semibold text-blue-800">
                {row.activityId}
                {row.milestone ? " · Milestone" : ""}
              </span>
              <span className="block truncate text-sm text-slate-950">
                {row.name}
              </span>
              <span className="block truncate text-xs tabular-nums text-slate-600">
                {row.start ?? "No start"} – {row.finish ?? "No finish"}
              </span>
            </button>
          ))}
        </div>
        <div
          className="relative shrink-0 border-l border-slate-300"
          style={{ width: axis.width }}
        >
          <div className="sticky top-0 z-10 h-16 border-b border-slate-300 bg-slate-50 text-xs text-slate-700">
            {axis.columns.map((col, i) => (
              <span
                key={col.date}
                title={col.date}
                className={`absolute inset-y-0 flex flex-col items-center justify-center gap-1 border-l border-slate-200 tabular-nums ${scale === "day" && col.weekend ? "bg-slate-100" : ""}`}
                style={{
                  left: col.left,
                  width: (axis.columns[i + 1]?.left ?? axis.width) - col.left,
                }}
              >
                <time dateTime={col.date}>{col.label}</time>
                {scale === "day" && <span>{col.weekday}</span>}
              </span>
            ))}
          </div>
          <div className="relative" style={{ height: rows.length * rowHeight }}>
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
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
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
                    !["PR_FS", "PR_SS", "PR_FF", "PR_SF"].includes(link.type)
                  )
                    return null;
                  const startFrom =
                      link.type === "PR_SS" || link.type === "PR_SF",
                    finishTo = link.type === "PR_FF" || link.type === "PR_SF";
                  const a = startFrom ? from.row.start : from.row.finish,
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
                  const mid = Math.max(left + 10, right - 12);
                  return (
                    <path
                      key={link.sourceLine}
                      d={`M ${left} ${from.index * rowHeight + 32} H ${mid} V ${to.index * rowHeight + 32} H ${right}`}
                      fill="none"
                      stroke="#475569"
                      strokeWidth="1.25"
                      markerEnd={`url(#${marker})`}
                    />
                  );
                })}
            </svg>
            {rows.map((row) => {
              const bar = sourceBar(row, anchor, axis.span, axis.unit);
              return (
                <div
                  key={row.internalId}
                  className="relative h-16 border-b border-slate-200"
                >
                  {bar ? (
                    <button
                      onClick={(e) => onSelect(row.internalId, e.currentTarget)}
                      aria-label={`View ${row.activityId}: ${row.name}`}
                      title={`${row.activityId}: ${row.start ?? row.finish} – ${row.finish ?? row.start}`}
                      className="absolute top-3 flex h-10 items-center focus-visible:outline-2 focus-visible:outline-blue-700"
                      style={{ left: bar.left, width: bar.width }}
                    >
                      <span
                        className={
                          row.milestone
                            ? "size-3 rotate-45 bg-slate-800"
                            : `h-5 w-full rounded-sm ${row.status === "TK_Complete" ? "bg-emerald-700" : row.status === "TK_Active" ? "bg-amber-700" : row.status === "TK_NotStart" ? "bg-blue-700" : "bg-slate-600"}`
                        }
                      />
                    </button>
                  ) : (
                    <span className="absolute top-6 left-3 text-xs text-slate-600">
                      {row.start || row.finish
                        ? "Outside this date range"
                        : "Dates not recorded"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
