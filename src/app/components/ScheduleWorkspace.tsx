"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Eye,
  EyeOff,
  List,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../contexts/AppContext";
import { AppShell } from "./AppShell";
import { ProjectAudit } from "./ProjectAudit";
import { ProgrammeReference } from "./ProgrammeReference";
import { OverdueList } from "./OverdueList";
import { InfoPopover } from "./InfoPopover";
import {
  SourceProgrammeImport,
  SourceProgrammeRestore,
  SourceProgrammeWorkspace,
} from "./SourceProgrammeWorkspace";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import {
  commissioning,
  filterTasks,
  hasModule,
  type ScheduleActivity,
} from "@/lib/commissioning";
import { calendarDays, dayNumber, workingDuration } from "@/lib/scheduling";
import { ganttAxis, type GanttScale } from "@/lib/gantt-axis";
import { GanttRuler } from "./GanttRuler";
import { projectDate, type Project, type Task } from "@/lib/domain";
import type { Asset } from "@/lib/commissioning";

function assetActivityIds(asset: Asset, tasks: Task[]) {
  return new Set(
    [
      asset.programmeActivityId,
      asset.deliveryActivityId,
      ...Object.values(asset.levelActivities ?? {}),
      ...tasks
        .filter((t) => t.cx?.assetId === asset.id)
        .map((t) => t.cx?.activityId),
    ].filter((id): id is string => !!id),
  );
}

