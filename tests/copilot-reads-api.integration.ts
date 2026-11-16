import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { MODULES } from "../src/lib/commissioning";
import { projectDate, type Bootstrap } from "../src/lib/domain";
import type { ProjectReportResult } from "../src/lib/project-reports";
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
type Reply = {
  text: string;
  mode: string;
  sources: { id: string; href: string }[];
  reports: ProjectReportResult[];
  reportState?: { projectId: string; query: ProjectReportResult["query"] };
  proposals: unknown[];
  scheduleProposals: unknown[];
};
test("the two observed questions return authorized saved-data results without any configured provider, with exact deterministic totals and report filters", async () => {
  assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
  assert.equal(
    (await json<{ mode: string }>(await request("/api/auth/session"))).mode,
    "demo",
    "Only run on a local demo server without database/provider.",
  );
  const admin = await session("u-admin"),
    initial = await json<Bootstrap>(await request("/api/bootstrap", admin));
  const created = await json<{ id: string }>(
    await request("/api/projects", admin, "POST", {
      name: "A1 local saved-read test",
      location: "Synthetic local only",
      companyId: initial.currentUser.companyId,
      requestId: randomUUID(),
    }),
    201,
  );
  const endpoint = `/api/projects/${created.id}/copilot`;
  assert.notEqual(
    (
      await json<{ configuration: { state: string } }>(
        await request(endpoint, admin),
      )
    ).configuration.state,
    "ready",
    "Never run with an AI provider enabled.",
  );
  const message = "Show me the next two weeks look ahead.";
  const empty = await json<Reply>(
    await request(endpoint, admin, "POST", { message }),
  );
  assert.equal(empty.mode, "saved-data");
  assert.equal(empty.reports[0].total, 0);
  assert(empty.text.includes("does not mean the project has no work"));
  assert.equal((await request(endpoint, "", "POST", { message })).status, 401);
  assert.equal(
    (await request(endpoint, await session("u1"), "POST", { message })).status,
    403,
  );
  assert.equal(
    (await request(endpoint, await session("u3"), "POST", { message })).status,
    404,
  );
  const today = projectDate();
  const source = {
    format: "p6-xer-v1",
    source: {
      fileName: "a1-synthetic-only.xer",
      sha256: "b".repeat(64),
      encoding: "utf-8",
      header: "synthetic local fixture",
    },
    tables: {
      TASK: {
        fields: [
          "task_id",
          "task_code",
          "task_name",
          "status_code",
          "restart_date",
          "reend_date",
        ],
        rows: Array.from({ length: 61 }, (_, i) => [
          String(i),
          `A1-${i}`,
          i === 60
            ? "Commission chillers"
            : i === 59
              ? "Inspect CHILLER"
              : "Unrelated activity",
          "TK_NotStart",
          today,
          today,
        ]),
        lines: Array.from({ length: 61 }, (_, i) => i + 2),
      },
    },
  };
  const upload = await fetch(
    `${base}/api/projects/${created.id}/programme-source?version=0&preview=false&reason=${encodeURIComponent("Validate isolated local Schedule search")}`,
    {
      method: "POST",
      headers: {
        Cookie: admin,
        Origin: base,
        "Content-Type": "application/gzip",
      },
      body: gzipSync(JSON.stringify(source)),
    },
  );
  await json(upload);
  const response = await request(endpoint, admin, "POST", { message });
  assert(response.headers.get("server-timing")?.includes("read;dur="));
  const reply = await json<Reply>(response),
    report = reply.reports[0];
  assert.equal(report.total, 61);
  assert.equal(report.rows.length, 20);
  assert.equal(report.coverage.activitiesWithoutAssetLinks, 61);
  assert.equal(report.coverage.activitiesMissingVendor, 61);
  assert.equal(reply.proposals.length, 0);
  assert.equal(reply.scheduleProposals.length, 0);
  const deterministic = await json<ProjectReportResult>(
    await request(
      `/api/projects/${created.id}/reports?report=lookahead&from=${today}`,
      admin,
    ),
  );
  assert.equal(deterministic.total, report.total);
  assert.deepEqual(
    deterministic.rows.map((row) => row.id),
    report.rows.map((row) => row.id),
  );
  const filtered = await json<Reply>(
    await request(endpoint, admin, "POST", {
      message,
      reportState: {
        projectId: created.id,
        query: { ...report.query, query: "no matching Schedule row" },
      },
    }),
  );
  assert.equal(filtered.reports[0].total, 0);
  assert.equal(filtered.reports[0].query.query, "no matching Schedule row");
  assert.equal(filtered.reports[0].query.from, today);
  assert(filtered.text.includes("active filters"));
  const search = await json<Reply>(
    await request(endpoint, admin, "POST", {
      message: "Show me all chillers on the schedule.",
    }),
  );
  assert.equal(search.mode, "saved-data");
  assert.equal(search.reports.length, 0);
  assert.equal(search.sources.length, 2);
  assert(
    search.text.includes("2 matching activities in the complete 61-activity"),
  );
  assert(search.text.includes("no AI generation"));
  assert.deepEqual(
    search.sources.map((row) => row.id),
    ["59", "60"],
  );
  assert(
    search.sources.every(
      (row) =>
        new URL(row.href, base).searchParams.get("projectId") === created.id,
    ),
  );
  const page = await json<{ total: number }>(
    await request(
      `/api/projects/${created.id}/programme-source?q=chiller`,
      admin,
    ),
  );
  assert.equal(page.total, search.sources.length);
  const noMatch = await json<Reply>(
    await request(endpoint, admin, "POST", {
      message: "Show me all absent-equipment on the schedule.",
    }),
  );
  assert.equal(noMatch.sources.length, 0);
  assert(
    noMatch.text.includes("does not establish that no such equipment exists"),
  );
  assert.equal(
    (
      await request(endpoint, admin, "POST", {
        message,
        reportState: { projectId: "other", query: report.query },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(endpoint, admin, "POST", {
        message,
        scheduleView: {
          projectId: "other",
          projectVersion: 1,
          sourceSha256: "b".repeat(64),
          mode: "working",
          page: 0,
          query: { q: "", wbs: "", calendar: "", status: "" },
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(endpoint, admin, "POST", {
        message: "Show me all chillers on the schedule and move them to Friday",
      })
    ).status,
    503,
    "Compound requests keep the real-provider gate.",
  );
  assert.equal(
    (
      await request(endpoint, admin, "POST", {
        message: 'Example: "Show me the next two weeks look ahead."',
      })
    ).status,
    503,
  );
  const old = initial.users.find((user) => user.id === "u3")?.modules ?? [
    ...MODULES,
  ];
  try {
    await json(
      await request("/api/team/u3/modules", admin, "PATCH", {
        modules: old.filter((module) => module !== "reports"),
      }),
    );
    const supervisor = await session("u3");
    assert.equal(
      (
        await request("/api/projects/p-demo-rich/copilot", supervisor, "POST", {
          message,
        })
      ).status,
      403,
      "Saved report reads still require Reports module.",
    );
    assert.equal(
      (
        await request("/api/projects/p-demo-rich/copilot", supervisor, "POST", {
          message: "Show me all chillers on the schedule.",
        })
      ).status,
      200,
      "Schedule search uses Commissioning access, not Reports.",
    );
  } finally {
    await json(
      await request("/api/team/u3/modules", admin, "PATCH", { modules: old }),
    );
  }
  await json(await request("/api/auth/logout", admin, "POST", {}));
  assert.equal(
    (await request(endpoint, admin, "POST", { message })).status,
    401,
  );
});
