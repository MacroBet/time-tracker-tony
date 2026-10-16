"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Plus, Upload } from "lucide-react";
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
  tagReviewLabels,
  type Asset,
  type ScheduleActivity,
} from "@/lib/commissioning";
import { type RegisterImport } from "@/lib/commissioning-import";
import { parseRegisterFile } from "@/lib/asset-transfer";
import { ProjectAudit } from "./ProjectAudit";
import { CommissioningReport, type ReportView } from "./CommissioningReport";
import {
  type Project,
  type User,
  projectDate,
  statusLabels,
} from "@/lib/domain";

type Preview = {
  changes: string[];
  errors: string[];
  assets: number;
  schedule: number;
  programmeId?: string;
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
            : "Assets"
      }
      subtitle={
        admin
          ? "Project setup and individual feature access."
          : reports
            ? "Project reports and commissioning records."
            : "Set up equipment, choose its tags and open each test sheet."
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
  const { mutate, isOnline, currentUser, tasks, attachments, refreshData } =
      useApp(),
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
  const [transferOpen, setTransferOpen] = useState(false),
    [reportsOpen, setReportsOpen] = useState(reports),
    [historyOpen, setHistoryOpen] = useState(false),
    [tagsAssetId, setTagsAssetId] = useState<string | null>(null),
    [generateOpen, setGenerateOpen] = useState(false);
  const editorHeading = useRef<HTMLHeadingElement>(null),
    previewHeading = useRef<HTMLHeadingElement>(null),
    transferHeading = useRef<HTMLHeadingElement>(null),
    tagsHeading = useRef<HTMLHeadingElement>(null);
  const generateDetails = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const revealImport = () => {
      if (window.location.hash === "#import-register") setTransferOpen(true);
    };
    const frame = window.requestAnimationFrame(revealImport);
    window.addEventListener("hashchange", revealImport);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", revealImport);
    };
  }, []);
  useEffect(() => {
    if (asset) {
      editorHeading.current?.scrollIntoView({ block: "start" });
      editorHeading.current?.focus({ preventScroll: true });
    }
  }, [asset]);
  useEffect(() => {
    if (preview) {
      previewHeading.current?.scrollIntoView({ block: "start" });
      previewHeading.current?.focus({ preventScroll: true });
    }
  }, [preview]);
  useEffect(() => {
    if (transferOpen) {
      transferHeading.current?.scrollIntoView({ block: "start" });
      transferHeading.current?.focus({ preventScroll: true });
    }
  }, [transferOpen]);
  useEffect(() => {
    if (tagsAssetId) {
      tagsHeading.current?.scrollIntoView({ block: "start" });
      tagsHeading.current?.focus({ preventScroll: true });
    }
  }, [tagsAssetId]);
  useEffect(() => {
    if (generateOpen) {
      generateDetails.current?.scrollIntoView({ block: "start" });
      generateDetails.current
        ?.querySelector("textarea")
        ?.focus({ preventScroll: true });
    }
  }, [generateOpen]);
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
    setBusy(true);
    try {
      const result = await run({
        action: "import",
        data,
        preview: true,
        reason:
          reason.trim().length >= 10
            ? reason
            : "Preview only — no saved change",
      });
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
      if (payload.assets.length === 1) setTagsAssetId(payload.assets[0].id);
      setReason("");
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
      setReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  function assetForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const assetId = String(f.get("id") ?? "").trim();
    if (!asset?.id && state.assets.some((row) => row.id === assetId)) {
      toast.error(
        "An asset with this ID already exists. Open it to edit or choose another ID.",
      );
      return;
    }
    void stage({
      assets: [
        {
          ...asset,
          id: assetId,
          clientAssetId: String(f.get("clientAssetId") || "").trim(),
          programmeActivityId: String(
            f.get("programmeActivityId") || "",
          ).trim(),
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
      `${a.id} ${a.clientAssetId ?? ""} ${state.programmeId ?? ""} ${a.programmeActivityId ?? ""} ${a.name} ${a.equipmentType} ${a.location} ${a.phase ?? ""} ${a.floor ?? ""} ${a.area ?? ""} ${a.discipline ?? ""} ${a.parentAssetId ?? ""} ${a.serialNumber ?? ""} ${a.owner ?? ""} ${a.deliveryActivityId ?? ""}`
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
  const inspectedAsset = state.assets.find((row) => row.id === tagsAssetId);
  const projectTasks = tasks.filter((task) => task.projectId === project.id);
  function clearPreview() {
    setPayload(null);
    setPreview(null);
    setPreviewVersion(null);
  }
  function openAsset(row: Asset | null) {
    clearPreview();
    setAsset(row);
    setSchedule(null);
  }
  function openSchedule(row: ScheduleActivity | null) {
    clearPreview();
    setSchedule(row);
    setAsset(null);
  }
  function addAsset() {
    openAsset({
      id: "",
      name: "",
      equipmentType: "",
      location: "",
      levels: [],
    });
    setTagsAssetId(null);
  }
  async function generateTags() {
    setBusy(true);
    try {
      const result = await mutate<{ created: number; remaining: number }>(
        `/api/projects/${project.id}/commissioning`,
        {
          method: "PATCH",
          body: JSON.stringify({
            action: "generate-tags",
            version: state.version,
            reason,
          }),
        },
      );
      setGenerateOpen(false);
      setReason("");
      toast.success(
        `${result.created} tag tasks created${result.remaining ? `; ${result.remaining} remaining — repeat to continue` : ""}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create tags");
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset disabled={busy} className="min-w-0 space-y-5">
      {(admin || reports) && (
        <div>
          <h2 className="text-xl font-semibold">{project.name}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {state.assets.length} assets · {state.schedule.length} schedule
            activities · Revision {state.version}
          </p>
        </div>
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
          <details className="border-t pt-4">
            <summary className="cursor-pointer text-sm font-medium">
              Phase display names & colours
            </summary>
            <fieldset className="mt-4">
              <legend className="sr-only">Phase names and colours</legend>
              <p className="text-xs text-slate-500 my-2">
                Display labels keep their stable level IDs. L2, L2A and L2B
                remain independent.
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
          </details>
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
          <RevisionReason value={reason} onChange={setReason} />
          <Button disabled={busy || !isOnline || reason.trim().length < 10}>
            Save project setup
          </Button>
        </form>
      )}
      {!admin && !reports && (state.assets.length > 0 || !asset) && (
        <section
          className="rounded-xl border bg-white p-4 sm:p-5 space-y-4"
          aria-label="Asset register"
        >
          {state.assets.length === 0 ? (
            !asset && (
              <div className="py-6 sm:py-10 max-w-xl">
                <h3 className="text-xl font-semibold">
                  Start with your first asset
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Add a piece of equipment, then choose the tags it needs. Each
                  tag has its own task, test result and supporting documents.
                </p>
                {canEdit ? (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button className="h-11" onClick={addAsset}>
                      <Plus className="size-4" />
                      Add first asset
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11"
                      onClick={() => setTransferOpen(true)}
                    >
                      <Upload className="size-4" />
                      Import assets
                    </Button>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-600">
                    Your project manager will add the equipment and required
                    tags here.
                  </p>
                )}
              </div>
            )
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Asset register</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Programme ID: {state.programmeId || "No reference"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {state.assets.length} assets · {state.schedule.length}{" "}
                    programme activities · Revision {state.version}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <Button className="h-11 sm:h-9" onClick={addAsset}>
                      <Plus className="size-4" />
                      Add asset
                    </Button>
                    <Button
                      className="h-11 sm:h-9"
                      variant="outline"
                      onClick={() => setTransferOpen(!transferOpen)}
                      aria-expanded={transferOpen}
                    >
                      Import / export
                    </Button>
                    <Button variant="link" className="h-11 sm:h-9 px-2" asChild>
                      <Link href="/schedule">Programme</Link>
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  className="h-11"
                  aria-label="Search asset register"
                  value={assetQuery}
                  onChange={(e) => {
                    setAssetQuery(e.target.value);
                    setAssetPage(0);
                  }}
                  placeholder="Search ID, equipment, location or owner"
                />
                <label className="flex items-center gap-2 text-sm">
                  Supply
                  <select
                    className="field-select min-h-11"
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
                className="hidden md:block overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-700"
                role="region"
                aria-label="Scrollable asset register"
                tabIndex={0}
              >
                <table className="w-full min-w-[900px] text-sm text-left tabular-nums">
                  <caption className="sr-only">
                    Asset register. Open an asset to review required tags, test
                    sheets and equipment details.
                  </caption>
                  <thead>
                    <tr>
                      {[
                        "Asset",
                        "Equipment / location",
                        "Programme Activity ID",
                        "Tags",
                        "Delivery",
                        "Supply",
                        "",
                      ].map((heading, index) => (
                        <th
                          scope="col"
                          className="p-3 text-xs text-slate-600"
                          key={index}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assetRows.slice(page * 50, (page + 1) * 50).map((row) => {
                      const linked = projectTasks.filter(
                        (task) => task.cx?.assetId === row.id,
                      );
                      const delivery = state.schedule.find(
                        (activity) =>
                          activity.activityId === row.deliveryActivityId,
                      );
                      return (
                        <tr
                          key={row.id}
                          className="border-t align-top hover:bg-slate-50"
                        >
                          <td className="p-3">
                            <button
                              className="text-left font-semibold text-blue-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
                              onClick={() => setTagsAssetId(row.id)}
                            >
                              {row.id}
                            </button>
                            <span className="mt-1 block text-xs text-slate-600">
                              {row.name}
                            </span>
                            <span className="mt-1 block text-xs text-slate-600">
                              Client ID: {row.clientAssetId || "No reference"}
                            </span>
                          </td>
                          <td className="p-3">
                            {row.equipmentType}
                            <span className="mt-1 block text-xs text-slate-600">
                              {assetLocationLabel(row) || "Location not set"}
                            </span>
                          </td>
                          <td className="p-3 text-xs">
                            {row.programmeActivityId || "No reference"}
                          </td>
                          <td className="p-3">
                            <button
                              className="text-left text-blue-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
                              onClick={() => setTagsAssetId(row.id)}
                            >
                              {row.levels.length
                                ? row.levels.join(", ")
                                : "Choose tags"}
                            </button>
                            <span className="mt-1 block text-xs text-slate-600">
                              {
                                linked.filter((task) => task.cx?.kind === "tag")
                                  .length
                              }{" "}
                              tag tasks created
                            </span>
                          </td>
                          <td className="p-3 text-xs">
                            {delivery?.actualFinish
                              ? `Delivered ${delivery.actualFinish}`
                              : delivery?.finish
                                ? `${delivery.finish}${delivery.finish < projectDate() ? " · Late" : ""}`
                                : "Not scheduled"}
                            {row.expectedDelivery && (
                              <span className="mt-1 block text-slate-600">
                                Expected {row.expectedDelivery}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-xs">
                            {row.clientSupplied == null
                              ? "Not classified"
                              : row.clientSupplied
                                ? "Client supplied"
                                : "Contractor supplied"}
                          </td>
                          <td className="p-2">
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openAsset(row)}
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
              <div className="md:hidden divide-y divide-slate-200">
                {assetRows.slice(page * 50, (page + 1) * 50).map((row) => (
                  <article key={row.id} className="py-4 first:pt-0 space-y-3">
                    <div>
                      <p className="font-semibold break-words">{row.id}</p>
                      <p className="text-sm text-slate-700 mt-1">{row.name}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {[row.equipmentType, assetLocationLabel(row)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <div>
                          <dt className="text-slate-600">Client asset ID</dt>
                          <dd className="mt-1 break-words">
                            {row.clientAssetId || "No reference"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-600">
                            Programme Activity ID
                          </dt>
                          <dd className="mt-1 break-words">
                            {row.programmeActivityId || "No reference"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <p className="text-xs text-slate-600">
                      Required tags: {row.levels.join(", ") || "Not selected"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="h-11"
                        variant="outline"
                        onClick={() => setTagsAssetId(row.id)}
                      >
                        Tags & test sheets
                        <ArrowRight className="size-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          className="h-11"
                          variant="ghost"
                          onClick={() => openAsset(row)}
                        >
                          Edit asset
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {!assetRows.length && (
                <p className="py-6 text-center text-sm text-slate-600">
                  No assets match these filters. Try another search or supply
                  filter.
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-slate-600">
                <p>
                  {assetRows.length
                    ? `${page * 50 + 1}–${Math.min((page + 1) * 50, assetRows.length)}`
                    : "0"}{" "}
                  of {assetRows.length} assets
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
            </>
          )}
        </section>
      )}
      {inspectedAsset && !admin && !reports && (
        <section
          className="rounded-xl border bg-white p-4 sm:p-5 space-y-4"
          aria-label="Asset tags and test sheets"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3
                ref={tagsHeading}
                tabIndex={-1}
                className="font-semibold focus:outline-none scroll-mt-52"
              >
                {inspectedAsset.id} · Tags & test sheets
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {inspectedAsset.name}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setTagsAssetId(null)}
            >
              Close
            </Button>
          </div>
          <p className="text-sm text-slate-600">
            Each required tag has its own status and test record. Test results
            and tag approval are recorded separately.
          </p>
          <ul className="divide-y divide-slate-200">
            {inspectedAsset.levels.map((level) => {
              const task = projectTasks.find(
                (item) =>
                  item.cx?.kind === "tag" &&
                  item.cx.assetId === inspectedAsset.id &&
                  item.cx.level === level,
              );
              const enabled = state.config.levels.includes(level);
              return (
                <li
                  className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  key={level}
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {level}
                      {state.config.phasePresentation?.[level]?.label &&
                      state.config.phasePresentation[level]?.label !== level
                        ? ` · ${state.config.phasePresentation[level]?.label}`
                        : ""}
                      {!enabled && (
                        <span className="ml-2 font-normal text-slate-600">
                          Not active in project
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {task
                        ? `${statusLabels[task.status]} · Test: ${task.cx?.result ?? "untested"}`
                        : "Tag task not created yet"}
                    </p>
                    {task && (
                      <p className="mt-1 text-xs text-slate-600">
                        Review:{" "}
                        {task.cx?.tagReview
                          ? tagReviewLabels[task.cx.tagReview]
                          : "Not recorded"}{" "}
                        ·{" "}
                        {
                          attachments.filter((file) => file.taskId === task.id)
                            .length
                        }{" "}
                        supporting files
                      </p>
                    )}
                  </div>
                  {task && (
                    <Button
                      variant="outline"
                      className="h-11 self-start shrink-0"
                      asChild
                    >
                      <Link href={`/tasks/${task.id}#test-sheet`}>
                        <FileText className="size-4" />
                        Open test sheet
                      </Link>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {!inspectedAsset.levels.length && (
            <p className="text-sm text-slate-600">
              No tags selected. Edit this asset and tick the tags it requires.
            </p>
          )}
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="h-11"
                onClick={() => openAsset(inspectedAsset)}
              >
                Edit asset & required tags
              </Button>
              {inspectedAsset.levels.some(
                (level) =>
                  state.config.levels.includes(level) &&
                  !projectTasks.some(
                    (task) =>
                      task.cx?.kind === "tag" &&
                      task.cx.assetId === inspectedAsset.id &&
                      task.cx.level === level,
                  ),
              ) && (
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => setGenerateOpen(true)}
                >
                  Create missing tag tasks
                </Button>
              )}
            </div>
          )}
          <details className="border-t pt-3">
            <summary className="cursor-pointer text-sm font-medium">
              Equipment details & linked tasks
            </summary>
            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {[
                ["Internal ID", inspectedAsset.id],
                ["Client asset ID", inspectedAsset.clientAssetId],
                ["Programme ID", state.programmeId],
                ["Programme Activity ID", inspectedAsset.programmeActivityId],
                ["Equipment", inspectedAsset.equipmentType],
                ["Location", inspectedAsset.location],
                ["Phase", inspectedAsset.phase],
                ["Floor", inspectedAsset.floor],
                ["Area", inspectedAsset.area],
                ["Discipline", inspectedAsset.discipline],
                ["Parent asset", inspectedAsset.parentAssetId],
                ["Serial number", inspectedAsset.serialNumber],
                ["Owner", inspectedAsset.owner],
                ["Delivery Activity ID", inspectedAsset.deliveryActivityId],
                [
                  "Supply",
                  inspectedAsset.clientSupplied == null
                    ? "Not classified"
                    : inspectedAsset.clientSupplied
                      ? "Client supplied"
                      : "Contractor supplied",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-600">{label}</dt>
                  <dd className="mt-1 break-words">
                    {value ||
                      ([
                        "Client asset ID",
                        "Programme ID",
                        "Programme Activity ID",
                      ].includes(label ?? "")
                        ? "No reference"
                        : "Not recorded")}
                  </dd>
                </div>
              ))}
            </dl>
            <ul className="mt-4 space-y-2">
              {projectTasks
                .filter((task) => task.cx?.assetId === inspectedAsset.id)
                .map((task) => (
                  <li key={task.id}>
                    <Link
                      className="text-sm text-blue-700 underline underline-offset-4"
                      href={`/tasks/${task.id}`}
                    >
                      {task.title} · {statusLabels[task.status]}
                    </Link>
                  </li>
                ))}
            </ul>
          </details>
        </section>
      )}
      {canEdit &&
        !admin &&
        !reports &&
        !!(
          state.assets.length ||
          state.schedule.length ||
          state.revisions.length
        ) && (
          <details
            className="border-t border-slate-200 pt-4"
            onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
          >
            <summary className="cursor-pointer font-medium">
              Project history
            </summary>
            <div className="mt-4">
              {historyOpen && (
                <ProjectAudit
                  projectId={project.id}
                  refreshKey={state.version}
                />
              )}
            </div>
          </details>
        )}
      {canEdit && !reports && !admin && (
        <details
          id="import-register"
          open={transferOpen}
          onToggle={(event) => setTransferOpen(event.currentTarget.open)}
          className="rounded-xl border bg-white p-4 sm:p-5"
        >
          <summary className="cursor-pointer font-medium">
            Import / export assets
          </summary>
          <div className="mt-4 space-y-4">
            <h3
              ref={transferHeading}
              tabIndex={-1}
              className="text-sm font-medium focus:outline-none scroll-mt-52"
            >
              Use an existing asset register
            </h3>
            <p className="text-sm text-slate-600">
              CSV imports equipment. JSON also includes programme activities.
              You will review a preview before anything is saved.
            </p>
            <label className="block text-sm font-medium">
              Choose CSV or JSON
              <Input
                className="mt-2 h-11"
                type="file"
                accept=".json,.csv,application/json,text/csv"
                disabled={busy || !isOnline}
                onChange={async (event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  if (!file) return;
                  setBusy(true);
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
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Invalid file",
                    );
                  } finally {
                    input.value = "";
                    setBusy(false);
                  }
                }}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-11 sm:h-9"
                variant="outline"
                disabled={busy || !isOnline}
                onClick={() => void downloadRegister("csv")}
              >
                {state.assets.length
                  ? "Export assets CSV"
                  : "Download CSV template"}
              </Button>
              <Button
                className="h-11 sm:h-9"
                variant="outline"
                disabled={
                  busy ||
                  !isOnline ||
                  (!(state.assets.length + state.schedule.length) &&
                    !state.programmeId)
                }
                onClick={() => void downloadRegister("json")}
              >
                Export register JSON
              </Button>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-700">
                Supported columns & import rules
              </summary>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                CSV columns: id, clientAssetId, programmeId,
                programmeActivityId, name, equipmentType, location, phase,
                floor, area, discipline, parentAssetId, serialNumber, owner,
                clientSupplied, levels, deliveryActivityId, expectedDelivery,
                levelActivities. Separate required levels with semicolons; use
                true / false / blank for supply. Stable IDs update existing
                records. Existing baseline dates are protected. Start from the
                CSV template for the correct headers. Programme ID applies to
                this project. Programme Activity ID is a primary link to an
                existing activity in this project; delivery and individual tag
                links are separate.
              </p>
            </details>
          </div>
        </details>
      )}
      {canEdit &&
        !reports &&
        !admin &&
        state.assets.some((row) =>
          row.levels.some(
            (level) =>
              state.config.levels.includes(level) &&
              !projectTasks.some(
                (task) =>
                  task.cx?.kind === "tag" &&
                  task.cx.assetId === row.id &&
                  task.cx.level === level,
              ),
          ),
        ) && (
          <details
            ref={generateDetails}
            open={generateOpen}
            onToggle={(event) => setGenerateOpen(event.currentTarget.open)}
            className="rounded-xl border bg-white p-4 sm:p-5"
          >
            <summary className="cursor-pointer font-medium">
              Create missing tag tasks
            </summary>
            <div className="mt-4 space-y-4">
              <p className="text-sm text-slate-600">
                Create one unassigned task and test record for every required
                tag still missing across this project. Existing tags are
                preserved. Assign the new tasks in Tasks.
              </p>
              <RevisionReason value={reason} onChange={setReason} />
              <Button
                className="h-11"
                disabled={busy || !isOnline || reason.trim().length < 10}
                onClick={() => void generateTags()}
              >
                {busy ? "Creating…" : "Create missing tags for project"}
              </Button>
            </div>
          </details>
        )}
      {canEdit && !reports && !admin && !!state.schedule.length && (
        <details className="rounded-xl border bg-white p-4 sm:p-5">
          <summary className="cursor-pointer font-medium">
            Programme register · advanced
          </summary>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-600">
              Use Programme for dates, dependencies and the Gantt. This editor
              keeps direct register revisions available.
            </p>
            <Link
              href="/schedule"
              className="text-sm text-blue-700 underline underline-offset-4"
            >
              Open Programme
            </Link>
            <div className="flex flex-wrap items-end gap-3">
              <Button
                variant="outline"
                onClick={() => openSchedule({ activityId: "", name: "" })}
              >
                Add programme activity
              </Button>
              <label className="text-sm">
                Edit programme activity
                <select
                  className="field-select mt-1"
                  value={schedule?.activityId ?? ""}
                  onChange={(event) => {
                    openSchedule(
                      state.schedule.find(
                        (activity) =>
                          activity.activityId === event.target.value,
                      ) ?? null,
                    );
                  }}
                >
                  <option value="">Select Activity ID</option>
                  {state.schedule.map((activity) => (
                    <option
                      key={activity.activityId}
                      value={activity.activityId}
                    >
                      {activity.activityId} · {activity.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </details>
      )}
      {asset && canEdit && (
        <form
          key={asset.id}
          onSubmit={assetForm}
          onChange={() => {
            if (preview) {
              setPreview(null);
              setPayload(null);
            }
          }}
          className="rounded-xl border bg-white p-4 sm:p-5 space-y-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3
                ref={editorHeading}
                tabIndex={-1}
                className="text-lg font-semibold focus:outline-none scroll-mt-52"
              >
                {asset.id ? `Edit ${asset.id}` : "Add an asset"}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Enter equipment details and tick the tags this asset needs.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => openAsset(null)}
            >
              Cancel
            </Button>
          </div>
          <fieldset disabled={busy} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["id", "Internal ID"],
                ["name", "Asset name"],
                ["equipmentType", "Equipment type"],
                ["location", "Location"],
              ].map(([key, label]) => (
                <label className="text-sm font-medium" key={key}>
                  {label}
                  <Input
                    className="mt-1 h-11"
                    name={key}
                    defaultValue={String(asset[key as keyof Asset] ?? "")}
                    required={key !== "location"}
                    maxLength={key === "location" ? 250 : 150}
                    readOnly={key === "id" && !!asset.id}
                    autoComplete="off"
                  />
                  {key === "id" && (
                    <span className="mt-1 block text-xs font-normal text-slate-600">
                      {asset.id
                        ? "Stable ID: existing links keep this reference."
                        : "Choose a stable ID for links inside this app. Client and programme references are separate."}
                    </span>
                  )}
                </label>
              ))}
            </div>
            <fieldset className="border-t pt-4 space-y-4">
              <legend className="text-sm font-semibold">
                Client & programme references
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Client asset ID{" "}
                  <span className="font-normal text-slate-600">· optional</span>
                  <Input
                    name="clientAssetId"
                    className="mt-1 h-11"
                    maxLength={150}
                    defaultValue={asset.clientAssetId ?? ""}
                    placeholder="No reference"
                  />
                </label>
                <label className="text-sm font-medium">
                  Programme ID
                  <Input
                    className="mt-1 h-11"
                    value={state.programmeId ?? ""}
                    readOnly
                    placeholder="No reference"
                  />
                  <Link
                    className="mt-1 inline-flex min-h-11 items-center text-xs font-normal text-blue-700 underline underline-offset-4"
                    href="/schedule"
                  >
                    Manage the project’s programme reference
                  </Link>
                </label>
                <label className="text-sm font-medium sm:col-span-2">
                  Programme Activity ID{" "}
                  <span className="font-normal text-slate-600">· optional</span>
                  <select
                    name="programmeActivityId"
                    className="field-select mt-1 min-h-11"
                    defaultValue={asset.programmeActivityId ?? ""}
                  >
                    <option value="">No reference</option>
                    {state.schedule.map((activity) => (
                      <option
                        key={activity.activityId}
                        value={activity.activityId}
                      >
                        {activity.activityId} · {activity.name}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs font-normal text-slate-600">
                    Primary programme reference for this asset. Delivery and
                    individual tag links are configured separately below.
                  </span>
                </label>
              </div>
            </fieldset>
            <fieldset className="border-t pt-4">
              <legend className="text-sm font-semibold">Required tags</legend>
              <p className="mb-3 mt-1 text-sm text-slate-600">
                Select only the tags that apply to this asset. Each selected
                level gets its own task and test record.
              </p>
              {asset.id && (
                <p className="mb-3 text-xs text-slate-600">
                  Tags already linked to tasks are retained to preserve their
                  records.
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {[...new Set([...state.config.levels, ...asset.levels])].map(
                  (level) => (
                    <label
                      key={level}
                      className="flex min-h-11 items-center gap-3 rounded-md border border-slate-200 p-3 text-sm"
                    >
                      <input
                        name="levels"
                        value={level}
                        type="checkbox"
                        className="size-4 accent-blue-600"
                        defaultChecked={asset.levels.includes(level)}
                      />
                      <span>
                        <span className="font-medium">{level}</span>
                        {state.config.phasePresentation?.[level]?.label &&
                        state.config.phasePresentation[level]?.label !== level
                          ? ` · ${state.config.phasePresentation[level]?.label}`
                          : ""}
                      </span>
                    </label>
                  ),
                )}
              </div>
              {!state.config.levels.length && (
                <p className="text-sm text-amber-800">
                  No tag levels are enabled for this project.{" "}
                  {currentUser.role === "admin" ? (
                    <Link
                      href="/admin"
                      className="underline underline-offset-4"
                    >
                      Enable levels in Project setup.
                    </Link>
                  ) : (
                    "Ask your administrator to enable levels in Project setup."
                  )}
                </p>
              )}
            </fieldset>
            <details className="border-t pt-4">
              <summary className="cursor-pointer text-sm font-medium">
                Location, supply & equipment details · optional
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {[
                  ["phase", "Project phase"],
                  ["floor", "Floor"],
                  ["area", "Area"],
                  ["discipline", "Discipline"],
                  ["serialNumber", "Serial number"],
                  ["owner", "Owner / responsible person"],
                ].map(([key, label]) => (
                  <label className="text-sm" key={key}>
                    {label}
                    <Input
                      name={key}
                      className="mt-1 h-11"
                      defaultValue={String(asset[key as keyof Asset] ?? "")}
                      maxLength={150}
                    />
                  </label>
                ))}
                <label className="text-sm">
                  Parent asset
                  <select
                    name="parentAssetId"
                    className="field-select min-h-11 mt-1"
                    defaultValue={asset.parentAssetId ?? ""}
                  >
                    <option value="">No parent</option>
                    {state.assets
                      .filter((row) => row.id !== asset.id)
                      .map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.id} · {row.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-sm">
                  Supply classification
                  <select
                    name="clientSupplied"
                    className="field-select min-h-11 mt-1"
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
              </div>
            </details>
            <details className="border-t pt-4">
              <summary className="cursor-pointer text-sm font-medium">
                Delivery & programme links · optional
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  Delivery Activity ID
                  <select
                    name="deliveryActivityId"
                    className="field-select min-h-11 mt-1"
                    defaultValue={asset.deliveryActivityId ?? ""}
                  >
                    <option value="">No link</option>
                    {state.schedule.map((activity) => (
                      <option
                        key={activity.activityId}
                        value={activity.activityId}
                      >
                        {activity.activityId} · {activity.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Expected delivery
                  <Input
                    name="expectedDelivery"
                    className="mt-1 h-11"
                    type="date"
                    defaultValue={asset.expectedDelivery}
                  />
                </label>
                {[...new Set([...state.config.levels, ...asset.levels])].map(
                  (level) => (
                    <label className="text-sm" key={level}>
                      {level} programme activity
                      <select
                        name={`activity-${level}`}
                        className="field-select min-h-11 mt-1"
                        defaultValue={asset.levelActivities?.[level] ?? ""}
                      >
                        <option value="">Unlinked</option>
                        {state.schedule.map((activity) => (
                          <option
                            key={activity.activityId}
                            value={activity.activityId}
                          >
                            {activity.activityId} · {activity.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ),
                )}
              </div>
              <p className="mt-3 text-xs text-slate-600">
                Expected delivery does not change the programme. Level links are
                used when creating missing tags; existing task links are edited
                in Tasks.
              </p>
            </details>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="h-11" disabled={busy || !isOnline}>
                {busy ? "Preparing preview…" : "Review asset & tags"}
                <ArrowRight className="size-4" />
              </Button>
              <Button
                type="button"
                className="h-11"
                variant="ghost"
                onClick={() => openAsset(null)}
              >
                Cancel
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {schedule && canEdit && (
        <form
          key={schedule.activityId}
          onSubmit={scheduleForm}
          onChange={() => {
            if (preview) {
              setPreview(null);
              setPayload(null);
            }
          }}
          className="rounded-xl border bg-white p-5 space-y-3"
        >
          <h3 className="font-semibold">
            {schedule.activityId
              ? "Revise programme activity"
              : "New programme activity"}
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
                    activityId: "Programme Activity ID",
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
              Review programme change
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => openSchedule(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {preview && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-3">
          <h3
            ref={previewHeading}
            tabIndex={-1}
            className="font-semibold focus:outline-none scroll-mt-52"
          >
            Review changes before saving
          </h3>
          <p className="text-sm">
            {preview.assets} assets · {preview.schedule} schedule activities
            after import · {preview.changes.length} changes
          </p>
          <p className="text-sm">
            Programme ID after this change:{" "}
            {preview.programmeId || "No reference"}
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
          <RevisionReason value={reason} onChange={setReason} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="h-11"
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
              Save {preview.changes.length} changes
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
      {!admin &&
        (reports || state.assets.length > 0 || state.schedule.length > 0) && (
          <details
            open={reports || reportsOpen}
            onToggle={(event) => setReportsOpen(event.currentTarget.open)}
            className="border-t border-slate-200 pt-4"
          >
            <summary className="cursor-pointer font-medium">
              Commissioning reports
            </summary>
            {(reports || reportsOpen) && (
              <section className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["tags", "Tag status"],
                      ["equipment", "By equipment type"],
                      ["trend", "Tag trend"],
                      ["schedule", "Programme"],
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
          </details>
        )}
      {canEdit && !reports && admin && (
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
    </fieldset>
  );
}

function RevisionReason({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      Reason for this change
      <Textarea
        className="mt-2 min-h-16"
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        minLength={10}
        maxLength={1000}
        required
        placeholder="What changed, and why?"
      />
      <span className="mt-1 block text-xs font-normal text-slate-600">
        At least 10 characters. Saved with your name in project history.
      </span>
    </label>
  );
}

function assetLocationLabel(asset: Asset) {
  const parts = [asset.location.trim()].filter(Boolean);
  const normalise = (value: string) =>
    value.toLowerCase().replace(/\s+/g, " ").trim();
  for (const value of [asset.floor, asset.area]) {
    const text = value?.trim();
    if (text && !normalise(parts.join(" · ")).includes(normalise(text)))
      parts.push(text);
  }
  return parts.join(" · ");
}