type Preview = {
  changes: string[];
  errors: string[];
  activities: ScheduleActivity[];
};
const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
function shiftDate(date: string, days: number) {
  return new Date((dayNumber(date) + days) * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function ScheduleWorkspace({
  initialView = "timeline",
}: { initialView?: "timeline" | "overdue" } = {}) {
  const app = useApp();
  const params = useSearchParams();
  const project = app.projects.find((p) => p.id === app.selectedProjectId);
  const allowed =
    app.currentUser.role !== "worker" &&
    hasModule(app.currentUser, "commissioning");
  const canViewOverdue =
    app.currentUser.role !== "worker" &&
    hasModule(app.currentUser, "dashboard");
  const view = params.get("view") || initialView;
  const overdue = view === "overdue" && canViewOverdue;
  const overdueCount = project
    ? filterTasks(app.tasks, project, { attention: "overdue" }).length
    : 0;
  return (
    <AppShell
      title="Schedule"
      subtitle="Dates, durations and the order of your project work."
      wide
    >
      {project && (allowed || canViewOverdue) && (
        <nav
          aria-label="Schedule views"
          className="mb-5 flex flex-wrap items-center gap-1 border-b border-slate-200"
        >
          {allowed && (
            <Link
              href="/schedule"
              aria-current={!overdue ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium ${!overdue ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-950"}`}
            >
              <CalendarDays className="size-4" aria-hidden="true" />
              Timeline
            </Link>
          )}
          {canViewOverdue && (
            <Link
              href="/schedule?view=overdue"
              aria-current={overdue ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium ${overdue ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-950"}`}
            >
              Overdue <span className="tabular-nums">{overdueCount}</span>
            </Link>
          )}
        </nav>
      )}
      {project && overdue ? (
        <OverdueList key={project.id} project={project} tasks={app.tasks} />
      ) : !allowed ? (
        <p>Schedule planning requires commissioning management access.</p>
      ) : project ? (
        <div className="space-y-6" key={project.id}>
          {commissioning(project).sourceProgrammeSummary ? (
            <SourceProgrammeWorkspace
              key={commissioning(project).sourceProgrammeSummary!.sha256}
              projectId={project.id}
              summary={commissioning(project).sourceProgrammeSummary!}
            />
          ) : (
            <Schedule project={project} />
          )}
          <SourceProgrammeImport
            projectId={project.id}
            version={commissioning(project).version}
            onImported={app.refreshData}
          />
          {app.currentUser.role === "admin" &&
            commissioning(project).sourceProgrammeSummary && (
              <SourceProgrammeRestore
                projectId={project.id}
                version={commissioning(project).version}
                sourceSha256={
                  commissioning(project).sourceProgrammeSummary!.sha256
                }
                onRestored={app.refreshData}
              />
            )}
        </div>
      ) : (
        <p>No project assigned.</p>
      )}
    </AppShell>
  );
}

function Schedule({ project }: { project: Project }) {
  const { tasks, isOnline, currentUser } = useApp();
  const state = commissioning(project);
  const [query, setQuery] = useState("");
  const [mobileTimeline, setMobileTimeline] = useState(false);
  const [page, setPage] = useState(0);
  const [assetId, setAssetId] = useState("");
  const [groupBy, setGroupBy] = useState<
    "location" | "phase" | "floor" | "area"
  >("location");
  const [editing, setEditing] = useState<{
    activity: ScheduleActivity;
    version: number;
    anchor: HTMLElement;
  } | null>(null);
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const selectedAsset = state.assets.find((a) => a.id === assetId);
  const ids = selectedAsset
    ? assetActivityIds(selectedAsset, projectTasks)
    : null;
  const rows = state.schedule.filter(
    (r) =>
      (!ids || ids.has(r.activityId)) &&
      `${r.activityId} ${r.name}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / 50) - 1),
  );
  const visible = rows.slice(currentPage * 50, currentPage * 50 + 50);
  const linked = tasks.filter(
    (t) => t.projectId === project.id && t.cx?.activityId,
  ).length;
  function edit(
    activity: ScheduleActivity,
    anchor = document.activeElement as HTMLElement,
  ) {
    setEditing({ activity, version: state.version, anchor });
  }
  function addActivity() {
    edit({
      activityId: "",
      name: "",
      notBefore: projectDate(),
      durationDays: 1,
    });
  }
  const history = (
    <details className="border-t border-slate-200 pt-5">
      <summary className="min-h-11 cursor-pointer text-sm font-medium text-slate-700">
        Project history
      </summary>
      <div className="mt-3">
        <ProjectAudit projectId={project.id} refreshKey={state.version} />
      </div>
    </details>
  );
  const activityDialog = editing && (
    <ActivityDialog
      project={project}
      activity={editing.activity}
      version={editing.version}
      anchor={editing.anchor}
      onClose={() => setEditing(null)}
    />
  );
  if (!state.schedule.length)
    return (
      <div className="space-y-8">
        <ProgrammeReference key={project.id} project={project} />
        {activityDialog}
        <section
          className="bg-white border rounded-xl px-5 py-8 sm:px-10 sm:py-12"
          aria-labelledby="schedule-start"
        >
          <CalendarDays
            className="size-8 text-blue-700 mb-6"
            aria-hidden="true"
          />
          <h2
            id="schedule-start"
            className="text-2xl font-semibold tracking-tight"
          >
            Plan your first activity
          </h2>
          <p className="mt-3 text-slate-600 max-w-xl leading-relaxed">
            Add a start date and duration. Your schedule will show when work
            happens and which activities depend on each other.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:items-center">
            <Button
              className="min-h-11"
              disabled={!isOnline}
              onClick={addActivity}
            >
              <Plus className="size-4" /> Add first activity
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/commissioning#import-register">Import schedule</Link>
            </Button>
          </div>
          <div className="mt-10 border-t pt-6 grid gap-6 sm:grid-cols-2 max-w-2xl">
            <div>
              <h3 className="font-medium">Equipment belongs in Assets</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Add the equipment and choose its required tags. Link it to
                schedule activities when you are ready.
              </p>
              <Link
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue-700 underline underline-offset-4"
                href="/commissioning"
              >
                Go to Assets <ArrowRight className="size-4" />
              </Link>
            </div>
            <div>
              <h3 className="font-medium">Work and tests belong in Tasks</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Assign work, record test results and collect evidence. Linked
                tasks follow the dates in this schedule.
              </p>
              {hasModule(currentUser, "tasks") && (
                <Link
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue-700 underline underline-offset-4"
                  href="/supervisor"
                >
                  Go to Tasks <ArrowRight className="size-4" />
                </Link>
              )}
            </div>
          </div>
        </section>
        {history}
      </div>
    );
  return (
    <div className="space-y-6">
      <ProgrammeReference key={project.id} project={project} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-lg">Schedule activities</h2>
          <p className="text-sm text-slate-600 mt-1">
            {state.schedule.length} activities · {linked} linked tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/commissioning#import-register">Import</Link>
          </Button>
          <Button
            disabled={!isOnline}
            className="min-h-11"
            onClick={addActivity}
          >
            <Plus className="size-4" /> Add activity
          </Button>
        </div>
      </div>
      {activityDialog}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-sm w-full sm:w-80">
          Find an activity
          <Input
            className="min-h-11 mt-1"
            value={query}
            placeholder="Name or reference"
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <div
          className="md:hidden flex items-center gap-1 rounded-lg border bg-white p-1"
          aria-label="Schedule view"
        >
          <Button
            variant={mobileTimeline ? "ghost" : "secondary"}
            className="min-h-11"
            aria-pressed={!mobileTimeline}
            onClick={() => setMobileTimeline(false)}
          >
            <List className="size-4" /> Activities
          </Button>
          <Button
            variant={mobileTimeline ? "secondary" : "ghost"}
            className="min-h-11"
            aria-pressed={mobileTimeline}
            onClick={() => setMobileTimeline(true)}
          >
            <CalendarDays className="size-4" /> Timeline
          </Button>
        </div>
      </div>
      <div className="space-y-4">
        {state.assets.length > 0 && (
          <aside className="w-full rounded-xl border bg-white px-3">
            <details>
              <summary className="min-h-11 content-center font-semibold text-sm cursor-pointer">
                Browse equipment{" "}
                <span className="font-normal text-slate-600">
                  ({state.assets.length})
                </span>
                {selectedAsset && (
                  <span className="font-normal text-slate-600 break-words">
                    {" "}
                    · {selectedAsset.name}
                  </span>
                )}
              </summary>
              <div className="grid gap-3 pb-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="self-end sm:justify-self-start"
                  onClick={() => {
                    setAssetId("");
                    setPage(0);
                  }}
                >
                  All schedule activities
                </Button>
                <label className="block text-xs">
                  Group assets by
                  <select
                    aria-label="Group assets by"
                    className="field-select mt-1"
                    value={groupBy}
                    onChange={(e) =>
                      setGroupBy(e.target.value as typeof groupBy)
                    }
                  >
                    <option value="location">Location</option>
                    <option value="phase">Phase</option>
                    <option value="floor">Floor</option>
                    <option value="area">Area</option>
                  </select>
                </label>
                <div className="max-h-96 overflow-y-auto grid gap-2 sm:col-span-2 sm:grid-cols-2 xl:grid-cols-3">
                  {[...new Set(state.assets.map((a) => a.equipmentType))]
                    .sort()
                    .map((type) => {
                      const assets = state.assets.filter(
                        (a) => a.equipmentType === type,
                      );
                      return (
                        <details key={type} className="min-w-0 self-start">
                          <summary className="cursor-pointer text-sm py-1 font-medium">
                            {type}{" "}
                            <span className="text-slate-500 font-normal">
                              ({assets.length})
                            </span>
                          </summary>
                          {[
                            ...new Set(
                              assets.map((a) => a[groupBy] || "Not recorded"),
                            ),
                          ]
                            .sort()
                            .map((group) => (
                              <details key={group} className="ml-3">
                                <summary className="cursor-pointer py-1 text-xs text-slate-600">
                                  {group}
                                </summary>
                                <div className="ml-3 border-l pl-2">
                                  {assets
                                    .filter(
                                      (a) =>
                                        (a[groupBy] || "Not recorded") ===
                                        group,
                                    )
                                    .map((a) => (
                                      <button
                                        key={a.id}
                                        className={`block w-full text-left py-2 text-xs rounded hover:bg-blue-50 focus-visible:outline-blue-600 ${a.id === assetId ? "text-blue-700 font-semibold" : "text-blue-900"}`}
                                        title={a.name}
                                        onClick={() => {
                                          setAssetId(a.id);
                                          setPage(0);
                                        }}
                                      >
                                        {a.id}
                                        <span className="block text-blue-800 font-normal">
                                          {
                                            assetActivityIds(a, projectTasks)
                                              .size
                                          }{" "}
                                          linked activities
                                        </span>
                                      </button>
                                    ))}
                                </div>
                              </details>
                            ))}
                        </details>
                      );
                    })}
                  {!state.assets.length && (
                    <p className="text-xs text-slate-600">
                      Add assets in the register to navigate by equipment type
                      and location.
                    </p>
                  )}
                </div>
              </div>
            </details>
          </aside>
        )}
        <div className="min-w-0 w-full space-y-3">
          {selectedAsset && (
            <p className="text-sm">
              Equipment: <strong>{selectedAsset.name}</strong>
              <button
                className="text-blue-700 underline underline-offset-4 ml-3 min-h-11"
                onClick={() => setAssetId("")}
              >
                Clear filter
              </button>
            </p>
          )}
          {visible.length ? (
            <>
              {!mobileTimeline && (
                <ol
                  className="md:hidden divide-y border rounded-xl bg-white"
                  aria-label="Schedule activities"
                >
                  {visible.map((row) => (
                    <li key={row.activityId}>
                      <button
                        onClick={(event) => edit(row, event.currentTarget)}
                        className="w-full text-left p-4 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700"
                      >
                        <span className="text-xs text-slate-600">
                          {row.activityId}
                        </span>
                        <strong className="block text-sm mt-1">
                          {row.name}
                        </strong>
                        <span className="flex flex-wrap justify-between gap-2 text-sm mt-3">
                          <span>
                            {row.start
                              ? formatDate(row.start)
                              : "Start not set"}{" "}
                            →{" "}
                            {row.finish
                              ? formatDate(row.finish)
                              : "Finish not set"}
                          </span>
                          <span className="text-slate-600">
                            {row.progress === undefined
                              ? "Progress not recorded"
                              : `${row.progress}% complete`}
                          </span>
                        </span>
                        <span className="block text-xs text-blue-700 mt-3">
                          Edit dates and dependencies →
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <div className={mobileTimeline ? "block" : "hidden md:block"}>
                <Gantt
                  rows={visible}
                  all={state.schedule}
                  totalMatching={rows.length}
                  onEdit={edit}
                />
              </div>
            </>
          ) : (
            <section className="border rounded-xl bg-white p-6">
              <h3 className="font-semibold">
                {query
                  ? "No activities match your filters"
                  : selectedAsset
                    ? "No activities linked to this equipment"
                    : "No activities found"}
              </h3>
              <p className="text-sm text-slate-600 mt-2">
                {query
                  ? "Try another name or reference, or clear your filters."
                  : selectedAsset
                    ? "Choose an activity in the equipment’s delivery or tag settings."
                    : "Try another name or reference."}
              </p>
              <Button
                variant="outline"
                className="mt-4 min-h-11"
                onClick={() => {
                  setQuery("");
                  setAssetId("");
                }}
              >
                Show all activities
              </Button>
            </section>
          )}
        </div>
      </div>
      {rows.length > 50 && (
        <div className="flex items-center justify-between gap-3">
          <Button
            className="min-h-11"
            variant="outline"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {currentPage + 1} of {Math.ceil(rows.length / 50)}
          </span>
          <Button
            className="min-h-11"
            variant="outline"
            disabled={(currentPage + 1) * 50 >= rows.length}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
      <details className="text-sm text-slate-600 border-t pt-4">
        <summary className="cursor-pointer min-h-11">
          Calendar and scheduling rules
        </summary>
        <p className="max-w-2xl leading-relaxed pb-4">
          Monday–Friday, without public holidays. Finish-to-start links release
          successors on the next working day; lag is measured in working days.
          Baseline dates stay recorded when the schedule changes.
        </p>
      </details>
      {history}
    </div>
  );
}

function ActivityDialog({
  project,
  activity,
  version,
  anchor,
  onClose,
}: {
  project: Project;
  activity: ScheduleActivity;
  version: number;
  anchor: HTMLElement;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        ref={contentRef}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current
            ?.querySelector<HTMLInputElement>('input[name="name"]')
            ?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (anchor.isConnected) anchor.focus({ preventScroll: true });
        }}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogTitle className="pr-8 break-words">
          {activity.activityId
            ? `Edit ${activity.activityId}`
            : "New schedule activity"}
        </DialogTitle>
        <ActivityEditor
          project={project}
          activity={activity}
          version={version}
          onClose={onClose}
          onBusyChange={setBusy}
        />
      </DialogContent>
    </Dialog>
  );
}

function ActivityEditor({
  project,
  activity,
  version,
  onClose,
  onBusyChange,
}: {
  project: Project;
  activity: ScheduleActivity;
  version: number;
  onClose: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { mutate, isOnline } = useApp();
  const state = commissioning(project);
  const [links, setLinks] = useState(activity.predecessors ?? []);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [proposal, setProposal] = useState<{
    activity: ScheduleActivity;
    reason: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  const stale = version !== state.version;
  let referenceNumber = state.schedule.length + 1;
  while (
    state.schedule.some(
      (row) =>
        row.activityId === `ACT-${String(referenceNumber).padStart(3, "0")}`,
    )
  )
    referenceNumber++;
  const suggestedReference = `ACT-${String(referenceNumber).padStart(3, "0")}`;
  async function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: ScheduleActivity = {
      ...activity,
      activityId: String(form.get("activityId")).trim(),
      name: String(form.get("name")).trim(),
      notBefore: String(form.get("notBefore")),
      start: activity.actualFinish
        ? activity.start
        : String(form.get("notBefore")),
      durationDays: Number(form.get("durationDays")),
      predecessors: links,
      progress:
        form.get("progress") === "" ? undefined : Number(form.get("progress")),
    };
    if (
      !activity.activityId &&
      state.schedule.some((row) => row.activityId === next.activityId)
    ) {
      setError("This activity ID already exists. Choose a unique ID.");
      setPreview(null);
      setProposal(null);
      return;
    }
    // Finish is calculated on the server; omit the old forecast so shortening a duration is valid.
    delete next.finish;
    const data = { activity: next, reason: String(form.get("reason")).trim() };
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const result = await mutate<Preview>(
        `/api/projects/${project.id}/commissioning`,
        {
          method: "PATCH",
          body: JSON.stringify({
            action: "schedule",
            version,
            preview: true,
            ...data,
          }),
        },
      );
      setPreview(result);
      setProposal(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not preview the change.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!proposal || !preview || preview.errors.length || stale) return;
    setBusy(true);
    setError("");
    try {
      await mutate(`/api/projects/${project.id}/commissioning`, {
        method: "PATCH",
        body: JSON.stringify({ action: "schedule", version, ...proposal }),
      });
      toast.success("Schedule saved. Linked task deadlines updated.");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the schedule.");
    } finally {
      setBusy(false);
    }
  }
  const invalidate = () => {
    setPreview(null);
    setProposal(null);
  };
  const initialDuration =
    activity.durationDays ??
    (activity.start && activity.finish
      ? workingDuration(activity.start, activity.finish)
      : 1);
  const calculated = preview?.activities?.find(
    (r) => r.activityId === proposal?.activity.activityId,
  );
  return (
    <section className="space-y-4" aria-label="Activity editor">
      {stale && (
        <p role="alert" className="text-sm text-red-700">
          The schedule changed while this editor was open. Close and reopen the
          activity to review the latest revision. Your change has not been
          saved.
        </p>
      )}
      <form onSubmit={review} onChange={invalidate} className="space-y-4">
        <fieldset
          disabled={busy || stale}
          className="space-y-4 [&_input]:min-h-11 [&_select]:min-h-11"
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">
              Reference
              <Input
                name="activityId"
                required
                maxLength={150}
                defaultValue={activity.activityId || suggestedReference}
                readOnly={!!activity.activityId}
                placeholder="e.g. INSTALL-001"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              Activity name
              <Input
                name="name"
                required
                maxLength={500}
                defaultValue={activity.name}
              />
            </label>
            <label className="text-sm">
              Earliest start
              <Input
                name="notBefore"
                type="date"
                required
                readOnly={!!activity.actualFinish}
                defaultValue={
                  activity.notBefore ?? activity.start ?? projectDate()
                }
              />
            </label>
            <label className="text-sm">
              Duration (working days)
              <Input
                name="durationDays"
                type="number"
                required
                readOnly={!!activity.actualFinish}
                min={1}
                max={3650}
                defaultValue={initialDuration}
              />
            </label>
            <label className="text-sm">
              Progress (%)
              <Input
                name="progress"
                type="number"
                min={0}
                max={100}
                defaultValue={activity.progress ?? ""}
                placeholder="Not recorded"
              />
            </label>
          </div>
          {state.schedule.some(
            (row) => row.activityId !== activity.activityId,
          ) && (
            <details open={links.length > 0} className="border-t pt-3">
              <summary className="cursor-pointer min-h-11 text-sm font-medium">
                Dependencies
                {links.length ? ` (${links.length})` : " · optional"}
              </summary>
              <fieldset className="space-y-3">
                <legend className="sr-only">
                  Finish-to-start predecessors
                </legend>
                <p className="text-xs text-slate-600">
                  Choose work that must finish before this activity can start.
                  Dates update together when a linked activity moves.
                </p>
                {links.map((link, index) => (
                  <div key={index} className="flex flex-wrap items-end gap-2">
                    <label className="text-sm grow min-w-48">
                      Predecessor
                      <select
                        aria-label={`Predecessor ${index + 1}`}
                        className="field-select mt-1"
                        required
                        value={link.activityId}
                        onChange={(e) => {
                          invalidate();
                          setLinks(
                            links.map((p, i) =>
                              i === index
                                ? { ...p, activityId: e.target.value }
                                : p,
                            ),
                          );
                        }}
                      >
                        <option value="">Choose activity</option>
                        {state.schedule
                          .filter((r) => r.activityId !== activity.activityId)
                          .map((r) => (
                            <option key={r.activityId} value={r.activityId}>
                              {r.activityId} · {r.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="text-sm w-32">
                      Lag (workdays)
                      <Input
                        aria-label={`Lag ${index + 1}`}
                        type="number"
                        min={0}
                        max={365}
                        required
                        value={link.lagDays}
                        onChange={(e) => {
                          invalidate();
                          setLinks(
                            links.map((p, i) =>
                              i === index
                                ? { ...p, lagDays: Number(e.target.value) }
                                : p,
                            ),
                          );
                        }}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Remove predecessor ${index + 1}`}
                      onClick={() => {
                        invalidate();
                        setLinks(links.filter((_, i) => i !== index));
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={links.length >= 100 || state.schedule.length === 0}
                  onClick={() => {
                    invalidate();
                    setLinks([...links, { activityId: "", lagDays: 0 }]);
                  }}
                >
                  Add predecessor
                </Button>
              </fieldset>
            </details>
          )}
          <p className="text-xs text-slate-600">
            Monday–Friday calendar. Finish is calculated from the duration.
            Baseline: {activity.baselineStart ?? "set on first save"} →{" "}
            {activity.baselineFinish ?? "set on first save"}
            {activity.actualFinish
              ? ` · Actual finish: ${activity.actualFinish}`
              : ""}
            . Tag approval is recorded in its test sheet.
          </p>
          <label className="text-sm block">
            Change note
            <Input
              name="reason"
              defaultValue={
                activity.activityId ? "" : "Initial schedule activity"
              }
              required
              minLength={10}
              maxLength={1000}
              placeholder="Explain the schedule change"
            />
          </label>
          <Button
            className="min-h-11 w-full sm:w-auto"
            disabled={busy || !isOnline || stale}
          >
            {busy ? "Checking…" : "Preview schedule change"}
          </Button>
        </fieldset>
      </form>
      <Button variant="outline" disabled={busy} onClick={onClose}>
        Cancel
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {preview && (
        <div className="border-t pt-4 space-y-3" aria-live="polite">
          <h4 className="font-semibold text-sm">Review the schedule impact</h4>
          {calculated && (
            <p className="text-sm">
              Calculated dates:{" "}
              <strong>
                {calculated.start} → {calculated.finish}
              </strong>
            </p>
          )}
          {preview.errors.length ? (
            <ul className="list-disc pl-5 text-sm text-red-700">
              {preview.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                {preview.changes.length} recorded changes. The existing baseline
                is preserved.
              </p>
              <ul className="max-h-60 overflow-auto list-disc pl-5 text-sm space-y-1">
                {preview.changes.map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
              <Button
                onClick={save}
                disabled={busy || stale || !isOnline || !preview.changes.length}
              >
                {busy ? "Saving…" : "Save schedule revision"}
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Gantt({
  rows,
  all,
  totalMatching,
  onEdit,
}: {
  rows: ScheduleActivity[];
  all: ScheduleActivity[];
  totalMatching: number;
  onEdit: (r: ScheduleActivity, anchor: HTMLElement) => void;
}) {
  const first =
    rows.flatMap((r) => (r.start ? [r.start] : [])).sort()[0] ?? projectDate();
  const [anchor, setAnchor] = useState<string | null>(null);
  const [zoom, setZoom] = useState<GanttScale>("day");
  const [showLinks, setShowLinks] = useState(false);
  const [showDuration, setShowDuration] = useState(true);
  const tableWidth = (showLinks ? 670 : 480) - (showDuration ? 0 : 64);
  const start = anchor ?? shiftDate(first, -2);
  const { span, unit, width, columns } = ganttAxis(start, zoom);
  const positions = new Map(
    rows.map((r, i) => [r.activityId, { row: r, index: i }]),
  );
  const x = (date: string) => calendarDays(start, date) * unit;
  const clipped = (n: number) => Math.max(0, Math.min(width, n));
  const todayX = x(projectDate());
  return (
    <>
      <section
        className="rounded-xl border bg-white overflow-hidden"
        aria-label="Project Gantt"
      >
        <div className="flex flex-wrap gap-3 items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Earlier dates"
              onClick={() => setAnchor(shiftDate(start, -Math.floor(span / 2)))}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <span className="text-sm tabular-nums">
              {formatDate(start)} – {formatDate(shiftDate(start, span - 1))}
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Later dates"
              onClick={() => setAnchor(shiftDate(start, Math.floor(span / 2)))}
            >
              <ArrowRight className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="text-xs">
              Go to date
              <Input
                aria-label="Gantt go to date"
                type="date"
                value={start}
                onChange={(e) => {
                  if (e.target.value) setAnchor(e.target.value);
                }}
              />
            </label>
            <label className="text-xs">
              Scale
              <select
                aria-label="Gantt scale"
                value={zoom}
                onChange={(e) => setZoom(e.target.value as GanttScale)}
                className="field-select mt-1"
              >
                <option value="day">Days</option>
                <option value="week">Weeks</option>
                <option value="month">Months</option>
              </select>
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnchor(shiftDate(projectDate(), -7))}
            >
              Today
            </Button>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={showLinks}
                onChange={(e) => setShowLinks(e.target.checked)}
              />
              Show dependency links
            </label>
            <InfoPopover label="About schedule dependency links">
              <p>
                Show or hide finish-to-start arrows between activities on this
                page and the predecessor/successor columns. This changes the
                display only; links and dates stay unchanged.
              </p>
            </InfoPopover>
            <span className="text-xs tabular-nums text-slate-600">
              {totalMatching} matching activities
            </span>
            <label className="flex min-h-11 items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={showDuration}
                onChange={(event) => setShowDuration(event.target.checked)}
              />
              Show duration
            </label>
          </div>
        </div>
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Scrollable schedule table and timeline"
        >
          <div className="flex" style={{ minWidth: tableWidth + width }}>
            <table
              className="text-xs border-collapse table-fixed shrink-0 tabular-nums"
              style={{ width: tableWidth }}
            >
              <caption className="sr-only">
                Schedule activities. Select an activity to edit its dates and
                dependencies.
              </caption>
              <thead>
                <tr className="h-14 bg-slate-50 text-slate-600 text-left">
                  <th className="px-3 w-44">
                    <div className="flex items-center justify-between gap-1">
                      Activity / asset
                      {!showDuration && (
                        <button
                          type="button"
                          className="grid min-h-11 min-w-11 place-items-center rounded-md hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-blue-700"
                          aria-label="Show duration column"
                          onClick={() => setShowDuration(true)}
                        >
                          <Eye className="size-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="w-12">
                    <span className="sr-only">Quick edit</span>
                  </th>
                  {showDuration && (
                    <th className="px-1 w-16">
                      <button
                        type="button"
                        className="flex min-h-11 items-center gap-1 rounded-md px-1 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-blue-700"
                        aria-label="Hide duration column"
                        onClick={() => setShowDuration(false)}
                      >
                        Days
                        <EyeOff className="size-3.5" aria-hidden="true" />
                      </button>
                    </th>
                  )}
                  <th className="px-2 w-24">Start</th>
                  <th className="px-2 w-24">Finish</th>
                  {showLinks && <th className="px-2">Predecessors</th>}
                  {showLinks && <th className="px-2">Successors</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const successors = all.filter((s) =>
                    s.predecessors?.some((p) => p.activityId === r.activityId),
                  );
                  return (
                    <tr
                      key={r.activityId}
                      className="h-12 border-t hover:bg-blue-50/40"
                      onContextMenu={(event) => {
                        event.preventDefault();
                        onEdit(
                          r,
                          event.currentTarget.querySelector<HTMLButtonElement>(
                            "button",
                          )!,
                        );
                      }}
                    >
                      <td className="px-3">
                        <button
                          className="text-xs text-left w-full hover:text-blue-700 focus-visible:outline-blue-600"
                          onClick={(event) => onEdit(r, event.currentTarget)}
                          onKeyDown={(event) => {
                            if (
                              event.key === "ContextMenu" ||
                              (event.shiftKey && event.key === "F10")
                            ) {
                              event.preventDefault();
                              onEdit(r, event.currentTarget);
                            }
                          }}
                        >
                          <strong className="block truncate" title={r.name}>
                            {r.name}
                          </strong>
                          <span
                            className="block truncate text-slate-600"
                            title={r.activityId}
                          >
                            {r.activityId}
                          </span>
                        </button>
                      </td>
                      <td className="px-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="min-h-11 min-w-11"
                          aria-label={`Quick edit ${r.activityId}`}
                          onClick={(event) => onEdit(r, event.currentTarget)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                      </td>
                      {showDuration && (
                        <td className="px-2">
                          {r.durationDays ??
                            (r.start && r.finish
                              ? workingDuration(r.start, r.finish)
                              : "—")}{" "}
                          wd
                        </td>
                      )}
                      <td className="px-2">{r.start ?? "Not set"}</td>
                      <td className="px-2">{r.finish ?? "Not set"}</td>
                      {showLinks && (
                        <td
                          className="px-2 truncate"
                          title={r.predecessors
                            ?.map((p) => `${p.activityId} FS+${p.lagDays}`)
                            .join(", ")}
                        >
                          {r.predecessors
                            ?.map(
                              (p) =>
                                `${p.activityId}${p.lagDays ? ` +${p.lagDays}wd` : ""}`,
                            )
                            .join(", ") || "—"}
                        </td>
                      )}
                      {showLinks && (
                        <td
                          className="px-2 truncate"
                          title={successors.map((s) => s.activityId).join(", ")}
                        >
                          {successors.map((s) => s.activityId).join(", ") ||
                            "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="relative shrink-0 border-l" style={{ width }}>
              <div className="border-b">
                <GanttRuler start={start} scale={zoom} />
              </div>
              <div className="relative" style={{ height: rows.length * 48 }}>
                <svg
                  className="absolute inset-0 pointer-events-none"
                  width={width}
                  height={rows.length * 48}
                  aria-hidden="true"
                >
                  <defs>
                    <marker
                      id="dependency-arrow"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                    </marker>
                  </defs>
                  {zoom === "day" &&
                    columns
                      .filter((column) => column.weekend)
                      .map((column) => (
                        <rect
                          key={`weekend-${column.date}`}
                          x={column.left}
                          y={0}
                          width={unit}
                          height={rows.length * 48}
                          fill="#f1f5f9"
                        />
                      ))}
                  {columns.map((column) => (
                    <line
                      key={column.date}
                      x1={column.left}
                      x2={column.left}
                      y1={0}
                      y2={rows.length * 48}
                      stroke="#e2e8f0"
                    />
                  ))}
                  {showLinks &&
                    rows.flatMap((r, i) =>
                      (r.predecessors ?? []).map((p) => {
                        const predecessor = positions.get(p.activityId);
                        if (!predecessor?.row.finish || !r.start) return null;
                        const from =
                            x(
                              predecessor.row.actualFinish ??
                                predecessor.row.finish,
                            ) + unit,
                          to = x(r.start);
                        if (from < 0 || to > width || to < 0 || from > width)
                          return null;
                        const mid = Math.max(from + 6, to - 8);
                        return (
                          <path
                            key={`${r.activityId}-${p.activityId}`}
                            d={`M ${from} ${predecessor.index * 48 + 24} H ${mid} V ${i * 48 + 24} H ${to}`}
                            fill="none"
                            stroke="#64748b"
                            strokeWidth="1.25"
                            markerEnd="url(#dependency-arrow)"
                          />
                        );
                      }),
                    )}
                  {todayX >= 0 && todayX <= width && (
                    <line
                      x1={todayX}
                      x2={todayX}
                      y1={0}
                      y2={rows.length * 48}
                      stroke="#dc2626"
                      strokeDasharray="4 3"
                    />
                  )}
                </svg>
                {rows.map((r) => {
                  const left = r.start ? x(r.start) : -1,
                    right = r.finish ? x(r.finish) + unit : -1;
                  const baselineLeft = r.baselineStart
                    ? x(r.baselineStart)
                    : -1;
                  const baselineRight = r.baselineFinish
                    ? x(r.baselineFinish) + unit
                    : -1;
                  return (
                    <div
                      key={r.activityId}
                      className="h-12 border-b relative"
                      tabIndex={-1}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        onEdit(
                          r,
                          event.currentTarget.querySelector<HTMLButtonElement>(
                            "button",
                          ) ?? event.currentTarget,
                        );
                      }}
                    >
                      {baselineRight > 0 &&
                        baselineLeft < width &&
                        r.baselineStart && (
                          <span
                            className="absolute h-1 bg-slate-400 rounded-sm top-10"
                            style={{
                              left: clipped(baselineLeft),
                              width: Math.max(
                                2,
                                clipped(baselineRight) - clipped(baselineLeft),
                              ),
                            }}
                            title={`Baseline ${r.baselineStart} → ${r.baselineFinish}`}
                          />
                        )}
                      {r.start && r.finish && right > 0 && left < width ? (
                        <button
                          className="absolute top-3 h-6 rounded-sm bg-blue-100 border border-blue-400 text-blue-950 overflow-hidden text-[10px] hover:bg-blue-200 focus-visible:outline-2 focus-visible:outline-blue-700"
                          style={{
                            left: clipped(left),
                            width: Math.max(6, clipped(right) - clipped(left)),
                          }}
                          title={`${r.activityId}: ${r.name}; ${r.start} → ${r.finish}; ${r.progress ?? "unrecorded"}%`}
                          aria-label={`Edit ${r.activityId}: ${r.name}, ${r.start} to ${r.finish}`}
                          onClick={(event) => onEdit(r, event.currentTarget)}
                        >
                          <span
                            className="absolute left-0 inset-y-0 bg-blue-400/50"
                            style={{ width: `${r.progress ?? 0}%` }}
                          />
                          <span className="relative whitespace-nowrap px-1">
                            {r.progress !== undefined
                              ? `${r.progress}%`
                              : r.activityId}
                          </span>
                        </button>
                      ) : (
                        <span className="absolute left-3 top-4 text-xs text-slate-500">
                          {r.start && r.finish
                            ? "Outside this date window"
                            : "Dates not set"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-1 text-xs text-slate-600">
          <p>Saved schedule · Days use the app’s Monday–Friday calendar</p>
          <InfoPopover label="About the schedule timeline">
            <p>
              Blue shows schedule and recorded progress; grey shows the original
              baseline and the dashed red line marks today. Arrows show
              finish-to-start links between activities visible on this page when
              dependency links are enabled.
            </p>
            <p>
              Select an activity or bar to edit. Right-click a row or use its
              pencil for quick changes here. Changing display controls does not
              save a schedule revision.
            </p>
          </InfoPopover>
        </div>
      </section>
    </>
  );
}
