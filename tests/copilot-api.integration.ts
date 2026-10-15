import test from "node:test";
import assert from "node:assert/strict";
import { MODULES } from "../src/lib/commissioning";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3107";
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
async function session(userId: string) {
  const response = await request("/api/auth/login", "", "POST", { userId });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie")!.split(";")[0];
}
async function task(cookie: string, id: string) {
  const data = await (await request("/api/bootstrap", cookie)).json();
  return data.tasks.find((task: { id: string }) => task.id === id);
}
test("copilot has honest no-provider state, project scope and explicit session-bound task confirmations", async () => {
  assert.equal(
    (await (await request("/api/auth/session")).json()).mode,
    "demo",
    "Only run against an isolated local demo server.",
  );
  assert.equal((await request("/api/projects/p1/copilot")).status, 401);
  const manager = await session("u4"),
    worker = await session("u1"),
    supervisor = await session("u3");
  const endpoint = "/api/projects/p1/copilot";
  assert.equal((await request(endpoint, worker)).status, 403);
  assert.equal(
    (await request("/api/projects/not-assigned/copilot", supervisor)).status,
    404,
  );
  const initial = await (await request(endpoint, manager)).json();
  assert.equal(initial.project.id, "p1");
  assert.notEqual(
    initial.configuration.state,
    "ready",
    "These tests must never run with the AI provider enabled.",
  );
  assert(!("apiKey" in initial.configuration));
  assert(Array.isArray(initial.examples) && initial.examples.length > 0);
  const chat = await request(endpoint, manager, "POST", {
    message: "Summarise this project",
    history: [],
  });
  assert.equal(
    chat.status,
    503,
    "Disabled chat must stop before any provider request.",
  );
  assert((await chat.json()).error.includes("not configured"));
  const created = await request("/api/tasks", manager, "POST", {
    title: `Copilot confirmation test ${Date.now()}`,
    description: "Original scope retained until an explicit confirmation.",
    projectId: "p1",
    assignedTo: "u1",
    discipline: "Electrical",
    location: "Local test room",
    priority: initial.project.priorities[0],
    dueDate: "2040-01-01",
  });
  assert.equal(created.status, 201);
  const original = await created.json();
  const draft = {
    taskId: original.id,
    version: original.version,
    changes: { title: "Clarified inspection scope" },
    reason: "Human-reviewed clarification of the work scope",
  };
  assert.equal(
    (await request(`${endpoint}/proposals`, worker, "POST", draft)).status,
    403,
  );
  assert.equal(
    (
      await request(`${endpoint}/proposals`, manager, "POST", {
        ...draft,
        changes: { status: "completed" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        `${endpoint}/proposals`,
        manager,
        "POST",
        draft,
        "https://outside.example",
      )
    ).status,
    403,
  );
  const proposalResponse = await request(
    `${endpoint}/proposals`,
    manager,
    "POST",
    draft,
  );
  assert.equal(proposalResponse.status, 200);
  const prepared = await proposalResponse.json();
  assert.equal(prepared.proposal.before.title, original.title);
  assert.equal(
    (await task(manager, original.id)).title,
    original.title,
    "Preparing a proposal cannot update a task.",
  );
  assert.equal(
    (
      await request(`${endpoint}/confirm`, manager, "POST", {
        token: prepared.token,
        confirmed: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`${endpoint}/confirm`, manager, "POST", {
        token: prepared.token,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`${endpoint}/confirm`, manager, "POST", {
        token: prepared.token,
        confirmed: true,
        title: "Unreviewed edit",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`${endpoint}/confirm`, supervisor, "POST", {
        token: prepared.token,
        confirmed: true,
      })
    ).status,
    400,
    "A proposal from another authenticated session is unusable.",
  );
  assert.equal(
    (
      await request(`${endpoint}/confirm`, manager, "POST", {
        token: `${prepared.token.slice(0, -2)}XX`,
        confirmed: true,
      })
    ).status,
    400,
  );
  const confirmed = await request(`${endpoint}/confirm`, manager, "POST", {
    token: prepared.token,
    confirmed: true,
  });
  assert.equal(confirmed.status, 200, await confirmed.text());
  const saved = await task(manager, original.id);
  assert.equal(saved.title, draft.changes.title);
  assert.equal(saved.version, original.version + 1);
  for (const field of [
    "description",
    "priority",
    "dueDate",
    "discipline",
    "location",
    "status",
    "assignedTo",
  ])
    assert.equal(
      saved[field],
      original[field],
      `Confirmation preserves ${field}.`,
    );
  assert.equal(
    (
      await request(`${endpoint}/confirm`, manager, "POST", {
        token: prepared.token,
        confirmed: true,
      })
    ).status,
    409,
    "Version checks prevent replaying the confirmed edit.",
  );
  const bootstrap = await (await request("/api/bootstrap", manager)).json();
  assert(
    bootstrap.activities.some(
      (event: { taskId: string; action: string; note: string }) =>
        event.taskId === original.id &&
        event.action === "Activity plan updated" &&
        event.note.includes("Copilot confirmed"),
    ),
    "Confirmation uses the existing task audit.",
  );
  const newerDraft = {
    ...draft,
    version: saved.version,
    changes: { description: "A separately reviewed updated description." },
  };
  const staleProposal = await (
    await request(`${endpoint}/proposals`, manager, "POST", newerDraft)
  ).json();
  const admin = await session("u-admin");
  const context = await (await request(endpoint, admin)).json();
  const state = (
    await (await request("/api/bootstrap", admin)).json()
  ).projects.find(
    (project: { id: string }) => project.id === "p1",
  ).commissioning;
  assert.equal(
    (
      await request("/api/projects/p1/commissioning", admin, "PATCH", {
        action: "configure",
        version: context.project.version,
        reason: "Change project version to test proposal revalidation",
        config: state.config,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`${endpoint}/confirm`, manager, "POST", {
        token: staleProposal.token,
        confirmed: true,
      })
    ).status,
    409,
  );
  assert.equal(
    (await task(manager, original.id)).description,
    original.description,
  );
});
test("copilot endpoints recheck module permissions on an existing session", async () => {
  assert.equal(
    (await (await request("/api/auth/session")).json()).mode,
    "demo",
  );
  const admin = await session("u-admin"),
    manager = await session("u4");
  const data = await (await request("/api/bootstrap", admin)).json();
  const modules = data.users.find((user: { id: string }) => user.id === "u4")
    .modules ?? [...MODULES];
  try {
    assert.equal(
      (
        await request("/api/team/u4/modules", admin, "PATCH", {
          modules: ["tasks"],
        })
      ).status,
      200,
    );
    assert.equal(
      (await request("/api/projects/p1/copilot", manager)).status,
      403,
    );
    assert.equal(
      (await request("/api/projects/p1/copilot/proposals", manager, "POST", {}))
        .status,
      403,
    );
    assert.equal(
      (await request("/api/projects/p1/copilot/confirm", manager, "POST", {}))
        .status,
      403,
    );
    assert.equal(
      (
        await request("/api/projects/p1/copilot", manager, "POST", {
          message: "No access",
        })
      ).status,
      403,
    );
  } finally {
    assert.equal(
      (await request("/api/team/u4/modules", admin, "PATCH", { modules }))
        .status,
      200,
    );
  }
});
