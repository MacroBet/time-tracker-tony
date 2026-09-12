import { type Task, type AppData, statusLabels, isOverdue } from "./domain";
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  // Prevent spreadsheet formulas, including payloads preceded by whitespace or control characters.
  if (/^[\s\x00-\x1f]*[=+@-]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
export function tasksCsv(
  tasks: Task[],
  data: Pick<AppData, "users" | "companies" | "projects">,
) {
  const headers = [
    "ID",
    "External ID",
    "Title",
    "Status",
    "Priority",
    "Company",
    "Responsible",
    "Project",
    "Discipline",
    "Area",
    "Due date",
    "Overdue",
    "Last update",
    "Source",
  ];
  const rows = tasks.map((t) => [
    t.id,
    t.externalId,
    t.title,
    statusLabels[t.status],
    t.priority,
    data.companies.find((c) => c.id === t.companyId)?.name,
    data.users.find((u) => u.id === t.assignedTo)?.name,
    data.projects.find((p) => p.id === t.projectId)?.name,
    t.discipline,
    t.location,
    t.dueDate,
    isOverdue(t) ? "Yes" : "No",
    t.updatedAt,
    t.source,
  ]);
  return (
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")
  );
}
