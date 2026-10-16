"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { commissioning, hasModule } from "@/lib/commissioning";
import type { Project } from "@/lib/domain";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type ReferencePreview = {
  version: number;
  programmeId: string;
  reason: string;
  changes: string[];
  errors: string[];
};
export function ProgrammeReference({ project }: { project: Project }) {
  const { currentUser, isOnline } = useApp();
  const state = commissioning(project);
  const [editing, setEditing] = useState<{
    before: string;
    version: number;
  } | null>(null);
  const allowed =
    currentUser.role !== "worker" && hasModule(currentUser, "commissioning");
  return (
    <section
      aria-label="Programme reference"
      className="rounded-xl border bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Programme ID</h3>
          <p className="mt-1 break-words text-sm text-slate-700">
            {state.programmeId || "Not recorded"}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            One programme for this project. Each activity has its own Activity
            ID.
          </p>
        </div>
        {allowed && !editing && (
          <Button
            variant="outline"
            className="min-h-11"
            disabled={!isOnline}
            onClick={() =>
              setEditing({
                before: state.programmeId ?? "",
                version: state.version,
              })
            }
          >
            {state.programmeId ? "Edit Programme ID" : "Set Programme ID"}
          </Button>
        )}
      </div>
      {editing && allowed && (
        <ProgrammeReferenceEditor
          key={`${project.id}-${editing.version}`}
          project={project}
          before={editing.before}
          version={editing.version}
          onClose={() =>
            setEditing((current) => (current === editing ? null : current))
          }
        />
      )}
    </section>
  );
}

function ProgrammeReferenceEditor({
  project,
  before,
  version,
  onClose,
}: {
  project: Project;
  before: string;
  version: number;
  onClose: () => void;
}) {
  const { mutate, isOnline } = useApp();
  const [value, setValue] = useState(before);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<ReferencePreview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const currentVersion = commissioning(project).version;
  const stale = version !== currentVersion;
  // A refreshed project revision invalidates approval of the previous preview.
  const activePreview = preview?.version === currentVersion ? preview : null;
  const invalidate = () => {
    setPreview(null);
    setError("");
  };
  const payload = (
    programmeId: string,
    revisionReason: string,
    previewOnly: boolean,
  ) => ({
    action: "import",
    version,
    preview: previewOnly,
    reason: revisionReason,
    data: { assets: [], schedule: [], programmeId },
  });
  async function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || stale || !isOnline) return;
    const programmeId = value.trim(),
      revisionReason = reason.trim();
    if (programmeId === before) {
      setError("Change the Programme ID before requesting a preview.");
      return;
    }
    if (
      programmeId.length > 150 ||
      revisionReason.length < 10 ||
      revisionReason.length > 1000
    ) {
      setError(
        "Use at most 150 characters for the ID and a reason of 10–1,000 characters.",
      );
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const result = await mutate<{
        changes: string[];
        errors: string[];
        programmeId?: string;
      }>(`/api/projects/${project.id}/commissioning`, {
        method: "PATCH",
        body: JSON.stringify(payload(programmeId, revisionReason, true)),
      });
      setPreview({
        programmeId,
        reason: revisionReason,
        version,
        changes: result.changes,
        errors: result.errors,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not preview the Programme ID change.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (
      inFlight.current ||
      stale ||
      !isOnline ||
      !activePreview ||
      activePreview.errors.length ||
      !activePreview.changes.length
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await mutate(`/api/projects/${project.id}/commissioning`, {
        method: "PATCH",
        body: JSON.stringify(
          payload(activePreview.programmeId, activePreview.reason, false),
        ),
      });
      toast.success("Programme ID updated");
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save the Programme ID change.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 border-t pt-4 space-y-4">
      {stale && (
        <p role="alert" className="text-sm text-red-700">
          The project changed. Cancel and reopen this editor to preview the
          latest revision. This change has not been saved.
        </p>
      )}
      <form onSubmit={review} className="space-y-4">
        <fieldset
          disabled={busy || stale}
          className="grid gap-4 sm:grid-cols-2"
        >
          <label className="block text-sm">
            Programme ID{" "}
            <span className="font-normal text-slate-600">· optional</span>
            <Input
              name="programmeId"
              className="mt-1 h-11"
              maxLength={150}
              value={value}
              onChange={(event) => {
                invalidate();
                setValue(event.target.value);
              }}
              autoComplete="off"
              placeholder="Client programme reference"
            />
            <span className="mt-1 block text-xs font-normal text-slate-600">
              Leave empty to clear this reference. Individual Activity IDs stay
              the same.
            </span>
          </label>
          <label className="block text-sm">
            Reason for change
            <Input
              name="reason"
              className="mt-1 h-11"
              required
              minLength={10}
              maxLength={1000}
              value={reason}
              onChange={(event) => {
                invalidate();
                setReason(event.target.value);
              }}
              placeholder="Explain this reference change"
            />
          </label>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-11" disabled={busy || stale || !isOnline}>
            {busy ? "Checking…" : "Preview Programme ID change"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {activePreview && (
        <section
          aria-label="Programme ID change preview"
          aria-live="polite"
          className="space-y-3 border-t pt-4"
        >
          <h4 className="text-sm font-semibold">Review Programme ID change</h4>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-600">Before</dt>
              <dd className="mt-1 break-words">{before || "Not recorded"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-600">After</dt>
              <dd className="mt-1 break-words">
                {activePreview.programmeId ||
                  "Not recorded · reference will be cleared"}
              </dd>
            </div>
          </dl>
          {activePreview.errors.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-red-700">
              {activePreview.errors.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          ) : (
            <>
              <p className="text-xs text-slate-600">
                {activePreview.changes.length} recorded change
                {activePreview.changes.length === 1 ? "" : "s"}. Review before
                saving.
              </p>
              <ul className="max-h-40 list-disc overflow-auto pl-5 text-xs text-slate-600">
                {activePreview.changes.map((change, index) => (
                  <li key={index}>{change}</li>
                ))}
              </ul>
              <Button
                className="min-h-11"
                onClick={save}
                disabled={
                  busy || stale || !isOnline || !activePreview.changes.length
                }
              >
                {busy ? "Saving…" : "Confirm Programme ID change"}
              </Button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
