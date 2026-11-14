import { api } from "@/server/http";
import {
  saveProjectLesson,
  searchProjectLibrary,
} from "@/server/project-library";

export const GET = api(searchProjectLibrary);
export const POST = api(saveProjectLesson);
export const PATCH = api(saveProjectLesson);
