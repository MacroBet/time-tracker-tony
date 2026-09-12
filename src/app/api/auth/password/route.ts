import { api } from "@/server/http";
import { updatePassword } from "@/server/team";
export const POST = api(updatePassword);
