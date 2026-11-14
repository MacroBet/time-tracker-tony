import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { commissioning } from "../src/lib/commissioning";
import { projectDate, type Bootstrap } from "../src/lib/domain";
import type { ProjectReportResult } from "../src/lib/project-reports";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3107";
const reason = "Validate shared reporting using isolated synthetic local data";
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
  const text = await response.text();
  assert.equal(response.status, status, text);
  return JSON.parse(text);
}
async function login(userId: string) {
  const response = await request("/api/auth/login", "", "POST", { userId });
  await json(response);
  const cookie = response.headers.get("set-cookie");
  assert(cookie);
  return cookie.split(";")[0];
}
test("shared reports reconcile suppliers, steps, WTG, a full 14-day window and full CSV with fresh permissions", async () => {
  assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname));
  assert.equal(
    (await json<{ mode: string }>(await request("/api/auth/session"))).mode,
    "demo",
  );
  const admin = await login("u-admin"),
    initial = await json<Bootstrap>(await request("/api/bootstrap", admin));
  const project = initial.projects.find((row) => row.id === "p1");
  assert(
    project,
    "Use the existing p1 demo project; provisioning remains disabled.",
  );
  assert.equal(initial.currentUser.role, "admin");
  const original = structuredClone(commissioning(project));
  const prefix = `RPT-${randomUUID()}`;
  const state = async () =>
    commissioning(
      (
        await json<Bootstrap>(await request("/api/bootstrap", admin))
      ).projects.find((row) => row.id === project.id),
    );
  const endpoint = `/api/projects/${project.id}/reports`,
    register = `/api/projects/${project.id}/commissioning`;
  const reportUrl = (parameters: Record<string, string | number> = {}) => {
    const params = new URLSearchParams({ query: prefix });
    for (const [key, value] of Object.entries(parameters))
      params.set(key, String(value));
    return `${endpoint}?${params}`;
  };
  assert.equal((await request(endpoint)).status, 401);
  let configured = false;
  try {
    await json(
      await request(register, admin, "PATCH", {
        action: "configure",
        version: (await state()).version,
        reason,
        config: {
          ...original.config,
          levels: [...new Set([...original.config.levels, "L3"])],
        },
      }),
    );
    configured = true;
    const today = projectDate(),
      through = new Date(`${today}T12:00:00Z`);
    through.setUTCDate(through.getUTCDate() + 3);
    const assets = Array.from({ length: 61 }, (_, i) => ({
      id: `${prefix}-A-${i}`,
      name: `${prefix} pump ${i}`,
      equipmentType: "Pump",
      location: "Plant",
      levels: ["L3"],
      vendor: i % 2 ? "Other" : "XYZ",
      discipline: "Mechanical",
      programmeActivityId: `${prefix}-S1`,
    }));
    await json(
      await request(register, admin, "PATCH", {
        action: "import",
        version: (await state()).version,
        reason,
        data: {
          assets,
          schedule: [
            {
              activityId: `${prefix}-S1`,
              name: `${prefix} commissioning`,
              start: today,
              finish: through.toISOString().slice(0, 10),
            },
          ],
        },
      }),
    );
    const command = async (command: unknown) =>
      json(
        await request(
          `/api/projects/${project.id}/checksheets`,
          admin,
          "PATCH",
          {
            version: (await state()).version,
            reason,
            command,
          },
        ),
      );
    await command({
      kind: "save-templates",
      templates: [
        {
          id: `${prefix}-template`,
          name: `${prefix} steps`,
          revision: "1",
          requirements: Array.from({ length: 10 }, (_, i) => ({
            id: `${prefix}-step-${i}`,
            requirement: `Verify item ${i}`,
            required: true,
          })),
        },
      ],
    });
    await command({
      kind: "associate",
      id: `${prefix}-sheet`,
      assetId: `${prefix}-A-0`,
      templateId: `${prefix}-template`,
      level: "L3",
    });
    for (let i = 0; i < 6; i++)
      await command({
        kind: "save-response",
        sheetId: `${prefix}-sheet`,
        stepId: `${prefix}-step-${i}`,
        answer: "Synthetic verified",
        result: "passed",
      });
    await command({
      kind: "add-work",
      id: `${prefix}-work`,
      assetId: `${prefix}-A-0`,
      title: `${prefix} label remaining`,
      notes: "A real Works to go record, distinct from open tasks",
    });
    const all = await json<ProjectReportResult>(
      await request(reportUrl({ report: "tagging", limit: 1 }), admin),
    );
    assert.equal(all.total, 61);
    assert.equal(all.rows.length, 1);
    const filtered = await json<ProjectReportResult>(
      await request(
        reportUrl({ report: "tagging", vendor: "xyz", level: "L3", limit: 50 }),
        admin,
      ),
    );
    assert.equal(filtered.total, 31);
    const first = filtered.rows.find((row) => row.id === `${prefix}-A-0`);
    assert(first?.kind === "tagging");
    assert.equal(first.progress.percent, 60);
    assert.equal(first.signatures, 0);
    const works = await json<ProjectReportResult>(
      await request(
        reportUrl({
          report: "works-to-go",
          vendor: "XYZ",
          discipline: "Mechanical",
        }),
        admin,
      ),
    );
    assert.equal(works.total, 1);
    assert.equal(works.rows[0].id, `${prefix}-work`);
    const lookahead = await json<ProjectReportResult>(
      await request(reportUrl({ report: "lookahead", from: today }), admin),
    );
    assert.equal(lookahead.total, 1);
    assert.equal(lookahead.window.days, 14);
    assert.equal(lookahead.query.from, today);
    const vendors = await json<ProjectReportResult>(
      await request(reportUrl({ report: "vendors", from: today }), admin),
    );
    assert.equal(vendors.total, 2);
    const revision = (await state()).version;
    const csv = await request(
      reportUrl({ report: "tagging", format: "csv", version: revision }),
      admin,
    );
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get("content-type") ?? "", /text\/csv/);
    assert.equal((await csv.text()).trim().split(/\r?\n/).length, 62);
    await command({
      kind: "set-work-status",
      id: `${prefix}-work`,
      status: "done",
    });
    assert.equal(
      (
        await request(
          reportUrl({ report: "tagging", format: "csv", version: revision }),
          admin,
        )
      ).status,
      409,
    );
    assert.equal(
      (await request(reportUrl({ limit: 1000 }), admin)).status,
      400,
    );
    assert.equal((await request(endpoint, await login("u1"))).status, 403);
    assert.equal(
      (
        await request(
          `/api/projects/unknown-${prefix}/reports`,
          await login("u3"),
        )
      ).status,
      404,
    );
    const old = initial.users.find((user) => user.id === "u3")?.modules ?? [
      "tasks",
      "time",
      "dashboard",
      "commissioning",
      "reports",
      "team",
      "feedback",
    ];
    try {
      await json(
        await request("/api/team/u3/modules", admin, "PATCH", {
          modules: old.filter((module) => module !== "reports"),
        }),
      );
      assert.equal(
        (await request(`/api/projects/p-demo-rich/reports`, await login("u3")))
          .status,
        403,
      );
    } finally {
      await json(
        await request("/api/team/u3/modules", admin, "PATCH", { modules: old }),
      );
    }
  } finally {
    if (configured)
      await json(
        await request(register, admin, "PATCH", {
          action: "configure",
          version: (await state()).version,
          reason:
            "Restore the original demo project configuration after reporting checks",
          config: original.config,
        }),
      );
  }
  const final = await json<Bootstrap>(await request("/api/bootstrap", admin));
  const finalState = commissioning(
    final.projects.find((row) => row.id === project.id),
  );
  assert.deepEqual(
    finalState.config,
    original.config,
    "Pre-existing project configuration is restored exactly.",
  );
  assert.deepEqual(
    finalState.assets.filter((asset) =>
      original.assets.some((before) => before.id === asset.id),
    ),
    original.assets,
    "Original assets are unchanged.",
  );
  assert.deepEqual(
    finalState.schedule.filter((activity) =>
      original.schedule.some(
        (before) => before.activityId === activity.activityId,
      ),
    ),
    original.schedule,
    "Original schedule rows are unchanged.",
  );
  assert.deepEqual(
    final.tasks.filter((task) =>
      initial.tasks.some((old) => old.id === task.id),
    ),
    initial.tasks,
  );
});
