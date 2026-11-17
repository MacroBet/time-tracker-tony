import { commissioning, tagRows, taskKind, type Level } from "./commissioning";
import { isClosed, type Project, type Task } from "./domain";
import {
  summarizeTagProgress,
  matchesTagAttribute,
  MISSING_TAG_VALUE,
  type TagProgressRow,
} from "./tag-progress";

const identity = (value?: string) =>
  value?.trim().toLocaleLowerCase("en-GB") ?? "";
const labels = (values: (string | undefined)[]) => {
  const unique = new Map<string, string>();
  for (const value of values)
    if (value?.trim()) unique.set(identity(value), value.trim());
  return [...unique.values()].sort((a, b) => a.localeCompare(b));
};
export type DashboardTagFilters = { vendor?: string; discipline?: string };
export type DashboardTagGroupBy = "level" | "vendor" | "discipline";

/** Scope assets first, so obligations without a task remain in every denominator. */
export function dashboardTags(
  project: Project,
  tasks: Task[],
  filters: DashboardTagFilters = {},
  groupBy: DashboardTagGroupBy = "level",
) {
  const state = commissioning(project);
  const assets = state.assets.filter(
    (asset) =>
      matchesTagAttribute(asset.vendor, filters.vendor) &&
      matchesTagAttribute(asset.discipline, filters.discipline),
  );
  const scopedProject = { ...project, commissioning: { ...state, assets } };
  const rows = tagRows(scopedProject, tasks).filter((row) => row.applicable);
  const assetIds = new Set(rows.map((row) => row.asset.id));
  const linkedTasks = tasks.filter(
    (task) =>
      task.projectId === project.id &&
      task.cx?.assetId &&
      assetIds.has(task.cx.assetId),
  );
  const linkedTaskIds = new Set(linkedTasks.map((task) => task.id));
  const blockedTasks = linkedTasks.filter((task) => task.status === "blocked");
  const openIssues = linkedTasks.filter(
    (task) => taskKind(task) === "issue" && !isClosed(task),
  );
  const openWorks = (state.checksheets?.worksToGo ?? []).filter(
    (work) =>
      work.status === "open" &&
      (work.assetId
        ? assetIds.has(work.assetId)
        : Boolean(work.taskId && linkedTaskIds.has(work.taskId))),
  );
  const grouped = new Map<
    string,
    { label: string; rows: TagProgressRow[]; filter: DashboardTagFilters }
  >();
  for (const row of rows) {
    const value = groupBy === "level" ? undefined : row.asset[groupBy]?.trim();
    const key =
      groupBy === "level" ? "all" : identity(value) || MISSING_TAG_VALUE;
    const group = grouped.get(key) ?? {
      label:
        groupBy === "level"
          ? "All matching tags"
          : value ||
            (groupBy === "vendor"
              ? "Vendor not recorded"
              : "Discipline not recorded"),
      rows: [],
      filter:
        groupBy === "level"
          ? filters
          : { ...filters, [groupBy]: value || MISSING_TAG_VALUE },
    };
    group.rows.push(row);
    grouped.set(key, group);
  }
  return {
    project: scopedProject,
    rows,
    summary: summarizeTagProgress(rows),
    vendors: labels(state.assets.map((asset) => asset.vendor)),
    disciplines: labels(state.assets.map((asset) => asset.discipline)),
    missingVendor: state.assets.some((asset) => !identity(asset.vendor)),
    missingDiscipline: state.assets.some(
      (asset) => !identity(asset.discipline),
    ),
    groups: [...grouped.entries()]
      .sort(([, a], [, b]) => a.label.localeCompare(b.label))
      .map(([key, group]) => ({
        key,
        ...group,
        levels: state.config.levels
          .map((level: Level) => ({
            level,
            ...summarizeTagProgress(group.rows, level),
          }))
          .filter((level) => level.total > 0),
      })),
    blockedTasks,
    openIssues,
    openWorks,
  };
}
