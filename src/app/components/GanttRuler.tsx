import { ganttAxis, type GanttScale } from "@/lib/gantt-axis";

/** Shared calendar presentation for the editable and source programme Gantts. */
export function GanttRuler({
  start,
  scale,
}: {
  start: string;
  scale: GanttScale;
}) {
  const { columns, width, unit } = ganttAxis(start, scale);
  return (
    <div
      className="relative h-14 bg-slate-50 text-xs font-medium text-slate-700"
      style={{ width }}
    >
      {columns.map((column, i) => (
        <span
          key={column.date}
          className={`absolute inset-y-0 flex flex-col items-center justify-center gap-1 border-l border-slate-200 tabular-nums ${scale === "day" && column.weekend ? "bg-slate-100" : ""}`}
          style={{
            left: column.left,
            width:
              scale === "day"
                ? unit
                : (columns[i + 1]?.left ?? width) - column.left,
          }}
          title={column.date}
        >
          <time dateTime={column.date}>{column.label}</time>
          {scale === "day" && (
            <span className="font-normal text-slate-600">{column.weekday}</span>
          )}
        </span>
      ))}
    </div>
  );
}
