import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "./auth";
import { json, readJson } from "./http";
import { requireCondition } from "./errors";
import { loadData, loadProjectAudit, appendProjectAudit } from "./repository";
import { canManage } from "@/lib/permissions";
import { commissioning, hasModule } from "@/lib/commissioning";
import { projectHistory, type ProjectAuditEvent } from "@/lib/project-audit";
import { exportAssetCsv, exportRegisterJson } from "@/lib/asset-transfer";

async function authorizedProject(projectId: string) {
  const user = await requireUser();
  requireCondition(
    canManage(user) && hasModule(user, "commissioning"),
    403,
    "Commissioning management access required.",
  );
  const data = await loadData(user);
  const project = data.projects.find((p) => p.id === projectId);
  requireCondition(project, 404, "Project not found.");
  return { user, data, project };
}
export async function getProjectAudit(request: Request, projectId: string) {
  const { user, data, project } = await authorizedProject(projectId);
  const params = new URL(request.url).searchParams;
  const paging = z
    .object({
      offset: z.coerce.number().int().min(0).max(1000000),
      limit: z.coerce.number().int().min(1).max(100),
    })
    .parse({
      offset: params.get("offset") ?? 0,
      limit: params.get("limit") ?? 3,
    });
  const history = projectHistory(
    project,
    data.tasks,
    data.activities,
    await loadProjectAudit(projectId, user.id),
  );
  return json({
    events: history.slice(paging.offset, paging.offset + paging.limit),
    total: history.length,
  });
}
export async function exportProjectRegister(
  request: Request,
  projectId: string,
) {
  const { user, project } = await authorizedProject(projectId);
  const input = z
    .object({ action: z.literal("export"), format: z.enum(["json", "csv"]) })
    .strict()
    .parse(await readJson(request));
  const state = commissioning(project);
  // Prepare the real response before recording; this attests preparation, not browser receipt.
  const content =
    input.format === "csv"
      ? exportAssetCsv(state.assets)
      : exportRegisterJson(state);
  const filename = `fieldtrack-${projectId.replace(/[^a-zA-Z0-9_-]/g, "_")}-register.${input.format}`;
  const event: ProjectAuditEvent = {
    id: randomUUID(),
    at: new Date().toISOString(),
    actor: user.name,
    action: "download",
    label: "Register export prepared",
    object: filename,
    detail: `Register version ${state.version}; ${state.assets.length} assets${input.format === "json" ? `; ${state.schedule.length} programme activities` : ""}; ${input.format.toUpperCase()}`,
  };
  await appendProjectAudit(projectId, user.id, event, state);
  return new Response(content, {
    headers: {
      "Content-Type":
        input.format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
