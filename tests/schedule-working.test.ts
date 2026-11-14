import test from "node:test";
import assert from "node:assert/strict";
import {
  indexSourceProgramme,
  type SourceProgramme,
} from "../src/lib/programme-source";
import {
  canConfirmWorkingSchedule,
  nextWorkingActivityCode,
  managedWorkingSourceIndex,
  previewWorkingSchedule,
  resolveWorkingSourceIndex,
  workingManagedRows,
  workingScheduleDraftSchema,
  type WorkingScheduleDraft,
} from "../src/lib/schedule-working";
import { commissioning } from "../src/lib/commissioning";
const sha = "a".repeat(64),
  now = "2026-11-14T12:00:00.000Z";
function fixture(count = 4): SourceProgramme {
  return {
    format: "p6-xer-v1",
    source: {
      fileName: "offline.xer",
      sha256: sha,
      encoding: "utf-8",
      header: "Synthetic",
    },
    tables: {
      TASK: {
        fields: [
          "task_id",
          "task_code",
          "task_name",
          "target_drtn_hr_cnt",
          "early_start_date",
          "early_end_date",
          "clndr_id",
        ],
        rows: Array.from({ length: count }, (_, i) => [
          `i${i}`,
          `A${i}`,
          `Activity ${i}`,
          "15",
          "2026-11-14 08:00",
          "2026-11-15 17:00",
          "c",
        ]),
        lines: Array.from({ length: count }, (_, i) => i + 10),
      },
      CALENDAR: {
        fields: ["clndr_id", "clndr_name", "day_hr_cnt", "clndr_data"],
        rows: [["c", "Backshift", "15", "Saved exceptions"]],
        lines: [1],
      },
      TASKPRED: {
        fields: ["pred_task_id", "task_id", "pred_type", "lag_hr_cnt"],
        rows: Array.from({ length: count - 1 }, (_, i) => [
          `i${i}`,
          `i${i + 1}`,
          i === 0 ? "PR_SS" : "PR_FF",
          i === 0 ? "-2.5" : "0",
        ]),
        lines: Array.from({ length: count - 1 }, (_, i) => i + 100000),
      },
    },
  };
}
const draft = (fields: Record<string, unknown> = {}) =>
  workingScheduleDraftSchema.parse(
    Object.fromEntries(
      Object.entries({
        sourceSha256: sha,
        idempotencyKey: "offline-request-1",
        reason: "Explicit offline schedule review",
        kind: "edit-activity",
        internalId: "i0",
        finish: "2026-11-16",
        ...fields,
      }).filter(([, value]) => value !== undefined),
    ),
  );
