import { api } from "@/server/http";
import { getFeedbackScreenshot } from "@/server/handlers";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => getFeedbackScreenshot(req, id))(request);
}
