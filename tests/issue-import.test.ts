import test from "node:test";
import assert from "node:assert/strict";
import { mapIssue } from "../src/lib/issue-import";
import { scopeData } from "../src/lib/permissions";
import { createDemoData } from "../src/lib/demo-data";
const row = {
  ID: "#3670",
  Title: "Issue",
  Status: "Ready to inspect",
  Type: "Commissioning Issue P1 (Functional Impact)",
  "Assigned to": "Company A",
  "Assignee type": "Company",
  "Company name": "",
};
test("Issue import retains review status and does not invent priority or accounts", () => {
  const result = mapIssue(row);
  assert.equal(result.status, "in-progress");
  assert.equal(result.externalId, "3670");
  assert.equal(result.priority, "P1");
  assert.equal(result.company, "Company A");
  assert.equal(mapIssue({ ...row, Type: "EHS Issue" }).priority, undefined);
  assert.equal(
    mapIssue({ ...row, Status: "Work completed" }).status,
    "completed",
  );
  assert.equal(mapIssue({ ...row, Status: "In dispute" }).status, "blocked");
  assert.equal(
    mapIssue({
      ...row,
      "Assignee type": "Role",
      "Assigned to": "TEAM-MER-Commissioning",
    }).company,
    "Company not mapped",
  );
  assert.throws(() => mapIssue({ ...row, Status: "Unknown status" }));
});
test("Imported companies are visible to managers without creating fake users", () => {
  const data = createDemoData();
  data.companies.push({ id: "external", name: "External company", logo: "" });
  data.tasks.push({
    ...data.tasks[0],
    id: "imported",
    companyId: "external",
    assignedTo: undefined,
    priority: undefined,
  });
  assert(
    scopeData(
      data.users.find((u) => u.role === "manager")!,
      data,
    ).companies.some((c) => c.id === "external"),
  );
  assert(
    !scopeData(
      data.users.find((u) => u.role === "worker")!,
      data,
    ).tasks.some((t) => t.id === "imported"),
  );
  assert(
    scopeData(
      data.users.find((u) => u.role === "supervisor")!,
      data,
    ).tasks.some((t) => t.id === "imported"),
  );
});

test("import recognizes configured P4 and P5 priorities", () => {
  for (const priority of ["P4", "P5"]) {
    const mapped = mapIssue({
      ID: "#99",
      Title: "Example issue",
      Status: "Open",
      Type: `Commissioning Issue ${priority}`,
      "Assigned to": "Team",
      "Assignee type": "Company",
    });
    assert.equal(mapped.priority, priority);
  }
});
