import test from "node:test";
import assert from "node:assert/strict";
import type { Project, Task } from "../src/lib/domain";
import {
  commissioning,
  tagRows,
  tagSummary,
  tagTimeline,
  cxSchema,
  isTagApproved,
} from "../src/lib/commissioning";
import {
  filterTagProgress,
  summarizeTagProgress,
  tagProgressGroups,
} from "../src/lib/tag-progress";
import { filterTeamWork, teamWorkload } from "../src/lib/team-workload";
import { taskProgress } from "../src/lib/dashboard-progress";
import { filterTasks } from "../src/lib/commissioning";

const now = new Date("2026-10-15T12:00:00Z");
const task = (id: string, fields: Partial<Task> = {}): Task => ({
  id,
  title: id,
  description: "",
  projectId: "project",
  companyId: "company",
  createdBy: "author",
  discipline: "Electrical",
  location: "",
  source: "manual",
  status: "pending",
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  version: 1,
  ...fields,
});
const tag = (assetId: string, fields: Partial<Task> = {}) =>
  task(`tag-${assetId}`, {
    cx: { kind: "tag", assetId, level: "L1", result: "passed" },
    ...fields,
  });
function project(): Project {
  return {
    id: "project",
    name: "Project",
    location: "Site",
    companyId: "company",
    commissioning: {
      ...commissioning(),
      config: { levels: ["L1", "L2"], priorities: ["P1"] },
      assets: [
        {
          id: "client",
          name: "Client pump",
          equipmentType: "Pump",
          location: "B1",
          levels: ["L1", "L2"],
          clientSupplied: true,
        },
        {
          id: "other",
          name: "Other pump",
          equipmentType: "Pump",
          location: "B2",
          levels: ["L1"],
        },
        {
          id: "contractor",
          name: "Panel",
          equipmentType: "Panel",
          location: "",
          levels: ["L1"],
          clientSupplied: false,
        },
      ],
    },
  };
}

test("matrix totals count missing tag obligations, exclude N/A and do not treat passed tests as approval", () => {
  const rows = tagRows(project(), [
    tag("client", { status: "completed" }),
    tag("other", { status: "not-applicable" }),
    tag("contractor", { status: "review" }),
  ]);
  assert.deepEqual(summarizeTagProgress(rows), {
    total: 3,
    approved: 1,
    legacyApproved: 1,
    reviews: { issued: 0, rejected: 0, "approved-comments": 0, approved: 0 },
    percent: 33,
    complete: false,
  });
  assert.deepEqual(summarizeTagProgress(rows, "L2"), {
    total: 1,
    approved: 0,
    legacyApproved: 0,
    reviews: { issued: 0, rejected: 0, "approved-comments": 0, approved: 0 },
    percent: 0,
    complete: false,
  });
  assert.deepEqual(summarizeTagProgress([], "L1"), {
    total: 0,
    approved: 0,
    legacyApproved: 0,
    reviews: { issued: 0, rejected: 0, "approved-comments": 0, approved: 0 },
    percent: null,
    complete: false,
  });
});

test("client supplied is an explicit subset and location drilldowns select exact recorded locations", () => {
  const p = project();
  const rows = tagRows(p, [tag("client", { status: "completed" })]);
  assert.equal(filterTagProgress(rows, { supply: "client" }).length, 2);
  assert.equal(
    filterTagProgress(rows, { assetLocation: "" })[0].asset.id,
    "contractor",
  );
  assert.equal(
    filterTagProgress(rows, { assetLocation: "B1", supply: "client" }).length,
    2,
  );
  assert.equal(
    tagProgressGroups(p, [], "equipmentType").groups.find(
      (group) => group.key === "Pump",
    )?.rows.length,
    3,
  );
  assert.equal(tagProgressGroups(p, [], "location").groups.length, 3);
});

