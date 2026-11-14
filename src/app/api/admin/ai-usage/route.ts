import { api } from "@/server/http";
import { getAiUsage } from "@/server/ai-usage";
export const GET = api(getAiUsage);
