import Link from "next/link";
import {
  commissioning,
  LEVELS,
  tagReviewLabels,
  taskKind,
  type Asset,
} from "@/lib/commissioning";
import { checksheetProgress } from "@/lib/checksheets";
import { isClosed, type Project, type Task } from "@/lib/domain";
import { TagLevel } from "./TagLevel";

export function EquipmentStatusMatrix({
  project,
  assets,
  tasks,
  onOpenAsset,
}: {
  project: Project;
  assets: Asset[];
  tasks: Task[];
  onOpenAsset: (id: string) => void;
}) {
  const state = commissioning(project);
  const projectTasks = tasks.filter((task) => task.projectId === project.id);
  const levels = LEVELS.filter((level) => state.config.levels.includes(level));
  return (
    <div className="space-y-3">
      <p className="max-w-prose text-xs leading-5 text-slate-600">
        Saved equipment records. Test results, tag reviews and checksheet
        answers are separate; an unanswered or missing record does not mean
        approved.
      </p>
      <div
        className="isolate max-h-[65vh] overflow-auto rounded-lg border border-slate-200 focus-visible:outline-2 focus-visible:outline-blue-700"
        role="region"
        aria-label="Equipment status matrix, scroll to compare tag levels"
        tabIndex={0}
      >
        <table className="w-full text-left text-xs tabular-nums">
          <caption className="sr-only">
            Equipment, configured tag-level test results and reviews, checksheet
            answers and open issues. Uses the same asset filters and page.
          </caption>
          <thead className="sticky top-0 z-20 bg-slate-50">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-30 min-w-44 max-w-60 bg-slate-50 p-3 sm:min-w-60"
              >
                Equipment
              </th>
              <th scope="col" className="min-w-36 p-3">
                Open issues
              </th>
              {levels.map((level) => (
                <th scope="col" className="min-w-44 p-3" key={level}>
                  <TagLevel
                    level={level}
                    presentation={state.config.phasePresentation}
                  />
                  <span className="mt-1 block font-normal text-slate-600">
                    Test / review
                  </span>
                </th>
              ))}
              <th scope="col" className="min-w-48 p-3">
                Checksheets
              </th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const linked = projectTasks.filter(
                (task) => task.cx?.assetId === asset.id,
              );
              const issues = linked.filter(
                (task) => taskKind(task) === "issue" && !isClosed(task),
              );
              const sheets =
                state.checksheets?.sheets.filter(
                  (sheet) => sheet.assetId === asset.id,
                ) ?? [];
              return (
                <tr
                  className="border-t border-slate-200 align-top"
                  key={asset.id}
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-60 bg-white p-3 font-normal"
                  >
                    <button
                      className="min-h-11 text-left font-semibold text-blue-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-blue-700"
                      onClick={() => onOpenAsset(asset.id)}
                    >
                      {asset.name}
                    </button>
                    <p className="mt-1 break-words text-slate-600">
                      {asset.clientAssetId || asset.id}
                    </p>
                    <p className="mt-1 text-slate-600">
                      {asset.equipmentType} ·{" "}
                      {asset.location || "Location not recorded"}
                    </p>
                  </th>
                  <td className="p-3">
                    <p className="font-medium">{issues.length} open</p>
                    {issues.map((issue) => (
                      <Link
                        key={issue.id}
                        className="mt-1 flex min-h-11 items-center text-blue-700 underline underline-offset-4"
                        href={`/tasks/${encodeURIComponent(issue.id)}`}
                      >
                        {issue.priority || "No priority"} · {issue.title}
                      </Link>
                    ))}
                  </td>
                  {levels.map((level) => {
                    const tag = linked.find(
                      (task) =>
                        task.cx?.kind === "tag" && task.cx.level === level,
                    );
                    return (
                      <td key={level} className="p-3">
                        {!asset.levels.includes(level) ? (
                          <span className="text-slate-600">Not required</span>
                        ) : !tag ? (
                          <button
                            className="min-h-11 text-left text-blue-700 underline underline-offset-4"
                            onClick={() => onOpenAsset(asset.id)}
                          >
                            No tag record
                          </button>
                        ) : (
                          <Link
                            href={`/tasks/${encodeURIComponent(tag.id)}`}
                            className="block min-h-11 space-y-2 text-blue-700 underline underline-offset-4"
                          >
                            <span className="block">
                              Test: {tag.cx?.result || "untested"}
                            </span>
                            <span className="block">
                              Review:{" "}
                              {tag.cx?.tagReview
                                ? tagReviewLabels[tag.cx.tagReview]
                                : "Not recorded"}
                            </span>
                          </Link>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-3">
                    {sheets.length ? (
                      sheets.map((sheet) => {
                        const progress = checksheetProgress(sheet);
                        return (
                          <div key={sheet.id} className="mb-3 last:mb-0">
                            <p className="font-medium">
                              {sheet.templateName}
                              {sheet.level ? ` · ${sheet.level}` : ""}
                            </p>
                            <p className="mt-1 text-slate-600">
                              {progress.answered}/{progress.total} answered ·{" "}
                              {progress.activeSignatures} signatures
                            </p>
                            <p className="mt-1 text-slate-600">
                              {
                                sheet.responses.filter(
                                  (row) => row.result === "failed",
                                ).length
                              }{" "}
                              failed results
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-slate-600">No checksheet assigned</p>
                    )}
                    <Link
                      className="mt-2 inline-flex min-h-11 items-center text-blue-700 underline underline-offset-4"
                      href="/checksheets"
                    >
                      Open checksheets
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
