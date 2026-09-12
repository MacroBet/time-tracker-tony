import { api } from "@/server/http";
import { logout } from "@/server/handlers";
export const runtime = "nodejs";
export const POST = api(logout);
