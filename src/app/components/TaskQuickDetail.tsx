"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  commissioning,
  dueDateFor,
  hasModule,
  tagReviewLabels,
} from "@/lib/commissioning";
import { checksheetProgress } from "@/lib/checksheets";
import { statusLabels } from "@/lib/domain";
import {
  taskManagedDates,
  taskSourceDetail,
  taskStepSummary,
  type TaskStepSummary,
} from "@/lib/task-board";
import type { SourceProgrammePage } from "@/lib/programme-source";
import { useApp } from "../contexts/AppContext";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { AssignmentDialog } from "./AssignmentDialog";

export function TaskStepIndicator({
  summary,
  onClick,
}: {
  summary: TaskStepSummary;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const percent = summary.progress?.percent ?? null;
  const notApplicable = summary.progress?.coverage === "not-applicable";
  const label = `${notApplicable ? "Required steps not applicable" : percent === null ? "Required step progress unknown" : `${percent}% of required applicable steps passed`}. ${summary.description} Open activity properties.`;
  const colour =
    summary.status.colour === "red"
      ? "text-red-700"
      : summary.status.colour === "orange"
        ? "text-amber-700"
        : summary.status.colour === "green"
          ? "text-emerald-700"
          : "text-slate-700";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-haspopup="dialog"
      onClick={onClick}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700 ${colour}`}
    >
      <span className="relative inline-grid size-10 place-items-center text-[10px] font-semibold tabular-nums">
        <svg
          viewBox="0 0 40 40"
          className="absolute inset-0 size-10 -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="20"
            cy="20"
            r="17"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="3"
          />
          {percent !== null && (
            <circle
              cx="20"
              cy="20"
              r="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              pathLength="100"
              strokeDasharray={`${Math.max(0, Math.min(100, percent))} 100`}
              strokeLinecap="round"
            />
          )}
        </svg>
        <span>
          {notApplicable ? "N/A" : percent === null ? "—" : `${percent}%`}
        </span>
      </span>
    </button>
  );
}

export function TaskQuickDetail({
  taskId,
  onClose,
  returnFocus,
}: {
  taskId: string | null;
  onClose: () => void;
  returnFocus?: () => void;
}) {
  const data = useApp();
  const allowed =
    data.currentUser.role !== "worker" && hasModule(data.currentUser, "tasks");
  const task = allowed
    ? data.tasks.find((row) => row.id === taskId)
    : undefined;
  const project = data.projects.find((row) => row.id === task?.projectId);
  const state = commissioning(project);
  const asset = state.assets.find((row) => row.id === task?.cx?.assetId);
  const sheets = (state.checksheets?.sheets ?? []).filter(
    (sheet) => sheet.assetId === asset?.id,
  );
  const canOpenEquipment = hasModule(data.currentUser, "commissioning");
  const plan = task ? taskManagedDates(task, project) : undefined;
  const progress = task
    ? taskStepSummary(task, project, data.tasks)
    : undefined;
  const sourceAllowed =
    task &&
    project &&
    state.sourceProgrammeSummary &&
    task.cx?.activityId &&
    hasModule(data.currentUser, "commissioning") &&
    !plan;
  return (
    <Sheet
      open={taskId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        className="w-full sm:w-[min(40rem,100vw)] sm:max-w-none"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus?.();
        }}
      >
        <SheetHeader>
          <SheetTitle className="break-words">
            {task?.title ?? "Activity unavailable"}
          </SheetTitle>
          <SheetDescription>
            {task
              ? "Activity properties. Your list, filters and selection stay in place."
              : "This activity is no longer available to your account."}
          </SheetDescription>
        </SheetHeader>
        {task && (
          <div className="px-4 pb-6 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded bg-slate-100 px-2 py-1 text-sm">
                {statusLabels[task.status]}
              </span>
              <Link
                href={`/tasks/${encodeURIComponent(task.id)}`}
                className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-blue-700 underline underline-offset-4"
              >
                {task.status === "review"
                  ? "Review work and evidence"
                  : "Open activity and history"}
                <ArrowUpRight className="size-4" />
              </Link>
              <AssignmentDialog compact tasks={[task]}>
                {task.assignedTo ? "Reassign" : "Assign worker"}
              </AssignmentDialog>
            </div>
            {task.description && (
              <p className="max-w-prose whitespace-pre-wrap break-words text-sm text-slate-700">
                {task.description}
              </p>
            )}
            <Properties
              title="Recorded context"
              rows={[
                ["Project", project?.name],
                ["Task ID", task.id],
                ["External ID", task.externalId],
                ["Schedule Activity ID", task.cx?.activityId],
                ["Schedule ID", state.programmeId],
                [
                  "Equipment",
                  asset
                    ? `${asset.name} · ${asset.id}`
                    : task.cx?.assetId
                      ? `${task.cx.assetId} · record unavailable`
                      : undefined,
                ],
                ["Area", task.location || asset?.location],
                ["Tag / level", task.cx?.level],
                [
                  "Responsible",
                  data.users.find((row) => row.id === task.assignedTo)?.name ||
                    (task.assignedTo
                      ? "Assigned worker unavailable"
                      : "Unassigned"),
                ],
                ["Original report assignee", task.importData?.assignee],
                [
                  "Company",
                  data.companies.find((row) => row.id === task.companyId)?.name,
                ],
                ["Priority", task.priority],
                ["Discipline", task.discipline],
              ]}
            />
            <section
              aria-label="Equipment and checksheet records"
              className="border-t pt-4 space-y-3"
            >
              <h3 className="font-semibold">Equipment &amp; checksheets</h3>
              {asset ? (
                <>
                  {canOpenEquipment ? (
                    <Link
                      href={`/commissioning?${new URLSearchParams({ projectId: task.projectId, asset: asset.id })}`}
                      className="inline-flex min-h-11 items-center text-sm font-medium text-blue-700 underline underline-offset-4"
                    >
                      {asset.name}
                      {task.cx?.level ? ` · ${task.cx.level}` : ""}
                    </Link>
                  ) : (
                    <p className="text-sm">
                      {asset.name}
                      {task.cx?.level ? ` · ${task.cx.level}` : ""}
                    </p>
                  )}
                  {task.cx?.kind === "tag" && (
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-slate-600">Test result</dt>
                        <dd className="mt-1">{task.cx.result}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-600">Tag review</dt>
                        <dd className="mt-1">
                          {task.cx.tagReview
                            ? tagReviewLabels[task.cx.tagReview]
                            : "Not recorded"}
                        </dd>
                      </div>
                    </dl>
                  )}
                  {sheets.length ? (
                    sheets.map((sheet) => {
                      const saved = checksheetProgress(sheet);
                      return (
                        <div key={sheet.id} className="text-sm">
                          <p className="font-medium">
                            {sheet.templateName}
                            {sheet.level ? ` · ${sheet.level}` : ""}
                          </p>
                          <p className="mt-1 text-slate-600">
                            {saved.answered}/{saved.total} answered ·{" "}
                            {saved.activeSignatures} signatures
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-600">
                      No checksheet assigned to this equipment.
                    </p>
                  )}
                  {canOpenEquipment && (
                    <Link
                      href="/checksheets"
                      onClick={() => data.selectProject(task.projectId)}
                      className="inline-flex min-h-11 items-center text-sm text-blue-700 underline underline-offset-4"
                    >
                      Open equipment checksheets
                    </Link>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-600">
                  No equipment link recorded.
                </p>
              )}
            </section>
            {progress && (
              <section className="space-y-2 border-t pt-4">
                <h3 className="font-semibold">Required steps</h3>
                <p className="text-sm">
                  {progress.progress?.coverage === "not-applicable"
                    ? "Not applicable"
                    : progress.progress?.percent === null || !progress.progress
                      ? "Progress unknown"
                      : `${progress.progress.percent}% passed`}
                </p>
                <p className="max-w-prose text-sm text-slate-600">
                  {progress.description}
                </p>
                <p className="text-xs text-slate-600">
                  Reviews, signatures and task workflow status remain separate
                  records.
                </p>
              </section>
            )}
            <Properties
              title="FieldTrack dates and duration"
              rows={[
                ["Task due date", task.dueDate],
                ["Current due date", dueDateFor(task)],
                ["Plan source", plan?.origin],
                ["Planned start", plan?.start],
                ["Planned finish", plan?.finish],
                [
                  "Planned duration",
                  plan &&
                  "durationDays" in plan &&
                  plan.durationDays !== undefined
                    ? `${plan.durationDays} days`
                    : undefined,
                ],
                ["Actual start", undefined],
                [
                  "Schedule actual finish",
                  plan && "actualFinish" in plan
                    ? plan.actualFinish
                    : undefined,
                ],
                [
                  "Baseline start",
                  plan && "baselineStart" in plan
                    ? plan.baselineStart
                    : undefined,
                ],
                [
                  "Baseline finish",
                  plan && "baselineFinish" in plan
                    ? plan.baselineFinish
                    : undefined,
                ],
                ["Task completed at", task.completedAt],
              ]}
            />
            {sourceAllowed && (
              <SourceProperties
                key={`${task.id}-${data.selectedProjectId}-${state.version}-${state.sourceProgrammeSummary!.sha256}`}
                projectId={task.projectId}
                reference={task.cx!.activityId!}
                sha256={state.sourceProgrammeSummary!.sha256}
              />
            )}
            {task.importData && (
              <section className="border-t pt-4 space-y-3">
                <h3 className="font-semibold">Imported task record</h3>
                <p className="text-xs text-slate-600">
                  {task.importData.file} · row {task.importData.row} · original
                  status: {task.importData.status || "Not recorded"}
                </p>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  {Object.entries(task.importData.fields).map(
                    ([key, value]) => (
                      <div key={key} className="min-w-0">
                        <dt className="text-slate-600 break-words">{key}</dt>
                        <dd className="mt-1 whitespace-pre-wrap break-words">
                          {value?.trim() || "Not recorded"}
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              </section>
            )}
            {task.notes && (
              <section className="border-t pt-4 space-y-2">
                <h3 className="font-semibold">Latest note</h3>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {task.notes}
                </p>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Properties({
  title,
  rows,
}: {
  title: string;
  rows: [string, string | undefined][];
}) {
  return (
    <section className="border-t pt-4 space-y-3">
      <h3 className="font-semibold">{title}</h3>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-slate-600">{label}</dt>
            <dd className="mt-1 break-words">
              {value?.trim() || "Not recorded"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SourceProperties({
  projectId,
  reference,
  sha256,
}: {
  projectId: string;
  reference: string;
  sha256: string;
}) {
  const [result, setResult] = useState<{
    detail?: NonNullable<SourceProgrammePage["detail"]>;
    error?: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void taskSourceDetail(reference, sha256, async (query) => {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/programme-source?${query}`,
        { signal: controller.signal, cache: "no-store" },
      );
      const body = await response.json();
      if (!response.ok)
        throw Error(
          body.error ||
            "Source properties could not be loaded. Reopen Schedule to check your access.",
        );
      return body as SourceProgrammePage;
    })
      .then((detail) => {
        if (!controller.signal.aborted) setResult({ detail });
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setResult({
            error:
              cause instanceof Error
                ? cause.message
                : "Source properties could not be loaded.",
          });
      });
    return () => controller.abort();
  }, [projectId, reference, sha256]);
  if (!result)
    return (
      <p role="status" className="text-sm text-slate-600">
        Loading the linked source activity…
      </p>
    );
  if (!result.detail)
    return (
      <p role="status" className="text-sm text-slate-600">
        {result.error || "No exact source activity was verified for this link."}
      </p>
    );
  const { activity, fields } = result.detail;
  return (
    <section className="space-y-4 border-t pt-4">
      <h3 className="font-semibold">Original P6 source properties</h3>
      <p className="text-xs text-slate-600">
        Original imported fields. Target dates are source targets; they do not
        establish an approved baseline.
      </p>
      <Properties
        title="Source dates and WBS"
        rows={[
          ["Source Activity ID", activity.activityId],
          ["Source internal ID", activity.internalId],
          ["WBS", activity.wbsPath || activity.wbsId],
          ["Target start", fields.target_start_date],
          ["Target finish", fields.target_end_date],
          ["Early start", fields.early_start_date],
          ["Early finish", fields.early_end_date],
          ["Actual start", fields.act_start_date],
          ["Actual finish", fields.act_end_date],
          [
            "Source duration",
            activity.durationHours
              ? `${activity.durationHours} hours${activity.durationDays !== undefined ? ` · ${activity.durationDays} calendar-derived days` : ""}`
              : undefined,
          ],
          ["Calendar", activity.calendarName || activity.calendarId],
        ]}
      />
      <details>
        <summary className="min-h-11 cursor-pointer content-center rounded text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue-700">
          All recorded P6 task fields
        </summary>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {Object.entries(fields).map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="break-words text-slate-600">{key}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words">
                {value || "Not recorded"}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
