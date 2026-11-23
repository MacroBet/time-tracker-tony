import test from "node:test";
import assert from "node:assert/strict";
import {
  dashboardViewFromParams,
  dashboardViewHref,
  dashboardReportQuery,
} from "../src/lib/dashboard-views";
import type { DashboardViewRequest } from "../src/lib/dashboard-view-context";

test("Dashboard view URLs round-trip explicit display requests without interpreting vendor names as query parameters", () => {
  const views: DashboardViewRequest[] = [
    { kind: "overview" },
    { kind: "progress", comparison: "critical" },
    { kind: "lookahead", weeks: 4 },
    { kind: "vendor-progress", vendor: "Vendor X & Partners" },
    { kind: "report", report: "tags" },
    { kind: "readiness" },
  ];
  for (const view of views) {
    const url = new URL(
      dashboardViewHref("p & 1", view),
      "https://local.invalid",
    );
    assert.equal(url.searchParams.get("projectId"), "p & 1");
    const parsed = dashboardViewFromParams(url.searchParams);
    assert(parsed.success);
    assert.deepEqual(parsed.data, view);
  }
});

test("previous report links resolve to the same report and retain validated filters", () => {
  const tags = dashboardViewFromParams(
    new URLSearchParams("tab=reports&view=tags"),
  );
  assert(tags.success);
  assert.deepEqual(tags.data, { kind: "report", report: "tags" });
  const params = new URLSearchParams(
    "tab=reports&report=lookahead&weeks=6&vendor=Vendor+X&activityStatus=all",
  );
  const view = dashboardViewFromParams(params);
  assert(view.success);
  const query = dashboardReportQuery(params, view.data);
  assert.equal(query.report, "lookahead");
  assert.equal(query.weeks, 6);
  assert.equal(query.vendor, "Vendor X");
  assert.equal(query.activityStatus, "all");
});

test("invalid views and unsupported lookahead windows fail explicitly; reports-only landing stays a report", () => {
  assert.equal(
    dashboardViewFromParams(new URLSearchParams("panel=report&view=delete"))
      .success,
    false,
  );
  assert.equal(
    dashboardViewFromParams(new URLSearchParams("panel=lookahead&weeks=52"))
      .success,
    false,
  );
  const view = dashboardViewFromParams(new URLSearchParams(), false);
  assert(view.success);
  assert.deepEqual(view.data, { kind: "report", report: "tags" });
});
