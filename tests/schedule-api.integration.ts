import test from "node:test";
import assert from "node:assert/strict";
import { MODULES } from "../src/lib/commissioning";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3107";
async function request(
  path: string,
  cookie = "",
  method = "GET",
  body?: unknown,
) {
  return fetch(base + path, {
    method,
    headers: {
      Cookie: cookie,
      Origin: base,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
test("programme API previews, recalculates and atomically rejects invalid or stale revisions", async () => {
  assert.equal(
    (await (await request("/api/auth/session")).json()).mode,
    "demo",
    "Only use an isolated local demo server.",
  );
  const login = await request("/api/auth/login", "", "POST", { userId: "u4" });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const workerLogin = await request("/api/auth/login", "", "POST", {
    userId: "u1",
  });
  const worker = workerLogin.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (
      await request("/api/projects/p1/commissioning", worker, "PATCH", {
        action: "schedule",
        version: 1,
        reason: "Worker forbidden programme edit",
        activity: {
          activityId: "forbidden",
          name: "Forbidden",
          notBefore: "2026-10-19",
          durationDays: 1,
        },
      })
    ).status,
    403,
  );
  const supervisorLogin = await request("/api/auth/login", "", "POST", {
    userId: "u3",
  });
  const supervisor = supervisorLogin.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (
      await request("/api/projects/p2/commissioning", supervisor, "PATCH", {
        action: "schedule",
        version: 1,
        reason: "Cross project forbidden edit",
        activity: {
          activityId: "forbidden",
          name: "Forbidden",
          notBefore: "2026-10-19",
          durationDays: 1,
        },
      })
    ).status,
    404,
  );

  const read = async () =>
    (await (await request("/api/bootstrap", cookie)).json()).projects.find(
      (p: { id: string }) => p.id === "p1",
    ).commissioning;
  let state = await read();
  const id = `schedule-api-${Date.now()}`;
  const endpoint = "/api/projects/p1/commissioning";
  const send = (activity: unknown, version: number, preview = false) =>
    request(endpoint, cookie, "PATCH", {
      action: "schedule",
      activity,
      version,
      preview,
      reason: "Verified programme dependency integration test",
    });
  const parent = {
    activityId: `${id}-P`,
    name: "Delivery acceptance",
    notBefore: "2026-10-19",
    durationDays: 2,
  };
  const preview = await send(parent, state.version, true);
  assert.equal(preview.status, 200);
  assert.equal((await read()).version, state.version);
  assert(
    !(await read()).schedule.some(
      (row: { activityId: string }) => row.activityId === parent.activityId,
    ),
  );
  const created = await send(parent, state.version);
  assert.equal(created.status, 200, await created.text());
  state = await read();
  const successor = {
    activityId: `${id}-S`,
    name: "Installation acceptance",
    notBefore: "2026-10-19",
    durationDays: 3,
    predecessors: [{ activityId: parent.activityId, lagDays: 0 }],
  };
  assert.equal((await send(successor, state.version)).status, 200);
  state = await read();
  let child = state.schedule.find(
    (row: { activityId: string }) => row.activityId === successor.activityId,
  );
  assert.equal(child.start, "2026-10-21");
  assert.equal(child.finish, "2026-10-23");
  assert.equal(child.baselineStart, "2026-10-21");
  const taskResponse = await request("/api/tasks", cookie, "POST", {
    title: "Programme-linked acceptance task",
    description: "Track dates derived from the live app programme.",
    projectId: "p1",
    assignedTo: "u1",
    discipline: "Electrical",
    priority: state.config.priorities[0],
    cx: { kind: "task", result: "untested", activityId: successor.activityId },
  });
  assert.equal(taskResponse.status, 201);
  const task = await taskResponse.json();
  const oldVersion = state.version;
  const shifted = await send(
    { ...parent, notBefore: "2026-10-26" },
    state.version,
  );
  assert.equal(shifted.status, 200, await shifted.text());
  state = await read();
  child = state.schedule.find(
    (row: { activityId: string }) => row.activityId === successor.activityId,
  );
  assert.equal(child.start, "2026-10-28");
  assert.equal(child.finish, "2026-10-30");
  assert.equal(child.baselineStart, "2026-10-21");
  const taskData = await (await request("/api/bootstrap", cookie)).json();
  assert.equal(
    taskData.tasks.find((row: { id: string }) => row.id === task.id)
      .scheduleDueDate,
    "2026-10-30",
    "Task deadlines derive from persisted successor forecast.",
  );
  const before = structuredClone(state);
  const cycle = await send(
    {
      ...parent,
      notBefore: "2026-10-26",
      predecessors: [{ activityId: successor.activityId, lagDays: 0 }],
    },
    state.version,
  );
  assert.equal(cycle.status, 400);
  assert((await cycle.json()).error.includes("cycle"));
  assert.deepEqual(
    await read(),
    before,
    "Rejected programme revisions must not save data, versions or history.",
  );
  const missing = await send(
    {
      ...successor,
      predecessors: [{ activityId: "not-a-real-activity", lagDays: 0 }],
    },
    state.version,
  );
  assert.equal(missing.status, 400);
  assert.deepEqual(await read(), before);
  assert.equal(
    (await send({ ...parent, notBefore: "2026-10-27" }, oldVersion)).status,
    409,
  );
  assert.deepEqual(await read(), before);
});

test("programme API rechecks module access for an existing authenticated supervisor", async () => {
  assert.equal(
    (await (await request("/api/auth/session")).json()).mode,
    "demo",
  );
  const login = async (userId: string) => {
    const response = await request("/api/auth/login", "", "POST", { userId });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie")!.split(";")[0];
  };
  const admin = await login("u-admin"),
    supervisor = await login("u3");
  const before = await (await request("/api/bootstrap", admin)).json();
  const originalModules = before.users.find(
    (user: { id: string }) => user.id === "u3",
  ).modules ?? [...MODULES];
  try {
    assert.equal(
      (
        await request("/api/team/u3/modules", admin, "PATCH", {
          modules: ["tasks"],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request("/api/projects/p1/commissioning", supervisor, "PATCH", {
          action: "schedule",
          version: 1,
          reason: "Module forbidden programme edit",
          activity: {
            activityId: "forbidden",
            name: "Forbidden",
            notBefore: "2026-10-19",
            durationDays: 1,
          },
        })
      ).status,
      403,
    );
  } finally {
    assert.equal(
      (
        await request("/api/team/u3/modules", admin, "PATCH", {
          modules: originalModules,
        })
      ).status,
      200,
    );
  }
});
