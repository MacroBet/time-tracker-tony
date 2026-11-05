"use client";

import { useState } from "react";
import { Plus, RotateCcw, Check } from "lucide-react";
import type { Asset } from "@/lib/commissioning";
import type { Task, User } from "@/lib/domain";
import {
  canWorkOnAsset,
  worksToGoSummary,
  type ChecksheetCommand,
  type ProjectChecksheetState,
} from "@/lib/checksheets";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

const selectClass =
  "mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
export function WorksToGoWorkspace({
  state,
  assets,
  tasks,
  currentUser,
  busy,
  onCommand,
}: {
  state?: ProjectChecksheetState;
  assets: Asset[];
  tasks: Task[];
  currentUser: User;
  busy?: boolean;
  onCommand: (command: ChecksheetCommand) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("open");
  const [query, setQuery] = useState("");
  const [assetId, setAssetId] = useState("");
  const [taskId, setTaskId] = useState("");
  const manage = currentUser.role !== "worker";
  const availableAssets = assets.filter((a) =>
    canWorkOnAsset(currentUser, a.id, tasks),
  );
  const availableTasks = tasks.filter(
    (t) =>
      (manage || t.assignedTo === currentUser.id) &&
      (!assetId || t.cx?.assetId === assetId),
  );
  const rows = (state?.worksToGo ?? []).filter(
    (row) =>
      (status === "all" || row.status === status) &&
      `${row.title} ${row.notes} ${assets.find((a) => a.id === row.assetId)?.name ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const counts = worksToGoSummary(state);
  const disabled = busy || pending;
  async function run(command: ChecksheetCommand) {
    setError("");
    setPending(true);
    try {
      await onCommand(command);
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Refresh the project and try again.",
      );
      return false;
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="space-y-6" aria-labelledby="works-to-go-heading">
      <div>
        <h2 id="works-to-go-heading" className="text-xl font-semibold">
          Works to go
        </h2>
        <p className="mt-2 max-w-prose text-sm text-slate-600">
          Record remaining work against equipment or an existing task. This list
          does not change task status, assignments or commissioning results.
        </p>
      </div>
      <p className="text-sm text-slate-700">
        <strong>{counts.open}</strong> open · {counts.done} completed
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <details className="rounded-lg border border-slate-200 p-4">
        <summary className="cursor-pointer font-medium">
          Add remaining work
        </summary>
        <form
          className="mt-4 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fields = new FormData(form);
            if (
              await run({
                kind: "add-work",
                id: crypto.randomUUID(),
                title: String(fields.get("title") ?? ""),
                notes: String(fields.get("notes") ?? ""),
                assetId: assetId || undefined,
                taskId: taskId || undefined,
              })
            ) {
              form.reset();
              setAssetId("");
              setTaskId("");
            }
          }}
        >
          <label className="block max-w-2xl text-sm">
            Work remaining
            <Input
              name="title"
              required
              maxLength={500}
              disabled={disabled}
              className="mt-1 min-h-11"
              placeholder="Describe the work still to be completed"
            />
          </label>
          <label className="block max-w-2xl text-sm">
            Notes
            <Textarea
              name="notes"
              maxLength={10000}
              disabled={disabled}
              className="mt-1 min-h-24"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="min-w-0 text-sm">
              Equipment
              <select
                className={selectClass}
                value={assetId}
                disabled={disabled}
                onChange={(e) => {
                  setAssetId(e.target.value);
                  setTaskId("");
                }}
              >
                <option value="">
                  {manage
                    ? "Project-level work or choose equipment"
                    : "Choose assigned equipment or a task below"}
                </option>
                {availableAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.equipmentType} · {a.phase || "No phase"} ·{" "}
                    {a.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-sm">
              Existing task
              <select
                className={selectClass}
                value={taskId}
                disabled={disabled}
                onChange={(e) => setTaskId(e.target.value)}
              >
                <option value="">No task link</option>
                {availableTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!manage && (
            <p className="text-sm text-slate-600">
              Choose equipment linked to your assigned work, or one of your
              assigned tasks.
            </p>
          )}
          <Button
            className="min-h-11"
            disabled={disabled || (!manage && !assetId && !taskId)}
          >
            <Plus className="size-4" />
            Add work
          </Button>
        </form>
      </details>
      <div className="flex flex-wrap items-end gap-4">
        <label className="min-w-48 text-sm">
          Search
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-1 min-h-11"
            placeholder="Work or equipment"
          />
        </label>
        <label className="text-sm">
          Status
          <select
            className={selectClass}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="open">Open</option>
            <option value="done">Completed</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>
      <ul className="divide-y divide-slate-200">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-start justify-between gap-4 py-4"
          >
            <div className="min-w-0 flex-1">
              <h3 className="break-words font-medium">{row.title}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {row.assetId
                  ? (assets.find((a) => a.id === row.assetId)?.name ??
                    row.assetId)
                  : "Project-level work"}
                {row.taskId
                  ? ` · ${tasks.find((t) => t.id === row.taskId)?.title ?? "Linked task"}`
                  : ""}{" "}
                · {row.status === "open" ? "Open" : "Completed"}
              </p>
              {row.notes && (
                <p className="mt-2 max-w-prose whitespace-pre-wrap break-words text-sm text-slate-700">
                  {row.notes}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Updated {new Date(row.updatedAt).toLocaleString()}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={disabled}
              onClick={() =>
                void run({
                  kind: "set-work-status",
                  id: row.id,
                  status: row.status === "open" ? "done" : "open",
                })
              }
            >
              {row.status === "open" ? (
                <>
                  <Check className="size-4" />
                  Mark complete
                </>
              ) : (
                <>
                  <RotateCcw className="size-4" />
                  Reopen
                </>
              )}
            </Button>
          </li>
        ))}
      </ul>
      {!rows.length && (
        <p className="py-4 text-sm text-slate-600">
          {query
            ? "No remaining work matches this search."
            : status === "done"
              ? "No completed work items yet."
              : "No open works-to-go items in this view."}
        </p>
      )}
    </section>
  );
}
export function WorksToGoOverview({
  state,
  onOpen,
}: {
  state?: ProjectChecksheetState;
  onOpen: () => void;
}) {
  const counts = worksToGoSummary(state);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 py-4">
      <div>
        <h3 className="font-semibold">Works to go</h3>
        <p className="mt-1 text-sm text-slate-600">
          {counts.open} open remaining-work items · {counts.done} completed
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={onOpen}
      >
        View remaining work
      </Button>
    </div>
  );
}
