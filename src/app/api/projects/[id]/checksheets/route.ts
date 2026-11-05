import { api } from "@/server/http";
import { updateChecksheets } from "@/server/checksheets";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => updateChecksheets(req, id))(request);
}
