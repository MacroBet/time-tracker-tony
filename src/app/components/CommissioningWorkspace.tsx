"use client";
import { useState } from "react";
import Link from "next/link";
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
import { type RegisterImport } from "@/lib/commissioning-import";
import { parseRegisterFile } from "@/lib/asset-transfer";
import { ProjectAudit } from "./ProjectAudit";
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
  const { mutate, isOnline, currentUser, tasks, refreshData } = useApp(),
    state = commissioning(project);
  const [view, setView] = useState<ReportView>("tags"),
    [asset, setAsset] = useState<Asset | null>(null),
    [schedule, setSchedule] = useState<ScheduleActivity | null>(null);
  const [payload, setPayload] = useState<RegisterImport | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [previewVersion, setPreviewVersion] = useState<number | null>(null),
    [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false),
    [assetQuery, setAssetQuery] = useState(""),
    [supplyFilter, setSupplyFilter] = useState("all"),
    [assetPage, setAssetPage] = useState(0);
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
          ...state.config,
          levels: f.getAll("levels"),
          priorities: f.getAll("priorities"),
          projectType: String(f.get("projectType") || "").trim() || undefined,
          location: String(f.get("projectLocation") || "").trim() || undefined,
          capacityMw: f.get("capacityMw")
            ? Number(f.get("capacityMw"))
            : undefined,
          phasePresentation: Object.fromEntries(
            LEVELS.map((level) => [
              level,
              {
                label: String(f.get(`label-${level}`) || level),
                color: String(f.get(`color-${level}`) || "#2563eb"),
              },
            ]),
          ),
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
          ...asset,
          id: String(f.get("id")),
          name: String(f.get("name")),
          equipmentType: String(f.get("equipmentType")),
          location: String(f.get("location")),
          phase: String(f.get("phase") || ""),
          floor: String(f.get("floor") || ""),
          area: String(f.get("area") || ""),
          clientSupplied:
            f.get("clientSupplied") === ""
              ? null
              : f.get("clientSupplied") === "true",
          discipline: String(f.get("discipline") || ""),
          parentAssetId: String(f.get("parentAssetId") || ""),
          serialNumber: String(f.get("serialNumber") || ""),
          owner: String(f.get("owner") || ""),
          levels: f.getAll("levels") as Asset["levels"],
          deliveryActivityId:
            String(f.get("deliveryActivityId") || "") || undefined,
          expectedDelivery:
            String(f.get("expectedDelivery") || "") || undefined,
          levelActivities: Object.fromEntries(
            [
              ...new Set([...state.config.levels, ...(asset?.levels ?? [])]),
            ].flatMap((l) =>
              f.getAll("levels").includes(l) && f.get(`activity-${l}`)
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
  async function downloadRegister(format: "json" | "csv") {
    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export", format }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(
          error?.error ?? "Export failed. Refresh the project and try again.",
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `asset-register-${project.id}.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${format.toUpperCase()} export downloaded`);
      void refreshData().catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }
  const assetRows = state.assets.filter(
    (a) =>
      `${a.id} ${a.name} ${a.equipmentType} ${a.location} ${a.phase ?? ""} ${a.floor ?? ""} ${a.area ?? ""} ${a.discipline ?? ""} ${a.parentAssetId ?? ""} ${a.serialNumber ?? ""} ${a.owner ?? ""} ${a.deliveryActivityId ?? ""}`
        .toLowerCase()
        .includes(assetQuery.trim().toLowerCase()) &&
      (supplyFilter === "all" ||
        (supplyFilter === "unknown"
          ? a.clientSupplied == null
          : String(a.clientSupplied) === supplyFilter)),
  );
  const page = Math.min(
    assetPage,
    Math.max(0, Math.ceil(assetRows.length / 50) - 1),
  );
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">{project.name}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {state.assets.length} assets · {state.schedule.length} schedule
          activities · Revision {state.version}
        </p>
        {!admin && !reports && (
          <Link
            href="/schedule"
            className="inline-flex mt-3 text-sm font-medium text-blue-700 underline underline-offset-4 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            Open programme Gantt
          </Link>
        )}
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
          <p className="text-sm text-slate-500">
            Configure project details and the phases used by this programme.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm">
              Project type
              <Input
                name="projectType"
                maxLength={100}
                defaultValue={state.config.projectType ?? ""}
                placeholder="e.g. Data centre"
              />
            </label>
            <label className="text-sm">
              Project location
              <Input
                name="projectLocation"
                maxLength={250}
                defaultValue={state.config.location ?? ""}
                placeholder="Site / city"
              />
            </label>
            <label className="text-sm">
              Capacity (MW)
              <Input
                name="capacityMw"
                type="number"
                min="0.001"
                max="1000000"
                step="any"
                defaultValue={state.config.capacityMw ?? ""}
                placeholder="Optional"
              />
            </label>
          </div>
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
          <fieldset className="border-t pt-4">
            <legend className="text-sm font-medium">
              Phase names and colours
            </legend>
            <p className="text-xs text-slate-500 my-2">
              Display labels keep their stable level IDs. L2, L2A and L2B remain
              independent.
            </p>
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {LEVELS.map((level) => (
                <div className="flex items-center gap-3" key={level}>
                  <label
                    htmlFor={`phase-label-${level}`}
                    className="text-sm w-10 shrink-0"
                  >
                    {level}
                  </label>
                  <Input
                    id={`phase-label-${level}`}
                    name={`label-${level}`}
                    maxLength={80}
                    required
                    defaultValue={
                      state.config.phasePresentation?.[level]?.label ?? level
                    }
                    aria-label={`${level} display label`}
                  />
                  <input
                    type="color"
                    name={`color-${level}`}
                    aria-label={`${level} colour`}
                    defaultValue={
                      state.config.phasePresentation?.[level]?.color ??
                      "#2563eb"
                    }
                    className="h-9 w-12 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-1"
                  />
                </div>
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
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !isOnline || !state.assets.length}
                    onClick={() => void downloadRegister("csv")}
                  >
                    Export assets CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      busy ||
                      !isOnline ||
                      !(state.assets.length + state.schedule.length)
                    }
                    onClick={() => void downloadRegister("json")}
                  >
                    Export register JSON
                  </Button>
                </>
              )}
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
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              className="min-w-48 flex-1"
              aria-label="Search asset register"
              value={assetQuery}
              onChange={(e) => {
                setAssetQuery(e.target.value);
                setAssetPage(0);
              }}
              placeholder="Search ID, name, equipment, location or activity"
            />
            <label className="flex items-center gap-2 text-sm">
              Supply
              <select
                className="field-select"
                value={supplyFilter}
                onChange={(e) => {
                  setSupplyFilter(e.target.value);
                  setAssetPage(0);
                }}
              >
                <option value="all">All assets</option>
                <option value="true">Client supplied</option>
                <option value="false">Contractor supplied</option>
                <option value="unknown">Not classified</option>
              </select>
            </label>
          </div>
          <div
            className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-700"
            role="region"
            aria-label="Scrollable asset register"
            tabIndex={0}
          >
            <table className="w-full min-w-[1100px] text-sm text-left tabular-nums">
              <caption className="sr-only">
                Asset register with stable asset IDs, supply classification,
                applicable phases and delivery programme links
              </caption>
              <thead>
                <tr>
                  {[
                    "Asset tag",
                    "Equipment type",
                    "Location",
                    "Discipline",
                    "Parent tag",
                    "Serial number",
                    "Owner",
                    "Supply",
                    "Levels",
                    "Delivery",
                    "Linked tasks",
                    "",
                  ].map((h, i) => (
                    <th
                      scope="col"
                      key={i}
                      className="p-2 text-xs text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assetRows.slice(page * 50, (page + 1) * 50).map((a) => {
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
                        {a.location || "—"}
                        {(a.phase || a.floor || a.area) && (
                          <span className="block text-slate-500">
                            {[
                              a.phase && `Phase ${a.phase}`,
                              a.floor && `Floor ${a.floor}`,
                              a.area && `Area ${a.area}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-xs">{a.discipline || "—"}</td>
                      <td className="p-2 text-xs">{a.parentAssetId || "—"}</td>
                      <td className="p-2 text-xs">{a.serialNumber || "—"}</td>
                      <td className="p-2 text-xs">{a.owner || "—"}</td>
                      <td className="p-2 text-xs">
                        {a.clientSupplied == null
                          ? "Not classified"
                          : a.clientSupplied
                            ? "Client supplied"
                            : "Contractor supplied"}
                      </td>
                      <td className="p-2 text-xs">
                        <div className="flex flex-wrap gap-1">
                          {a.levels.length
                            ? a.levels.map((level) => (
                                <span
                                  key={level}
                                  className="inline-flex items-center gap-1 whitespace-nowrap"
                                  title={
                                    state.config.phasePresentation?.[level]
                                      ?.label ?? level
                                  }
                                >
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    aria-hidden="true"
                                    style={{
                                      backgroundColor:
                                        state.config.phasePresentation?.[level]
                                          ?.color ?? "#2563eb",
                                    }}
                                  />
                                  {level}
                                </span>
                              ))
                            : "No levels"}
                        </div>
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
                        {a.deliveryActivityId && (
                          <span className="block text-slate-500">
                            {a.deliveryActivityId}
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
                {!assetRows.length && (
                  <tr>
                    <td colSpan={12} className="p-6 text-center text-slate-500">
                      {state.assets.length
                        ? "No assets match these filters."
                        : "No assets yet. Add an asset or import a register to start."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <p>
              {assetRows.length
                ? `${page * 50 + 1}–${Math.min((page + 1) * 50, assetRows.length)}`
                : "0"}{" "}
              of {assetRows.length} assets ·{" "}
              {state.assets.filter((a) => a.clientSupplied === true).length}{" "}
              client supplied
            </p>
            {assetRows.length > 50 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setAssetPage(page - 1)}
                >
                  Previous
                </Button>
                <span>
                  Page {page + 1} of {Math.ceil(assetRows.length / 50)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(page + 1) * 50 >= assetRows.length}
                  onClick={() => setAssetPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500">
            An expected delivery date does not revise the linked programme.
            Unclassified supply is excluded from the client-supplied group.
          </p>
        </section>
      )}
      {canEdit && !admin && !reports && (
        <ProjectAudit projectId={project.id} refreshKey={state.version} />
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
            Import asset CSV or complete register JSON
            <Input
              className="mt-2"
              type="file"
              accept=".json,.csv,application/json,text/csv"
              disabled={busy || !isOnline}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 8 * 1024 * 1024)
                    throw new Error("Maximum file size is 8 MB.");
                  await stage(
                    parseRegisterFile(
                      file.name,
                      await file.text(),
                      state.assets,
                    ),
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
            Export first to get a supported template. CSV columns: id, name,
            equipmentType, location, phase, floor, area, discipline,
            parentAssetId, serialNumber, owner, clientSupplied, levels,
            deliveryActivityId, expectedDelivery, levelActivities. Separate
            levels with semicolons; use true / false / blank for supply. JSON
            includes the programme and baseline. Stable IDs update existing
            records. Review every change before saving; existing baseline dates
            are protected.
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
            {[
              "id",
              "name",
              "equipmentType",
              "location",
              "phase",
              "floor",
              "area",
              "discipline",
              "serialNumber",
              "owner",
            ].map((k) => (
              <label key={k} className="text-sm">
                {
                  {
                    id: "Asset tag / group ID",
                    name: "Name",
                    equipmentType: "Equipment type",
                    location: "Location",
                    phase: "Project phase",
                    floor: "Floor",
                    area: "Area",
                    discipline: "Discipline",
                    serialNumber: "Serial number",
                    owner: "Owner / responsible person",
                  }[k]
                }
                <Input
                  name={k}
                  defaultValue={String(asset[k as keyof Asset] ?? "")}
                  required={["id", "name", "equipmentType"].includes(k)}
                  maxLength={k === "location" ? 250 : 150}
                  readOnly={k === "id" && !!asset.id}
                />
              </label>
            ))}
            <label className="text-sm">
              Parent asset tag
              <select
                name="parentAssetId"
                className="field-select"
                defaultValue={asset.parentAssetId ?? ""}
              >
                <option value="">No parent</option>
                {state.assets
                  .filter((parent) => parent.id !== asset.id)
                  .map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.id} · {parent.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm">
              Supply classification
              <select
                name="clientSupplied"
                className="field-select"
                defaultValue={
                  asset.clientSupplied == null
                    ? ""
                    : String(asset.clientSupplied)
                }
              >
                <option value="">Not classified</option>
                <option value="true">Client supplied</option>
                <option value="false">Contractor supplied</option>
              </select>
            </label>
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
            {[...new Set([...state.config.levels, ...asset.levels])].map(
              (l) => (
                <label className="text-sm" key={l}>
                  {l} programme Activity ID
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
              ),
            )}
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
                  defaultValue={String(
                    schedule[k as keyof ScheduleActivity] ?? "",
                  )}
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
