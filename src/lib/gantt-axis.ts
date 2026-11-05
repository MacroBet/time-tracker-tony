import { dayNumber } from "./scheduling";

export type GanttScale = "day" | "week" | "month";

/** Calendar columns only: this does not change the programme's working calendar. */
export function ganttAxis(start: string, scale: GanttScale) {
  const span = scale === "day" ? 35 : scale === "week" ? 100 : 365;
  const unit = scale === "day" ? 48 : scale === "week" ? 12 : 4;
  const step = scale === "day" ? 1 : 7;
  const startDay = dayNumber(start);
  const columns = Array.from({ length: Math.ceil(span / step) }, (_, i) => {
    const date = new Date((startDay + i * step) * 86_400_000);
    return {
      date: date.toISOString().slice(0, 10),
      left: i * step * unit,
      label: new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
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
