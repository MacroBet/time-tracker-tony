import { api } from "@/server/http";
import {
  getSourceProgramme,
  importSourceProgramme,
  removeSourceProgramme,
} from "@/server/programme-source";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => getSourceProgramme(req, id))(request);
}
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => importSourceProgramme(req, id))(request);
}
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => removeSourceProgramme(req, id))(request);
}
