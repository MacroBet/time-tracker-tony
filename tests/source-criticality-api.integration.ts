import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import type { Bootstrap } from "../src/lib/domain";
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
async function json<T>(response: Response, status = 200): Promise<T> {
  const value = await response.json();
  assert.equal(response.status, status, JSON.stringify(value));
  return value;
}
async function session(id: string) {
  const response = await request("/api/auth/login", "", "POST", { userId: id });
  await json(response);
  return response.headers.get("set-cookie")!.split(";")[0];
}
test("P6 criticality API preserves source criterion, filters the complete population, validates inputs and marks source-derived floats stale after a confirmed local working edit", async () => {
  assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
  assert.equal(
    (await json<{ mode: string }>(await request("/api/auth/session"))).mode,
    "demo",
    "Local memory fixture only; no remote DB or AI.",
  );
  const admin = await session("u-admin"),
    data = await json<Bootstrap>(await request("/api/bootstrap", admin));
  const project = await json<{ id: string }>(
    await request("/api/projects", admin, "POST", {
      name: "A8 local criticality test",
      location: "Synthetic only",
      companyId: data.currentUser.companyId,
      requestId: randomUUID(),
    }),
    201,
  );
  const endpoint = `/api/projects/${project.id}/programme-source`;
  const sha = "d".repeat(64),
    source = {
      format: "p6-xer-v1",
      source: {
        fileName: "a8-synthetic.xer",
        sha256: sha,
        encoding: "utf-8",
        header: "Synthetic local API fixture",
      },
      tables: {
        PROJECT: {
          fields: [
            "proj_id",
            "critical_path_type",
            "critical_drtn_hr_cnt",
            "last_recalc_date",
          ],
          rows: [["p6", "CT_TotFloat", "0", "2026-09-13 00:00"]],
          lines: [2],
        },
        TASK: {
          fields: [
            "task_id",
            "task_code",
            "task_name",
            "proj_id",
            "total_float_hr_cnt",
            "free_float_hr_cnt",
            "status_code",
            "restart_date",
            "reend_date",
          ],
          rows: Array.from({ length: 61 }, (_, i) => [
            `id-${i}`,
            `A-${i}`,
            i === 59 ? "Chiller test" : "Other activity",
            "p6",
            i === 59 ? "0" : i === 60 ? "2" : "",
            "0",
            i < 59 ? "TK_Complete" : "TK_NotStart",
            "2026-11-16",
            "2026-11-18",
          ]),
          lines: Array.from({ length: 61 }, (_, i) => i + 10),
        },
      },
    };
  const before = JSON.stringify(source);
  const upload = await fetch(
    `${base}${endpoint}?version=0&preview=false&reason=${encodeURIComponent("Validate isolated saved P6 criticality")}`,
    {
      method: "POST",
      headers: {
        Cookie: admin,
        Origin: base,
        "Content-Type": "application/gzip",
      },
      body: gzipSync(before),
    },
  );
  await json(upload);
  assert.equal((await request(endpoint)).status, 401);
  assert.equal((await request(endpoint, await session("u1"))).status, 403);
  assert.equal((await request(endpoint, await session("u3"))).status, 404);
  const full = await json<SourceProgrammePage>(await request(endpoint, admin));
  assert.deepEqual(full.criticality?.coverage, {
    total: 61,
    critical: 1,
    nonCritical: 1,
    unknown: 59,
  });
  assert.equal(full.criticality?.criteria[0].thresholdHours, 0);
  assert.equal(full.criticality?.workingStale, false);
  const critical = await json<SourceProgrammePage>(
    await request(endpoint + "?critical=yes", admin),
  );
  assert.equal(critical.total, 1);
  assert.equal(critical.activities[0].internalId, "id-59");
  assert.equal(
    (
      await json<SourceProgrammePage>(
        await request(endpoint + "?critical=no", admin),
      )
    ).total,
    1,
  );
  assert.equal(
    (
      await json<SourceProgrammePage>(
        await request(endpoint + "?critical=unknown", admin),
      )
    ).total,
    59,
  );
  assert.equal(
    (
      await json<SourceProgrammePage>(
        await request(endpoint + "?critical=yes&q=chiller", admin),
      )
    ).total,
    1,
  );
  assert.equal(
    (
      await json<SourceProgrammePage>(
        await request(endpoint + "?critical=no&q=chiller", admin),
      )
    ).total,
    0,
  );
  assert.equal(
    (
      await json<SourceProgrammePage>(
        await request(endpoint + "?critical=yes&q=id-59", admin),
      )
    ).total,
    1,
  );
  assert.equal(
    (await request(endpoint + "?critical=invalid", admin)).status,
    400,
  );
  const working = `/api/projects/${project.id}/schedule-working`;
  const assertWorkingFilters = async () => {
    for (const view of ["working", "source"]) {
      for (const [filter, total] of [
        ["yes", 1],
        ["no", 1],
        ["unknown", 59],
      ] as const) {
        const page = await json<SourceProgrammePage>(
          await request(`${working}?view=${view}&critical=${filter}`, admin),
        );
        assert.equal(
          page.total,
          total,
          `The UI's schedule-working endpoint must apply ${view} critical=${filter}`,
        );
        assert.equal(page.criticality?.filteredCoverage.total, total);
        assert(
          page.activities.every(
            (row) =>
              row.criticality?.state ===
              (filter === "yes"
                ? "critical"
                : filter === "no"
                  ? "non-critical"
                  : "unknown"),
          ),
        );
      }
      const selected = await json<SourceProgrammePage>(
        await request(
          `${working}?view=${view}&critical=yes&q=chiller&page=999`,
          admin,
        ),
      );
      assert.equal(selected.total, 1);
      assert.equal(selected.page, 0);
      assert.equal(selected.activities[0].internalId, "id-59");
      const paged = await json<SourceProgrammePage>(
        await request(
          `${working}?view=${view}&critical=unknown&q=Other&page=1`,
          admin,
        ),
      );
      assert.equal(paged.total, 59);
      assert.equal(paged.page, 1);
      assert.equal(paged.activities.length, 9);
      assert.equal(
        (await request(`${working}?view=${view}&critical=invalid`, admin))
          .status,
        400,
      );
    }
  };
  await assertWorkingFilters();
  const preview = await json<{ token: string; canConfirm: boolean }>(
    await request(working, admin, "POST", {
      draft: {
        kind: "edit-activity",
        sourceSha256: sha,
        idempotencyKey: randomUUID(),
        reason:
          "Validate source criticality remains original after local working edit",
        internalId: "id-59",
        finish: "2026-12-01",
      },
    }),
  );
  assert.equal(preview.canConfirm, true);
  await json(
    await request(working, admin, "PATCH", {
      token: preview.token,
      confirmed: true,
    }),
  );
  const changed = await json<SourceProgrammePage>(
    await request(endpoint + "?critical=yes", admin),
  );
  assert.equal(changed.activities[0].finish, "2026-12-01");
  assert.equal(changed.activities[0].criticality?.totalFloatHours, 0);
  assert.equal(changed.criticality?.workingStale, true);
  assert.equal(changed.criticality?.workingRevision, 1);
  assert.equal(changed.criticality?.sourceSha256, sha);
  await assertWorkingFilters();
  const workingView = await json<SourceProgrammePage>(
    await request(`${working}?critical=yes`, admin),
  );
  const sourceView = await json<SourceProgrammePage>(
    await request(`${working}?view=source&critical=yes`, admin),
  );
  assert.equal(workingView.criticality?.workingStale, true);
  assert.equal(sourceView.criticality?.workingStale, false);
  assert.equal(workingView.activities[0].finish, "2026-12-01");
  assert.equal(sourceView.activities[0].finish, "2026-11-18");
  const original = await json<SourceProgrammePage>(
    await request(endpoint + "?view=source&critical=yes", admin),
  );
  assert.equal(original.activities[0].finish, "2026-11-18");
  assert.equal(original.criticality?.workingStale, false);
  assert.deepEqual(
    original.activities[0].criticality,
    changed.activities[0].criticality,
  );
  assert.equal(JSON.stringify(source), before);
});
