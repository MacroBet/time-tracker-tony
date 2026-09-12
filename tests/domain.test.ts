import test from "node:test";
import assert from "node:assert/strict";
import { createDemoData } from "../src/lib/demo-data";
import { scopeData, canReadTask } from "../src/lib/permissions";
import { isOverdue, isStale } from "../src/lib/domain";
import { taskUpdateError } from "../src/lib/workflow";
import {
  createTaskSchema,
  updateTaskSchema,
  updateShiftSchema,
} from "../src/lib/validation";
import { csvCell } from "../src/lib/csv";
import { hashPassword, verifyPassword } from "../src/lib/password";
const now = new Date("2026-09-12T12:00:00Z");
const data = createDemoData(now);
const worker = data.users.find((u) => u.id === "u1")!;
const supervisor = data.users.find((u) => u.id === "u3")!;
const manager = data.users.find((u) => u.id === "u4")!;
test("employee can only see assigned tasks, own shifts and own directory entry", () => {
  const scoped = scopeData(worker, data);
  assert(scoped.tasks.every((t) => t.assignedTo === worker.id));
  assert(scoped.shifts.every((s) => s.userId === worker.id));
  assert.deepEqual(
    scoped.users.map((u) => u.id),
    [worker.id],
  );
  assert.equal(
    canReadTask(
      worker,
      data.tasks.find((t) => t.assignedTo === "u2")!,
      data,
    ),
    false,
  );
});
test("supervisor access is company-scoped; managers are project-scoped", () => {
  assert(
    scopeData(supervisor, data).tasks.every(
      (t) => t.companyId === supervisor.companyId,
    ),
  );
  assert.equal(scopeData(manager, data).tasks.length, data.tasks.length);
  assert.equal(
    scopeData(manager, {
      ...data,
      memberships: data.memberships.filter((m) => m.userId !== manager.id),
    }).tasks.length,
    0,
  );
  assert.equal(
    scopeData({ ...manager, role: "admin" }, { ...data, memberships: [] }).tasks
      .length,
    0,
  );
});
test("activities, evidence and feedback inherit task/project visibility", () => {
  const scoped = scopeData(worker, {
    ...data,
    attachments: [
      {
        id: "hidden",
        taskId: "t2",
        uploadedBy: "u6",
        name: "evidence.png",
        contentType: "image/png",
        size: 10,
        createdAt: now.toISOString(),
      },
    ],
    feedback: [
      {
        id: "f",
        userId: "u2",
        projectId: "p1",
        description: "Private report",
        page: "/",
        createdAt: now.toISOString(),
        hasScreenshot: false,
      },
    ],
  });
  assert.equal(scoped.attachments.length, 0);
  assert.equal(scoped.feedback.length, 0);
  assert(
    scoped.activities.every((a) => scoped.tasks.some((t) => t.id === a.taskId)),
  );
});
test("red flags ignore closed work and use calendar-day deadlines", () => {
  const task = data.tasks[0];
  assert(isOverdue(task, now));
  assert.equal(isOverdue({ ...task, status: "completed" }, now), false);
  assert.equal(isOverdue({ ...task, status: "not-applicable" }, now), false);
  assert.equal(isOverdue({ ...task, dueDate: "2026-09-12" }, now), false);
  assert(isStale({ ...task, updatedAt: "2026-09-01T00:00:00Z" }, now));
});
test("workflow prevents unsupported transitions and unexplained closure", () => {
  const task = data.tasks[0];
  assert(taskUpdateError(worker, task, "completed", "", 0));
  assert.equal(
    taskUpdateError(
      worker,
      task,
      "completed",
      "Tested and verified on site.",
      0,
    ),
    null,
  );
  assert.equal(taskUpdateError(worker, task, "completed", "", 1), null);
  assert(taskUpdateError(worker, task, "blocked", "no", 0));
  assert(
    taskUpdateError(
      worker,
      { ...task, status: "pending" },
      "completed",
      "Tested and verified.",
      1,
    ),
  );
  assert(
    taskUpdateError(
      worker,
      { ...task, status: "completed" },
      "in-progress",
      "",
      1,
    ),
  );
  assert.equal(
    taskUpdateError(
      manager,
      { ...task, status: "completed" },
      "in-progress",
      "",
      1,
    ),
    null,
  );
});
test("API schemas reject mass assignment, invalid calendar dates and negative hours", () => {
  assert.equal(
    updateTaskSchema.safeParse({
      version: 1,
      status: "completed",
      assignedTo: "u2",
    }).success,
    false,
  );
  assert.equal(
    updateShiftSchema.safeParse({
      version: 1,
      action: "submit",
      manualHours: -1,
    }).success,
    false,
  );
  assert.equal(
    createTaskSchema.safeParse({
      title: "Task",
      description: "Description",
      projectId: "p1",
      assignedTo: "u1",
      discipline: "Electrical",
      dueDate: "2026-02-30",
    }).success,
    false,
  );
});
test("CSV quotes fields and neutralizes formula injection", () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell('=HYPERLINK("bad")').startsWith("\"'="), true);
  assert.equal(csvCell("\t  +2").startsWith("\"'"), true);
});
test("password hashes are salted and verification fails for wrong or absent credentials", async () => {
  const a = await hashPassword("a-valid-long-password");
  const b = await hashPassword("a-valid-long-password");
  assert.notEqual(a, b);
  assert(await verifyPassword("a-valid-long-password", a));
  assert.equal(await verifyPassword("incorrect", a), false);
  assert.equal(await verifyPassword("incorrect", null), false);
});

test("CSRF accepts the public host behind a proxy but rejects missing and foreign origins", async () => {
  const { sameOrigin } = await import("../src/lib/origin");
  assert(sameOrigin("http://127.0.0.1:3000", "127.0.0.1:3000"));
  assert(sameOrigin("https://example.vercel.app", "example.vercel.app", true));
  assert.equal(
    sameOrigin("http://example.vercel.app", "example.vercel.app", true),
    false,
  );
  assert.equal(
    sameOrigin("https://evil.example", "example.vercel.app", true),
    false,
  );
  assert.equal(sameOrigin(null, "example.vercel.app"), false);
});
