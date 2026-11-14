import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { reportQuerySchema } from "../src/lib/project-reports";
import {
  MAX_CONVERSATIONS_PAGE_SIZE,
  MAX_CONVERSATION_MESSAGES,
  MAX_CONVERSATION_TEXT,
  MAX_CONVERSATION_BYTES,
  conversationInputSchema,
  sanitizeConversationInput,
  conversationMessageSchema,
  conversationTitle,
  makeConversationTitle,
  savedConversationSchema,
  conversationSummarySchema,
  type ConversationMessage,
  type SavedConversation,
} from "../src/lib/assistant-conversations";

const messages = (): ConversationMessage[] => [
  {
    id: "user-1",
    role: "user",
    text: "Show supplier XYZ **tagging** progress.",
  },
  {
    id: "assistant-1",
    role: "assistant",
    text: "## Supplier XYZ\n\n- L3: **60%**\n\n[Open report](/reports?report=tagging)",
  },
];
const input = () => ({
  id: randomUUID(),
  version: 0,
  messages: messages(),
  reportState: {
    projectId: "p1",
    query: reportQuerySchema.parse({
      report: "tagging",
      vendor: "XYZ",
      level: "L3",
    }),
  },
});
const saved = (): SavedConversation => ({
  id: randomUUID(),
  projectId: "p1",
  version: 1,
  title: conversationTitle(messages()),
  createdAt: "2026-11-14T10:00:00.000Z",
  updatedAt: "2026-11-14T10:00:01.000Z",
  messages: messages(),
  reportState: input().reportState,
});

test("validated database conversation round trips preserve complete Markdown, message identities and structured report filters", () => {
  const current = input(),
    snapshot = structuredClone(current),
    parsed = sanitizeConversationInput(current, "p1");
  assert.deepEqual(parsed, current);
  assert.deepEqual(current, snapshot);
  const conversation = saved();
  assert.deepEqual(
    savedConversationSchema.parse(JSON.parse(JSON.stringify(conversation))),
    conversation,
  );
  assert.equal(parsed.messages[1].text, messages()[1].text);
  assert.equal(parsed.reportState?.query.level, "L3");
});

test("input whitelist discards hydrated answers, actions, confirmation tokens, result snapshots and ownership fields", () => {
  const current = input();
  const unsafe = {
    ...current,
    userId: "foreign-account",
    projectId: "foreign-project",
    title: "Client cannot set the server title",
    token: "root-confirmation-token",
    messages: current.messages.map((message) => ({
      ...message,
      answer: {
        text: "Hydrated answer",
        proposals: [
          { token: "proposal-token", changes: { title: "Unconfirmed write" } },
        ],
        assetSearches: [{ records: [{ name: "Record snapshot" }] }],
      },
      actions: [{ token: "action-token" }],
      pending: true,
    })),
    reportState: {
      ...current.reportState,
      result: { rows: [{ secret: "Snapshot data" }] },
      token: "report-token",
      query: { ...current.reportState.query, confirmationToken: "query-token" },
    },
  };
  const parsed = sanitizeConversationInput(unsafe, "p1"),
    serialized = JSON.stringify(parsed);
  assert.deepEqual(parsed, current);
  for (const value of [
    "Hydrated answer",
    "proposal-token",
    "action-token",
    "Snapshot data",
    "report-token",
    "query-token",
    "foreign-account",
    "foreign-project",
    "Client cannot set",
  ])
    assert(!serialized.includes(value));
  assert(!Object.hasOwn(parsed, "title"));
  assert(!Object.hasOwn(parsed.messages[1], "answer"));
});

test("ignored UI metadata is not traversed or serialized even if it contains circular card objects", () => {
  const current = input(),
    answer: Record<string, unknown> = { token: "never persisted" };
  answer.self = answer;
  const parsed = sanitizeConversationInput(
    {
      ...current,
      messages: current.messages.map((message) => ({ ...message, answer })),
    },
    "p1",
  );
  assert.deepEqual(parsed, current);
});