test("only exactly complete levels shrink; a rounded 100 percent is still incomplete", () => {
  const row = tagRows(project(), [tag("client", { status: "completed" })])[0];
  const rows = Array.from({ length: 201 }, (_, index) => ({
    ...row,
    status: index === 200 ? ("pending" as const) : ("completed" as const),
    task: {
      ...row.task!,
      status: index === 200 ? ("pending" as const) : ("completed" as const),
    },
  }));
  assert.equal(summarizeTagProgress(rows).percent, 100);
  assert.equal(summarizeTagProgress(rows).complete, false);
  assert.equal(summarizeTagProgress([row]).complete, true);
});

test("workload splits overdue not-started and active work and excludes N/A from progress", () => {
  const summary = teamWorkload(
    [
      task("done", { status: "completed", dueDate: "2026-10-01" }),
      task("na", { status: "not-applicable" }),
      task("pending"),
      task("late-pending", { dueDate: "2026-10-14" }),
      task("review", { status: "review" }),
      task("blocked-late", {
        status: "blocked",
        scheduleDueDate: "2026-10-14",
        dueDate: "2026-12-01",
      }),
    ],
    now,
  );
  assert.deepEqual(summary.counts, {
    completed: 1,
    notStarted: 1,
    notStartedLate: 1,
    inProgress: 1,
    startedLate: 1,
  });
  assert.equal(summary.total, 5);
  assert.equal(summary.percent, 20);
  assert.equal(summary.review, 1);
  assert.equal(summary.open, 4);
  assert.equal(summary.notApplicable, 1);
});

test("explicit I/R/AC/A review is independent of passed results and takes precedence over legacy workflow completion", () => {
  const p = project();
  const rejected = tag("client", {
    status: "completed",
    completedAt: "2026-10-14T12:00:00Z",
    cx: {
      kind: "tag",
      assetId: "client",
      level: "L1",
      result: "passed",
      tagReview: "rejected",
    },
  });
  const approved = tag("other", {
    status: "review",
    cx: {
      kind: "tag",
      assetId: "other",
      level: "L1",
      result: "untested",
      tagReview: "approved",
    },
  });
  const ac = tag("contractor", {
    status: "completed",
    cx: {
      kind: "tag",
      assetId: "contractor",
      level: "L1",
      result: "passed",
      tagReview: "approved-comments",
    },
  });
  const tasks = [rejected, approved, ac];
  assert.equal(isTagApproved(rejected), false);
  assert.equal(isTagApproved(approved), true);
  assert.equal(isTagApproved(ac), false);
  const rows = tagRows(p, tasks);
  assert.equal(summarizeTagProgress(rows).approved, 1);
  assert.equal(summarizeTagProgress(rows).legacyApproved, 0);
  assert.deepEqual(summarizeTagProgress(rows).reviews, {
    issued: 0,
    rejected: 1,
    "approved-comments": 1,
    approved: 1,
  });
  assert.equal(tagSummary(p, tasks).completed, 1);
  assert.equal(tagSummary(p, tasks).total, 4);
  assert.equal(
    tagTimeline(p, tasks).points.some((point) => point.achieved > 0),
    false,
  );
  assert.deepEqual(
    filterTagProgress(rows, { approval: "approved" }).map(
      (row) => row.asset.id,
    ),
    ["other"],
  );
  assert.deepEqual(
    filterTagProgress(rows, { tagReview: "rejected" }).map(
      (row) => row.asset.id,
    ),
    ["client"],
  );
});

test("review enum rejects unknown codes, non-tag review metadata and preserves legacy approval without inventing review", () => {
  const legacy = tag("client", { status: "completed" });
  assert.equal(isTagApproved(legacy), true);
  assert.equal(legacy.cx?.tagReview, undefined);
  assert.equal(isTagApproved(tag("client", { status: "in-progress" })), false);
  assert.equal(
    cxSchema.safeParse({ ...legacy.cx, tagReview: "approved-comments" })
      .success,
    true,
  );
  assert.equal(
    cxSchema.safeParse({ ...legacy.cx, tagReview: "C" }).success,
    false,
  );
  assert.equal(
    cxSchema.safeParse({ kind: "task", tagReview: "approved" }).success,
    false,
  );
  assert.equal(
    isTagApproved(
      tag("client", {
        status: "not-applicable",
        cx: { ...legacy.cx!, tagReview: "approved" },
      }),
    ),
    false,
  );
});

