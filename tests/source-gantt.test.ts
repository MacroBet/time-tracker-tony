import test from "node:test";
import assert from "node:assert/strict";
import { sourcePageAnchor, sourceBar } from "../src/lib/source-gantt";
import type { SourceActivityView } from "../src/lib/programme-source";
const row = (values: Partial<SourceActivityView>) =>
  ({ milestone: false, ...values }) as SourceActivityView;
test("source view opens near the recorded page date cluster, including finish-only milestones", () => {
  assert.equal(
    sourcePageAnchor([
      row({ start: "2026-09-18" }),
      row({ start: "2026-11-25" }),
    ]),
    "2026-09-16",
  );
  assert.equal(
    sourcePageAnchor([row({ milestone: true, finish: "2026-10-15" })]),
    "2026-10-13",
  );
  assert.equal(
    sourcePageAnchor([
      row({ start: "2026-03-30" }),
      row({ start: "2026-09-21" }),
      row({ start: "2026-09-21" }),
    ]),
    "2026-09-19",
  );
  assert.equal(sourcePageAnchor([]), undefined);
});
test("source bars clip dates without changing durations or drawing reversed/outside records", () => {
  const item = row({ start: "2026-10-10", finish: "2026-10-15" });
  const before = JSON.stringify(item);
  assert.deepEqual(sourceBar(item, "2026-10-13", 35, 48), {
    left: 0,
    width: 144,
    start: -3,
    finish: 2,
  });
  assert.equal(JSON.stringify(item), before);
  assert.equal(
    sourceBar(
      row({ start: "2025-01-01", finish: "2025-01-02" }),
      "2026-10-13",
      35,
      48,
    ),
    undefined,
  );
  assert.equal(
    sourceBar(
      row({ start: "2026-10-15", finish: "2026-10-14" }),
      "2026-10-13",
      35,
      48,
    ),
    undefined,
  );
  assert.equal(
    sourceBar(
      row({ milestone: true, finish: "2026-10-15" }),
      "2026-10-13",
      35,
      48,
    )?.width,
    12,
  );
});
