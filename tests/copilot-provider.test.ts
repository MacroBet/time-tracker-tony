import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  COPILOT_LIMITS,
  CopilotProviderError,
  copilotStatus,
  runCopilotTurn,
  type CopilotConfig,
  type CopilotFunctionTool,
  type CopilotTransport,
  type CopilotTurn,
} from "../src/lib/copilot-provider";

// Synthetic configuration exists only in tests; every transport below is injected.
const config: CopilotConfig = {
  apiKey: "synthetic-test-credential",
  model: "test-model",
  enabled: true,
};
const tool: CopilotFunctionTool = {
  type: "function",
  name: "project_summary",
  description: "Read the active project summary.",
  strict: true,
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
};
function input(overrides: Partial<CopilotTurn> = {}): CopilotTurn {
  return {
    message: "What is overdue?",
    history: [],
    projectName: "Synthetic project",
    tools: [tool],
    executeTool: async () => ({ total: 2 }),
    ...overrides,
  };
}
const answer = (text = "Two project activities are overdue.") => ({
  type: "message",
  role: "assistant",
  content: [{ type: "output_text", text }],
});
const call = (id: string, name = tool.name, args = "{}") => ({
  type: "function_call",
  call_id: id,
  name,
  arguments: args,
});
const response = (output: unknown[]) =>
  Response.json({ status: "completed", output });
function sequence(outputs: unknown[][]) {
  const requests: {
    url: string;
    init: RequestInit;
    body: Record<string, unknown>;
  }[] = [];
  const transport: CopilotTransport = async (url, init) => {
    requests.push({ url, init, body: JSON.parse(String(init.body)) });
    const next = outputs[requests.length - 1];
    assert(next, "Unexpected additional provider request");
    return response(next);
  };
  return { transport, requests };
}
const code = (expected: CopilotProviderError["code"]) => (error: unknown) =>
  error instanceof CopilotProviderError && error.code === expected;

test("missing key, missing model and disabled configuration never reach even the injected transport", async () => {
  let requests = 0;
  const transport: CopilotTransport = async () => {
    requests++;
    throw new Error("Transport must not run");
  };
  for (const partial of [
    { ...config, apiKey: undefined },
    { ...config, model: "" },
    { ...config, enabled: false },
    { ...config, model: "sk-not-a-model" },
  ]) {
    await assert.rejects(
      runCopilotTurn(input(), partial, transport),
      code(partial.enabled === false ? "disabled" : "not_configured"),
    );
  }
  assert.equal(requests, 0);
});

test("safe public status is honest and contains neither key nor arbitrary configuration fields", () => {
  assert.deepEqual(copilotStatus({ enabled: false }), {
    state: "not_configured",
    configured: false,
    enabled: false,
    model: null,
    missing: ["OPENAI_API_KEY", "OPENAI_MODEL"],
  });
  assert.equal(copilotStatus({ ...config, enabled: false }).state, "disabled");
  assert.equal(copilotStatus(config).state, "ready");
  assert.equal(
    JSON.stringify(copilotStatus(config)).includes(config.apiKey!),
    false,
  );
  assert.equal(copilotStatus({ ...config, model: config.apiKey }).model, null);
  assert.deepEqual(Object.keys(copilotStatus(config)).sort(), [
    "configured",
    "enabled",
    "missing",
    "model",
    "state",
  ]);
});

test("server environment reader stays disabled with a key until the exact enable flag is supplied, without public secrets", () => {
  const script =
    "const {getCopilotConfig,getCopilotStatus}=await import('./src/server/copilot-config.ts'); console.log(JSON.stringify({status:getCopilotStatus(),enabled:getCopilotConfig().enabled}));";
  for (const flag of ["", "false", "TRUE", "true"]) {
    const output = execFileSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        script,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          OPENAI_API_KEY: config.apiKey,
          OPENAI_MODEL: config.model!,
          COPILOT_ENABLED: flag,
        },
      },
    );
    const result = JSON.parse(output);
    assert.equal(result.enabled, flag === "true");
    assert.equal(result.status.state, flag === "true" ? "ready" : "disabled");
    assert.equal(output.includes(config.apiKey!), false);
  }
});

