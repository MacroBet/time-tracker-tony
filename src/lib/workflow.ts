import { type Task, type TaskStatus, type User, isClosed } from "./domain";
export function taskUpdateError(
  user: User,
  task: Task,
  status: TaskStatus,
  note: string,
  evidenceCount: number,
) {
  if (
    status !== task.status &&
    user.role === "worker" &&
    ["completed", "not-applicable"].includes(status)
  )
    return "Submit your work for supervisor review before it can be closed.";
  if (status !== task.status && status === "in-progress" && !task.assignedTo)
    return "Assign a worker before starting this activity.";
  if (
    status !== task.status &&
    task.status === "review" &&
    user.role === "worker"
  )
    return "A supervisor or manager must review this activity.";
  if (
    status !== task.status &&
    task.status === "review" &&
    status === "in-progress" &&
    note.trim().length < 10
  )
    return "Explain what needs to be corrected (at least 10 characters).";
  if (isClosed(task) && user.role === "worker")
    return "Closed activities can only be reopened by a supervisor or manager.";
  if (status !== task.status) {
    const allowed: Record<TaskStatus, TaskStatus[]> = {
      pending: ["in-progress", "blocked", "not-applicable"],
      "in-progress": ["blocked", "review", "completed", "not-applicable"],
      review: ["completed", "in-progress", "not-applicable"],
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
      ["completed", "review"].includes(status) &&
      note.trim().length < 10 &&
      evidenceCount === 0 &&
      !(
        status === "completed" &&
        task.status === "review" &&
        (task.notes?.trim().length || 0) >= 10
      )
    )
      return "Add a completion note (at least 10 characters) or upload evidence before closing.";
  }
  return null;
}
