import test from "node:test";
import assert from "node:assert/strict";
import { projectDate } from "../src/lib/domain";
import { ganttAxis } from "../src/lib/gantt-axis";
import {
  sourceGanttInitialView,
  reduceSourceGanttView,
  sourceViewport,
  shiftSourceDate,
  sourceGanttViewCommandSchema,
  sourceCriticalityLabel,
} from "../src/lib/source-gantt";

test("opening and reset use the project calendar date, independently of source clusters and saved view anchors", () => {
  const today = projectDate(new Date("2026-11-15T23:30:00Z"));
  assert.equal(today, "2026-11-16");
  const defaults = { anchor: "2025-03-01", durationMode: "hours" as const };
  const initial = sourceGanttInitialView(today, defaults);
  assert.equal(initial.anchor, today);
  assert.equal(initial.durationMode, "hours");
  const future = reduceSourceGanttView(
    initial,
    { type: "date", date: "2026-12-05" },
    today,
  );
  assert.equal(
    reduceSourceGanttView(future, { type: "today" }, today).anchor,
    today,
  );
  assert.deepEqual(
    reduceSourceGanttView(future, { type: "reset" }, today, defaults),
    initial,
  );
  assert.equal(defaults.anchor, "2025-03-01");
});

test("the date input follows horizontal panning under the sticky name, including the November/December regression", () => {
  const axis = ganttAxis("2026-11-16", "day");
  const metrics = {
    clientWidth: 1100,
    nameWidth: 280,
    otherColumnsWidth: 440,
    axisWidth: axis.width,
    unit: axis.unit,
  };
  const start = sourceViewport({ ...metrics, scrollLeft: 0 });
  assert.equal(start.dayOffset, 0);
  assert.equal(start.to, 380);
  const december = sourceViewport({ ...metrics, scrollLeft: 440 + 19 * 48 });
  assert.equal(shiftSourceDate("2026-11-16", december.dayOffset), "2026-12-05");
  const reset = sourceViewport({ ...metrics, scrollLeft: 0 });
  assert.equal(shiftSourceDate("2026-11-16", reset.dayOffset), "2026-11-16");
  // Mobile starts after metadata; that offset must not be mistaken for future days.
  const mobile = sourceViewport({
    ...metrics,
    clientWidth: 390,
    nameWidth: 180,
    scrollLeft: 440,
  });
  assert.equal(mobile.dayOffset, 0);
  assert.equal(mobile.to, 210);
});

test("hiding metadata preserves the visible date and frees chart space on the same viewport", () => {
  const metrics = {
    clientWidth: 1100,
    nameWidth: 280,
    axisWidth: 1680,
    unit: 48,
  };
  const before = sourceViewport({
    ...metrics,
    otherColumnsWidth: 440,
    scrollLeft: 440 + 11 * 48,
  });
  const hidden = sourceViewport({
    ...metrics,
    otherColumnsWidth: 176,
    scrollLeft: 176 + before.from,
  });
  assert.equal(hidden.dayOffset, before.dayOffset);
  assert.equal(hidden.to - hidden.from, before.to - before.from);
  const atStart = sourceViewport({
    ...metrics,
    otherColumnsWidth: 176,
    scrollLeft: 0,
  });
  const original = sourceViewport({
    ...metrics,
    otherColumnsWidth: 440,
    scrollLeft: 0,
  });
  assert.equal(atStart.to - original.to, 264);
});

test("window length and calendar granularity are independent display choices, with exact 2/4/6-week spans", () => {
  const initial = sourceGanttInitialView("2026-11-16");
  const serialised = JSON.stringify(initial);
  for (const horizon of [14, 28, 42] as const) {
    const window = reduceSourceGanttView(
      initial,
      { type: "horizon", horizon },
      initial.anchor,
    );
    assert.equal(window.scale, "day");
    const weekly = reduceSourceGanttView(
      window,
      { type: "scale", scale: "week" },
      initial.anchor,
    );
    assert.equal(weekly.horizon, horizon);
    assert.equal(
      ganttAxis(weekly.anchor, weekly.scale, weekly.horizon).span,
      horizon,
    );
    assert.equal(
      reduceSourceGanttView(
        weekly,
        { type: "pan", direction: 1 },
        initial.anchor,
      ).anchor,
      shiftSourceDate(initial.anchor, horizon),
    );
    assert.equal(
      reduceSourceGanttView(
        weekly,
        { type: "pan", direction: -1 },
        initial.anchor,
      ).anchor,
      shiftSourceDate(initial.anchor, -horizon),
    );
  }
  assert.equal(JSON.stringify(initial), serialised);
  assert.equal(shiftSourceDate("2028-02-28", 1), "2028-02-29");
  assert.equal(shiftSourceDate("2026-10-24", 2), "2026-10-26");
});

test("display commands cannot target identities, modify dates on activities, or accept invalid calendar dates", () => {
  assert.deepEqual(sourceGanttViewCommandSchema.parse({ type: "show" }), {
    type: "show",
  });
  assert.equal(
    sourceGanttViewCommandSchema.safeParse({
      type: "show",
      activityId: "ACT-1",
    }).success,
    false,
  );
  assert.equal(
    sourceGanttViewCommandSchema.safeParse({ type: "date", date: "2026-02-30" })
      .success,
    false,
  );
  assert.equal(
    sourceGanttViewCommandSchema.safeParse({
      type: "column",
      column: "activityId",
      visible: false,
    }).success,
    false,
  );
  assert.equal(
    sourceGanttViewCommandSchema.safeParse({
      type: "date",
      date: "2026-11-16",
      activityId: "ACT-1",
    }).success,
    false,
  );
  const initial = sourceGanttInitialView("2026-11-16");
  assert.equal(
    reduceSourceGanttView(initial, { type: "show" }, initial.anchor),
    initial,
  );
  const serialised = JSON.stringify(initial);
  const hidden = reduceSourceGanttView(
    initial,
    { type: "column", column: "start", visible: false },
    initial.anchor,
  );
  assert.equal(hidden.columns.includes("start"), false);
  assert.equal(hidden.anchor, initial.anchor);
  assert.equal(JSON.stringify(initial), serialised);
});

test("criticality commands filter saved classifications independently of progress and represent missing float explicitly", () => {
  assert.equal(
    sourceGanttViewCommandSchema.safeParse({ type: "critical" }).success,
    false,
  );
  const initial = sourceGanttInitialView("2026-11-16");
  const critical = reduceSourceGanttView(
    initial,
    { type: "critical", filter: "yes" },
    initial.anchor,
  );
  assert.equal(critical.critical, "yes");
  assert.equal(critical.anchor, initial.anchor);
  assert.equal(critical.durationMode, initial.durationMode);
  assert.deepEqual(critical.columns, initial.columns);
  assert.match(
    sourceCriticalityLabel({
      state: "unknown",
      totalFloatHours: null,
      freeFloatHours: null,
      projectId: "p6",
      reason: "missing-total-float",
    }),
    /unknown: total float not recorded/,
  );
  assert.match(
    sourceCriticalityLabel({
      state: "critical",
      totalFloatHours: 0,
      freeFloatHours: null,
      projectId: "p6",
      reason: "saved-total-float",
    }),
    /Total float 0 source hours; free float not recorded/,
  );
  assert.equal(initial.critical, "all");
});
