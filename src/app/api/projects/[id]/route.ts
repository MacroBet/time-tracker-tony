import { api } from "@/server/http";
import { renameProject } from "@/server/team";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => renameProject(req, id))(request);
}
