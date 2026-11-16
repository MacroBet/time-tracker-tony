import test from "node:test";
import assert from "node:assert/strict";
import {
  COPILOT_LIMITS,
  runCopilotTurn,
  CopilotProviderError,
  CopilotToolError,
  boundedCopilotHistory,
  type CopilotFunctionTool,
} from "../src/lib/copilot-provider";
import { recoverCompletedReport } from "../src/lib/copilot-reads";
import { createDemoData } from "../src/lib/demo-data";
import { buildCopilotContext } from "../src/lib/copilot";
import { buildProjectReport } from "../src/lib/project-reports";
const config = {
  enabled: true,
  apiKey: "synthetic-injected-only",
  model: "synthetic-model",
};
const tool: CopilotFunctionTool = {
  type: "function",
  name: "project_report",
  strict: true,
  description: "Saved project report",
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
};
const reply = (text: string) =>
  Response.json({
    status: "completed",
    output: [
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text }],
      },
    ],
  });

test("valid long assistant replies can be followed up; only the provider context is bounded, never the durable input history", async () => {
  const history = Array.from({ length: 12 }, (_, index) => ({
    role: "assistant" as const,
    text: `${index}:`.padEnd(6000, "x"),
  }));
  const original = structuredClone(history),
    bounded = boundedCopilotHistory(history);
  assert.equal(bounded.length, 4);
  assert.equal(bounded[0].text.slice(0, 2), "8:");
  assert.deepEqual(history, original);
  let calls = 0;
  await runCopilotTurn(
    {
      message: "Summarise those results",
      history,
      projectName: "Synthetic project",
      tools: [tool],
      executeTool: async () => {
        throw Error("No tool should be called");
      },
    },
    config,
    async (_url, options) => {
      calls++;
      const body = JSON.parse(String(options.body));
      const messages = body.input.filter(
        (row: { role: string }) => row.role === "assistant",
      );
      assert(
        messages.reduce(
          (sum: number, row: { content: string }) => sum + row.content.length,
          0,
        ) <= COPILOT_LIMITS.historyCharacters,
      );
      assert.equal(messages.at(-1).content, history.at(-1)!.text);
      return reply("Controlled follow-up completed.");
    },
  );
  assert.equal(calls, 1);
  await runCopilotTurn(
    {
      message: "Explain this",
      history: [{ role: "assistant", text: "x".repeat(8000) }],
      projectName: "Synthetic",
      tools: [],
      executeTool: async () => undefined,
    },
    config,
    async () => reply("Controlled reply to the longest valid saved answer."),
  );
});

test("a basic summary can use the current authorized read snapshot in one request without a tool-planning round", async () => {
  const data = createDemoData(new Date("2026-11-16T12:00:00Z")),
    context = buildCopilotContext(data, "p1");
  let calls = 0;
  const result = await runCopilotTurn(
    {
      message: "Summarise the recorded project status",
      history: [],
      projectName: context.project.name,
      viewContext: {
        today: "2026-11-16",
        report: null,
        readSnapshot: {
          projectId: "p1",
          projectVersion: context.project.version,
          summary: context.summary,
        },
      },
      tools: [tool],
      executeTool: async () => {
        throw Error("The supplied basic counts do not need a repeat read");
      },
    },
    config,
    async (_url, options) => {
      calls++;
      const body = JSON.parse(String(options.body));
      assert(body.instructions.includes('"readSnapshot"'));
      assert(
        body.instructions.includes('"openTasks":' + context.summary.openTasks),
      );
      assert(body.instructions.includes("does not provide filtered reports"));
      return reply(
        `${context.summary.openTasks} open saved app tasks; P6 rows remain a separate population.`,
      );
    },
  );
  assert.equal(calls, 1);
  assert(result.text.startsWith(String(context.summary.openTasks)));
});

