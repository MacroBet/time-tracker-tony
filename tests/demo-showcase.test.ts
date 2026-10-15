import test from "node:test";
import assert from "node:assert/strict";
import { createDemoData } from "../src/lib/demo-data";
import {
  withDemoShowcase,
  DEMO_RICH_PROJECT,
  DEMO_EMPTY_PROJECT,
} from "../src/lib/demo-showcase";
import {
  assetSchema,
  configSchema,
  cxSchema,
  scheduleSchema,
  TAG_REVIEWS,
  tagRows,
  isTagApproved,
  linkError,
} from "../src/lib/commissioning";
import { recalculateSchedule } from "../src/lib/scheduling";
import { validateAssetHierarchy } from "../src/lib/commissioning-import";
import { scopeData } from "../src/lib/permissions";
import { projectHistory } from "../src/lib/project-audit";
const now = new Date("2026-10-15T18:00:00.000Z");

test("showcase is explicitly opt-in, deterministic and idempotent without changing original p1 data", () => {
  const original = createDemoData(now);
  assert.deepEqual(
    original.projects.map((project) => project.id),
    ["p1"],
    "Existing seed callers do not receive showcase projects.",
  );
  assert.deepEqual(createDemoData(now, { showcase: false }), original);
  const demo = createDemoData(now, { showcase: true });
  assert.deepEqual(createDemoData(now, { showcase: true }), demo);
  assert.deepEqual(withDemoShowcase(demo, now), demo);
  const ids = new Set([DEMO_RICH_PROJECT, DEMO_EMPTY_PROJECT]);
  const addedTasks = new Set(
    demo.tasks.filter((task) => ids.has(task.projectId)).map((task) => task.id),
  );
  assert.deepEqual(
    {
      ...demo,
      projects: demo.projects.filter((project) => !ids.has(project.id)),
      memberships: demo.memberships.filter(
        (membership) => !ids.has(membership.projectId),
      ),
      tasks: demo.tasks.filter((task) => !ids.has(task.projectId)),
      activities: demo.activities.filter(
        (event) => !addedTasks.has(event.taskId),
      ),
    },
    original,
  );
  assert.equal(
    new Set(demo.tasks.map((task) => task.id)).size,
    demo.tasks.length,
  );
  assert.equal(
    new Set(demo.activities.map((event) => event.id)).size,
    demo.activities.length,
  );
});
test("rich synthetic fixture has valid hierarchy, supply tri-state and a complete schema-valid linked programme", () => {
  const data = createDemoData(now, { showcase: true });
  const project = data.projects.find(
    (project) => project.id === DEMO_RICH_PROJECT,
  )!;
  const state = project.commissioning!;
  assert.equal(state.assets.length, 28);
  assert.equal(state.assets.filter((asset) => asset.parentAssetId).length, 24);
  assert.equal(state.schedule.length, 100);
  assert(
    state.schedule.some(
      (activity) => activity.name === "Switchboard A01 · Installation checks",
    ),
  );
  assert(
    state.schedule.every((activity) => !activity.name.startsWith("DEMO-NB-")),
    "Readable programme names remain distinguishable from their stable references.",
  );
  assert.deepEqual(validateAssetHierarchy(state.assets), []);
  configSchema.parse(state.config);
  state.assets.forEach((asset) => assetSchema.parse(asset));
  state.schedule.forEach((row) => scheduleSchema.parse(row));
  assert.deepEqual(recalculateSchedule(state.schedule).errors, []);
  assert.deepEqual(
    recalculateSchedule(state.schedule).schedule,
    state.schedule,
    "Saved plan already satisfies its dependencies and calendar.",
  );
  assert.deepEqual(
    new Set(state.assets.map((asset) => asset.clientSupplied)),
    new Set([true, false, null]),
  );
  assert.equal(new Set(state.assets.map((asset) => asset.phase)).size, 2);
  assert.equal(new Set(state.assets.map((asset) => asset.floor)).size, 3);
  assert.equal(new Set(state.assets.map((asset) => asset.area)).size, 4);
  assert(
    state.schedule.some((row) => row.start !== row.baselineStart),
    "Scenario includes a visible forecast variance from preserved baseline.",
  );
  const assets = new Set(state.assets.map((asset) => asset.id)),
    programme = new Set(state.schedule.map((row) => row.activityId));
  for (const task of data.tasks.filter(
    (task) => task.projectId === project.id,
  )) {
    cxSchema.parse(task.cx);
    assert(assets.has(task.cx!.assetId!));
    assert(programme.has(task.cx!.activityId!));
    assert.equal(linkError(task.cx, project, data.tasks, task.id), null);
    assert(task.description.includes("SYNTHETIC"));
    assert(
      task.source === "manual",
      "Synthetic records cannot masquerade as Excel/P6 imports.",
    );
  }
});
test("each applicable tag has its own test record and reviews remain distinct from test and construction outcomes", () => {
  const data = createDemoData(now, { showcase: true });
  const project = data.projects.find(
    (project) => project.id === DEMO_RICH_PROJECT,
  )!;
  const tasks = data.tasks.filter((task) => task.projectId === project.id);
  const tags = tasks.filter((task) => task.cx?.kind === "tag");
  assert.equal(tags.length, 96);
  assert.equal(tagRows(project, tasks).length, 96);
  assert(tagRows(project, tasks).every((row) => row.task));
  assert.deepEqual(
    new Set(tags.map((task) => task.cx?.tagReview).filter(Boolean)),
    new Set(TAG_REVIEWS),
  );
  assert(
    tags.some((task) => task.cx?.result === "passed" && !isTagApproved(task)),
    "A passing test is not implicitly approved.",
  );
  assert(
    tags.some(
      (task) =>
        task.cx?.tagReview === "approved-comments" && !isTagApproved(task),
    ),
    "AC remains distinct from full approval.",
  );
  assert(
    tags.some(
      (task) => task.cx?.result === "failed" && task.status === "blocked",
    ),
  );
  assert(tags.some((task) => task.cx?.result === "retest"));
  assert(tags.some((task) => task.status === "not-applicable"));
  const programme = new Map(
    project.commissioning!.schedule.map((activity) => [
      activity.activityId,
      activity,
    ]),
  );
  assert(
    new Set(tags.map((task) => programme.get(task.cx!.activityId!)!.progress))
      .size >= 4,
    "Programme bars include varied recorded execution percentages.",
  );
  for (const task of tags)
    assert.equal(
      programme.get(task.cx!.activityId!)!.progress,
      task.cx!.progress,
    );
  assert(
    tags.some(
      (task) =>
        programme.get(task.cx!.activityId!)!.progress === 100 &&
        !isTagApproved(task),
    ),
    "100% programme execution never implies tag approval.",
  );
  assert(
    tags.some((task) => !task.assignedTo),
    "Fixture exercises unassigned work.",
  );
  assert.equal(tasks.filter((task) => task.cx?.kind === "task").length, 12);
  assert.equal(tasks.filter((task) => task.cx?.kind === "issue").length, 8);
  assert.equal(
    tasks.filter((task) => task.cx?.kind === "documentation").length,
    4,
  );
  const history = projectHistory(project, tasks, data.activities);
  assert(history.length >= tasks.length);
  assert(history.every((event) => event.detail.includes("SYNTHETIC")));
  assert(
    history.every((event) => new Date(event.at).getTime() <= now.getTime()),
  );
});
test("empty project and worker scope support real empty-state and permission checks", () => {
  const data = createDemoData(now, { showcase: true });
  const project = data.projects.find(
    (project) => project.id === DEMO_EMPTY_PROJECT,
  )!;
  assert.equal(project.commissioning!.assets.length, 0);
  assert.equal(project.commissioning!.schedule.length, 0);
  assert.equal(project.commissioning!.revisions.length, 0);
  assert(!data.tasks.some((task) => task.projectId === project.id));
  for (const user of data.users)
    assert(
      data.memberships.some(
        (membership) =>
          membership.userId === user.id && membership.projectId === project.id,
      ),
    );
  const worker = data.users.find((user) => user.id === "u1")!;
  const scoped = scopeData(worker, data);
  assert(scoped.tasks.every((task) => task.assignedTo === worker.id));
  const workerRich = scoped.projects.find(
    (project) => project.id === DEMO_RICH_PROJECT,
  )!;
  assert(
    workerRich.commissioning!.assets.every((asset) =>
      scoped.tasks.some((task) => task.cx?.assetId === asset.id),
    ),
  );
  assert.equal(workerRich.commissioning!.revisions.length, 0);
});
test("fixture IDs stay stable as the demo calendar moves", () => {
  const first = createDemoData(now, { showcase: true });
  const later = createDemoData(new Date(now.getTime() + 7 * 86400000), {
    showcase: true,
  });
  const state = (data: ReturnType<typeof createDemoData>) =>
    data.projects.find((project) => project.id === DEMO_RICH_PROJECT)!
      .commissioning!;
  assert.deepEqual(
    state(first).assets.map((asset) => asset.id),
    state(later).assets.map((asset) => asset.id),
  );
  assert.deepEqual(
    state(first).schedule.map((row) => row.activityId),
    state(later).schedule.map((row) => row.activityId),
  );
  assert.notEqual(
    state(first).schedule[0].start,
    state(later).schedule[0].start,
  );
});
