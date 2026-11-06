import type { SourceActivityView } from "./programme-source";
import { dayNumber } from "./scheduling";

/** Position the source view, without changing any source date or duration. */
export function sourcePageAnchor(rows: readonly SourceActivityView[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const date = row.start ?? row.finish;
    if (date) counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  // A few long-running procurement rows must not hide the page's main work.
  // Pick a recorded date cluster; ties use the earliest date, never today.
  const dates = [...counts.keys()].sort(
    (a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b),
  );
  return dates[0]
    ? new Date((dayNumber(dates[0]) - 2) * 86400000).toISOString().slice(0, 10)
    : undefined;
}
export function sourceBar(
  row: SourceActivityView,
  anchor: string,
  span: number,
  unit: number,
) {
  const date = row.start ?? (row.milestone ? row.finish : undefined);
  if (!date) return undefined;
  const start = dayNumber(date) - dayNumber(anchor);
  const finish = row.milestone
    ? start
    : row.finish
      ? dayNumber(row.finish) - dayNumber(anchor)
      : start;
  if (finish < start || start >= span || finish < 0) return undefined;
  return {
    left: Math.max(0, start) * unit,
    width: row.milestone
      ? 12
      : Math.max(2, (Math.min(span, finish + 1) - Math.max(0, start)) * unit),
    start,
    finish,
  };
}
