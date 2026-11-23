import test from "node:test";
import assert from "node:assert/strict";
import type { Bootstrap } from "../src/lib/domain";
import type { ProjectProgress } from "../src/lib/project-progress";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3107";
const request = (path: string, cookie = "", method = "GET", body?: unknown) =>
  fetch(base + path, {
    method,
    headers: {
      Cookie: cookie,
      Origin: base,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
async function decoded<T>(response: Response, status = 200): Promise<T> {
  const body = await response.text();
  assert.equal(response.status, status, body);
  return JSON.parse(body);
}
async function login(userId: string) {
  const response = await request("/api/auth/login", "", "POST", { userId });
  await decoded(response);
  const cookie = response.headers.get("set-cookie");
  assert(cookie);
  return cookie.split(";")[0];
}

test("project progress is an authorized bounded read, preserves project records and keeps empty coverage unavailable", async () => {
  assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname));
  assert.equal(
    (await decoded<{ mode: string }>(await request("/api/auth/session"))).mode,
    "demo",
  );
  const admin = await login("u-admin");
  const manager = await login("u4");
  const worker = await login("u1");
  const before = await decoded<Bootstrap>(
    await request("/api/bootstrap", admin),
  );
  const managerData = await decoded<Bootstrap>(
    await request("/api/bootstrap", manager),
  );
  const rich = before.projects.find((project) => project.id === "p-demo-rich");
  const empty = before.projects.find(
    (project) => project.id === "p-demo-empty",
  );
  assert(
    rich && empty,
    "Run against the opt-in isolated rich/empty synthetic demo.",
  );
  const endpoint = `/api/projects/${rich.id}/progress`;
  assert.equal((await request(endpoint)).status, 401);
  assert.equal((await request(endpoint, worker)).status, 403);
  const response = await request(endpoint, manager);
  assert.match(response.headers.get("cache-control") ?? "", /private/);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  const result = await decoded<ProjectProgress>(response);
  assert(
    result.total > 50,
    "The aggregate must include the complete rich Schedule, beyond one source page.",
  );
  assert(result.points.length <= 240);
  assert.equal(typeof result.currentRecorded, "number");
  assert(result.points.every((point) => "current" in point));
  if (result.criticalPath) {
    assert(result.criticalPath.series.points.length <= 240);
    assert.equal(result.criticalPath.coverage.total, result.total);
    assert.equal("rows" in result.criticalPath.series, false);
  }
  assert.equal(result.revision.register, rich.commissioning?.version ?? 0);
  assert.equal(result.sourceUnavailable, false);
  assert.equal(
    "rows" in result,
    false,
    "Raw activity records must stay on the server.",
  );
  assert.equal("sourceIndex" in result, false);
  const inaccessible = before.projects.find(
    (project) =>
      !managerData.projects.some((allowed) => allowed.id === project.id),
  );
  // A fresh demo grants all seeded projects to every user. Existing non-member fixtures are checked when available.
  assert.equal(
    (
      await request(
        `/api/projects/${inaccessible?.id ?? "p-unavailable-progress"}/progress`,
        manager,
      )
    ).status,
    404,
  );
  const emptyResult = await decoded<ProjectProgress>(
    await request(`/api/projects/${empty.id}/progress`, manager),
  );
  assert.equal(emptyResult.total, 0);
  assert.equal(emptyResult.plannedToday, null);
  assert.equal(emptyResult.actualToday, null);
  const after = await decoded<Bootstrap>(
    await request("/api/bootstrap", admin),
  );
  assert.deepEqual(after.projects, before.projects);
  assert.deepEqual(after.tasks, before.tasks);
  assert.deepEqual(after.memberships, before.memberships);
});
