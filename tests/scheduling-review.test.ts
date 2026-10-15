import test from "node:test";
import assert from "node:assert/strict";
import {
  recalculateSchedule,
  addWorkdays,
  nextWorkday,
  workingDuration,
} from "../src/lib/scheduling";
import { mergeRegister } from "../src/lib/commissioning-import";
import {
  commissioning,
  scheduleSchema,
  type ScheduleActivity,
} from "../src/lib/commissioning";

test("calendar counts inclusive working days and respects weekends across year boundaries", () => {
  assert.equal(nextWorkday("2026-10-17"), "2026-10-19");
  assert.equal(nextWorkday("2026-10-18"), "2026-10-19");
  assert.equal(workingDuration("2026-10-16", "2026-10-19"), 2);
  assert.equal(workingDuration("2026-12-28", "2027-01-01"), 5);
  assert.equal(addWorkdays("2026-12-28", 5), "2027-01-04");
});
test("FS lag applies after a weekend actual finish and chooses the latest of several predecessors", () => {
  const input: ScheduleActivity[] = [
    {
      activityId: "A",
      name: "Historical delivery",
      finish: "2026-10-20",
      actualFinish: "2026-10-17",
    },
    { activityId: "B", name: "Clearance", finish: "2026-10-20" },
    {
      activityId: "C",
      name: "Installation",
      start: "2026-10-01",
      durationDays: 3,
      predecessors: [
        { activityId: "A", lagDays: 1 },
        { activityId: "B", lagDays: 0 },
      ],
    },
  ];
  const result = recalculateSchedule(input);
  assert.deepEqual(result.errors, []);
  assert.equal(result.schedule[2].start, "2026-10-21");
  assert.equal(result.schedule[2].finish, "2026-10-23");
  assert.equal(
    input[2].start,
    "2026-10-01",
    "Calculation does not mutate the caller's saved state.",
  );
});
test("moving a predecessor earlier releases successors while their own earliest starts remain binding", () => {
  const rows: ScheduleActivity[] = [
    { activityId: "A", name: "Delivery", start: "2026-10-19", durationDays: 1 },
    {
      activityId: "B",
      name: "Installation",
      start: "2026-10-16",
      notBefore: "2026-10-16",
      durationDays: 1,
      predecessors: [{ activityId: "A", lagDays: 0 }],
    },
  ];
  const first = recalculateSchedule(rows);
  assert.equal(first.schedule[1].start, "2026-10-20");
  const next = recalculateSchedule(
    first.schedule.map((row) =>
      row.activityId === "A" ? { ...row, notBefore: "2026-10-14" } : row,
    ),
  );
  assert.deepEqual(next.errors, []);
  assert.equal(next.schedule[1].start, "2026-10-16");
  assert.equal(next.schedule[1].baselineStart, first.schedule[1].baselineStart);
});
test("missing links, cycles and dependency failures reject merges without altering persisted snapshots", () => {
  const saved = {
    ...commissioning(),
    schedule: [
      {
        activityId: "A",
        name: "Delivery",
        start: "2026-10-15",
        finish: "2026-10-16",
      },
    ],
  };
  const snapshot = structuredClone(saved);
  const invalid = mergeRegister(saved, {
    assets: [],
    schedule: [
      scheduleSchema.parse({
        activityId: "B",
        name: "Installation",
        start: "2026-10-19",
        durationDays: 1,
        predecessors: [{ activityId: "absent" }],
      }),
    ],
  });
  assert(invalid.errors.some((error) => error.includes("not found")));
  assert.deepEqual(saved, snapshot);
  const cyclic = recalculateSchedule([
    {
      activityId: "A",
      name: "First",
      start: "2026-10-15",
      durationDays: 1,
      predecessors: [{ activityId: "B", lagDays: 0 }],
    },
    {
      activityId: "B",
      name: "Second",
      start: "2026-10-15",
      durationDays: 1,
      predecessors: [{ activityId: "A", lagDays: 0 }],
    },
  ]);
  assert(cyclic.errors.some((error) => error.includes("cycle")));
  const undated = recalculateSchedule([
    { activityId: "A", name: "Unscheduled delivery" },
    {
      activityId: "B",
      name: "Install",
      start: "2026-10-15",
      durationDays: 1,
      predecessors: [{ activityId: "A", lagDays: 0 }],
    },
  ]);
  assert(undated.errors.some((error) => error.includes("finish date")));
});
test("legacy finish-only records remain unchanged and baseline dates survive managed forecast revisions", () => {
  const legacy = {
    activityId: "Legacy",
    name: "Legacy export",
    finish: "2026-10-17",
    source: "P6",
  };
  assert.deepEqual(recalculateSchedule([legacy]).schedule[0], legacy);
  const saved = {
    ...commissioning(),
    schedule: [
      {
        activityId: "A",
        name: "Install",
        start: "2026-10-15",
        finish: "2026-10-16",
        notBefore: "2026-10-15",
        durationDays: 2,
        baselineStart: "2026-10-12",
        baselineFinish: "2026-10-13",
      },
    ],
  };
  const result = mergeRegister(saved, {
    assets: [],
    schedule: [
      {
        activityId: "A",
        name: "Install",
        notBefore: "2026-10-19",
        baselineStart: "2030-01-01",
        baselineFinish: "2030-12-31",
      },
    ],
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.schedule[0].start, "2026-10-19");
  assert.equal(result.schedule[0].finish, "2026-10-20");
  assert.equal(result.schedule[0].baselineStart, "2026-10-12");
  assert.equal(result.schedule[0].baselineFinish, "2026-10-13");
});

test("actual completion freezes historical dates and rejects dependencies that would move them", () => {
  const complete: ScheduleActivity = {
    activityId: "DONE",
    name: "Completed install",
    start: "2026-10-17",
    finish: "2026-10-19",
    actualFinish: "2026-10-18",
    durationDays: 2,
  };
  const result = recalculateSchedule([complete]);
  assert.deepEqual(result.errors, []);
  assert.equal(
    result.schedule[0].start,
    "2026-10-17",
    "Weekend actual start is preserved.",
  );
  assert.equal(result.schedule[0].finish, "2026-10-19");
  assert.equal(result.schedule[0].actualFinish, "2026-10-18");
  const invalidInput: ScheduleActivity[] = [
    { activityId: "P", name: "Prerequisite", finish: "2026-10-30" },
    { ...complete, predecessors: [{ activityId: "P", lagDays: 0 }] },
  ];
  const invalid = recalculateSchedule(invalidInput);
  assert(invalid.errors.some((error) => error.includes("completed activity")));
  assert.deepEqual(
    invalid.schedule,
    invalidInput,
    "An invalid programme does not expose partly shifted forecasts.",
  );
  assert.deepEqual(invalid.changes, []);
  assert(
    !scheduleSchema.safeParse({ ...complete, actualFinish: "2026-10-16" })
      .success,
  );
});
test("legacy start/finish edits update managed constraints rather than being silently reverted", () => {
  const saved = {
    ...commissioning(),
    schedule: [
      {
        activityId: "A",
        name: "Managed",
        start: "2026-10-15",
        finish: "2026-10-16",
        notBefore: "2026-10-15",
        durationDays: 2,
        baselineStart: "2026-10-15",
        baselineFinish: "2026-10-16",
      },
    ],
  };
  const moved = mergeRegister(saved, {
    assets: [],
    schedule: [
      {
        activityId: "A",
        name: "Managed",
        start: "2026-11-02",
        finish: "2026-11-04",
      },
    ],
  });
  assert.deepEqual(moved.errors, []);
  assert.equal(moved.schedule[0].notBefore, "2026-11-02");
  assert.equal(moved.schedule[0].durationDays, 3);
  assert.equal(moved.schedule[0].start, "2026-11-02");
  assert.equal(moved.schedule[0].finish, "2026-11-04");
  assert.equal(moved.schedule[0].baselineStart, "2026-10-15");
  const finishOnly = mergeRegister(saved, {
    assets: [],
    schedule: [{ activityId: "A", name: "Managed", finish: "2026-10-20" }],
  });
  assert.deepEqual(finishOnly.errors, []);
  assert.equal(finishOnly.schedule[0].durationDays, 4);
  assert.equal(finishOnly.schedule[0].finish, "2026-10-20");
  const conflict = mergeRegister(saved, {
    assets: [],
    schedule: [
      {
        activityId: "A",
        name: "Managed",
        start: "2026-11-02",
        finish: "2026-11-04",
        durationDays: 1,
      },
    ],
  });
  assert(
    conflict.errors.some((error) =>
      error.includes("conflicts with the working-day duration"),
    ),
  );
});
test("first managed baseline uses the calculated forecast after its predecessors", () => {
  const result = mergeRegister(commissioning(), {
    assets: [],
    schedule: [
      { activityId: "P", name: "Delivery", finish: "2026-10-23" },
      {
        activityId: "A",
        name: "Install",
        start: "2026-10-15",
        durationDays: 2,
        predecessors: [{ activityId: "P", lagDays: 0 }],
      },
    ],
  });
  assert.deepEqual(result.errors, []);
  const activity = result.schedule[1];
  assert.equal(activity.start, "2026-10-26");
  assert.equal(activity.finish, "2026-10-27");
  assert.equal(activity.baselineStart, activity.start);
  assert.equal(activity.baselineFinish, activity.finish);
  assert.equal(
    mergeRegister(
      { ...commissioning(), schedule: result.schedule },
      { assets: [], schedule: result.schedule },
    ).changes.length,
    0,
  );
});
test("engine validates old saved scheduling fields and rejects unrepresentable date ranges", () => {
  assert(
    recalculateSchedule([
      {
        activityId: "A",
        name: "Bad old duration",
        start: "2026-10-15",
        durationDays: 0,
      },
    ]).errors.length,
  );
  assert(
    recalculateSchedule([
      {
        activityId: "A",
        name: "Invalid date",
        start: "2026-02-30",
        durationDays: 1,
      },
    ]).errors.length,
  );
  assert(
    recalculateSchedule([
      {
        activityId: "A",
        name: "Overflow",
        start: "9999-12-31",
        durationDays: 2,
      },
    ]).errors.length,
  );
  assert(
    !scheduleSchema.safeParse({
      activityId: "A",
      name: "Baseline reversed",
      baselineStart: "2026-10-20",
      baselineFinish: "2026-10-15",
    }).success,
  );
  assert.throws(() => addWorkdays("2026-10-17", 1));
});

test("partially supplied baselines cannot become inverted during initial forecast calculation", () => {
  const result = mergeRegister(commissioning(), {
    assets: [],
    schedule: [
      {
        activityId: "A",
        name: "Install",
        start: "2026-10-19",
        durationDays: 1,
        baselineStart: "2027-01-01",
      },
    ],
  });
  assert(
    result.errors.some((error) => error.includes("Baseline finish precedes")),
  );
});
