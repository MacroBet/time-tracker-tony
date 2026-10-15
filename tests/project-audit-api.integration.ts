import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3107";
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
test("project audit API restricts access, records real exports and persists events through programme saves", async () => {
  const info = await (await request("/api/auth/session")).json();
  assert.equal(
    info.mode,
    "demo",
    "Run only against an isolated local demo server.",
  );
  assert.equal((await request("/api/projects/p1/audit")).status, 401);
  const worker = await session("u1");
  const supervisor = await session("u3");
  const manager = await session("u4");
  assert.equal((await request("/api/projects/p1/audit", worker)).status, 403);
  assert.equal(
    (await request("/api/projects/p2/audit", supervisor)).status,
    404,
  );
  assert.equal(
    (await request("/api/projects/p1/audit?limit=101", manager)).status,
    400,
  );
  assert.equal(
    (await request("/api/projects/p1/audit?offset=-1", manager)).status,
    400,
  );
  const data = await (await request("/api/bootstrap", manager)).json();
  const project = data.projects.find((p: { id: string }) => p.id === "p1");
  const initialVersion = project.commissioning.version;
  const initial = await (
    await request("/api/projects/p1/audit?limit=100", manager)
  ).json();
  const input = { action: "export", format: "json" };
  assert.equal(
    (
      await request("/api/projects/p1/audit", manager, "POST", {
        ...input,
        actor: "forged",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/api/projects/p1/audit",
        manager,
        "POST",
        input,
        "https://outside.example",
      )
    ).status,
    403,
  );
  const exported = await request(
    "/api/projects/p1/audit",
    manager,
    "POST",
    input,
  );
  assert.equal(exported.status, 200);
  assert(exported.headers.get("content-disposition")?.includes("attachment"));
  const exportedData = await exported.json();
  assert.deepEqual(exportedData.assets, project.commissioning.assets);
  assert.deepEqual(exportedData.schedule, project.commissioning.schedule);
  const csv = await request("/api/projects/p1/audit", manager, "POST", {
    action: "export",
    format: "csv",
  });
  assert.equal(csv.status, 200);
  assert(csv.headers.get("content-type")?.includes("text/csv"));
  assert((await csv.text()).includes("id,name,equipmentType"));
  const after = await (
    await request("/api/projects/p1/audit?limit=100", manager)
  ).json();
  assert.equal(after.total, initial.total + 2);
  assert.equal(after.events[0].action, "download");
  assert.equal(after.events[0].label, "Register export prepared");
  const latest = await (
    await request("/api/projects/p1/audit?limit=1", manager)
  ).json();
  const second = await (
    await request("/api/projects/p1/audit?limit=1&offset=1", manager)
  ).json();
  assert.equal(latest.total, after.total);
  assert.notEqual(latest.events[0].id, second.events[0].id);
  const bootstrap = await (await request("/api/bootstrap", manager)).json();
  const unchanged = bootstrap.projects.find(
    (p: { id: string }) => p.id === "p1",
  ).commissioning;
  assert.equal(
    unchanged.version,
    initialVersion,
    "Preparing downloads does not invalidate programme saves.",
  );
  assert.equal(
    unchanged._audit,
    undefined,
    "Audit is read only via its permission-checked endpoint.",
  );
  const changedAssets = [
    {
      ...exportedData.assets[0],
      name: `${exportedData.assets[0].name} audit test`,
    },
  ];
  const changed = await request(
    "/api/projects/p1/commissioning",
    manager,
    "PATCH",
    {
      action: "import",
      version: initialVersion,
      reason: "Verified audit preservation integration test",
      data: { assets: changedAssets },
    },
  );
  assert.equal(changed.status, 200, await changed.text());
  const preserved = await (
    await request("/api/projects/p1/audit?limit=100", manager)
  ).json();
  assert.equal(preserved.total, after.total + 1);
  const priorEventIds = new Set(
    initial.events.map((event: { id: string }) => event.id),
  );
  const newExports = after.events.filter(
    (event: { id: string; label: string }) =>
      event.label === "Register export prepared" &&
      !priorEventIds.has(event.id),
  );
  assert.equal(
    newExports.length,
    2,
    "This run prepares exactly two new exports.",
  );
  assert(
    newExports.every((event: { id: string }) =>
      preserved.events.some((saved: { id: string }) => saved.id === event.id),
    ),
    "Both newly prepared exports survive the programme save.",
  );
  assert.equal(preserved.events[0].action, "upload");
  assert.equal(preserved.events[0].label, "Register imported");
});
