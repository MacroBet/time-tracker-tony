import { api } from "@/server/http";
import { createTask } from "@/server/handlers";
export const runtime = "nodejs";
export const POST = api(createTask);
