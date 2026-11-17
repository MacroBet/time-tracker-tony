import "server-only";
import { commissioning, hasModule } from "@/lib/commissioning";
import { projectDate } from "@/lib/domain";
import { canManage } from "@/lib/permissions";
import {
  buildProjectProgress,
  projectProgressPopulation,
} from "@/lib/project-progress";
import { resolveWorkingSourceIndex } from "@/lib/schedule-working";
import { requireUser } from "./auth";
import { requireCondition } from "./errors";
import { json } from "./http";
import {
  loadCopilotProjectAccess,
  loadProgrammeSourceIndex,
  loadProjectCommissioning,
} from "./repository";

/** Fresh membership-scoped reads. Complete records stay on the server; the API returns only aggregates. */
export async function loadProjectProgressPopulation(projectId: string) {
  const user = await requireUser();
  requireCondition(
    canManage(user) && hasModule(user, "dashboard"),
    403,
    "Project management and Dashboard access required.",
  );
  const initialAccess = await loadCopilotProjectAccess(user, projectId);
  // Dashboard-only users cannot read the working configuration in bootstrap. It is used here only for aggregation.
  const savedState = await loadProjectCommissioning(projectId, user.id);
  const state = savedState ?? commissioning();
  requireCondition(
    state.version === initialAccess.version,
    409,
    "The project records changed. Refresh the Dashboard.",
  );
  const source = await loadProgrammeSourceIndex(projectId, user.id);
  requireCondition(
    (state.sourceProgrammeSummary?.sha256 ?? null) ===
      (source?.summary.sha256 ?? null),
    409,
    "The source Schedule changed while loading. Refresh the Dashboard.",
  );
  requireCondition(
    !state.workingSchedule ||
      state.workingSchedule.sourceSha256 ===
        (source?.summary.sha256 ?? "managed"),
    409,
    "The working Schedule changed. Refresh the Dashboard.",
  );
  const sourceIndex = source
    ? resolveWorkingSourceIndex(source, state.workingSchedule)
    : undefined;
  const access = await loadCopilotProjectAccess(user, projectId);
  requireCondition(
    access.version === state.version,
    409,
    "The project records changed. Refresh the Dashboard.",
  );
  return {
    state,
    sourceIndex,
    population: projectProgressPopulation(state, sourceIndex),
  };
}

export async function getProjectProgress(_request: Request, projectId: string) {
  const { population } = await loadProjectProgressPopulation(projectId);
  return json(buildProjectProgress(population, projectDate()));
}
