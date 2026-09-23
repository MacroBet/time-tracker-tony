import test from "node:test";
import assert from "node:assert/strict";
import { createDemoData } from "../src/lib/demo-data";
import {
  commissioning,
  tagRows,
  tagSummary,
  linkError,
  filterTasks,
  hasModule,
  cxSchema,
} from "../src/lib/commissioning";
import {
  mergeRegister,
  registerImportSchema,
} from "../src/lib/commissioning-import";
import { scopeData } from "../src/lib/permissions";
import { isOverdue } from "../src/lib/domain";
import { taskPlanSchema } from "../src/lib/validation";
const now = new Date("2026-09-22T12:00:00Z");

test("tag progress counts applicable asset-level obligations, including missing records, without double counting issues", () => {
  const data = createDemoData(now),
    p = data.projects[0];
  assert.equal(tagRows(p, data.tasks).length, 12);
  assert.deepEqual(tagSummary(p, data.tasks), {
    total: 12,
    completed: 2,
    percent: 17,
  });
  assert.deepEqual(tagSummary(p, data.tasks, "L1"), {
    total: 0,
    completed: 0,
    percent: null,
  });
  const tag = data.tasks.find((t) => t.id === "demo-tag-0")!;
  tag.status = "not-applicable";
  assert.deepEqual(tagSummary(p, data.tasks), {
    total: 11,
    completed: 1,
    percent: 9,
  });
  p.commissioning!.config.levels = p.commissioning!.config.levels.filter(
    (l) => l !== "L2A",
  );
  assert.equal(
    tagRows(p, data.tasks).some((r) => r.level === "L2A"),
    false,
  );
});

test("forecast revision updates overdue tasks while delivery expectations and baseline do not", () => {
  const data = createDemoData(now),
    user = data.users.find((u) => u.id === "u4")!;
  assert(isOverdue(scopeData(user, data).tasks[0], now));
  const state = commissioning(data.projects[0]);
  const revised = mergeRegister(state, {
    assets: [],
    schedule: [
      {
        activityId: "AMS16-DEMO-1040",
        name: "SBLVB test",
        finish: "2026-09-25",
        baselineFinish: "2099-01-01",
      },
    ],
  });
  assert.equal(revised.errors.length, 0);
  assert.equal(revised.schedule[0].baselineFinish, "2026-09-19");
  state.schedule = revised.schedule;
  assert.equal(isOverdue(scopeData(user, data).tasks[0], now), false);
  state.schedule[0].finish = "2026-09-22";
  assert.equal(isOverdue(scopeData(user, data).tasks[0], now), false);
});

test("register imports are idempotent, reject duplicate IDs, unknown schedule links and disabled levels", () => {
  const state = commissioning();
  const first = mergeRegister(state, {
    assets: [],
    schedule: [{ activityId: "A1", name: "Test", finish: "2026-09-20" }],
  });
  const next = { ...state, schedule: first.schedule };
  assert.equal(
    mergeRegister(next, {
      assets: [],
      schedule: [{ activityId: "A1", name: "Test", finish: "2026-09-20" }],
    }).changes.length,
    0,
  );
  assert(
    mergeRegister(state, {
      assets: [],
      schedule: [
        { activityId: "A1", name: "one" },
        { activityId: "A1", name: "two" },
      ],
    }).errors.length,
  );
  assert(
    mergeRegister(state, {
      assets: [
        {
          id: "x",
          name: "Asset",
          equipmentType: "Pump",
          location: "",
          levels: ["L1"],
          deliveryActivityId: "missing",
        },
      ],
      schedule: [],
    }).errors.length === 2,
  );
  assert.equal(
    registerImportSchema.safeParse({
      assets: [],
      schedule: [
        {
          activityId: "A",
          name: "Test",
          start: "2026-09-23",
          finish: "2026-09-22",
        },
      ],
    }).success,
    false,
  );
});

test("asset and level links are checked in project scope; duplicate tag records are rejected", () => {
  const data = createDemoData(now),
    p = data.projects[0];
  assert(
    linkError(
      { kind: "tag", result: "untested", assetId: "S201_SBLVB", level: "L2A" },
      p,
      data.tasks,
    ),
  );
  assert(
    linkError(
      { kind: "tag", result: "untested", assetId: "elsewhere", level: "L3" },
      p,
      data.tasks,
    ),
  );
  assert(
    linkError(
      { kind: "tag", result: "untested", assetId: "S201_CGM01", level: "L1" },
      p,
      data.tasks,
    ),
  );
  assert.equal(
    cxSchema.safeParse({ kind: "tag", result: "untested" }).success,
    false,
  );
  assert.equal(
    linkError(
      { kind: "tag", result: "untested", assetId: "S201_CGM01", level: "L3" },
      p,
      data.tasks,
    ),
    null,
  );
});

test("filters combine level, equipment, priority, date and test failure independently of workflow", () => {
  const data = createDemoData(now),
    p = data.projects[0];
  const rows = scopeData(
    data.users.find((u) => u.id === "u4")!,
    data,
  ).tasks;
  assert.equal(
    filterTasks(
      rows,
      p,
      {
        level: "L4",
        equipmentType: "Switchboard",
        priority: "P1",
        dueTo: "2026-09-21",
        query: "AMS16-DEMO-1040",
      },
      now,
    ).length,
    1,
  );
  assert.equal(filterTasks(rows, p, { attention: "failed" }, now)[0].id, "t2");
  assert.equal(filterTasks(rows, p, { level: "L1" }, now).length, 0);
});

test("task-only workers cannot read time records or unrelated asset/schedule history", () => {
  const data = createDemoData(now),
    user = { ...data.users[0], modules: ["tasks"] as const };
  const restricted = { ...user, modules: [...user.modules] };
  const scoped = scopeData(restricted, data);
  assert.equal(scoped.shifts.length, 0);
  assert.equal(hasModule(restricted, "time"), false);
  assert.equal(
    hasModule({ ...restricted, modules: ["dashboard"] }, "dashboard"),
    false,
  );
  assert(
    scoped.projects[0].commissioning!.assets.every((a) =>
      scoped.tasks.some((t) => t.cx?.assetId === a.id),
    ),
  );
  assert.equal(scoped.projects[0].commissioning!.revisions.length, 0);
});

test("P4/P5 survive validation and invalid progress is rejected", () => {
  for (const priority of ["P4", "P5"])
    assert(
      taskPlanSchema.safeParse({
        version: 1,
        title: "Example activity",
        description: "",
        priority,
        dueDate: null,
        discipline: "Cx",
        location: "",
        reason: "Project requirement",
      }).success,
    );
  assert.equal(
    cxSchema.safeParse({ kind: "task", result: "passed", progress: 101 })
      .success,
    false,
  );
});

test("reimport preserves separately recorded actuals and treats JSON key order as irrelevant", () => {
  const state = commissioning();
  state.schedule = [
    {
      name: "Test",
      activityId: "A1",
      finish: "2026-09-20",
      baselineFinish: "2026-09-20",
      actualFinish: "2026-09-21",
    },
  ];
  const result = mergeRegister(state, {
    assets: [],
    schedule: [{ activityId: "A1", name: "Test", finish: "2026-09-20" }],
  });
  assert.equal(result.changes.length, 0);
  assert.equal(result.schedule[0].actualFinish, "2026-09-21");
});
