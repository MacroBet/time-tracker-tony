import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
async function session(userId: string) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  assert(response.headers.get("set-cookie")!.includes("HttpOnly"));
  return cookie;
}
async function request(
  path: string,
  cookie = "",
  method = "GET",
  body?: unknown,
  origin = base,
) {
  return fetch(base + path, {
    method,
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
test("API sessions, role boundaries, persistence, evidence and timesheet lifecycle", async () => {
  const info = await (await request("/api/auth/session")).json();
  assert.equal(
    info.mode,
    "demo",
    "Only run this integration test against the isolated local demo server.",
  );
  assert.equal((await request("/api/bootstrap")).status, 401);
  const worker = await session("u1");
  const supervisor = await session("u3");
  const manager = await session("u4");
  const workerData = await (await request("/api/bootstrap", worker)).json();
  assert(
    workerData.tasks.every(
      (t: { assignedTo: string }) => t.assignedTo === "u1",
    ),
  );
  const supervisorData = await (
    await request("/api/bootstrap", supervisor)
  ).json();
  assert(
    supervisorData.tasks.every(
      (t: { projectId: string }) => t.projectId === "p1",
    ),
  );
  assert.equal((await request("/api/tasks", worker, "POST", {})).status, 403);
  assert.equal(
    (
      await request(
        "/api/tasks",
        manager,
        "POST",
        {},
        "https://outside.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/tasks/t2", worker, "PATCH", {
        version: 1,
        notes: "Unauthorized change",
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request("/api/tasks", supervisor, "POST", {
        title: "Cross-company task",
        description: "Not allowed",
        projectId: "unassigned-project",
        assignedTo: "u2",
        discipline: "Safety",
      })
    ).status,
    403,
  );
  const created = await request("/api/tasks", manager, "POST", {
    title: "API commissioning check",
    description: "Check and record the verification outcome.",
    projectId: "p1",
    assignedTo: "u1",
    discipline: "Electrical",
    priority: "P1",
    location: "S201",
  });
  assert.equal(created.status, 201);
  const task = await created.json();
  assert.equal(
    (
      await request(`/api/tasks/${task.id}`, worker, "PATCH", {
        version: 1,
        status: "in-progress",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/tasks/${task.id}`, worker, "PATCH", {
        version: 1,
        notes: "Stale update",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/api/tasks/${task.id}`, worker, "PATCH", {
        version: 2,
        status: "completed",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/api/tasks/${task.id}`, worker, "PATCH", {
        version: 2,
        status: "blocked",
        notes: "Awaiting controls verification.",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/tasks/${task.id}`, worker, "PATCH", {
        version: 3,
        status: "in-progress",
      })
    ).status,
    200,
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1EAAAAASUVORK5CYII=",
    "base64",
  );
  const uploaded = await fetch(`${base}/api/tasks/${task.id}/attachments`, {
    method: "POST",
    headers: {
      Cookie: worker,
      Origin: base,
      "Content-Type": "image/png",
      "X-File-Name": "evidence.png",
    },
    body: png,
  });
  assert.equal(uploaded.status, 201);
  const file = await uploaded.json();
  assert.equal((await request(`/api/attachments/${file.id}`)).status, 401);
  const otherWorker = await session("u2");
  assert.equal(
    (await request(`/api/attachments/${file.id}`, otherWorker)).status,
    404,
  );
  assert.equal(
    (await request(`/api/attachments/${file.id}`, worker)).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/tasks/${task.id}`, worker, "PATCH", {
        version: 5,
        status: "review",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/tasks/${task.id}`, supervisor, "PATCH", {
        version: 6,
        status: "completed",
      })
    ).status,
    200,
  );
  const reloaded = await (
    await request("/api/bootstrap", await session("u1"))
  ).json();
  assert.equal(
    reloaded.tasks.find((t: { id: string }) => t.id === task.id).status,
    "completed",
  );
  assert.equal(
    (
      await request(`/api/tasks/${task.id}`, worker, "PATCH", {
        version: 7,
        status: "in-progress",
      })
    ).status,
    400,
  );
  const start = await request("/api/shifts", worker, "POST", {
    projectId: "p1",
  });
  assert.equal(start.status, 201);
  const shift = await start.json();
  assert.equal(
    (await request("/api/shifts", worker, "POST", { projectId: "p1" })).status,
    409,
  );
  assert.equal(
    (
      await request(`/api/shifts/${shift.id}`, worker, "PATCH", {
        version: 1,
        action: "approve",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/api/shifts/${shift.id}`, worker, "PATCH", {
        version: 1,
        action: "end",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/shifts/${shift.id}`, worker, "PATCH", {
        version: 2,
        action: "submit",
        manualHours: 1,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/api/shifts/${shift.id}`, worker, "PATCH", {
        version: 2,
        action: "submit",
        manualHours: 1,
        notes: "Extra hour for final verification.",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/shifts/${shift.id}`, supervisor, "PATCH", {
        version: 3,
        action: "reject",
        rejectionReason: "Please clarify the extra hours.",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/shifts/${shift.id}`, worker, "PATCH", {
        version: 4,
        action: "submit",
        manualHours: 0,
        notes: "Corrected timesheet.",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/shifts/${shift.id}`, supervisor, "PATCH", {
        version: 5,
        action: "approve",
      })
    ).status,
    200,
  );
  const feedback = await request("/api/feedback", worker, "POST", {
    projectId: "p1",
    description: "Test report with screenshot evidence.",
    page: `/tasks/${task.id}`,
    screenshot: `data:image/png;base64,${png.toString("base64")}`,
  });
  assert.equal(feedback.status, 201);
  const feedbackId = (await feedback.json()).id;
  assert.equal(
    (await request(`/api/feedback/${feedbackId}/screenshot`, otherWorker))
      .status,
    404,
  );
  assert.equal(
    (await request(`/api/feedback/${feedbackId}/screenshot`, manager)).status,
    200,
  );
  assert.equal((await request("/api/auth/logout", worker, "POST")).status, 200);
  assert.equal((await request("/api/bootstrap", worker)).status, 401);
});

test("assignment, handover, review, correction and plan lifecycle", async () => {
  const manager = await session("u4"),
    supervisor = await session("u3"),
    worker = await session("u1"),
    other = await session("u2");
  const create = async (title: string) =>
    await (
      await request("/api/tasks", manager, "POST", {
        title,
        description: "Verify the operational assignment and review flow.",
        projectId: "p1",
        assignedTo: "u1",
        discipline: "Electrical",
      })
    ).json();
  const a = await create("Assignment acceptance check"),
    b = await create("Second assignment acceptance check");
  const assignment = {
    tasks: [
      { id: a.id, version: 1 },
      { id: b.id, version: 1 },
    ],
    assignedTo: "u2",
    reason: "Handover to the second worker for the acceptance test.",
  };
  assert.equal(
    (await request("/api/tasks/assignments", worker, "POST", assignment))
      .status,
    403,
  );
  assert.equal(
    (await request("/api/tasks/assignments", supervisor, "POST", assignment))
      .status,
    200,
  );
  assert.equal(
    (await request("/api/tasks/assignments", manager, "POST", assignment))
      .status,
    409,
  );
  assert.equal(
    (
      await request(`/api/tasks/${a.id}`, worker, "PATCH", {
        version: 2,
        notes: "I must no longer be able to update this task.",
      })
    ).status,
    404,
  );
  const patch = async (
    cookie: string,
    version: number,
    status: string,
    notes?: string,
  ) =>
    request(`/api/tasks/${a.id}`, cookie, "PATCH", {
      version,
      status,
      ...(notes ? { notes } : {}),
    });
  assert.equal((await patch(other, 2, "in-progress")).status, 200);
  assert.equal((await patch(other, 3, "review")).status, 400);
  assert.equal(
    (
      await patch(
        other,
        3,
        "review",
        "All verification checks were completed on site.",
      )
    ).status,
    200,
  );
  assert.equal(
    (await patch(other, 4, "completed", "I cannot approve my own delivery."))
      .status,
    400,
  );
  assert.equal((await patch(supervisor, 4, "in-progress")).status, 400);
  assert.equal(
    (
      await patch(
        supervisor,
        4,
        "in-progress",
        "Please correct the labeling before completion.",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await patch(
        other,
        5,
        "review",
        "Labels corrected and the verification repeated.",
      )
    ).status,
    200,
  );
  assert.equal((await patch(supervisor, 6, "completed")).status, 200);
  const updated = (
    await (await request("/api/bootstrap", manager)).json()
  ).tasks.find((t: { id: string }) => t.id === a.id);
  assert.equal(updated.status, "completed");
  assert.equal(updated.assignedTo, "u2");
  const plan = {
    version: 7,
    title: updated.title,
    description: updated.description,
    discipline: "Mechanical",
    priority: "P1",
    location: "Room S201",
    dueDate: "2026-10-01",
    reason: "Update the plan following the completed verification.",
  };
  assert.equal(
    (await request(`/api/tasks/${a.id}/plan`, other, "PATCH", plan)).status,
    403,
  );
  assert.equal(
    (await request(`/api/tasks/${a.id}/plan`, manager, "PATCH", plan)).status,
    200,
  );
  assert.equal(
    (
      await request("/api/tasks/assignments", manager, "POST", {
        tasks: [{ id: b.id, version: 2 }],
        assignedTo: null,
        reason: "Return this activity to the planning queue.",
      })
    ).status,
    200,
  );
  const data = await (await request("/api/bootstrap", supervisor)).json();
  assert.equal(
    data.tasks.find((t: { id: string }) => t.id === b.id).assignedTo,
    undefined,
  );
  assert(
    data.activities.some(
      (t: { taskId: string; action: string }) =>
        t.taskId === a.id && t.action.startsWith("Assignment:"),
    ),
  );
});

test("commissioning register, P6 revisions, tag generation, failed tests and feature access", async () => {
  assert.equal(
    (await (await request("/api/auth/session")).json()).mode,
    "demo",
  );
  const admin = await session("u-admin"),
    manager = await session("u4"),
    worker = await session("u6");
  const load = async (cookie: string) =>
    (await request("/api/bootstrap", cookie)).json();
  let data = await load(admin),
    project = data.projects.find((p: { id: string }) => p.id === "p1");
  const endpoint = "/api/projects/p1/commissioning";
  const runId = Date.now();
  const assetId = `TEST-ASSET-${runId}`,
    activityId = `P6-INTEGRATION-${runId}`;
  const config = {
    action: "configure",
    version: project.commissioning.version,
    reason: "Enable project levels for integration test",
    config: {
      levels: ["L2A", "L2B", "L3", "L4", "L5", "L6"],
      priorities: ["P1", "P2", "P3", "P4", "P5"],
    },
  };
  assert.equal((await request(endpoint, manager, "PATCH", config)).status, 403);
  assert.equal((await request(endpoint, worker, "PATCH", config)).status, 403);
  assert.equal((await request(endpoint, admin, "PATCH", config)).status, 200);
  assert.equal((await request(endpoint, admin, "PATCH", config)).status, 409);
  data = await load(admin);
  project = data.projects[0];
  const register = {
    assets: [
      {
        id: assetId,
        name: "Integration pump",
        equipmentType: "Pump",
        location: "Test room",
        levels: ["L3"],
        levelActivities: { L3: activityId },
      },
    ],
    schedule: [
      { activityId: activityId, name: "Pump test", finish: "2020-01-01" },
    ],
  };
  let input = {
    action: "import",
    version: project.commissioning.version,
    reason: "Add integration asset and its programme",
    data: register,
  };
  const preview = await (
    await request(endpoint, manager, "PATCH", { ...input, preview: true })
  ).json();
  assert.equal(preview.errors.length, 0);
  assert.equal(
    (await load(admin)).projects[0].commissioning.version,
    project.commissioning.version,
  );
  assert.equal((await request(endpoint, manager, "PATCH", input)).status, 200);
  data = await load(admin);
  project = data.projects[0];
  const generated = await (
    await request(endpoint, manager, "PATCH", {
      action: "generate-tags",
      version: project.commissioning.version,
      reason: "Generate missing commissioning checks",
    })
  ).json();
  assert(generated.created > 0);
  assert.equal(
    (
      await (
        await request(endpoint, manager, "PATCH", {
          action: "generate-tags",
          version: project.commissioning.version,
          reason: "Repeat generation is idempotent",
        })
      ).json()
    ).created,
    0,
  );
  data = await load(manager);
  let task = data.tasks.find(
    (t: { cx?: { assetId: string } }) => t.cx?.assetId === assetId,
  );
  assert.equal(task.cx.activityId, activityId);
  assert.equal(task.scheduleDueDate, "2020-01-01");
  assert.equal(
    (
      await request("/api/tasks/assignments", manager, "POST", {
        tasks: [{ id: task.id, version: task.version }],
        assignedTo: "u6",
        reason: "Assign commissioning test to engineer",
      })
    ).status,
    200,
  );
  task = (await load(manager)).tasks.find(
    (t: { id: string }) => t.id === task.id,
  );
  assert.equal(
    (
      await request(`/api/tasks/${task.id}`, worker, "PATCH", {
        version: task.version,
        status: "in-progress",
        result: "failed",
        notes: "Pump failed functional inspection",
      })
    ).status,
    200,
  );
  task = (await load(manager)).tasks.find(
    (t: { id: string }) => t.id === task.id,
  );
  assert.equal(
    (
      await request(`/api/tasks/${task.id}`, manager, "PATCH", {
        version: task.version,
        status: "completed",
        notes: "Attempting closure with failed test",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/api/tasks/${task.id}`, worker, "PATCH", {
        version: task.version,
        result: "passed",
        notes: "Retested pump successfully after repair",
      })
    ).status,
    200,
  );
  task = (await load(manager)).tasks.find(
    (t: { id: string }) => t.id === task.id,
  );
  assert.equal(task.status, "in-progress");
  project = (await load(admin)).projects[0];
  input = {
    ...input,
    version: project.commissioning.version,
    data: {
      assets: [],
      schedule: [
        {
          activityId: activityId,
          name: "Pump test",
          finish: "2099-01-01",
        },
      ],
    },
  };
  assert.equal((await request(endpoint, manager, "PATCH", input)).status, 200);
  data = await load(manager);
  task = data.tasks.find((t: { id: string }) => t.id === task.id);
  assert.equal(task.scheduleDueDate, "2099-01-01");
  assert.equal(
    data.projects[0].commissioning.schedule.find(
      (s: { activityId: string }) => s.activityId === activityId,
    ).baselineFinish,
    "2020-01-01",
  );
  assert.equal(
    (
      await request("/api/team/u6/modules", manager, "PATCH", {
        modules: ["tasks"],
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/team/u6/modules", admin, "PATCH", {
        modules: ["tasks"],
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/shifts", worker, "POST", { projectId: "p1" })).status,
    403,
  );
  assert.equal((await request(endpoint, worker, "PATCH", input)).status, 403);
  assert.equal((await load(worker)).shifts.length, 0);
  assert.equal(
    (
      await request("/api/team/u6/modules", admin, "PATCH", {
        modules: ["tasks", "time", "commissioning", "feedback"],
      })
    ).status,
    200,
  );
});
