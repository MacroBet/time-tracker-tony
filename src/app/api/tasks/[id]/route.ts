import { api } from "@/server/http";
import { updateTask } from "@/server/handlers";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => updateTask(req, id))(request);
}
