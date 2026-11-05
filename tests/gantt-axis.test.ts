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

test("Weeks and Months preserve their span, width and weekly header ticks", () => {
  for (const [scale, span, unit] of [
    ["week", 100, 12],
    ["month", 365, 4],
  ] as const) {
    const axis = ganttAxis("2026-10-13", scale);
    assert.equal(axis.span, span);
    assert.equal(axis.unit, unit);
    assert.equal(axis.width, span * unit);
    assert.equal(axis.columns.length, Math.ceil(span / 7));
    assert.equal(axis.columns[0].label, "13 Oct 26");
    assert.equal(axis.columns[1].date, "2026-10-20");
    assert.equal(axis.columns[1].left, 7 * unit);
  }
});