test("the authorized project cannot be changed by request ownership metadata or a foreign saved report state", () => {
  const current = input();
  assert.throws(
    () => sanitizeConversationInput(current, "different-project"),
    /must belong to this project/,
  );
  assert.throws(
    () =>
      sanitizeConversationInput(
        {
          ...current,
          reportState: { ...current.reportState, projectId: "foreign" },
        },
        "p1",
      ),
    /must belong to this project/,
  );
  assert.equal(
    Object.hasOwn(
      sanitizeConversationInput(
        { ...current, userId: "foreign-account", projectId: "foreign" },
        "p1",
      ),
      "userId",
    ),
    false,
  );
  assert.equal(
    savedConversationSchema.safeParse({
      ...saved(),
      reportState: { ...current.reportState, projectId: "foreign" },
    }).success,
    false,
  );
});

test("client UUID and optimistic version are required; version zero creates and positive versions update", () => {
  const current = input();
  assert.equal(conversationInputSchema.parse(current).version, 0);
  assert.equal(
    conversationInputSchema.parse({ ...current, version: 7 }).version,
    7,
  );
  for (const version of [
    undefined,
    -1,
    1.5,
    "1",
    Number.POSITIVE_INFINITY,
    2147483648,
  ])
    assert.equal(
      conversationInputSchema.safeParse({ ...current, version }).success,
      false,
    );
  assert.equal(
    conversationInputSchema.safeParse({
      ...current,
      id: "client-chosen-non-uuid",
    }).success,
    false,
  );
  assert.equal(
    savedConversationSchema.safeParse({ ...saved(), version: 0 }).success,
    false,
  );
});

test("role, text, errors and IDs are validated without coercing untrusted values", () => {
  const message = messages()[0];
  for (const invalid of [
    { ...message, role: "system" },
    { ...message, role: "tool" },
    { ...message, text: 42 },
    { ...message, text: null },
    { ...message, error: true },
    { ...message, error: "e".repeat(2001) },
    { ...message, id: "" },
    { ...message, id: "x".repeat(151) },
  ])
    assert.equal(conversationMessageSchema.safeParse(invalid).success, false);
  assert.equal(
    conversationMessageSchema.parse({
      ...message,
      error: "The request failed; retry is available.",
    }).error,
    "The request failed; retry is available.",
  );
  assert.equal(
    conversationInputSchema.safeParse({
      ...input(),
      messages: [message, message],
    }).success,
    false,
  );
});

test("message and size caps report validation failures instead of silently truncating active conversation text", () => {
  const current = input(),
    maximum = Array.from({ length: MAX_CONVERSATION_MESSAGES }, (_, index) => ({
      id: `m-${index}`,
      role: "user" as const,
      text: "Short message",
    }));
  assert.equal(
    conversationInputSchema.parse({ ...current, messages: maximum }).messages
      .length,
    MAX_CONVERSATION_MESSAGES,
  );
  assert.equal(
    conversationInputSchema.safeParse({
      ...current,
      messages: [
        ...maximum,
        { id: "extra", role: "assistant", text: "Not silently removed" },
      ],
    }).success,
    false,
  );
  const text = "t".repeat(MAX_CONVERSATION_TEXT);
  assert.equal(
    conversationInputSchema.parse({
      ...current,
      messages: [{ id: "long", role: "assistant", text }],
    }).messages[0].text,
    text,
  );
  assert.equal(
    conversationInputSchema.safeParse({
      ...current,
      messages: [{ id: "too-long", role: "assistant", text: text + "t" }],
    }).success,
    false,
  );
  const large = {
    ...current,
    messages: Array.from({ length: 30 }, (_, index) => ({
      id: `large-${index}`,
      role: "assistant" as const,
      text,
    })),
  };
  assert(
    new TextEncoder().encode(JSON.stringify(large)).byteLength >
      MAX_CONVERSATION_BYTES,
  );
  assert.throws(
    () => conversationInputSchema.parse(large),
    /1 MiB storage limit/,
  );
  assert.equal(large.messages[0].text.length, MAX_CONVERSATION_TEXT);
});

