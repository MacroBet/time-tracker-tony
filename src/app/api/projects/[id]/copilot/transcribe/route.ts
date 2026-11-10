import { api } from "@/server/http";
import { transcribeCopilot } from "@/server/copilot-transcription";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return api((req) => transcribeCopilot(req, id))(request);
}
