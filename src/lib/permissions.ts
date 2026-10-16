import { type AppData, type Task, type User, type Shift } from "./domain";
import { commissioning, hasModule } from "./commissioning";
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
    (user.role === "worker" ? task.assignedTo === user.id : true)
  );
}
export function canReadShift(
  user: User,
  shift: Shift,
  data: Pick<AppData, "memberships" | "users">,
) {
  return (
    isProjectMember(user, shift.projectId, data) &&
    (user.role === "worker" ? shift.userId === user.id : true)
  );
}
export function scopeData(user: User, data: AppData): AppData {
  const projectIds = new Set(
    data.memberships
      .filter((m) => m.userId === user.id)
      .map((m) => m.projectId),
  );
  const tasks = data.tasks
    .filter((t) => canReadTask(user, t, data))
    .map((t) => ({
      ...t,
      scheduleDueDate: commissioning(
        data.projects.find((p) => p.id === t.projectId),
      ).schedule.find((s) => s.activityId === t.cx?.activityId)?.finish,
    }));
  const taskIds = new Set(tasks.map((t) => t.id));
  const userIds = new Set(
    data.memberships
      .filter((m) => projectIds.has(m.projectId))
      .map((m) => m.userId),
  );
  const visibleUsers = data.users.filter(
    (u) =>
      userIds.has(u.id) && (user.role === "worker" ? u.id === user.id : true),
  );
  const visibleUserIds = new Set(visibleUsers.map((u) => u.id));
  return {
    projects: data.projects
      .filter((p) => projectIds.has(p.id))
      .map((p) => {
        if (user.role !== "worker") return p;
        const state = commissioning(p);
        const mine = tasks.filter((t) => t.projectId === p.id);
        const assets = state.assets.filter((a) =>
          mine.some((t) => t.cx?.assetId === a.id),
        );
        return {
          ...p,
          commissioning: {
            ...state,
            assets,
            revisions: [],
            schedule: state.schedule.filter(
              (s) =>
                mine.some((t) => t.cx?.activityId === s.activityId) ||
                assets.some(
                  (a) =>
                    a.deliveryActivityId === s.activityId ||
                    a.programmeActivityId === s.activityId,
                ),
            ),
          },
        };
      }),
    companies: data.companies.filter(
      (c) =>
        visibleUsers.some((u) => u.companyId === c.id) ||
        tasks.some((t) => t.companyId === c.id),
    ),
    users: visibleUsers,
    memberships: data.memberships.filter(
      (m) => projectIds.has(m.projectId) && visibleUserIds.has(m.userId),
    ),
    tasks,
    shifts: hasModule(user, "time")
      ? data.shifts.filter((s) => canReadShift(user, s, data))
      : [],
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
