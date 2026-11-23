import "server-only";
import { commissioning, hasModule } from "@/lib/commissioning";
import { canManage } from "@/lib/permissions";
import { buildReportReadiness } from "@/lib/report-readiness";
import { resolveWorkingSourceIndex } from "@/lib/schedule-working";
import {
  copilotTaskVersions,
  sameCopilotTaskVersions,
} from "@/lib/copilot-snapshot";
import { requireUser } from "./auth";
import { requireCondition } from "./errors";
import { json } from "./http";
import {
  loadCopilotData,
  loadCopilotProjectAccess,
  loadProgrammeSourceIndex,
  loadProjectCommissioning,
} from "./repository";

/** All records remain server-side; each delivery rechecks membership and project/task versions. */
export async function loadReportReadiness(
  projectId: string,
  assistant?: { userId: string; projectVersion: number },
) {
  const user = await requireUser();
  requireCondition(
    canManage(user) &&
      (hasModule(user, "dashboard") || hasModule(user, "reports")),
    403,
    "Project management and Dashboard or Reports access required.",
  );
  requireCondition(
    !assistant ||
      (assistant.userId === user.id &&
        hasModule(user, "tasks") &&
        hasModule(user, "commissioning")),
    403,
    "Assistant access changed. Start a new conversation.",
  );
  const initial = await loadCopilotProjectAccess(user, projectId, true);
  const data = await loadCopilotData(user, projectId);
  const project = data.projects.find((row) => row.id === projectId);
  requireCondition(project, 404, "Project not found.");
  // Dashboard-only projection omits working configuration; aggregates must still use the complete saved programme.
  const state =
    (await loadProjectCommissioning(projectId, user.id)) ?? commissioning();
  requireCondition(
    state.version === initial.version &&
      (!assistant || state.version === assistant.projectVersion),
    409,
    "The project records changed. Refresh before checking the import again.",
  );
  project.commissioning = state;
  const source = await loadProgrammeSourceIndex(projectId, user.id);
  requireCondition(
    !source || state.sourceProgrammeSummary?.sha256 === source.summary.sha256,
    409,
    "The source Schedule changed. Refresh before checking the import again.",
  );
  requireCondition(
    !state.workingSchedule ||
      state.workingSchedule.sourceSha256 ===
        (source?.summary.sha256 ??
          state.sourceProgrammeSummary?.sha256 ??
          "managed"),
    409,
    "The working Schedule changed. Refresh before checking the import again.",
  );
  const sourceIndex = source
    ? resolveWorkingSourceIndex(source, state.workingSchedule)
    : undefined;
  const result = buildReportReadiness(data, projectId, sourceIndex, {
    taskAccess: hasModule(user, "tasks"),
  });
  const finalUser = await requireUser();
  requireCondition(
    finalUser.id === user.id &&
      finalUser.role === user.role &&
      JSON.stringify(finalUser.modules) === JSON.stringify(user.modules),
    403,
    "Project access changed. Refresh before checking the import again.",
  );
  const final = await loadCopilotProjectAccess(finalUser, projectId, true);
  requireCondition(
    final.version === state.version &&
      final.name === initial.name &&
      (!hasModule(user, "tasks") ||
        sameCopilotTaskVersions(
          final.taskVersions ?? [],
          copilotTaskVersions(data, projectId),
        )),
    409,
    "Project records changed while checking the import. Refresh and try again.",
  );
  return result;
}

export async function getReportReadiness(_request: Request, projectId: string) {
  return json(await loadReportReadiness(projectId));
}
