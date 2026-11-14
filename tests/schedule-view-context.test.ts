import test from "node:test";
import assert from "node:assert/strict";
import {
  indexSourceProgramme,
  type SourceProgramme,
} from "../src/lib/programme-source";
import { resolveScheduleViewRow } from "../src/lib/schedule-view-context";
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
