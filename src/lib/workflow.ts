import { type Task, type TaskStatus, type User, isClosed } from "./domain";
export function taskUpdateError(
  user: User,
  task: Task,
  status: TaskStatus,
  note: string,
  evidenceCount: number,
) {
  if (isClosed(task) && user.role === "worker")
    return "Closed activities can only be reopened by a supervisor or manager.";
  if (status !== task.status) {
    const allowed: Record<TaskStatus, TaskStatus[]> = {
      pending: ["in-progress", "blocked", "not-applicable"],
      "in-progress": ["blocked", "completed", "not-applicable"],
      blocked: ["in-progress", "not-applicable"],
      completed: ["in-progress"],
      "not-applicable": ["in-progress"],
    };
    if (!allowed[task.status].includes(status))
      return "This status change is not allowed. Start or resume the activity first.";
    if (
      ["blocked", "not-applicable"].includes(status) &&
      note.trim().length < 10
    )
      return "Add a reason of at least 10 characters.";
    if (
      status === "completed" &&
      note.trim().length < 10 &&
      evidenceCount === 0
    )
      return "Add a completion note (at least 10 characters) or upload evidence before closing.";
  }
  return null;
}
