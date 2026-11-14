import { z } from "zod";
import type { CopilotChatMessage } from "./copilot";
import {
  assistantReportStateSchema,
  type AssistantReportState,
} from "./assistant-report-state";

/** Page size only. The server can paginate an unlimited number of conversations. */
export const MAX_CONVERSATIONS_PAGE_SIZE = 30;
export const MAX_CONVERSATIONS = MAX_CONVERSATIONS_PAGE_SIZE;
export const MAX_CONVERSATION_MESSAGES = 200;
export const MAX_CONVERSATION_TEXT = 40000;
export const MAX_CONVERSATION_TITLE = 80;
/** Persisted content only; bounded identity, version and row timestamps are stored separately. */
export const MAX_CONVERSATION_BYTES = 1024 * 1024;
export const MAX_CONVERSATION_VERSION = 2147483647;
const identifier = z
  .string()
  .min(1)
  .max(150)
  .refine(
    (value) => value.trim() === value,
    "Identifier must not start or end with whitespace",
  );
export const conversationMessageSchema = z
  .object({
    id: identifier,
    role: z.enum(["user", "assistant"]),
    text: z.string().max(MAX_CONVERSATION_TEXT),
    error: z.string().max(2000).optional(),
  })
  .strict();
export type ConversationMessage = CopilotChatMessage & {
  id: string;
  error?: string;
};
const messagesSchema = z
  .array(conversationMessageSchema)
  .max(MAX_CONVERSATION_MESSAGES)
  .superRefine((messages, context) => {
    if (new Set(messages.map((message) => message.id)).size !== messages.length)
      context.addIssue({
        code: "custom",
        message: "Message identifiers must be unique within a conversation",
      });
  });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
function pick(value: unknown, keys: readonly string[]): unknown {
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    keys
      .filter((key) => Object.hasOwn(value, key))
      .map((key) => [key, value[key]]),
  );
}
const reportQueryKeys = [
  "report",
  "vendor",
  "level",
  "late",
  "discipline",
  "query",
  "activity",
  "from",
  "workStatus",
  "activityStatus",
  "offset",
  "limit",
] as const;
function contentBytes(value: {
  messages: readonly ConversationMessage[];
  reportState?: AssistantReportState;
}) {
  return new TextEncoder().encode(
    JSON.stringify({
      messages: value.messages,
      reportState: value.reportState,
    }),
  ).byteLength;
}
/** Persist text and report filters only, never hydrated cards, proposals, tokens, ownership or snapshots. */
function inputWhitelist(value: unknown): unknown {
  const input = pick(value, ["id", "version", "messages", "reportState"]);
  if (!isRecord(input)) return input;
  if (Array.isArray(input.messages))
    input.messages = input.messages.map((message) =>
      pick(message, ["id", "role", "text", "error"]),
    );
  if (input.reportState !== undefined) {
    input.reportState = pick(input.reportState, ["projectId", "query"]);
    if (isRecord(input.reportState))
      input.reportState.query = pick(input.reportState.query, reportQueryKeys);
  }
  return input;
}
const boundedInputSchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().min(0).max(MAX_CONVERSATION_VERSION),
    messages: messagesSchema,
    reportState: assistantReportStateSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (contentBytes(input) > MAX_CONVERSATION_BYTES)
      context.addIssue({
        code: "custom",
        message:
          "Conversation exceeds the 1 MiB storage limit. Start a new conversation; no existing messages have been shortened.",
      });
  });
export const conversationInputSchema = z.preprocess(
  inputWhitelist,
  boundedInputSchema,
);
export type ConversationInput = z.infer<typeof conversationInputSchema>;
/** The enclosing server route supplies the authorized project; the request cannot override that scope. */
export function sanitizeConversationInput(
  raw: unknown,
  projectId: string,
): ConversationInput {
  const project = identifier.parse(projectId),
    input = conversationInputSchema.parse(raw);
  if (input.reportState && input.reportState.projectId !== project)
    throw new z.ZodError([
      {
        code: "custom",
        path: ["reportState", "projectId"],
        message: "Saved report state must belong to this project",
      },
    ]);
  return input;
}
export function makeConversationTitle(
  messages: readonly Pick<CopilotChatMessage, "role" | "text">[],
): string {
  const first = messages.find(
    (message) => message.role === "user" && message.text.trim(),
  );
  const title = first?.text.trim().replace(/\s+/g, " ") || "New conversation";
  let result = "";
  // Display titles have an explicit bound; message text is never truncated.
  for (const character of title) {
    if ((result + character).length > MAX_CONVERSATION_TITLE) break;
    result += character;
  }
  return result;
}
export const conversationTitle = makeConversationTitle;
const summaryFields = {
  id: z.uuid(),
  projectId: identifier,
  title: z.string().min(1).max(MAX_CONVERSATION_TITLE),
  version: z.number().int().min(1).max(MAX_CONVERSATION_VERSION),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};
export const conversationSummarySchema = z
  .object({
    ...summaryFields,
    messageCount: z.number().int().min(0).max(MAX_CONVERSATION_MESSAGES),
  })
  .strict()
  .superRefine((summary, context) => {
    if (Date.parse(summary.updatedAt) < Date.parse(summary.createdAt))
      context.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "Update time must follow creation time",
      });
  });
export const savedConversationSchema = z
  .object({
    ...summaryFields,
    messages: messagesSchema,
    reportState: assistantReportStateSchema.optional(),
  })
  .strict()
  .superRefine((conversation, context) => {
    if (Date.parse(conversation.updatedAt) < Date.parse(conversation.createdAt))
      context.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "Update time must follow creation time",
      });
    if (
      conversation.reportState &&
      conversation.reportState.projectId !== conversation.projectId
    )
      context.addIssue({
        code: "custom",
        path: ["reportState", "projectId"],
        message: "Saved report state must belong to this project",
      });
    if (contentBytes(conversation) > MAX_CONVERSATION_BYTES)
      context.addIssue({
        code: "custom",
        message: "Conversation exceeds the 1 MiB storage limit",
      });
  });
export type SavedConversation = {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
  reportState?: AssistantReportState;
  version: number;
};
export type ConversationSummary = Omit<
  SavedConversation,
  "messages" | "reportState"
> & { messageCount: number };
