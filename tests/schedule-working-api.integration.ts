import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import type { Bootstrap } from "../src/lib/domain";
import { commissioning } from "../src/lib/commissioning";
import type {
  SourceProgramme,
  SourceProgrammePage,
} from "../src/lib/programme-source";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3107",
  reason = "Validate working schedule in isolated synthetic local API fixture";
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
async function login(id: string) {
  const response = await request("/api/auth/login", "", "POST", { userId: id });
  await decoded(response);
  const cookie = response.headers.get("set-cookie");
  assert(cookie);
  return cookie.split(";")[0];
}
test("working API confirms own drafts, protects source and roles, and atomically creates one asset activity/task", async () => {
  assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname));
  assert.equal(
    (await decoded<{ mode: string }>(await request("/api/auth/session"))).mode,
    "demo",
    "No remote or database writes.",
  );
  const admin = await login("u-admin"),
    initial = await decoded<Bootstrap>(await request("/api/bootstrap", admin));
  const unique = randomUUID();
  const project = initial.projects.find((row) => row.id === "p-demo-rich");
  const managedProject = initial.projects.find((row) => row.id === "p1");
  assert(
    project && managedProject,
    "Use the seeded rich source and p1 managed projects.",
  );
  const originalRich = structuredClone(commissioning(project));
  const originalManaged = structuredClone(commissioning(managedProject));
  assert(
    !originalRich.sourceProgrammeSummary && !originalRich.workingSchedule,
    "Use a fresh isolated demo; never replace an existing source/working schedule.",
  );
  assert(
    !originalManaged.sourceProgrammeSummary,
    "p1 must remain the seeded managed schedule.",
  );
  const sourceAssetId = `working-source-asset-${unique}`;
  const managedAssetId = `working-managed-asset-${unique}`;
  const state = async (projectId = project.id) =>
    commissioning(
      (
        await decoded<Bootstrap>(await request("/api/bootstrap", admin))
      ).projects.find((row) => row.id === projectId),
    );
  const manager = await login("u4"),
    supervisor = await login("u3");
  await decoded(
    await request(`/api/projects/${project.id}/commissioning`, admin, "PATCH", {
      action: "import",
      version: originalRich.version,
      reason,
      data: {
        assets: [
          {
            id: sourceAssetId,
            name: "Synthetic pump",
            equipmentType: "Pump",
            location: "",
            levels: [],
          },
        ],
        schedule: [],
      },
    }),
  );
  const source: SourceProgramme = {
    format: "p6-xer-v1",
    source: {
      fileName: "Synthetic working source.xer",
      sha256: "c".repeat(64),
      encoding: "utf-8",
      header: "Synthetic API source",
    },
    tables: {
      TASK: {
        fields: [
          "task_id",
          "task_code",
          "task_name",
          "target_drtn_hr_cnt",
          "early_start_date",
          "early_end_date",
        ],
        rows: [
          ["1", "ONE", "One", "15", "2026-11-14 08:00", "2026-11-15 17:00"],
          ["2", "TWO", "Two", "15", "2026-11-16 08:00", "2026-11-17 17:00"],
        ],
        lines: [2, 3],
      },
      TASKPRED: {
        fields: ["pred_task_id", "task_id", "pred_type", "lag_hr_cnt"],
        rows: [["1", "2", "PR_SS", "-2.5"]],
        lines: [5],
      },
    },
  };
  const sourceUpload = (
    cookie: string,
    preview: boolean,
    version: number,
    targetProjectId = project.id,
  ) =>
    fetch(
      `${base}/api/projects/${targetProjectId}/programme-source?${new URLSearchParams({ version: String(version), reason, preview: String(preview) })}`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: base,
          "Content-Type": "application/gzip",
        },
        body: gzipSync(JSON.stringify(source)),
      },
    );
  // Seeded demo users share the available projects. Unknown-project HTTP
  // coverage exercises the former version-0 preview fallback; PostgreSQL tests
  // separately cover membership revocation on an existing project.
  const unknownProjectId = `unassigned-${unique}`;
  await decoded(await sourceUpload(supervisor, true, 0, unknownProjectId), 404);
  await decoded(
    await sourceUpload(supervisor, false, 0, unknownProjectId),
    404,
  );
  const beforeSourceVersion = (await state()).version;
  await decoded(await sourceUpload(supervisor, true, beforeSourceVersion));
  await decoded(
    await sourceUpload(supervisor, false, beforeSourceVersion),
    403,
  );
  assert.equal(
    (await state()).version,
    beforeSourceVersion,
    "Read-only and rejected source previews cannot change the project",
  );
  assert.equal((await state()).sourceProgrammeSummary, undefined);
  await decoded(await sourceUpload(admin, false, beforeSourceVersion));
  const endpoint = `/api/projects/${project.id}/schedule-working`,
    draft = {
      kind: "edit-activity",
      sourceSha256: source.source.sha256,
      idempotencyKey: randomUUID(),
      reason,
      internalId: "1",
      finish: "2026-11-16",
    };
  const prepare = async (cookie: string, data: unknown) =>
    decoded<{
      token: string;
      canConfirm: boolean;
      proposal: { errors: string[]; impactedCount: number };
    }>(await request(endpoint, cookie, "POST", { draft: data }));
  const preview = await prepare(manager, draft);
  assert.equal(preview.canConfirm, true);
  assert.equal(preview.proposal.impactedCount, 2);
  assert.deepEqual(preview.proposal.errors, []);
  const cross = await request(endpoint, admin, "PATCH", {
    token: preview.token,
    confirmed: true,
  });
  assert.equal(
    cross.status,
    400,
    "Another authenticated session cannot confirm this signature",
  );
  await decoded(
    await request(endpoint, manager, "PATCH", {
      token: preview.token,
      confirmed: true,
    }),
  );
  const replay = await decoded<{ updated: boolean; replay: boolean }>(
    await request(endpoint, manager, "PATCH", {
      token: preview.token,
      confirmed: true,
    }),
  );
  assert.equal(replay.replay, true);
  assert.equal(replay.updated, false);
  const original = await decoded<SourceProgrammePage>(
      await request(endpoint + "?view=source&internalId=1", admin),
    ),
    working = await decoded<SourceProgrammePage>(
      await request(endpoint + "?internalId=1", admin),
    );
  assert.equal(original.detail?.activity.finish, "2026-11-15");
  assert.equal(working.detail?.activity.finish, "2026-11-16");
  assert.equal(working.detail?.relationships[0].lagHours, "-2.5");
  const supervisorPreview = await prepare(supervisor, {
    ...draft,
    idempotencyKey: randomUUID(),
    finish: "2026-11-18",
  });
  assert.equal(supervisorPreview.canConfirm, false);
  await decoded(
    await request(endpoint, supervisor, "PATCH", {
      token: supervisorPreview.token,
      confirmed: true,
    }),
    403,
  );
  const mappingPreview = await prepare(manager, {
    kind: "edit-activity",
    sourceSha256: source.source.sha256,
    idempotencyKey: randomUUID(),
    reason,
    internalId: "2",
    assetIds: [sourceAssetId],
  });
  await decoded(
    await request(endpoint, manager, "PATCH", {
      token: mappingPreview.token,
      confirmed: true,
    }),
  );
  assert.deepEqual(
    (await state()).workingSchedule?.activityPatches.find(
      (patch) => patch.internalId === "2",
    )?.assetIds,
    [sourceAssetId],
  );
  const stale = await prepare(manager, {
    ...draft,
    idempotencyKey: randomUUID(),
    finish: "2026-11-18",
  });
  const createdPreview = await prepare(manager, {
    kind: "create-asset-activity",
    sourceSha256: source.source.sha256,
    idempotencyKey: randomUUID(),
    reason,
    assetId: sourceAssetId,
    title: "Synthetic deadline-only inspection",
    deadline: "2026-12-10",
  });
  const created = await decoded<{
    activityId: string;
    internalId: string;
    taskId: string;
  }>(
    await request(endpoint, manager, "PATCH", {
      token: createdPreview.token,
      confirmed: true,
    }),
  );
  await decoded(
    await request(endpoint, manager, "PATCH", {
      token: createdPreview.token,
      confirmed: true,
    }),
  );
  await decoded(
    await request(endpoint, manager, "PATCH", {
      token: stale.token,
      confirmed: true,
    }),
    409,
  );
  const final = await decoded<Bootstrap>(
      await request("/api/bootstrap", admin),
    ),
    tasks = final.tasks.filter((t) => t.id === created.taskId);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].assignedTo, undefined);
  assert.equal(tasks[0].cx?.activityId, created.activityId);
  assert.equal(tasks[0].cx?.assetId, sourceAssetId);
  assert.equal(tasks[0].dueDate, "2026-12-10");
  const current = await decoded<SourceProgrammePage>(
    await request(
      endpoint + `?internalId=${encodeURIComponent(created.internalId)}`,
      manager,
    ),
  );
  assert.equal(current.activities.length, 3);
  assert.equal(current.detail?.activity.start, undefined);
  assert.equal(current.detail?.activity.durationHours, "");
  assert.equal(current.detail?.activity.finish, "2026-12-10");
  const receiptState = await state();
  assert.equal(
    receiptState.schedule.filter((r) => r.activityId === created.activityId)
      .length,
    1,
  );
  await decoded(
    await request(
      `/api/projects/${managedProject.id}/commissioning`,
      admin,
      "PATCH",
      {
        action: "import",
        version: (await state(managedProject.id)).version,
        reason,
        data: {
          assets: [
            {
              id: managedAssetId,
              name: "Managed pump",
              equipmentType: "Pump",
              location: "",
              levels: [],
            },
          ],
          schedule: [],
        },
      },
    ),
  );
  const managedEndpoint = `/api/projects/${managedProject.id}/schedule-working`;
  const managedDraft = {
    kind: "create-asset-activity",
    sourceSha256: "managed",
    idempotencyKey: randomUUID(),
    reason,
    assetId: managedAssetId,
    title: "Managed deadline-only inspection",
    deadline: "2026-12-15",
  };
  const managedPreview = await decoded<{ token: string }>(
    await request(managedEndpoint, admin, "POST", { draft: managedDraft }),
  );
  const managedCreated = await decoded<{
    internalId: string;
    activityId: string;
    taskId: string;
  }>(
    await request(managedEndpoint, admin, "PATCH", {
      token: managedPreview.token,
      confirmed: true,
    }),
  );
  await decoded(
    await request(managedEndpoint, admin, "PATCH", {
      token: managedPreview.token,
      confirmed: true,
    }),
  );
  const managedView = await decoded<SourceProgrammePage>(
    await request(managedEndpoint, admin),
  );
  assert.equal(
    managedView.activities.length,
    originalManaged.schedule.length + 1,
    "Managed mirrors are not duplicated in the working projection",
  );
  assert.equal(
    managedView.activities.find(
      (row) => row.activityId === managedCreated.activityId,
    )?.finish,
    "2026-12-15",
  );
  assert.equal(
    managedView.activities.find(
      (row) => row.activityId === managedCreated.activityId,
    )?.start,
    undefined,
  );
  const managedEdit = await decoded<{
    token: string;
    proposal: { errors: string[] };
  }>(
    await request(managedEndpoint, admin, "POST", {
      draft: {
        kind: "edit-activity",
        sourceSha256: "managed",
        idempotencyKey: randomUUID(),
        reason,
        internalId: managedCreated.internalId,
        finish: "2026-12-16",
      },
    }),
  );
  assert.deepEqual(managedEdit.proposal.errors, []);
  await decoded(
    await request(managedEndpoint, admin, "PATCH", {
      token: managedEdit.token,
      confirmed: true,
    }),
  );
  const managedFinal = await decoded<Bootstrap>(
    await request("/api/bootstrap", admin),
  );
  assert.equal(
    commissioning(
      managedFinal.projects.find((p) => p.id === managedProject.id),
    ).schedule.find((row) => row.activityId === managedCreated.activityId)
      ?.finish,
    "2026-12-16",
  );
  const finalRich = commissioning(
    managedFinal.projects.find((row) => row.id === project.id),
  );
  const finalManaged = commissioning(
    managedFinal.projects.find((row) => row.id === managedProject.id),
  );
  assert.deepEqual(
    finalRich.assets.filter((asset) =>
      originalRich.assets.some((old) => old.id === asset.id),
    ),
    originalRich.assets,
    "All original rich assets remain unchanged",
  );
  assert.deepEqual(
    finalManaged.assets.filter((asset) =>
      originalManaged.assets.some((old) => old.id === asset.id),
    ),
    originalManaged.assets,
    "All original managed assets remain unchanged",
  );
  assert.deepEqual(
    managedFinal.tasks.filter((t) =>
      initial.tasks.some((old) => old.id === t.id),
    ),
    initial.tasks,
    "Pre-existing tasks are unchanged",
  );
});
