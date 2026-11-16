import "server-only";
import { z } from "zod";
import type { SQL } from "drizzle-orm";
import {
  MAX_CONVERSATION_BYTES,
  MAX_CONVERSATION_VERSION,
  conversationTitle,
  conversationSummarySchema,
  sanitizeConversationInput,
  savedConversationSchema,
  type SavedConversation,
  type ConversationInput,
} from "@/lib/assistant-conversations";
import { canUseCopilot } from "@/lib/copilot";
import { requireUser } from "./auth";
import { loadCopilotProjectAccess } from "./repository";
import { requireCondition } from "./errors";
import { json, readJson } from "./http";
import { dataMode } from "./config";
import { db } from "./db/client";
import {
  conversationCreateQuery,
  conversationDeleteQuery,
  conversationDetailQuery,
  conversationListQuery,
  conversationUpdateQuery,
} from "./db/assistant-conversations";

type StoredConversation = SavedConversation & { userId: string };
type HistoryGlobal = typeof globalThis & {
  fieldtrackAssistantConversations?: Map<string, StoredConversation>;
};
const demoStore = () => {
  const global = globalThis as HistoryGlobal;
  return (global.fieldtrackAssistantConversations ??= new Map());
};
function demoDetail(userId: string, projectId: string, id: string) {
  const row = demoStore().get(id);
  return row?.userId === userId && row.projectId === projectId
    ? conversation(row)
    : undefined;
}
async function authorized(projectId: string) {
  const user = await requireUser();
  requireCondition(
    canUseCopilot(user),
    403,
    "Assistant history requires task and commissioning management access.",
  );
  await loadCopilotProjectAccess(user, projectId);
  return user;
}
const stamp = (value: unknown) => new Date(value as string).toISOString();
function conversation(value: Record<string, unknown>): SavedConversation {
  const input = sanitizeConversationInput(
    {
      id: value.id,
      version: value.version,
      messages: value.messages,
      ...(value.reportState ? { reportState: value.reportState } : {}),
    },
    String(value.projectId),
  );
  return savedConversationSchema.parse({
    id: input.id,
    projectId: value.projectId,
    title: value.title,
    version: input.version,
    createdAt: stamp(value.createdAt),
    updatedAt: stamp(value.updatedAt),
    messages: input.messages,
    ...(input.reportState ? { reportState: input.reportState } : {}),
  });
}
async function execute(query: SQL) {
  return (await db().execute(query)).rows as Record<string, unknown>[];
}
async function detail(userId: string, projectId: string, id: string) {
  if (dataMode() === "demo") {
    return demoDetail(userId, projectId, id);
  }
  const row = (
    await execute(conversationDetailQuery(userId, projectId, id))
  )[0];
  return row ? conversation(row) : undefined;
}
const listSchema = z.object({
  offset: z.coerce.number().int().min(0).max(2147483647).default(0),
  limit: z.coerce.number().int().min(1).max(30).default(30),
});
export async function getAssistantConversations(
  request: Request,
  projectId: string,
) {
  const user = await authorized(projectId),
    url = new URL(request.url),
    id = url.searchParams.get("conversationId");
  if (id !== null) {
    const row = await detail(
      user.id,
      projectId,
      z.uuid().parse(id).toLowerCase(),
    );
    requireCondition(row, 404, "Conversation not found.");
    return json({ conversation: row });
  }
  const { offset, limit } = listSchema.parse(
    Object.fromEntries(url.searchParams),
  );
  if (dataMode() === "demo") {
    const visible = [...demoStore().values()]
      .filter((row) => row.userId === user.id && row.projectId === projectId)
      .sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
      );
    const conversations = visible.slice(offset, offset + limit).map((row) =>
      conversationSummarySchema.parse({
        id: row.id,
        projectId: row.projectId,
        title: row.title,
        version: row.version,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        messageCount: row.messages.length,
      }),
    );
    return json({ conversations, total: visible.length, offset, limit });
  }
  const result = (
    await execute(conversationListQuery(user.id, projectId, offset, limit))
  )[0];
  const conversations = (result.conversations as Record<string, unknown>[]).map(
    (row) =>
      conversationSummarySchema.parse({
        ...row,
        createdAt: stamp(row.createdAt),
        updatedAt: stamp(row.updatedAt),
      }),
  );
  return json({ conversations, total: result.total, offset, limit });
}
const samePayload = (existing: SavedConversation, input: ConversationInput) =>
  JSON.stringify({
    messages: existing.messages,
    reportState: existing.reportState,
  }) ===
  JSON.stringify({ messages: input.messages, reportState: input.reportState });
