import test from "node:test";
import assert from "node:assert/strict";
import { commissioning, type Commissioning } from "../src/lib/commissioning";
import type { Project, Task } from "../src/lib/domain";
import type { ChecksheetInstance } from "../src/lib/checksheets";
import type {
  SourceActivityView,
  SourceProgrammePage,
} from "../src/lib/programme-source";
import {
  taskTableColumns,
  toggleTaskColumn,
  taskManagedDates,
  taskStepSummary,
  taskSourceDetail,
} from "../src/lib/task-board";

const at = "2026-11-16T10:00:00.000Z",
  sha = "a".repeat(64);
const task = (extra: Partial<Task> = {}): Task => ({
  id: "task",
  projectId: "p",
  title: "Inspection",
  description: "",
  companyId: "c",
  createdBy: "admin",
  discipline: "Mechanical",
  location: "Roof",
  status: "pending",
  source: "manual",
  createdAt: at,
  updatedAt: at,
  version: 1,
  ...extra,
});
const project = (state: Commissioning): Project => ({
  id: "p",
  name: "Synthetic project",
  location: "Site",
  companyId: "c",
  commissioning: state,
});
function state(): Commissioning {
  const sheet: ChecksheetInstance = {
    id: "sheet",
    assetId: "asset",
    level: "L1",
    templateId: "template",
    templateName: "Inspection",
    templateRevision: "1",
    requirements: [
      { id: "one", required: true, requirement: "Check one" },
      { id: "two", required: true, requirement: "Check two" },
    ],
    responses: [
      {
        stepId: "one",
        answer: "Observed",
        result: "passed",
        updatedBy: "admin",
        updatedAt: at,
      },
    ],
    signatures: [],
    createdBy: "admin",
    createdAt: at,
  };
  return {
    ...commissioning(),
    config: { levels: ["L1"], priorities: ["P1"] },
    assets: [
      {
        id: "asset",
        name: "Pump",
        equipmentType: "Pump",
        location: "Roof",
        levels: ["L1"],
        levelActivities: { L1: "ACT-1" },
      },
    ],
    schedule: [
      {
        activityId: "ACT-1",
        name: "Inspection",
        start: "2026-11-15",
        finish: "2026-11-20",
        baselineStart: "2026-11-14",
        baselineFinish: "2026-11-19",
        actualFinish: "2026-11-18",
        durationDays: 4,
      },
    ],
    checksheets: {
      templates: [],
      signatorySlots: [],
      worksToGo: [],
      sheets: [sheet],
    },
  };
}

test("task columns keep name/ID mandatory while selectable columns retain a predictable order", () => {
  const all = taskTableColumns.map((column) => column.id);
  assert.equal(all.length, 7);
  assert.deepEqual(toggleTaskColumn(all, "name"), all);
  const fewer = toggleTaskColumn(all, "dates");
  assert.equal(fewer.length, 6);
  assert(!fewer.includes("dates"));
  assert.deepEqual(toggleTaskColumn(fewer, "dates"), all);
});

test("task completion, a manual percentage, approvals and signatures cannot replace F01 required step results", () => {
  const current = state(),
    linked = task({
      status: "completed",
      dueDate: "2026-11-20",
      cx: {
        kind: "tag",
        assetId: "asset",
        level: "L1",
        result: "passed",
        progress: 100,
        tagReview: "approved",
      },
    });
  current.checksheets!.sheets[0].signatures.push({
    slotId: "qa",
    label: "QA witness",
    userId: "admin",
    userName: "Administrator",
    signedAt: at,
  });
  const result = taskStepSummary(
    linked,
    project(current),
    [linked],
    "2026-11-16",
  );
  assert.equal(result.progress?.percent, 50);
  assert.equal(result.progress?.passed, 1);
  assert.equal(result.progress?.required, 2);
  assert.equal(result.progress?.complete, false);
  assert.equal(result.status.status, "not-due");
  assert.match(result.description, /Task status is recorded separately/);
  assert.equal(
    taskStepSummary(
      task({
        status: "completed",
        cx: { kind: "task", result: "passed", progress: 100 },
      }),
      project(current),
    ).progress,
    null,
  );
});

test("task properties and progress cannot borrow records from another project context", () => {
  const wrongProject = { ...project(state()), id: "another-project" };
  const linked = task({
    cx: {
      kind: "tag",
      assetId: "asset",
      level: "L1",
      activityId: "ACT-1",
      result: "untested",
    },
  });
  assert.equal(taskStepSummary(linked, wrongProject).progress, null);
  assert.equal(taskManagedDates(linked, wrongProject), undefined);
});

test("missing checksheets and no applicable required tags remain distinct from zero", () => {
  const current = state(),
    linked = task({
      cx: { kind: "tag", assetId: "asset", level: "L1", result: "untested" },
    });
  current.checksheets!.sheets = [];
  const missing = taskStepSummary(linked, project(current));
  assert.equal(missing.progress?.percent, null);
  assert.equal(missing.progress?.coverage, "missing");
  assert.match(missing.description, /1 checksheet/);
  current.config.levels = [];
  const notApplicable = taskStepSummary(linked, project(current));
  assert.equal(notApplicable.progress?.coverage, "not-applicable");
  assert.equal(notApplicable.progress?.percent, null);
});

test("an explicitly mapped managed activity uses the same required-step fraction without inventing an asset link", () => {
  const current = state(),
    linked = task({
      cx: { kind: "task", activityId: "ACT-1", result: "untested" },
    });
  assert.equal(
    taskStepSummary(linked, project(current), [linked]).progress?.percent,
    50,
  );
  assert.equal(
    taskStepSummary(
      task({ cx: { kind: "task", activityId: "Unknown", result: "untested" } }),
      project(current),
    ).progress,
    null,
  );
});

