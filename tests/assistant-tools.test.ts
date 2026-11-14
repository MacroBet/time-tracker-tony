import test from "node:test";
import assert from "node:assert/strict";
import { EXTENSION_TOOLS } from "../src/lib/copilot-extension-tools";
import { runCopilotTurn } from "../src/lib/copilot-provider";
import { refineAssistantReport } from "../src/lib/assistant-report-state";
import {
  buildProjectReport,
  type ProjectReportQuery,
} from "../src/lib/project-reports";
import { createDemoData } from "../src/lib/demo-data";
const data = createDemoData(new Date("2026-11-14T12:00:00Z"));
const nulls = {
  report: null,
  vendor: null,
  level: null,
  late: null,
  discipline: null,
  query: null,
  from: null,
  workStatus: null,
  activityStatus: null,
  offset: null,
  limit: null,
  reset: false,
  clear: [],
};
const config = {
  apiKey: "synthetic-unit-fixture",
  model: "synthetic-model",
  enabled: true,
};
test("strict registered tools execute the Tony report refinements through the bounded provider loop", async () => {
  let state: ProjectReportQuery | undefined;
  const expected = [
    { ...nulls, report: "tagging", reset: true },
    { ...nulls, vendor: "XYZ" },
    { ...nulls, level: "L3" },
    { ...nulls, late: "late" },
  ];
  for (const change of expected) {
    let requests = 0;
    const answer = await runCopilotTurn(
      {
        message: "Synthetic paraphrase of Tony request",
        history: [],
        projectName: data.projects[0].name,
        viewContext: { today: "2026-11-14", report: state ?? null },
        tools: EXTENSION_TOOLS,
        executeTool: async (name, args) => {
          assert.equal(name, "project_report");
          state = refineAssistantReport(state, args);
          return buildProjectReport(data, data.projects[0].id, state);
        },
      },
      config,
      async (_url, init) => {
        const body = JSON.parse(String(init.body));
        assert.equal(body.store, false);
        assert.equal(body.parallel_tool_calls, false);
        assert.match(
          body.instructions,
          /Vendor always means equipment supplier/,
        );
        assert.match(body.instructions, /Friday 23rd/);
        assert(
          body.tools.some(
            (tool: { name: string }) => tool.name === "propose_asset_activity",
          ),
        );
        requests++;
        return new Response(
          JSON.stringify({
            id: "synthetic-response",
            status: "completed",
            output:
              requests === 1
                ? [
                    {
                      type: "function_call",
                      name: "project_report",
                      call_id: "synthetic-call",
                      arguments: JSON.stringify(change),
                    },
                  ]
                : [
                    {
                      type: "message",
                      role: "assistant",
                      content: [
                        { type: "output_text", text: "Synthetic test result" },
                      ],
                    },
                  ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    );
    assert.equal(answer.text, "Synthetic test result");
    assert.equal(requests, 2);
  }
  assert.equal(state?.vendor, "XYZ");
  assert.equal(state?.level, "L3");
  assert.equal(state?.late, "late");
});
