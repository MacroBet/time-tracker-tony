import type { Activity, Project, Task } from "./domain";
import { commissioning } from "./commissioning";

export type ProjectAuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: "edit" | "upload" | "download";
  label: string;
  object: string;
  detail: string;
};
export type ProjectAuditPage = {
  events: ProjectAuditEvent[];
  total: number;
};

/** Existing task/revision records remain the source of truth; no duplicate edit log. */
export function projectHistory(
  project: Project,
  tasks: Task[],
  activities: Activity[],
  recorded: ProjectAuditEvent[] = [],
): ProjectAuditEvent[] {
  const taskMap = new Map(
    tasks
      .filter((task) => task.projectId === project.id)
      .map((task) => [task.id, task]),
  );
  const revisions = commissioning(project).revisions.map((revision, index) => ({
    id: `revision:${project.id}:${index}`,
    at: revision.at,
    actor: revision.actor,
    action: ("action" in revision && revision.action === "upload"
      ? "upload"
      : "edit") as ProjectAuditEvent["action"],
    label:
      "action" in revision && revision.action === "upload"
        ? "Register imported"
        : "Programme / register edited",
    object: project.name,
    detail: [revision.reason, ...revision.changes].filter(Boolean).join("\n"),
  }));
  const taskEvents = activities.flatMap((activity): ProjectAuditEvent[] => {
    const task = taskMap.get(activity.taskId);
    if (!task) return [];
    const action =
      activity.action === "Evidence uploaded"
        ? "upload"
        : activity.action === "Evidence download prepared"
          ? "download"
          : "edit";
    return [
      {
        id: `task:${activity.id}`,
        at: activity.createdAt,
        actor: activity.actorName,
        action,
        label: activity.action,
        object: task.title,
        detail: activity.note,
      },
    ];
  });
  return [...revisions, ...taskEvents, ...recorded].sort(
    (a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id),
  );
}
