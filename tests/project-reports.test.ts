import test from "node:test";
import assert from "node:assert/strict";
import { emptyData, type AppData, type Task } from "../src/lib/domain";
import {
  commissioning,
  type Asset,
  type Commissioning,
} from "../src/lib/commissioning";
import type { ChecksheetInstance, WorksToGo } from "../src/lib/checksheets";
import {
  indexSourceProgramme,
  type SourceProgramme,
} from "../src/lib/programme-source";
import {
  assetStepProgress,
  activityStepProgress,
  operationalStatus,
  buildProjectReport,
  reportQuerySchema,
  projectReportCsv,
  MISSING_REPORT_VALUE,
  CONFLICT_REPORT_VALUE,
  reportActivityKey,
  type TaggingReportRow,
  type LookaheadReportRow,
  type VendorReportRow,
} from "../src/lib/project-reports";
const now = new Date("2026-11-14T12:00:00Z"),
  at = "2026-11-13T10:00:00.000Z";
const asset = (id: string, fields: Partial<Asset> = {}): Asset => ({
  id,
  name: `Equipment ${id}`,
  equipmentType: "Pump",
  location: "Site",
  levels: ["L1"],
  ...fields,
});
const task = (id: string, fields: Partial<Task> = {}): Task => ({
  id,
  title: `Task ${id}`,
  description: "",
  projectId: "p",
  companyId: "c",
  createdBy: "u",
  status: "pending",
  discipline: "Mechanical",
  location: "Site",
  source: "manual",
  createdAt: at,
  updatedAt: at,
  version: 1,
  ...fields,
});
const sheet = (
  assetId: string,
  required = 10,
  passed = 6,
  fields: Partial<ChecksheetInstance> = {},
): ChecksheetInstance => ({
  id: `sheet-${assetId}`,
  assetId,
  templateId: "template",
  templateName: "Inspection",
  templateRevision: "1",
  level: "L1",
  requirements: Array.from({ length: required }, (_, i) => ({
    id: String(i),
    requirement: `Step ${i}`,
    required: true,
  })),
  responses: Array.from({ length: passed }, (_, i) => ({
    stepId: String(i),
    answer: "Observed",
    result: "passed",
    updatedBy: "u",
    updatedAt: at,
  })),
  signatures: [],
  createdBy: "u",
  createdAt: at,
  ...fields,
});
const work = (id: string, fields: Partial<WorksToGo> = {}): WorksToGo => ({
  id,
  title: `Work ${id}`,
  notes: "",
  status: "open",
  createdBy: "u",
  updatedBy: "u",
  createdAt: at,
  updatedAt: at,
  ...fields,
});
const state = (): Commissioning => ({
  ...commissioning(),
  version: 7,
  config: { levels: ["L1", "L2"], priorities: ["P1"] },
  assets: [
    asset("a", {
      vendor: "Supplier A",
      discipline: "Mechanical",
      levelActivities: { L1: "ACT-1" },
    }),
    asset("b", { vendor: "Supplier B", discipline: "Electrical" }),
    asset("unknown", { owner: "Supplier A" }),
  ],
  schedule: [
    {
      activityId: "ACT-1",
      name: "Current work",
      start: "2026-11-10",
      finish: "2026-11-20",
    },
  ],
  checksheets: {
    templates: [],
    signatorySlots: [],
    worksToGo: [],
    sheets: [sheet("a")],
  },
});
const dataFor = (current = state()): AppData => ({
  ...structuredClone(emptyData),
  projects: [
    {
      id: "p",
      name: "Project",
      location: "Site",
      companyId: "c",
      commissioning: current,
    },
    {
      id: "other",
      name: "Other project",
      location: "",
      companyId: "c",
      commissioning: {
        ...commissioning(),
        assets: [asset("a", { vendor: "Foreign" })],
      },
    },
  ],
  tasks: [
    task("tag-a", {
      cx: {
        kind: "tag",
        assetId: "a",
        level: "L1",
        result: "passed",
        tagReview: "approved",
      },
      dueDate: "2026-11-20",
    }),
    task("foreign", {
      projectId: "other",
      cx: { kind: "tag", assetId: "a", level: "L1", result: "failed" },
      dueDate: "2020-01-01",
    }),
  ],
});
function source(rows: string[][]) {
  const fields = [
    "task_id",
    "task_code",
    "task_name",
    "status_code",
    "restart_date",
    "reend_date",
    "act_end_date",
  ];
  const programme: SourceProgramme = {
    format: "p6-xer-v1",
    source: {
      fileName: "synthetic.xer",
      sha256: "a".repeat(64),
      encoding: "utf-8",
      header: "synthetic",
    },
    tables: { TASK: { fields, rows, lines: rows.map((_, i) => i + 1) } },
  };
  return indexSourceProgramme(programme);
}
test("passed required applicable steps use 6/10=60%, excluding explicit N/A and optional steps, independently of approvals/signatures", () => {
  const current = state(),
    inspection = current.checksheets!.sheets[0];
  inspection.requirements.push(
    { id: "na", requirement: "N/A", required: true },
    { id: "optional", requirement: "Optional", required: false },
  );
  inspection.responses.push(
    {
      stepId: "na",
      answer: "Explicitly not applicable",
      result: "not-applicable",
      updatedBy: "u",
      updatedAt: at,
    },
    {
      stepId: "optional",
      answer: "Optional pass",
      result: "passed",
      updatedBy: "u",
      updatedAt: at,
    },
  );
  inspection.signatures.push({
    slotId: "signed",
    label: "Approved",
    userId: "u",
    userName: "User",
    signedAt: at,
  });
  const progress = assetStepProgress(current, "a", "L1");
  assert.equal(progress.passed, 6);
  assert.equal(progress.required, 10);
  assert.equal(progress.percent, 60);
  assert.equal(progress.notApplicable, 1);
  assert.equal(progress.complete, false);
  const result = buildProjectReport(
    dataFor(current),
    "p",
    { vendor: "Supplier A", level: "L1" },
    { now },
  );
  const row = result.rows[0] as TaggingReportRow;
  assert.equal(row.progress.percent, 60);
  assert.equal(row.levels[0].reviews[0].review, "approved");
  assert.equal(row.signatures, 1);
});
test("missing checksheets, all N/A and unmapped levels remain distinct from a numeric zero or completion", () => {
  const current = state();
  current.assets[0].levels = ["L1", "L2"];
  const partial = assetStepProgress(current, "a");
  assert.equal(partial.missingSheets, 1);
  assert.equal(partial.coverage, "partial");
  assert.equal(partial.complete, false);
  assert.equal(assetStepProgress(current, "b").percent, null);
  current.checksheets!.sheets = [
    sheet("a", 1, 0, {
      responses: [
        {
          stepId: "0",
          answer: "Not applicable",
          result: "not-applicable",
          updatedBy: "u",
          updatedAt: at,
        },
      ],
    }),
  ];
  const allNa = assetStepProgress(current, "a", "L1");
  assert.equal(allNa.percent, null);
  assert.equal(allNa.notApplicable, 1);
  assert.equal(allNa.coverage, "not-applicable");
  assert.equal(allNa.complete, false);
  const result = buildProjectReport(
    dataFor(current),
    "p",
    { vendor: "Supplier A", level: "L1" },
    { now },
  );
  assert.equal((result.rows[0] as TaggingReportRow).status.colour, null);
});
test("operational colours preserve red-before-orange-before-green and today is not overdue", () => {
  const status = (fields: Partial<Parameters<typeof operationalStatus>[0]>) =>
    operationalStatus({
      due: "2026-11-14",
      today: "2026-11-14",
      completed: false,
      openWorks: 0,
      ...fields,
    });
  assert.equal(status({}).status, "not-due");
  assert.equal(status({ due: "2026-11-13" }).colour, "red");
  assert.equal(
    status({ completed: true, completedAt: "2026-11-15", openWorks: 4 }).colour,
    "red",
  );
  assert.equal(
    status({ completed: true, completedAt: "2026-11-13", openWorks: 4 }).colour,
    "orange",
  );
  assert.equal(
    status({ completed: true, completedAt: "2026-11-13" }).colour,
    "green",
  );
  assert.equal(status({ completed: true }).status, "unknown");
  assert.equal(status({ due: undefined }).status, "unknown");
});
test("supplier filters are explicit and exact, owner is never a supplier, project tasks stay scoped", () => {
  const data = dataFor(),
    before = structuredClone(data);
  const result = buildProjectReport(
    data,
    "p",
    { vendor: "Supplier A", level: "L1", late: "not-late" },
    { now },
  );
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].id, "a");
  assert.equal(
    buildProjectReport(data, "p", { vendor: "supplier a" }, { now }).total,
    1,
  );
  const missing = buildProjectReport(
    data,
    "p",
    { vendor: MISSING_REPORT_VALUE },
    { now },
  );
  assert.deepEqual(
    missing.rows.map((row) => row.id),
    ["unknown"],
  );
  assert(!result.facets.vendors.includes("Foreign"));
  assert.deepEqual(data, before);
});
test("works-to-go use only actual saved remaining-work records with task-linked attribution and explicit discipline conflicts", () => {
  const current = state(),
    data = dataFor(current);
  data.tasks.push(
    task("task-b", {
      discipline: "Electrical",
      cx: { kind: "task", assetId: "b", result: "untested" },
    }),
    task("task-a-conflict", {
      discipline: "Electrical",
      cx: { kind: "task", assetId: "a", result: "untested" },
    }),
  );
  current.checksheets!.worksToGo = [
    work("direct", { assetId: "a" }),
    work("linked", { taskId: "task-b" }),
    work("discipline-conflict", { assetId: "a", taskId: "task-a-conflict" }),
    work("asset-conflict", { assetId: "a", taskId: "task-b" }),
    work("project"),
  ];
  assert.equal(
    buildProjectReport(
      data,
      "p",
      { report: "works-to-go", vendor: "Supplier B" },
      { now },
    ).total,
    1,
  );
  assert.equal(
    buildProjectReport(
      data,
      "p",
      { report: "works-to-go", discipline: CONFLICT_REPORT_VALUE },
      { now },
    ).total,
    2,
  );
  assert.equal(
    buildProjectReport(
      data,
      "p",
      { report: "works-to-go", vendor: MISSING_REPORT_VALUE },
      { now },
    ).total,
    2,
  );
  assert.equal(
    buildProjectReport(data, "p", { report: "works-to-go" }, { now }).total,
    5,
    "Pending tasks are not substituted for WTG",
  );
});
test("lookahead queries the full source index beyond the visible page, includes overlapping managed work and respects 14-day boundaries", () => {
  const index = source([
    ...Array.from({ length: 300 }, (_, i) => [
      String(i),
      `OLD-${i}`,
      "Old",
      "TK_NotStart",
      "2026-01-01",
      "2026-01-02",
      "",
    ]),
    [
      "target",
      "SOURCE-TARGET",
      "Upcoming source",
      "TK_NotStart",
      "2026-11-27",
      "2026-11-27",
      "",
    ],
  ]);
  const current = state();
  current.schedule.push(
    {
      activityId: "ongoing",
      name: "Ongoing",
      start: "2026-10-01",
      finish: "2026-11-14",
    },
    {
      activityId: "too-late",
      name: "Outside",
      start: "2026-11-28",
      finish: "2026-11-28",
    },
    { activityId: "undated", name: "Undated" },
  );
  const result = buildProjectReport(
    dataFor(current),
    "p",
    { report: "lookahead" },
    { now, sourceIndex: index },
  );
  assert.equal(result.total, 3);
  assert(
    result.rows.some(
      (row) =>
        row.id === reportActivityKey("source", "target", index.summary.sha256),
    ),
  );
  assert.deepEqual(result.window, {
    from: "2026-11-14",
    through: "2026-11-27",
    days: 14,
  });
  assert.equal(result.query.from, "2026-11-14");
  assert(
    new URL(result.href, "https://local.test").searchParams.get("from") ===
      "2026-11-14",
  );
  assert.equal(result.coverage.undatedActivities, 1);
  assert.equal(result.coverage.overdueActivities, 300);
  assert.equal(result.coverage.activities, 305);
});
test("ambiguous source/managed codes do not invent supplier links; canonical identities resolve them safely", () => {
  const index = source([
    [
      "source-1",
      "ACT-1",
      "Source collision",
      "TK_NotStart",
      "2026-11-14",
      "2026-11-20",
      "",
    ],
  ]);
  const current = state();
  const ambiguous = buildProjectReport(
    dataFor(current),
    "p",
    { report: "lookahead", vendor: "Supplier A" },
    { now, sourceIndex: index },
  );
  assert.equal(ambiguous.total, 0);
  assert.equal(ambiguous.coverage.ambiguousActivityReferences, 1);
  current.assets[0].levelActivities = {
    L1: reportActivityKey("source", "source-1", index.summary.sha256),
  };
  const resolved = buildProjectReport(
    dataFor(current),
    "p",
    { report: "lookahead", vendor: "Supplier A" },
    { now, sourceIndex: index },
  );
  assert.equal(resolved.total, 1);
  assert.equal((resolved.rows[0] as LookaheadReportRow).source, "source");
  const mapped = activityStepProgress(
    current,
    [],
    reportActivityKey("source", "source-1", index.summary.sha256),
    "2026-11-14",
    index,
  );
  assert.equal(mapped.percent, 60);
  assert.deepEqual(mapped.levels, ["L1"]);
});
test("supplier rollup lists the explicitly mapped suppliers for the same window and does not claim supplier availability", () => {
  const current = state();
  current.assets = Array.from({ length: 6 }, (_, i) =>
    asset(String(i), {
      vendor: `Supplier ${i}`,
      programmeActivityId: `ACT-${i}`,
    }),
  );
  current.schedule = current.assets.map((asset, i) => ({
    activityId: `ACT-${i}`,
    name: asset.name,
    start: "2026-11-14",
    finish: "2026-11-20",
  }));
  current.schedule.push({
    activityId: "unknown",
    name: "No equipment link",
    start: "2026-11-15",
    finish: "2026-11-16",
  });
  const result = buildProjectReport(
    dataFor(current),
    "p",
    { report: "vendors" },
    { now },
  );
  assert.equal(result.total, 7);
  assert.equal(result.coverage.activitiesWithoutAssetLinks, 1);
  const exact = buildProjectReport(
    dataFor(current),
    "p",
    { report: "vendors", vendor: "Supplier 0" },
    { now },
  );
  assert.equal(exact.total, 1);
  assert.equal((exact.rows[0] as VendorReportRow).activities, 1);
  assert(
    result.notes.some((note) =>
      note.includes("does not assert supplier availability"),
    ),
  );
});
test("Gantt progress aggregates only the corresponding explicit levels and leaves delivery-only or missing mapping unknown", () => {
  const current = state();
  current.assets[0].levels = ["L1", "L2"];
  current.assets[0].levelActivities = { L1: "ACT-1", L2: "ACT-2" };
  current.assets[0].deliveryActivityId = "DELIVERY";
  current.schedule.push(
    { activityId: "ACT-2", name: "Other stage", finish: "2026-11-20" },
    { activityId: "DELIVERY", name: "Delivery", finish: "2026-11-20" },
  );
  current.checksheets!.sheets.push(
    sheet("a", 2, 2, { id: "sheet-l2", level: "L2" }),
  );
  assert.equal(
    activityStepProgress(current, [], "ACT-1", "2026-11-14").percent,
    60,
  );
  assert.equal(
    activityStepProgress(current, [], "ACT-2", "2026-11-14").percent,
    100,
  );
  assert.equal(
    activityStepProgress(current, [], "DELIVERY", "2026-11-14").status.status,
    "unknown",
  );
  assert.equal(
    activityStepProgress(current, [], "missing", "2026-11-14").percent,
    null,
  );
});
test("exact totals precede pagination and CSV exports the complete filtered population with safe cells", () => {
  const current = state();
  current.assets = Array.from({ length: 61 }, (_, i) =>
    asset(String(i), {
      vendor: "=Supplier formula",
      name: `Item ${String(i).padStart(2, "0")}`,
    }),
  );
  const data = dataFor(current),
    result = buildProjectReport(
      data,
      "p",
      { vendor: "=Supplier formula", limit: 50, offset: 50 },
      { now },
    );
  assert.equal(result.total, 61);
  assert.equal(result.rows.length, 11);
  assert.equal(result.rows[0].id, "50");
  const exported = projectReportCsv(data, "p", result.query, { now });
  assert.equal(exported.total, 61);
  assert.equal(exported.csv.split("\r\n").length, 62);
  assert(exported.csv.includes("'=Supplier formula"));
  assert.equal(
    reportQuerySchema.safeParse({ report: "tagging", limit: 51 }).success,
    false,
  );
  assert.equal(
    reportQuerySchema.safeParse({ report: "tagging", offset: -1 }).success,
    false,
  );
});
test("source metadata without an available complete index produces an explicit coverage limitation", () => {
  const current = state();
  current.sourceProgrammeSummary = source([
    ["s", "S", "Source", "TK_NotStart", "2026-11-14", "2026-11-20", ""],
  ]).summary;
  const result = buildProjectReport(
    dataFor(current),
    "p",
    { report: "lookahead" },
    { now },
  );
  assert.equal(result.coverage.sourceUnavailable, true);
  assert(result.notes.some((note) => note.includes("not represented as zero")));
});