test("raw Responses text is extracted from nested content, with fixed endpoint and bounded stateless requests", async () => {
  const mock = sequence([
    [answer("First paragraph."), answer("Second paragraph.")],
  ]);
  const result = await runCopilotTurn(
    input({
      history: [
        { role: "user", text: "Previous question" },
        { role: "assistant", text: "Previous answer" },
      ],
    }),
    config,
    mock.transport,
  );
  assert.equal(result.text, "First paragraph.\nSecond paragraph.");
  const request = mock.requests[0];
  assert.equal(request.url, "https://api.openai.com/v1/responses");
  assert.equal(request.init.redirect, "error");
  assert.equal(request.body.store, false);
  assert.equal(request.body.parallel_tool_calls, false);
  assert.equal(request.body.max_output_tokens, COPILOT_LIMITS.outputTokens);
  assert.equal(request.body.model, config.model);
  assert.deepEqual(request.body.include, ["reasoning.encrypted_content"]);
  assert.deepEqual(request.body.tools, [tool]);
  assert.equal(JSON.stringify(request.body).includes(config.apiKey!), false);
});

test("serial tool rounds replay complete output including reasoning and call outputs in exact order", async () => {
  const reasoning = {
    type: "reasoning",
    id: "reason-1",
    summary: [],
    encrypted_content: "synthetic-encrypted-reasoning",
  };
  const firstCall = call("call-1");
  const interim = answer("I will check the project records.");
  const secondCall = call("call-2");
  const mock = sequence([
    [reasoning, interim, firstCall],
    [secondCall],
    [answer("Checked project records.")],
  ]);
  const executed: string[] = [];
  const result = await runCopilotTurn(
    input({
      executeTool: async (name, args) => {
        executed.push(name);
        assert.deepEqual(args, {});
        return { total: executed.length };
      },
    }),
    config,
    mock.transport,
  );
  assert.equal(result.text, "Checked project records.");
  assert.deepEqual(executed, [tool.name, tool.name]);
  const secondInput = mock.requests[1].body.input as unknown[];
  assert.deepEqual(secondInput.slice(1), [
    reasoning,
    interim,
    firstCall,
    { type: "function_call_output", call_id: "call-1", output: '{"total":1}' },
  ]);
  const thirdInput = mock.requests[2].body.input as unknown[];
  assert.deepEqual(thirdInput.slice(-2), [
    secondCall,
    { type: "function_call_output", call_id: "call-2", output: '{"total":2}' },
  ]);
});

test("multiple returned function calls execute in order, never concurrently", async () => {
  const mock = sequence([[call("first"), call("second")], [answer()]]);
  let active = 0;
  let executed = 0;
  await runCopilotTurn(
    input({
      executeTool: async () => {
        active++;
        assert.equal(active, 1);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active--;
        return { index: ++executed };
      },
    }),
    config,
    mock.transport,
  );
  assert.equal(executed, 2);
});

test("malformed, incomplete and text-less responses fail without echoing raw provider bodies", async () => {
  const transports: CopilotTransport[] = [
    async () => new Response("raw synthetic private error", { status: 401 }),
    async () => new Response("invalid json raw synthetic private error"),
    async () => Response.json({ status: "incomplete", output: [answer()] }),
    async () => Response.json({ status: "completed", output: "wrong" }),
    async () => response([{ type: "reasoning", summary: [] }]),
  ];
  for (const transport of transports) {
    await assert.rejects(
      runCopilotTurn(input(), config, transport),
      (error: unknown) =>
        error instanceof CopilotProviderError &&
        !error.message.includes("synthetic private error"),
    );
  }
});

test("unknown tools, duplicate call IDs and malformed arguments never reach the executor", async () => {
  for (const output of [
    [call("one", "confirm_or_apply")],
    [call("same"), call("same")],
    [call("bad", tool.name, "not-json")],
    [call("array", tool.name, "[]")],
    [{ ...call("empty"), call_id: "" }],
  ]) {
    let executed = 0;
    const mock = sequence([output]);
    await assert.rejects(
      runCopilotTurn(
        input({
          executeTool: async () => {
            executed++;
            return {};
          },
        }),
        config,
        mock.transport,
      ),
      code("invalid_response"),
    );
    assert.equal(executed, 0);
  }
});

