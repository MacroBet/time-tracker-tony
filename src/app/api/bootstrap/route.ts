import { api } from "@/server/http";
import { bootstrap } from "@/server/handlers";
export const runtime = "nodejs";
export const GET = api(bootstrap);
