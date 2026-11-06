import type { SourceActivityView } from "./programme-source";
import { dayNumber } from "./scheduling";

/** Position the source view, without changing any source date or duration. */
export function sourcePageAnchor(rows: readonly SourceActivityView[]) {
  const dates = rows
    .flatMap((row) =>
      row.start ? [row.start] : row.finish ? [row.finish] : [],
    )
    .sort();
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
