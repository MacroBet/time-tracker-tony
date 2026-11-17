import { strict as assert } from "node:assert";
import { test } from "node:test";
import { dragGanttDates, ganttDateDelta } from "../src/lib/gantt-date-drag";

test("date snapping is symmetric at half a day and follows the current scale", () => {
  assert.equal(ganttDateDelta(23, 48), 0);
  assert.equal(ganttDateDelta(-23, 48), 0);
  assert.equal(ganttDateDelta(24, 48), 1);
  assert.equal(ganttDateDelta(-24, 48), -1);
  assert.equal(ganttDateDelta(24, 12), 2);
  assert.equal(ganttDateDelta(24, 4), 6);
  assert.equal(ganttDateDelta(24, 0), 0);
});

test("moving a range retains its inclusive span across leap days and year changes", () => {
  assert.deepEqual(
    dragGanttDates(
      { id: "work", start: "2028-02-28", finish: "2028-03-01" },
      "move",
      1,
    ),
    { start: "2028-02-29", finish: "2028-03-02" },
  );
  assert.deepEqual(
    dragGanttDates(
      { id: "work", start: "2026-12-30", finish: "2027-01-02" },
      "move",
      -2,
    ),
    { start: "2026-12-28", finish: "2026-12-31" },
  );
});

test("resizing cannot cross the recorded opposite endpoint", () => {
  const work = { id: "work", start: "2026-11-17", finish: "2026-11-20" };
  assert.deepEqual(dragGanttDates(work, "start", 7), {
    start: "2026-11-20",
    finish: "2026-11-20",
  });
  assert.deepEqual(dragGanttDates(work, "finish", -7), {
    start: "2026-11-17",
    finish: "2026-11-17",
  });
});

test("deadline and milestone moves preserve missing data and point semantics", () => {
  assert.deepEqual(
    dragGanttDates({ id: "due", finish: "2026-11-17" }, "move", 2),
    { finish: "2026-11-19" },
  );
  assert.equal(
    dragGanttDates({ id: "due", finish: "2026-11-17" }, "start", 2),
    null,
  );
  const milestone = {
    id: "milestone",
    milestone: true,
    start: "2026-11-17",
    finish: "2026-11-17",
  };
  assert.deepEqual(dragGanttDates(milestone, "move", 2), {
    start: "2026-11-19",
    finish: "2026-11-19",
  });
  assert.equal(dragGanttDates(milestone, "finish", 2), null);
});

test("date-range limits clamp a whole move without shortening its span", () => {
  assert.deepEqual(
    dragGanttDates(
      { id: "end", start: "9999-12-29", finish: "9999-12-31" },
      "move",
      200,
    ),
    { start: "9999-12-29", finish: "9999-12-31" },
  );
  assert.deepEqual(
    dragGanttDates(
      { id: "start", start: "0001-01-01", finish: "0001-01-04" },
      "move",
      -200,
    ),
    { start: "0001-01-01", finish: "0001-01-04" },
  );
});

test("invalid, inverted, undated and fractional date proposals are refused", () => {
  for (const row of [
    { id: "bad", start: "2026-02-30" },
    { id: "bad", start: "2026-11-20", finish: "2026-11-17" },
    { id: "empty" },
  ])
    assert.equal(dragGanttDates(row, "move", 1), null);
  assert.equal(
    dragGanttDates({ id: "bad", start: "2026-11-17" }, "move", 0.5),
    null,
  );
});