export async function putAssistantConversation(
  request: Request,
  projectId: string,
) {
  const user = await authorized(projectId),
    input = sanitizeConversationInput(
      await readJson(request, MAX_CONVERSATION_BYTES + 4096),
      projectId,
    );
  input.id = input.id.toLowerCase();
  if (dataMode() === "demo") {
    const existing = demoDetail(user.id, projectId, input.id),
      collision = demoStore().has(input.id);
    if (input.version === 0 && existing) {
      requireCondition(
        samePayload(existing, input),
        409,
        "Conversation already exists with different messages. Refresh before retrying.",
      );
      return json({
        conversation: existing,
        created: false,
        updated: false,
        replay: true,
      });
    }
    if (input.version === 0)
      requireCondition(!collision, 404, "Conversation not found.");
    else {
      requireCondition(existing, 404, "Conversation not found.");
      if (
        existing.version === input.version + 1 &&
        samePayload(existing, input)
      )
        return json({
          conversation: existing,
          created: false,
          updated: false,
          replay: true,
        });
      requireCondition(
        existing.version === input.version &&
          input.version < MAX_CONVERSATION_VERSION,
        409,
        "Conversation changed. Reload it before saving.",
      );
    }
    const at = new Date().toISOString();
    const saved = conversation({
      id: input.id,
      projectId,
      title: conversationTitle(input.messages),
      messages: input.messages,
      reportState: input.reportState,
      version: input.version + 1,
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
    });
    demoStore().set(input.id, { ...saved, userId: user.id });
    return json({
      conversation: saved,
      created: input.version === 0,
      updated: input.version > 0,
      replay: false,
    });
  }
  const saved = (
    await execute(
      input.version === 0
        ? conversationCreateQuery(user.id, projectId, input)
        : conversationUpdateQuery(user.id, projectId, input),
    )
  )[0];
  if (saved)
    return json({
      conversation: conversation(saved),
      created: input.version === 0,
      updated: input.version > 0,
      replay: false,
    });
  const existing = await detail(user.id, projectId, input.id);
  requireCondition(existing, 404, "Conversation not found.");
  if (
    (input.version === 0 || existing.version === input.version + 1) &&
    samePayload(existing, input)
  )
    return json({
      conversation: existing,
      created: false,
      updated: false,
      replay: true,
    });
  requireCondition(
    false,
    409,
    "Conversation changed. Reload it before saving.",
  );
}
const deleteSchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().min(1).max(MAX_CONVERSATION_VERSION),
  })
  .strict();
export async function deleteAssistantConversation(
  request: Request,
  projectId: string,
) {
  const user = await authorized(projectId),
    input = deleteSchema.parse(await readJson(request));
  input.id = input.id.toLowerCase();
  if (dataMode() === "demo") {
    const existing = demoDetail(user.id, projectId, input.id);
    requireCondition(existing, 404, "Conversation not found.");
    requireCondition(
      existing.version === input.version,
      409,
      "Conversation changed. Reload it before deleting.",
    );
    demoStore().delete(input.id);
  } else {
    const removed = await execute(
      conversationDeleteQuery(user.id, projectId, input.id, input.version),
    );
    if (!removed.length) {
      requireCondition(
        await detail(user.id, projectId, input.id),
        404,
        "Conversation not found.",
      );
      requireCondition(
        false,
        409,
        "Conversation changed. Reload it before deleting.",
      );
    }
  }
  return json({ deleted: true });
}
