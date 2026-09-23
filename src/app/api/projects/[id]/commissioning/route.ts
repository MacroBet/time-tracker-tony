import { api } from "@/server/http";
import { updateRegister } from "@/server/commissioning";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => updateRegister(req, id))(request);
}
