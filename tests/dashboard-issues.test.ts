import assert from "node:assert/strict";
import test from "node:test";
import {
  filterIssues,
  groupIssues,
  projectIssues,
  summarizeIssues,
} from "../src/lib/dashboard-issues";
import { canRequestDashboardView } from "../src/lib/dashboard-view-context";
import type { Task, User } from "../src/lib/domain";

const task: Task = {
  id: "issue",
  title: "Issue",
  description: "",
  projectId: "selected",
  companyId: "unmapped",
  createdBy: "manager",
  status: "pending",
  discipline: "Electrical",
  location: "",
  source: "excel",
  createdAt: "2026-11-01T23:30:00.000Z",
  updatedAt: "2026-11-03T09:00:00.000Z",
  version: 1,
};

test("issue metrics use scoped records, project dates and recorded import dimensions", () => {
  const rows = projectIssues(
    [
      {
        ...task,
        importData: {
          file: "synthetic.xlsx",
          row: 2,
          status: "Open",
          assignee: "Recorded installer",
          assigneeType: "Company",
          importedAt: task.updatedAt,
          fields: { Type: "Functional", " Root Cause ": "Configuration" },
        },
      },
      { ...task, id: "closed", status: "completed" },
      {
        ...task,
        id: "excluded",
        status: "not-applicable",
        createdAt: "invalid",
      },
      { ...task, id: "undated", createdAt: "invalid" },
      { ...task, id: "another", projectId: "another" },
      { ...task, id: "manual-task", source: "manual" },
    ],
    [{ id: "unmapped", name: "Company not mapped", logo: "" }],
    "selected",
    "2026-11-23",
  );
  assert.deepEqual(summarizeIssues(rows), {
    counts: { open: 2, closed: 1, notApplicable: 1 },
    datedOpen: 1,
    average: 21,
  });
  assert.deepEqual(
    groupIssues(rows, "month").map(({ value, total }) => [value, total]),
    [
      ["2026-11", 2],
      ["", 2],
    ],
  );
  assert.deepEqual(
    filterIssues(rows, {
      company: "Recorded installer",
      type: "Functional",
      cause: "Configuration",
    }).map(({ task }) => task.id),
    ["issue"],
  );
  assert.equal(filterIssues(rows, { company: "", type: "" }).length, 3);
});

test("the Issues view requires permission to read the underlying task records", () => {
  const manager: User = {
    id: "manager",
    companyId: "company",
    name: "Manager",
    email: "demo@example.invalid",
    role: "manager",
    modules: ["dashboard"],
  };
  const view = { kind: "issues" } as const;
  assert.equal(canRequestDashboardView(manager, view), false);
  assert.equal(
    canRequestDashboardView(
      { ...manager, modules: ["reports", "tasks"] },
      view,
    ),
    true,
  );
  assert.equal(
    canRequestDashboardView(
      { ...manager, role: "worker", modules: ["dashboard", "tasks"] },
      view,
    ),
    false,
  );
});
