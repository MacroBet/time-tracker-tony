import test from "node:test";
import assert from "node:assert/strict";
import {
  EXTENSION_TOOLS,
  canRequestDashboardView,
  dashboardViewToolInputSchema,
} from "../src/lib/copilot-extension-tools";
import { createDemoData } from "../src/lib/demo-data";
import { buildReportReadiness } from "../src/lib/report-readiness";
import { runCopilotTurn } from "../src/lib/copilot-provider";

const unused = { comparison: null, weeks: null, vendor: null, report: null };

test("Dashboard tool requests use the same strict view union and reject stray or irrelevant fields", () => {
  assert.deepEqual(
    dashboardViewToolInputSchema.parse({
      ...unused,
      kind: "progress",
      comparison: "critical",
    }),
    { kind: "progress", comparison: "critical" },
  );
  assert.deepEqual(
    dashboardViewToolInputSchema.parse({
      ...unused,
      kind: "vendor-progress",
      vendor: "Supplier A",
    }),
    { kind: "vendor-progress", vendor: "Supplier A" },
  );
  for (const input of [
    { ...unused, kind: "report", report: "tags", vendor: "Supplier A" },
    { ...unused, kind: "lookahead", weeks: 3 },
    { ...unused, kind: "progress", comparison: "critical", apply: true },
    { ...unused, kind: "phase-one-critical" },
    { ...unused, kind: "vendor-progress", vendor: " " },
  ])
    assert.equal(dashboardViewToolInputSchema.safeParse(input).success, false);
});

test("Dashboard display tools preserve management and separate module boundaries", () => {
  const data = createDemoData(new Date("2026-11-23T12:00:00Z"));
  const manager = data.users.find((user) => user.role === "manager")!;
  const reportsOnly = { ...manager, modules: ["reports" as const] };
  const dashboardOnly = { ...manager, modules: ["dashboard" as const] };
  assert.equal(
    canRequestDashboardView(reportsOnly, { kind: "report", report: "tags" }),
    true,
  );
  assert.equal(
    canRequestDashboardView(reportsOnly, {
      kind: "progress",
      comparison: "critical",
    }),
    false,
  );
  assert.equal(
    canRequestDashboardView(dashboardOnly, { kind: "report", report: "tags" }),
    false,
  );
  assert.equal(
    canRequestDashboardView(dashboardOnly, { kind: "readiness" }),
    true,
  );
  assert.equal(
    canRequestDashboardView(
      { ...manager, role: "worker" },
      { kind: "overview" },
    ),
    false,
  );
});

test("the bounded provider loop can review saved import criteria then prepare a pending Dashboard view with all fourteen tools", async () => {
  const data = createDemoData(new Date("2026-11-23T12:00:00Z"));
  const projectId = data.projects[0].id;
  const before = JSON.stringify(data);
  const tools = [...EXTENSION_TOOLS];
  for (let i = tools.length; i < 14; i++)
    tools.push({
      type: "function",
      name: `synthetic_existing_tool_${i}`,
      description: "Synthetic compatibility fixture",
      strict: true,
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    });
  const calls: string[] = [];
  let requests = 0;
  const answer = await runCopilotTurn(
    {
      message: "Review the import and show its readiness on the Dashboard",
      history: [],
      projectName: "Synthetic project",
      tools,
      executeTool: async (name, args) => {
        calls.push(name);
        if (name === "review_import")
          return buildReportReadiness(data, projectId);
        const view = dashboardViewToolInputSchema.parse(args);
        return {
          view,
          applied: false,
          status: "pending-browser-acknowledgement",
          recordsChanged: false,
        };
      },
    },
    {
      apiKey: "synthetic-unit-fixture",
      model: "synthetic-model",
      enabled: true,
    },
    async (_url, init) => {
      const body = JSON.parse(String(init.body));
      assert.equal(body.tools.length, 14);
      for (const name of ["review_import", "display_dashboard_view"]) {
        const tool = body.tools.find(
          (tool: { name: string }) => tool.name === name,
        );
        assert.equal(tool.strict, true);
        assert.equal(tool.parameters.additionalProperties, false);
        assert.deepEqual(
          [...tool.parameters.required].sort(),
          Object.keys(tool.parameters.properties).sort(),
        );
      }
      assert.match(
        body.instructions,
        /never claim the screen changed before the browser acknowledges/i,
      );
      requests++;
      return new Response(
        JSON.stringify({
          id: `synthetic-${requests}`,
          status: "completed",
          output:
            requests < 3
              ? [
                  {
                    type: "function_call",
                    call_id: `call-${requests}`,
                    name:
                      requests === 1
                        ? "review_import"
                        : "display_dashboard_view",
                    arguments: JSON.stringify(
                      requests === 1 ? {} : { ...unused, kind: "readiness" },
                    ),
                  },
                ]
              : [
                  {
                    type: "message",
                    role: "assistant",
                    content: [
                      {
                        type: "output_text",
                        text: "Saved import criteria reviewed. Dashboard view is pending application acknowledgement.",
                      },
                    ],
                  },
                ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  );
  assert.deepEqual(calls, ["review_import", "display_dashboard_view"]);
  assert.equal(requests, 3);
  assert.match(answer.text, /pending application acknowledgement/);
  assert.equal(JSON.stringify(data), before);
});

test("the extended tool catalogue remains bounded before any provider request", async () => {
  const tools = Array.from({ length: 15 }, (_, i) => ({
    type: "function" as const,
    name: `synthetic_tool_${i}`,
    description: "Synthetic limit fixture",
    strict: true as const,
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  }));
  let requested = false;
  await assert.rejects(
    runCopilotTurn(
      {
        message: "Synthetic request",
        history: [],
        projectName: "Synthetic",
        tools,
        executeTool: async () => ({}),
      },
      {
        apiKey: "synthetic-unit-fixture",
        model: "synthetic-model",
        enabled: true,
      },
      async () => {
        requested = true;
        throw Error("No network should be attempted");
      },
    ),
    /tools are not configured correctly/,
  );
  assert.equal(requested, false);
});
