"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "../contexts/AppContext";
import { AppShell } from "./AppShell";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  commissioning,
  LEVELS,
  PRIORITIES,
  MODULES,
  hasModule,
  type Asset,
  type ScheduleActivity,
} from "@/lib/commissioning";
import {
  registerImportSchema,
  type RegisterImport,
} from "@/lib/commissioning-import";
import { CommissioningReport, type ReportView } from "./CommissioningReport";
import { type Project, type User, projectDate } from "@/lib/domain";

type Preview = {
  changes: string[];
  errors: string[];
  assets: number;
  schedule: number;
};
export function CommissioningWorkspace({
  admin = false,
  reports = false,
}: {
  admin?: boolean;
  reports?: boolean;
}) {
  const app = useApp(),
    project = app.projects.find((p) => p.id === app.selectedProjectId);
  return (
    <AppShell
      title={
        admin
          ? "Administrator control"
          : reports
            ? "Management reports"
            : "Assets & schedule"
      }
      subtitle={
        admin
          ? "Project setup and individual feature access."
          : "Asset-linked commissioning and programme records."
      }
      wide
    >
      {project ? (
        <ProjectWorkspace
          key={`${project.id}-${admin}-${reports}`}
          project={project}
          admin={admin}
          reports={reports}
        />
      ) : (
        <p>No project assigned.</p>
      )}
      {admin && (
        <section className="rounded-xl border bg-white p-5 space-y-4">
          <h2 className="font-semibold">Feature access by person</h2>
          <p className="text-sm text-slate-500">
            Role and project membership still control responsibility and data
            access. A task-only profile shows assigned work and settings.
          </p>
          {app.users.map((user) => (
            <UserModules
              key={`${user.id}-${user.modules?.join()}`}
              user={user}
            />
          ))}
        </section>
      )}
    </AppShell>
  );
}
function UserModules({ user }: { user: User }) {
  const { mutate, isOnline } = useApp(),
    [busy, setBusy] = useState(false);
  const [modules, setModules] = useState(
    [...MODULES].filter((m) => hasModule(user, m)),
  );
  if (user.role === "admin")
    return <p className="text-sm">{user.name} · Administrator · All modules</p>;
  const allowed = MODULES.filter(
    (m) =>
      user.role !== "worker" ||
      ["tasks", "time", "commissioning", "feedback"].includes(m),
  );
  async function save() {
    setBusy(true);
    try {
      await mutate(`/api/team/${user.id}/modules`, {
        method: "PATCH",
        body: JSON.stringify({ modules }),
      });
      toast.success("Feature access updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="text-sm font-medium">
          {user.name}{" "}
          <span className="text-slate-500 font-normal">· {user.role}</span>
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setModules(["tasks"])}
          >
            Task-only profile
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setModules([...allowed])}
          >
            Full role access
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        {allowed.map((m) => (
          <label className="text-xs flex items-center gap-2 capitalize" key={m}>
            <input
              type="checkbox"
              checked={modules.includes(m)}
              disabled={m === "tasks"}
              onChange={(e) =>
                setModules(
                  e.target.checked
                    ? [...modules, m]
                    : modules.filter((x) => x !== m),
                )
              }
            />
            {m}
          </label>
        ))}
        <Button size="sm" onClick={save} disabled={busy || !isOnline}>
          Save access
        </Button>
      </div>
    </div>
  );
}
function ProjectWorkspace({
  project,
  admin,
  reports,
}: {
  project: Project;
  admin: boolean;
  reports: boolean;
}) {
  const { mutate, isOnline, currentUser, tasks } = useApp(),
    state = commissioning(project);
  const [view, setView] = useState<ReportView>("tags"),
    [asset, setAsset] = useState<Asset | null>(null),
    [schedule, setSchedule] = useState<ScheduleActivity | null>(null);
  const [payload, setPayload] = useState<RegisterImport | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [previewVersion, setPreviewVersion] = useState<number | null>(null),
    [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false),
    [assetQuery, setAssetQuery] = useState("");
  const canEdit =
    currentUser.role !== "worker" && hasModule(currentUser, "commissioning");
  const stale = previewVersion !== state.version;
  async function run(data: object) {
    return mutate<Preview>(`/api/projects/${project.id}/commissioning`, {
      method: "PATCH",
      body: JSON.stringify({ version: state.version, reason, ...data }),
    });
  }
  async function stage(data: RegisterImport) {
    if (reason.trim().length < 10) {
      toast.error("Add a revision reason of at least 10 characters.");
      return;
    }
    setBusy(true);
    try {
      const result = await run({ action: "import", data, preview: true });
      setPayload(data);
      setPreview(result);
      setPreviewVersion(state.version);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!payload) return;
    setBusy(true);
    try {
      await run({ action: "import", data: payload });
      setPreview(null);
      setPayload(null);
      setAsset(null);
      setSchedule(null);
      toast.success("Register saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  async function configure(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await run({
        action: "configure",
        config: {
          levels: f.getAll("levels"),
          priorities: f.getAll("priorities"),
        },
      });
      toast.success("Project setup saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  function assetForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void stage({
      assets: [
        {
          id: String(f.get("id")),
          name: String(f.get("name")),
          equipmentType: String(f.get("equipmentType")),
          location: String(f.get("location")),
          levels: f.getAll("levels") as Asset["levels"],
          deliveryActivityId:
            String(f.get("deliveryActivityId") || "") || undefined,
          expectedDelivery:
            String(f.get("expectedDelivery") || "") || undefined,
          levelActivities: Object.fromEntries(
            state.config.levels.flatMap((l) =>
              f.get(`activity-${l}`)
                ? [[l, String(f.get(`activity-${l}`))]]
                : [],
            ),
          ),
        },
      ],
      schedule: [],
    });
  }
  function scheduleForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void stage({
      assets: [],
      schedule: [
        {
          ...schedule,
          activityId: String(f.get("activityId")),
          name: String(f.get("name")),
          start: String(f.get("start") || "") || undefined,
          finish: String(f.get("finish") || "") || undefined,
          actualFinish: String(f.get("actualFinish") || "") || undefined,
          progress: f.get("progress") ? Number(f.get("progress")) : undefined,
        },
      ],
    });
  }
  const assetRows = state.assets.filter((a) =>
    `${a.id} ${a.name} ${a.equipmentType}`
      .toLowerCase()
      .includes(assetQuery.toLowerCase()),
  );
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">{project.name}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {state.assets.length} assets · {state.schedule.length} schedule
          activities · Revision {state.version}
        </p>
      </div>
      {canEdit && !reports && (
        <section className="rounded-xl border bg-white p-5 space-y-3">
          <label className="block text-sm font-medium">
            Reason for this revision
            <Textarea
              className="mt-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={10}
              maxLength={1000}
              placeholder="Describe the approved programme change, delivery update or register correction…"
            />
          </label>
          <p className="text-xs text-slate-500">
            Every saved change records its author and reason. Existing baseline
            dates are preserved.
          </p>
        </section>
      )}
      {admin && (
        <form
          key={state.version}
          onSubmit={configure}
          className="rounded-xl border bg-white p-5 space-y-4"
        >
          <h3 className="font-semibold">Project setup</h3>
          <fieldset>
            <legend className="text-sm mb-2">
              Commissioning levels used by this project
            </legend>
            <div className="flex flex-wrap gap-5">
              {LEVELS.map((l) => (
                <label key={l} className="text-sm flex items-center gap-2">
                  <input
                    name="levels"
                    type="checkbox"
                    value={l}
                    defaultChecked={state.config.levels.includes(l)}
                  />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm mb-2">Available issue priorities</legend>
            <div className="flex flex-wrap gap-5">
              {PRIORITIES.map((p) => (
                <label key={p} className="text-sm flex items-center gap-2">
                  <input
                    name="priorities"
                    type="checkbox"
                    value={p}
                    defaultChecked={state.config.priorities.includes(p)}
                  />
                  {p}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-slate-500">
            Disabled levels disappear from the dashboard. Existing task records
            and history remain available. L2, L2A and L2B are independent
            requirements.
          </p>
          <Button disabled={busy || !isOnline || reason.trim().length < 10}>
            Save project setup
          </Button>
        </form>
      )}
      {!admin && !reports && (
        <section className="rounded-xl border bg-white p-5 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <h3 className="font-semibold">Asset register</h3>
            {canEdit && (
              <Button
                variant="outline"
                onClick={() => {
                  setAsset({
                    id: "",
                    name: "",
                    equipmentType: "",
                    location: "",
                    levels: [...state.config.levels],
                  });
                  setSchedule(null);
                }}
              >
                Add asset / group
              </Button>
            )}
          </div>
          <Input
            aria-label="Search asset register"
            value={assetQuery}
            onChange={(e) => setAssetQuery(e.target.value)}
            placeholder="Find asset, group or equipment type"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr>
                  {[
                    "Asset tag",
                    "Equipment type",
                    "Levels",
                    "Delivery",
                    "Linked tasks",
                    "",
                  ].map((h, i) => (
                    <th key={i} className="p-2 text-xs text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assetRows.slice(0, 100).map((a) => {
                  const delivery = state.schedule.find(
                    (s) => s.activityId === a.deliveryActivityId,
                  );
                  return (
                    <tr className="border-t" key={a.id}>
                      <td className="p-2 font-medium">
                        {a.id}
                        <span className="block text-xs font-normal text-slate-500">
                          {a.name}
                        </span>
                      </td>
                      <td className="p-2">{a.equipmentType}</td>
                      <td className="p-2 text-xs">
                        {a.levels.join(", ") || "No levels"}
                      </td>
                      <td className="p-2 text-xs">
                        {delivery?.actualFinish
                          ? `Delivered ${delivery.actualFinish}`
                          : delivery?.finish
                            ? `${delivery.finish}${delivery.finish < projectDate() ? " · Late" : ""}`
                            : "No delivery schedule"}
                        {a.expectedDelivery && (
                          <span className="block text-slate-500">
                            Expected {a.expectedDelivery}
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        {
                          tasks.filter(
                            (t) =>
                              t.projectId === project.id &&
                              t.cx?.assetId === a.id,
                          ).length
                        }
                      </td>
                      <td className="p-2">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAsset(a);
                              setSchedule(null);
                            }}
                          >
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Showing {Math.min(assetRows.length, 100)} of {assetRows.length}.
            Search to narrow the list. An expected delivery date does not revise
            the linked programme.
          </p>
        </section>
      )}
      {canEdit && !reports && !admin && (
        <section className="rounded-xl border bg-white p-5 space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSchedule({ activityId: "", name: "" });
                setAsset(null);
              }}
            >
              Add schedule activity
            </Button>
            <label className="text-sm">
              Edit schedule activity
              <select
                className="field-select mt-1"
                value={schedule?.activityId ?? ""}
                onChange={(e) => {
                  setSchedule(
                    state.schedule.find(
                      (s) => s.activityId === e.target.value,
                    ) ?? null,
                  );
                  setAsset(null);
                }}
              >
                <option value="">Select Activity ID</option>
                {state.schedule.map((s) => (
                  <option key={s.activityId} value={s.activityId}>
                    {s.activityId} · {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            Import asset / P6 register (JSON)
            <Input
              className="mt-2"
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 8 * 1024 * 1024)
                    throw new Error("Maximum file size is 8 MB.");
                  await stage(
                    registerImportSchema.parse(JSON.parse(await file.text())),
                  );
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Invalid file",
                  );
                }
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-xs text-slate-500">
            Import uses asset tags and P6 Activity IDs to update existing
            records. Review the preview before saving. Ask your planner for a
            register export in the supported format.
          </p>
        </section>
      )}
      {canEdit && !reports && !admin && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={busy || !isOnline || reason.trim().length < 10}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await mutate<{
                  created: number;
                  remaining: number;
                }>(`/api/projects/${project.id}/commissioning`, {
                  method: "PATCH",
                  body: JSON.stringify({
                    action: "generate-tags",
                    version: state.version,
                    reason,
                  }),
                });
                toast.success(
                  `${result.created} tag activities created${result.remaining ? `; ${result.remaining} remaining — repeat to continue` : ""}`,
                );
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : "Generation failed",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Create missing tag activities
          </Button>
          <p className="text-xs text-slate-500">
            One unassigned task per applicable asset and level. Existing tags
            are preserved.
          </p>
        </div>
      )}
      {asset && canEdit && (
        <form
          key={asset.id}
          onSubmit={assetForm}
          className="rounded-xl border bg-white p-5 space-y-3"
        >
          <h3 className="font-semibold">
            {asset.id ? "Edit asset" : "New asset / group"}
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {["id", "name", "equipmentType", "location"].map((k) => (
              <label key={k} className="text-sm">
                {
                  {
                    id: "Asset tag / group ID",
                    name: "Name",
                    equipmentType: "Equipment type",
                    location: "Location",
                  }[k]
                }
                <Input
                  name={k}
                  defaultValue={String(asset[k as keyof Asset] ?? "")}
                  required={k !== "location"}
                  readOnly={k === "id" && !!asset.id}
                />
              </label>
            ))}
            <label className="text-sm">
              Delivery Activity ID
              <select
                name="deliveryActivityId"
                className="field-select"
                defaultValue={asset.deliveryActivityId ?? ""}
              >
                <option value="">No link</option>
                {state.schedule.map((s) => (
                  <option key={s.activityId}>{s.activityId}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Expected delivery
              <Input
                name="expectedDelivery"
                type="date"
                defaultValue={asset.expectedDelivery}
              />
            </label>
          </div>
          <fieldset>
            <legend className="text-sm mb-2">Applicable levels</legend>
            <div className="flex flex-wrap gap-4">
              {[...new Set([...state.config.levels, ...asset.levels])].map(
                (l) => (
                  <label key={l} className="text-sm flex items-center gap-2">
                    <input
                      name="levels"
                      value={l}
                      type="checkbox"
                      defaultChecked={asset.levels.includes(l)}
                    />
                    {l}
                  </label>
                ),
              )}
            </div>
          </fieldset>
          <div className="grid sm:grid-cols-2 gap-3">
            {state.config.levels.map((l) => (
              <label className="text-sm" key={l}>
                {l} P6 Activity ID
                <select
                  className="field-select"
                  name={`activity-${l}`}
                  defaultValue={asset.levelActivities?.[l] ?? ""}
                >
                  <option value="">Unlinked</option>
                  {state.schedule.map((s) => (
                    <option key={s.activityId} value={s.activityId}>
                      {s.activityId}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Level links are used when generating missing tag tasks. Existing
            task links are edited in the task plan.
          </p>
          <div className="flex gap-2">
            <Button disabled={busy || !isOnline}>Preview asset change</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAsset(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {schedule && canEdit && (
        <form
          key={schedule.activityId}
          onSubmit={scheduleForm}
          className="rounded-xl border bg-white p-5 space-y-3"
        >
          <h3 className="font-semibold">
            {schedule.activityId
              ? "Revise schedule activity"
              : "New schedule activity"}
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              "activityId",
              "name",
              "start",
              "finish",
              "actualFinish",
              "progress",
            ].map((k) => (
              <label key={k} className="text-sm">
                {
                  {
                    activityId: "P6 Activity ID",
                    name: "Activity name",
                    start: "Forecast start",
                    finish: "Forecast finish",
                    actualFinish: "Actual finish",
                    progress: "Schedule progress (%)",
                  }[k]
                }
                <Input
                  name={k}
                  type={
                    k === "progress"
                      ? "number"
                      : k.toLowerCase().includes("finish") || k === "start"
                        ? "date"
                        : "text"
                  }
                  min={k === "progress" ? 0 : undefined}
                  max={k === "progress" ? 100 : undefined}
                  defaultValue={schedule[k as keyof ScheduleActivity]}
                  readOnly={k === "activityId" && !!schedule.activityId}
                  required={["activityId", "name"].includes(k)}
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Baseline finish:{" "}
            {schedule.baselineFinish ?? "Set from the first forecast"}. Actual
            finish is a schedule record; tag approval remains a separate
            activity.
          </p>
          <div className="flex gap-2">
            <Button disabled={busy || !isOnline}>
              Preview schedule change
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSchedule(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {preview && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-3">
          <h3 className="font-semibold">Import preview</h3>
          <p className="text-sm">
            {preview.assets} assets · {preview.schedule} schedule activities
            after import · {preview.changes.length} changes
          </p>
          {preview.errors.map((e, i) => (
            <p className="text-sm text-red-700" key={i}>
              {e}
            </p>
          ))}
          <ul className="text-xs max-h-48 overflow-auto space-y-1">
            {preview.changes.slice(0, 100).map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          {preview.changes.length > 100 && (
            <p className="text-xs">First 100 changes shown.</p>
          )}
          {stale && (
            <p className="text-sm text-amber-800">
              The register changed. Preview again before saving.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              disabled={
                busy ||
                !isOnline ||
                !!preview.errors.length ||
                stale ||
                !preview.changes.length ||
                reason.trim().length < 10
              }
              onClick={commit}
            >
              Apply {preview.changes.length} changes
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPayload(null);
                setPreview(null);
              }}
            >
              Discard preview
            </Button>
          </div>
        </section>
      )}
      {!admin && (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["tags", "Tag status"],
                ["equipment", "By equipment type"],
                ["trend", "Tag trend"],
                ["schedule", "P6 schedule"],
                ["tasks", "Activities & issues"],
                ["handover", "O&M & handover"],
                ["conformance", "Conformance"],
              ] as const
            )
              .filter(
                ([id]) =>
                  currentUser.role !== "worker" ||
                  ["tasks", "schedule"].includes(id),
              )
              .map(([id, title]) => (
                <Button
                  key={id}
                  variant={view === id ? "default" : "outline"}
                  onClick={() => setView(id)}
                >
                  {title}
                </Button>
              ))}
          </div>
          <CommissioningReport
            key={`${project.id}-${view}`}
            project={project}
            request={{
              view:
                currentUser.role === "worker" && view === "tags"
                  ? "tasks"
                  : view,
              title: "Commissioning report",
            }}
          />
        </section>
      )}
      {canEdit && !reports && (
        <details className="rounded-xl border bg-white p-5">
          <summary className="font-semibold cursor-pointer">
            Revision history ({state.revisions.length})
          </summary>
          <div className="mt-4 space-y-4">
            {[...state.revisions].reverse().map((r, i) => (
              <div key={i} className="border-t pt-3 text-sm">
                <p className="font-medium">
                  {r.actor} · {new Date(r.at).toLocaleString("en-GB")}
                </p>
                <p className="mt-1">{r.reason}</p>
                <details className="text-xs text-slate-500 mt-2">
                  <summary>{r.changes.length} changes</summary>
                  <ul className="mt-2 max-h-48 overflow-auto">
                    {r.changes.map((c, j) => (
                      <li key={j}>{c}</li>
                    ))}
                  </ul>
                </details>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
