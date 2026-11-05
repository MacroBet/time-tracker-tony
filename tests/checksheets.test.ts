import test from "node:test";
import assert from "node:assert/strict";
import {
  applyChecksheetCommand,
  checksheetProgress,
  emptyChecksheetState,
  projectChecksheetStateSchema,
  scopeChecksheetState,
  worksToGoSummary,
  type ChecksheetContext,
  type ChecksheetTemplate,
} from "../src/lib/checksheets";
import type { User } from "../src/lib/domain";
const admin: User = {
  id: "admin",
  name: "Test admin",
  email: "synthetic-admin@example.test",
  role: "admin",
  companyId: "c",
};
const worker: User = {
  ...admin,
  id: "worker",
  name: "Test worker",
  role: "worker",
};
const other: User = { ...worker, id: "other" };
const ctx: ChecksheetContext = {
  actor: admin,
  assets: [
    {
      id: "a1",
      name: "Synthetic equipment",
      equipmentType: "Synthetic type",
      location: "",
      levels: [],
    },
    {
      id: "a2",
      name: "Other equipment",
      equipmentType: "Synthetic type",
      location: "",
      levels: [],
    },
  ],
  users: [admin, worker, other],
  tasks: [
    {
      id: "task",
      title: "Synthetic work",
      description: "",
      projectId: "p",
      companyId: "c",
      assignedTo: worker.id,
      createdBy: admin.id,
      status: "pending",
      discipline: "Test",
      location: "",
      source: "manual",
      createdAt: "2026-11-05T12:00:00Z",
      updatedAt: "2026-11-05T12:00:00Z",
      version: 1,
      cx: { kind: "task", assetId: "a1", result: "untested" },
    },
  ],
  now: "2026-11-05T12:00:00Z",
};
const template: ChecksheetTemplate = {
  id: "t",
  name: "Synthetic source requirements",
  revision: "1",
  requirements: [
    {
      id: "r1",
      item: "21",
      requirement: "Synthetic requirement",
      notes: "Source note, not an answer",
      required: true,
    },
    {
      id: "r2",
      item: "21",
      requirement: "Another source row",
      required: false,
    },
  ],
};
function associated() {
  let state = applyChecksheetCommand(
    undefined,
    { kind: "save-templates", templates: [template] },
    ctx,
  ).state;
  state = applyChecksheetCommand(
    state,
    { kind: "associate", id: "s1", assetId: "a1", templateId: "t" },
    ctx,
  ).state;
  return state;
}

test("requirements remain source records, explicit equipment association starts with blank answers and signatures", () => {
  const state = associated();
  assert.equal(state.sheets.length, 1);
  assert.deepEqual(state.sheets[0].responses, []);
  assert.deepEqual(state.sheets[0].signatures, []);
  assert.equal(
    state.sheets[0].requirements[0].notes,
    "Source note, not an answer",
  );
  assert.equal(checksheetProgress(state.sheets[0]).answered, 0);
  assert.equal(ctx.tasks.length, 1);
  assert.deepEqual(
    emptyChecksheetState(),
    projectChecksheetStateSchema.parse({}),
  );
  assert.throws(
    () =>
      applyChecksheetCommand(
        state,
        { kind: "associate", id: "s2", assetId: "a1", templateId: "t" },
        ctx,
      ),
    /already associated/,
  );
});

test("template reimport is idempotent and later template edits preserve existing sheet snapshots", () => {
  const state = associated();
  assert.equal(
    applyChecksheetCommand(
      state,
      { kind: "save-templates", templates: [template] },
      ctx,
    ).changes.length,
    0,
  );
  const updated = applyChecksheetCommand(
    state,
    {
      kind: "save-templates",
      templates: [
        {
          ...template,
          revision: "2",
          requirements: [
            { ...template.requirements[0], requirement: "Changed source" },
          ],
        },
      ],
    },
    ctx,
  ).state;
  assert.equal(updated.templates[0].revision, "2");
  assert.equal(updated.sheets[0].templateRevision, "1");
  assert.equal(
    updated.sheets[0].requirements[0].requirement,
    "Synthetic requirement",
  );
  assert.equal(state.templates[0].revision, "1");
});

test("workers only answer assigned equipment; management-only operations and forged actor data are rejected", () => {
  const state = associated();
  const workerCtx = { ...ctx, actor: worker };
  assert.throws(
    () =>
      applyChecksheetCommand(
        state,
        { kind: "save-templates", templates: [template] },
        workerCtx,
      ),
    /management/,
  );
  assert.throws(
    () =>
      applyChecksheetCommand(
        state,
        { kind: "associate", id: "s2", assetId: "a1", templateId: "t" },
        workerCtx,
      ),
    /management/,
  );
  assert.throws(
    () =>
      applyChecksheetCommand(
        state,
        {
          kind: "save-response",
          sheetId: "s1",
          stepId: "r1",
          answer: "Recorded",
        },
        { ...ctx, actor: other },
      ),
    /assigned asset/,
  );
  assert.throws(() =>
    applyChecksheetCommand(
      state,
      {
        kind: "save-response",
        sheetId: "s1",
        stepId: "r1",
        answer: "Recorded",
        updatedBy: "admin",
      },
      workerCtx,
    ),
  );
  const next = applyChecksheetCommand(
    state,
    {
      kind: "save-response",
      sheetId: "s1",
      stepId: "r1",
      answer: "Observed",
      result: "failed",
    },
    workerCtx,
  ).state;
  assert.equal(next.sheets[0].responses[0].updatedBy, worker.id);
  assert.equal(next.sheets[0].responses[0].result, "failed");
  assert.throws(
    () =>
      applyChecksheetCommand(
        state,
        {
          kind: "save-response",
          sheetId: "s1",
          stepId: "r1",
          answer: "",
          result: "passed",
        },
        workerCtx,
      ),
    /answer/,
  );
});

