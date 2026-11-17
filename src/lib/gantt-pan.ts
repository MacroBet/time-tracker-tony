import { dayNumber } from "./scheduling";

/** View navigation only: a drag right reveals earlier dates, without editing records. */
export function pannedScheduleDate(
  date: string,
  pixels: number,
  pixelsPerDay: number,
) {
  const day = dayNumber(date);
  if (
    !Number.isFinite(day) ||
    !Number.isFinite(pixels) ||
    !Number.isFinite(pixelsPerDay) ||
    pixelsPerDay <= 0
  )
    return date;
  const delta = Math.sign(pixels) * Math.round(Math.abs(pixels) / pixelsPerDay);
  const next = Math.max(
    dayNumber("0001-01-01"),
    Math.min(dayNumber("9999-12-31"), day - delta),
  );
  return new Date(next * 86400000).toISOString().slice(0, 10);
}
