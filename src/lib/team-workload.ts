import { isClosed, isOverdue, type Task } from "./domain";
import { taskKind } from "./commissioning";

export const workloadSegments = [
  { key: "notStarted", label: "Not started", color: "#94a3b8" },
  { key: "inProgress", label: "Active / review / blocked", color: "#eab308" },
  {
    key: "startedLate",
    label: "Active / review / blocked, overdue",
    color: "#f97316",
  },
  { key: "notStartedLate", label: "Not started, overdue", color: "#dc2626" },
  { key: "completed", label: "Completed", color: "#059669" },
] as const;

export function teamWorkload(tasks: Task[], now = new Date()) {
  const counts = {
    notStarted: 0,
    inProgress: 0,
    startedLate: 0,
    notStartedLate: 0,
    completed: 0,
  };
  const applicable = tasks.filter((task) => task.status !== "not-applicable");
  for (const task of applicable) {
    if (task.status === "completed") counts.completed++;
    else if (task.status === "pending") {
      if (isOverdue(task, now)) counts.notStartedLate++;
      else counts.notStarted++;
    } else if (isOverdue(task, now)) counts.startedLate++;
    else counts.inProgress++;
  }
  return {
    counts,
    total: applicable.length,
    completed: counts.completed,
    percent: applicable.length
      ? Math.round((100 * counts.completed) / applicable.length)
      : null,
    open: tasks.filter((task) => !isClosed(task)).length,
    review: tasks.filter((task) => task.status === "review").length,
    notApplicable: tasks.length - applicable.length,
  };
}

export function filterTeamWork(
  tasks: Task[],
  kind: "all" | "issues" | "tasks",
  state: "all" | "open" | "closed",
) {
  return tasks.filter(
    (task) =>
      (kind === "all" ||
        (kind === "issues"
          ? taskKind(task) === "issue"
          : taskKind(task) !== "issue")) &&
      (state === "all" ||
        (state === "closed" ? isClosed(task) : !isClosed(task))),
  );
}
