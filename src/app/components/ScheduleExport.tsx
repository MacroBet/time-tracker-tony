"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "./ui/button";

type ScheduleExportView = "working" | "source";
type ScheduleExportProps = {
  projectId: string;
  version: number;
  hasSource: boolean;
};

export function ScheduleExport(props: ScheduleExportProps) {
  return (
    <ScheduleExportSession
      key={`${props.projectId}:${props.version}`}
      {...props}
    />
  );
}

function ScheduleExportSession({
  projectId,
  version,
  hasSource,
}: ScheduleExportProps) {
  const request = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState<ScheduleExportView | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => () => request.current?.abort(), []);

  async function download(view: ScheduleExportView) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(view);
    setMessage("");
    setError("");
    try {
      const query = new URLSearchParams({
        format: "csv",
        version: String(version),
        view,
      });
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/schedule-working?${query}`,
        {
          cache: "no-store",
          signal: controller.signal,
        },
      );
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("text/csv")
      ) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.error ??
            "The Schedule export could not be prepared. Try again.",
        );
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const suffix = view === "source" ? "original-source" : "working-schedule";
      link.href = url;
      link.download = `fieldtrack-${projectId.replace(/[^a-zA-Z0-9_-]/g, "_")}-${suffix}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const total = response.headers.get("X-Schedule-Total");
      setMessage(
        total === null
          ? "CSV ready."
          : `CSV ready with ${Number(total).toLocaleString("en-GB")} activities.`,
      );
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "The Schedule export failed. Try again.",
        );
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusy(null);
    }
  }

  function cancel() {
    request.current?.abort();
    request.current = null;
    setBusy(null);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Download all activities in the selected schedule as CSV.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy !== null}
          onClick={() => void download("working")}
        >
          <Download aria-hidden="true" />
          {busy === "working" ? "Preparing CSV…" : "Working schedule CSV"}
        </Button>
        {hasSource && (
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() => void download("source")}
          >
            <Download aria-hidden="true" />
            {busy === "source" ? "Preparing CSV…" : "Original source CSV"}
          </Button>
        )}
        {busy && (
          <Button type="button" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-slate-700">
          {message}
        </p>
      )}
    </div>
  );
}
