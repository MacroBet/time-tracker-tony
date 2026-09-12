import { api } from "@/server/http";
import { sessionInfo } from "@/server/handlers";
export const runtime = "nodejs";
export const GET = api(sessionInfo);
