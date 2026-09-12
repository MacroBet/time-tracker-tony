import { api } from "@/server/http";
import { updateShift } from "@/server/handlers";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => updateShift(req, id))(request);
}
