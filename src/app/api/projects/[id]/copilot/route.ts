import { api } from "@/server/http";
import { getCopilot, chatCopilot } from "@/server/copilot";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return api((req) => getCopilot(req, id))(request);
}
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return api((req) => chatCopilot(req, id))(request);
}
