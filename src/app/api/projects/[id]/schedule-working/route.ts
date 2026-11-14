import { api } from "@/server/http";
import {
  getWorkingSchedule,
  proposeWorkingSchedule,
  commitWorkingSchedule,
} from "@/server/schedule-working";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => getWorkingSchedule(req, id))(request);
}
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => proposeWorkingSchedule(req, id))(request);
}
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return api((req) => commitWorkingSchedule(req, id))(request);
}
