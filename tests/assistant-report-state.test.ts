import test from "node:test";
import assert from "node:assert/strict";
import { refineAssistantReport } from "../src/lib/assistant-report-state";
const empty = {
  report: null,
  vendor: null,
  level: null,
  late: null,
  discipline: null,
  query: null,
  from: null,
  workStatus: null,
  activityStatus: null,
  offset: null,
  limit: null,
  reset: false,
  clear: [],
};
test("Tony report then supplier then L3 then late retains structured filters", () => {
  const all = refineAssistantReport(undefined, {
    ...empty,
    report: "tagging",
    reset: true,
  });
  const vendor = refineAssistantReport(all, { ...empty, vendor: "XYZ" });
  const level = refineAssistantReport(vendor, { ...empty, level: "L3" });
  const late = refineAssistantReport(level, { ...empty, late: "late" });
  const direct = refineAssistantReport(undefined, {
    ...empty,
    report: "tagging",
    vendor: "XYZ",
    level: "L3",
    late: "late",
    reset: true,
  });
  assert.deepEqual(late, direct);
});
test("filter refinement resets paging, explicit clear and a new report kind do not leak stale constraints", () => {
  const old = refineAssistantReport(undefined, {
    ...empty,
    report: "tagging",
    vendor: "XYZ",
    level: "L1",
    offset: 40,
    reset: true,
  });
  const next = refineAssistantReport(old, { ...empty, level: "L3" });
  assert.equal(next.offset, 0);
  assert.equal(next.vendor, "XYZ");
  const cleared = refineAssistantReport(next, { ...empty, clear: ["vendor"] });
  assert.equal(cleared.vendor, undefined);
  assert.equal(cleared.level, "L3");
  const works = refineAssistantReport(next, {
    ...empty,
    report: "works-to-go",
  });
  assert.equal(works.vendor, undefined);
  assert.equal(works.level, undefined);
});
test("unclassified supplier is an explicit filter and invalid dates/levels are rejected", () => {
  assert.equal(
    refineAssistantReport(undefined, { ...empty, vendor: "__missing__" })
      .vendor,
    "__missing__",
  );
  assert.throws(() =>
    refineAssistantReport(undefined, { ...empty, level: "L99" }),
  );
  assert.throws(() =>
    refineAssistantReport(undefined, { ...empty, from: "2026-02-30" }),
  );
  assert.throws(() =>
    refineAssistantReport(undefined, { ...empty, offset: -1 }),
  );
});
