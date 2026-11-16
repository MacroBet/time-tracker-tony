import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCopilotReadCommand,
  searchSavedSchedule,
  savedScheduleSearchReply,
  savedLookaheadReply,
} from "../src/lib/copilot-reads";
import {
  indexSourceProgramme,
  querySourceProgrammeIndex,
  type SourceProgramme,
} from "../src/lib/programme-source";
import { commissioning } from "../src/lib/commissioning";
import { emptyData } from "../src/lib/domain";
import { buildProjectReport } from "../src/lib/project-reports";
const now = new Date("2026-11-16T12:00:00Z");
function source(count = 16969) {
  const fields = [
    "task_id",
    "task_code",
    "task_name",
    "status_code",
    "restart_date",
    "reend_date",
    "act_end_date",
    "target_end_date",
  ];
  return indexSourceProgramme({
    format: "p6-xer-v1",
    source: {
      fileName: "synthetic.xer",
      sha256: "a".repeat(64),
      encoding: "utf-8",
      header: "synthetic",
    },
    tables: {
      TASK: {
        fields,
        rows: Array.from({ length: count }, (_, i) => [
          String(i),
          `ACT-${i}`,
          i === count - 1
            ? "Commission CHILLERS"
            : i === count - 2
              ? "Inspect chiller"
              : `Other activity ${i}`,
          "TK_NotStart",
          i % 2 ? "2026-11-29" : "2026-11-16",
          "2026-11-29",
          "",
          "2026-11-29",
        ]),
        lines: Array.from({ length: count }, (_, i) => i + 2),
      },
    },
  } as SourceProgramme);
}
test("the two documented read requests have a bounded explicit grammar; ambiguous or write requests stay with the real provider", () => {
  assert.deepEqual(
    parseCopilotReadCommand("Show me the next two weeks look ahead.", now),
    { kind: "lookahead", from: "2026-11-16" },
  );
  assert.deepEqual(
    parseCopilotReadCommand("Show me all chillers on the schedule.", now),
    { kind: "schedule-search", query: "chillers" },
  );
  for (const text of [
    "Next 2 weeks",
    "Show the two-week lookahead",
    "Lookahead for the next two weeks",
    "Mostrami le prossime due settimane",
  ])
    assert.equal(parseCopilotReadCommand(text, now)?.kind, "lookahead", text);
  for (const text of [
    'Example: "Show me the next two weeks look ahead."',
    "Don't show me the next two weeks look ahead",
    "Show me the next two weeks look ahead and move it to Friday",
    "Show me the next two weeks look ahead for Supplier A",
    "Show me all chillers and pumps on the schedule",
    "Show me all chillers only on the schedule",
    "Show me all change deadlines on the schedule",
    "Delete all chillers on the schedule",
    "Show me all chillers on the schedule then confirm",
    "Show me all chillers on the schedule for next month",
    "How does the two week lookahead work?",
    "Show me all chillers in assets",
  ])
    assert.equal(parseCopilotReadCommand(text, now), undefined, text);
});
test("Schedule search scans all 16969 records beyond visible pages; chiller singular/plural yield the same exact set and bounded links", () => {
  const index = source();
  const singular = searchSavedSchedule(index, "p", 4, {
    query: "chiller",
    limit: 1,
  });
  const plural = searchSavedSchedule(index, "p", 4, {
    query: "CHILLERS",
    limit: 20,
  });
  assert.equal(singular.population, 16969);
  assert.equal(singular.total, 2);
  assert.equal(singular.records.length, 1);
  assert.equal(singular.nextOffset, 1);
  assert.equal(plural.total, 2);
  assert.equal(plural.records.length, 2);
  assert.equal(plural.records[0].activityId, "ACT-16967");
  assert.equal(singular.sourceSha256, "a".repeat(64));
  assert.equal(singular.projectVersion, 4);
  const q = new URL(plural.href, "https://local.test").searchParams.get("q")!;
  const page = querySourceProgrammeIndex(index, { q });
  assert.equal(page.total, plural.total);
  assert.deepEqual(
    page.activities.map((row) => row.internalId),
    plural.records.map((row) => row.internalId),
  );
  const second = searchSavedSchedule(index, "p", 4, {
    query: "chillers",
    offset: 1,
    limit: 1,
  });
  assert.equal(second.total, 2);
  assert.equal(second.nextOffset, null);
  assert.equal(second.records[0].internalId, plural.records[1].internalId);
  assert(
    singular.records.every(
      (row) =>
        new URL(row.href, "https://local.test").searchParams.get(
          "projectId",
        ) === "p",
    ),
  );
  const text = savedScheduleSearchReply(singular);
  assert(text.includes("no AI generation"));
  assert(text.includes("Showing 1"));
  assert(text.includes("separate populations"));
});
test("empty Schedule search distinguishes zero matching activity names from empty equipment inventory", () => {
  const result = searchSavedSchedule(source(80), "p", 1, {
    query: "no-matching-name",
  });
  assert.equal(result.total, 0);
  assert.equal(result.population, 80);
  assert(
    savedScheduleSearchReply(result).includes(
      "does not establish that no such equipment exists",
    ),
  );
});
test("a saved lookahead reply matches the deterministic report window/total, preserves missing mappings and explicitly labels zero", () => {
  const state = {
    ...commissioning(),
    schedule: [
      { activityId: "undated", name: "Undated" },
      {
        activityId: "old",
        name: "Overdue",
        start: "2026-01-01",
        finish: "2026-01-02",
      },
    ],
  };
  const data = {
    ...structuredClone(emptyData),
    projects: [
      {
        id: "p",
        name: "Local",
        location: "",
        companyId: "c",
        commissioning: state,
      },
    ],
  };
  const report = buildProjectReport(
    data,
    "p",
    { report: "lookahead" },
    { now },
  );
  assert.equal(report.total, 0);
  assert.equal(report.coverage.undatedActivities, 1);
  assert.equal(report.coverage.overdueActivities, 1);
  const text = savedLookaheadReply(report);
  assert(text.includes("2026-11-16–2026-11-29"));
  assert(text.includes("0 matching saved activities"));
  assert(text.includes("does not mean the project has no work"));
  assert(text.includes("1 undated and 1 open overdue"));
  const complete = buildProjectReport(
    data,
    "p",
    { report: "lookahead" },
    { now, sourceIndex: source() },
  );
  assert.equal(complete.coverage.activities, 16971);
  assert.equal(complete.total, 16969);
  assert.equal(complete.rows.length, 20);
  assert.equal(complete.coverage.activitiesWithoutAssetLinks, 16969);
  assert.equal(complete.coverage.activitiesMissingVendor, 16969);
  assert(
    savedLookaheadReply(complete).includes("16969 matching saved activities"),
  );
});