const context = { userId: "manager", now, assetIds: ["asset-1"] };
test("working dates preserve source bytes, original types/lags/calendar and every downstream date", () => {
  const source = fixture(),
    before = JSON.stringify(source),
    index = indexSourceProgramme(source);
  const result = previewWorkingSchedule(index, undefined, draft(), context);
  assert.deepEqual(result.errors, []);
  assert.equal(result.impactedCount, 4);
  assert.equal(
    result.impactedActivities.filter((r) => r.datesChanged).length,
    1,
  );
  const projected = resolveWorkingSourceIndex(index, result.next);
  assert.equal(projected.activities[0].finish, "2026-11-16");
  assert.equal(projected.activities[1].finish, index.activities[1].finish);
  assert.equal(projected.links[0].type, "PR_SS");
  assert.equal(projected.links[0].lagHours, "-2.5");
  assert.deepEqual(
    projected.byId.get("i0")!.fields.early_end_date,
    "2026-11-15 17:00",
  );
  assert.equal(JSON.stringify(source), before);
  assert.equal(index.activities[0].finish, "2026-11-15");
});
test("full 16969-row graph rejects a distant cycle, missing ID, self-link and foreign removal", () => {
  const index = indexSourceProgramme(fixture(16969));
  for (const addLinks of [
    [
      {
        predecessorId: "i16968",
        successorId: "i0",
        type: "PR_FS",
        lagHours: 0,
      },
    ],
    [
      {
        predecessorId: "missing",
        successorId: "i0",
        type: "PR_FS",
        lagHours: 0,
      },
    ],
    [{ predecessorId: "i0", successorId: "i0", type: "PR_FS", lagHours: 0 }],
  ])
    assert(
      previewWorkingSchedule(index, undefined, draft({ addLinks }), context)
        .errors.length > 0,
    );
  assert(
    previewWorkingSchedule(
      index,
      undefined,
      draft({ removeLinkIds: [100001] }),
      context,
    ).errors.length > 0,
  );
});
test("multiple real predecessor/successor edits leave all other source edges unchanged", () => {
  const index = indexSourceProgramme(fixture());
  const result = previewWorkingSchedule(
    index,
    undefined,
    draft({
      internalId: "i1",
      finish: undefined,
      removeLinkIds: [100000],
      addLinks: [
        {
          predecessorId: "i0",
          successorId: "i1",
          type: "PR_SF",
          lagHours: 2.25,
        },
        { predecessorId: "i1", successorId: "i3", type: "PR_FS", lagHours: -1 },
      ],
    }),
    context,
  );
  assert.deepEqual(result.errors, []);
  const view = resolveWorkingSourceIndex(index, result.next);
  assert.equal(view.links.length, 4);
  assert.equal(view.links.find((l) => l.sourceLine === 100001)?.type, "PR_FF");
  assert.equal(view.links.filter((l) => l.sourceLine < 0).length, 2);
});
test("actual dates, mismatched source hashes, unsupported fields and malformed ranges fail closed", () => {
  const index = indexSourceProgramme(fixture());
  index.byId.get("i0")!.fields.act_end_date = "2026-11-15 17:00";
  assert(
    previewWorkingSchedule(index, undefined, draft(), context).errors.some(
      (e) => e.includes("Actual finish"),
    ),
  );
  assert(
    previewWorkingSchedule(
      index,
      undefined,
      draft({ sourceSha256: "b".repeat(64) }),
      context,
    ).errors.some((e) => e.includes("hash")),
  );
  assert(
    previewWorkingSchedule(
      index,
      undefined,
      draft({ start: "2026-12-01" }),
      context,
    ).errors.some((e) => e.includes("precede")),
  );
  assert.equal(
    workingScheduleDraftSchema.safeParse({
      ...draft(),
      baselineFinish: "2027-01-01",
    }).success,
    false,
  );
});
test("create has one new identity, deadline-only row and unassigned task contract; retries cannot duplicate", () => {
  const index = indexSourceProgramme(fixture()),
    create = draft({
      kind: "create-asset-activity",
      internalId: undefined,
      finish: undefined,
      assetId: "asset-1",
      title: "Pump inspection",
      deadline: "2026-12-10",
    });
  const identity = {
    internalId: "app-1",
    activityId: "FT-1",
    taskId: "task-1",
  };
  const result = previewWorkingSchedule(index, undefined, create, {
    ...context,
    identity,
  });
  assert.deepEqual(result.errors, []);
  const projected = resolveWorkingSourceIndex(index, result.next);
  assert.equal(projected.activities.length, 5);
  assert.equal(projected.byId.get("app-1")!.activity.start, undefined);
  assert.equal(projected.byId.get("app-1")!.activity.durationHours, "");
  assert.equal(result.createdTask?.id, "task-1");
  assert.equal(result.createdTask?.assetId, "asset-1");
  const replay = previewWorkingSchedule(index, result.next, create, {
    ...context,
    identity: {
      internalId: "ignored",
      activityId: "ignored",
      taskId: "ignored",
    },
  });
  assert.equal(replay.replay, true);
  assert.equal(replay.next.addedActivities.length, 1);
  assert(
    previewWorkingSchedule(
      index,
      result.next,
      { ...create, title: "Different" } as WorkingScheduleDraft,
      { ...context, identity },
    ).errors.length > 0,
  );
  const edited = previewWorkingSchedule(
    index,
    result.next,
    draft({
      idempotencyKey: "offline-request-2",
      internalId: "app-1",
      finish: "2026-12-11",
    }),
    context,
  );
  assert.deepEqual(edited.errors, []);
  assert.equal(
    resolveWorkingSourceIndex(index, edited.next).byId.get("app-1")!.activity
      .finish,
    "2026-12-11",
  );
});
test("managed projects use the same saved row, preserve baseline/actual and reject unsupported graph semantics", () => {
  const state = {
    ...commissioning(),
    schedule: [
      {
        activityId: "M1",
        name: "Managed",
        start: "2026-11-14",
        finish: "2026-11-15",
        baselineStart: "2026-10-01",
        baselineFinish: "2026-10-02",
      },
    ],
  };
  const index = managedWorkingSourceIndex(state.schedule);
  const result = previewWorkingSchedule(
    index,
    undefined,
    draft({ sourceSha256: "managed", internalId: "M1", finish: "2026-11-18" }),
    context,
  );
  assert.deepEqual(result.errors, []);
  const rows = workingManagedRows(state, result.next);
  assert.equal(rows[0].finish, "2026-11-18");
  assert.equal(rows[0].baselineFinish, "2026-10-02");
  const create = draft({
    sourceSha256: "managed",
    kind: "create-asset-activity",
    internalId: undefined,
    finish: undefined,
    assetId: "asset-1",
    title: "New managed",
    deadline: "2026-12-10",
  });
  const created = previewWorkingSchedule(index, undefined, create, {
    ...context,
    identity: { internalId: "app-1", activityId: "FT-1", taskId: "t1" },
  });
  const saved = {
    ...state,
    schedule: workingManagedRows(state, created.next),
    workingSchedule: created.next,
  };
  assert.equal(
    resolveWorkingSourceIndex(
      managedWorkingSourceIndex(saved.schedule, saved.workingSchedule),
      saved.workingSchedule,
    ).activities.length,
    2,
  );
  assert.equal(canConfirmWorkingSchedule("manager"), true);
  assert.equal(canConfirmWorkingSchedule("admin"), true);
  assert.equal(canConfirmWorkingSchedule("supervisor"), false);
  assert.equal(canConfirmWorkingSchedule("worker"), false);
});