test("working source additions and their managed mirrors appear once and retain explicit task-to-equipment supplier attribution", () => {
  const index = source([
    [
      "original",
      "SOURCE-1",
      "Original source",
      "TK_NotStart",
      "2026-11-14",
      "2026-11-20",
      "",
    ],
    [
      "app-new",
      "FT-new",
      "Created working activity",
      "TK_NotStart",
      "2026-11-15",
      "2026-11-21",
      "",
    ],
  ]);
  const current = state();
  current.workingSchedule = {
    sourceSha256: index.summary.sha256,
    revision: 1,
    activityPatches: [],
    addedActivities: [
      {
        internalId: "app-new",
        activityId: "FT-new",
        name: "Created working activity",
        assetId: "a",
        taskId: "created-task",
        start: "2026-11-15",
        finish: "2026-11-21",
        createdBy: "u",
        createdAt: at,
      },
    ],
    removedLinkIds: [],
    addedLinks: [],
    receipts: [],
  };
  current.schedule.push({
    activityId: "FT-new",
    name: "Created working activity",
    start: "2026-11-15",
    finish: "2026-11-21",
  });
  const data = dataFor(current);
  data.tasks.push(
    task("created-task", {
      cx: {
        kind: "task",
        assetId: "a",
        activityId: "FT-new",
        result: "untested",
      },
    }),
  );
  const result = buildProjectReport(
    data,
    "p",
    { report: "lookahead" },
    { sourceIndex: index, now },
  );
  assert.equal(result.total, 3);
  const additions = result.rows.filter(
    (row) => row.kind === "lookahead" && row.activityId === "FT-new",
  ) as LookaheadReportRow[];
  assert.equal(additions.length, 1);
  assert.equal(additions[0].source, "source");
  assert.deepEqual(additions[0].vendors, ["Supplier A"]);
});

