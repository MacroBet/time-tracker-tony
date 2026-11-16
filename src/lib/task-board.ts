import type { Project, Task } from "./domain";
import { projectDate } from "./domain";
import { commissioning, dueDateFor } from "./commissioning";
import {
  activityStepProgress,
  assetStepProgress,
  operationalStatus,
  type StepProgress,
  type OperationalStatus,
} from "./project-reports";
import type { SourceProgrammePage } from "./programme-source";

export const taskTableColumns = [
  { id: "name", label: "Activity / ID" },
  { id: "progress", label: "Required steps" },
  { id: "status", label: "Task status" },
  { id: "dates", label: "Dates / duration" },
  { id: "equipment", label: "Equipment / area" },
  { id: "responsible", label: "Responsible / company" },
  { id: "priority", label: "Priority / discipline" },
] as const;
export type TaskTableColumn = (typeof taskTableColumns)[number]["id"];
export function toggleTaskColumn(
  columns: TaskTableColumn[],
  id: TaskTableColumn,
) {
  if (id === "name") return columns;
  return columns.includes(id)
    ? columns.filter((column) => column !== id)
    : taskTableColumns
        .map((column) => column.id)
        .filter((column) => column === id || columns.includes(column));
}

export function taskManagedDates(task: Task, project?: Project) {
  if (!project || project.id !== task.projectId) return undefined;
  const state = commissioning(project),
    reference = task.cx?.activityId;
  const working =
    state.workingSchedule?.sourceSha256 ===
    (state.sourceProgrammeSummary?.sha256 ?? "managed")
      ? state.workingSchedule
      : undefined;
  const added =
    working?.addedActivities.filter((row) => row.taskId === task.id) ?? [];
  if (added.length === 1) {
    const row = added[0];
    const patch = working?.activityPatches.find(
      (entry) => entry.internalId === row.internalId,
    );
    return {
      start: patch?.start ?? row.start,
      finish: patch?.finish ?? row.finish,
      activityId: row.activityId,
      origin: "Working Schedule",
    };
  }
  const id = reference?.startsWith("managed:") ? reference.slice(8) : reference;
  const rows = state.schedule.filter((row) => row.activityId === id);
  if (
    !reference ||
    reference.startsWith("source:") ||
    rows.length !== 1 ||
    (state.sourceProgrammeSummary && !reference.startsWith("managed:"))
  )
    return undefined;
  const row = rows[0];
  const patch =
    working?.sourceSha256 === "managed"
      ? working.activityPatches.find(
          (entry) => entry.internalId === row.activityId,
        )
      : undefined;
  return {
    ...row,
    start: patch?.start ?? row.start,
    finish: patch?.finish ?? row.finish,
    origin: "FieldTrack Schedule",
  };
}

export type TaskStepSummary = {
  progress: StepProgress | null;
  status: OperationalStatus;
  description: string;
};
/** Task workflow status, tag approval and signatures never provide step completion. */
export function taskStepSummary(
  task: Task,
  project?: Project,
  tasks: Task[] = [],
  today = projectDate(),
): TaskStepSummary {
  if (!project || project.id !== task.projectId)
    return {
      progress: null,
      status: {
        status: "unknown",
        colour: null,
        label: "Project context unavailable",
      },
      description:
        "Step progress unknown: this task has no available project context. Task status is recorded separately.",
    };
  const state = commissioning(project);
  const asset = state.assets.find((row) => row.id === task.cx?.assetId);
  if (asset) {
    const progress = assetStepProgress(state, asset.id, task.cx?.level);
    const openWorks = (state.checksheets?.worksToGo ?? []).filter(
      (work) =>
        work.status === "open" &&
        (work.assetId === asset.id || work.taskId === task.id),
    ).length;
    return {
      progress,
      status: operationalStatus({
        due: dueDateFor(task),
        completedAt: progress.completedAt,
        completed: progress.complete,
        openWorks,
        today,
      }),
      description: `${asset.name}${task.cx?.level ? ` · ${task.cx.level}` : " · all required active tags"}: ${progress.passed}/${progress.required} required applicable steps passed${progress.missingSheets ? `; ${progress.missingSheets} checksheet(s) missing` : ""}. Task status is recorded separately.`,
    };
  }
  if (task.cx?.activityId && !state.sourceProgrammeSummary) {
    const progress = activityStepProgress(
      state,
      tasks.filter((row) => row.projectId === task.projectId),
      task.cx.activityId,
      today,
    );
    if (!progress.unknownReason)
      return {
        progress,
        status: progress.status,
        description: `Linked Schedule activity: ${progress.passed}/${progress.required} required applicable steps passed${progress.missingSheets ? `; ${progress.missingSheets} checksheet(s) missing` : ""}. Task status is recorded separately.`,
      };
  }
  return {
    progress: null,
    status: {
      status: "unknown",
      colour: null,
      label: "No verified checksheet mapping",
    },
    description:
      "Step progress unknown: no applicable asset or verified activity/checksheet mapping is available in these saved task records. Task status is recorded separately.",
  };
}

/** Resolve exact source identities over every matching page; never accept the first fuzzy match. */
export async function taskSourceDetail(
  reference: string,
  sourceSha256: string,
  request: (query: URLSearchParams) => Promise<SourceProgrammePage>,
) {
  const canonical = /^source:([a-f0-9]{64}):(.+)$/.exec(reference);
  if (canonical && canonical[1] !== sourceSha256)
    throw Error(
      "The source schedule changed. Reopen the activity from the current Schedule.",
    );
  if (reference.startsWith("managed:")) return undefined;
  const checked = async (query: URLSearchParams) => {
    const result = await request(query);
    if (result.summary.sha256 !== sourceSha256)
      throw Error(
        "The source schedule changed. Reopen the activity from the current Schedule.",
      );
    return result;
  };
  if (canonical) {
    const result = await checked(
      new URLSearchParams({ view: "source", internalId: canonical[2] }),
    );
    if (result.detail?.activity.internalId !== canonical[2])
      throw Error("This source activity is no longer available.");
    return result.detail;
  }
  let match: string | undefined;
  for (let page = 0; page < 20; page++) {
    const result = await checked(
      new URLSearchParams({ view: "source", q: reference, page: String(page) }),
    );
    if (result.page !== page)
      throw Error(
        "The source results changed. Open the current activity from Schedule.",
      );
    for (const row of result.activities.filter(
      (entry) => entry.activityId === reference,
    )) {
      if (match && match !== row.internalId)
        throw Error(
          "This Activity ID matches more than one source record. Open the exact activity in Schedule.",
        );
      match = row.internalId;
    }
    if ((page + 1) * result.pageSize >= result.total) {
      if (!match) return undefined;
      const detail = await checked(
        new URLSearchParams({ view: "source", internalId: match }),
      );
      if (
        detail.detail?.activity.internalId !== match ||
        detail.detail.activity.activityId !== reference
      )
        throw Error(
          "The source activity changed. Open the current activity from Schedule.",
        );
      return detail.detail;
    }
  }
  throw Error(
    "Too many source matches to verify a unique Activity ID here. Open the exact activity in Schedule.",
  );
}
