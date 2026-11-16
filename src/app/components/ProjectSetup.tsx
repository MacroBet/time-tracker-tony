"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { commissioning } from "@/lib/commissioning";
import type { Project } from "@/lib/domain";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type CreationRequest = {
  requestId: string;
  name: string;
  location: string;
  companyId: string;
};
const pendingEvent = "fieldtrack-project-creation";
function subscribePending(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(pendingEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(pendingEvent, callback);
  };
}
function readPending(key: string) {
  try {
    return window.sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function parsePending(value: string): CreationRequest | null {
  try {
    const parsed = JSON.parse(value);
    return parsed &&
      ["requestId", "name", "location", "companyId"].every(
        (key) => typeof parsed[key] === "string",
      )
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function ProjectSetup() {
  const app = useApp();
  if (app.currentUser.role !== "admin") return null;
  const project = app.projects.find((row) => row.id === app.selectedProjectId);
  return (
    <section
      aria-label="Project setup"
      className="rounded-xl border bg-white p-4 sm:p-5 space-y-5"
    >
      <div>
        <h2 className="text-lg font-semibold">Project setup</h2>
        <p className="mt-1 max-w-prose text-sm text-slate-600">
          Create a separate project before importing its schedule. Choose the
          destination project when reviewing the import.
        </p>
      </div>
      <CreateProjectForm />
      {project && (
        <ProjectNameEditor
          key={`${project.id}-${project.name}`}
          project={project}
        />
      )}
    </section>
  );
}

function CreateProjectForm() {
  const {
    currentUser,
    companies,
    mutate,
    selectProject,
    refreshData,
    isOnline,
  } = useApp();
  const router = useRouter();
  const key = `fieldtrack:pending-project:${currentUser.id}`;
  const stored = useSyncExternalStore(
    subscribePending,
    () => readPending(key),
    () => "",
  );
  const [fallback, setFallback] = useState<CreationRequest | null>(null);
  const pending = fallback ?? parsePending(stored);
  const [created, setCreated] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const remember = (request: CreationRequest | null) => {
    setFallback(request);
    try {
      if (request) window.sessionStorage.setItem(key, JSON.stringify(request));
      else window.sessionStorage.removeItem(key);
    } catch {
      // The in-memory request still makes retries safe when browser storage is unavailable.
    }
    window.dispatchEvent(new Event(pendingEvent));
  };
  async function create(request: CreationRequest) {
    if (inFlight.current || !isOnline) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    remember(request);
    try {
      const saved = await mutate<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify(request),
      });
      setCreated(saved);
      selectProject(saved.id);
      remember(null);
      toast.success("Project created. Its schedule is ready to import.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not confirm project creation. Retry the same request.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim(),
      location = String(data.get("location") ?? "").trim();
    if (name.length < 3 || location.length < 2) {
      setError(
        "Enter a project name of at least 3 characters and a location of at least 2 characters.",
      );
      return;
    }
    void create({
      requestId: crypto.randomUUID(),
      name,
      location,
      companyId: String(data.get("companyId")),
    });
  }
  async function openSchedule() {
    if (!created || inFlight.current || !isOnline) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await refreshData();
      selectProject(created.id);
      router.push(
        `/schedule?projectId=${encodeURIComponent(created.id)}&setup=import`,
      );
    } catch {
      setError(
        "Your project was created. Reconnect and open its schedule again; you do not need to create it again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <details id="create-project" open className="border-t pt-4">
      <summary className="min-h-11 cursor-pointer content-center rounded font-semibold focus-visible:outline-2 focus-visible:outline-blue-700">
        Create a new project
      </summary>
      {pending ? (
        <div className="mt-3 space-y-3" role="status">
          <p className="text-sm">
            {busy ? "Creating" : "Creation not confirmed for"}{" "}
            <strong>{pending.name}</strong> · {pending.location}
          </p>
          <p className="max-w-prose text-sm text-slate-600">
            Retry this saved request to recover the same project, including if
            the first response was lost.
          </p>
          <Button
            disabled={busy || !isOnline}
            onClick={() => void create(pending)}
          >
            {busy ? "Creating…" : "Retry same project"}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <fieldset
            disabled={busy || !isOnline}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <label className="text-sm">
              FieldTrack project name
              <Input
                name="name"
                required
                minLength={3}
                maxLength={150}
                className="mt-1"
                autoComplete="off"
                placeholder="Project name"
              />
            </label>
            <label className="text-sm">
              Location
              <Input
                name="location"
                required
                minLength={2}
                maxLength={200}
                className="mt-1"
                autoComplete="off"
                placeholder="Site or location"
              />
            </label>
            <label className="text-sm">
              Company
              <select
                name="companyId"
                required
                defaultValue={currentUser.companyId}
                className="field-select mt-1"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          <p className="max-w-prose text-xs text-slate-600">
            You administer the new, empty project. Existing projects keep their
            data and team access.
          </p>
          <Button disabled={busy || !isOnline || !companies.length}>
            Create project
          </Button>
        </form>
      )}
      {created && (
        <div className="mt-4 space-y-2 border-t pt-4" role="status">
          <p className="text-sm font-medium">{created.name} is ready.</p>
          <p className="text-sm text-slate-600">
            Import destination: {created.name} · {created.location}. Review the
            P6 source before saving.
          </p>
          <Button
            variant="outline"
            disabled={busy || !isOnline}
            onClick={() => void openSchedule()}
          >
            Open Schedule &amp; import XER
            <ArrowRight className="size-4" />
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </details>
  );
}

function ProjectNameEditor({ project }: { project: Project }) {
  const { mutate, isOnline } = useApp();
  const state = commissioning(project);
  const [name, setName] = useState(project.name),
    [reason, setReason] = useState("");
  const [review, setReview] = useState<{
    name: string;
    reason: string;
    requestId: string;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const inFlight = useRef(false);
  async function preview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !isOnline) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setReview(null);
    const proposed = {
      name: name.trim(),
      reason: reason.trim(),
      requestId: crypto.randomUUID(),
    };
    try {
      await mutate(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...proposed,
          expectedName: project.name,
          preview: true,
        }),
      });
      setReview(proposed);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not preview this name change.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function confirm() {
    if (!review || inFlight.current || !isOnline) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await mutate(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...review, expectedName: project.name }),
      });
      setReview(null);
      toast.success("FieldTrack project name updated");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save this name change. Refresh and review it again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="border-t pt-4 space-y-3">
      <h3 className="font-semibold">Selected project: {project.name}</h3>
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-slate-600">Location</dt>
          <dd className="mt-1 break-words">{project.location}</dd>
        </div>
        <div>
          <dt className="text-slate-600">P6 source project</dt>
          <dd className="mt-1 break-words">
            {state.sourceProgrammeSummary?.projectName || "Not imported"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-600">Source file</dt>
          <dd className="mt-1 break-words">
            {state.sourceProgrammeSummary?.fileName || "Not imported"}
          </dd>
        </div>
      </dl>
      <Link
        href={`/schedule?projectId=${encodeURIComponent(project.id)}&setup=import`}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-blue-700 underline underline-offset-4"
      >
        Open this project’s Schedule
        <ArrowRight className="size-4" />
      </Link>
      <details>
        <summary className="min-h-11 cursor-pointer content-center rounded text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue-700">
          Rename FieldTrack project
        </summary>
        <form onSubmit={preview} className="mt-3 space-y-3">
          <p className="max-w-prose text-sm text-slate-600">
            This is the name shown in FieldTrack. The imported P6 project name
            and source filename stay recorded separately.
          </p>
          <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              FieldTrack project name
              <Input
                required
                minLength={3}
                maxLength={150}
                className="mt-1"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setReview(null);
                }}
              />
            </label>
            <label className="text-sm">
              Reason for change
              <Input
                required
                minLength={10}
                maxLength={1000}
                className="mt-1"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setReview(null);
                }}
                placeholder="Explain this name change"
              />
            </label>
          </fieldset>
          <Button
            variant="outline"
            disabled={busy || !isOnline || name.trim() === project.name}
          >
            {busy ? "Checking…" : "Preview name change"}
          </Button>
        </form>
        {review && (
          <div
            aria-label="Project name change preview"
            className="mt-4 space-y-3 border-t pt-4"
            aria-live="polite"
          >
            <p className="text-sm">
              <span className="text-slate-600">Before:</span> {project.name}
              <br />
              <span className="text-slate-600">After:</span> {review.name}
            </p>
            <p className="max-w-prose text-xs text-slate-600">
              Project ID, schedule versions, activities, assets and team access
              are preserved.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || !isOnline}
                onClick={() => void confirm()}
              >
                {busy ? "Saving…" : "Confirm project name"}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setReview(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </details>
    </div>
  );
}
