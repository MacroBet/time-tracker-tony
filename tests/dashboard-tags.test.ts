import test from "node:test";
import assert from "node:assert/strict";
import { commissioning, tagRows } from "../src/lib/commissioning";
import type { Project, Task } from "../src/lib/domain";
import { dashboardTags } from "../src/lib/dashboard-tags";
import { filterTagProgress } from "../src/lib/tag-progress";

const project: Project = {
  id: "p",
  companyId: "c",
  name: "Project",
  location: "Site",
  commissioning: {
    ...commissioning(),
    config: {
      levels: ["L2", "L3"],
      priorities: ["P1"],
      phasePresentation: { L3: { label: "Witness", color: "#317133" } },
    },
    assets: [
      {
        id: "a",
        name: "A",
        equipmentType: "Pump",
        location: "",
        levels: ["L2", "L3"],
        vendor: "Supplier A",
        discipline: "Mechanical",
      },
      {
        id: "b",
        name: "B",
        equipmentType: "Panel",
        location: "",
        levels: ["L2", "L3"],
        vendor: "Supplier B",
        discipline: "Electrical",
      },
      {
        id: "missing",
        name: "Missing supplier",
        equipmentType: "Pump",
        location: "",
        levels: ["L2"],
      },
    ],
    checksheets: {
      templates: [],
      sheets: [],
      signatorySlots: [],
      worksToGo: [
        {
          id: "wa",
          title: "A work",
          notes: "",
          assetId: "a",
          status: "open",
          createdBy: "u",
          updatedBy: "u",
          createdAt: "2026-11-17T00:00:00Z",
          updatedAt: "2026-11-17T00:00:00Z",
        },
        {
          id: "wb",
          title: "B work",
          notes: "",
          taskId: "issue-b",
          status: "open",
          createdBy: "u",
          updatedBy: "u",
          createdAt: "2026-11-17T00:00:00Z",
          updatedAt: "2026-11-17T00:00:00Z",
        },
      ],
    },
  },
};
const task = (id: string, fields: Partial<Task>): Task => ({
  id,
  title: id,
  description: "",
  projectId: "p",
  companyId: "c",
  createdBy: "u",
  status: "pending",
  discipline: "",
  location: "",
  source: "manual",
  createdAt: "2026-11-17T00:00:00Z",
  updatedAt: "2026-11-17T00:00:00Z",
  version: 1,
  ...fields,
});
const tasks = [
  task("a-l3", {
    cx: {
      kind: "tag",
      assetId: "a",
      level: "L3",
      tagReview: "approved",
      result: "untested",
    },
    status: "completed",
  }),
  task("b-l2", {
    cx: { kind: "tag", assetId: "b", level: "L2", result: "untested" },
    status: "not-applicable",
  }),
  task("issue-a", {
    cx: { kind: "issue", assetId: "a", result: "untested" },
    status: "blocked",
  }),
  task("issue-b", { cx: { kind: "issue", assetId: "b", result: "untested" } }),
  task("other-project", {
    projectId: "other",
    cx: { kind: "issue", assetId: "a", result: "untested" },
    status: "blocked",
  }),
];

test("dashboard tag levels include missing workflows, exclude N/A and allow L3 independently of L2", () => {
  const result = dashboardTags(project, tasks, { vendor: "supplier a" });
  assert.equal(result.summary.total, 2);
  assert.equal(result.summary.approved, 1);
  assert.deepEqual(
    result.groups[0].levels.map(({ level, percent }) => ({ level, percent })),
    [
      { level: "L2", percent: 0 },
      { level: "L3", percent: 100 },
    ],
  );
  const all = dashboardTags(project, tasks);
  assert.equal(all.summary.total, 4);
  assert.equal(all.summary.approved, 1);
});

test("combined recorded-asset filters and drilldown keep exactly the same denominator", () => {
  const filters = { vendor: "Supplier A", discipline: "Mechanical" };
  const result = dashboardTags(project, tasks, filters, "discipline");
  const dialogRows = filterTagProgress(tagRows(project, tasks), {
    ...filters,
    applicableOnly: true,
  });
  assert.equal(result.rows.length, dialogRows.length);
  assert.deepEqual(
    result.rows.map((row) => row.asset.id + row.level),
    dialogRows.map((row) => row.asset.id + row.level),
  );
  assert.equal(
    dashboardTags(project, tasks, {
      vendor: "Supplier A",
      discipline: "Electrical",
    }).summary.percent,
    null,
  );
  assert.equal(
    dashboardTags(project, tasks, { vendor: "__missing__" }).summary.total,
    1,
  );
  assert.equal(result.groups[0].label, "Mechanical");
});

test("blockers stay scoped to matching assets and separate overlapping categories", () => {
  const result = dashboardTags(project, tasks, { vendor: "Supplier A" });
  assert.deepEqual(
    result.blockedTasks.map((row) => row.id),
    ["issue-a"],
  );
  assert.deepEqual(
    result.openIssues.map((row) => row.id),
    ["issue-a"],
  );
  assert.deepEqual(
    result.openWorks.map((row) => row.id),
    ["wa"],
  );
  const other = dashboardTags(project, tasks, { vendor: "Supplier B" });
  assert.deepEqual(
    other.openWorks.map((row) => row.id),
    ["wb"],
  );
  assert.equal(other.summary.total, 1);
});
