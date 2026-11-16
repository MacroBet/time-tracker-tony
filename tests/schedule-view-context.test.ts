import test from "node:test";
import assert from "node:assert/strict";
import {
  indexSourceProgramme,
  type SourceProgramme,
} from "../src/lib/programme-source";
import {
  resolveScheduleViewRow,
  resolveScheduleViewCommand,
  scheduleViewSnapshotSchema,
  scheduleViewCommandSchema,
} from "../src/lib/schedule-view-context";
import { sourceGanttInitialView } from "../src/lib/source-gantt";
const source: SourceProgramme = {
  format: "p6-xer-v1",
  source: {
    fileName: "synthetic.xer",
    sha256: "a".repeat(64),
    encoding: "utf-8",
    header: "Synthetic",
  },
  tables: {
    TASK: {
      fields: ["task_id", "task_code", "task_name"],
      rows: Array.from({ length: 120 }, (_, i) => [
        `i${i}`,
        `ACT-${i}`,
        `${i % 2 === 0 ? "Pump" : "Valve"} ${i}`,
      ]),
      lines: Array.from({ length: 120 }, (_, i) => i + 1),
    },
  },
};
const index = indexSourceProgramme(source);
const snapshot = {
  projectId: "p",
  sourceSha256: source.source.sha256,
  projectVersion: 3,
  mode: "working",
  page: 0,
  query: { q: "Pump", wbs: "", calendar: "", status: "" },
};
test("a spoken row is resolved under the captured filters beyond the first page", () => {
  const before = JSON.stringify(source);
  const result = resolveScheduleViewRow(
    index,
    snapshot,
    { projectId: "p", projectVersion: 3 },
    51,
  );
  assert.equal(result.activity.internalId, "i100");
  assert.equal(result.activity.activityId, "ACT-100");
  assert.equal(result.total, 60);
  assert.equal(JSON.stringify(source), before);
});
test("stale, foreign or absent row context cannot identify another schedule activity", () => {
  assert.throws(
    () =>
      resolveScheduleViewRow(
        index,
        snapshot,
        { projectId: "p", projectVersion: 4 },
        1,
      ),
    /changed/,
  );
  assert.throws(
    () =>
      resolveScheduleViewRow(
        index,
        snapshot,
        { projectId: "other", projectVersion: 3 },
        1,
      ),
    /changed/,
  );
  assert.throws(
    () =>
      resolveScheduleViewRow(
        index,
        { ...snapshot, sourceSha256: "b".repeat(64) },
        { projectId: "p", projectVersion: 3 },
        1,
      ),
    /changed/,
  );
  assert.throws(
    () =>
      resolveScheduleViewRow(
        index,
        snapshot,
        { projectId: "p", projectVersion: 3 },
        61,
      ),
    /not present/,
  );
  assert.throws(
    () =>
      resolveScheduleViewRow(
        index,
        snapshot,
        { projectId: "p", projectVersion: 3 },
        0,
      ),
    /valid/,
  );
});

test("display snapshots retain filtered row identity and reject stale view-command scopes", () => {
  const display = sourceGanttInitialView("2026-11-16");
  const displayed = { ...snapshot, display };
  assert.equal(
    scheduleViewSnapshotSchema.parse(displayed).display?.anchor,
    "2026-11-16",
  );
  assert.equal(
    resolveScheduleViewRow(
      index,
      displayed,
      { projectId: "p", projectVersion: 3 },
      51,
    ).activity.internalId,
    "i100",
  );
  const subject = {
    projectId: "p",
    sourceSha256: source.source.sha256,
    projectVersion: 3,
  };
  const message = { ...subject, command: { type: "today" } };
  assert.deepEqual(resolveScheduleViewCommand(message, subject), {
    type: "today",
  });
  for (const change of [
    { projectId: "other" },
    { projectVersion: 4 },
    { sourceSha256: "b".repeat(64) },
  ])
    assert.throws(
      () => resolveScheduleViewCommand({ ...message, ...change }, subject),
      /changed/,
    );
  assert.throws(() =>
    resolveScheduleViewCommand(
      { ...message, command: { type: "delete" } },
      subject,
    ),
  );
  assert.equal(JSON.stringify(display), JSON.stringify(displayed.display));
  assert.equal(
    resolveScheduleViewRow(
      index,
      { ...displayed, query: { ...snapshot.query, critical: "unknown" } },
      { projectId: "p", projectVersion: 3 },
      51,
    ).activity.internalId,
    "i100",
  );
  assert.throws(
    () =>
      resolveScheduleViewRow(
        index,
        { ...displayed, query: { ...snapshot.query, critical: "yes" } },
        { projectId: "p", projectVersion: 3 },
        1,
      ),
    /not present/,
  );
  assert.equal(
    scheduleViewCommandSchema.parse({
      ...message,
      requestId: "8fd81443-cfbb-4cc7-9258-71311c758fd7",
    }).requestId,
    "8fd81443-cfbb-4cc7-9258-71311c758fd7",
  );
  assert.equal(
    scheduleViewCommandSchema.safeParse({
      ...message,
      requestId: "not-a-request-uuid",
    }).success,
    false,
  );
});
