"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  type SourceProgrammePage,
  type SourceProgrammeSummary,
} from "@/lib/programme-source";
import { parseP6Xer } from "@/lib/p6-xer";
import { ganttAxis, type GanttScale } from "@/lib/gantt-axis";
import { dayNumber } from "@/lib/scheduling";
import { projectDate } from "@/lib/domain";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SourceProgrammeGantt } from "./SourceProgrammeGantt";
import { sourcePageAnchor } from "@/lib/source-gantt";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { InfoPopover } from "./InfoPopover";

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
  version,
  onImported,
}: {
  projectId: string;
  version: number;
  onImported?: () => Promise<void>;
}) {
  const id = useId();
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
    <details className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-slate-800">
        Import Primavera XER schedule
      </summary>
      <div className="mt-4 space-y-4 max-w-2xl">
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
            <p className="font-medium">{preview.summary.projectName}</p>
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

export function SourceProgrammeWorkspace({
  projectId,
  summary,
}: {
  projectId: string;
  summary: SourceProgrammeSummary;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [wbs, setWbs] = useState("");
  const [calendar, setCalendar] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [scale, setScale] = useState<GanttScale>("day");
  const [manualAnchor, setAnchor] = useState<string | null>(null);
  const [showLinks, setShowLinks] = useState(true);
  const [timelineReset, setTimelineReset] = useState(0);
  const [durationMode, setDurationMode] = useState<"days" | "hours" | "hidden">(
    "days",
  );
  const detailTrigger = useRef<HTMLElement | null>(null);
  const detailContent = useRef<HTMLDivElement | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  useEffect(() => () => detailRequest.current?.abort(), []);
  const [data, setData] = useState<SourceProgrammePage | null>(null);
  const [detail, setDetail] = useState<SourceProgrammePage["detail"]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setLoading(true);
        setError("");
        const params = new URLSearchParams({
          q: query,
          wbs,
          calendar,
          status,
          page: String(page),
        });
        try {
          const response = await fetch(
            `/api/projects/${projectId}/programme-source?${params}`,
            { signal: controller.signal },
          );
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.error || "Could not load schedule.");
          setData(result);
        } catch (failure) {
          if (!controller.signal.aborted)
            setError(
              failure instanceof Error
                ? failure.message
                : "Could not load schedule.",
            );
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
  }, [projectId, summary.sha256, query, wbs, calendar, status, page, refresh]);
  const anchor =
    manualAnchor ?? sourcePageAnchor(data?.activities ?? []) ?? projectDate();
  const axis = ganttAxis(anchor, scale);
  const firstDay = dayNumber(anchor);
  const visible = data?.activities ?? [];
  function shift(direction: number) {
    setAnchor(
      new Date((firstDay + direction * axis.span) * 86400000)
        .toISOString()
        .slice(0, 10),
    );
  }
  async function openDetail(internalId: string, trigger: HTMLElement) {
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    detailTrigger.current = trigger;
    setDetailLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/programme-source?${new URLSearchParams({ internalId })}`,
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
  }
  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">
            {summary.projectName}
          </h2>
          <InfoPopover label="About this source schedule">
            <p>
              Dates are the saved P6 actual and remaining forecast. Relationship
              types, lag hours and calendar definitions are retained. This view
              does not recalculate the source schedule.
            </p>
            <p>
              Days use each activity’s saved calendar hours per day. If that
              value is unavailable, the original duration stays in hours. Dates
              and source hours are unchanged.
            </p>
          </InfoPopover>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4 sm:max-w-3xl">
          {[
            ["Activities", summary.activities],
            ["Relationships", summary.relationships],
            ["Calendars", summary.calendars],
            ["WBS records", summary.wbs],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-2 border-b border-slate-200 pb-2"
            >
              <dt className="text-xs text-slate-600">{label}</dt>
              <dd className="text-base font-semibold tabular-nums text-slate-950">
                {number(Number(value))}
              </dd>
            </div>
          ))}
        </dl>
      </header>
      <section
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Filter schedule"
      >
        <label
          htmlFor={`${id}-query`}
          className="space-y-2 text-sm font-medium"
        >
          Activity ID or name
          <Input
            id={`${id}-query`}
            className="min-h-11"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
              setAnchor(null);
            }}
            placeholder="Find an activity"
          />
        </label>
        <label htmlFor={`${id}-wbs`} className="space-y-2 text-sm font-medium">
          WBS ID or path
          <Input
            id={`${id}-wbs`}
            className="min-h-11"
            value={wbs}
            onChange={(event) => {
              setWbs(event.target.value);
              setPage(0);
              setAnchor(null);
            }}
            placeholder="Search a work package"
          />
        </label>
        <label
          htmlFor={`${id}-calendar`}
          className="space-y-2 text-sm font-medium"
        >
          Calendar
          <select
            id={`${id}-calendar`}
            className="block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-700"
            value={calendar}
            onChange={(event) => {
              setCalendar(event.target.value);
              setPage(0);
              setAnchor(null);
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
          className="space-y-2 text-sm font-medium"
        >
          Status
          <select
            id={`${id}-status`}
            className="block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-700"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
              setAnchor(null);
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
      {data && !visible.length ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <p aria-live="polite">No activities match these filters.</p>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setQuery("");
              setWbs("");
              setCalendar("");
              setStatus("");
              setPage(0);
              setAnchor(null);
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <SourceProgrammeGantt
          data={data}
          anchor={anchor}
          scale={scale}
          showLinks={showLinks}
          loading={loading}
          durationMode={durationMode}
          onDurationModeChange={setDurationMode}
          resetViewKey={timelineReset}
          onSelect={openDetail}
          onGoTo={(row) => {
            const value = sourcePageAnchor([row]);
            if (value) setAnchor(value);
          }}
          controls={
            <div className="flex flex-wrap items-end gap-3">
              <label htmlFor={`${id}-anchor`} className="text-sm">
                Go to date
                <Input
                  id={`${id}-anchor`}
                  aria-label="Gantt go to date"
                  className="min-h-11"
                  type="date"
                  value={anchor}
                  onChange={(event) => {
                    if (event.target.value) setAnchor(event.target.value);
                  }}
                />
              </label>
              <label htmlFor={`${id}-scale`} className="text-sm">
                Scale
                <select
                  id={`${id}-scale`}
                  aria-label="Gantt scale"
                  className="block min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-700"
                  value={scale}
                  onChange={(event) =>
                    setScale(event.target.value as GanttScale)
                  }
                >
                  <option value="day">Days</option>
                  <option value="week">Weeks</option>
                  <option value="month">Months</option>
                </select>
              </label>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => shift(-1)}
                aria-label="Earlier timeline"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => shift(1)}
                aria-label="Later timeline"
              >
                <ArrowRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={!visible.some((row) => row.start || row.finish)}
                onClick={() => {
                  setAnchor(null);
                  setTimelineReset((value) => value + 1);
                }}
              >
                Show these activity dates
              </Button>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showLinks}
                  onChange={(e) => setShowLinks(e.target.checked)}
                />
                Show dependency links
              </label>
              <InfoPopover label="About timeline navigation and links">
                <p>
                  Show these activity dates centres the timeline on the most
                  common saved date among the activities loaded on this page.
                  Use a row’s calendar button to locate an individual activity.
                </p>
                <p>
                  Dependency links are arrows between saved predecessor and
                  successor dates. Showing or hiding them changes the display
                  only; it does not change the schedule.
                </p>
              </InfoPopover>
              <span
                className="flex min-h-11 items-center text-xs tabular-nums text-slate-600"
                aria-live="polite"
              >
                {loading
                  ? "Loading schedule…"
                  : `${number(data?.total ?? 0)} matching activities`}
              </span>
              <label htmlFor={`${id}-duration`} className="text-sm">
                Duration
                <select
                  id={`${id}-duration`}
                  aria-label="Duration display"
                  value={durationMode}
                  onChange={(event) =>
                    setDurationMode(event.target.value as typeof durationMode)
                  }
                  className="block min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-700"
                >
                  <option value="days">Days</option>
                  <option value="hours">Hours</option>
                  <option value="hidden">Hidden</option>
                </select>
              </label>
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
              setAnchor(null);
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
              setAnchor(null);
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
