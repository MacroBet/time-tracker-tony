import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { commissioning } from "../src/lib/commissioning";
import type { Bootstrap, Project } from "../src/lib/domain";
import { parseP6Xer } from "../src/lib/p6-xer";
import type { SourceProgrammePage } from "../src/lib/programme-source";

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
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function decoded<T>(response: Response, status = 200) {
  const text = await response.text();
  assert.equal(response.status, status, text);
  return JSON.parse(text) as T;
}
async function login(userId: string) {
  const response = await request("/api/auth/login", "", "POST", { userId });
  await decoded(response);
  const cookie = response.headers.get("set-cookie");
  assert(cookie);
  return cookie.split(";")[0];
}

test("admin creates a separate project, recovers retries, imports only its synthetic XER and renames its app label", async () => {
  assert(
    ["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname),
    "Local host only",
  );
  assert.equal(
    (await decoded<{ mode: string }>(await request("/api/auth/session"))).mode,
    "demo",
    "Isolated synthetic demo only; never remote data",
  );
  assert.equal((await request("/api/projects", "", "POST", {})).status, 401);
  const admin = await login("u-admin"),
    manager = await login("u4"),
    worker = await login("u1");
  const initial = await decoded<Bootstrap>(
    await request("/api/bootstrap", admin),
  );
  const bootstrap = async () =>
    decoded<Bootstrap>(await request("/api/bootstrap", admin));
  const input = {
    name: `Local synthetic project ${randomUUID()}`,
    location: "Offline fixture site",
    companyId: initial.currentUser.companyId,
    requestId: randomUUID(),
  };
  assert.equal(
    (await request("/api/projects", manager, "POST", input)).status,
    403,
  );
  assert.equal(
    (await request("/api/projects", worker, "POST", input)).status,
    403,
  );
  assert.equal(
    (await request("/api/projects", admin, "POST", { ...input, name: " " }))
      .status,
    400,
  );
  const created = await decoded<Project>(
    await request("/api/projects", admin, "POST", input),
    201,
  );
  assert(!initial.projects.some((row) => row.id === created.id));
  const afterCreate = await bootstrap();
  const newProject = afterCreate.projects.find((row) => row.id === created.id);
  assert(newProject);
  assert.deepEqual(
    commissioning(newProject),
    commissioning(),
    "Project starts empty and distinct from existing work",
  );
  assert.deepEqual(afterCreate.tasks, initial.tasks);
  assert.deepEqual(
    afterCreate.projects.filter((row) => row.id !== created.id),
    initial.projects,
  );
  assert.deepEqual(
    afterCreate.memberships.filter((row) => row.projectId !== created.id),
    initial.memberships,
  );
  assert.deepEqual(
    afterCreate.memberships.filter((row) => row.projectId === created.id),
    [{ userId: initial.currentUser.id, projectId: created.id }],
  );
  for (const response of await Promise.all([
    request("/api/projects", admin, "POST", input),
    request("/api/projects", admin, "POST", input),
  ])) {
    assert.equal((await decoded<Project>(response, 201)).id, created.id);
  }
  assert.equal(
    (await bootstrap()).projects.length,
    initial.projects.length + 1,
  );
  assert.equal(
    (
      await request("/api/projects", admin, "POST", {
        ...input,
        name: "Altered creation request",
      })
    ).status,
    409,
  );
  const managerData = await decoded<Bootstrap>(
    await request("/api/bootstrap", manager),
  );
  assert(!managerData.projects.some((row) => row.id === created.id));

  const xer = [
    "ERMHDR\t15.2\t2026-11-16\tSynthetic fixture",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name",
    "%R\tp6-local\tP6-SOURCE-UNCHANGED",
    "%T\tPROJWBS",
    "%F\twbs_id\twbs_short_name\twbs_name\tparent_wbs_id\tproj_node_flag",
    "%R\troot\tSYNTHETIC\tOriginal P6 source name\t\tY",
    "%T\tTASK",
    "%F\ttask_id\ttask_code\ttask_name\twbs_id\ttarget_drtn_hr_cnt\tearly_start_date\tearly_end_date\tstatus_code",
    "%R\tt1\tSYN-001\tSynthetic inspection\troot\t8\t2026-11-16 08:00\t2026-11-16 17:00\tTK_NotStart",
    "%E",
    "",
  ].join("\r\n");
  const source = await parseP6Xer(
    new TextEncoder().encode(xer),
    "synthetic-local-source.xer",
  );
  const originalSource = JSON.stringify(source),
    archive = gzipSync(originalSource);
  const upload = (preview: boolean, body: Uint8Array = archive) =>
    fetch(
      `${base}/api/projects/${created.id}/programme-source?${new URLSearchParams({ preview: String(preview), version: "0", reason: "Validate synthetic source in a separate local project" })}`,
      {
        method: "POST",
        headers: {
          Cookie: admin,
          Origin: base,
          "Content-Type": "application/gzip",
        },
        body: new Uint8Array(body),
      },
    );
  await decoded(
    await upload(true, new TextEncoder().encode("invalid gzip")),
    400,
  );
  assert.equal(
    commissioning(
      (await bootstrap()).projects.find((row) => row.id === created.id),
    ).version,
    0,
  );
  const preview = await decoded<{ summary: { projectName: string } }>(
    await upload(true),
  );
  assert.equal(preview.summary.projectName, "Original P6 source name");
  assert.equal(
    commissioning(
      (await bootstrap()).projects.find((row) => row.id === created.id),
    ).version,
    0,
  );
  await decoded(await upload(false));
  const beforeRename = await bootstrap(),
    beforeProject = beforeRename.projects.find((row) => row.id === created.id);
  assert(beforeProject);
  const rename = {
    name: "Readable FieldTrack project",
    expectedName: created.name,
    reason: "Local verification of FieldTrack name separation",
    requestId: randomUUID(),
  };
  assert.equal(
    (await request(`/api/projects/${created.id}`, manager, "PATCH", rename))
      .status,
    403,
  );
  assert.equal(
    (await request(`/api/projects/${created.id}`, worker, "PATCH", rename))
      .status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/projects/not-a-member-project",
        admin,
        "PATCH",
        rename,
      )
    ).status,
    404,
  );
  await decoded(
    await request(`/api/projects/${created.id}`, admin, "PATCH", {
      ...rename,
      preview: true,
    }),
  );
  assert.equal(
    (await bootstrap()).projects.find((row) => row.id === created.id)?.name,
    created.name,
  );
  await decoded(
    await request(`/api/projects/${created.id}`, admin, "PATCH", rename),
  );
  await decoded(
    await request(`/api/projects/${created.id}`, admin, "PATCH", rename),
  );
  const reloaded = await bootstrap(),
    renamed = reloaded.projects.find((row) => row.id === created.id);
  assert(renamed);
  assert.equal(renamed.name, rename.name);
  assert.equal(renamed.id, created.id);
  assert.equal(renamed.location, created.location);
  assert.deepEqual(
    commissioning(renamed),
    commissioning(beforeProject),
    "Source metadata, revisions, assets and commissioning version survive rename unchanged",
  );
  assert.deepEqual(reloaded.tasks, initial.tasks);
  assert.deepEqual(reloaded.memberships, beforeRename.memberships);
  assert.deepEqual(
    reloaded.projects.filter((row) => row.id !== created.id),
    initial.projects,
  );
  assert.equal(
    (
      await decoded<Project>(
        await request("/api/projects", admin, "POST", input),
        201,
      )
    ).id,
    created.id,
  );
  const page = await decoded<SourceProgrammePage>(
    await request(
      `/api/projects/${created.id}/programme-source?view=source`,
      admin,
    ),
  );
  assert.equal(page.summary.projectName, "Original P6 source name");
  assert.equal(page.summary.fileName, "synthetic-local-source.xer");
  assert.equal(page.summary.sha256, source.source.sha256);
  assert.equal(page.activities[0].activityId, "SYN-001");
  assert.equal(JSON.stringify(source), originalSource);
  assert.equal(
    (
      await request(`/api/projects/${created.id}`, admin, "PATCH", {
        ...rename,
        requestId: randomUUID(),
      })
    ).status,
    409,
  );
  const audit = await decoded<{ events: { label: string }[] }>(
    await request(`/api/projects/${created.id}/audit`, admin),
  );
  assert.equal(
    audit.events.filter((event) => event.label === "FieldTrack project renamed")
      .length,
    1,
  );
  assert.equal(
    audit.events.filter((event) => event.label === "Project created").length,
    1,
  );
  const renameBack = {
    name: created.name,
    expectedName: rename.name,
    reason: "A later approved change restores the original name",
    requestId: randomUUID(),
  };
  await decoded(
    await request(`/api/projects/${created.id}`, admin, "PATCH", renameBack),
  );
  const afterReturn = await bootstrap();
  const afterReturnAudit = await decoded(
    await request(`/api/projects/${created.id}/audit`, admin),
  );
  const lateReplay = await decoded<Project>(
    await request(`/api/projects/${created.id}`, admin, "PATCH", rename),
  );
  assert.equal(
    lateReplay.name,
    created.name,
    "The already consumed A→B request must not undo later B→A",
  );
  assert.deepEqual(await bootstrap(), afterReturn);
  assert.deepEqual(
    await decoded(await request(`/api/projects/${created.id}/audit`, admin)),
    afterReturnAudit,
    "Late replay adds no audit and cannot change state",
  );
  const legacy = await decoded<Project>(
    await request("/api/projects", admin, "POST", {
      name: "Legacy synthetic create",
      location: "Local site",
      companyId: input.companyId,
    }),
    201,
  );
  assert(
    legacy.id && legacy.id !== created.id,
    "Existing clients without requestId still create a project",
  );
});
