import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { commissioning } from "@/lib/commissioning";
import {
  applyProjectLessonCommand,
  canEditProjectLessons,
  canReadProjectLibrary,
  ProjectLibraryError,
  projectLessonCommandSchema,
  projectLibraryQuerySchema,
  queryProjectLibrary,
} from "@/lib/project-library";
import { requireUser } from "./auth";
import { HttpError, requireCondition } from "./errors";
import { json, readJson } from "./http";
import {
  loadData,
  loadProjectCommissioning,
  saveCommissioning,
} from "./repository";

export async function searchProjectLibrary(request: Request) {
  const actor = await requireUser();
  requireCondition(
    canReadProjectLibrary(actor),
    403,
    "Management commissioning access is required.",
  );
  const params = new URL(request.url).searchParams;
  const options = projectLibraryQuerySchema.parse(Object.fromEntries(params));
  // Load current memberships on every request; no global or per-query index.
  return json(queryProjectLibrary(await loadData(actor), actor, options));
}

const mutationSchema = z
  .object({
    projectId: z.string().trim().min(1).max(150),
    version: z.number().int().min(0),
    reason: z.string().trim().min(10).max(1000),
    command: projectLessonCommandSchema,
  })
  .strict();

export async function saveProjectLesson(request: Request) {
  const actor = await requireUser();
  requireCondition(
    canEditProjectLessons(actor),
    403,
    "Manager commissioning access is required.",
  );
  const input = mutationSchema.parse(await readJson(request, 64000));
  requireCondition(
    (request.method === "POST" && input.command.kind === "create") ||
      (request.method === "PATCH" && input.command.kind === "update"),
    400,
    "Use POST to create a lesson and PATCH to update it.",
  );
  const data = await loadData(actor);
  const project = data.projects.find((entry) => entry.id === input.projectId);
  requireCondition(project, 404, "Project not found.");
  const state =
    (await loadProjectCommissioning(project.id, actor.id)) ?? commissioning();
  requireCondition(
    state.version === input.version,
    409,
    "Project changed. Refresh before saving.",
  );
  const now = new Date().toISOString();
  let result;
  try {
    result = applyProjectLessonCommand(
      data,
      actor,
      { ...project, commissioning: state },
      input.command,
      {
        id: randomUUID(),
        now,
      },
    );
  } catch (error) {
    if (error instanceof ProjectLibraryError)
      throw new HttpError(error.status, error.message);
    throw error;
  }
  const next = {
    ...state,
    lessons: result.lessons,
    version: state.version + 1,
    revisions: [
      ...state.revisions,
      {
        at: now,
        actor: actor.name,
        action: "edit" as const,
        reason: input.reason,
        changes: result.changes,
      },
    ],
  };
  await saveCommissioning(project.id, next, state.version);
  return json(
    { updated: true, version: next.version, lesson: result.lesson },
    request.method === "POST" ? 201 : 200,
  );
}
