import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Bootstrap, Project } from "../src/lib/domain";
import { commissioning } from "../src/lib/commissioning";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3107";
const request = (path: string, cookie = "", method = "GET", body?: unknown) =>
  fetch(base + path, {
    method,
    redirect: "manual",
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
test("shared Dashboard defaults are admin/version protected, persistent, and preserve project work; legacy report filters redirect intact", async () => {
  assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
  assert.equal(
    (await decoded<{ mode: string }>(await request("/api/auth/session"))).mode,
    "demo",
  );
  async function login(userId: string) {
    const response = await request("/api/auth/login", "", "POST", { userId });
    await decoded(response);
    return response.headers.get("set-cookie")!.split(";")[0];
  }
  const admin = await login("u-admin");
  const initial = await decoded<Bootstrap>(
    await request("/api/bootstrap", admin),
  );
  const project = await decoded<Project>(
    await request("/api/projects", admin, "POST", {
      name: "Dashboard local test",
      location: "Synthetic fixture",
      companyId: initial.currentUser.companyId,
      requestId: randomUUID(),
    }),
    201,
  );
  const endpoint = `/api/projects/${project.id}/commissioning`;
  const original = commissioning(project);
  const input = {
    action: "configure",
    version: original.version,
    reason: "Configure synthetic shared starting view",
    config: {
      ...original.config,
      viewDefaults: {
        dashboardPanels: ["attention", "summary", "reports"],
        durationMode: "hours",
        calendarScale: "month",
      },
    },
  };
  assert.equal((await request(endpoint, "", "PATCH", input)).status, 401);
  assert.equal(
    (await request(endpoint, await login("u1"), "PATCH", input)).status,
    403,
  );
  assert(
    [403, 404].includes(
      (await request(endpoint, await login("u4"), "PATCH", input)).status,
    ),
  );
  assert.equal(
    (
      await request(endpoint, admin, "PATCH", {
        ...input,
        config: {
          ...input.config,
          viewDefaults: { ...input.config.viewDefaults, calendarScale: "year" },
        },
      })
    ).status,
    400,
  );
  await decoded(await request(endpoint, admin, "PATCH", input));
  const after = await decoded<Bootstrap>(
    await request("/api/bootstrap", admin),
  );
  const saved = commissioning(
    after.projects.find((item) => item.id === project.id),
  );
  assert.deepEqual(saved.config.viewDefaults, input.config.viewDefaults);
  assert.equal(saved.version, original.version + 1);
  assert.deepEqual(saved.schedule, original.schedule);
  assert.deepEqual(saved.assets, original.assets);
  assert.deepEqual(after.tasks, initial.tasks);
  assert.equal((await request(endpoint, admin, "PATCH", input)).status, 409);
  assert.equal(saved.revisions.length, 1);
  assert(
    saved.revisions[0].changes.some((change) =>
      change.includes("Shared view defaults"),
    ),
  );
  const redirect = await request(
    `/reports?projectId=${project.id}&report=lookahead&query=SWB&offset=50`,
    admin,
  );
  assert([200, 307].includes(redirect.status));
  // Next can start streaming before async page auth/search params resolve.
  const html = redirect.status === 200 ? await redirect.text() : "";
  const meta = html.match(
    /<meta id="__next-page-redirect"[^>]+content="[01];url=([^"]+)"/,
  );
  const location =
    redirect.headers.get("location") ?? meta?.[1]?.replaceAll("&amp;", "&");
  assert(location, "Legacy URL must return an HTTP or streamed Next redirect");
  const target = new URL(location, base);
  assert.equal(target.pathname, "/overview");
  for (const [key, value] of Object.entries({
    projectId: project.id,
    report: "lookahead",
    query: "SWB",
    offset: "50",
    tab: "reports",
  }))
    assert.equal(target.searchParams.get(key), value);
});
