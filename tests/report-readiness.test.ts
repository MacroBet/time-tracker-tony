import test from "node:test";
import assert from "node:assert/strict";
import { commissioning, type Commissioning } from "../src/lib/commissioning";
import { emptyData, type AppData } from "../src/lib/domain";
import { createDemoData } from "../src/lib/demo-data";
import {
  indexSourceProgramme,
  type SourceProgramme,
} from "../src/lib/programme-source";
import { resolveWorkingSourceIndex } from "../src/lib/schedule-working";
import { buildReportReadiness } from "../src/lib/report-readiness";

test("completed activities without dated actual finishes make progress inputs partial", () => {
  const data = createDemoData(new Date("2026-11-23T12:00:00Z"), {
    showcase: true,
  });
  const project = data.projects.find((row) => row.id === "p-demo-empty")!;
  project.commissioning = commissioning();
  project.commissioning.schedule = [
    {
      activityId: "complete-undated",
      name: "Completed without a date",
      baselineFinish: "2026-11-20",
      progress: 100,
    },
  ];
  const progress = buildReportReadiness(data, project.id).reports.find(
    (row) => row.id === "progress",
  )!;
  assert.equal(progress.state, "partial");
  const actual = progress.criteria.find((row) => row.id === "actual-finishes")!;
  assert.equal(actual.required, true);
  assert.equal(actual.recorded, 0);
  assert.equal(actual.total, 1);
});

const now = new Date("2026-11-23T12:00:00Z");
const opts = { now };
function fixture(state: Commissioning = commissioning()): AppData {
  return {
    ...structuredClone(emptyData),
    projects: [
      {
        id: "p",
        name: "Synthetic project",
        location: "Synthetic only",
        companyId: "c",
        commissioning: state,
      },
    ],
  };
}
function source(float = "0", dates = true) {
  const programme: SourceProgramme = {
    format: "p6-xer-v1",
    source: {
      fileName: "synthetic-readiness.xer",
      sha256: "a".repeat(64),
      encoding: "utf-8",
      header: "synthetic",
    },
    tables: {
      PROJECT: {
        fields: ["proj_id", "critical_path_type", "critical_drtn_hr_cnt"],
        rows: [["p6", "CT_TotFloat", "0"]],
        lines: [1],
      },
      TASK: {
        fields: [
          "task_id",
          "task_code",
          "task_name",
          "proj_id",
          "status_code",
          "target_start_date",
          "target_end_date",
          "total_float_hr_cnt",
        ],
        rows: [
          [
            "one",
            "SYNTH-1",
            "Synthetic activity",
            "p6",
            "TK_NotStart",
            dates ? "2026-11-24" : "",
            dates ? "2026-11-28" : "",
            float,
          ],
        ],
        lines: [2],
      },
    },
  };
  return indexSourceProgramme(programme);
}
const find = (result: ReturnType<typeof buildReportReadiness>, id: string) => {
  const item = result.reports.find((row) => row.id === id);
  assert(item, id);
  return item;
};

test("P6-only import supports dated lookahead but cannot create equipment, tag applicability, checksheets or supplier links", () => {
  const index = source();
  const state = commissioning();
  state.sourceProgrammeSummary = index.summary;
  const data = fixture(state);
  const before = JSON.stringify(data);
  const result = buildReportReadiness(data, "p", index, opts);
  assert.equal(result.summary.sourceActivities, 1);
  assert.equal(result.summary.assets, 0);
  assert.equal(result.summary.applicableTags, 0);
  assert.equal(find(result, "lookahead").state, "ready");
  assert.equal(find(result, "lookahead").records, 1);
  assert.equal(find(result, "tags").state, "missing");
  assert.equal(find(result, "tagging").state, "missing");
  assert.equal(find(result, "tasks").state, "missing");
  assert.equal(find(result, "vendors").state, "partial");
  assert.equal(
    find(result, "vendors").criteria.find(
      (row) => row.id === "activity-equipment",
    )?.recorded,
    0,
  );
  assert.equal(find(result, "critical").state, "ready");
  assert.equal(find(result, "critical").records, 1);
  assert.equal(JSON.stringify(data), before);
  assert.equal("rows" in result, false);
  assert(
    result.reports
      .flatMap((row) => row.criteria)
      .every((row) => row.href.includes("projectId=p")),
  );
});

test("rich synthetic data uses the same counts while empty outcome fields do not imply failed reports or approval", () => {
  const data = createDemoData(now, { showcase: true });
  const result = buildReportReadiness(data, "p-demo-rich", undefined, opts);
  assert.equal(result.summary.assets, 28);
  assert.equal(result.summary.tasks, 120);
  assert.equal(find(result, "tags").state, "ready");
  assert.equal(find(result, "equipment").state, "ready");
  assert.equal(find(result, "works-to-go").state, "ready");
  assert.equal(find(result, "works-to-go").records, 0);
  assert.equal(find(result, "critical").state, "missing");
  assert(
    result.notes.some((note) =>
      note.includes("does not mean the work is complete"),
    ),
  );
});

