import test from "node:test";
import assert from "node:assert/strict";
import { commissioning } from "../src/lib/commissioning";
import {
  emptyData,
  type AppData,
  type Project,
  type Task,
  type User,
} from "../src/lib/domain";
import {
  applyProjectLessonCommand,
  canReadLessonSource,
  projectLessonSchema,
  queryProjectLibrary,
  type ProjectLesson,
} from "../src/lib/project-library";

const now = "2026-11-14T12:00:00.000Z";
const manager: User = {
  id: "manager",
  name: "Synthetic manager",
  role: "manager",
  email: "manager@example.test",
  companyId: "company",
};
const asset = {
  id: "same-asset",
  name: "Synthetic chiller",
  equipmentType: "Chiller",
  location: "Plant room",
  levels: [],
};
function project(id: string, name: string): Project {
  return {
    id,
    name,
    location: "Synthetic site",
    companyId: "company",
    commissioning: { ...commissioning(), assets: [{ ...asset }], version: 3 },
  };
}
function issue(projectId: string, id = `issue-${projectId}`): Task {
  return {
    id,
    title: `Valve issue ${projectId}`,
    description: "The valve leaks during the pressure test.",
    notes: "PRIVATE-NOTE-NEVER-INDEX",
    projectId,
    companyId: "company",
    status: "blocked",
    source: "manual",
    discipline: "Mechanical",
    location: "Plant room",
    createdBy: manager.id,
    createdAt: now,
    updatedAt: now,
    version: 1,
    cx: { kind: "issue", assetId: asset.id, result: "untested" },
  };
}
function lesson(projectId: string, taskId?: string): ProjectLesson {
  return projectLessonSchema.parse({
    id: "lesson",
    title: "Synthetic lesson",
    content: "Check the valve seal before starting the pressure test.",
    source: { projectId, assetId: asset.id, ...(taskId ? { taskId } : {}) },
    visibility: "project",
    createdBy: manager.id,
    createdByName: manager.name,
    createdAt: now,
    updatedBy: manager.id,
    updatedByName: manager.name,
    updatedAt: now,
    version: 1,
  });
}
function fixture(): AppData {
  const visible = project("p1", "Assigned project");
  visible.commissioning!.lessons = [lesson("p1", "issue-p1")];
  const other = project("p2", "Hidden project secret");
  other.commissioning!.assets[0].name = "HIDDEN-CONTENT";
  other.commissioning!.lessons = [lesson("p2")];
  return {
    ...structuredClone(emptyData),
    projects: [visible, other],
    users: [manager],
    memberships: [{ userId: manager.id, projectId: "p1" }],
    tasks: [issue("p1"), { ...issue("p2"), title: "HIDDEN-CONTENT" }],
  };
}

test("authorization filters results, totals, facets and snippets before search", () => {
  const data = fixture();
  const page = queryProjectLibrary(data, manager);
  assert.equal(page.total, 3);
  assert.deepEqual(page.facets.kinds, { asset: 1, issue: 1, lesson: 1 });
  assert.deepEqual(page.facets.projects, [
    { id: "p1", name: "Assigned project", count: 3 },
  ]);
  assert.doesNotMatch(
    JSON.stringify(page),
    /HIDDEN|Hidden project|PRIVATE-NOTE/,
  );
  assert.equal(
    queryProjectLibrary(data, manager, { q: "HIDDEN-CONTENT" }).total,
    0,
  );
  assert.equal(
    queryProjectLibrary(data, manager, { q: "PRIVATE-NOTE-NEVER-INDEX" }).total,
    0,
  );
  assert.equal(
    queryProjectLibrary(data, manager, { projectId: "p2" }).total,
    0,
  );
});

test("identical asset and lesson IDs remain separate across authorized projects", () => {
  const data = fixture();
  data.memberships.push({ userId: manager.id, projectId: "p2" });
  const assets = queryProjectLibrary(data, manager, { kind: "asset" });
  assert.equal(assets.total, 2);
  assert.equal(new Set(assets.results.map((result) => result.key)).size, 2);
  assert.ok(
    assets.results.some((result) => result.sourceHref.includes("projectId=p1")),
  );
  assert.ok(
    assets.results.some((result) => result.sourceHref.includes("projectId=p2")),
  );
  assert.equal(
    new Set(
      queryProjectLibrary(data, manager, { kind: "lesson" }).results.map(
        (result) => result.key,
      ),
    ).size,
    2,
  );
});

test("membership and module revocation remove records and source access", () => {
  const data = fixture();
  const source = lesson("p1", "issue-p1").source;
  assert.equal(
    canReadLessonSource(data, manager, data.projects[0], source),
    true,
  );
  data.memberships = [];
  assert.equal(queryProjectLibrary(data, manager).total, 0);
  assert.equal(
    canReadLessonSource(data, manager, data.projects[0], source),
    false,
  );
  const original = fixture();
  for (const actor of [
    { ...manager, modules: [] },
    { ...manager, role: "worker" as const },
  ]) {
    const page = queryProjectLibrary(original, actor);
    assert.equal(page.total, 0);
    assert.deepEqual(page.facets.projects, []);
    assert.equal(
      canReadLessonSource(original, actor, original.projects[0], source),
      false,
    );
  }
  const noTasks: User = { ...manager, modules: ["commissioning"] };
  assert.deepEqual(
    queryProjectLibrary(original, noTasks).results.map((result) => result.kind),
    ["asset"],
  );
  assert.equal(
    canReadLessonSource(original, noTasks, original.projects[0], source),
    false,
  );
});