test("supplier filtering does not add other suppliers from a shared activity and every vendor drilldown pins its window", () => {
  const current = state();
  current.assets[1].programmeActivityId = "ACT-1";
  const result = buildProjectReport(
    dataFor(current),
    "p",
    { report: "vendors", vendor: "Supplier A" },
    { now },
  );
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].vendor, "Supplier A");
  assert.equal(
    new URL(result.rows[0].href, "https://local.test").searchParams.get("from"),
    "2026-11-14",
  );
});

test("CSV columns remain aligned for all report types and Gantt all-N/A stays uncoloured", () => {
  const current = state();
  current.checksheets!.worksToGo = [work("saved", { assetId: "a" })];
  const data = dataFor(current);
  for (const report of [
    "tagging",
    "works-to-go",
    "lookahead",
    "vendors",
  ] as const) {
    const result = projectReportCsv(data, "p", { report }, { now });
    const lines = result.csv.split("\r\n"),
      cells = (line: string) =>
        [...line.matchAll(/"(?:[^"]|"")*"(?:,|$)/g)].length;
    assert(result.total > 0);
    for (const line of lines)
      assert.equal(
        cells(line.replace(/^\ufeff/, "")),
        22,
        `${report} CSV preserves its column count`,
      );
  }
  current.checksheets!.sheets = [
    sheet("a", 1, 0, {
      responses: [
        {
          stepId: "0",
          answer: "Not applicable",
          result: "not-applicable",
          updatedBy: "u",
          updatedAt: at,
        },
      ],
    }),
  ];
  current.schedule[0].finish = "2026-01-01";
  const progress = activityStepProgress(current, [], "ACT-1", "2026-11-14");
  assert.equal(progress.coverage, "not-applicable");
  assert.equal(progress.status.colour, null);
});

