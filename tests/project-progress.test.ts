import test from "node:test";
import assert from "node:assert/strict";
import { commissioning } from "../src/lib/commissioning";
import {
  indexSourceProgramme,
  type SourceProgramme,
} from "../src/lib/programme-source";
import { resolveWorkingSourceIndex } from "../src/lib/schedule-working";
import {
  buildProjectProgress,
  projectProgressDate,
  projectProgressPopulation,
} from "../src/lib/project-progress";

function source(rows: string[][]) {
  const programme: SourceProgramme = {
    format: "p6-xer-v1",
    source: {
      fileName: "progress-synthetic.xer",
      sha256: "a".repeat(64),
      encoding: "utf-8",
      header: "synthetic",
    },
    tables: {
      TASK: {
        fields: [
          "task_id",
          "task_code",
          "task_name",
          "status_code",
          "target_end_date",
          "act_end_date",
          "early_end_date",
          "phys_complete_pct",
        ],
        rows,
        lines: rows.map((_, i) => i + 1),
      },
    },
  };
  return indexSourceProgramme(programme);
}

test("source population is complete beyond the page size and keeps planned targets distinct from actual and working dates", () => {
  const index = source(
    Array.from({ length: 61 }, (_, i) => [
      String(i),
      `A-${i}`,
      `Activity ${i}`,
      "TK_Complete",
      "2026-11-10 17:00",
      "2026-11-15 17:00",
      "2026-11-20 17:00",
      "83",
    ]),
  );
  const state = commissioning();
  state.sourceProgrammeSummary = index.summary;
  state.workingSchedule = {
    sourceSha256: index.summary.sha256,
    revision: 1,
    activityPatches: [{ internalId: "0", finish: "2026-12-01" }],
    addedActivities: [],
    addedLinks: [],
    removedLinkIds: [],
    receipts: [],
  };
  const projected = resolveWorkingSourceIndex(index, state.workingSchedule);
  const before = JSON.stringify([...index.byId.values()]);
  const population = projectProgressPopulation(state, projected);
  assert.equal(population.rows.length, 61);
  assert.equal(population.rows[0].plannedFinish, "2026-11-10");
  assert.equal(population.rows[0].actualFinish, "2026-11-15");
  assert.equal(population.rows[0].plannedBasis, "source-target");
  assert.equal(population.plannedBasisCoverage.sourceTarget, 61);
  assert.equal(JSON.stringify([...index.byId.values()]), before);
});

test("explicit working mirrors count once while coincident source and managed activity codes remain separate", () => {
  const index = source([
    [
      "original",
      "SHARED",
      "Source",
      "TK_NotStart",
      "2026-11-10",
      "",
      "2026-11-20",
      "",
    ],
  ]);
  const state = commissioning();
  state.schedule = [
    {
      activityId: "SHARED",
      name: "Distinct managed activity",
      baselineFinish: "2026-11-12",
    },
    { activityId: "FT-added", name: "Working addition", finish: "2026-11-25" },
  ];
  state.workingSchedule = {
    sourceSha256: index.summary.sha256,
    revision: 1,
    activityPatches: [],
    addedLinks: [],
    removedLinkIds: [],
    receipts: [],
    addedActivities: [
      {
        internalId: "added",
        activityId: "FT-added",
        name: "Working addition",
        assetId: "equipment",
        taskId: "task",
        finish: "2026-11-25",
        createdBy: "user",
        createdAt: "2026-11-17T10:00:00Z",
      },
    ],
  };
  const population = projectProgressPopulation(
    state,
    resolveWorkingSourceIndex(index, state.workingSchedule),
  );
  assert.equal(population.rows.length, 3);
  assert.equal(population.mirroredManagedActivities, 1);
  assert(population.rows.some((row) => row.id === "managed:SHARED"));
  const added = population.rows.find((row) => row.internalId === "added")!;
  assert.equal(added.plannedFinish, undefined);
  assert.equal(added.plannedBasis, null);
  // An explicit mirror is one identity: later recorded dates must survive deduplication.
  state.schedule[1].baselineFinish = "2026-11-20";
  state.schedule[1].actualFinish = "2026-11-22";
  const recorded = projectProgressPopulation(
    state,
    resolveWorkingSourceIndex(index, state.workingSchedule),
  );
  const savedAddition = recorded.rows.find(
    (row) => row.internalId === "added",
  )!;
  assert.equal(recorded.rows.length, 3);
  assert.equal(savedAddition.plannedFinish, "2026-11-20");
  assert.equal(savedAddition.plannedBasis, "managed-baseline");
  assert.equal(savedAddition.actualFinish, "2026-11-22");
  assert.equal(savedAddition.completed, true);
});