test("a completed saved report survives a later empty provider answer without another provider call, while meter intent/final stay paired", async () => {
  const data = createDemoData(new Date("2026-11-16T12:00:00Z"));
  const reports: ReturnType<typeof buildProjectReport>[] = [];
  let requests = 0,
    meterWrites = 0;
  let error: unknown;
  try {
    await runCopilotTurn(
      {
        message: "Make a tagging report",
        history: [],
        projectName: "Synthetic",
        tools: [tool],
        executeTool: async () => {
          const report = buildProjectReport(data, "p1", {
            report: "tagging",
            query: "no-matching-equipment-in-this-local-fixture",
          });
          reports.push(report);
          return { total: report.total };
        },
      },
      {
        ...config,
        recordAttempt: async () => {
          meterWrites++;
        },
      },
      async () => {
        requests++;
        return requests === 1
          ? Response.json({
              status: "completed",
              output: [
                {
                  type: "function_call",
                  name: tool.name,
                  call_id: "report",
                  arguments: "{}",
                },
              ],
            })
          : reply("");
      },
    );
  } catch (cause) {
    error = cause;
  }
  assert(error instanceof CopilotProviderError);
  const terminal = recoverCompletedReport(error, reports);
  assert(terminal);
  assert(terminal?.includes("AI explanation did not finish"));
  assert(terminal.includes("No records match these filters"));
  assert(terminal.includes("no AI generation"));
  assert.equal(requests, 2);
  assert.equal(meterWrites, 4);
  for (const code of [
    "cancelled",
    "tool_failed",
    "limit_exceeded",
    "invalid_input",
  ] as const)
    assert.equal(
      recoverCompletedReport(
        new CopilotProviderError(
          code,
          "A terminal error even with a provider phase",
          "provider",
          "provider-transport",
        ),
        reports,
      ),
      undefined,
    );
  assert.equal(
    recoverCompletedReport(
      new CopilotToolError(403, "Access changed"),
      reports,
    ),
    undefined,
  );
  assert.equal(recoverCompletedReport(error, []), undefined);
});

type FailureCase =
  | "tool-timeout"
  | "meter-intent"
  | "meter-final"
  | "meter-timeout"
  | "unknown-tool"
  | "duplicate-call"
  | "bad-arguments"
  | "array-arguments"
  | "invalid-json"
  | "incomplete"
  | "cancelled"
  | "acl"
  | "stale"
  | "provider-timeout"
  | "provider-network"
  | "provider-abort"
  | "provider-503"
  | "provider-401";
async function failAfterCompletedReport(kind: FailureCase) {
  const data = createDemoData(new Date("2026-11-16T12:00:00Z"));
  const reports: ReturnType<typeof buildProjectReport>[] = [];
  let requests = 0,
    tools = 0,
    meterWrites = 0;
  const controller = new AbortController();
  let error: unknown;
  const never = () => new Promise<never>(() => {});
  try {
    await runCopilotTurn(
      {
        message: "Make the saved report",
        history: [],
        projectName: "Synthetic",
        signal: controller.signal,
        tools: [tool],
        executeTool: async () => {
          tools++;
          if (tools === 1) {
            const report = buildProjectReport(data, "p1", {
              report: "tagging",
            });
            reports.push(report);
            return { total: report.total };
          }
          if (kind === "acl" || kind === "stale")
            throw new CopilotToolError(
              kind === "acl" ? 403 : 409,
              "Saved record access or revision changed",
            );
          return never();
        },
      },
      {
        ...config,
        timeoutMs: 75,
        meterTimeoutMs: 10,
        recordAttempt: async (observation) => {
          meterWrites++;
          if (observation.attemptNumber !== 2) return;
          if (
            (kind === "meter-intent" && observation.outcome === "started") ||
            (kind === "meter-final" && observation.outcome !== "started")
          )
            throw Error("Synthetic durable recorder failure");
          if (kind === "meter-timeout" && observation.outcome !== "started")
            return never();
        },
      },
      async () => {
        requests++;
        const call = (id: string, name = tool.name, args = "{}") =>
          Response.json({
            status: "completed",
            output: [
              { type: "function_call", call_id: id, name, arguments: args },
            ],
          });
        if (requests === 1) return call("completed-report");
        if (kind === "provider-timeout") return never();
        if (kind === "provider-network")
          throw Error("Synthetic network disconnect");
        if (kind === "provider-abort")
          throw new DOMException(
            "Synthetic transport cancellation",
            "AbortError",
          );
        if (kind === "provider-503")
          return new Response("unavailable", { status: 503 });
        if (kind === "provider-401")
          return new Response("unauthorized", { status: 401 });
        if (kind === "cancelled") {
          controller.abort();
          return never();
        }
        if (kind === "invalid-json")
          return new Response("{", {
            headers: { "Content-Type": "application/json" },
          });
        if (kind === "incomplete")
          return Response.json({ status: "incomplete", output: [] });
        if (kind === "unknown-tool")
          return call("unavailable", "not_an_allowed_tool");
        if (kind === "duplicate-call") return call("completed-report");
        if (kind === "bad-arguments")
          return call("invalid-args", tool.name, "{");
        if (kind === "array-arguments")
          return call("array-args", tool.name, "[]");
        if (kind === "tool-timeout" || kind === "acl" || kind === "stale")
          return call("next-read");
        return reply(
          "Narration completed, but the durable meter must still succeed.",
        );
      },
    );
  } catch (cause) {
    error = cause;
  }
  assert(
    error instanceof CopilotProviderError,
    `Expected an explicit failure for ${kind}`,
  );
  assert.equal(
    reports.length,
    1,
    "The saved report completed before the failure",
  );
  return { error, reports, requests, tools, meterWrites };
}

