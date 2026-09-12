import { api } from "@/server/http";
import { createShift } from "@/server/handlers";
export const runtime = "nodejs";
export const POST = api(createShift);