test("tool failures are sanitized and do not continue provider rounds", async () => {
  const mock = sequence([[call("one")]]);
  await assert.rejects(
    runCopilotTurn(
      input({
        executeTool: async () => {
          throw new Error("synthetic private tool detail");
        },
      }),
      config,
      mock.transport,
    ),
    (error: unknown) =>
      error instanceof CopilotProviderError &&
      error.code === "tool_failed" &&
      !error.message.includes("private"),
  );
  assert.equal(mock.requests.length, 1);
});

test("round and tool-call limits bound work before executing an excessive batch", async () => {
  let executions = 0;
  const excessive = sequence([
    Array.from({ length: 7 }, (_, index) => call(`c-${index}`)),
  ]);
  await assert.rejects(
    runCopilotTurn(
      input({
        executeTool: async () => {
          executions++;
          return {};
        },
      }),
      config,
      excessive.transport,
    ),
    code("limit_exceeded"),
  );
  assert.equal(executions, 0);
  const rounds = sequence(
    Array.from({ length: 4 }, (_, index) => [call(`r-${index}`)]),
  );
  await assert.rejects(
    runCopilotTurn(input(), config, rounds.transport),
    code("limit_exceeded"),
  );
  assert.equal(rounds.requests.length, COPILOT_LIMITS.rounds);
});

test("request, response, argument, tool-output and answer limits are enforced", async () => {
  const never: CopilotTransport = async () => {
    throw new Error("Must not request");
  };
  await assert.rejects(
    runCopilotTurn(
      input({ message: "x".repeat(COPILOT_LIMITS.messageCharacters + 1) }),
      config,
      never,
    ),
    code("invalid_input"),
  );
  await assert.rejects(
    runCopilotTurn(
      input({
        tools: [
          {
            ...tool,
            parameters: {
              ...tool.parameters,
              description: "x".repeat(COPILOT_LIMITS.requestBytes),
            },
          },
        ],
      }),
      config,
      never,
    ),
    code("limit_exceeded"),
  );
  await assert.rejects(
    runCopilotTurn(
      input(),
      config,
      async () => new Response("x".repeat(COPILOT_LIMITS.responseBytes + 1)),
    ),
    code("limit_exceeded"),
  );
  await assert.rejects(
    runCopilotTurn(
      input(),
      config,
      sequence([
        [
          call(
            "too-large",
            tool.name,
            "x".repeat(COPILOT_LIMITS.argumentCharacters + 1),
          ),
        ],
      ]).transport,
    ),
    code("invalid_response"),
  );
  await assert.rejects(
    runCopilotTurn(
      input({
        executeTool: async () => "x".repeat(COPILOT_LIMITS.toolOutputBytes),
      }),
      config,
      sequence([[call("one")]]).transport,
    ),
    code("limit_exceeded"),
  );
  await assert.rejects(
    runCopilotTurn(
      input(),
      config,
      sequence([[answer("x".repeat(COPILOT_LIMITS.textCharacters + 1))]])
        .transport,
    ),
    code("limit_exceeded"),
  );
});

test("non-strict or incomplete function schemas are rejected before transport", async () => {
  let requests = 0;
  const transport: CopilotTransport = async () => {
    requests++;
    return response([answer()]);
  };
  for (const parameters of [
    { type: "object", properties: {}, required: [] },
    {
      type: "object",
      properties: { id: { type: "string" } },
      required: [],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: { child: { type: "object", properties: {}, required: [] } },
      required: ["child"],
      additionalProperties: false,
    },
  ]) {
    await assert.rejects(
      runCopilotTurn(
        input({ tools: [{ ...tool, parameters }] }),
        config,
        transport,
      ),
      code("invalid_input"),
    );
  }
  assert.equal(requests, 0);
});

test("a stalled transport or project tool times out and aborts without live requests", async () => {
  let signal: AbortSignal | null | undefined;
  const pending: CopilotTransport = async (_url, init) => {
    signal = init.signal;
    return new Promise<Response>(() => {});
  };
  await assert.rejects(
    runCopilotTurn(input(), { ...config, timeoutMs: 5 }, pending),
    code("timeout"),
  );
  assert.equal(signal?.aborted, true);
  const mock = sequence([[call("one")]]);
  await assert.rejects(
    runCopilotTurn(
      input({ executeTool: async () => new Promise(() => {}) }),
      { ...config, timeoutMs: 5 },
      mock.transport,
    ),
    code("timeout"),
  );
  assert.equal(mock.requests.length, 1);
});
