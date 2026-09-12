import { type AppData, type Task, type User, type Shift } from "./domain";
export const canManage = (user: User) => user.role !== "worker";
export const isProjectMember = (
  user: User,
  projectId: string,
  data: Pick<AppData, "memberships">,
) =>
  data.memberships.some(
    (m) => m.userId === user.id && m.projectId === projectId,
  );
export function canReadTask(
  user: User,
  task: Task,
  data: Pick<AppData, "memberships">,
) {
  return (
    isProjectMember(user, task.projectId, data) &&
    (user.role === "worker"
      ? task.assignedTo === user.id
      : user.role === "supervisor"
        ? task.companyId === user.companyId
        : true)
  );
}
export function canReadShift(
  user: User,
  shift: Shift,
  data: Pick<AppData, "memberships" | "users">,
) {
  return (
    isProjectMember(user, shift.projectId, data) &&
    (user.role === "worker"
      ? shift.userId === user.id
      : user.role === "supervisor"
        ? data.users.some(
            (u) => u.id === shift.userId && u.companyId === user.companyId,
          )
        : true)
  );
}
export function scopeData(user: User, data: AppData): AppData {
  const projectIds = new Set(
    data.memberships
      .filter((m) => m.userId === user.id)
      .map((m) => m.projectId),
  );
  const tasks = data.tasks.filter((t) => canReadTask(user, t, data));
  const taskIds = new Set(tasks.map((t) => t.id));
  const userIds = new Set(
    data.memberships
      .filter((m) => projectIds.has(m.projectId))
      .map((m) => m.userId),
  );
  const visibleUsers = data.users.filter(
    (u) =>
      userIds.has(u.id) &&
      (user.role === "worker"
        ? u.id === user.id
        : user.role === "supervisor"
          ? u.companyId === user.companyId
          : true),
  );
  const visibleUserIds = new Set(visibleUsers.map((u) => u.id));
  return {
    projects: data.projects.filter((p) => projectIds.has(p.id)),
    companies: data.companies.filter((c) =>
      visibleUsers.some((u) => u.companyId === c.id),
    ),
    users: visibleUsers,
    memberships: data.memberships.filter(
      (m) => projectIds.has(m.projectId) && visibleUserIds.has(m.userId),
    ),
    tasks,
    shifts: data.shifts.filter((s) => canReadShift(user, s, data)),
    activities: data.activities.filter((a) => taskIds.has(a.taskId)),
    attachments: data.attachments.filter((a) => taskIds.has(a.taskId)),
    feedback: data.feedback.filter(
      (f) =>
        projectIds.has(f.projectId) &&
        (f.userId === user.id ||
          user.role === "manager" ||
          user.role === "admin"),
    ),
  };
}