test("completed source timeliness uses a validated planned target, never the actual finish itself, while source fields and WBS stay immutable", () => {
  const index = source([
    [
      "late",
      "DONE-LATE",
      "Completed late",
      "TK_Complete",
      "2026-11-14",
      "2026-11-15",
      "2026-11-16 10:00",
    ],
    [
      "unknown",
      "DONE-UNKNOWN",
      "No planned target",
      "TK_Complete",
      "2026-11-14",
      "2026-11-15",
      "2026-11-16 10:00",
    ],
  ]);
  index.byId.get("late")!.fields.target_end_date = "2026-11-15 17:00";
  index.byId.get("late")!.activity.wbsPath = "Original WBS path";
  const snapshot = structuredClone(index);
  const current = state();
  current.assets[0].levelActivities = {
    L1: reportActivityKey("source", "late", index.summary.sha256),
  };
  current.checksheets!.sheets = [
    sheet("a", 1, 1, {
      responses: [
        {
          stepId: "0",
          answer: "Passed",
          result: "passed",
          updatedBy: "u",
          updatedAt: "2026-11-16T10:00:00.000Z",
        },
      ],
    }),
  ];
  const result = buildProjectReport(
    dataFor(current),
    "p",
    { report: "lookahead", activityStatus: "done", from: "2026-11-14" },
    { sourceIndex: index, now },
  );
  const late = result.rows.find(
    (row) => row.kind === "lookahead" && row.activityId === "DONE-LATE",
  ) as LookaheadReportRow;
  const unknown = result.rows.find(
    (row) => row.kind === "lookahead" && row.activityId === "DONE-UNKNOWN",
  ) as LookaheadReportRow;
  assert.equal(late.finish, "2026-11-16");
  assert.equal(late.deadline, "2026-11-15");
  assert.equal(late.deadlineSource, "target_end_date");
  assert.equal(late.status.colour, "red");
  assert.equal(unknown.deadline, null);
  assert.equal(unknown.status.status, "unknown");
  assert.equal(unknown.status.colour, null);
  const progress = activityStepProgress(
    current,
    [],
    reportActivityKey("source", "late", index.summary.sha256),
    "2026-11-20",
    index,
  );
  assert.equal(progress.due, "2026-11-15");
  assert.equal(progress.status.colour, "red");
  assert.deepEqual(index, snapshot);
  assert(result.notes.some((note) => note.includes("target_end_date")));
});

