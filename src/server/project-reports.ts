import "server-only";
import { z } from "zod";
import {
  commissioning,
  hasModule,
  type Commissioning,
} from "@/lib/commissioning";
import { canManage, isProjectMember } from "@/lib/permissions";
import {
  buildProjectReport,
  projectReportCsv,
  reportQuerySchema,
  type ProjectReportQuery,
} from "@/lib/project-reports";
import {
  resolveWorkingSourceIndex,
  type WorkingSchedule,
} from "@/lib/schedule-working";
import { requireUser } from "./auth";
import { requireCondition } from "./errors";
import { json } from "./http";
import { loadData, loadProgrammeSourceIndex } from "./repository";

type AssistantReportAccess = { userId: string; projectVersion: number };
async function authorizedReport(
  projectId: string,
  assistant?: AssistantReportAccess,
) {
  const user = await requireUser();
  requireCondition(
    !assistant ||
      (assistant.userId === user.id &&
        hasModule(user, "tasks") &&
        hasModule(user, "commissioning")),
    403,
    "Assistant access changed. Start a new conversation.",
  );
  requireCondition(
    canManage(user) && hasModule(user, "reports"),
    403,
    "Project management and Reports access required.",
  );
  const data = await loadData(user);
  const project = data.projects.find((row) => row.id === projectId);
  requireCondition(
    project && isProjectMember(user, projectId, data),
    404,
    "Project not found.",
  );
  const state = commissioning(project),
    source = await loadProgrammeSourceIndex(projectId, user.id);
  requireCondition(
    !assistant || state.version === assistant.projectVersion,
    409,
    "The project records changed. Refresh before asking again.",
  );
  requireCondition(
    (state.sourceProgrammeSummary?.sha256 ?? null) ===
      (source?.summary.sha256 ?? null),
    409,
    "The source schedule changed while loading. Refresh the report.",
  );
  const working = (
    state as Commissioning & { workingSchedule?: WorkingSchedule }
  ).workingSchedule;
  const sourceIndex = source
    ? resolveWorkingSourceIndex(source, working)
    : undefined;
  return { data, sourceIndex, version: state.version };
}
/** Used by both deterministic assistant tools and the report API; fresh authorization every time. */
export async function loadProjectReport(
  projectId: string,
  raw: unknown,
  assistant?: AssistantReportAccess,
) {
  const query = reportQuerySchema.parse(raw),
    { data, sourceIndex } = await authorizedReport(projectId, assistant);
  return buildProjectReport(data, projectId, query, { sourceIndex });
}
export async function getProjectReport(request: Request, projectId: string) {
  const params = new URL(request.url).searchParams;
  const format = z.enum(["json", "csv"]).parse(params.get("format") ?? "json");
  const raw = Object.fromEntries(params);
  delete raw.format;
  const expectedVersion = params.has("version")
    ? z.coerce.number().int().min(0).parse(params.get("version"))
    : undefined;
  delete raw.version;
  const query: ProjectReportQuery = reportQuerySchema.parse(raw);
  if (format === "json") return json(await loadProjectReport(projectId, query));
  const { data, sourceIndex, version } = await authorizedReport(projectId);
  requireCondition(
    expectedVersion === undefined || expectedVersion === version,
    409,
    "The report records changed. Refresh before exporting the complete result.",
  );
  const result = projectReportCsv(data, projectId, query, { sourceIndex });
  return new Response(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fieldtrack-${query.report}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Report-Total": String(result.total),
      "X-Report-Version": String(result.revision.register),
    },
  });
}