test("managed baseline and actual dates never fall back to current finish or infer historical completion from 100 percent", () => {
  const state = commissioning();
  state.schedule = [
    {
      activityId: "baseline",
      name: "Baseline",
      baselineFinish: "2026-11-10",
      finish: "2026-12-01",
      actualFinish: "2026-11-15",
      progress: 100,
    },
    {
      activityId: "undated",
      name: "No actual date",
      finish: "2026-11-10",
      progress: 100,
    },
    {
      activityId: "partial",
      name: "Partial current snapshot",
      finish: "2026-11-18",
      progress: 80,
    },
  ];
  const population = projectProgressPopulation(state);
  assert.equal(population.rows[0].plannedFinish, "2026-11-10");
  assert.equal(population.rows[1].plannedFinish, undefined);
  assert.equal(population.rows[1].actualFinish, undefined);
  assert.equal(population.rows[1].completed, true);
  assert.equal(population.rows[2].completed, false);
  const progress = buildProjectProgress(population, "2026-11-17");
  assert.equal(progress.plannedToday, 33.3);
  assert.equal(progress.actualToday, 33.3);
  assert.equal(progress.completedWithoutActualDate, 1);
  assert.equal(progress.actualCoveragePartial, true);
});

test("invalid source dates remain missing; completed status has no invented dated history", () => {
  const index = source([
    [
      "bad",
      "BAD",
      "Invalid dates",
      "TK_Complete",
      "2026-02-30 17:00",
      "2026-13-01",
      "2026-11-20",
      "100",
    ],
    [
      "blank",
      "BLANK",
      "Missing dates",
      "TK_NotStart",
      "",
      "",
      "2026-11-20",
      "100",
    ],
  ]);
  const progress = buildProjectProgress(
    projectProgressPopulation(commissioning(), index),
    "2026-11-17",
  );
  assert.equal(progress.plannedToday, null);
  assert.equal(progress.actualToday, null);
  assert.equal(progress.plannedRecorded, 0);
  assert.equal(progress.actualRecorded, 0);
  assert.equal(progress.completedWithoutActualDate, 1);
  assert.equal(progress.actualCoveragePartial, true);
  assert(
    progress.points.every(
      (point) => point.planned === null && point.actual === null,
    ),
  );
  assert.equal(projectProgressDate("17/11/2026"), undefined);
  assert.equal(projectProgressDate("2026-11-17 unexpected"), undefined);
  assert.equal(projectProgressDate("2026-11-17 99:99"), undefined);
  assert.equal(projectProgressDate("2024-02-29 17:00:00"), "2024-02-29");
});

test("equal activity weights use the full denominator and cut actuals at as-of without drawing a future actual series", () => {
  const state = commissioning();
  state.version = 8;
  state.schedule = [
    {
      activityId: "1",
      name: "First",
      baselineFinish: "2026-11-03",
      actualFinish: "2026-11-04",
    },
    {
      activityId: "2",
      name: "Second",
      baselineFinish: "2026-11-10",
      actualFinish: "2026-11-24",
    },
    {
      activityId: "3",
      name: "Third",
      baselineFinish: "2026-11-24",
      progress: 50,
    },
    { activityId: "4", name: "Missing plan", finish: "2026-11-10" },
  ];
  const progress = buildProjectProgress(
    projectProgressPopulation(state),
    "2026-11-17",
  );
  assert.equal(progress.total, 4);
  assert.equal(progress.plannedToday, 50);
  assert.equal(progress.actualToday, 25);
  assert.equal(progress.plannedRecorded, 3);
  assert.equal(progress.actualRecorded, 2);
  assert.equal(progress.futureActualDates, 1);
  assert.deepEqual(
    progress.points.find((point) => point.date === progress.asOf),
    { date: "2026-11-17", planned: 50, actual: 25 },
  );
  assert(
    progress.points
      .filter((point) => point.date > progress.asOf)
      .every((point) => point.actual === null),
  );
  assert.deepEqual(progress.revision, { register: 8, sourceSha: null });
});

test("empty and unavailable source populations do not claim zero-percent overall progress", () => {
  const empty = buildProjectProgress(
    projectProgressPopulation(commissioning()),
    "2026-11-17",
  );
  assert.equal(empty.total, 0);
  assert.equal(empty.plannedToday, null);
  assert.equal(empty.actualToday, null);
  const index = source([
    ["1", "S", "Expected source", "TK_NotStart", "2026-11-10", "", "", ""],
  ]);
  const state = commissioning();
  state.sourceProgrammeSummary = index.summary;
  state.schedule = [
    {
      activityId: "managed",
      name: "Available managed",
      baselineFinish: "2026-11-10",
    },
  ];
  const missing = buildProjectProgress(
    projectProgressPopulation(state),
    "2026-11-17",
  );
  assert.equal(missing.sourceUnavailable, true);
  assert.equal(missing.plannedToday, null);
  assert.equal(missing.actualToday, null);
});

test("long programme sampling stays bounded, monotonic and retains the exact as-of point", () => {
  const state = commissioning();
  state.schedule = [
    {
      activityId: "long",
      name: "Very long recorded programme",
      baselineFinish: "9999-12-31",
      actualFinish: "0001-01-01",
    },
  ];
  const progress = buildProjectProgress(
    projectProgressPopulation(state),
    "2026-11-17",
  );
  assert(progress.points.length <= 240);
  assert(progress.points.some((point) => point.date === "2026-11-17"));
  assert.equal(progress.points[0].date, "0001-01-01");
  assert.equal(progress.points.at(-1)!.date, "9999-12-31");
  const planned = progress.points.flatMap((point) =>
    point.planned === null ? [] : [point.planned],
  );
  assert(planned.every((value, i) => i === 0 || value >= planned[i - 1]));
  assert.throws(() =>
    buildProjectProgress(projectProgressPopulation(state), "2026-02-30"),
  );
});
