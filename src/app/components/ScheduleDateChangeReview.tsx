"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { SourceActivityView } from "@/lib/programme-source";
import { commissioning } from "@/lib/commissioning";
import { formatScheduleDate } from "@/lib/schedule-date";
import {
  canConfirmWorkingSchedule,
  workingScheduleDraftSchema,
} from "@/lib/schedule-working";
import type { WorkingScheduleProposal } from "@/server/schedule-working";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Props = {
  projectId: string;
  sourceSha256: string;
  version: number;
  activity: SourceActivityView;
  dates: { start?: string; finish?: string };
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
};
type Prepared = {
  proposal: WorkingScheduleProposal;
  token: string;
  expiresAt: string;
  canConfirm: boolean;
  projectVersion: number;
};

/** A new drag must never inherit a previous proposal's proof or idempotency key. */
export function ScheduleDateChangeReview(props: Props) {
  const { projectId, sourceSha256, version, activity, dates } = props;
  return (
    <DateChangeReview
      key={JSON.stringify([
        projectId,
        sourceSha256,
        version,
        activity.internalId,
        activity.start,
        activity.finish,
        dates.start,
        dates.finish,
      ])}
      {...props}
    />
  );
}

function DateChangeReview({
  projectId,
  sourceSha256,
  version,
  activity,
  dates,
  onCancel,
  onSaved,
}: Props) {
  const app = useApp();
  const project = app.projects.find((item) => item.id === projectId);
  const stale = !project || commissioning(project).version !== version;
  const actualDates = activity.status === "TK_Complete";
  const unchanged =
    activity.start === dates.start && activity.finish === dates.finish;
  const reasonId = useId();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState("");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const canReview =
    !busy &&
    !saved &&
    !stale &&
    !actualDates &&
    !unchanged &&
    app.isOnline &&
    reason.trim().length >= 10;

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReview || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setPrepared(null);
    setError("");
    try {
      if (
        (activity.start && !dates.start) ||
        (activity.finish && !dates.finish)
      )
        throw new Error(
          "A saved date cannot be cleared by dragging. Cancel and review the activity's saved dates.",
        );
      const parsed = workingScheduleDraftSchema.safeParse({
        kind: "edit-activity",
        sourceSha256,
        idempotencyKey,
        reason: reason.trim(),
        internalId: activity.internalId,
        ...(dates.start && dates.start !== activity.start
          ? { start: dates.start }
          : {}),
        ...(dates.finish && dates.finish !== activity.finish
          ? { finish: dates.finish }
          : {}),
      });
      if (!parsed.success)
        throw new Error(
          "The proposed dates or reason are invalid. Cancel and drag the activity again.",
        );
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/schedule-working`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft: parsed.data }),
        },
      );
      const value = await response.json();
      if (!response.ok)
        throw new Error(value.error ?? "Could not review this date change.");
      if (value.projectVersion !== version)
        throw new Error(
          "The schedule changed after this drag. Cancel, refresh the schedule and drag the latest dates again. Nothing has been saved.",
        );
      setPrepared(value);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not review this date change. Try again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function refreshSaved() {
    await app.refreshData();
    await onSaved();
  }

  async function confirm() {
    if (
      !prepared ||
      !prepared.canConfirm ||
      prepared.proposal.errors.length > 0 ||
      busy ||
      inFlight.current ||
      saved ||
      stale ||
      !app.isOnline
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/schedule-working`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: prepared.token, confirmed: true }),
        },
      );
      const value = await response.json();
      if (!response.ok)
        throw new Error(value.error ?? "Could not confirm this date change.");
      setSaved(true);
      setPrepared(null);
      toast.success(
        value.replay
          ? "This date change was already saved"
          : "Schedule dates saved",
      );
      try {
        await refreshSaved();
      } catch {
        setError(
          "The date change was saved, but the view could not refresh. Refresh the saved dates when connected.",
        );
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not confirm this date change. Nothing else was changed.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Review dragged dates"
      className="min-w-0 space-y-3 border-t border-slate-200 bg-white p-4"
      aria-busy={busy}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">
            {saved ? "Date change saved" : "Review date change"}
          </h3>
          <p className="mt-1 break-words text-sm text-slate-600">
            {activity.activityId} · {activity.name}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          disabled={busy}
          onClick={onCancel}
        >
          {saved ? "Close" : "Cancel date change"}
        </Button>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {(["start", "finish"] as const).map((field) => (
          <div
            key={field}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
          >
            <dt className="w-10 font-medium">
              {field === "start" ? "Start" : "Finish"}
            </dt>
            <dd className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
              <span className="text-slate-600">
                {formatScheduleDate(activity[field])}
              </span>
              <span className="text-xs text-slate-600">to</span>
              <strong>{formatScheduleDate(dates[field])}</strong>
            </dd>
          </div>
        ))}
      </dl>
      {!saved && (
        <p className="max-w-prose text-xs leading-5 text-slate-600">
          These dates are a proposal until confirmed. Source dates, baselines
          and actuals stay intact; downstream dates are not recalculated
          automatically.
        </p>
      )}
      {stale && !saved && (
        <p role="alert" className="text-sm text-red-700">
          The schedule has changed. Cancel, refresh and drag the latest dates
          again. This proposal has not been saved.
        </p>
      )}
      {actualDates && !saved && (
        <p role="alert" className="text-sm text-amber-950">
          Completed activities retain their recorded actual dates. Cancel this
          proposal and open the activity to review its history.
        </p>
      )}
      {unchanged && !saved && (
        <p role="status" className="text-sm text-slate-600">
          The proposed dates match the saved dates. There is no change to save.
        </p>
      )}
      {!app.isOnline && (
        <p role="status" className="text-sm text-amber-950">
          You are offline. Reconnect to review or confirm the date change.
        </p>
      )}
      {error && (
        <p role="alert" className="break-words text-sm text-red-700">
          {error}
        </p>
      )}
      {!saved && !actualDates && !unchanged && (
        <form onSubmit={review} className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-60">
            <label htmlFor={reasonId} className="block text-sm font-medium">
              Reason for this change
            </label>
            <Input
              id={reasonId}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setPrepared(null);
                setError("");
              }}
              className="mt-1 min-h-11"
              minLength={10}
              maxLength={1000}
              required
              disabled={busy || stale}
              placeholder="Why are these dates changing?"
              aria-describedby={`${reasonId}-help`}
            />
            <p id={`${reasonId}-help`} className="mt-1 text-xs text-slate-600">
              At least 10 characters. Saved with your name in project history.
            </p>
          </div>
          <Button
            type="submit"
            className="min-h-11"
            variant={prepared ? "outline" : "default"}
            disabled={!canReview}
          >
            {busy ? "Working…" : "Review date change"}
          </Button>
        </form>
      )}
      {prepared && !saved && (
        <div className="space-y-3 border-t border-slate-200 pt-3">
          {prepared.proposal.changes.length > 0 && (
            <ul className="max-h-32 list-disc space-y-1 overflow-y-auto pl-5 text-sm">
              {prepared.proposal.changes.map((change, index) => (
                <li key={index} className="break-words">
                  {change}
                </li>
              ))}
            </ul>
          )}
          {prepared.proposal.errors.length > 0 && (
            <ul
              role="alert"
              className="list-disc space-y-1 pl-5 text-sm text-red-700"
            >
              {prepared.proposal.errors.map((problem, index) => (
                <li key={index} className="break-words">
                  {problem}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs leading-5 text-slate-600">
            {prepared.proposal.impactedCount} activities in dependency scope.
            {prepared.proposal.impactRowsShown <
              prepared.proposal.impactedCount &&
              ` ${prepared.proposal.impactRowsShown} are included in this preview.`}{" "}
            Only the explicit dates in this proposal change.
          </p>
          {!canConfirmWorkingSchedule(app.currentUser.role) && (
            <p className="text-sm text-slate-600">
              Your role can review this proposal. An administrator or manager
              must prepare and confirm their own proposal to save dates.
            </p>
          )}
          <Button
            type="button"
            className="min-h-11"
            disabled={
              busy ||
              stale ||
              !app.isOnline ||
              !prepared.canConfirm ||
              prepared.proposal.errors.length > 0
            }
            onClick={() => void confirm()}
          >
            {busy ? "Saving…" : "Confirm date change"}
          </Button>
        </div>
      )}
      {saved && (
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={busy || !app.isOnline}
          onClick={async () => {
            if (inFlight.current) return;
            inFlight.current = true;
            setBusy(true);
            setError("");
            try {
              await refreshSaved();
            } catch {
              setError(
                "Could not refresh the saved dates. Reconnect and try again.",
              );
            } finally {
              inFlight.current = false;
              setBusy(false);
            }
          }}
        >
          Refresh saved dates
        </Button>
      )}
    </section>
  );
}