test("project signatories use existing users, require answers, sign as actor and retain invalidated signature history", () => {
  let state = associated();
  assert.throws(
    () =>
      applyChecksheetCommand(
        state,
        {
          kind: "configure-signatories",
          slots: [
            {
              id: "slot",
              label: "Review",
              userIds: ["invented-qa"],
              roles: [],
            },
          ],
        },
        ctx,
      ),
    /belongs/,
  );
  state = applyChecksheetCommand(
    state,
    {
      kind: "configure-signatories",
      slots: [
        {
          id: "slot",
          label: "Project QA review",
          userIds: [worker.id],
          roles: [],
        },
      ],
    },
    ctx,
  ).state;
  const wc = { ...ctx, actor: worker };
  assert.throws(
    () =>
      applyChecksheetCommand(
        state,
        { kind: "sign", sheetId: "s1", slotId: "slot" },
        wc,
      ),
    /Answer every/,
  );
  state = applyChecksheetCommand(
    state,
    {
      kind: "save-response",
      sheetId: "s1",
      stepId: "r1",
      answer: "Observation",
    },
    wc,
  ).state;
  assert.throws(
    () =>
      applyChecksheetCommand(
        state,
        { kind: "sign", sheetId: "s1", slotId: "slot" },
        ctx,
      ),
    /configured signatory/,
  );
  state = applyChecksheetCommand(
    state,
    { kind: "sign", sheetId: "s1", slotId: "slot" },
    wc,
  ).state;
  assert.equal(state.sheets[0].signatures[0].userId, worker.id);
  assert.equal(checksheetProgress(state.sheets[0]).activeSignatures, 1);
  state = applyChecksheetCommand(
    state,
    {
      kind: "save-response",
      sheetId: "s1",
      stepId: "r1",
      answer: "Changed observation",
    },
    { ...wc, now: "2026-11-05T12:01:00Z" },
  ).state;
  assert.equal(state.sheets[0].signatures.length, 1);
  assert.equal(
    state.sheets[0].signatures[0].invalidationReason,
    "Checksheet answer changed",
  );
  assert.equal(checksheetProgress(state.sheets[0]).activeSignatures, 0);
});

test("works to go records actual user input without mutating tasks or generating results", () => {
  const state = associated();
  const before = structuredClone(ctx.tasks);
  assert.throws(
    () =>
      applyChecksheetCommand(
        state,
        { kind: "add-work", id: "w", title: "Remaining work" },
        { ...ctx, actor: worker },
      ),
    /assigned equipment or task/,
  );
  assert.throws(
    () =>
      applyChecksheetCommand(
        state,
        {
          kind: "add-work",
          id: "w",
          title: "Remaining work",
          assetId: "a2",
          taskId: "task",
        },
        ctx,
      ),
    /does not belong/,
  );
  let next = applyChecksheetCommand(
    state,
    {
      kind: "add-work",
      id: "w",
      title: "Remaining work",
      notes: "Record a missing observation",
      assetId: "a1",
      taskId: "task",
    },
    { ...ctx, actor: worker },
  ).state;
  assert.deepEqual(worksToGoSummary(next), { open: 1, done: 0, total: 1 });
  assert.equal(next.sheets[0].responses.length, 0);
  assert.throws(
    () =>
      applyChecksheetCommand(
        next,
        { kind: "set-work-status", id: "w", status: "done" },
        { ...ctx, actor: other },
      ),
    /assigned work/,
  );
  next = applyChecksheetCommand(
    next,
    { kind: "set-work-status", id: "w", status: "done" },
    { ...ctx, actor: worker },
  ).state;
  assert.equal(worksToGoSummary(next).done, 1);
  assert.deepEqual(ctx.tasks, before);
});

test("worker scope excludes other equipment sheets, unrelated templates and management-level remaining work", () => {
  let state = associated();
  state = applyChecksheetCommand(
    state,
    { kind: "associate", id: "s2", assetId: "a2", templateId: "t" },
    ctx,
  ).state;
  state = applyChecksheetCommand(
    state,
    { kind: "add-work", id: "project-only", title: "Private project work" },
    ctx,
  ).state;
  state = applyChecksheetCommand(
    state,
    {
      kind: "add-work",
      id: "assigned",
      title: "Assigned equipment work",
      assetId: "a1",
    },
    ctx,
  ).state;
  const scoped = scopeChecksheetState(state, { ...ctx, actor: worker });
  assert.deepEqual(
    scoped.sheets.map((s) => s.id),
    ["s1"],
  );
  assert.deepEqual(
    scoped.worksToGo.map((w) => w.id),
    ["assigned"],
  );
  assert.equal(
    scopeChecksheetState(state, { ...ctx, actor: other }).sheets.length,
    0,
  );
  assert.equal(
    scopeChecksheetState(state, { ...ctx, actor: other }).templates.length,
    0,
  );
  assert.equal(scopeChecksheetState(state, ctx), state);
});
