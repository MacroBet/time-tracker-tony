import {
  ganttAxis,
  ganttLabelBounds,
  type GanttScale,
  type GanttHorizon,
} from "@/lib/gantt-axis";

/** Shared calendar presentation for the editable and source programme Gantts. */
export function GanttRuler({
  start,
  scale,
  horizon = null,
  today,
  viewport,
}: {
  start: string;
  scale: GanttScale;
  horizon?: GanttHorizon;
  today?: string;
  viewport?: { from: number; to: number };
}) {
  const { columns, width, unit } = ganttAxis(start, scale, horizon);
  return (
    <div
      className="relative h-14 bg-slate-50 text-xs font-medium text-slate-700"
      style={{ width }}
    >
      {columns.map((column, i) => {
        const columnWidth =
          scale === "day"
            ? unit
            : (columns[i + 1]?.left ?? width) - column.left;
        const label = ganttLabelBounds(
          column.left,
          column.left + columnWidth,
          scale === "day" ? undefined : viewport,
        );
        return (
          <span
            key={column.date}
            className={`absolute inset-y-0 border-l border-slate-200 tabular-nums ${column.date === today ? "bg-blue-100 text-blue-950" : scale === "day" && column.weekend ? "bg-slate-100" : ""}`}
            style={{
              left: column.left,
              width: columnWidth,
            }}
            title={column.date}
          >
            <span
              className="absolute inset-y-0 flex flex-col items-center justify-center gap-1 overflow-hidden whitespace-nowrap"
              style={{
                left: label?.left ?? 0,
                width: label?.width ?? columnWidth,
                visibility: label ? "visible" : "hidden",
              }}
            >
              <time dateTime={column.date}>{column.label}</time>
              {scale === "day" && (
                <span className="font-normal text-slate-600">
                  {column.weekday}
                </span>
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
}
