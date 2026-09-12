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
      (t: { companyId: string }) => t.companyId === "c1",
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
        projectId: "p1",
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
        version: 6,
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
