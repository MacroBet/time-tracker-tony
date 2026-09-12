import { api } from "@/server/http";
import { createFeedback } from "@/server/handlers";
export const runtime = "nodejs";
export const POST = api(createFeedback);
