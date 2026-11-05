"use client";

import { useEffect, useId, useState } from "react";
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
        reason: reason.trim() || "Preview source-only programme restoration",
        sha256: sourceSha256,
        preview: String(preview),
      });
      const response = await fetch(
        `/api/projects/${projectId}/programme-source?${params}`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Programme restoration failed.");
      if (preview) setPreviewVersion(version);
      else {
        setPreviewVersion(null);
        await onRestored();
        toast.success(
          "Source-only programme load removed; project history retained",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Programme restoration failed",
      );
      setPreviewVersion(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">
        Restore a source-only programme load
      </summary>
      <div className="mt-4 max-w-prose space-y-3">
        <p className="text-sm text-slate-600">
          Only for a project with no other assets, tasks or managed programme.
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
              The source programme will be removed. No project or audit records
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
      reason: reason.trim() || "Preview P6 source programme without saving",
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
      throw new Error(result.error || "Programme import failed.");
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
        const programme = await parseP6Xer(fileBytes, file.name);
        const compressed = new Blob([JSON.stringify(programme)])
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
      toast.success("P6 source programme saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Programme was not saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-slate-800">
        Import Primavera XER programme
      </summary>
      <div className="mt-4 space-y-4 max-w-2xl">
        <p className="text-sm leading-relaxed text-slate-600">
          Keep the complete exported programme and its saved dates, calendars
          and relationships. This does not convert its logic into the app’s
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
          {busy ? "Reading programme…" : "Preview programme"}
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
              The source programme will be saved for this project. Existing
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
              placeholder="Describe the programme revision or test purpose"
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
              Save source programme
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
  const [scale, setScale] = useState<GanttScale>("month");
  const [anchor, setAnchor] = useState(projectDate());
  const [data, setData] = useState<SourceProgrammePage | null>(null);
  const [detail, setDetail] = useState<SourceProgrammePage["detail"]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
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
          throw new Error(result.error || "Could not load programme.");
        setData(result);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not load programme.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [projectId, summary.sha256, query, wbs, calendar, status, page, refresh]);
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
  async function openDetail(internalId: string) {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/programme-source?${new URLSearchParams({ internalId })}`,
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not load activity.");
      setDetail((result as SourceProgrammePage).detail);
    } catch (failure) {
      toast.error(
        failure instanceof Error ? failure.message : "Could not load activity.",
      );
    }
  }
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          {summary.projectName}
        </h2>
        <p className="text-sm text-slate-700 tabular-nums">
          {number(summary.activities)} activities ·{" "}
          {number(summary.relationships)} relationships ·{" "}
          {number(summary.calendars)} calendars · {number(summary.wbs)} WBS
          records
        </p>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          Dates are the saved P6 actual and remaining forecast. Relationship
          types, lag hours and calendar definitions are retained. This view does
          not recalculate the source programme.
        </p>
      </header>
      <section
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Filter programme"
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
      <div className="flex flex-wrap items-end gap-3">
        <label
          htmlFor={`${id}-anchor`}
          className="space-y-2 text-sm font-medium"
        >
          Timeline start
          <Input
            id={`${id}-anchor`}
            className="min-h-11"
            type="date"
            value={anchor}
            onChange={(event) => {
              if (event.target.value) setAnchor(event.target.value);
            }}
          />
        </label>
        <label
          htmlFor={`${id}-scale`}
          className="space-y-2 text-sm font-medium"
        >
          Scale
          <select
            id={`${id}-scale`}
            className="block min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-700"
            value={scale}
            onChange={(event) => setScale(event.target.value as GanttScale)}
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
          disabled={!visible.some((row) => row.start)}
          onClick={() => {
            const starts = visible
              .flatMap((row) => (row.start ? [row.start] : []))
              .sort();
            if (starts[0]) setAnchor(starts[0]);
          }}
        >
          Go to page dates
        </Button>
      </div>
      <p className="text-sm text-slate-600 tabular-nums" aria-live="polite">
        {loading
          ? "Loading programme…"
          : `${number(data?.total ?? 0)} matching activities`}
      </p>
      {data && !visible.length ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No activities match these filters. Clear the search or choose another
          calendar or status.
        </p>
      ) : (
        <div
          className="overflow-x-auto rounded-xl border border-slate-200 bg-white"
          aria-busy={loading}
          tabIndex={0}
          aria-label="Programme timeline, scroll horizontally for dates"
        >
          <table
            className="w-full border-collapse text-sm"
            style={{ minWidth: axis.width + 660 }}
          >
            <thead className="bg-slate-50 text-left text-slate-700">
              <tr>
                <th scope="col" className="w-80 px-4 py-3">
                  Activity
                </th>
                <th scope="col" className="w-44 px-4 py-3">
                  Saved dates
                </th>
                <th scope="col" className="w-40 px-4 py-3">
                  Status / duration
                </th>
                <th scope="col" className="relative p-0">
                  <div className="relative h-12" style={{ width: axis.width }}>
                    {axis.columns.map((column) => (
                      <span
                        key={column.date}
                        className="absolute top-4 text-xs tabular-nums"
                        style={{ left: column.left + 4 }}
                      >
                        {column.label}
                      </span>
                    ))}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const start = row.start
                  ? dayNumber(row.start) - firstDay
                  : null;
                const finish = row.finish
                  ? dayNumber(row.finish) - firstDay
                  : start;
                const left =
                  start === null ? 0 : Math.max(0, start) * axis.unit;
                const right =
                  finish === null
                    ? 0
                    : Math.min(axis.span, finish + 1) * axis.unit;
                const inWindow =
                  start !== null &&
                  finish !== null &&
                  start < axis.span &&
                  finish >= 0 &&
                  finish >= start;
                return (
                  <tr
                    key={row.internalId}
                    className="border-t border-slate-200 align-top hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <button
                        className="min-h-11 text-left text-blue-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-blue-700"
                        onClick={() => openDetail(row.internalId)}
                      >
                        <span className="block font-medium">
                          {row.activityId}
                          {row.milestone ? " · Milestone" : ""}
                        </span>
                        <span className="block text-slate-800 no-underline">
                          {row.name}
                        </span>
                      </button>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {row.wbsPath}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      <p>{row.start || "Start not recorded"}</p>
                      <p>{row.finish || "Finish not recorded"}</p>
                      <p className="mt-2 text-slate-600">{row.calendarName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{statusLabel(row.status)}</p>
                      <p className="mt-1 text-xs text-slate-600 tabular-nums">
                        {row.durationHours === ""
                          ? "Duration not recorded"
                          : `${row.durationHours} source hours`}
                      </p>
                      <p className="mt-1 text-xs text-slate-600 tabular-nums">
                        {row.predecessorCount} predecessors ·{" "}
                        {row.successorCount} successors
                      </p>
                    </td>
                    <td className="relative p-0">
                      <div
                        className="relative min-h-24 overflow-hidden"
                        style={{ width: axis.width }}
                      >
                        {axis.columns.map((column) => (
                          <span
                            key={column.date}
                            className="absolute inset-y-0 border-l border-slate-100"
                            style={{ left: column.left }}
                          />
                        ))}
                        {inWindow && (
                          <span
                            className={`absolute top-8 h-4 ${row.milestone ? "rotate-45 bg-slate-800" : "rounded-sm bg-blue-700"}`}
                            style={{
                              left,
                              width: row.milestone
                                ? 12
                                : Math.max(2, right - left),
                            }}
                            title={`${row.activityId}: ${row.start} to ${row.finish}`}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <nav
        aria-label="Programme pages"
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
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            Previous 50
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={
              loading || !data || (data.page + 1) * data.pageSize >= data.total
            }
            onClick={() => setPage((value) => value + 1)}
          >
            Next 50
          </Button>
        </div>
      </nav>
      {detail && (
        <section
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
          aria-label="Source activity details"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">
                {detail.activity.activityId} · {detail.activity.name}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Source TASK line {detail.sourceLine}. Dates and raw values are
                retained as exported.
              </p>
            </div>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setDetail(undefined)}
            >
              Close details
            </Button>
          </div>
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
            Predecessors and successors ({number(detail.relationships.length)})
          </h4>
          <p className="text-xs text-slate-600">
            Lag values are source hours. Unknown relationship codes and repeated
            pairs remain unchanged.
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
        </section>
      )}
      <details className="border-t border-slate-200 pt-3 text-sm text-slate-600">
        <summary className="min-h-11 cursor-pointer content-center font-medium">
          Programme source
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
