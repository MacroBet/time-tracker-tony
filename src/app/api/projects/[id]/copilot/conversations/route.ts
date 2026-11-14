import { api } from "@/server/http";
import {
  getAssistantConversations,
  putAssistantConversation,
  deleteAssistantConversation,
} from "@/server/assistant-conversations";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return api((req) => getAssistantConversations(req, id))(request);
}
export async function PUT(request: Request, context: Context) {
  const { id } = await context.params;
  return api((req) => putAssistantConversation(req, id))(request);
}
export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  return api((req) => deleteAssistantConversation(req, id))(request);
}
