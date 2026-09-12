import { api } from "@/server/http";
import { createAccount } from "@/server/team";
export const POST = api(createAccount);
