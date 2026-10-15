import {
  tagRows,
  isTagApproved,
  TAG_REVIEWS,
  type TagReview,
  type Level,
} from "./commissioning";
import type { Project, Task } from "./domain";

export type TagProgressRow = ReturnType<typeof tagRows>[number];
export type TagProgressFilter = {
  assetLocation?: string;
  supply?: "client";
  applicableOnly?: boolean;
  tagReview?: string;
  approval?: "approved";
};

export function isClientSupplied(asset: TagProgressRow["asset"]) {
  return "clientSupplied" in asset && asset.clientSupplied === true;
}

export function filterTagProgress(
  rows: TagProgressRow[],
  filter: TagProgressFilter,
) {
  return rows.filter(
    (row) =>
      (filter.assetLocation === undefined ||
        row.asset.location === filter.assetLocation) &&
      (filter.supply !== "client" || isClientSupplied(row.asset)) &&
      (!filter.tagReview || row.task?.cx?.tagReview === filter.tagReview) &&
      (filter.approval !== "approved" || isTagApproved(row.task)) &&
      (!filter.applicableOnly || row.applicable),
  );
}

export function summarizeTagProgress(rows: TagProgressRow[], level?: Level) {
  const applicable = rows.filter(
    (row) => row.applicable && (!level || row.level === level),
  );
  const approved = applicable.filter((row) => isTagApproved(row.task)).length;
  const legacyApproved = applicable.filter(
    (row) => row.task?.cx?.tagReview === undefined && isTagApproved(row.task),
  ).length;
  const reviews = Object.fromEntries(
    TAG_REVIEWS.map((review) => [
      review,
      applicable.filter((row) => row.task?.cx?.tagReview === review).length,
    ]),
  ) as Record<TagReview, number>;
  return {
    total: applicable.length,
    approved,
    legacyApproved,
    reviews,
    percent: applicable.length
      ? Math.round((100 * approved) / applicable.length)
      : null,
    complete: applicable.length > 0 && approved === applicable.length,
  };
}

export function tagProgressGroups(
  project: Project,
  tasks: Task[],
  groupBy: "equipmentType" | "location",
  filter: TagProgressFilter = {},
) {
  const rows = filterTagProgress(tagRows(project, tasks), filter);
  const groups = new Map<string, TagProgressRow[]>();
  for (const row of rows) {
    const key = row.asset[groupBy];
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return {
    rows,
    groups: [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, records]) => ({ key, rows: records })),
  };
}
