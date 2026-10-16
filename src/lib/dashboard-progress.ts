import { dueDateFor } from "./commissioning";
import { isClosed, isOverdue, type Task } from "./domain";

export type TaskProgress = {
  total: number;
  applicable: number;
  completed: number;
  notApplicable: number;
  percent: number | null;
  late: number;
  undated: number;
  scheduled: number;
};

/** Summarize an already scoped task subset; workflow completion is not tag approval. */
export function taskProgress(
  tasks: readonly Task[],
  now = new Date(),
): TaskProgress {
  let completed = 0,
    notApplicable = 0,
    late = 0,
    undated = 0,
    scheduled = 0;
  for (const task of tasks) {
    if (task.status === "completed") completed++;
    if (task.status === "not-applicable") notApplicable++;
    if (task.scheduleDueDate) scheduled++;
    if (!isClosed(task) && !dueDateFor(task)) undated++;
    if (isOverdue(task, now)) late++;
  }
  const applicable = tasks.length - notApplicable;
  return {
    total: tasks.length,
    applicable,
    completed,
    notApplicable,
    percent: applicable ? Math.round((100 * completed) / applicable) : null,
    late,
    undated,
    scheduled,
  };
}
