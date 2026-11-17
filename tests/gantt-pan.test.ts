import test from "node:test";
import assert from "node:assert/strict";
import { pannedScheduleDate } from "../src/lib/gantt-pan";

test("ruler navigation snaps symmetrically and crosses month/year boundaries", () => {
  assert.equal(pannedScheduleDate("2026-12-31", -96, 48), "2027-01-02");
  assert.equal(pannedScheduleDate("2027-01-01", 96, 48), "2026-12-30");
  assert.equal(pannedScheduleDate("2026-11-17", 24, 48), "2026-11-16");
  assert.equal(pannedScheduleDate("2026-11-17", -24, 48), "2026-11-18");
  assert.equal(pannedScheduleDate("2026-11-17", -8, 4), "2026-11-19");
});
test("ruler navigation preserves valid date bounds and rejects unusable geometry", () => {
  assert.equal(pannedScheduleDate("0001-01-01", 100, 1), "0001-01-01");
  assert.equal(pannedScheduleDate("9999-12-31", -100, 1), "9999-12-31");
  assert.equal(pannedScheduleDate("2026-11-17", 10, 0), "2026-11-17");
  assert.equal(pannedScheduleDate("2026-11-17", NaN, 48), "2026-11-17");
});
