"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  commissioning,
  TAG_REVIEWS,
  tagReviewLabels,
  type TagReview,
  type Level,
} from "@/lib/commissioning";
import type { Project, Task } from "@/lib/domain";
import {
  summarizeTagProgress,
  tagProgressGroups,
  type TagProgressRow,
} from "@/lib/tag-progress";
import type { ReportRequest } from "./CommissioningReport";

export function TagProgressMatrix({
  project,
  tasks,
  clientSupplied = false,
  onOpen,
}: {
  project: Project;
  tasks: Task[];
  clientSupplied?: boolean;
  onOpen: (request: ReportRequest) => void;
}) {
  const [groupBy, setGroupBy] = useState<"equipmentType" | "location">(
    "equipmentType",
  );
  const [expanded, setExpanded] = useState<Level[]>([]);
  const [showReviews, setShowReviews] = useState(true);
  const { rows, groups } = tagProgressGroups(project, tasks, groupBy, {
    supply: clientSupplied ? "client" : undefined,
  });
  const levels = commissioning(project).config.levels;
  const summaries = new Map(
    levels.map((level) => [level, summarizeTagProgress(rows, level)]),
  );
  const collapsed = (level: Level) =>
    summaries.get(level)!.complete && !expanded.includes(level);
  const groupLabel = (group?: string) =>
    group === undefined ? "All assets" : group || "No location recorded";
  function detail(
    level?: Level,
    group?: string,
    approved = false,
    review?: TagReview,
  ) {
    onOpen({
      title: `${clientSupplied ? "Client supplied · " : ""}${groupLabel(group)}${level ? ` · ${level}` : ""}${review ? ` · ${tagReviewLabels[review]}` : approved ? " · Approved" : " · Tag progress"}`,
      view: "tags",
      filters: {
        level,
        equipmentType: groupBy === "equipmentType" ? group : undefined,
        assetLocation: groupBy === "location" ? group : undefined,
        supply: clientSupplied ? "client" : undefined,
        applicableOnly: true,
        approval: approved ? "approved" : undefined,
        tagReview: review,
      },
    });
  }
  function cells(records: TagProgressRow[], level: Level, group?: string) {
    const summary = summarizeTagProgress(records, level);
    if (collapsed(level))
      return (
        <td key={level} className="border-l p-2 text-center tabular-nums">
          <button
            className="rounded px-1 py-2 text-emerald-700 hover:bg-emerald-50 focus-visible:outline-blue-600"
            onClick={() => detail(level, group)}
            aria-label={`${groupLabel(group)}, ${level}: ${summary.percent === null ? "no applicable tags" : `${summary.approved} of ${summary.total} approved`}. View details`}
          >
            {summary.percent === null ? "—" : `${summary.percent}%`}
          </button>
        </td>
      );
    return (
      <>
        <td className="border-l p-2 text-right tabular-nums">
          <button
            className="rounded px-2 py-2 hover:bg-blue-50 focus-visible:outline-blue-600"
            onClick={() => detail(level, group)}
            aria-label={`${groupLabel(group)}, ${level}: ${summary.total} applicable tags. View details`}
          >
            {summary.total}
          </button>
        </td>
        {showReviews &&
          TAG_REVIEWS.map((review) => (
            <td key={review} className="p-2 text-right tabular-nums">
              <button
                className="rounded px-2 py-2 hover:bg-blue-50 focus-visible:outline-blue-600"
                onClick={() => detail(level, group, false, review)}
                aria-label={`${groupLabel(group)}, ${level}: ${summary.reviews[review]} ${tagReviewLabels[review]}. View details`}
              >
                {summary.reviews[review]}
              </button>
            </td>
          ))}
        <td className="p-2 text-right tabular-nums">
          <button
            className="rounded px-2 py-2 text-emerald-700 hover:bg-emerald-50 focus-visible:outline-blue-600"
            onClick={() => detail(level, group, true)}
            aria-label={`${groupLabel(group)}, ${level}: ${summary.approved} approved tags. View details`}
          >
            {summary.approved}
            {summary.legacyApproved > 0 && (
              <span className="block whitespace-nowrap text-[11px] font-normal text-slate-600">
                {summary.legacyApproved} legacy
              </span>
            )}
          </button>
        </td>
        <td className="p-2 text-right tabular-nums">
          <button
            className="rounded px-2 py-2 hover:bg-blue-50 focus-visible:outline-blue-600"
            onClick={() => detail(level, group)}
            aria-label={`${groupLabel(group)}, ${level}: ${summary.percent === null ? "no applicable tags" : `${summary.percent}% approved`}. View details`}
          >
            {summary.percent === null ? "—" : `${summary.percent}%`}
          </button>
        </td>
      </>
    );
  }
  return (
    <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {clientSupplied ? "Client Supplied Assets" : "Tag progress matrix"}
          </h3>
          <p className="mt-1 max-w-prose text-xs text-slate-600">
            {clientSupplied
              ? "Only assets explicitly marked Client Supplied. Also included in the all-assets totals."
              : "Approved tags by asset category or recorded location. Select a figure to see its records."}
          </p>
        </div>
        <label className="text-xs text-slate-600">
          Group by
          <select
            className="field-select mt-1"
            value={groupBy}
            onChange={(event) =>
              setGroupBy(event.target.value as typeof groupBy)
            }
          >
            <option value="equipmentType">Asset category</option>
            <option value="location">Location / building</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <p>
          I · Issued; R · Rejected; AC · Approved with comments; A · Approved.
        </p>
        <label className="inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="size-4"
            checked={showReviews}
            onChange={(event) => setShowReviews(event.target.checked)}
          />
          Show review columns
        </label>
      </div>
      {rows.length && levels.length ? (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">
                {clientSupplied ? "Client Supplied" : "All assets"} tag
                progress: total applicable, approved and approval percentage per
                level.
              </caption>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th rowSpan={2} className="min-w-40 p-3" scope="col">
                    {groupBy === "equipmentType"
                      ? "Asset category"
                      : "Recorded location"}
                  </th>
                  {levels.map((level) => {
                    const complete = summaries.get(level)!.complete;
                    return (
                      <th
                        key={level}
                        colSpan={collapsed(level) ? 1 : showReviews ? 7 : 3}
                        scope="colgroup"
                        className="border-l p-2 text-center"
                      >
                        {complete ? (
                          <button
                            className="inline-flex items-center gap-1 rounded px-1 py-2 text-emerald-700 hover:bg-emerald-50 focus-visible:outline-blue-600"
                            aria-expanded={!collapsed(level)}
                            aria-label={`${collapsed(level) ? "Expand" : "Collapse"} ${level}, all applicable tags approved`}
                            onClick={() =>
                              setExpanded((current) =>
                                current.includes(level)
                                  ? current.filter((item) => item !== level)
                                  : [...current, level],
                              )
                            }
                          >
                            {level}{" "}
                            {collapsed(level) ? (
                              <ChevronRight className="size-3" />
                            ) : (
                              <ChevronLeft className="size-3" />
                            )}
                          </button>
                        ) : (
                          level
                        )}
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  {levels.map((level) =>
                    collapsed(level) ? (
                      <th
                        key={level}
                        scope="col"
                        className="border-l p-2 text-center text-emerald-700"
                      >
                        Approved
                      </th>
                    ) : (
                      [
                        "Total",
                        ...(showReviews ? ["I", "R", "AC", "A"] : []),
                        "Approved",
                        "%",
                      ].map((label, index) => (
                        <th
                          key={`${level}-${label}`}
                          scope="col"
                          className={`${index === 0 ? "border-l" : ""} p-2 text-right font-medium`}
                        >
                          {label}
                        </th>
                      ))
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.key} className="border-t hover:bg-slate-50">
                    <th scope="row" className="p-3 font-medium">
                      {group.key || "No location recorded"}
                    </th>
                    {levels.map((level) => (
                      <MatrixCells key={level}>
                        {cells(group.rows, level, group.key)}
                      </MatrixCells>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-slate-50 font-semibold">
                <tr>
                  <th scope="row" className="p-3">
                    All applicable tags
                  </th>
                  {levels.map((level) => (
                    <MatrixCells key={level}>{cells(rows, level)}</MatrixCells>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Approval counts use A when explicitly recorded. Tags without a
            review status retain legacy completed-workflow approval, shown
            separately. AC is not counted as A. Missing records count as
            incomplete. N/A records are excluded. Fully approved level columns
            shrink automatically; select the level heading to reopen them. Test
            results remain separate from approval.
          </p>
        </>
      ) : (
        <p className="py-6 text-sm text-slate-600">
          {clientSupplied
            ? "No applicable Client Supplied tags are registered. Mark the supplied assets in the asset register and configure their levels."
            : "Register assets and applicable commissioning levels to build this matrix."}
        </p>
      )}
    </section>
  );
}

function MatrixCells({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
