import { api } from "@/server/http";
import { getProjectProgress } from "@/server/project-progress";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => getProjectProgress(req, id))(request);
}
