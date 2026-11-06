import test from "node:test";
import assert from "node:assert/strict";
import { ganttAxis } from "../src/lib/gantt-axis";
import { calendarDays } from "../src/lib/scheduling";

test("Days gives every calendar date a readable column aligned to activity coordinates", () => {
  const axis = ganttAxis("2026-10-13", "day");
  assert.equal(axis.columns.length, 35);
  assert.equal(axis.unit, 48);
  assert.equal(axis.width, 1680);
  assert.deepEqual(axis.columns[0], {
    date: "2026-10-13",
    left: 0,
    label: "13 Oct",
    weekday: "Tue",
    weekend: false,
  });
  assert.equal(axis.columns.at(-1)!.date, "2026-11-16");
  for (const [i, column] of axis.columns.entries()) {
    assert.equal(calendarDays("2026-10-13", column.date), i);
    assert.equal(column.left, i * axis.unit);
    assert.equal(column.left + axis.unit <= axis.width, true);
    assert.equal(column.weekend, ["Sat", "Sun"].includes(column.weekday));
  }
  assert.equal(
    axis.columns.find((c) => c.date === "2026-11-01")!.label,
    "01 Nov",
  );
});

test("daily columns retain weekends and leap dates across calendar boundaries", () => {
  const leap = ganttAxis("2028-02-28", "day");
  assert.deepEqual(
    leap.columns.slice(0, 3).map((c) => c.date),
    ["2028-02-28", "2028-02-29", "2028-03-01"],
  );
  const year = ganttAxis("2026-12-31", "day");
  assert.equal(year.columns[1].date, "2027-01-01");
  assert.equal(year.columns[1].label, "01 Jan");
});

test("Weeks retain weekly ticks; Months use readable calendar-month spacing", () => {
  const week = ganttAxis("2026-10-13", "week");
  assert.equal(week.columns[1].date, "2026-10-20");
  assert.equal(week.columns[1].left, 84);
  const month = ganttAxis("2026-10-13", "month");
  assert.equal(month.span, 365);
  assert.equal(month.unit, 4);
  assert.equal(month.width, 1460);
  assert.equal(month.columns[0].label, "Oct 26");
  assert.equal(month.columns[1].date, "2026-11-01");
  for (let i = 1; i < month.columns.length; i++)
    assert(month.columns[i].left - month.columns[i - 1].left >= 56);
});
