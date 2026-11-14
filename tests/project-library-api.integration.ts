import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MODULES, commissioning, taskKind } from "../src/lib/commissioning";
import type { Bootstrap } from "../src/lib/domain";
import { scopeData } from "../src/lib/permissions";
import {
  canReadLessonSource,
  queryProjectLibrary,
  type ProjectLesson,
  type ProjectLibraryPage,
} from "../src/lib/project-library";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3107";
const projectId = "p-demo-rich";
async function request(
  path: string,
  cookie = "",
  method = "GET",
  body?: unknown,
  origin = base,
) {
  return fetch(base + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function session(userId: string) {
  const response = await request("/api/auth/login", "", "POST", { userId });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert(cookie);
  assert(cookie.includes("HttpOnly"));
  return cookie.split(";")[0];
}
async function load(cookie: string): Promise<Bootstrap> {
  const response = await request("/api/bootstrap", cookie);
  assert.equal(response.status, 200);
  return response.json();
}
async function library(
  cookie: string,
  query = "",
): Promise<ProjectLibraryPage> {
  const response = await request(
    `/api/library${query ? `?${query}` : ""}`,
    cookie,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, private");
  return response.json();
}

test("library HTTP search, explicit lesson CAS and fresh permissions stay scoped to local demo", async () => {
  const target = new URL(base);
  assert.equal(target.protocol, "http:");
  assert(
    ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname),
    "Never run this mutating integration against a remote host.",
  );
  assert.equal(
    (await (await request("/api/auth/session")).json()).mode,
    "demo",
    "Assert isolated demo mode before any login or mutation.",
  );
  assert.equal((await request("/api/library")).status, 401);
  const admin = await session("u-admin");
  const manager = await session("u4");
  const supervisor = await session("u3");
  const worker = await session("u1");
  const initial = await load(manager);
  const project = initial.projects.find((row) => row.id === projectId);
  assert(
    project,
    "Start the isolated demo server with its rich showcase fixture enabled.",
  );
  assert.match(project.commissioning?.config.projectType ?? "", /SYNTHETIC/);
  const state = commissioning(project);
  const asset = state.assets[0];
  assert(asset);
  const issue = initial.tasks.find(
    (row) =>
      row.projectId === projectId &&
      taskKind(row) === "issue" &&
      state.assets.some((item) => item.id === row.cx?.assetId),
  );
  assert(
    issue?.cx?.assetId,
    "Rich fixture must contain an asset-linked issue.",
  );
  const all = await library(manager, `projectId=${projectId}&limit=1`);
  const expectedIssues = initial.tasks.filter(
    (row) => row.projectId === projectId && taskKind(row) === "issue",
  ).length;
  const expectedLessons = (state.lessons ?? []).filter((lesson) =>
    canReadLessonSource(initial, initial.currentUser, project, lesson.source),
  ).length;
  assert.equal(
    all.total,
    state.assets.length + expectedIssues + expectedLessons,
  );
  assert.equal(all.results.length, 1, "Exact total precedes pagination.");
  assert.deepEqual(all.facets.kinds, {
    asset: state.assets.length,
    issue: expectedIssues,
    lesson: expectedLessons,
  });
  const assigned = new Set(initial.projects.map((row) => row.id));
  assert(all.facets.projects.every((row) => assigned.has(row.id)));
  const assets = await library(
    manager,
    `projectId=${projectId}&kind=asset&q=${encodeURIComponent(asset.id)}`,
  );
  assert(assets.total > 0);
  assert(
    assets.results.every(
      (row) => row.kind === "asset" && row.projectId === projectId,
    ),
  );
  assert(assets.results.some((row) => row.assetId === asset.id));
  const hidden = await library(manager, "projectId=not-a-member-project");
  assert.equal(hidden.total, 0);
  assert.deepEqual(hidden.results, []);
  assert.equal((await request("/api/library?limit=51", manager)).status, 400);
  assert.equal((await request("/api/library", worker)).status, 403);
  assert.equal((await request("/api/library", worker, "POST", {})).status, 403);
  assert.equal(
    (await request("/api/library", supervisor, "POST", {})).status,
    403,
  );
  assert.equal((await request("/api/library", supervisor)).status, 200);

  const marker = `Library integration ${randomUUID()}`;
  const source = { projectId, assetId: issue.cx.assetId, taskId: issue.id };
  const command = {
    kind: "create",
    title: marker,
    content:
      "Synthetic explicit learning: inspect this valve seal before pressure testing.",
    source,
    visibility: "project",
  };
  const createInput = {
    projectId,
    version: state.version,
    reason: "Verify explicit library lesson creation and provenance.",
    command,
  };
  assert.equal(
    (
      await request("/api/library", manager, "POST", {
        ...createInput,
        command: { ...command, createdBy: "forged-author" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/api/library",
        manager,
        "POST",
        createInput,
        "https://outside.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/library", manager, "POST", {
        ...createInput,
        command: {
          ...command,
          source: { ...source, projectId: "p-demo-empty" },
        },
      })
    ).status,
    404,
    "An asset ID in another project is not a source match; empty fixture is never edited.",
  );
  const createdResponse = await request(
    "/api/library",
    manager,
    "POST",
    createInput,
  );
  assert.equal(
    createdResponse.status,
    201,
    await createdResponse.clone().text(),
  );
  const created = (await createdResponse.json()) as {
    version: number;
    lesson: ProjectLesson;
  };
  assert.equal(created.version, state.version + 1);
  assert.equal(created.lesson.version, 1);
  assert.equal(created.lesson.createdBy, initial.currentUser.id);
  assert.equal(created.lesson.updatedByName, initial.currentUser.name);
  assert.equal(created.lesson.visibility, "project");
  assert.deepEqual(created.lesson.source, source);
  assert(Number.isFinite(Date.parse(created.lesson.createdAt)));
  assert.equal(
    (await request("/api/library", manager, "POST", createInput)).status,
    409,
    "Retrying a completed create with its old CAS cannot duplicate the lesson.",
  );
  const found = await library(
    manager,
    `projectId=${projectId}&q=${encodeURIComponent(marker)}&kind=lesson`,
  );
  assert.equal(found.total, 1);
  assert.equal(found.results[0].lessonId, created.lesson.id);
  assert.equal(
    found.results[0].sourceHref,
    `/tasks/${encodeURIComponent(issue.id)}`,
  );

  const updateCommand = {
    ...command,
    kind: "update",
    id: created.lesson.id,
    lessonVersion: created.lesson.version,
    content:
      "Updated synthetic learning: inspect and record the seal condition before testing.",
  };
  const updateInput = {
    projectId,
    version: created.version,
    reason:
      "Verify current lesson revision with immutable original provenance.",
    command: updateCommand,
  };
  const updatedResponse = await request(
    "/api/library",
    manager,
    "PATCH",
    updateInput,
  );
  assert.equal(
    updatedResponse.status,
    200,
    await updatedResponse.clone().text(),
  );
  const updated = (await updatedResponse.json()) as {
    version: number;
    lesson: ProjectLesson;
  };
  assert.equal(updated.lesson.version, 2);
  assert.equal(updated.lesson.createdAt, created.lesson.createdAt);
  assert.equal(updated.lesson.createdBy, created.lesson.createdBy);
  assert.equal(
    (await request("/api/library", manager, "PATCH", updateInput)).status,
    409,
  );
  assert.equal(
    (
      await request("/api/library", manager, "PATCH", {
        ...updateInput,
        version: updated.version,
      })
    ).status,
    409,
    "Current project CAS still requires the current lesson version.",
  );
  assert.equal(
    (await library(manager, `q=${encodeURIComponent(marker)}&kind=lesson`))
      .results[0].lesson?.content,
    updated.lesson.content,
  );

  const workerData = await load(worker);
  assert(
    workerData.projects.every(
      (row) => row.commissioning?.lessons === undefined,
    ),
    "Bootstrap never includes lessons for workers.",
  );
  const adminData = await load(admin);
  const managerUser = adminData.users.find(
    (row) => row.id === initial.currentUser.id,
  )!;
  const originalModules = managerUser.modules ?? [...MODULES];
  const currentProject = adminData.projects.find(
    (row) => row.id === projectId,
  )!;
  // Tasks cannot be disabled through the access API. Verify its guard, then test
  // the same bootstrap projection with an in-memory revoked profile.
  assert.equal(
    (
      await request("/api/team/u4/modules", admin, "PATCH", {
        modules: ["commissioning"],
      })
    ).status,
    400,
  );
  const noTasks = { ...managerUser, modules: ["commissioning" as const] };
  const syntheticAssetLesson = {
    ...updated.lesson,
    id: `asset-only-${updated.lesson.id}`,
    source: { projectId, assetId: source.assetId },
  };
  const snapshot = structuredClone(adminData);
  snapshot.projects
    .find((row) => row.id === projectId)!
    .commissioning!.lessons!.push(syntheticAssetLesson);
  const tasksRevoked = scopeData(noTasks, snapshot);
  const projected = tasksRevoked.projects.find((row) => row.id === projectId)!;
  assert.equal(tasksRevoked.tasks.length, 0);
  assert(
    projected.commissioning?.lessons?.some(
      (lesson) => lesson.id === syntheticAssetLesson.id,
    ),
  );
  assert(
    projected.commissioning?.lessons?.every((lesson) => !lesson.source.taskId),
  );
  assert.equal(
    canReadLessonSource(tasksRevoked, noTasks, projected, source),
    false,
  );
  assert.equal(
    queryProjectLibrary(tasksRevoked, noTasks).facets.kinds.issue,
    0,
  );
  const unmembered = {
    ...adminData,
    memberships: adminData.memberships.filter(
      (row) => row.userId !== managerUser.id || row.projectId !== projectId,
    ),
  };
  assert.equal(
    queryProjectLibrary(unmembered, managerUser, { projectId }).total,
    0,
  );
  assert.equal(
    canReadLessonSource(unmembered, managerUser, currentProject, source),
    false,
  );

  try {
    assert.equal(
      (
        await request("/api/team/u4/modules", admin, "PATCH", {
          modules: originalModules.filter(
            (module) => module !== "commissioning",
          ),
        })
      ).status,
      200,
    );
    assert.equal(
      (await request("/api/library", manager)).status,
      403,
      "The existing signed-in session uses fresh module permissions.",
    );
    assert.equal(
      (
        await request("/api/library", manager, "PATCH", {
          ...updateInput,
          version: updated.version,
          command: { ...updateCommand, lessonVersion: 2 },
        })
      ).status,
      403,
    );
    const revoked = await load(manager);
    assert(
      revoked.projects.every((row) => row.commissioning?.lessons === undefined),
    );
    assert.equal(
      (
        await request(
          `/api/projects/${projectId}/commissioning`,
          manager,
          "PATCH",
          {},
        )
      ).status,
      403,
      "Opening a saved asset source cannot recover commissioning write access.",
    );
    const sourcePage = await request(
      `/commissioning?projectId=${projectId}&asset=${encodeURIComponent(source.assetId)}`,
      manager,
    );
    assert(
      [303, 307, 308].includes(sourcePage.status),
      "Asset source UI redirects after commissioning access is revoked.",
    );
    assert(sourcePage.headers.get("location"));
  } finally {
    assert.equal(
      (
        await request("/api/team/u4/modules", admin, "PATCH", {
          modules: originalModules,
        })
      ).status,
      200,
      "Restore the demo profile even if a permission assertion fails.",
    );
  }
  assert.equal(
    (await library(manager, `q=${encodeURIComponent(marker)}&kind=lesson`))
      .total,
    1,
  );
});
