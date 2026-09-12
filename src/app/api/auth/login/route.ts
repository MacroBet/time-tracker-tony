import { api } from "@/server/http";
import { login } from "@/server/handlers";
export const runtime = "nodejs";
export const POST = api(login);
