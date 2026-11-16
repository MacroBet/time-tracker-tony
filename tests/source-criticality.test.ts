import test from "node:test";
import assert from "node:assert/strict";
import {
  indexSourceProgramme,
  querySourceProgrammeIndex,
  type SourceProgramme,
} from "../src/lib/programme-source";
import {
  resolveWorkingSourceIndex,
  type WorkingSchedule,
} from "../src/lib/schedule-working";
import { resolveScheduleViewRow } from "../src/lib/schedule-view-context";
const sha = "c".repeat(64);
const projectFields = [
  "proj_id",
  "critical_path_type",
  "critical_drtn_hr_cnt",
  "last_recalc_date",
];
const taskFields = [
  "task_id",
  "task_code",
  "task_name",
  "proj_id",
  "total_float_hr_cnt",
  "free_float_hr_cnt",
  "status_code",
  "clndr_id",
  "restart_date",
  "reend_date",
  "float_path",
];
function fixture(
  rows?: string[][],
  projects = [["p6", "CT_TotFloat", "0", "2026-09-13 00:00"]],
): SourceProgramme {
  const tasks = rows ?? [
    [
      "i0",
      "A0",
      "Negative float",
      "p6",
      "-2.5",
      "0",
      "TK_Active",
      "c1",
      "2026-11-16",
      "2026-11-18",
      "",
    ],
    [
      "i1",
      "A1",
      "Zero float",
      "p6",
      "0",
      "0",
      "TK_NotStart",
      "c1",
      "2026-11-16",
      "2026-11-18",
      "",
    ],
    [
      "i2",
      "A2",
      "Positive float",
      "p6",
      "0.25",
      "0",
      "TK_NotStart",
      "c2",
      "2026-01-01",
      "2026-01-02",
      "1",
    ],
    [
      "i3",
      "A3",
      "Missing completed",
      "p6",
      "",
      "-99",
      "TK_Complete",
      "c1",
      "2026-01-01",
      "2026-01-02",
      "1",
    ],
    [
      "i4",
      "A4",
      "Invalid float",
      "p6",
      "NaN",
      "0",
      "TK_NotStart",
      "c1",
      "2026-11-16",
      "2026-11-18",
      "",
    ],
  ];
  return {
    format: "p6-xer-v1",
    source: {
      fileName: "offline-criticality.xer",
      sha256: sha,
      encoding: "utf-8",
      header: "synthetic",
    },
    tables: {
      PROJECT: {
        fields: projectFields,
        rows: projects,
        lines: projects.map((_, i) => i + 2),
      },
      TASK: {
        fields: taskFields,
        rows: tasks,
        lines: tasks.map((_, i) => i + 20),
      },
      TASKPRED: {
        fields: ["pred_task_id", "task_id", "pred_type", "lag_hr_cnt"],
        rows: [[tasks[0][0], tasks[1][0], "PR_FS", "0"]],
        lines: [100],
      },
    },
  };
}
const working = (values: Partial<WorkingSchedule> = {}): WorkingSchedule => ({
  sourceSha256: sha,
  revision: 1,
  activityPatches: [],
  addedActivities: [],
  removedLinkIds: [],
  addedLinks: [],
  receipts: [],
  ...values,
});
test("the recorded P6 total-float threshold includes negative and zero float, separates missing, and never substitutes free float/status/late dates/float path", () => {
  const raw = fixture(),
    original = JSON.stringify(raw),
    index = indexSourceProgramme(raw);
  assert.deepEqual(
    index.activities.map((row) => row.criticality?.state),
    ["critical", "critical", "non-critical", "unknown", "unknown"],
  );
  assert.equal(index.activities[3].criticality?.reason, "missing-total-float");
  assert.equal(index.activities[4].criticality?.reason, "invalid-total-float");
  assert.equal(index.activities[2].criticality?.freeFloatHours, 0);
  assert.deepEqual(index.criticality?.coverage, {
    total: 5,
    critical: 2,
    nonCritical: 1,
    unknown: 2,
  });
  assert.equal(index.criticality?.criteria[0].thresholdHours, 0);
  assert.equal(index.criticality?.criteria[0].pathType, "CT_TotFloat");
  assert.equal(
    index.criticality?.criteria[0].lastRecalculatedAt,
    "2026-09-13 00:00",
  );
  assert.equal(index.criticality?.recalculation, "not-recalculated");
  assert.equal(JSON.stringify(raw), original);
});
test("criterion association is exact per P6 project; missing, ambiguous, unsupported longest-path and blank threshold stay unknown", () => {
  const rows = fixture().tables.TASK.rows.map((row) => [...row]);
  const projects = [
    ["p6", "CT_TotFloat", "0", ""],
    ["second", "CT_TotFloat", "8", ""],
    ["longest", "CT_LongestPath", "0", ""],
    ["missing-threshold", "CT_TotFloat", "", ""],
    ["bad-threshold", "CT_TotFloat", "NaN", ""],
  ];
  rows[0][3] = "second";
  rows[0][4] = "4";
  rows[1][3] = "longest";
  rows[2][3] = "missing-threshold";
  rows[3][3] = "unmapped";
  rows[3][4] = "-100";
  rows[4][3] = "bad-threshold";
  rows[4][4] = "0";
  const index = indexSourceProgramme(fixture(rows, projects));
  assert.equal(index.activities[0].criticality?.state, "critical");
  assert.equal(
    index.activities[1].criticality?.reason,
    "unsupported-project-criterion",
  );
  assert.equal(
    index.activities[2].criticality?.reason,
    "missing-float-threshold",
  );
  assert.equal(
    index.activities[3].criticality?.reason,
    "missing-project-criterion",
  );
  assert.equal(
    index.activities[4].criticality?.reason,
    "missing-float-threshold",
  );
  const duplicate = indexSourceProgramme(
    fixture(undefined, [projects[0], projects[0]]),
  );
  assert(
    duplicate.activities.every(
      (row) => row.criticality?.reason === "missing-project-criterion",
    ),
  );
  const missingId = fixture();
  missingId.tables.TASK.rows[0][3] = "";
  assert.equal(
    indexSourceProgramme(missingId).activities[0].criticality?.state,
    "unknown",
  );
});
test("criticality filters compose with name/ID, calendar and status and preserve filtered-page row references", () => {
  const index = indexSourceProgramme(fixture());
  assert.equal(querySourceProgrammeIndex(index, { critical: "yes" }).total, 2);
  assert.equal(querySourceProgrammeIndex(index, { critical: "no" }).total, 1);
  assert.equal(
    querySourceProgrammeIndex(index, { critical: "unknown" }).total,
    2,
  );
  assert.equal(
    querySourceProgrammeIndex(index, {
      critical: "yes",
      status: "TK_NotStart",
      calendar: "c1",
    }).total,
    1,
  );
  assert.equal(
    querySourceProgrammeIndex(index, { critical: "yes", q: "i0" }).total,
    1,
    "Internal source IDs use the same display search index.",
  );
  const result = querySourceProgrammeIndex(index, {
    critical: "unknown",
    q: "completed",
  });
  assert.deepEqual(result.criticality?.filteredCoverage, {
    total: 1,
    critical: 0,
    nonCritical: 0,
    unknown: 1,
  });
  const row = resolveScheduleViewRow(
    index,
    {
      projectId: "p",
      projectVersion: 7,
      sourceSha256: sha,
      mode: "working",
      page: 0,
      query: { q: "", wbs: "", calendar: "", status: "", critical: "unknown" },
    },
    { projectId: "p", projectVersion: 7 },
    1,
  );
  assert.equal(row.activity.internalId, "i3");
  assert.equal(row.total, 2);
});
test("a complete 16969-row population filters before paging and finds critical rows beyond the first15000", () => {
  const rows = Array.from({ length: 16969 }, (_, i) => [
    `id-${i}`,
    `A-${i}`,
    "Activity",
    "p6",
    i === 16968 ? "0" : "1",
    "0",
    "TK_NotStart",
    "c1",
    "2026-11-16",
    "2026-11-18",
    "",
  ]);
  const index = indexSourceProgramme(fixture(rows));
  const page = querySourceProgrammeIndex(index, { critical: "yes", page: 999 });
  assert.equal(page.total, 1);
  assert.equal(page.page, 0);
  assert.equal(page.activities[0].internalId, "id-16968");
  assert.equal(index.criticality?.coverage.nonCritical, 16968);
});
test("working date/link/addition edits mark original P6 criticality stale without recalculating any float, hash or source date; mappings alone do not", () => {
  const raw = fixture(),
    before = JSON.stringify(raw),
    index = indexSourceProgramme(raw);
  const mapped = resolveWorkingSourceIndex(
    index,
    working({ activityPatches: [{ internalId: "i0", assetIds: ["asset"] }] }),
  );
  assert.equal(mapped.criticality?.workingStale, false);
  assert.equal(mapped.criticality?.workingRevision, 1);
  const changed = resolveWorkingSourceIndex(
    index,
    working({
      revision: 2,
      activityPatches: [{ internalId: "i0", finish: "2027-01-01" }],
      removedLinkIds: [100],
      addedLinks: [
        {
          predecessorId: "i1",
          successorId: "i2",
          sourceLine: -1,
          type: "PR_SS",
          lagHours: -2.5,
        },
      ],
      addedActivities: [
        {
          internalId: "new",
          activityId: "FT-00001",
          name: "New saved working row",
          assetId: "asset",
          taskId: "task",
          finish: "2027-01-02",
          createdBy: "u",
          createdAt: "2026-11-16T12:00:00Z",
        },
      ],
    }),
  );
  assert.equal(changed.activities[0].finish, "2027-01-01");
  assert.deepEqual(
    changed.activities[0].criticality,
    index.activities[0].criticality,
  );
  assert.equal(changed.criticality?.sourceSha256, sha);
  assert.equal(changed.criticality?.workingStale, true);
  assert.equal(changed.criticality?.workingRevision, 2);
  assert.deepEqual(changed.criticality?.coverage, {
    total: 6,
    critical: 2,
    nonCritical: 1,
    unknown: 3,
  });
  assert.equal(
    changed.activities.at(-1)?.criticality?.reason,
    "not-in-p6-source",
  );
  assert.equal(
    querySourceProgrammeIndex(changed, { critical: "unknown" }).total,
    3,
  );
  assert.equal(
    querySourceProgrammeIndex(changed, { q: "i0" }).total,
    1,
    "Working source search includes internal IDs too.",
  );
  assert.equal(index.criticality?.workingStale, false);
  assert.equal(index.activities[0].finish, "2026-11-18");
  assert.equal(JSON.stringify(raw), before);
});
