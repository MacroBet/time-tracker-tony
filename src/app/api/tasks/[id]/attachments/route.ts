import { api } from "@/server/http";
import { uploadAttachment } from "@/server/handlers";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => uploadAttachment(req, id))(request);
}
