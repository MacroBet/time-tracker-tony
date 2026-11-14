import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Bootstrap } from "../src/lib/domain";
import { commissioning } from "../src/lib/commissioning";
import { duplicateAssetDraft } from "../src/lib/asset-register-mutations";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3107";
const reason =
  "Verify scoped register configuration in isolated synthetic demo";
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
async function decoded<T>(response: Response, status = 200): Promise<T> {
  const body = await response.text();
  assert.equal(response.status, status, body);
  return JSON.parse(body) as T;
}
async function login(userId: string) {
  const response = await request("/api/auth/login", "", "POST", { userId });
  await decoded(response);
  const cookie = response.headers.get("set-cookie");
  assert(cookie);
  return cookie.split(";")[0];
}
test("register APIs preview, authorize, compare versions and retry clone without duplicating identities", async () => {
  assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname));
  const mode = await decoded<{ mode: string }>(
    await request("/api/auth/session"),
  );
  assert.equal(
    mode.mode,
    "demo",
    "Never mutate a remote or database environment.",
  );
  const admin = await login("u-admin"),
    worker = await login("u1");
  const load = async () =>
    decoded<Bootstrap>(await request("/api/bootstrap", admin));
  const initial = await load();
  const project = initial.projects.find((row) => row.id === "p-demo-rich");
  assert(project);
  const original = commissioning(project),
    initialAssets = structuredClone(original.assets),
    initialTasks = structuredClone(initial.tasks);
  const endpoint = `/api/projects/${project.id}/commissioning`;
  const current = async () => {
    const data = await load(),
      found = data.projects.find((row) => row.id === project.id);
    assert(found);
    return commissioning(found);
  };
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
  const suffix = randomUUID(),
    sourceId = `synthetic-register-source-${suffix}`,
    cloneId = `synthetic-register-clone-${suffix}`;
  const source = {
    id: sourceId,
    name: "Synthetic register source",
    equipmentType: "Synthetic pump",
    location: "Local test only",
    levels: [],
  };
  const inserted: string[] = [];
  try {
    await decoded(
      await mutate(
        "import",
        { assets: [source], schedule: [] },
        original.version,
      ),
    );
    inserted.push(sourceId);
    let before = await current();
    const level = before.config.levels[0];
    assert(level);
    const command = { updates: [{ assetId: sourceId, levels: [level] }] };
    const preview = await decoded<{
      errors: string[];
      changes: string[];
      version: number;
    }>(await mutate("asset-tags", command, before.version, true));
    assert.deepEqual(preview.errors, []);
    assert.equal(preview.changes.length, 1);
    assert.deepEqual(
      (await current()).assets,
      before.assets,
      "Preview cannot write",
    );
    await decoded(
      await mutate("asset-tags", command, before.version, false, worker),
      403,
    );
    await decoded(
      await mutate(
        "asset-delete",
        { assetId: sourceId },
        before.version,
        false,
        worker,
      ),
      403,
    );
    await decoded(await mutate("asset-tags", command, before.version));
    await decoded(await mutate("asset-tags", command, before.version), 409);
    before = await current();
    assert.deepEqual(
      before.assets.find((asset) => asset.id === sourceId)?.levels,
      [level],
    );
    const clone = {
      ...duplicateAssetDraft(
        before.assets.find((asset) => asset.id === sourceId)!,
      ),
      id: cloneId,
    };
    const clonePayload = { assets: [clone], schedule: [] };
    await decoded(await mutate("import", clonePayload, before.version));
    inserted.push(cloneId);
    await decoded(await mutate("import", clonePayload, before.version), 409);
    const afterClone = await current();
    const repeat = await decoded<{ updated: boolean }>(
      await mutate("import", clonePayload, afterClone.version),
    );
    assert.equal(repeat.updated, false);
    assert.equal(
      (await current()).assets.filter((asset) => asset.id === cloneId).length,
      1,
    );
    const linkedAsset = initialAssets.find((asset) =>
      initialTasks.some(
        (task) =>
          task.projectId === project.id && task.cx?.assetId === asset.id,
      ),
    );
    assert(
      linkedAsset,
      "Existing synthetic fixture provides a referenced asset",
    );
    const blocked = await decoded<{ errors: string[]; references: string[] }>(
      await mutate(
        "asset-delete",
        { assetId: linkedAsset.id },
        afterClone.version,
        true,
      ),
    );
    assert(blocked.errors.length > 0);
    assert(blocked.references.length > 0);
    await decoded(
      await mutate(
        "asset-delete",
        { assetId: linkedAsset.id },
        afterClone.version,
      ),
      409,
    );
    const missing = await decoded<{ errors: string[] }>(
      await mutate(
        "asset-tags",
        { updates: [{ assetId: "foreign-or-missing", levels: [] }] },
        afterClone.version,
        true,
      ),
    );
    assert(missing.errors.length > 0);
    await decoded(
      await mutate(
        "asset-tags",
        { updates: [{ assetId: sourceId, levels: [], result: "passed" }] },
        afterClone.version,
      ),
      400,
    );
  } finally {
    for (const assetId of inserted.reverse()) {
      const state = await current();
      await decoded(await mutate("asset-delete", { assetId }, state.version));
    }
  }
  const final = await load(),
    finalState = commissioning(
      final.projects.find((row) => row.id === project.id),
    );
  assert.deepEqual(
    finalState.assets,
    initialAssets,
    "All original assets remain byte-equivalent after cleanup",
  );
  assert.deepEqual(finalState.schedule, original.schedule);
  assert.deepEqual(
    final.tasks,
    initialTasks,
    "Tasks, results and assignments remain untouched",
  );
});
