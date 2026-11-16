import { commissioning } from "./commissioning";
import { emptyData, projectDate, type AppData, type User } from "./domain";
import { scopeData } from "./permissions";
import {
  buildCopilotContext,
  canUseCopilot,
  type CopilotContext,
} from "./copilot";
import {
  resolveWorkingSourceIndex,
  managedWorkingSourceIndex,
} from "./schedule-working";
import type { Commissioning } from "./commissioning";
import type { SourceProgrammeIndex } from "./programme-source";

export const copilotTaskVersions = (
  data: Pick<AppData, "tasks">,
  projectId: string,
) =>
  data.tasks
    .filter((task) => task.projectId === projectId)
    .map((task) => [task.id, task.version] as const)
    .sort(([a], [b]) => a.localeCompare(b, "en"));
export const sameCopilotTaskVersions = (
  left: readonly (readonly [string, number])[],
  right: readonly (readonly [string, number])[],
) =>
  left.length === right.length &&
  JSON.stringify([...left].sort(([a], [b]) => a.localeCompare(b, "en"))) ===
    JSON.stringify([...right].sort(([a], [b]) => a.localeCompare(b, "en")));

export type CopilotSnapshotSubject = {
  userId: string;
  projectId: string;
  projectVersion: number;
  name: string;
  taskVersions: readonly (readonly [string, number])[];
};
export function copilotSnapshotIssue(
  subject: CopilotSnapshotSubject,
  user: User,
  access?: {
    id: string;
    name: string;
    version: number;
    taskVersions?: readonly (readonly [string, number])[];
  },
): { status: 403 | 404 | 409; message: string } | undefined {
  if (user.id !== subject.userId || !canUseCopilot(user))
    return {
      status: 403,
      message: "Assistant management access changed. Start a new conversation.",
    };
  if (!access || access.id !== subject.projectId)
    return { status: 404, message: "Project is no longer available." };
  if (
    access.version !== subject.projectVersion ||
    access.name !== subject.name ||
    !access.taskVersions ||
    !sameCopilotTaskVersions(subject.taskVersions, access.taskVersions)
  )
    return {
      status: 409,
      message: "Project records changed. Refresh before asking again.",
    };
  return undefined;
}

/** Minimize the read snapshot before permission projection/cloning. The caller still rechecks live access. */
export function scopeCopilotData(
  data: AppData,
  user: User,
  projectId: string,
): AppData | undefined {
  if (
    !data.memberships.some(
      (row) => row.userId === user.id && row.projectId === projectId,
    )
  )
    return undefined;
  const original = data.projects.find((row) => row.id === projectId);
  if (!original) return undefined;
  const project = { ...original };
  if (project.commissioning) {
    project.commissioning = { ...project.commissioning };
    delete project.commissioning.sourceProgramme;
    delete (project.commissioning as Commissioning & { _audit?: unknown })
      ._audit;
  }
  return scopeData(user, {
    ...emptyData,
    users: [user],
    projects: [project],
    memberships: [{ userId: user.id, projectId }],
    tasks: data.tasks.filter((row) => row.projectId === projectId),
  });
}

/** Request-local CPU reuse only. Every get requires a newly authorized scoped snapshot. */
export class CopilotContextMemo {
  private key?: string;
  private value?: CopilotContext;
  get(data: AppData, projectId: string, now = new Date()) {
    const project = data.projects.find((row) => row.id === projectId);
    if (!project) throw Error("Project not found.");
    const state = commissioning(project);
    const key = JSON.stringify([
      projectId,
      state.version,
      project.name,
      projectDate(now),
      data.tasks
        .filter((task) => task.projectId === projectId)
        .map((task) => [task.id, task.version]),
    ]);
    if (key !== this.key) {
      this.value = buildCopilotContext(data, projectId, now);
      this.key = key;
    }
    return this.value!;
  }
}

/** Authorization/metadata reads precede this memo, including cache hits. Never shared between requests. */
export class CopilotWorkingIndexMemo {
  private source?: SourceProgrammeIndex;
  private key?: string;
  private value?: SourceProgrammeIndex;
  get(source: SourceProgrammeIndex | undefined, state: Commissioning) {
    const key = `${state.version}:${JSON.stringify(state.workingSchedule ?? null)}:${source ? "source" : JSON.stringify(state.schedule)}`;
    if (source !== this.source || key !== this.key) {
      this.value = source
        ? resolveWorkingSourceIndex(source, state.workingSchedule)
        : managedWorkingSourceIndex(state.schedule, state.workingSchedule);
      this.source = source;
      this.key = key;
    }
    return this.value!;
  }
}
