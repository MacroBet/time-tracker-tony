import { api } from "@/server/http";
import { confirmCopilot } from "@/server/copilot";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => confirmCopilot(req, id))(request);
}
