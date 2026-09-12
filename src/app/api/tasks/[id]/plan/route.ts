import { api } from "@/server/http";
import { plan } from "@/server/operations";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => plan(req, id))(request);
}
