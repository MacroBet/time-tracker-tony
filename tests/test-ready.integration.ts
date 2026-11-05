import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { commissioning } from "../src/lib/commissioning";
import type { Bootstrap, Task } from "../src/lib/domain";
import type {
  SourceProgramme,
  SourceProgrammePage,
} from "../src/lib/programme-source";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3107";
const reason = "Verify synthetic test-ready delivery in isolated local demo";
const sha = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
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
async function decoded<T>(response: Response, expected = 200): Promise<T> {
  const text = await response.text();
  assert.equal(response.status, expected, text);
  return JSON.parse(text) as T;
}
async function login(userId: string) {
  const response = await request("/api/auth/login", "", "POST", { userId });
  assert.equal(response.status, 200, await response.text());
  const cookie = response.headers.get("set-cookie");
  assert(cookie);
  assert(cookie.includes("HttpOnly"));
  return cookie.split(";")[0];
}
async function bootstrap(cookie: string) {
  return decoded<Bootstrap>(await request("/api/bootstrap", cookie));
}

test("test-ready APIs preserve scoped inventory, source programme and unrelated assets through worker checksheet writes", async () => {
  assert(
    ["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname),
    "This test only permits a local loopback demo server.",
  );
  const mode = await decoded<{ mode: string }>(
    await request("/api/auth/session"),
  );
  assert.equal(
    mode.mode,
    "demo",
    "Never run these mutations against Neon or a production environment.",
  );
  const admin = await login("u-admin"),
    worker = await login("u1"),
    supervisor = await login("u3"),
    manager = await login("u4");
  const initial = await bootstrap(admin);
  assert.equal(initial.currentUser.role, "admin");
  const preservedTasks = structuredClone(initial.tasks);
  const preservedTaskIds = new Set(preservedTasks.map((task) => task.id));
  const suffix = randomUUID();
  const project = ["p-demo-empty", "p1"]
    .map((id) => initial.projects.find((candidate) => candidate.id === id))
    .find(
      (candidate) =>
        candidate &&
        ["u-admin", "u1", "u3", "u4"].every((userId) =>
          initial.memberships.some(
            (membership) =>
              membership.projectId === candidate.id &&
              membership.userId === userId,
          ),
        ),
    );
  assert(
    project,
    "Choose an existing isolated demo fixture with all four accounts; provisioning/access changes are intentionally disabled in demo.",
  );
  const state = async () => {
    const data = await bootstrap(admin),
      current = data.projects.find((p) => p.id === project.id);
    assert(current);
    return commissioning(current);
  };
  const endpoint = `/api/projects/${project.id}/commissioning`;
  const mutate = (
    action: string,
    data: unknown,
    version: number,
    preview = false,
    cookie = admin,
  ) =>
    request(endpoint, cookie, "PATCH", {
      action,
      data,
      version,
      preview,
      reason,
    });
  const inventory = [
    {
      id: `synthetic-a-${suffix}`,
      name: "Synthetic pump A",
      equipmentType: "Synthetic pumps",
      location: "Room A",
      phase: "FR1",
      levels: [],
    },
    {
      id: `synthetic-b-${suffix}`,
      name: "Synthetic pump B",
      equipmentType: "Synthetic pumps",
      location: "Room B",
      phase: "FR2",
      levels: [],
    },
  ];
  const batch = (batchId: string) => ({
    batchId,
    sourceSha256: sha("synthetic inventory source"),
    payloadSha256: sha({ assets: inventory, schedule: [] }),
    assets: inventory,
  });
  const firstBatch = `synthetic-first-${suffix}`,
    secondBatch = `synthetic-second-${suffix}`;
  const original = await state();
  const originalAssetCount = original.assets.length;
  const preview = await decoded<{ insertedCount: number; errors: string[] }>(
    await mutate("inventory-apply", batch(firstBatch), original.version, true),
  );
  assert.equal(preview.insertedCount, 2);
  assert.deepEqual(preview.errors, []);
  assert.deepEqual(
    await state(),
    original,
    "Inventory preview cannot mutate the project.",
  );
  assert.equal(
    (
      await mutate(
        "inventory-apply",
        batch(firstBatch),
        original.version,
        false,
        worker,
      )
    ).status,
    403,
  );
  await decoded(
    await mutate("inventory-apply", batch(firstBatch), original.version),
  );
  let current = await state();
  assert.equal(current.assets.length, originalAssetCount + 2);
  assert.deepEqual(current.schedule, original.schedule);
  const appliedVersion = current.version;
  const repeated = await decoded<{ updated: boolean; version: number }>(
    await mutate("inventory-apply", batch(firstBatch), current.version),
  );
  assert.equal(repeated.updated, false);
  assert.equal(repeated.version, appliedVersion);
  const collision = await decoded<{ errors: string[] }>(
    await mutate(
      "inventory-apply",
      batch(`collision-${suffix}`),
      current.version,
      true,
    ),
  );
  assert(collision.errors.some((error) => error.includes("already exist")));
  assert.equal(
    (
      await mutate(
        "inventory-apply",
        batch(`collision-${suffix}`),
        current.version,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await mutate(
        "inventory-restore",
        { batchId: firstBatch },
        original.version,
      )
    ).status,
    409,
  );
  const restorePreview = await decoded<{
    removedCount: number;
    errors: string[];
  }>(
    await mutate(
      "inventory-restore",
      { batchId: firstBatch },
      current.version,
      true,
    ),
  );
  assert.equal(restorePreview.removedCount, 2);
  assert.deepEqual(restorePreview.errors, []);
  assert.equal((await state()).assets.length, originalAssetCount + 2);
  await decoded(
    await mutate("inventory-restore", { batchId: firstBatch }, current.version),
  );
  current = await state();
  assert.equal(current.assets.length, originalAssetCount);
  assert.equal(
    current.inventoryBatches?.find((b) => b.id === firstBatch)?.status,
    "restored",
  );
  assert.equal(
    (
      await decoded<{ updated: boolean }>(
        await mutate(
          "inventory-restore",
          { batchId: firstBatch },
          current.version,
        ),
      )
    ).updated,
    false,
  );
  await decoded(
    await mutate("inventory-apply", batch(secondBatch), current.version),
  );
  current = await state();
  assert.equal(
    (
      await mutate(
        "inventory-restore",
        { batchId: firstBatch },
        current.version,
      )
    ).status,
    409,
    "A restored batch cannot delete IDs reused by another batch.",
  );
  await decoded(
    await mutate(
      "import",
      { assets: [{ ...inventory[0], name: "Synthetic changed pump" }] },
      current.version,
    ),
  );
  current = await state();
  assert.equal(
    (
      await mutate(
        "inventory-restore",
        { batchId: secondBatch },
        current.version,
      )
    ).status,
    409,
    "Restore must stop on changed manifest-owned content.",
  );
  await decoded(
    await mutate("import", { assets: [inventory[0]] }, current.version),
  );
  const task = await decoded<Task>(
    await request("/api/tasks", manager, "POST", {
      title: `Synthetic assigned delivery work ${suffix}`,
      description: "Synthetic scoped task for the local API fixture",
      projectId: project.id,
      assignedTo: "u1",
      discipline: "Mechanical",
      priority: "P1",
      location: "Room A",
      cx: { kind: "task", assetId: inventory[0].id, result: "untested" },
    }),
    201,
  );
  current = await state();
  assert.equal(
    (
      await mutate(
        "inventory-restore",
        { batchId: secondBatch },
        current.version,
      )
    ).status,
    409,
    "Restore cannot delete an asset referenced by an assigned task.",
  );
  const templateId = `synthetic-template-${suffix}`,
    sheetA = `synthetic-sheet-a-${suffix}`,
    sheetB = `synthetic-sheet-b-${suffix}`,
    slotId = `synthetic-slot-${suffix}`;
  const checksheetEndpoint = `/api/projects/${project.id}/checksheets`;
  const command = async (value: unknown, cookie = admin, version?: number) =>
    request(checksheetEndpoint, cookie, "PATCH", {
      version: version ?? (await state()).version,
      reason,
      command: value,
    });
  await decoded(
    await command({
      kind: "save-templates",
      templates: [
        {
          id: templateId,
          name: "Synthetic test requirements",
          revision: "1",
          requirements: [
            {
              id: "required-row",
              requirement: "Record the synthetic observation",
              required: true,
            },
            {
              id: "optional-row",
              requirement: "Optional observation",
              required: false,
            },
          ],
        },
      ],
    }),
  );
  await decoded(
    await command({
      kind: "associate",
      id: sheetA,
      assetId: inventory[0].id,
      templateId,
    }),
  );
  await decoded(
    await command({
      kind: "associate",
      id: sheetB,
      assetId: inventory[1].id,
      templateId,
    }),
  );
  await decoded(
    await command({
      kind: "configure-signatories",
      slots: [
        ...((await state()).checksheets?.signatorySlots ?? []),
        {
          id: slotId,
          label: "Synthetic QA review",
          userIds: ["u1"],
          roles: [],
        },
      ],
    }),
  );
  current = await state();
  assert(
    current.checksheets?.sheets
      .filter((sheet) => [sheetA, sheetB].includes(sheet.id))
      .every(
        (sheet) =>
          sheet.responses.length === 0 && sheet.signatures.length === 0,
      ),
  );
  const visible = await bootstrap(worker),
    workerProject = visible.projects.find((p) => p.id === project.id);
  assert(workerProject);
  assert.deepEqual(
    workerProject.commissioning?.assets
      .filter((asset) => inventory.some((row) => row.id === asset.id))
      .map((asset) => asset.id),
    [inventory[0].id],
  );
  assert.deepEqual(
    workerProject.commissioning?.checksheets?.sheets
      .filter((sheet) => [sheetA, sheetB].includes(sheet.id))
      .map((sheet) => sheet.id),
    [sheetA],
  );
  assert.equal(
    (await command({ kind: "sign", sheetId: sheetA, slotId }, worker)).status,
    400,
    "Required answers must precede signatures.",
  );
  assert.equal(
    (
      await command(
        {
          kind: "save-response",
          sheetId: sheetB,
          stepId: "required-row",
          answer: "Not my assignment",
        },
        worker,
      )
    ).status,
    400,
  );
  const staleVersion = (await state()).version;
  await decoded(
    await command(
      {
        kind: "save-response",
        sheetId: sheetA,
        stepId: "required-row",
        answer: "Observed in isolated demo",
        result: "failed",
      },
      worker,
    ),
  );
  current = await state();
  assert.equal(
    current.assets.length,
    originalAssetCount + 2,
    "A worker-scoped write must not replace the full register with the worker's subset.",
  );
  assert.equal(
    current.checksheets?.sheets.find((sheet) => sheet.id === sheetB)?.responses
      .length,
    0,
  );
  assert.equal(
    current.checksheets?.sheets.find((sheet) => sheet.id === sheetA)
      ?.responses[0].updatedBy,
    "u1",
  );
  assert.equal(
    (
      await command(
        {
          kind: "save-response",
          sheetId: sheetA,
          stepId: "required-row",
          answer: "Stale",
        },
        worker,
        staleVersion,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await command(
        { kind: "sign", sheetId: sheetA, slotId, userId: "u-admin" },
        worker,
      )
    ).status,
    400,
  );
  await decoded(
    await command({ kind: "sign", sheetId: sheetA, slotId }, worker),
  );
  current = await state();
  assert.equal(
    current.checksheets?.sheets.find((sheet) => sheet.id === sheetA)
      ?.signatures[0].userId,
    "u1",
  );
  await decoded(
    await command(
      {
        kind: "save-response",
        sheetId: sheetA,
        stepId: "required-row",
        answer: "Updated actual observation",
      },
      worker,
    ),
  );
  assert(
    (await state()).checksheets?.sheets.find((sheet) => sheet.id === sheetA)
      ?.signatures[0].invalidatedAt,
  );
  const workId = `synthetic-work-${suffix}`;
  assert.equal(
    (
      await command(
        {
          kind: "add-work",
          id: `unlinked-${suffix}`,
          title: "Not linked to assigned work",
        },
        worker,
      )
    ).status,
    400,
  );
  await decoded(
    await command(
      {
        kind: "add-work",
        id: workId,
        title: "Synthetic residual work",
        notes: "No task status or assignment changes",
        assetId: inventory[0].id,
        taskId: task.id,
      },
      worker,
    ),
  );
  await decoded(
    await command(
      { kind: "set-work-status", id: workId, status: "done" },
      worker,
    ),
  );
  current = await state();
  assert.equal(
    current.checksheets?.worksToGo.find((w) => w.id === workId)?.status,
    "done",
  );
  assert.equal(
    (await bootstrap(admin)).tasks.find((t) => t.id === task.id)?.status,
    "pending",
  );
  assert.equal(
    (
      await mutate(
        "inventory-restore",
        { batchId: secondBatch },
        current.version,
      )
    ).status,
    409,
    "Task/checksheet/work references prevent destructive restore.",
  );
  const previousSource = (await state()).sourceProgrammeSummary;
  assert(
    !previousSource ||
      previousSource.fileName === "Synthetic programme for API QA.xer",
    "Do not overwrite another source programme; use a clean isolated demo fixture.",
  );
  const programme: SourceProgramme = {
    format: "p6-xer-v1",
    source: {
      fileName: "Synthetic programme for API QA.xer",
      sha256:
        previousSource?.sha256 ?? sha("synthetic programme API fixture v1"),
      encoding: "windows-1252",
      header: "ERMHDR\tSynthetic local test source",
    },
    tables: {
      PROJECT: {
        fields: ["proj_id", "proj_short_name"],
        rows: [["synthetic-p6", "Synthetic LHR11 QA"]],
        lines: [3],
      },
      PROJWBS: {
        fields: [
          "wbs_id",
          "parent_wbs_id",
          "wbs_name",
          "wbs_short_name",
          "proj_node_flag",
        ],
        rows: [["root", "", "Synthetic programme", "SYN", "Y"]],
        lines: [6],
      },
      CALENDAR: {
        fields: ["clndr_id", "clndr_name", "clndr_data"],
        rows: [
          ["cal", "Synthetic source calendar", "Exact source calendar data"],
        ],
        lines: [9],
      },
      TASK: {
        fields: [
          "task_id",
          "task_code",
          "task_name",
          "task_type",
          "target_drtn_hr_cnt",
          "clndr_id",
          "wbs_id",
          "restart_date",
          "reend_date",
          "status_code",
        ],
        rows: [
          [
            "1",
            "SYN-001",
            "Synthetic start",
            "TT_Task",
            "16",
            "cal",
            "root",
            "2026-11-05 08:00",
            "2026-11-06 17:00",
            "TK_NotStart",
          ],
          [
            "2",
            "SYN-MILE",
            "Synthetic milestone",
            "TT_Mile",
            "0",
            "cal",
            "root",
            "2026-11-06 17:00",
            "2026-11-06 17:00",
            "TK_NotStart",
          ],
          [
            "3",
            "SYN-003",
            "Synthetic finish",
            "TT_Task",
            "8",
            "cal",
            "root",
            "2026-11-07 08:00",
            "2026-11-07 17:00",
            "TK_NotStart",
          ],
        ],
        lines: [12, 13, 14],
      },
      TASKPRED: {
        fields: ["task_id", "pred_task_id", "pred_type", "lag_hr_cnt"],
        rows: [
          ["2", "1", "PR_SS", "-4"],
          ["3", "2", "PR_FF", "0"],
          ["3", "1", "PR_FS1", "5"],
        ],
        lines: [17, 18, 19],
      },
    },
  };
  const sourceEndpoint = `/api/projects/${project.id}/programme-source`;
  const upload = async (
    preview: boolean,
    cookie = admin,
    version?: number,
    value: SourceProgramme = programme,
    contentType = "application/gzip",
  ) => {
    const query = new URLSearchParams({
      version: String(version ?? (await state()).version),
      reason,
      preview: String(preview),
    });
    return fetch(base + sourceEndpoint + "?" + query, {
      method: "POST",
      headers: { Cookie: cookie, Origin: base, "Content-Type": contentType },
      body: new Uint8Array(gzipSync(JSON.stringify(value))),
    });
  };
  assert.equal((await upload(true, worker)).status, 403);
  assert.equal(
    (await upload(true, admin, undefined, programme, "application/json"))
      .status,
    415,
  );
  const beforeSource = await state();
  const sourcePreview = await decoded<{
    summary: { activities: number; relationships: number };
    changes: string[];
  }>(await upload(true));
  assert.equal(sourcePreview.summary.activities, 3);
  assert.equal(sourcePreview.summary.relationships, 3);
  assert.equal((await state()).version, beforeSource.version);
  await decoded(await upload(false));
  current = await state();
  assert.equal(
    current.sourceProgramme,
    undefined,
    "Full source tables are not included in bootstrap.",
  );
  assert.equal(current.sourceProgrammeSummary?.activities, 3);
  const adminBootstrap = await bootstrap(admin);
  assert(
    !JSON.stringify(adminBootstrap).includes('"tables"'),
    "Bootstrap must not include complete source tables.",
  );
  const page = await decoded<SourceProgrammePage>(
    await request(sourceEndpoint, manager),
  );
  assert.equal(page.total, 3);
  assert.equal(page.activities.length, 3);
  assert.equal(page.summary.recalculation, "source-dates-only");
  assert.equal(
    page.activities.find((a) => a.activityId === "SYN-MILE")?.milestone,
    true,
  );
  const detail = await decoded<SourceProgrammePage>(
    await request(sourceEndpoint + "?internalId=3", supervisor),
  );
  assert(
    detail.detail?.relationships.some(
      (link) => link.type === "PR_FS1" && link.lagHours === "5",
    ),
  );
  const ssDetail = await decoded<SourceProgrammePage>(
    await request(sourceEndpoint + "?internalId=2", admin),
  );
  assert(
    ssDetail.detail?.relationships.some(
      (link) => link.type === "PR_SS" && link.lagHours === "-4",
    ),
  );
  assert.equal((await request(sourceEndpoint, worker)).status, 403);
  assert.equal(
    (
      await decoded<SourceProgrammePage>(
        await request(sourceEndpoint + "?q=SYN-MILE", manager),
      )
    ).total,
    1,
  );
  assert.equal(
    (await decoded<{ updated: boolean }>(await upload(false))).updated,
    false,
  );
  assert.equal(
    (await upload(false, admin, (await state()).version - 1)).status,
    409,
  );
  const changed = {
    ...programme,
    source: {
      ...programme.source,
      sha256: sha("different synthetic programme"),
    },
  };
  assert.equal(
    (await upload(false, admin, undefined, changed)).status,
    409,
    "A different source must not overwrite the saved programme.",
  );
  await decoded(
    await command({
      kind: "add-work",
      id: `after-source-${suffix}`,
      title: "Synthetic work after programme import",
    }),
  );
  assert.equal(
    (await decoded<SourceProgrammePage>(await request(sourceEndpoint, admin)))
      .summary.activities,
    3,
    "Subsequent commissioning writes must preserve the stored source programme.",
  );
  assert.deepEqual(
    (await bootstrap(admin)).tasks.filter((task) =>
      preservedTaskIds.has(task.id),
    ),
    preservedTasks,
    "Existing fixture tasks remain unchanged; only the uniquely named synthetic task was added.",
  );
});
