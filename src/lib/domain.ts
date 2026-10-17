export type Role = "worker" | "supervisor" | "manager" | "admin";
export interface Company {
  id: string;
  name: string;
  logo: string;
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string;
  modules?: import("./commissioning").Module[];
}
export interface Project {
  id: string;
  name: string;
  location: string;
  companyId: string;
  commissioning?: import("./commissioning").Commissioning;
}
export interface Membership {
  userId: string;
  projectId: string;
}
export type TaskStatus =
  | "pending"
  | "in-progress"
  | "blocked"
  | "review"
  | "completed"
  | "not-applicable";
export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  companyId: string;
  assignedTo?: string;
  createdBy: string;
  status: TaskStatus;
  priority?: import("./commissioning").Priority;
  cx?: import("./commissioning").CommissioningTask;
  scheduleDueDate?: string;
  discipline: string;
  location: string;
  source: "manual" | "bim360" | "acc" | "procore" | "excel";
  importData?: {
    file: string;
    row: number;
    status: string;
    assignee: string;
    assigneeType: "User" | "Company" | "Role";
    importedAt: string;
    fields: Record<string, string | null>;
  };
  externalId?: string;
  dueDate?: string;
  notes?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}
export interface Shift {
  id: string;
  userId: string;
  projectId: string;
  startTime: string;
  endTime?: string;
  checkInMethod: "qr" | "wifi" | "gps" | "nfc" | "manual";
  status: "active" | "completed" | "pending-approval" | "approved" | "rejected";
  manualHours?: number;
  notes?: string;
  location?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  version: number;
}
export interface Activity {
  id: string;
  taskId: string;
  actorId: string;
  actorName: string;
  action: string;
  note: string;
  createdAt: string;
}
export interface Attachment {
  id: string;
  taskId: string;
  uploadedBy: string;
  name: string;
  contentType: string;
  size: number;
  createdAt: string;
}
export interface Feedback {
  id: string;
  userId: string;
  projectId: string;
  description: string;
  page: string;
  createdAt: string;
  hasScreenshot: boolean;
}
export interface AppData {
  companies: Company[];
  users: User[];
  projects: Project[];
  memberships: Membership[];
  tasks: Task[];
  shifts: Shift[];
  activities: Activity[];
  attachments: Attachment[];
  feedback: Feedback[];
}
export interface Bootstrap extends AppData {
  currentUser: User;
  mode: "demo" | "neon";
}
export const emptyData: AppData = {
  companies: [],
  users: [],
  projects: [],
  memberships: [],
  tasks: [],
  shifts: [],
  activities: [],
  attachments: [],
  feedback: [],
};
export const statusLabels: Record<TaskStatus, string> = {
  pending: "To do",
  "in-progress": "In progress",
  blocked: "Blocked",
  review: "Awaiting review",
  completed: "Completed",
  "not-applicable": "Not applicable",
};
export const isClosed = (task: Task) =>
  task.status === "completed" || task.status === "not-applicable";
export function projectDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export const isOverdue = (task: Task, now = new Date()) =>
  !isClosed(task) &&
  !!(task.scheduleDueDate ?? task.dueDate) &&
  (task.scheduleDueDate ?? task.dueDate)! < projectDate(now);
export const isStale = (task: Task, now = new Date()) =>
  !isClosed(task) &&
  now.getTime() - new Date(task.updatedAt).getTime() > 7 * 86400000;
export function homeFor(user: User) {
  // Candidates stay inside each role's permitted routes. Missing module settings
  // retain the legacy default access; administrators retain all modules.
  const enabled = (module: NonNullable<User["modules"]>[number]) =>
    user.role === "admin" || !user.modules || user.modules.includes(module);
  if (user.role === "worker") {
    if (enabled("tasks")) return "/my-tasks";
    if (enabled("time")) return "/dashboard";
    if (enabled("commissioning")) return "/commissioning";
    return "/settings";
  }
  if (
    (user.role === "manager" || user.role === "admin") &&
    enabled("dashboard")
  )
    return "/overview";
  if (enabled("tasks")) return "/supervisor";
  if (enabled("dashboard")) return "/overview";
  if (enabled("commissioning")) return "/commissioning";
  if (enabled("reports")) return "/reports";
  if (enabled("team")) return "/supervisor?view=team";
  if (enabled("time")) return "/supervisor?view=timesheets";
  if (enabled("feedback")) return "/supervisor?view=feedback";
  return "/settings";
}
