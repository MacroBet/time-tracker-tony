import "server-only";
import { z } from "zod";
import { requireUser } from "./auth";
import {
  loadData,
  loadProjectCommissioning,
  saveCommissioning,
} from "./repository";
import { HttpError, requireCondition } from "./errors";
import { json, readJson } from "./http";
import { commissioning, hasModule } from "@/lib/commissioning";
import {
  applyChecksheetCommand,
  checksheetCommandSchema,
} from "@/lib/checksheets";

export async function updateChecksheets(request: Request, projectId: string) {
  const actor = await requireUser();
  requireCondition(
    hasModule(actor, "commissioning"),
    403,
    "Commissioning access required.",
  );
  const input = z
    .object({
      version: z.number().int().min(0),
      reason: z.string().trim().min(10).max(1000),
      command: checksheetCommandSchema,
    })
    .strict()
    .parse(await readJson(request, 2 * 1024 * 1024));
  const data = await loadData(actor);
  requireCondition(
    data.projects.some((project) => project.id === projectId),
    404,
    "Project not found.",
  );
  const state =
    (await loadProjectCommissioning(projectId, actor.id)) ?? commissioning();
  requireCondition(
    state.version === input.version,
    409,
    "Project changed. Refresh before saving.",
  );
  const members = new Set(
    data.memberships
      .filter((m) => m.projectId === projectId)
      .map((m) => m.userId),
  );
  let result;
  try {
    result = applyChecksheetCommand(state.checksheets, input.command, {
      actor,
      assets: state.assets,
      users: data.users.filter((user) => members.has(user.id)),
      tasks: data.tasks.filter((task) => task.projectId === projectId),
      now: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof Error) throw new HttpError(400, error.message);
    throw error;
  }
  if (!result.changes.length)
    return json({ updated: false, version: state.version });
  const next = {
    ...state,
    checksheets: result.state,
    version: state.version + 1,
    revisions: [
      ...state.revisions,
      {
        at: new Date().toISOString(),
        actor: actor.name,
        action: "edit" as const,
        reason: input.reason,
        changes: result.changes,
      },
    ],
  };
  await saveCommissioning(projectId, next, state.version);
  return json({
    updated: true,
    version: next.version,
    changes: result.changes,
  });
}
