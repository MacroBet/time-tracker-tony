import test from "node:test";
import assert from "node:assert/strict";
import { createDemoData } from "../src/lib/demo-data";
import { buildCopilotContext } from "../src/lib/copilot";
import { scopeData } from "../src/lib/permissions";

const now = new Date("2026-10-16T09:00:00.000Z");

test("programme metadata remains absent for legacy records and scoped to the selected project", () => {
  const data = createDemoData(now, { showcase: true });
  const before = structuredClone(data);
  const legacy = buildCopilotContext(data, "p1", now);
  const rich = buildCopilotContext(data, "p-demo-rich", now);
  assert.equal(legacy.project.programmeId, undefined);
  assert(legacy.tasks.every((task) => task.programmeId === undefined));
  assert.equal(rich.project.programmeId, "DEMO-NB-MASTER");
  assert(
    rich.tasks
      .filter((task) => task.activityId)
      .every((task) => task.programmeId === "DEMO-NB-MASTER"),
  );
  assert(!JSON.stringify(legacy).includes("DEMO-NB-MASTER"));
  assert.deepEqual(data, before);
});

test("synthetic primary activity and client references stay separate from internal asset IDs and tag links", () => {
  const data = createDemoData(now, { showcase: true });
  const context = buildCopilotContext(data, "p-demo-rich", now);
  const state = data.projects.find(
    (project) => project.id === "p-demo-rich",
  )!.commissioning!;
  const equipment = context.assets.filter((asset) => asset.clientAssetId);
  assert.equal(equipment.length, 24);
  for (const asset of equipment) {
    assert.notEqual(asset.id, asset.clientAssetId);
    assert(
      state.schedule.some(
        (row) => row.activityId === asset.programmeActivityId,
      ),
    );
    const original = state.assets.find((row) => row.id === asset.id)!;
    assert.equal(asset.programmeActivityId, original.deliveryActivityId);
    assert(original.levelActivities?.L3);
  }
  const worker = data.users.find((user) => user.id === "u1")!;
  const scoped = scopeData(worker, data);
  assert(scoped.tasks.every((task) => task.assignedTo === worker.id));
  assert(
    data.projects.find((project) => project.id === "p-demo-empty")!
      .commissioning!.programmeId === undefined,
  );
});