test("empty imported coverage is missing input, whereas a dated programme outside the current window is a valid empty lookahead", () => {
  const empty = buildReportReadiness(fixture(), "p", undefined, opts);
  assert.equal(find(empty, "lookahead").state, "missing");
  assert.equal(find(empty, "progress").state, "missing");
  const state = commissioning();
  state.schedule = [
    {
      activityId: "later",
      name: "Recorded future work",
      start: "2027-01-01",
      finish: "2027-01-03",
      baselineFinish: "2027-01-03",
    },
  ];
  const result = buildReportReadiness(fixture(state), "p", undefined, opts);
  assert.equal(find(result, "lookahead").state, "ready");
  assert.equal(find(result, "lookahead").records, 0);
  assert.equal(find(result, "vendors").state, "ready");
});

test("missing dates and P6 total float remain missing instead of zero or an inferred current critical path", () => {
  const index = source("", false);
  const state = commissioning();
  state.sourceProgrammeSummary = index.summary;
  const result = buildReportReadiness(fixture(state), "p", index, opts);
  assert.equal(find(result, "lookahead").state, "partial");
  assert.equal(
    find(result, "lookahead").criteria.find(
      (row) => row.id === "activity-dates",
    )?.recorded,
    0,
  );
  assert.equal(find(result, "critical").state, "missing");
  assert.equal(
    find(result, "critical").criteria.find(
      (row) => row.id === "saved-criticality",
    )?.recorded,
    0,
  );
});

test("stale saved criticality is flagged and source-unavailable totals stay unknown", () => {
  const index = source();
  const state = commissioning();
  state.sourceProgrammeSummary = index.summary;
  state.workingSchedule = {
    sourceSha256: index.summary.sha256,
    revision: 1,
    activityPatches: [{ internalId: "one", finish: "2026-12-05" }],
    addedActivities: [],
    addedLinks: [],
    removedLinkIds: [],
    receipts: [],
  };
  const result = buildReportReadiness(
    fixture(state),
    "p",
    resolveWorkingSourceIndex(index, state.workingSchedule),
    opts,
  );
  assert.equal(find(result, "critical").state, "partial");
  assert.equal(
    find(result, "critical").criteria.find(
      (row) => row.id === "criticality-current",
    )?.recorded,
    0,
  );
  const unavailable = buildReportReadiness(
    fixture(state),
    "p",
    undefined,
    opts,
  );
  assert.equal(unavailable.summary.activities, null);
  assert.equal(unavailable.summary.sourceActivities, null);
  for (const id of ["progress", "lookahead", "vendors", "critical"]) {
    assert.equal(find(unavailable, id).state, "unavailable");
    assert.equal(find(unavailable, id).records, null);
  }
});

test("recorded levels create tag rows without asserting approval; required sheets are a separate prerequisite for step percentages", () => {
  const state = commissioning();
  state.config.levels = ["L1"];
  state.assets = [
    {
      id: "a",
      name: "Pump",
      equipmentType: "Pump",
      levels: ["L1"],
      location: "Synthetic",
    },
  ];
  const result = buildReportReadiness(fixture(state), "p", undefined, opts);
  assert.equal(find(result, "tags").state, "ready");
  assert.equal(find(result, "tags").records, 1);
  assert.equal(
    find(result, "tags").criteria.find((row) => row.id === "tag-reviews")
      ?.recorded,
    0,
  );
  assert.equal(find(result, "tagging").state, "partial");
  assert.equal(
    find(result, "tagging").criteria.find((row) => row.id === "tag-checksheets")
      ?.recorded,
    0,
  );
});

test("task access restrictions do not become false zero counts; unrelated project tasks are excluded", () => {
  const data = createDemoData(now, { showcase: true });
  const hidden = buildReportReadiness(data, "p-demo-rich", undefined, {
    now,
    taskAccess: false,
  });
  assert.equal(hidden.summary.tasks, null);
  for (const id of ["tasks", "handover", "conformance"]) {
    assert.equal(find(hidden, id).state, "unavailable");
    assert.equal(find(hidden, id).records, null);
  }
  const empty = buildReportReadiness(data, "p-demo-empty", undefined, opts);
  assert.equal(empty.summary.tasks, 0);
  assert.throws(
    () => buildReportReadiness(data, "not-accessible", undefined, opts),
    /Project not found/,
  );
});