test("after a completed report, tool timeouts, meter failures, protocol violations, ACL/stale errors and cancellation remain terminal", async () => {
  for (const kind of [
    "tool-timeout",
    "meter-intent",
    "meter-final",
    "meter-timeout",
    "unknown-tool",
    "duplicate-call",
    "bad-arguments",
    "array-arguments",
    "invalid-json",
    "incomplete",
    "cancelled",
    "provider-abort",
    "acl",
    "stale",
    "provider-401",
  ] as const) {
    const result = await failAfterCompletedReport(kind);
    assert.equal(
      recoverCompletedReport(result.error, result.reports),
      undefined,
      `${kind} cannot become a successful narration fallback`,
    );
    assert.equal(
      result.requests,
      kind === "meter-intent" ? 1 : 2,
      "No additional provider request after the terminal failure",
    );
    assert.equal(
      result.meterWrites,
      kind === "meter-intent" ? 3 : 4,
      "Existing intent/final recording is still attempted",
    );
    if (kind.startsWith("meter")) assert.equal(result.error.origin, "meter");
    if (kind === "provider-abort") {
      assert.equal(result.error.code, "cancelled");
      assert.equal(result.error.origin, "cancelled");
      assert.equal(result.error.phase, "provider");
    }
    if (kind === "tool-timeout") {
      assert.equal(result.error.phase, "tool");
      assert.equal(result.error.origin, "tool");
    }
    if (
      [
        "unknown-tool",
        "duplicate-call",
        "bad-arguments",
        "array-arguments",
      ].includes(kind)
    )
      assert.equal(result.error.origin, "tool-protocol");
  }
});

test("only explicitly classified narration or provider transport failures can recover a completed report, never an unclassified matching error code", async () => {
  for (const kind of [
    "provider-timeout",
    "provider-network",
    "provider-503",
  ] as const) {
    const result = await failAfterCompletedReport(kind);
    assert.equal(result.error.phase, "provider");
    assert.equal(result.error.origin, "provider-transport");
    assert(recoverCompletedReport(result.error, result.reports));
    assert.equal(result.requests, 2);
    assert.equal(result.meterWrites, 4);
    assert.equal(
      recoverCompletedReport(
        new CopilotProviderError(result.error.code, "Unclassified failure"),
        result.reports,
      ),
      undefined,
    );
    assert.equal(
      recoverCompletedReport(
        {
          code: result.error.code,
          phase: "provider",
          origin: "provider-transport",
        },
        result.reports,
      ),
      undefined,
    );
  }
});