test("explicit working assetIds map existing source activities to supplier reports and whole-asset progress; empty clears and foreign hashes do not apply", () => {
  const index = source([
    [
      "existing-p6",
      "P6-EXISTING",
      "Existing imported activity",
      "TK_NotStart",
      "2026-11-14",
      "2026-11-20",
      "",
    ],
  ]);
  const sourceSnapshot = structuredClone(index),
    current = state();
  current.assets[0].levelActivities = {};
  current.schedule = [];
  current.workingSchedule = {
    sourceSha256: index.summary.sha256,
    revision: 1,
    activityPatches: [{ internalId: "existing-p6", assetIds: ["a"] }],
    addedActivities: [],
    removedLinkIds: [],
    addedLinks: [],
    receipts: [],
  };
  const report = () =>
    buildProjectReport(
      dataFor(current),
      "p",
      { report: "lookahead", vendor: "Supplier A" },
      { sourceIndex: index, now },
    );
  assert.equal(report().total, 1);
  assert.deepEqual(
    (report().rows[0] as LookaheadReportRow).assets.map((asset) => asset.id),
    ["a"],
  );
  assert.equal(
    buildProjectReport(
      dataFor(current),
      "p",
      { report: "vendors", vendor: "Supplier A" },
      { sourceIndex: index, now },
    ).total,
    1,
  );
  const progress = () =>
    activityStepProgress(
      current,
      [],
      reportActivityKey("source", "existing-p6", index.summary.sha256),
      "2026-11-14",
      index,
    );
  assert.equal(progress().percent, 60);
  assert.deepEqual(progress().assetIds, ["a"]);
  current.workingSchedule.activityPatches[0].assetIds = [];
  assert.equal(report().total, 0);
  assert.equal(progress().percent, null);
  current.workingSchedule.activityPatches[0].assetIds = ["a"];
  current.workingSchedule.sourceSha256 = "b".repeat(64);
  assert.equal(report().total, 0);
  assert.equal(progress().percent, null);
  assert.deepEqual(index, sourceSnapshot);
});