test("dangling or cross-project lesson sources are withheld rather than relinked", () => {
  const data = fixture();
  const state = data.projects[0].commissioning!;
  state.lessons = [
    { ...lesson("p1"), source: { projectId: "p2", assetId: asset.id } },
    {
      ...lesson("p1"),
      id: "missing",
      source: { projectId: "p1", assetId: "absent" },
    },
    {
      ...lesson("p1"),
      id: "wrong-task",
      source: { projectId: "p1", assetId: asset.id, taskId: "issue-p2" },
    },
  ];
  assert.equal(queryProjectLibrary(data, manager, { kind: "lesson" }).total, 0);
  assert.deepEqual(queryProjectLibrary(data, manager).facets.kinds, {
    asset: 1,
    issue: 1,
    lesson: 0,
  });
});

test("pagination and multi-word search count authorized matches before slicing", () => {
  const data = fixture();
  data.projects[0].commissioning!.assets.push({
    ...asset,
    id: "other",
    name: "Another synthetic chiller",
  });
  const first = queryProjectLibrary(data, manager, {
    q: "SYNTHETIC chiller",
    limit: 1,
  });
  const second = queryProjectLibrary(data, manager, {
    q: "synthetic chiller",
    offset: 1,
    limit: 1,
  });
  assert.equal(first.total, 2);
  assert.equal(second.total, 2);
  assert.notEqual(first.results[0].key, second.results[0].key);
  assert.throws(() => queryProjectLibrary(data, manager, { limit: 51 }));
});

const create = {
  kind: "create" as const,
  title: "Seal inspection learning",
  content: "Inspect the valve seal before pressure testing this equipment.",
  source: { projectId: "p1", assetId: asset.id, taskId: "issue-p1" },
  visibility: "project" as const,
};
test("explicit creation records author, time, source, project visibility and version", () => {
  const data = fixture();
  const before = structuredClone(data);
  const result = applyProjectLessonCommand(
    data,
    manager,
    data.projects[0],
    create,
    { id: "new-lesson", now },
  );
  assert.equal(result.lesson.id, "new-lesson");
  assert.equal(result.lesson.createdBy, manager.id);
  assert.equal(result.lesson.createdAt, now);
  assert.equal(result.lesson.visibility, "project");
  assert.equal(result.lesson.version, 1);
  assert.deepEqual(result.lesson.source, create.source);
  assert.equal(result.lessons.length, 2);
  assert.deepEqual(
    data,
    before,
    "Command returns new records without mutating source issues or notes",
  );
  assert.doesNotMatch(result.lesson.content, /PRIVATE-NOTE/);
  assert.throws(() =>
    applyProjectLessonCommand(
      data,
      manager,
      data.projects[0],
      { ...create, createdBy: "spoofed" } as typeof create,
      { id: "bad", now },
    ),
  );
});

test("editing preserves provenance and requires the current lesson version", () => {
  const data = fixture();
  const editor: User = { ...manager, id: "editor", name: "Second manager" };
  data.memberships.push({ userId: editor.id, projectId: "p1" });
  const command = {
    ...create,
    kind: "update" as const,
    id: "lesson",
    lessonVersion: 1,
    content: "Updated explicit learning from the original source equipment.",
  };
  const result = applyProjectLessonCommand(
    data,
    editor,
    data.projects[0],
    command,
    { id: "ignored", now: "2026-11-14T13:00:00.000Z" },
  );
  assert.equal(result.lesson.id, "lesson");
  assert.equal(result.lesson.createdBy, manager.id);
  assert.equal(result.lesson.createdAt, now);
  assert.equal(result.lesson.updatedBy, editor.id);
  assert.equal(result.lesson.version, 2);
  assert.throws(
    () =>
      applyProjectLessonCommand(
        data,
        editor,
        data.projects[0],
        { ...command, lessonVersion: 9 },
        { id: "ignored", now },
      ),
    /changed/,
  );
});

test("lessons cannot be saved without role, membership, source and module permission", () => {
  const data = fixture();
  for (const actor of [
    { ...manager, role: "supervisor" as const },
    { ...manager, role: "worker" as const },
    { ...manager, modules: [] },
  ])
    assert.throws(
      () =>
        applyProjectLessonCommand(data, actor, data.projects[0], create, {
          id: "x",
          now,
        }),
      /access/,
    );
  assert.throws(
    () =>
      applyProjectLessonCommand(
        data,
        manager,
        data.projects[0],
        { ...create, source: { ...create.source, projectId: "p2" } },
        { id: "x", now },
      ),
    /source/,
  );
  assert.throws(
    () =>
      applyProjectLessonCommand(
        data,
        { ...manager, modules: ["commissioning"] },
        data.projects[0],
        create,
        { id: "x", now },
      ),
    /source/,
  );
  data.memberships = [];
  assert.throws(
    () =>
      applyProjectLessonCommand(data, manager, data.projects[0], create, {
        id: "x",
        now,
      }),
    /access/,
  );
});
