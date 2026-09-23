import { api } from "@/server/http";
import { updateModules } from "@/server/commissioning";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => updateModules(req, id))(request);
}