test("clearing working primary mapping retains independent stage-specific links, and managed activity mappings use their exact identities", () => {
  const current = state(),
    index = source([
      [
        "source-stage",
        "P6-STAGE",
        "Stage",
        "TK_NotStart",
        "2026-11-14",
        "2026-11-20",
        "",
      ],
    ]);
  current.assets[0].levelActivities = {
    L1: reportActivityKey("source", "source-stage", index.summary.sha256),
  };
  current.workingSchedule = {
    sourceSha256: index.summary.sha256,
    revision: 1,
    activityPatches: [{ internalId: "source-stage", assetIds: [] }],
    addedActivities: [],
    removedLinkIds: [],
    addedLinks: [],
    receipts: [],
  };
  assert.equal(
    activityStepProgress(
      current,
      [],
      reportActivityKey("source", "source-stage", index.summary.sha256),
      "2026-11-14",
      index,
    ).percent,
    60,
  );
  current.assets[0].levelActivities = {};
  current.workingSchedule = {
    ...current.workingSchedule,
    sourceSha256: "managed",
    activityPatches: [{ internalId: "ACT-1", assetIds: ["a"] }],
  };
  assert.equal(
    activityStepProgress(current, [], "ACT-1", "2026-11-14").percent,
    60,
  );
  const managed = buildProjectReport(
    dataFor(current),
    "p",
    { report: "lookahead", vendor: "Supplier A" },
    { now },
  );
  assert.equal(managed.total, 1);
  assert.equal((managed.rows[0] as LookaheadReportRow).source, "managed");
});