test("managed task properties preserve planned, actual and baseline dates and apply only the current working overlay", () => {
  const current = state(),
    linked = task({
      cx: { kind: "task", activityId: "managed:ACT-1", result: "untested" },
    });
  current.workingSchedule = {
    sourceSha256: "managed",
    revision: 1,
    activityPatches: [
      { internalId: "ACT-1", start: "2026-11-16", finish: "2026-11-22" },
    ],
    addedActivities: [],
    removedLinkIds: [],
    addedLinks: [],
    receipts: [],
  };
  const plan = taskManagedDates(linked, project(current));
  assert.equal(plan?.start, "2026-11-16");
  assert.equal(plan?.finish, "2026-11-22");
  assert.equal(
    plan && "baselineStart" in plan ? plan.baselineStart : undefined,
    "2026-11-14",
  );
  assert.equal(
    plan && "actualFinish" in plan ? plan.actualFinish : undefined,
    "2026-11-18",
  );
  assert.equal(
    current.schedule[0].start,
    "2026-11-15",
    "Stored original dates are unchanged",
  );
  current.workingSchedule.sourceSha256 = sha;
  assert.equal(
    taskManagedDates(linked, project(current))?.start,
    "2026-11-15",
    "A stale source overlay is not applied",
  );
  current.schedule.push({ ...current.schedule[0] });
  assert.equal(
    taskManagedDates(linked, project(current)),
    undefined,
    "Duplicate IDs are unresolved",
  );
});

const activity = (
  internalId: string,
  activityId: string,
): SourceActivityView => ({
  internalId,
  activityId,
  name: "Source activity",
  wbsId: "wbs",
  wbsPath: "ROOT / MEP",
  calendarId: "calendar",
  calendarName: "Recorded calendar",
  status: "TK_NotStart",
  taskType: "TT_Task",
  milestone: false,
  durationHours: "10",
  predecessorCount: 0,
  successorCount: 0,
});
const page = (
  activities: SourceActivityView[],
  total = activities.length,
  pageNumber = 0,
): SourceProgrammePage => ({
  summary: {
    format: "p6-xer-v1",
    sha256: sha,
    fileName: "synthetic.xer",
    projectId: "source",
    projectName: "Original source",
    activities: total,
    relationships: 0,
    calendars: 1,
    wbs: 1,
    sourceRecords: total,
    recalculation: "source-dates-only",
  },
  activities,
  total,
  page: pageNumber,
  pageSize: 50,
  filters: { calendars: [], statuses: [] },
});
const detail = (row = activity("exact", "ACT-1")) => ({
  activity: row,
  sourceLine: 12,
  fields: {
    task_id: row.internalId,
    task_code: row.activityId,
    target_start_date: "2026-11-16 08:00",
    act_start_date: "",
    target_end_date: "2026-11-20 17:00",
  },
  relationships: [],
});

test("source task lookup checks later pages and then loads the exact source internal identity", async () => {
  const queries: URLSearchParams[] = [];
  const result = await taskSourceDetail("ACT-1", sha, async (query) => {
    queries.push(query);
    if (query.get("internalId")) return { ...page([]), detail: detail() };
    return query.get("page") === "0"
      ? page([activity("fuzzy", "ACT-100")], 51, 0)
      : page([activity("exact", "ACT-1")], 51, 1);
  });
  assert.equal(result?.activity.internalId, "exact");
  assert.deepEqual(
    queries.map((query) => query.get("internalId") || query.get("page")),
    ["0", "1", "exact"],
  );
});

test("source duplicate Activity IDs across pages are ambiguous, and a changed source cannot return stale details", async () => {
  await assert.rejects(
    taskSourceDetail("ACT-1", sha, async (query) =>
      query.get("page") === "0"
        ? page([activity("one", "ACT-1")], 51, 0)
        : page([activity("two", "ACT-1")], 51, 1),
    ),
    /more than one/,
  );
  await assert.rejects(
    taskSourceDetail(`source:${sha}:exact`, sha, async () => ({
      ...page([]),
      summary: { ...page([]).summary, sha256: "b".repeat(64) },
      detail: detail(),
    })),
    /source schedule changed/,
  );
  await assert.rejects(
    taskSourceDetail(`source:${"b".repeat(64)}:exact`, sha, async () => {
      throw Error("Should not request a stale source");
    }),
    /source schedule changed/,
  );
});

test("canonical source identities use one exact request, while absent matches remain unknown", async () => {
  let calls = 0;
  const result = await taskSourceDetail(
    `source:${sha}:exact`,
    sha,
    async (query) => {
      calls++;
      assert.equal(query.get("internalId"), "exact");
      return { ...page([]), detail: detail() };
    },
  );
  assert.equal(calls, 1);
  assert.equal(result?.fields.act_start_date, "");
  assert.equal(
    await taskSourceDetail("ACT-404", sha, async () => page([])),
    undefined,
  );
  assert.equal(
    await taskSourceDetail("managed:ACT-1", sha, async () => {
      throw Error("No source lookup for a managed identity");
    }),
    undefined,
  );
});

test("a broad source lookup stops with an explicit unverified result rather than choosing an early match", async () => {
  let calls = 0;
  await assert.rejects(
    taskSourceDetail("ACT", sha, async (query) => {
      calls++;
      return page([activity("first", "ACT")], 1001, Number(query.get("page")));
    }),
    /Too many source matches/,
  );
  assert.equal(calls, 20);
});
