import { dayNumber } from "./scheduling";

export type GanttScale = "day" | "week" | "month";

/** Calendar columns only: this does not change the programme's working calendar. */
export function ganttAxis(start: string, scale: GanttScale) {
  const span = scale === "day" ? 35 : scale === "week" ? 100 : 365;
  const unit = scale === "day" ? 48 : scale === "week" ? 12 : 4;
  const step = scale === "day" ? 1 : 7;
  const startDay = dayNumber(start);
  const offsets =
    scale === "month"
      ? [0]
      : Array.from({ length: Math.ceil(span / step) }, (_, i) => i * step);
  if (scale === "month") {
    const first = new Date(startDay * 86400000);
    for (let month = 1; month <= 12; month++) {
      const date = new Date(
        Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + month, 1),
      );
      const offset = Math.round(date.getTime() / 86400000) - startDay;
      if (offset < span && offset >= 14 && span - offset >= 14)
        offsets.push(offset);
    }
  }
  const columns = offsets.map((offset) => {
    const date = new Date((startDay + offset) * 86_400_000);
    return {
      date: date.toISOString().slice(0, 10),
      left: offset * unit,
      label: new Intl.DateTimeFormat("en-GB", {
        ...(scale === "month" ? {} : { day: "2-digit" as const }),
        month: "short",
        ...(scale === "day" ? {} : { year: "2-digit" }),
        timeZone: "UTC",
      }).format(date),
      weekday: new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        timeZone: "UTC",
      }).format(date),
      weekend: date.getUTCDay() === 0 || date.getUTCDay() === 6,
    };
  });
  return { span, unit, width: span * unit, columns };
}