test("Gantt activity drilldown reconciles the exact per-asset level scope, weighted progress and paging without leaking other levels", () => {
  const current = state();
  current.assets[0].levels = ["L1", "L2"];
  current.assets[0].levelActivities = { L1: "ACT-1", L2: "OTHER" };
  current.assets[1].levels = ["L1", "L2"];
  current.assets[1].levelActivities = { L2: "ACT-1", L1: "OTHER" };
  current.checksheets!.sheets = [
    sheet("a", 10, 6),
    sheet("a", 50, 50, { id: "a-other", level: "L2" }),
    sheet("b", 5, 1, { id: "b-target", level: "L2" }),
    sheet("b", 60, 60, { id: "b-other", level: "L1" }),
    sheet("unknown", 70, 70),
  ];
  const data = dataFor(current),
    activity = reportActivityKey("managed", "ACT-1"),
    gantt = activityStepProgress(
      current,
      data.tasks.filter((task) => task.projectId === "p"),
      "ACT-1",
      "2026-11-14",
    );
  const report = buildProjectReport(
    data,
    "p",
    { report: "tagging", activity, limit: 1 },
    { now },
  );
  assert.equal(report.total, 2);
  assert.equal(report.rows.length, 1);
  assert.equal(report.progress?.percent, gantt.percent);
  assert.equal(report.progress?.percent, 47);
  assert.equal(report.progress?.passed, 7);
  assert.equal(report.progress?.required, 15);
  assert.equal((report.rows[0] as TaggingReportRow).progress.percent, 60);
  assert.deepEqual(
    (report.rows[0] as TaggingReportRow).levels.map((level) => level.level),
    ["L1"],
  );
  const page2 = buildProjectReport(
    data,
    "p",
    { report: "tagging", activity, offset: 1, limit: 1 },
    { now },
  );
  assert.equal((page2.rows[0] as TaggingReportRow).progress.percent, 20);
  assert.deepEqual(
    (page2.rows[0] as TaggingReportRow).levels.map((level) => level.level),
    ["L2"],
  );
  assert.equal(page2.progress?.percent, 47);
  const filtered = buildProjectReport(
    data,
    "p",
    { report: "tagging", activity, level: "L1" },
    { now },
  );
  assert.equal(filtered.total, 1);
  assert.equal(filtered.rows[0].id, "a");
  assert.equal(filtered.progress?.percent, 60);
  assert.equal(
    new URL(report.href, "https://local.test").searchParams.get("activity"),
    activity,
  );
  assert.equal(projectReportCsv(data, "p", report.query, { now }).total, 2);
  const missing = buildProjectReport(
    data,
    "p",
    { activity: "managed:unmapped" },
    { now },
  );
  assert.equal(missing.total, 0);
  assert.equal(missing.progress?.percent, null);
  assert(missing.activity?.unknownReason);
});

test("supplier exact identity normalizes case, whitespace and NFKC across all four reports while preserving recorded labels", () => {
  const current = state();
  current.assets[0].vendor = "XYZ";
  current.assets[1].vendor = "ＸＹＺ";
  current.assets[1].programmeActivityId = "ACT-1";
  current.assets[2].vendor = "XYZ-Other";
  current.assets[2].programmeActivityId = "ACT-1";
  current.checksheets!.worksToGo = [
    work("a", { assetId: "a" }),
    work("b", { assetId: "b" }),
    work("other", { assetId: "unknown" }),
  ];
  const data = dataFor(current);
  for (const report of [
    "tagging",
    "works-to-go",
    "lookahead",
    "vendors",
  ] as const) {
    const direct = buildProjectReport(
      data,
      "p",
      { report, vendor: "XYZ" },
      { now },
    );
    const lower = buildProjectReport(
      data,
      "p",
      { report, vendor: " xyz " },
      { now },
    );
    assert.equal(direct.total, lower.total);
    assert.deepEqual(direct.rows, lower.rows);
    assert.equal(
      direct.total,
      report === "tagging" || report === "works-to-go" ? 2 : 1,
    );
    assert(
      direct.facets.vendors.every((vendor) =>
        ["XYZ", "ＸＹＺ", "XYZ-Other"].includes(vendor),
      ),
    );
  }
  assert.equal(
    buildProjectReport(data, "p", { vendor: "xy" }, { now }).total,
    0,
    "No substring supplier guessing",
  );
});

