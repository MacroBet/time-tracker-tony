"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  CalendarDays,
  Columns3,
  SlidersHorizontal,
  Plus,
  CalendarClock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  type SourceProgrammePage,
  type SourceProgrammeSummary,
} from "@/lib/programme-source";
import { parseP6Xer } from "@/lib/p6-xer";
import {
  scheduleViewCommandEvent,
  scheduleViewCommandResultEvent,
  scheduleViewCommandSchema,
  resolveScheduleViewCommand,
} from "@/lib/schedule-view-context";
import { projectDate } from "@/lib/domain";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SourceProgrammeGantt } from "./SourceProgrammeGantt";
import { SourceCriticalityInfo } from "./SourceCriticalityInfo";
import {
  sourcePageAnchor,
  sourceGanttInitialView,
  reduceSourceGanttView,
  sourceGanttColumns,
  type SourceGanttViewState,
  type SourceGanttViewCommand,
  type SourceDurationMode,
  sourceCriticalityLabel,
} from "@/lib/source-gantt";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { InfoPopover } from "./InfoPopover";
import { WorkingScheduleEditor } from "./WorkingScheduleEditor";
import { useApp } from "../contexts/AppContext";
import { hasModule } from "@/lib/commissioning";
import type { ActivityStepProgress } from "@/lib/project-reports";

const number = (value: number) => value.toLocaleString("en-GB");

