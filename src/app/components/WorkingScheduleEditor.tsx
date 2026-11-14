"use client";
import { useEffect, useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type {
  SourceProgrammePage,
  SourceActivityView,
} from "@/lib/programme-source";
import {
  workingScheduleDraftSchema,
  type WorkingScheduleDraft,
} from "@/lib/schedule-working";
import type { WorkingScheduleProposal } from "@/server/schedule-working";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { InfoPopover } from "./InfoPopover";

type AddedLink = {
  direction: "predecessor" | "successor";
  otherId: string;
  type: "PR_FS" | "PR_SS" | "PR_FF" | "PR_SF";
  lagHours: number;
};
type Prepared = {
  proposal: WorkingScheduleProposal;
  token: string;
  expiresAt: string;
  canConfirm: boolean;
  projectVersion: number;
};
export function WorkingScheduleEditor({
  projectId,
  sourceSha256,
  internalId,
  initialDraft,
  onSaved,
  onClose,
}: {
  projectId: string;
  sourceSha256: string;
  internalId?: string;
  initialDraft?: WorkingScheduleDraft;
  onSaved: () => void | Promise<void>;
  onClose?: () => void;
}) {
  const { projects, isOnline } = useApp();
  const project = projects.find((p) => p.id === projectId);
  const targetId =
    initialDraft?.kind === "edit-activity"
      ? initialDraft.internalId
      : internalId;
  const create = !targetId;
  const id = useId();
  const [requestId] = useState(
    () => initialDraft?.idempotencyKey ?? crypto.randomUUID(),
  );
  const [detail, setDetail] = useState<SourceProgrammePage["detail"]>();
  const [initialAssetIds] = useState(() => [
    ...(initialDraft?.kind === "edit-activity" &&
    initialDraft.assetIds !== undefined
      ? initialDraft.assetIds
      : (project?.commissioning?.workingSchedule?.activityPatches.find(
          (patch) => patch.internalId === targetId,
        )?.assetIds ?? [])),
  ]);
  const [linkedAssetIds, setLinkedAssetIds] = useState(initialAssetIds);
  const [assetQuery, setAssetQuery] = useState("");
  const [start, setStart] = useState(initialDraft?.start ?? ""),
    [finish, setFinish] = useState(
      initialDraft?.kind === "edit-activity"
        ? (initialDraft.finish ?? "")
        : (initialDraft?.deadline ?? ""),
    );
  const [assetId, setAssetId] = useState(
      initialDraft?.kind === "create-asset-activity"
        ? initialDraft.assetId
        : "",
    ),
    [title, setTitle] = useState(
      initialDraft?.kind === "create-asset-activity" ? initialDraft.title : "",
    ),
    [description, setDescription] = useState(
      initialDraft?.kind === "create-asset-activity"
        ? (initialDraft.description ?? "")
        : "",
    ),
    [reason, setReason] = useState(initialDraft?.reason ?? "");
  const [removed, setRemoved] = useState<number[]>(
    initialDraft?.kind === "edit-activity"
      ? (initialDraft.removeLinkIds ?? [])
      : [],
  );
  const [links, setLinks] = useState<AddedLink[]>(
    initialDraft?.kind === "edit-activity"
      ? (initialDraft.addLinks ?? []).map((link) => ({
          direction:
            link.successorId === targetId ? "predecessor" : "successor",
          otherId:
            link.successorId === targetId
              ? link.predecessorId
              : link.successorId,
          type: link.type,
          lagHours: link.lagHours,
        }))
      : [],
  );
  const [prepared, setPrepared] = useState<Prepared | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(!!targetId),
    [error, setError] = useState("");
  useEffect(() => {
    if (!targetId) return;
    const controller = new AbortController();
    void fetch(
      `/api/projects/${projectId}/schedule-working?${new URLSearchParams({ internalId: targetId })}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok)
          throw new Error(value.error ?? "Could not load activity.");
        if (!value.detail)
          throw new Error(
            "This activity is no longer in the current schedule.",
          );
        setDetail(value.detail);
        setStart(initialDraft?.start ?? value.detail.activity.start ?? "");
        setFinish(
          initialDraft?.kind === "edit-activity"
            ? (initialDraft.finish ?? value.detail.activity.finish ?? "")
            : (value.detail.activity.finish ?? ""),
        );
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not load activity.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [targetId, projectId, initialDraft]);
  const invalidate = () => {
    setPrepared(null);
    setError("");
  };
  async function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !isOnline) return;
    setBusy(true);
    setError("");
    setPrepared(null);
    try {
      if (
        !create &&
        ((detail?.activity.start && !start) ||
          (detail?.activity.finish && !finish))
      )
        throw new Error(
          "A saved date cannot be cleared here. Enter an explicit forecast date or leave its saved value unchanged.",
        );
      const base = { sourceSha256, idempotencyKey: requestId, reason };
      const draft: WorkingScheduleDraft = workingScheduleDraftSchema.parse(
        create
          ? {
              ...base,
              kind: "create-asset-activity",
              assetId,
              title,
              description,
              ...(start ? { start } : {}),
              deadline: finish,
            }
          : {
              ...base,
              kind: "edit-activity",
              internalId: targetId,
              ...((initialDraft?.kind === "edit-activity" &&
                initialDraft.assetIds !== undefined) ||
              JSON.stringify([...linkedAssetIds].sort()) !==
                JSON.stringify([...initialAssetIds].sort())
                ? { assetIds: linkedAssetIds }
                : {}),
              ...(start && start !== detail?.activity.start ? { start } : {}),
              ...(finish && finish !== detail?.activity.finish
                ? { finish }
                : {}),
              removeLinkIds: removed,
              addLinks: links.map((link) => ({
                predecessorId:
                  link.direction === "predecessor" ? link.otherId : targetId,
                successorId:
                  link.direction === "predecessor" ? targetId : link.otherId,
                type: link.type,
                lagHours: link.lagHours,
              })),
            },
      );
      const response = await fetch(
        `/api/projects/${projectId}/schedule-working`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft }),
        },
      );
      const value = await response.json();
      if (!response.ok)
        throw new Error(value.error ?? "Could not preview schedule change.");
      setPrepared(value);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not preview schedule change.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!prepared || busy || !prepared.canConfirm || !isOnline) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/projects/${projectId}/schedule-working`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: prepared.token, confirmed: true }),
        },
      );
      const value = await response.json();
      if (!response.ok)
        throw new Error(value.error ?? "Could not confirm schedule change.");
      toast.success(
        value.replay
          ? "This schedule change was already saved"
          : "Working schedule revision saved",
      );
      await onSaved();
      onClose?.();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save schedule change.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <p role="status" className="text-sm text-slate-600">
        Loading saved activity…
      </p>
    );
  return (
    <section
      className="min-w-0 space-y-4 rounded-xl border bg-white p-4 sm:p-5"
      aria-label="Working schedule editor"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">
            {create ? "Create an asset activity" : "Edit working schedule"}
          </h3>
          {detail && (
            <p className="mt-1 break-words text-sm text-slate-600">
              {detail.activity.activityId} · {detail.activity.name}
            </p>
          )}
        </div>
        <InfoPopover label="Working schedule rules">
          <p>
            Only explicit forecast dates and the dependency links you select
            change. Source dates, actuals, baselines, durations and calendars
            stay intact. This operation does not recalculate downstream P6
            dates.
          </p>
          <p>
            Administrators and managers confirm their own preview. Supervisors
            can prepare a preview, but cannot save it. A saved deadline-only
            activity has no invented start or duration.
          </p>
        </InfoPopover>
      </div>
      <form onSubmit={review} onChange={invalidate} className="space-y-4">
        <fieldset disabled={busy || !isOnline} className="space-y-4">
          {create && (
            <>
              <label className="block text-sm font-medium">
                Asset
                <select
                  className="field-select mt-1"
                  required
                  value={assetId}
                  onChange={(event) => setAssetId(event.target.value)}
                >
                  <option value="">Choose an asset</option>
                  {project?.commissioning?.assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                      {asset.clientAssetId ? ` · ${asset.clientAssetId}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Activity name
                <Input
                  className="mt-1"
                  required
                  maxLength={150}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="block text-sm font-medium">
                Task description{" "}
                <span className="font-normal text-slate-600">· optional</span>
                <Textarea
                  className="mt-1"
                  maxLength={5000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
            </>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Forecast start{" "}
              <span className="font-normal text-slate-600">
                · {create ? "optional" : "saved actuals protected"}
              </span>
              <Input
                className="mt-1"
                type="date"
                value={start}
                disabled={!!detail?.fields.act_start_date}
                onChange={(event) => setStart(event.target.value)}
              />
            </label>
            <label className="text-sm font-medium">
              {create ? "Deadline" : "Forecast finish"}
              <Input
                className="mt-1"
                type="date"
                required={create}
                value={finish}
                disabled={!!detail?.fields.act_end_date}
                onChange={(event) => setFinish(event.target.value)}
              />
            </label>
          </div>
          {!create && (
            <details className="border-t pt-3">
              <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">
                Activity equipment links ({linkedAssetIds.length})
              </summary>
              <p className="mt-2 max-w-prose text-sm text-slate-600">
                Choose equipment explicitly linked at activity level. Existing
                task, primary asset and per-level links stay unchanged. Supplier
                and step progress use the saved links; no name matching is
                inferred.
              </p>
              <Input
                className="mt-3"
                aria-label="Find equipment to link"
                placeholder="Search name, project reference or supplier"
                value={assetQuery}
                onChange={(event) => setAssetQuery(event.target.value)}
              />
              <div
                className="mt-2 max-h-60 overflow-auto rounded-md border px-3"
                role="group"
                aria-label="Equipment links"
              >
                {project?.commissioning?.assets
                  .filter((asset) =>
                    `${asset.name} ${asset.clientAssetId ?? ""} ${asset.vendor ?? ""}`
                      .toLowerCase()
                      .includes(assetQuery.trim().toLowerCase()),
                  )
                  .slice(0, 80)
                  .map((asset) => (
                    <label
                      className="flex min-h-11 items-start gap-2 py-2 text-sm"
                      key={asset.id}
                    >
                      <input
                        className="mt-1 size-4 shrink-0 accent-blue-700"
                        type="checkbox"
                        checked={linkedAssetIds.includes(asset.id)}
                        disabled={
                          !linkedAssetIds.includes(asset.id) &&
                          linkedAssetIds.length >= 200
                        }
                        onChange={(event) =>
                          setLinkedAssetIds((old) =>
                            event.target.checked
                              ? [...old, asset.id]
                              : old.filter((id) => id !== asset.id),
                          )
                        }
                      />
                      <span className="min-w-0 break-words">
                        {asset.name}
                        <span className="block text-xs text-slate-600">
                          {asset.clientAssetId ?? asset.id} · Supplier:{" "}
                          {asset.vendor || "Not recorded"}
                        </span>
                      </span>
                    </label>
                  ))}
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Up to 80 matching equipment entries shown; search to narrow the
                list. Selections outside this list stay selected. Maximum 200
                links.
              </p>
              {!!linkedAssetIds.length && (
                <Button
                  className="mt-2"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    invalidate();
                    setLinkedAssetIds([]);
                  }}
                >
                  Clear these equipment links
                </Button>
              )}
            </details>
          )}
          {!create && (
            <details className="border-t pt-3">
              <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">
                Predecessors and successors
              </summary>
              <div className="mt-2 space-y-3">
                {detail?.relationships.map((link) => (
                  <label
                    key={link.sourceLine}
                    className="flex min-h-11 items-start gap-2 text-sm"
                  >
                    <input
                      className="mt-1 size-4 accent-blue-700"
                      type="checkbox"
                      checked={removed.includes(link.sourceLine)}
                      onChange={(event) =>
                        setRemoved((old) =>
                          event.target.checked
                            ? [...old, link.sourceLine]
                            : old.filter((line) => line !== link.sourceLine),
                        )
                      }
                    />
                    <span className="min-w-0 break-words">
                      Remove {link.predecessorActivityId} →{" "}
                      {link.successorActivityId}
                      <span className="block text-xs text-slate-600">
                        {link.type} · {link.lagHours || "0"} hours lag ·
                        Reference {link.sourceLine}
                      </span>
                    </span>
                  </label>
                ))}
                {links.map((link, index) => (
                  <div key={index} className="space-y-3 border-t pt-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm">
                        Direction
                        <select
                          className="field-select mt-1"
                          value={link.direction}
                          onChange={(event) =>
                            setLinks((old) =>
                              old.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      direction: event.target
                                        .value as AddedLink["direction"],
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="predecessor">Add predecessor</option>
                          <option value="successor">Add successor</option>
                        </select>
                      </label>
                      <ActivityPicker
                        projectId={projectId}
                        value={link.otherId}
                        onSelect={(value) => {
                          invalidate();
                          setLinks((old) =>
                            old.map((item, i) =>
                              i === index ? { ...item, otherId: value } : item,
                            ),
                          );
                        }}
                        label={`Dependency ${index + 1} activity`}
                      />
                      <label className="text-sm">
                        Link type
                        <select
                          className="field-select mt-1"
                          value={link.type}
                          onChange={(event) =>
                            setLinks((old) =>
                              old.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      type: event.target
                                        .value as AddedLink["type"],
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="PR_FS">Finish to start</option>
                          <option value="PR_SS">Start to start</option>
                          <option value="PR_FF">Finish to finish</option>
                          <option value="PR_SF">Start to finish</option>
                        </select>
                      </label>
                      <label className="text-sm">
                        Lag in hours
                        <Input
                          className="mt-1"
                          type="number"
                          step="any"
                          min={-1000000}
                          max={1000000}
                          value={link.lagHours}
                          onChange={(event) =>
                            setLinks((old) =>
                              old.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      lagHours: Number(event.target.value),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        invalidate();
                        setLinks((old) => old.filter((_, i) => i !== index));
                      }}
                    >
                      <Trash2 className="size-4" />
                      Remove proposed link
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  disabled={links.length >= 20}
                  onClick={() => {
                    invalidate();
                    setLinks((old) => [
                      ...old,
                      {
                        direction: "predecessor",
                        otherId: "",
                        type: "PR_FS",
                        lagHours: 0,
                      },
                    ]);
                  }}
                >
                  <Plus className="size-4" />
                  Add a dependency
                </Button>
              </div>
            </details>
          )}
          <label htmlFor={`${id}-reason`} className="block text-sm font-medium">
            Reason for this change
            <Textarea
              id={`${id}-reason`}
              className="mt-1"
              rows={2}
              required
              minLength={10}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !isOnline || (!create && !detail)}>
              {busy ? "Checking…" : "Preview schedule change"}
            </Button>
            {onClose && (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
          </div>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="break-words text-sm text-red-700">
          {error}
        </p>
      )}
      {prepared && (
        <section
          className="space-y-3 border-t pt-4"
          aria-label="Schedule change preview"
          aria-live="polite"
        >
          <h4 className="text-base font-semibold">Review the exact changes</h4>
          {prepared.proposal.errors.map((message, index) => (
            <p role="alert" className="text-sm text-red-700" key={index}>
              {message}
            </p>
          ))}
          {prepared.proposal.activity && (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium text-slate-600">Activity</dt>
                <dd className="mt-1 break-words font-semibold">
                  {prepared.proposal.activity.name}
                </dd>
                <dd className="mt-1 text-xs text-slate-600">
                  {prepared.proposal.activity.activityId}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-600">
                  Equipment selected in this proposal
                </dt>
                <dd className="mt-1 max-h-40 overflow-auto">
                  <ul className="space-y-2">
                    {(prepared.proposal.createdTask
                      ? [prepared.proposal.createdTask.assetId]
                      : linkedAssetIds
                    ).map((assetId) => {
                      const asset = project?.commissioning?.assets.find(
                        (row) => row.id === assetId,
                      );
                      return (
                        <li key={assetId} className="break-words">
                          <span className="font-semibold">
                            {asset?.name ?? "Equipment no longer available"}
                          </span>
                          {asset?.clientAssetId && (
                            <span className="block text-xs text-slate-600">
                              Project ref: {asset.clientAssetId}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {!prepared.proposal.createdTask && !linkedAssetIds.length && (
                    <span className="text-slate-600">
                      No additional activity equipment selected. Existing task
                      and per-level links stay unchanged.
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-600">Forecast start</dt>
                <dd className="mt-1 tabular-nums">
                  {detail?.activity.start &&
                  detail.activity.start !== prepared.proposal.activity.start
                    ? `${detail.activity.start} → `
                    : ""}
                  {prepared.proposal.activity.start ?? "Not recorded"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-600">
                  {prepared.proposal.createdTask
                    ? "Deadline"
                    : "Forecast finish"}
                </dt>
                <dd className="mt-1 tabular-nums">
                  {detail?.activity.finish &&
                  detail.activity.finish !== prepared.proposal.activity.finish
                    ? `${detail.activity.finish} → `
                    : ""}
                  {prepared.proposal.activity.finish ?? "Not recorded"}
                </dd>
              </div>
            </dl>
          )}
          {prepared.proposal.createdTask && (
            <p className="text-sm text-slate-600">
              Creates one unassigned task for this equipment.{" "}
              {prepared.proposal.activity?.start
                ? "Duration is not recorded."
                : "Start and duration are not recorded."}
            </p>
          )}
          <details>
            <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">
              Saved changes and technical references (
              {prepared.proposal.changes.length})
            </summary>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
              {prepared.proposal.changes.map((change, index) => (
                <li key={index} className="break-words">
                  {change}
                </li>
              ))}
            </ul>
          </details>
          {prepared.proposal.replay && (
            <p className="text-sm text-slate-600">
              This change has already been saved. No duplicate activity or task
              will be created.
            </p>
          )}
          <p className="max-w-prose text-sm text-slate-600">
            {prepared.proposal.limitation}
          </p>
          <details>
            <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">
              {prepared.proposal.impactedCount}{" "}
              {prepared.proposal.impactedCount === 1
                ? "activity"
                : "activities"}{" "}
              in the downstream review
            </summary>
            <ul className="max-h-60 space-y-2 overflow-auto text-sm">
              {prepared.proposal.impactedActivities.map((row) => (
                <li key={row.internalId} className="break-words">
                  {row.activityId} · {row.name}
                  <span className="block text-xs text-slate-600">
                    {row.start ?? "Start not recorded"} →{" "}
                    {row.finish ?? "Finish not recorded"} ·{" "}
                    {row.datesChanged
                      ? "Explicit date change"
                      : "Dates unchanged"}
                  </span>
                </li>
              ))}
            </ul>
            {prepared.proposal.impactedCount >
              prepared.proposal.impactRowsShown && (
              <p className="mt-2 text-xs text-slate-600">
                Showing {prepared.proposal.impactRowsShown} of{" "}
                {prepared.proposal.impactedCount} affected graph records. The
                complete graph was checked for cycles.
              </p>
            )}
          </details>
          {prepared.canConfirm ? (
            <Button onClick={() => void confirm()} disabled={busy || !isOnline}>
              {busy ? "Saving…" : "Confirm my schedule change"}
            </Button>
          ) : (
            !prepared.proposal.errors.length &&
            !prepared.proposal.replay && (
              <p className="text-sm text-slate-600">
                Only an administrator or manager can confirm their own proposal.
                This preview has not saved a change.
              </p>
            )
          )}
        </section>
      )}
    </section>
  );
}
function ActivityPicker({
  projectId,
  value,
  onSelect,
  label,
}: {
  projectId: string;
  value: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  const id = useId();
  const [query, setQuery] = useState(""),
    [rows, setRows] = useState<SourceActivityView[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(
        `/api/projects/${projectId}/schedule-working?${new URLSearchParams({ q: query })}`,
        { signal: controller.signal },
      )
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.error ?? "Activity search failed.");
          setRows(result.activities.slice(0, 8));
          setError("");
        })
        .catch((failure) => {
          if (!controller.signal.aborted)
            setError(
              failure instanceof Error
                ? failure.message
                : "Activity search failed.",
            );
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, projectId]);
  return (
    <div className="min-w-0">
      <label className="text-sm" htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        className="mt-1"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setRows([]);
          onSelect("");
        }}
        placeholder="Find by activity ID or name"
      />
      <p className="mt-1 break-words text-xs text-slate-600">
        {value
          ? `Selected internal reference: ${value}`
          : "Select one saved activity below."}
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {rows.length > 0 && (
        <ul className="mt-2 max-h-56 overflow-auto rounded-md border bg-white">
          {rows.map((row) => (
            <li key={row.internalId}>
              <button
                type="button"
                className="min-h-11 w-full break-words px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700"
                onClick={() => {
                  onSelect(row.internalId);
                  setQuery(`${row.activityId} · ${row.name}`);
                  setRows([]);
                }}
              >
                {row.activityId} · {row.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