test("tagging counts only enabled applicable tags: active L3 6/10 is not inflated by disabled L1 or untagged equipment sheets", () => {
  const current = state();
  current.config.levels = ["L3"];
  current.assets[0].levels = ["L3", "L1"];
  current.assets[0].levelActivities = { L3: "ACT-1", L1: "OLD-DISABLED" };
  const historicalSignature = {
    slotId: "old",
    label: "Historical signature",
    userId: "u",
    userName: "User",
    signedAt: at,
  };
  current.checksheets!.sheets = [
    sheet("a", 10, 6, { id: "active-l3", level: "L3" }),
    sheet("a", 10, 10, {
      id: "disabled-l1",
      level: "L1",
      signatures: [historicalSignature],
    }),
    sheet("a", 10, 10, {
      id: "no-tag",
      level: undefined,
      signatures: [historicalSignature],
    }),
  ];
  current.schedule.push({
    activityId: "OLD-DISABLED",
    name: "Historical disabled stage",
    start: "2020-01-01",
    finish: "2020-01-02",
  });
  const data = dataFor(current),
    snapshot = structuredClone(data),
    progress = assetStepProgress(current, "a");
  assert.equal(progress.passed, 6);
  assert.equal(progress.required, 10);
  assert.equal(progress.percent, 60);
  assert.equal(progress.complete, false);
  assert.equal(progress.missingSheets, 0);
  const report = buildProjectReport(
      data,
      "p",
      { vendor: "Supplier A" },
      { now },
    ),
    row = report.rows[0] as TaggingReportRow;
  assert.equal(row.progress.percent, 60);
  assert.equal(row.signatures, 0);
  assert.deepEqual(
    row.levels.map((level) => level.level),
    ["L3"],
  );
  assert.deepEqual(report.facets.levels, ["L3"]);
  assert.equal(row.status.colour, null);
  const disabled = buildProjectReport(data, "p", { level: "L1" }, { now });
  assert.equal(disabled.total, 0);
  assert(disabled.notes.some((note) => note.includes("L1 is disabled")));
  assert.equal(
    activityStepProgress(
      current,
      data.tasks.filter((task) => task.projectId === "p"),
      "OLD-DISABLED",
      "2026-11-14",
    ).percent,
    null,
  );
  assert.deepEqual(
    data,
    snapshot,
    "Disabled history, approvals, answers and signatures are preserved unchanged",
  );
});

test("no active levels remains not applicable and uncoloured; untagged sheets do not satisfy an active missing tag", () => {
  const current = state();
  current.config.levels = ["L3"];
  current.assets[0].levels = ["L1"];
  current.assets[0].programmeActivityId = "OLD";
  current.assets[1].levels = ["L3"];
  current.schedule.push({
    activityId: "OLD",
    name: "Historical deadline",
    start: "2020-01-01",
    finish: "2020-01-02",
  });
  current.checksheets!.sheets = [
    sheet("a", 10, 10, { id: "old-disabled", level: "L1" }),
    sheet("a", 10, 10, { id: "old-no-tag", level: undefined }),
    sheet("b", 10, 10, { id: "active-asset-no-tag", level: undefined }),
  ];
  const inactive = assetStepProgress(current, "a");
  assert.equal(inactive.percent, null);
  assert.equal(inactive.complete, false);
  assert.equal(inactive.coverage, "not-applicable");
  assert.equal(inactive.missingSheets, 0);
  const gantt = activityStepProgress(current, [], "OLD", "2026-11-14");
  assert.equal(gantt.percent, null);
  assert.equal(gantt.status.colour, null);
  assert.equal(gantt.coverage, "not-applicable");
  const report = buildProjectReport(
    dataFor(current),
    "p",
    { vendor: "Supplier A" },
    { now },
  );
  assert.equal((report.rows[0] as TaggingReportRow).status.colour, null);
  const missing = assetStepProgress(current, "b");
  assert.equal(missing.percent, null);
  assert.equal(missing.missingSheets, 1);
  assert.equal(missing.coverage, "missing");
  assert.equal(missing.complete, false);
});
