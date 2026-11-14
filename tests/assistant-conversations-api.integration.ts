import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MODULES } from "../src/lib/commissioning";
import type { Bootstrap } from "../src/lib/domain";
import type {
  SavedConversation,
  ConversationSummary,
} from "../src/lib/assistant-conversations";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3107",
  projectId = "p-demo-rich",
  path = `/api/projects/${projectId}/copilot/conversations`;
async function request(
  url: string,
  cookie = "",
  method = "GET",
  body?: unknown,
) {
  return fetch(base + url, {
    method,
    headers: {
      Cookie: cookie,
      Origin: base,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function decoded<T>(response: Response, status = 200) {
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
type Result = {
  conversation: SavedConversation;
  created: boolean;
  updated: boolean;
  replay: boolean;
};
type Listing = {
  conversations: ConversationSummary[];
  total: number;
  offset: number;
  limit: number;
};
test("database-history API keeps private project/user scope, full pagination, text-only restoration and idempotent CAS retries", async () => {
  assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname));
  assert.equal(
    (await decoded<{ mode: string }>(await request("/api/auth/session"))).mode,
    "demo",
    "Only isolated local demo; no remote or provider writes.",
  );
  assert.equal((await request(path)).status, 401);
  const admin = await login("u-admin"),
    manager = await login("u4"),
    supervisor = await login("u3"),
    worker = await login("u1");
  assert.equal((await request(path, worker)).status, 403);
  const initial = await decoded<Bootstrap>(
      await request("/api/bootstrap", admin),
    ),
    oldModules = initial.users.find((user) => user.id === "u4")?.modules ?? [
      ...MODULES,
    ];
  const ids = new Map<string, number>(),
    original = await decoded<Listing>(await request(path, manager)),
    supervisorInitial = await decoded<Listing>(await request(path, supervisor));
  const id = randomUUID(),
    input = {
      id,
      version: 0,
      messages: [
        {
          id: "question",
          role: "user",
          text: "# Pump check\n\nShow the saved report.",
          answer: { token: "must-not-persist", extension: { action: "write" } },
          action: "must-not-persist",
        },
      ],
      reportState: {
        projectId,
        query: { report: "tagging", vendor: "Synthetic supplier" },
      },
    };
  let revoked = false;
  try {
    const created = await decoded<Result>(
      await request(path, manager, "PUT", input),
    );
    ids.set(id, created.conversation.version);
    assert(created.created);
    assert(!created.updated);
    assert(!created.replay);
    assert.equal(created.conversation.version, 1);
    assert.equal(
      created.conversation.title,
      "# Pump check Show the saved report.",
    );
    assert.deepEqual(created.conversation.messages, [
      { id: "question", role: "user", text: input.messages[0].text },
    ]);
    assert(!("userId" in created.conversation));
    const retry = await decoded<Result>(
      await request(path, manager, "PUT", input),
    );
    assert(retry.replay);
    assert(!retry.created);
    assert.deepEqual(retry.conversation, created.conversation);
    await decoded(
      await request(path, manager, "PUT", {
        ...input,
        messages: [{ id: "question", role: "user", text: "Different create" }],
      }),
      409,
    );
    await decoded(
      await request(`${path}?conversationId=${id}`, supervisor),
      404,
    );
    await decoded(
      await request(
        `/api/projects/p1/copilot/conversations?conversationId=${id}`,
        manager,
      ),
      404,
    );
    await decoded(
      await request(
        `/api/projects/unknown-${id}/copilot/conversations`,
        manager,
      ),
      404,
    );
    await decoded(
      await request(path, supervisor, "PUT", { ...input, version: 1 }),
      404,
    );
    await decoded(
      await request(path, supervisor, "DELETE", { id, version: 1 }),
      404,
    );
    assert.equal(
      (await decoded<Listing>(await request(path, supervisor))).total,
      supervisorInitial.total,
    );
    await decoded(
      await request(path, manager, "PUT", {
        ...input,
        id: randomUUID(),
        reportState: { projectId: "p1", query: { report: "tagging" } },
      }),
      400,
    );
    const update = {
      ...input,
      version: 1,
      messages: [
        ...created.conversation.messages,
        {
          id: "reply",
          role: "assistant",
          text: "**Saved answer**\n\n- One\n- Two",
          error: "Recorded error",
          answer: { token: "must-not-persist", proposals: [{ write: true }] },
        },
      ],
    };
    const updated = await decoded<Result>(
      await request(path, manager, "PUT", update),
    );
    ids.set(id, updated.conversation.version);
    assert(updated.updated);
    assert.equal(updated.conversation.version, 2);
    assert.equal(
      updated.conversation.createdAt,
      created.conversation.createdAt,
    );
    const updateRetry = await decoded<Result>(
      await request(path, manager, "PUT", update),
    );
    assert(updateRetry.replay);
    assert(!updateRetry.updated);
    assert.deepEqual(updateRetry.conversation, updated.conversation);
    await decoded(
      await request(path, manager, "PUT", {
        ...update,
        messages: [
          { id: "question", role: "user", text: "Stale different update" },
        ],
      }),
      409,
    );
    const restored = await decoded<{ conversation: SavedConversation }>(
      await request(`${path}?conversationId=${id}`, manager),
    );
    assert.deepEqual(restored.conversation, updated.conversation);
    assert(!JSON.stringify(restored).includes("must-not-persist"));
    assert(!("answer" in restored.conversation.messages[1]));
    const concurrent = await Promise.all([
      request(path, manager, "PUT", {
        ...update,
        version: 2,
        messages: [
          ...created.conversation.messages,
          { id: "r3", role: "assistant", text: "A" },
        ],
      }),
      request(path, manager, "PUT", {
        ...update,
        version: 2,
        messages: [
          ...created.conversation.messages,
          { id: "r3", role: "assistant", text: "B" },
        ],
      }),
    ]);
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
    for (const response of concurrent) await response.json();
    ids.set(id, 3);
    await decoded(
      await request(path, manager, "DELETE", { id, version: 2 }),
      409,
    );
    for (let i = 0; i < 30; i++) {
      const extra = randomUUID(),
        saved = await decoded<Result>(
          await request(path, manager, "PUT", {
            id: extra,
            version: 0,
            messages: [{ id: `m${i}`, role: "user", text: `Pagination ${i}` }],
          }),
        );
      ids.set(extra, saved.conversation.version);
    }
    const listing = await decoded<Listing>(await request(path, manager)),
      older = await decoded<Listing>(
        await request(`${path}?offset=30`, manager),
      );
    assert.equal(listing.limit, 30);
    assert.equal(listing.conversations.length, 30);
    assert.equal(listing.total, original.total + 31);
    assert.equal(older.total, listing.total);
    assert(older.conversations.length >= 1);
    assert(!("messages" in listing.conversations[0]));
    assert.equal(typeof listing.conversations[0].messageCount, "number");
    const end = await decoded<Listing>(
      await request(`${path}?offset=${listing.total + 1}`, manager),
    );
    assert.equal(end.total, listing.total);
    assert.deepEqual(end.conversations, []);
    await decoded(await request(`${path}?limit=31`, manager), 400);
    await decoded(
      await request("/api/team/u4/modules", admin, "PATCH", {
        modules: oldModules.filter((module) => module !== "commissioning"),
      }),
    );
    revoked = true;
    await decoded(await request(path, manager), 403);
    await decoded(await request(`${path}?conversationId=${id}`, manager), 403);
    await decoded(
      await request(path, manager, "PUT", { ...input, id: randomUUID() }),
      403,
    );
    await decoded(
      await request(path, manager, "DELETE", { id, version: 3 }),
      403,
    );
    await decoded(
      await request("/api/team/u4/modules", admin, "PATCH", {
        modules: oldModules,
      }),
    );
    revoked = false;
  } finally {
    if (revoked)
      await decoded(
        await request("/api/team/u4/modules", admin, "PATCH", {
          modules: oldModules,
        }),
      );
    for (const [createdId, version] of ids)
      await decoded(
        await request(path, manager, "DELETE", { id: createdId, version }),
      );
  }
  assert.equal(
    (await decoded<Listing>(await request(path, manager))).total,
    original.total,
  );
});
