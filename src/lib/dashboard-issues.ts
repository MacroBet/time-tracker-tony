import { taskKind } from "./commissioning";
import { projectDate, type Company, type Task } from "./domain";

export type IssueStatus = "open" | "closed" | "notApplicable";
export const issueStatuses = ["open", "closed", "notApplicable"] as const;
export type IssueCounts = Record<IssueStatus, number>;
export type IssueDimension = "company" | "type" | "cause" | "month";
export type IssueFilters = Partial<
  Record<IssueDimension | "year" | "status", string>
>;
export type DashboardIssue = {
  task: Task;
  status: IssueStatus;
  company: string;
  type: string;
  cause: string;
  month: string;
  year: string;
  created: string;
  age: number | null;
};

const dayMs = 86_400_000;
const workDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Amsterdam",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const emptyCounts = (): IssueCounts => ({
  open: 0,
  closed: 0,
  notApplicable: 0,
});
export const issueCount = (counts: IssueCounts) =>
  counts.open + counts.closed + counts.notApplicable;

export function projectIssues(
  tasks: readonly Task[],
  companies: readonly Company[],
  projectId: string,
  today = projectDate(),
): DashboardIssue[] {
  const companyNames = new Map(companies.map(({ id, name }) => [id, name]));
  return tasks
    .filter(
      (task) => task.projectId === projectId && taskKind(task) === "issue",
    )
    .map((task) => {
      const fields = task.importData?.fields ?? {};
      const metadata = Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [
          key.trim().toLowerCase(),
          value?.trim(),
        ]),
      );
      const importedCompany =
        task.importData?.assigneeType === "Company"
          ? task.importData.assignee?.trim()
          : "";
      const company = companyNames.get(task.companyId)?.trim();
      const timestamp = Date.parse(task.createdAt);
      const created = Number.isFinite(timestamp)
        ? workDate.format(timestamp)
        : "";
      const status: IssueStatus =
        task.status === "completed"
          ? "closed"
          : task.status === "not-applicable"
            ? "notApplicable"
            : "open";
      return {
        task,
        status,
        company:
          importedCompany ||
          (company === "Company not mapped" ? "" : (company ?? "")),
        type: metadata["issue type"] || metadata.type || "",
        cause: metadata["root cause"] || "",
        month: created.slice(0, 7),
        year: created.slice(0, 4),
        created,
        age:
          status === "open" && created && created <= today
            ? (Date.parse(today) - Date.parse(created)) / dayMs
            : null,
      };
    })
    .sort((a, b) => b.created.localeCompare(a.created));
}

export function filterIssues(
  issues: readonly DashboardIssue[],
  filters: IssueFilters,
) {
  const active = Object.entries(filters) as [keyof IssueFilters, string][];
  return issues.filter((issue) =>
    active.every(([key, value]) => issue[key] === value),
  );
}

export function summarizeIssues(issues: readonly DashboardIssue[]) {
  const counts = emptyCounts();
  let days = 0;
  let datedOpen = 0;
  for (const issue of issues) {
    counts[issue.status]++;
    if (issue.age !== null) {
      days += issue.age;
      datedOpen++;
    }
  }
  return {
    counts,
    datedOpen,
    average: datedOpen ? Math.round(days / datedOpen) : null,
  };
}

export function groupIssues(
  issues: readonly DashboardIssue[],
  dimension: IssueDimension,
) {
  const groups = new Map<string, IssueCounts>();
  for (const issue of issues) {
    const key = issue[dimension];
    const counts = groups.get(key) ?? emptyCounts();
    counts[issue.status]++;
    groups.set(key, counts);
  }
  return Array.from(groups, ([value, counts]) => ({
    value,
    counts,
    total: issueCount(counts),
  })).sort((a, b) =>
    dimension === "month"
      ? Number(!a.value) - Number(!b.value) || a.value.localeCompare(b.value)
      : b.total - a.total || a.value.localeCompare(b.value),
  );
}