export function SourceProgrammeRestore({
  projectId,
  version,
  sourceSha256,
  onRestored,
}: {
  projectId: string;
  version: number;
  sourceSha256: string;
  onRestored: () => Promise<void>;
}) {
  const [reason, setReason] = useState(""),
    [previewVersion, setPreviewVersion] = useState<number | null>(null),
    [busy, setBusy] = useState(false);
  async function restore(preview: boolean) {
    setBusy(true);
    try {
      const params = new URLSearchParams({
        version: String(preview ? version : previewVersion),
        reason: reason.trim() || "Preview source-only schedule restoration",
        sha256: sourceSha256,
        preview: String(preview),
      });
      const response = await fetch(
        `/api/projects/${projectId}/programme-source?${params}`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Schedule restoration failed.");
      if (preview) setPreviewVersion(version);
      else {
        setPreviewVersion(null);
        await onRestored();
        toast.success(
          "Source-only schedule load removed; project history retained",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Schedule restoration failed",
      );
      setPreviewVersion(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">
        Restore a source-only schedule load
      </summary>
      <div className="mt-4 max-w-prose space-y-3">
        <p className="text-sm text-slate-600">
          Only for a project with no other assets, tasks or managed schedule.
          Removes the imported source view while keeping the project and its
          history.
        </p>
        <label className="block text-sm font-medium">
          Reason for restoration
          <Input
            className="mt-1 min-h-11"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setPreviewVersion(null);
            }}
            maxLength={1000}
          />
        </label>
        <Button
          className="min-h-11"
          variant="outline"
          disabled={busy}
          onClick={() => void restore(true)}
        >
          Preview source removal
        </Button>
        {previewVersion !== null && (
          <div className="space-y-3 border-t pt-3">
            <p className="text-sm">
              The source schedule will be removed. No project or audit records
              will be deleted.
            </p>
            {previewVersion !== version && (
              <p role="alert" className="text-sm text-red-700">
                The project changed. Preview again.
              </p>
            )}
            <Button
              className="min-h-11"
              variant="destructive"
              disabled={
                busy || previewVersion !== version || reason.trim().length < 10
              }
              onClick={() => void restore(false)}
            >
              Confirm source removal
            </Button>
          </div>
        )}
      </div>
    </details>
  );
}
const statusLabel = (status: string) =>
  ({
    TK_NotStart: "Not started",
    TK_Active: "In progress",
    TK_Complete: "Complete",
  })[status] || status;

export function SourceProgrammeImport({
  projectId,
  projectName,
  version,
  onImported,
}: {
  projectId: string;
  projectName?: string;
  version: number;
  onImported?: () => Promise<void>;
}) {
  const id = useId();
  const app = useApp();
  const params = useSearchParams();
  const destination =
    projectName ??
    app.projects.find((project) => project.id === projectId)?.name ??
    projectId;
  const [importOpen, setImportOpen] = useState(
    params.get("setup") === "import",
  );
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    body: Uint8Array;
    summary: SourceProgrammeSummary;
    version: number;
  } | null>(null);
  async function send(
    body: Uint8Array,
    previewOnly: boolean,
    requestVersion: number,
  ) {
    const params = new URLSearchParams({
      version: String(requestVersion),
      reason: reason.trim() || "Preview P6 source schedule without saving",
      preview: String(previewOnly),
    });
    const response = await fetch(
      `/api/projects/${projectId}/programme-source?${params}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/gzip" },
        body: new Blob([new Uint8Array(body)], { type: "application/gzip" }),
      },
    );
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Schedule import failed.");
    return result as { summary: SourceProgrammeSummary; updated?: boolean };
  }
  async function stage() {
    if (!file) return;
    setBusy(true);
    setPreview(null);
    try {
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      let body: Uint8Array;
      if (file.name.toLowerCase().endsWith(".gz")) {
        body = fileBytes;
      } else {
        const schedule = await parseP6Xer(fileBytes, file.name);
        const compressed = new Blob([JSON.stringify(schedule)])
          .stream()
          .pipeThrough(new CompressionStream("gzip"));
        body = new Uint8Array(await new Response(compressed).arrayBuffer());
      }
      if (body.byteLength > 4 * 1024 * 1024)
        throw new Error(
          "The compressed source exceeds the 4 MiB upload limit. No data was saved.",
        );
      const result = await send(body, true, version);
      setPreview({ body, summary: result.summary, version });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not read this XER export.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!preview || preview.version !== version || reason.trim().length < 10)
      return;
    setBusy(true);
    try {
      await send(preview.body, false, preview.version);
      setPreview(null);
      setFile(null);
      setReason("");
      await onImported?.();
      toast.success("P6 source schedule saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Schedule was not saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      open={importOpen}
      onToggle={(event) => setImportOpen(event.currentTarget.open)}
      className="rounded-xl border border-slate-200 bg-white px-5 py-4"
    >
      <summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-slate-800">
        Import Primavera XER schedule
      </summary>
      <div className="mt-4 space-y-4 max-w-2xl">
        <p className="text-sm font-medium">Destination: {destination}</p>
        <p className="text-sm leading-relaxed text-slate-600">
          Keep the complete exported schedule and its saved dates, calendars and
          relationships. This does not convert its logic into the app’s
          working-day calculation or create tasks.
        </p>
        <label htmlFor={`${id}-file`} className="block text-sm font-medium">
          XER export or prepared source package
        </label>
        <Input
          id={`${id}-file`}
          className="min-h-11"
          type="file"
          accept=".xer,.gz"
          disabled={busy}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setPreview(null);
          }}
        />
        <Button
          type="button"
          className="min-h-11"
          disabled={busy || !file}
          onClick={stage}
        >
          <Upload className="size-4" aria-hidden="true" />
          {busy ? "Reading schedule…" : "Preview schedule"}
        </Button>
        {preview && (
          <section
            className="space-y-3 border-t border-slate-200 pt-4"
            aria-label="P6 import preview"
          >
            <p className="text-sm">
              Destination: <strong>{destination}</strong>
            </p>
            <p className="font-medium">
              Source programme: {preview.summary.projectName}
            </p>
            <p className="text-xs text-slate-600">{preview.summary.fileName}</p>
            <p className="text-sm tabular-nums">
              {number(preview.summary.activities)} activities ·{" "}
              {number(preview.summary.relationships)} relationships ·{" "}
              {number(preview.summary.calendars)} calendars
            </p>
            <p className="text-sm text-slate-600">
              The source schedule will be saved for this project. Existing
              assets, tasks and assignments are unchanged.
            </p>
            <label
              htmlFor={`${id}-reason`}
              className="block text-sm font-medium"
            >
              Reason for this import
            </label>
            <Input
              id={`${id}-reason`}
              className="min-h-11"
              value={reason}
              maxLength={1000}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Describe the schedule revision or test purpose"
            />
            {preview.version !== version && (
              <p role="alert" className="text-sm text-red-700">
                The project changed. Preview the file again before saving.
              </p>
            )}
            <Button
              type="button"
              className="min-h-11"
              disabled={
                busy || reason.trim().length < 10 || preview.version !== version
              }
              onClick={save}
            >
              Save source schedule
            </Button>
          </section>
        )}
      </div>
    </details>
  );
}

type SourceProgrammeWorkspaceProps = {
  projectId: string;
  summary: SourceProgrammeSummary;
  defaultDurationMode?: SourceDurationMode;
  defaultScope?: "project" | "personal";
  defaultView?: Partial<SourceGanttViewState>;
};
export function SourceProgrammeWorkspace(props: SourceProgrammeWorkspaceProps) {
  return (
    <SourceProgrammeView
      key={`${props.projectId}:${props.summary.sha256}`}
      {...props}
    />
  );
}
function SourceProgrammeView({
  projectId,
  summary,
  defaultDurationMode = "days",
  defaultScope = "project",
  defaultView,
}: SourceProgrammeWorkspaceProps) {
  const id = useId();
  const app = useApp();
  const params = useSearchParams();
  const project = app.projects.find((row) => row.id === projectId);
  const projectVersion = project?.commissioning?.version ?? 0;
  const [projection, setProjection] = useState<"working" | "source">("working");
  const [editor, setEditor] = useState<{ internalId?: string } | null>(null);
  const handledActivity = useRef<string | null>(null);
  const [query, setQuery] = useState("");
  const [wbs, setWbs] = useState("");
  const [calendar, setCalendar] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const defaults = {
    ...defaultView,
    durationMode: defaultView?.durationMode ?? defaultDurationMode,
  };
  const [view, setView] = useState(() =>
    sourceGanttInitialView(projectDate(), defaults),
  );
  const { anchor, scale, horizon, showLinks, durationMode, columns, critical } =
    view;
  const viewRef = useRef(view);
  const [viewportDate, setViewportDate] = useState(anchor);
  const viewportDateRef = useRef(anchor);
  function updateViewportDate(date: string) {
    viewportDateRef.current = date;
    setViewportDate(date);
  }
  const [timelineReset, setTimelineReset] = useState(0);
  function applyViewCommand(command: SourceGanttViewCommand) {
    const navigates = [
      "date",
      "today",
      "pan",
      "scale",
      "horizon",
      "reset",
    ].includes(command.type);
    const next = reduceSourceGanttView(
      navigates
        ? { ...viewRef.current, anchor: viewportDateRef.current }
        : viewRef.current,
      command,
      projectDate(),
      defaults,
    );
    viewRef.current = next;
    setView(next);
    if (command.type === "critical" || command.type === "reset") setPage(0);
    if (navigates) {
      updateViewportDate(next.anchor);
      setTimelineReset((value) => value + 1);
    }
  }
  const detailTrigger = useRef<HTMLElement | null>(null);
  const detailContent = useRef<HTMLDivElement | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  useEffect(() => () => detailRequest.current?.abort(), []);
  const [refresh, setRefresh] = useState(0);
  const loadedKey = useRef<string | null>(null);
  const requestKey = JSON.stringify([
    projectId,
    summary.sha256,
    projectVersion,
    projection,
    query,
    wbs,
    calendar,
    status,
    critical,
    page,
    refresh,
  ]);
  const [data, setData] = useState<
    | (SourceProgrammePage & {
        workingRevision?: number;
        projectVersion?: number;
        activityProgress?: Record<string, ActivityStepProgress>;
      })
    | null
  >(null);
  const [detail, setDetail] = useState<SourceProgrammePage["detail"]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    loadedKey.current = null;
    try {
      sessionStorage.removeItem(`fieldtrack:schedule-view:${projectId}`);
    } catch {
      /* Browser storage may be disabled. */
    }
    const timer = setTimeout(
      async () => {
        setLoading(true);
        setError("");
        const params = new URLSearchParams({
          q: query,
          wbs,
          calendar,
          status,
          critical,
          page: String(page),
          view: projection,
        });
        try {
          const response = await fetch(
            `/api/projects/${projectId}/schedule-working?${params}`,
            { signal: controller.signal },
          );
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.error || "Could not load schedule.");
          if (controller.signal.aborted) return;
          loadedKey.current = requestKey;
          setData(result);
        } catch (failure) {
          if (!controller.signal.aborted) {
            setData(null);
            setError(
              failure instanceof Error
                ? failure.message
                : "Could not load schedule.",
            );
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      query || wbs ? 200 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    projectId,
    summary.sha256,
    query,
    wbs,
    calendar,
    status,
    critical,
    page,
    refresh,
    projection,
    projectVersion,
    requestKey,
  ]);
  useEffect(() => {
    if (
      !data ||
      loading ||
      error ||
      projection !== "working" ||
      loadedKey.current !== requestKey
    )
      return;
    try {
      sessionStorage.setItem(
        `fieldtrack:schedule-view:${projectId}`,
        JSON.stringify({
          mode: "working",
          projectId,
          sourceSha256: summary.sha256,
          projectVersion: data.projectVersion ?? projectVersion,
          query: { q: query, wbs, calendar, status, critical },
          page: data.page,
          display: { ...view, anchor: viewportDate },
        }),
      );
    } catch {
      /* Missing storage disables view/row commands rather than guessing. */
    }
  }, [
    data,
    loading,
    error,
    projection,
    requestKey,
    projectId,
    summary.sha256,
    projectVersion,
    query,
    wbs,
    calendar,
    status,
    critical,
    view,
    viewportDate,
  ]);
  useEffect(() => {
    function onCommand(event: Event) {
      const parsed = scheduleViewCommandSchema.safeParse(
        (event as CustomEvent<unknown>).detail,
      );
      if (!parsed.success) return;
      const message = parsed.data;
      function acknowledge(ok: boolean, error?: string) {
        if (message.requestId)
          window.dispatchEvent(
            new CustomEvent(scheduleViewCommandResultEvent, {
              detail: {
                requestId: message.requestId,
                projectId: message.projectId,
                ok,
                ...(error ? { error } : {}),
              },
            }),
          );
      }
      try {
        if (projection !== "working")
          throw Error("Open the working Schedule before changing its view.");
        if (error) throw Error("Reload the Schedule before changing its view.");
        if (loading || loadedKey.current !== requestKey)
          throw Error(
            "The Schedule is loading. Try the view command again when it is ready.",
          );
        const command = resolveScheduleViewCommand(message, {
          projectId,
          sourceSha256: summary.sha256,
          projectVersion: data?.projectVersion ?? projectVersion,
        });
        applyViewCommand(command);
        acknowledge(true);
      } catch (failure) {
        acknowledge(
          false,
          failure instanceof Error
            ? failure.message
            : "This view command could not be applied.",
        );
      }
    }
    window.addEventListener(scheduleViewCommandEvent, onCommand);
    return () =>
      window.removeEventListener(scheduleViewCommandEvent, onCommand);
    // View changes share the exact UI reducer and rebind to the latest viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    projection,
    loading,
    error,
    requestKey,
    projectId,
    summary.sha256,
    projectVersion,
    data?.projectVersion,
    view,
    viewportDate,
  ]);
  const visible = data?.activities ?? [];
  const activeFilters =
    [wbs, calendar, status].filter(Boolean).length + Number(critical !== "all");
  const scaleLabel = { day: "DAY", week: "WK", month: "MTH" }[scale];
  const columnLabel = {
    progress: "Steps %",
    start: "Start date",
    finish: "Finish date",
    wbs: "WBS",
    calendar: "Calendar",
  };
  const openDetail = useCallback(
    async (internalId: string, trigger: HTMLElement) => {
      detailRequest.current?.abort();
      const controller = new AbortController();
      detailRequest.current = controller;
      detailTrigger.current = trigger;
      setDetailLoading(true);
      try {
        const response = await fetch(
          `/api/projects/${projectId}/schedule-working?${new URLSearchParams({ internalId, view: projection })}`,
          { signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Could not load activity.");
        if (!controller.signal.aborted)
          setDetail((result as SourceProgrammePage).detail);
      } catch (failure) {
        if (!controller.signal.aborted)
          toast.error(
            failure instanceof Error
              ? failure.message
              : "Could not load activity.",
          );
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    },
    [projectId, projection, setDetailLoading, setDetail],
  );
  const linkedActivity = params.get("activity") ?? params.get("internalId");
  useEffect(() => {
    if (linkedActivity && handledActivity.current !== linkedActivity) {
      handledActivity.current = linkedActivity;
      void openDetail(
        linkedActivity,
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : document.body,
      );
    }
  }, [linkedActivity, openDetail]);
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2 sm:flex-wrap">
        <div
          className="flex min-w-0 flex-1 items-center gap-1 sm:flex-wrap sm:gap-2"
          aria-label="Schedule projection"
        >
          <Button
            variant={projection === "working" ? "default" : "outline"}
            aria-label="Working schedule"
            className="px-3 sm:px-4"
            aria-pressed={projection === "working"}
            onClick={() => {
              if (projection === "working") return;
              setProjection("working");
              setLoading(true);
              setData(null);
            }}
          >
            <span className="sm:hidden">Working</span>
            <span className="hidden sm:inline">Working schedule</span>
          </Button>
          <Button
            variant={projection === "source" ? "default" : "outline"}
            aria-label="Original source"
            className="px-3 sm:px-4"
            aria-pressed={projection === "source"}
            onClick={() => {
              if (projection === "source") return;
              setProjection("source");
              setLoading(true);
              setData(null);
              setEditor(null);
            }}
          >
            <span className="sm:hidden">Source</span>
            <span className="hidden sm:inline">Original source</span>
          </Button>
          <span
            className="hidden text-xs tabular-nums text-slate-600 sm:inline"
            aria-live="polite"
          >
            {loading
              ? "Loading…"
              : `${number(data?.total ?? 0)} matching activities`}
          </span>
          <InfoPopover label="About this source schedule">
            <p className="font-medium text-slate-950">{summary.projectName}</p>
            <p>
              Starting view:{" "}
              {defaultScope === "personal"
                ? "personal preference in this browser"
                : "shared project default"}
              ; {defaults.scale ?? "day"} calendar scale, duration{" "}
              {defaults.durationMode}. Changes here are temporary; Reset
              restores this starting view and Today.
            </p>
            <p>
              {loading
                ? "Loading…"
                : `${number(data?.total ?? 0)} matching activities`}
            </p>
            <p>
              {projection === "working"
                ? `Working revision ${data?.workingRevision ?? project?.commissioning?.workingSchedule?.revision ?? 0}. Working dates and links; original source retained.`
                : "Original imported dates and relationships; read only."}
            </p>
            <p>
              {number(data?.summary.activities ?? summary.activities)}{" "}
              activities ·{" "}
              {number(data?.summary.relationships ?? summary.relationships)}{" "}
              relationships · {number(summary.calendars)} calendars ·{" "}
              {number(summary.wbs)} WBS records.
            </p>
            <p>
              Dates are saved actual and remaining forecasts. No automatic P6
              recalculation. Days use each activity’s saved calendar hours per
              day; unavailable conversions stay in source hours.
            </p>
          </InfoPopover>
        </div>
        {projection === "working" && hasModule(app.currentUser, "tasks") && (
          <Button
            variant="outline"
            aria-label="Create an asset activity"
            className="size-11 px-2 sm:w-auto sm:px-4"
            onClick={() => setEditor({})}
          >
            <Plus className="size-4 sm:hidden" aria-hidden="true" />
            <span className="hidden sm:inline">Create an asset activity</span>
          </Button>
        )}
      </header>
      {editor && (
        <WorkingScheduleEditor
          key={`${projectId}-${editor.internalId ?? "new"}`}
          projectId={projectId}
          sourceSha256={summary.sha256}
          internalId={editor.internalId}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            await app.refreshData();
            setRefresh((value) => value + 1);
            setProjection("working");
            setEditor(null);
          }}
        />
      )}
      <section
        className="flex min-w-0 items-center gap-2 sm:flex-wrap"
        aria-label="Filter schedule"
      >
        <label htmlFor={`${id}-query`} className="sr-only">
          Activity ID or name
        </label>
        <Input
          id={`${id}-query`}
          className="min-h-11 min-w-0 flex-1 sm:min-w-40 sm:max-w-sm"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          placeholder="Find an activity by ID or name"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="size-11 px-2 sm:w-auto sm:px-3"
              aria-label={`Schedule filters${activeFilters ? `, ${activeFilters} active` : ""}`}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">
                Filters{activeFilters > 0 ? ` · ${activeFilters}` : ""}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            collisionPadding={16}
            className="w-80 max-w-[calc(100vw-2rem)] space-y-3 bg-white"
          >
            <label htmlFor={`${id}-wbs`} className="block text-sm font-medium">
              WBS ID or path
              <Input
                id={`${id}-wbs`}
                className="mt-1 min-h-11"
                value={wbs}
                onChange={(event) => {
                  setWbs(event.target.value);
                  setPage(0);
                }}
                placeholder="Search a work package"
              />
            </label>
            <label
              htmlFor={`${id}-calendar`}
              className="block text-sm font-medium"
            >
              Calendar
              <select
                id={`${id}-calendar`}
                className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-700"
                value={calendar}
                onChange={(event) => {
                  setCalendar(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">All calendars</option>
                {data?.filters.calendars.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name || item.id}
                  </option>
                ))}
              </select>
            </label>
            <label
              htmlFor={`${id}-status`}
              className="block text-sm font-medium"
            >
              Status
              <select
                id={`${id}-status`}
                className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-700"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">All statuses</option>
                {data?.filters.statuses.map((item) => (
                  <option key={item} value={item}>
                    {statusLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label
              htmlFor={`${id}-critical`}
              className="block text-sm font-medium"
            >
              Saved P6 criticality
              <select
                id={`${id}-critical`}
                className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-700"
                value={critical}
                onChange={(event) =>
                  applyViewCommand({
                    type: "critical",
                    filter: event.target
                      .value as SourceGanttViewState["critical"],
                  })
                }
              >
                <option value="all">All activities</option>
                <option value="yes">Critical in saved P6</option>
                <option value="no">Non-critical in saved P6</option>
                <option value="unknown">Unknown criticality</option>
              </select>
            </label>
          </PopoverContent>
        </Popover>
        <Button
          variant={critical === "yes" ? "default" : "outline"}
          className="hidden sm:inline-flex"
          aria-pressed={critical === "yes"}
          onClick={() =>
            applyViewCommand({
              type: "critical",
              filter: critical === "yes" ? "all" : "yes",
            })
          }
        >
          P6 critical
        </Button>
        <SourceCriticalityInfo
          metadata={loading ? undefined : data?.criticality}
          loading={loading}
        />
        {(query || activeFilters > 0) && (
          <Button
            variant="ghost"
            aria-label="Clear filters"
            className="size-11 px-2 sm:w-auto sm:px-4"
            onClick={() => {
              setQuery("");
              setWbs("");
              setCalendar("");
              setStatus("");
              applyViewCommand({ type: "critical", filter: "all" });
              setPage(0);
            }}
          >
            <X className="size-4 sm:hidden" aria-hidden="true" />
            <span className="hidden sm:inline">Clear filters</span>
          </Button>
        )}
      </section>
      {error && (
        <div role="alert" className="space-y-2 text-sm text-red-700">
          <p>{error}</p>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Try loading again
          </Button>
        </div>
      )}
      {!loading && data && !visible.length ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <p aria-live="polite">No activities match these filters.</p>
          {critical === "yes" &&
            Boolean(data.criticality?.coverage.unknown) && (
              <p>
                Saved P6 criticality is unknown for{" "}
                {number(data.criticality!.coverage.unknown)} activities in this
                schedule. Missing float is not treated as non-critical.
              </p>
            )}
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setQuery("");
              setWbs("");
              setCalendar("");
              setStatus("");
              applyViewCommand({ type: "critical", filter: "all" });
              setPage(0);
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <SourceProgrammeGantt
          data={loading ? null : data}
          anchor={anchor}
          scale={scale}
          horizon={horizon}
          today={projectDate()}
          columns={columns}
          onViewportDateChange={updateViewportDate}
          showLinks={showLinks}
          loading={loading}
          progress={data?.activityProgress}
          projectId={projectId}
          firstRowNumber={(data?.page ?? 0) * (data?.pageSize ?? 50) + 1}
          durationMode={durationMode}
          resetViewKey={timelineReset}
          onSelect={openDetail}
          onGoTo={(row) => {
            const value = sourcePageAnchor([row]);
            if (value) applyViewCommand({ type: "date", date: value });
          }}
          controls={
            <div className="grid w-full min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <div className="flex min-w-0 items-center gap-2 sm:contents">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    className="min-h-11 min-w-11 px-2"
                    onClick={() =>
                      applyViewCommand({ type: "pan", direction: -1 })
                    }
                    aria-label="Earlier timeline"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11 min-w-11 px-2"
                    onClick={() =>
                      applyViewCommand({ type: "pan", direction: 1 })
                    }
                    aria-label="Later timeline"
                  >
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    className="px-3 sm:px-4"
                    onClick={() => applyViewCommand({ type: "today" })}
                  >
                    Today
                  </Button>
                </div>
                <label htmlFor={`${id}-anchor`} className="sr-only">
                  Gantt go to date
                </label>
                <Input
                  id={`${id}-anchor`}
                  aria-label="Gantt go to date"
                  className="min-h-11 min-w-0 flex-1 sm:w-[148px] sm:flex-none"
                  type="date"
                  value={viewportDate}
                  onChange={(event) => {
                    if (event.target.value)
                      applyViewCommand({
                        type: "date",
                        date: event.target.value,
                      });
                  }}
                />
              </div>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_80px_44px_44px] items-center gap-2 sm:contents">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="min-w-0 gap-1 px-2 sm:gap-2 sm:px-3"
                      aria-label={`Calendar view: ${scaleLabel}${horizon ? ` · ${horizon / 7}WK` : ""}`}
                    >
                      <CalendarDays
                        className="hidden size-4 sm:block"
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        {scaleLabel}
                        {horizon ? ` · ${horizon / 7}WK` : ""}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    collisionPadding={16}
                    className="w-80 max-w-[calc(100vw-2rem)] space-y-3 bg-white"
                  >
                    <p className="text-sm font-medium">Calendar view</p>
                    <div
                      className="flex gap-1"
                      role="group"
                      aria-label="Gantt scale"
                    >
                      {(["day", "week", "month"] as const).map((value) => (
                        <Button
                          key={value}
                          variant={scale === value ? "default" : "outline"}
                          aria-pressed={scale === value}
                          onClick={() =>
                            applyViewCommand({ type: "scale", scale: value })
                          }
                        >
                          {{ day: "DAY", week: "WK", month: "MTH" }[value]}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs font-medium text-slate-600">
                      Date window
                    </p>
                    <div
                      className="flex flex-wrap gap-1"
                      role="group"
                      aria-label="Gantt date window"
                    >
                      {([null, 14, 28, 42] as const).map((value) => (
                        <Button
                          key={value ?? "auto"}
                          className="px-3"
                          variant={horizon === value ? "default" : "outline"}
                          aria-pressed={horizon === value}
                          onClick={() =>
                            applyViewCommand({
                              type: "horizon",
                              horizon: value,
                            })
                          }
                        >
                          {value ? `${value / 7}WK` : "Auto"}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs leading-5 text-slate-600">
                      Scale changes the ruler. The date window changes its span.
                      Activities and report lookahead filters stay unchanged.
                    </p>
                  </PopoverContent>
                </Popover>
                <label
                  htmlFor={`${id}-duration`}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="sr-only sm:not-sr-only">Duration</span>
                  <select
                    id={`${id}-duration`}
                    aria-label="Duration display"
                    value={durationMode}
                    onChange={(event) =>
                      applyViewCommand({
                        type: "duration",
                        mode: event.target.value as SourceDurationMode,
                      })
                    }
                    className="block min-h-11 w-20 rounded-md sm:w-24 border border-slate-300 bg-white px-1 text-xs! sm:px-2 sm:text-sm! focus-visible:outline-2 focus-visible:outline-blue-700"
                  >
                    <option value="days">Days</option>
                    <option value="hours">Hours</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      aria-label="Columns"
                      className="size-11 px-2 sm:w-auto sm:px-3"
                    >
                      <Columns3 className="size-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Columns</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    collisionPadding={16}
                    className="w-72 max-w-[calc(100vw-2rem)] space-y-2 bg-white"
                  >
                    <p className="text-sm font-medium">Visible columns</p>
                    <p className="text-xs text-slate-600">
                      Activity name and ID stay visible.
                    </p>
                    {sourceGanttColumns.map((column) => (
                      <label
                        key={column}
                        className="flex min-h-11 items-center gap-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={columns.includes(column)}
                          onChange={(event) =>
                            applyViewCommand({
                              type: "column",
                              column,
                              visible: event.target.checked,
                            })
                          }
                        />
                        {columnLabel[column]}
                      </label>
                    ))}
                    <label className="flex min-h-11 items-center gap-3 border-t text-sm">
                      <input
                        type="checkbox"
                        checked={showLinks}
                        onChange={(event) =>
                          applyViewCommand({
                            type: "links",
                            visible: event.target.checked,
                          })
                        }
                      />
                      Dependency links
                    </label>
                    <p className="text-xs text-slate-600">
                      Changes apply to this view. Reset restores the selected
                      starting view and Today.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => applyViewCommand({ type: "reset" })}
                    >
                      Reset view
                    </Button>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="ghost"
                  aria-label="Activity dates"
                  title="Show these activity dates"
                  className="size-11 px-2 sm:w-auto sm:px-4"
                  disabled={!visible.some((row) => row.start || row.finish)}
                  onClick={() => {
                    const date = sourcePageAnchor(visible);
                    if (date) applyViewCommand({ type: "date", date });
                  }}
                >
                  <CalendarClock
                    className="size-4 sm:hidden"
                    aria-hidden="true"
                  />
                  <span className="hidden sm:inline">Activity dates</span>
                </Button>
              </div>
            </div>
          }
        />
      )}
      <nav
        aria-label="Schedule pages"
        className="flex flex-wrap items-center justify-between gap-3 text-sm"
      >
        <p className="tabular-nums">
          {data?.total
            ? `${number(data.page * data.pageSize + 1)}–${number(Math.min((data.page + 1) * data.pageSize, data.total))} of ${number(data.total)}`
            : "0 activities"}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={loading || !data || data.page === 0}
            onClick={() => {
              setPage((value) => Math.max(0, value - 1));
            }}
          >
            Previous 50
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={
              loading || !data || (data.page + 1) * data.pageSize >= data.total
            }
            onClick={() => {
              setPage((value) => value + 1);
            }}
          >
            Next 50
          </Button>
        </div>
      </nav>
      <Dialog
        open={Boolean(detail) || detailLoading}
        onOpenChange={(open) => {
          if (!open) {
            detailRequest.current?.abort();
            setDetailLoading(false);
            setDetail(undefined);
          }
        }}
      >
        <DialogContent
          ref={detailContent}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl"
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            detailContent.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            detailTrigger.current?.focus({ preventScroll: true });
          }}
        >
          <DialogTitle className="pr-8">Source activity details</DialogTitle>
          {detailLoading ? (
            <p role="status">Loading activity…</p>
          ) : (
            detail && (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">
                      {detail.activity.activityId} · {detail.activity.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Source TASK line {detail.sourceLine}. Dates and raw values
                      are retained as exported.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      setDetail(undefined);
                      setDetailLoading(false);
                    }}
                  >
                    Close details
                  </Button>
                </div>
                <p className="text-sm text-slate-600">
                  {statusLabel(detail.activity.status)} ·{" "}
                  {detail.activity.durationDays !== undefined
                    ? `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(detail.activity.durationDays)} days (${detail.activity.calendarHoursPerDay} hours/day) · `
                    : ""}
                  {detail.activity.durationHours || "No recorded duration"}
                  {detail.activity.durationHours ? " source hours" : ""} ·{" "}
                  {detail.activity.calendarName}
                </p>
                <p className="text-sm text-slate-600 break-words">
                  {detail.activity.wbsPath}
                </p>
                <p className="text-sm text-slate-600">
                  {sourceCriticalityLabel(detail.activity.criticality)}
                </p>
                {projection === "working" && (
                  <Button
                    onClick={() => {
                      setEditor({ internalId: detail.activity.internalId });
                      setDetail(undefined);
                      setDetailLoading(false);
                    }}
                  >
                    Edit working dates and links
                  </Button>
                )}
                <details>
                  <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">
                    All source activity fields
                  </summary>
                  <dl className="grid max-h-96 gap-x-5 gap-y-2 overflow-auto sm:grid-cols-[max-content_1fr] text-sm">
                    {Object.entries(detail.fields).map(([field, value]) => (
                      <div key={field} className="contents">
                        <dt className="font-medium break-all">{field}</dt>
                        <dd className="break-all whitespace-pre-wrap text-slate-700">
                          {value || "Not recorded"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
                <h4 className="text-sm font-medium">
                  Predecessors and successors (
                  {number(detail.relationships.length)})
                </h4>
                <p className="text-xs text-slate-600">
                  Lag values are source hours. Unknown relationship codes and
                  repeated pairs remain unchanged.
                </p>
                <div className="max-h-96 overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-2">Predecessor</th>
                        <th className="p-2">Successor</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Lag hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.relationships.map((link) => (
                        <tr
                          key={link.sourceLine}
                          className="border-t border-slate-200"
                        >
                          <td className="p-2">{link.predecessorActivityId}</td>
                          <td className="p-2">{link.successorActivityId}</td>
                          <td className="p-2">{link.type}</td>
                          <td className="p-2 tabular-nums">
                            {link.lagHours || "Not recorded"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
      <details className="border-t border-slate-200 pt-3 text-sm text-slate-600">
        <summary className="min-h-11 cursor-pointer content-center font-medium">
          Schedule source
        </summary>
        <p className="mt-2">{summary.fileName}</p>
        <p className="mt-2 break-all font-mono text-xs">
          SHA256 {summary.sha256}
        </p>
        <p className="mt-3 max-w-3xl leading-relaxed">
          All source tables, including WBS, calendars, resource assignments and
          original date fields, are retained. Planned dates are not presented as
          an approved baseline; no conversion to a universal eight-hour working
          day is applied.
        </p>
      </details>
    </div>
  );
}