test("team open and closed issue filters use workflow closure and preserve imported issue classification", () => {
  const tasks = [
    task("import", { source: "excel" }),
    task("issue", {
      status: "completed",
      cx: { kind: "issue", result: "untested" },
    }),
    task("general"),
    task("na", { status: "not-applicable" }),
  ];
  assert.deepEqual(
    filterTeamWork(tasks, "issues", "open").map((item) => item.id),
    ["import"],
  );
  assert.deepEqual(
    filterTeamWork(tasks, "issues", "closed").map((item) => item.id),
    ["issue"],
  );
  assert.deepEqual(
    filterTeamWork(tasks, "tasks", "closed").map((item) => item.id),
    ["na"],
  );
  assert.equal(teamWorkload([], now).percent, null);
});

test("task progress excludes N/A from completion percentage and uses the governing deadline for open work", () => {
  const tasks = [
    task("completed", { status: "completed", scheduleDueDate: "2026-10-01" }),
    task("not-applicable", { status: "not-applicable", dueDate: "2026-10-01" }),
    task("due-today", { dueDate: "2026-10-15" }),
    task("blocked-late", { status: "blocked", dueDate: "2026-10-14" }),
    task("review-undated", { status: "review" }),
    task("schedule-late", {
      dueDate: "2026-12-01",
      scheduleDueDate: "2026-10-14",
    }),
    task("schedule-future", {
      dueDate: "2026-10-01",
      scheduleDueDate: "2026-10-20",
    }),
  ];
  const snapshot = structuredClone(tasks);
  assert.deepEqual(taskProgress(tasks, now), {
    total: 7,
    applicable: 6,
    completed: 1,
    notApplicable: 1,
    percent: 17,
    late: 2,
    undated: 1,
    scheduled: 3,
  });
  assert.deepEqual(
    tasks,
    snapshot,
    "Summarizing a subset does not modify its records or dates.",
  );
});
test("workflow completion and tag approval remain independent in task progress", () => {
  const completedButRejected = tag("client", {
    status: "completed",
    cx: {
      kind: "tag",
      assetId: "client",
      level: "L1",
      result: "passed",
      tagReview: "rejected",
    },
  });
  const approvedButInReview = tag("other", {
    status: "review",
    cx: {
      kind: "tag",
      assetId: "other",
      level: "L1",
      result: "passed",
      tagReview: "approved",
    },
  });
  assert(!isTagApproved(completedButRejected));
  assert(isTagApproved(approvedButInReview));
  assert.equal(taskProgress([completedButRejected], now).completed, 1);
  assert.equal(taskProgress([approvedButInReview], now).completed, 0);
  assert.equal(
    taskProgress([completedButRejected, approvedButInReview], now).percent,
    50,
  );
});
test("task progress matches project, level, issue and priority drilldowns without including foreign work", () => {
  const p = project();
  const tasks = [
    task("construction-done", {
      status: "completed",
      dueDate: "2026-10-14",
      cx: { kind: "task", level: "L1", result: "untested" },
    }),
    task("construction-late", {
      dueDate: "2026-10-14",
      cx: { kind: "task", level: "L1", result: "untested" },
    }),
    task("construction-other-level", {
      cx: { kind: "task", level: "L2", result: "untested" },
    }),
    task("issue-today", {
      priority: "P1",
      status: "blocked",
      dueDate: "2026-10-14",
      scheduleDueDate: "2026-10-15",
      cx: { kind: "issue", level: "L1", result: "failed" },
    }),
    task("issue-undated", {
      priority: "P1",
      status: "review",
      cx: { kind: "issue", level: "L1", result: "retest" },
    }),
    task("issue-done", {
      priority: "P1",
      status: "completed",
      dueDate: "2026-10-01",
      cx: { kind: "issue", level: "L1", result: "passed" },
    }),
    task("issue-na", {
      priority: "P1",
      status: "not-applicable",
      dueDate: "2026-10-01",
      cx: { kind: "issue", level: "L1", result: "untested" },
    }),
    task("issue-other-priority", {
      priority: "P2",
      dueDate: "2026-10-01",
      cx: { kind: "issue", level: "L1", result: "failed" },
    }),
    task("foreign-done", {
      projectId: "foreign",
      priority: "P1",
      status: "completed",
      cx: { kind: "issue", level: "L1", result: "passed" },
    }),
    task("foreign-late", {
      projectId: "foreign",
      dueDate: "2026-10-01",
      cx: { kind: "task", level: "L1", result: "untested" },
    }),
  ];
  const constructionFilter = { level: "L1", kind: "task" };
  const construction = taskProgress(
    filterTasks(tasks, p, constructionFilter, now),
    now,
  );
  assert.deepEqual(construction, {
    total: 2,
    applicable: 2,
    completed: 1,
    notApplicable: 0,
    percent: 50,
    late: 1,
    undated: 0,
    scheduled: 0,
  });
  assert.equal(
    construction.completed,
    filterTasks(tasks, p, { ...constructionFilter, status: "completed" }, now)
      .length,
  );
  assert.equal(
    construction.late,
    filterTasks(tasks, p, { ...constructionFilter, attention: "overdue" }, now)
      .length,
  );
  const issueFilter = { level: "L1", kind: "issue", priority: "P1" };
  const issues = taskProgress(filterTasks(tasks, p, issueFilter, now), now);
  assert.deepEqual(issues, {
    total: 4,
    applicable: 3,
    completed: 1,
    notApplicable: 1,
    percent: 33,
    late: 0,
    undated: 1,
    scheduled: 1,
  });
  assert.equal(
    issues.completed,
    filterTasks(tasks, p, { ...issueFilter, status: "completed" }, now).length,
  );
  assert.equal(
    issues.notApplicable,
    filterTasks(tasks, p, { ...issueFilter, status: "not-applicable" }, now)
      .length,
  );
  assert.equal(
    issues.late,
    filterTasks(tasks, p, { ...issueFilter, attention: "overdue" }, now).length,
  );
  assert(
    !filterTasks(tasks, p, issueFilter, now).some(
      (item) => item.projectId === "foreign",
    ),
  );
});
test("empty and wholly N/A subsets retain an unknown percentage rather than a fabricated zero", () => {
  assert.deepEqual(taskProgress([], now), {
    total: 0,
    applicable: 0,
    completed: 0,
    notApplicable: 0,
    percent: null,
    late: 0,
    undated: 0,
    scheduled: 0,
  });
  assert.deepEqual(
    taskProgress(
      [
        task("na-undated", { status: "not-applicable" }),
        task("na-scheduled", {
          status: "not-applicable",
          scheduleDueDate: "2026-10-01",
        }),
      ],
      now,
    ),
    {
      total: 2,
      applicable: 0,
      completed: 0,
      notApplicable: 2,
      percent: null,
      late: 0,
      undated: 0,
      scheduled: 1,
    },
  );
});
test("late work uses the existing project calendar date, including around UTC midnight", () => {
  const localToday = new Date("2026-10-14T23:30:00Z");
  const tasks = [
    task("yesterday", { dueDate: "2026-10-14" }),
    task("today", { dueDate: "2026-10-15" }),
    task("missing"),
  ];
  const result = taskProgress(tasks, localToday);
  assert.equal(result.late, 1);
  assert.equal(result.undated, 1);
  assert.equal(
    result.late,
    filterTasks(tasks, project(), { attention: "overdue" }, localToday).length,
  );
});