test("the storage size budget measures UTF-8 bytes rather than undercounting Unicode characters", () => {
  const text = "漢".repeat(20000),
    current = {
      ...input(),
      messages: Array.from({ length: 20 }, (_, index) => ({
        id: `unicode-${index}`,
        role: "assistant",
        text,
      })),
    };
  assert(JSON.stringify(current).length < MAX_CONVERSATION_BYTES);
  assert(
    new TextEncoder().encode(JSON.stringify(current)).byteLength >
      MAX_CONVERSATION_BYTES,
  );
  assert.equal(conversationInputSchema.safeParse(current).success, false);
});

test("content accepted at the byte boundary remains readable after server metadata and version growth", () => {
  const current = input();
  current.messages = [
    ...Array.from({ length: 26 }, (_, index) => ({
      id: `boundary-${index}`,
      role: "assistant" as const,
      text: "a".repeat(MAX_CONVERSATION_TEXT),
    })),
    { id: "last", role: "assistant", text: "" },
  ];
  const content = () =>
    new TextEncoder().encode(
      JSON.stringify({
        messages: current.messages,
        reportState: current.reportState,
      }),
    ).byteLength;
  const remaining = MAX_CONVERSATION_BYTES - content();
  assert(remaining > 0 && remaining < MAX_CONVERSATION_TEXT);
  current.messages.at(-1)!.text = "a".repeat(remaining);
  assert.equal(content(), MAX_CONVERSATION_BYTES);
  const parsed = sanitizeConversationInput(current, "p1");
  assert.equal(
    savedConversationSchema.safeParse({
      ...saved(),
      id: parsed.id,
      version: 12345,
      messages: parsed.messages,
      reportState: parsed.reportState,
    }).success,
    true,
  );
});

test("conversation titles derive from the first nonempty user question and the explicit display limit never truncates messages", () => {
  const current = [
    { role: "assistant" as const, text: "Do not use this title" },
    { role: "user" as const, text: "  \n   Supplier XYZ   tagging report  \n" },
    { role: "user" as const, text: "A later question" },
  ];
  assert.equal(conversationTitle(current), "Supplier XYZ tagging report");
  assert.equal(conversationTitle, makeConversationTitle);
  assert.equal(conversationTitle([]), "New conversation");
  const original = "🛠️".repeat(100),
    title = conversationTitle([{ role: "user", text: original }]);
  assert(title.length <= 80);
  assert.equal(title.endsWith("\ud83d"), false);
  assert.equal(original.length, 300);
});

test("persisted rows and summaries reject corrupt dates, version and message counts; thirty is a page bound, not a total retention cap", () => {
  const current = saved(),
    { messages: _messages, reportState: _reportState, ...summary } = current;
  void _messages;
  void _reportState;
  assert.equal(MAX_CONVERSATIONS_PAGE_SIZE, 30);
  assert.equal(
    conversationSummarySchema.parse({ ...summary, messageCount: 2 })
      .messageCount,
    2,
  );
  assert.equal(
    conversationSummarySchema.safeParse({ ...summary, messageCount: 201 })
      .success,
    false,
  );
  assert.equal(
    conversationSummarySchema.safeParse({ ...summary, messageCount: -1 })
      .success,
    false,
  );
  assert.equal(
    savedConversationSchema.safeParse({ ...current, updatedAt: "invalid" })
      .success,
    false,
  );
  assert.equal(
    savedConversationSchema.safeParse({
      ...current,
      updatedAt: "2026-11-13T00:00:00.000Z",
    }).success,
    false,
  );
  assert.equal(
    savedConversationSchema.safeParse({
      ...current,
      token: "corrupt persisted field",
    }).success,
    false,
  );
  assert.equal(
    Array.from({ length: 35 }, () => savedConversationSchema.parse(saved()))
      .length,
    35,
    "No domain rule deletes conversations beyond the first list page",
  );
});
