import { api } from "@/server/http";
import { getProjectAudit, exportProjectRegister } from "@/server/project-audit";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return api((req) => getProjectAudit(req, id))(request);
}
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return api((req) => exportProjectRegister(req, id))(request);
}
