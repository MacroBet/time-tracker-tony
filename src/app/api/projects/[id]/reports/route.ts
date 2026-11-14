import { api } from "@/server/http";
import { getProjectReport } from "@/server/project-reports";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => getProjectReport(req, id))(request);
}
