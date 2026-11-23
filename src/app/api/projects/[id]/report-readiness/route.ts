import { api } from "@/server/http";
import { getReportReadiness } from "@/server/report-readiness";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => getReportReadiness(req, id))(request);
}
