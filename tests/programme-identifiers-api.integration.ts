import test from "node:test";
import assert from "node:assert/strict";
import { parseAssetCsv } from "../src/lib/asset-transfer";
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
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function session(userId: string) {
  const response = await request("/api/auth/login", "", "POST", { userId });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie")!.split(";")[0];
}
test("programme and asset references preview, persist, export and reimport without renaming activity IDs", async () => {
  assert.equal(
    (await (await request("/api/auth/session")).json()).mode,
    "demo",
    "Only run on an isolated local demo server.",
  );
  const manager = await session("u4"),
    worker = await session("u1");
  const read = async () =>
    await (await request("/api/bootstrap", manager)).json();
  const initial = await read();
  const original = initial.projects.find(
    (project: { id: string }) => project.id === "p1",
  ).commissioning;
  const endpoint = "/api/projects/p1/commissioning";
  const importData = (
    data: unknown,
    version: number,
    preview = false,
    cookie = manager,
  ) =>
    request(endpoint, cookie, "PATCH", {
      action: "import",
      data,
      version,
      preview,
      reason:
        "Verify separate programme and asset references without changing stable links",
    });
  const programmeId = `MASTER-${Date.now()}`;
  const metadata = { programmeId };
  assert.equal(
    (await importData(metadata, original.version, false, worker)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/projects/not-assigned/commissioning",
        manager,
        "PATCH",
        {
          action: "import",
          version: 0,
          reason: "Attempt outside assigned project",
          data: metadata,
        },
      )
    ).status,
    404,
  );
  const preview = await importData(metadata, original.version, true);
  assert.equal(preview.status, 200);
  const previewData = await preview.json();
  assert.equal(previewData.programmeId, programmeId);
  assert.equal(previewData.errors.length, 0);
  assert.equal(previewData.changes.length, 1);
  const untouched = (await read()).projects.find(
    (project: { id: string }) => project.id === "p1",
  ).commissioning;
  assert.deepEqual(
    untouched,
    original,
    "Programme ID preview cannot mutate project records.",
  );
  const activityId = original.schedule[0].activityId;
  const asset = {
    id: `TEST-REFERENCE-${Date.now()}`,
    name: "Reference metadata test asset",
    equipmentType: "Test pump",
    levels: [],
    clientAssetId: "CLIENT-ASSET-001",
    programmeActivityId: activityId,
  };
  const applied = await importData(
    { programmeId, assets: [asset] },
    original.version,
  );
  assert.equal(applied.status, 200, await applied.text());
  let current = (await read()).projects.find(
    (project: { id: string }) => project.id === "p1",
  ).commissioning;
  assert.equal(current.version, original.version + 1);
  assert.equal(current.programmeId, programmeId);
  assert.deepEqual(
    current.schedule,
    original.schedule,
    "Metadata must preserve exact activity IDs, dates, links and baselines.",
  );
  assert.equal(
    current.assets.find((record: { id: string }) => record.id === asset.id)
      .clientAssetId,
    asset.clientAssetId,
  );
  assert.equal(
    current.assets.find((record: { id: string }) => record.id === asset.id)
      .programmeActivityId,
    activityId,
  );
  assert.equal(current.revisions.at(-1).action, "upload");
  assert(
    current.revisions
      .at(-1)
      .changes.some((change: string) => change.includes("Programme ID")),
  );
  assert.equal((await importData(metadata, original.version)).status, 409);
  const repeated = await importData(
    { programmeId, assets: [asset] },
    current.version,
  );
  assert.equal(repeated.status, 200);
  assert.equal(
    (await repeated.json()).updated,
    false,
    "Identical metadata reimports are idempotent.",
  );
  const legacy = {
    id: asset.id,
    name: asset.name,
    equipmentType: asset.equipmentType,
    levels: [],
  };
  assert.equal(
    (await importData({ assets: [legacy] }, current.version)).status,
    200,
  );
  current = (await read()).projects.find(
    (project: { id: string }) => project.id === "p1",
  ).commissioning;
  assert.equal(current.programmeId, programmeId);
  assert.equal(
    current.assets.find((record: { id: string }) => record.id === asset.id)
      .clientAssetId,
    asset.clientAssetId,
  );
  assert.equal(
    current.assets.find((record: { id: string }) => record.id === asset.id)
      .programmeActivityId,
    activityId,
  );
  const snapshot = structuredClone(current);
  assert.equal(
    (
      await importData(
        {
          assets: [
            { ...asset, programmeActivityId: "UNKNOWN-PROGRAMME-ACTIVITY" },
          ],
        },
        current.version,
      )
    ).status,
    400,
  );
  const foreign = initial.projects
    .flatMap(
      (project: {
        id: string;
        commissioning?: { schedule: { activityId: string }[] };
      }) =>
        project.id === "p1" ? [] : (project.commissioning?.schedule ?? []),
    )
    .find(
      (row: { activityId: string }) =>
        !original.schedule.some(
          (own: { activityId: string }) => own.activityId === row.activityId,
        ),
    );
  assert(
    foreign,
    "Demo server must include another project with its own activity records.",
  );
  assert.equal(
    (
      await importData(
        { assets: [{ ...asset, programmeActivityId: foreign.activityId }] },
        current.version,
      )
    ).status,
    400,
    "An activity in another project is not a valid local asset reference.",
  );
  assert.deepEqual(
    (await read()).projects.find(
      (project: { id: string }) => project.id === "p1",
    ).commissioning,
    snapshot,
  );
  const exported = await request("/api/projects/p1/audit", manager, "POST", {
    action: "export",
    format: "json",
  });
  assert.equal(exported.status, 200);
  const json = await exported.json();
  assert.equal(json.programmeId, programmeId);
  assert.deepEqual(json.schedule, original.schedule);
  const csvResponse = await request("/api/projects/p1/audit", manager, "POST", {
    action: "export",
    format: "csv",
  });
  assert.equal(csvResponse.status, 200);
  const csv = parseAssetCsv(await csvResponse.text());
  assert.equal(csv.programmeId, programmeId);
  assert.equal(
    csv.assets.find((record) => record.id === asset.id)?.programmeActivityId,
    activityId,
  );
  assert.equal(
    csv.assets.find((record) => record.id === asset.id)?.clientAssetId,
    asset.clientAssetId,
  );
  assert.equal(
    (
      await importData(
        {
          programmeId: "",
          assets: [{ ...legacy, clientAssetId: "", programmeActivityId: "" }],
        },
        current.version,
      )
    ).status,
    200,
  );
  current = (await read()).projects.find(
    (project: { id: string }) => project.id === "p1",
  ).commissioning;
  assert.equal(current.programmeId, "");
  assert.equal(
    current.assets.find((record: { id: string }) => record.id === asset.id)
      .clientAssetId,
    "",
  );
  assert.equal(
    current.assets.find((record: { id: string }) => record.id === asset.id)
      .programmeActivityId,
    "",
  );
  assert.deepEqual(current.schedule, original.schedule);
  const final = await read();
  for (const task of initial.tasks.filter(
    (task: { projectId: string }) => task.projectId === "p1",
  )) {
    const after = final.tasks.find(
      (record: { id: string }) => record.id === task.id,
    );
    assert.deepEqual(
      after.cx,
      task.cx,
      "Existing task asset/activity/tag links are unchanged.",
    );
  }
});
