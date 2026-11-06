import "server-only";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { z } from "zod";
import { requireUser } from "./auth";
import {
  loadProgrammeSourceIndex,
  loadData,
  loadProjectCommissioning,
  saveCommissioning,
} from "./repository";
import { requireCondition } from "./errors";
import { json, readBody } from "./http";
import { commissioning, hasModule } from "@/lib/commissioning";
import {
  sourceProgrammeSchema,
  sourceProgrammeSummary,
  querySourceProgrammeIndex,
} from "@/lib/programme-source";

async function authorizedProgrammeUser() {
  const user = await requireUser();
  requireCondition(
    user.role !== "worker" && hasModule(user, "commissioning"),
    403,
    "Project management commissioning access required.",
  );
  return user;
}
export async function getSourceProgramme(request: Request, projectId: string) {
  const user = await authorizedProgrammeUser();
  const programme = await loadProgrammeSourceIndex(projectId, user.id);
  requireCondition(programme, 404, "No source programme in this project.");
  const query = new URL(request.url).searchParams;
  return json(
    querySourceProgrammeIndex(programme, {
      q: query.get("q") ?? undefined,
      wbs: query.get("wbs") ?? undefined,
      calendar: query.get("calendar") ?? undefined,
      status: query.get("status") ?? undefined,
      page: Number(query.get("page") ?? 0),
      pageSize: 50,
      internalId: query.get("internalId") ?? undefined,
    }),
  );
}
export async function importSourceProgramme(
  request: Request,
  projectId: string,
) {
  const user = await authorizedProgrammeUser();
  const params = new URL(request.url).searchParams;
  const input = z
    .object({
      version: z.coerce.number().int().min(0),
      reason: z.string().trim().min(10).max(1000),
      preview: z.enum(["true", "false"]).default("true"),
    })
    .parse({
      version: params.get("version"),
      reason: params.get("reason"),
      preview: params.get("preview") ?? "true",
    });
  requireCondition(
    request.headers.get("content-type")?.startsWith("application/gzip"),
    415,
    "Choose a compressed source programme.",
  );
  const state =
    (await loadProjectCommissioning(projectId, user.id)) ?? commissioning();
  requireCondition(
    state.version === input.version,
    409,
    "Project changed. Refresh and preview again.",
  );
  const bytes = await readBody(request, 4 * 1024 * 1024);
  let decoded: unknown;
  try {
    decoded = JSON.parse(
      gunzipSync(bytes, { maxOutputLength: 64 * 1024 * 1024 }).toString("utf8"),
    );
  } catch {
    return json(
      {
        error:
          "The compressed programme could not be read. Choose the original XER and preview again.",
      },
      400,
    );
  }
  const programme = sourceProgrammeSchema.parse(decoded),
    summary = sourceProgrammeSummary(programme);
  requireCondition(
    !state.sourceProgrammeSummary ||
      state.sourceProgrammeSummary.sha256 === summary.sha256,
    409,
    "A different source programme is already saved. Preserve it and use a separate project.",
  );
  const contentHash = createHash("sha256")
    .update(JSON.stringify(programme))
    .digest("hex");
  requireCondition(
    !state.sourceProgrammeSummary ||
      state.sourceProgrammeContentHash === contentHash,
    409,
    "Source SHA matches but programme content differs. Preserve the saved programme and review this file.",
  );
  const changes =
    state.sourceProgrammeSummary?.sha256 === summary.sha256
      ? []
      : [
          `Source programme imported: ${summary.activities} activities, ${summary.relationships} relationships; source dates and calendars retained without recalculation.`,
        ];
  if (input.preview === "true")
    return json({ summary, changes, errors: [], version: state.version });
  if (!changes.length)
    return json({ updated: false, version: state.version, summary });
  const next = {
    ...state,
    sourceProgramme: programme,
    sourceProgrammeContentHash: contentHash,
    sourceProgrammeSummary: summary,
    version: state.version + 1,
    revisions: [
      ...state.revisions,
      {
        at: new Date().toISOString(),
        actor: user.name,
        action: "upload" as const,
        reason: input.reason,
        changes,
      },
    ],
  };
  await saveCommissioning(projectId, next, state.version);
  return json({ updated: true, version: next.version, summary });
}

/** Controlled undo of a source-only load; never deletes a project or other work. */
export async function removeSourceProgramme(
  request: Request,
  projectId: string,
) {
  const actor = await authorizedProgrammeUser();
  requireCondition(
    actor.role === "admin",
    403,
    "Only a project administrator can restore a source-only programme load.",
  );
  const params = new URL(request.url).searchParams;
  const input = z
    .object({
      version: z.coerce.number().int().min(0),
      reason: z.string().trim().min(10).max(1000),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      preview: z.enum(["true", "false"]),
    })
    .parse({
      version: params.get("version"),
      reason: params.get("reason"),
      sha256: params.get("sha256"),
      preview: params.get("preview"),
    });
  const state = await loadProjectCommissioning(projectId, actor.id);
  requireCondition(
    state && state.version === input.version,
    409,
    "Project changed. Refresh before restoring.",
  );
  requireCondition(
    state.sourceProgrammeSummary?.sha256 === input.sha256,
    409,
    "The source programme changed. Preserve it and review again.",
  );
  const data = await loadData(actor);
  requireCondition(
    !state.assets.length &&
      !state.schedule.length &&
      !data.tasks.some((task) => task.projectId === projectId),
    409,
    "This project contains other work. Source removal needs a separate reviewed plan.",
  );
  const changes = [
    `Source-only programme load restored: ${state.sourceProgrammeSummary.activities} activities removed from source view; project and audit retained.`,
  ];
  if (input.preview === "true")
    return json({ changes, errors: [], version: state.version });
  const next = {
    ...state,
    sourceProgramme: undefined,
    sourceProgrammeSummary: undefined,
    sourceProgrammeContentHash: undefined,
    version: state.version + 1,
    revisions: [
      ...state.revisions,
      {
        at: new Date().toISOString(),
        actor: actor.name,
        action: "edit" as const,
        reason: input.reason,
        changes,
      },
    ],
  };
  await saveCommissioning(projectId, next, state.version);
  return json({ updated: true, version: next.version });
}