test("equipment mapping edits are explicit, source-bound, unique and can clear without touching dates or raw asset metadata", () => {
  const index = indexSourceProgramme(fixture());
  const mapped = previewWorkingSchedule(
    index,
    undefined,
    draft({ finish: undefined, assetIds: ["asset-1"] }),
    context,
  );
  assert.deepEqual(mapped.errors, []);
  assert.equal(mapped.changes.length, 1);
  assert.deepEqual(mapped.next.activityPatches[0].assetIds, ["asset-1"]);
  assert.equal(
    resolveWorkingSourceIndex(index, mapped.next).activities[0].finish,
    index.activities[0].finish,
  );
  assert(
    previewWorkingSchedule(
      index,
      undefined,
      draft({ assetIds: ["foreign"] }),
      context,
    ).errors.some((error) => error.includes("linked asset")),
  );
  assert.equal(
    workingScheduleDraftSchema.safeParse({
      ...draft(),
      assetIds: ["asset-1", "asset-1"],
    }).success,
    false,
  );
  const retained = previewWorkingSchedule(
    index,
    mapped.next,
    draft({ idempotencyKey: "offline-mapping-2", finish: "2026-11-18" }),
    context,
  );
  assert.deepEqual(retained.next.activityPatches[0].assetIds, ["asset-1"]);
  const cleared = previewWorkingSchedule(
    index,
    mapped.next,
    draft({
      idempotencyKey: "offline-mapping-3",
      finish: undefined,
      assetIds: [],
    }),
    context,
  );
  assert.deepEqual(cleared.errors, []);
  assert.deepEqual(cleared.next.activityPatches[0].assetIds, []);
  assert(cleared.changes[0].includes("none"));
});

test("human activity codes use the first unused project reference with case-insensitive collision checks", () => {
  assert.equal(nextWorkingActivityCode([]), "FT-00001");
  assert.equal(
    nextWorkingActivityCode([
      "ft-00001",
      "FT-00003",
      " ft-00002 ",
      "unrelated",
    ]),
    "FT-00004",
  );
  assert.equal(nextWorkingActivityCode(["FT-00002"]), "FT-00001");
  const used = new Set(
    Array.from(
      { length: 100000 },
      (_, i) => `FT-${String(i + 1).padStart(5, "0")}`,
    ),
  );
  assert.equal(nextWorkingActivityCode(used), "FT-100001");
  const index = indexSourceProgramme(fixture());
  index.activities[0].activityId = "ft-00001";
  const duplicate = previewWorkingSchedule(
    index,
    undefined,
    draft({
      kind: "create-asset-activity",
      internalId: undefined,
      finish: undefined,
      assetId: "asset-1",
      title: "New",
      deadline: "2026-12-10",
    }),
    {
      ...context,
      identity: {
        internalId: "new-internal",
        activityId: "FT-00001",
        taskId: "new-task",
      },
    },
  );
  assert(duplicate.errors.some((error) => error.includes("identity")));
});
