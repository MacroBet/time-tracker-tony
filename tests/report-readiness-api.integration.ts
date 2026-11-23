import test from "node:test";
import assert from "node:assert/strict";
import type { Bootstrap } from "../src/lib/domain";
import type { ReportReadiness } from "../src/lib/report-readiness";

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
async function decode<T>(response: Response, status = 200): Promise<T> {
  const text = await response.text();
  assert.equal(response.status, status, text);
  return JSON.parse(text);
}
async function login(userId: string) {
  const response = await request("/api/auth/login", "", "POST", { userId });
  await decode(response);
  const cookie = response.headers.get("set-cookie");
  assert(cookie);
  return cookie.split(";")[0];
}

test("report readiness is an authorized bounded read with scoped remedies, honest empty inputs and no project mutations", async () => {
  assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname));
  assert.equal(
    (await decode<{ mode: string }>(await request("/api/auth/session"))).mode,
    "demo",
  );
  const admin = await login("u-admin"),
    manager = await login("u4"),
    worker = await login("u1");
  const before = await decode<Bootstrap>(
    await request("/api/bootstrap", admin),
  );
  const rich = before.projects.find((row) => row.id === "p-demo-rich");
  assert(rich);
  const endpoint = `/api/projects/${rich.id}/report-readiness`;
  assert.equal((await request(endpoint)).status, 401);
  assert.equal((await request(endpoint, worker)).status, 403);
  const response = await request(endpoint, manager);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.match(response.headers.get("cache-control") ?? "", /private/);
  const result = await decode<ReportReadiness>(response);
  assert.equal(result.projectId, rich.id);
  assert.equal(result.revision.register, rich.commissioning?.version ?? 0);
  assert.equal(result.summary.assets, rich.commissioning?.assets.length);
  assert(result.reports.length <= 15);
  assert(result.reports.every((row) => row.criteria.length <= 8));
  assert.equal("rows" in result, false);
  assert.equal("sourceIndex" in result, false);
  assert.equal("tasks" in result, false);
  assert(
    result.reports
      .flatMap((row) => row.criteria)
      .every(
        (row) =>
          new URL(row.href, base).searchParams.get("projectId") === rich.id,
      ),
  );
  const empty = await decode<ReportReadiness>(
    await request("/api/projects/p-demo-empty/report-readiness", manager),
  );
  assert.equal(empty.summary.assets, 0);
  assert.equal(
    empty.reports.find((row) => row.id === "tags")?.state,
    "missing",
  );
  assert.equal(
    (
      await request(
        "/api/projects/p-inaccessible-readiness/report-readiness",
        manager,
      )
    ).status,
    404,
  );
  const after = await decode<Bootstrap>(await request("/api/bootstrap", admin));
  assert.deepEqual(after.projects, before.projects);
  assert.deepEqual(after.tasks, before.tasks);
  assert.deepEqual(after.memberships, before.memberships);
});
