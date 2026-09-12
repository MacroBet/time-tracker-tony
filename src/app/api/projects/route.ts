import { api } from "@/server/http";
import { createProject } from "@/server/team";
export const POST = api(createProject);
