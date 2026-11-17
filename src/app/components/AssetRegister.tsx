"use client";
import { useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Copy,
  CopyPlus,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  commissioning,
  hasModule,
  type Asset,
  type Level,
} from "@/lib/commissioning";
import { assetFieldOptions, filterAssetRegister } from "@/lib/asset-register";
import { matchesCopilotAssetFilters } from "@/lib/copilot";
import type { Project } from "@/lib/domain";
import type { AssetTagsCommand } from "@/lib/asset-register-mutations";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { TagLevel } from "./TagLevel";
import { InfoPopover } from "./InfoPopover";

type Command =
  | { action: "asset-tags"; data: AssetTagsCommand }
  | { action: "asset-delete"; data: { assetId: string } };
type Preview = {
  changes: string[];
  errors: string[];
  references: string[];
  version: number;
  assets: number;
};
const registerColumnDefaults = {
  asset: 320,
  equipment: 200,
  area: 144,
  phase: 144,
};
type RegisterColumn = keyof typeof registerColumnDefaults;

function ColumnResizeHandle({
  label,
  width,
  minimum,
  defaultWidth,
  onChange,
}: {
  label: string;
  width: number;
  minimum: number;
  defaultWidth: number;
  onChange: (width: number) => void;
}) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const maximum = 640;
  const resize = (next: number) =>
    onChange(Math.round(Math.max(minimum, Math.min(maximum, next))));
  return (
    <span
      role="separator"
      aria-label={`Resize ${label} column`}
      aria-orientation="vertical"
      aria-valuemin={minimum}
      aria-valuemax={maximum}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels`}
      tabIndex={0}
      title="Drag to resize. Arrow keys adjust width; Home resets."
      className="absolute inset-y-0 -right-2 z-30 flex w-4 touch-none cursor-col-resize select-none items-center justify-center text-blue-700 hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        drag.current = { x: event.clientX, width };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (drag.current)
          resize(drag.current.width + event.clientX - drag.current.x);
      }}
      onPointerUp={(event) => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => (drag.current = null)}
      onLostPointerCapture={() => (drag.current = null)}
      onDoubleClick={() => resize(defaultWidth)}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        if (event.key === "Home") resize(defaultWidth);
        else if (event.key === "End") resize(maximum);
        else resize(width + (event.key === "ArrowRight" ? 16 : -16));
      }}
    >
      <span aria-hidden="true" className="h-6 border-l border-current" />
    </span>
  );
}
export function AssetRegister({
  project,
  onAdd,
  onEdit,
  onInspect,
  onImport,
  onDuplicate,
}: {
  project: Project;
  onAdd: (event: MouseEvent<HTMLButtonElement>) => void;
  onEdit: (asset: Asset) => void;
  onInspect: (id: string) => void;
  onImport: () => void;
  onDuplicate: (asset: Asset, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { currentUser, mutate, isOnline, tasks } = useApp();
  const state = commissioning(project),
    params = useSearchParams(),
    router = useRouter();
  const canEdit =
    currentUser.role !== "worker" && hasModule(currentUser, "commissioning");
  const [query, setQuery] = useState(""),
    [area, setArea] = useState("all"),
    [phase, setPhase] = useState("all"),
    [page, setPage] = useState(0);
  const [columnWidths, setColumnWidths] = useState(registerColumnDefaults);
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Level[]>>({});
  const [copied, setCopied] = useState<{
    name: string;
    levels: Level[];
    projectId: string;
  } | null>(null);
  const [command, setCommand] = useState<Command | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [dialogOpen, setDialogOpen] = useState(false);
  const linkedFilters = {
    query: params.get("query"),
    equipmentType: params.get("equipmentType"),
    location: params.get("location"),
    phase: params.get("phase"),
  };
  const linked = Object.values(linkedFilters).some(Boolean);
  const filtered = filterAssetRegister(state.assets, {
    query,
    area,
    phase,
    supply: "all",
    programmeId: state.programmeId,
  }).filter((asset) => matchesCopilotAssetFilters(asset, linkedFilters));
  const actualPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 50) - 1),
  );
  const rows = filtered.slice(actualPage * 50, (actualPage + 1) * 50);
  const levels = [
    ...new Set([
      ...state.config.levels,
      ...state.assets.flatMap((asset) => asset.levels),
    ]),
  ];
  const changes = Object.entries(drafts).filter(([id, value]) => {
    const asset = state.assets.find((row) => row.id === id);
    return (
      asset &&
      levels.some(
        (level) => asset.levels.includes(level) !== value.includes(level),
      )
    );
  });
  const selection = selected.filter((id) =>
    state.assets.some((asset) => asset.id === id),
  );
  const filtersActive = linked || query || area !== "all" || phase !== "all";
  function clearFilters() {
    setQuery("");
    setArea("all");
    setPhase("all");
    setPage(0);
    if (linked)
      router.replace(
        `/commissioning?projectId=${encodeURIComponent(project.id)}`,
      );
  }
  function toggleSelected(id: string, checked: boolean) {
    setSelected((previous) =>
      checked
        ? [...new Set([...previous, id])]
        : previous.filter((value) => value !== id),
    );
  }
  function copyTags(asset: Asset) {
    setCopied({
      name: asset.name,
      levels: [...(drafts[asset.id] ?? asset.levels)],
      projectId: project.id,
    });
    toast.success(`Tag selection copied from ${asset.name}`);
  }
  async function review(next: Command) {
    setCommand(next);
    setPreview(null);
    setReason("");
    setDialogOpen(true);
    setBusy(true);
    try {
      const result = await mutate<Preview>(
        `/api/projects/${project.id}/commissioning`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...next,
            version: state.version,
            preview: true,
            reason: "Review asset register change before saving",
          }),
        },
      );
      setPreview(result);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not prepare preview",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!command || !preview || preview.version !== state.version) return;
    setBusy(true);
    try {
      await mutate(`/api/projects/${project.id}/commissioning`, {
        method: "PATCH",
        body: JSON.stringify({ ...command, version: preview.version, reason }),
      });
      if (command.action === "asset-tags") {
        const saved = new Set(command.data.updates.map((row) => row.assetId));
        setDrafts((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([id]) => !saved.has(id)),
          ),
        );
      } else {
        const removedId = command.data.assetId;
        setSelected((current) => current.filter((id) => id !== removedId));
        setDrafts((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([id]) => id !== removedId),
          ),
        );
      }
      setDialogOpen(false);
      setCommand(null);
      setPreview(null);
      toast.success(
        command.action === "asset-delete"
          ? "Asset deleted"
          : "Required tags updated",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save. Refresh and review again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function protectedLevel(asset: Asset, level: Level) {
    return (
      asset.levels.includes(level) &&
      Boolean(
        asset.levelActivities?.[level] ||
        tasks.some(
          (task) =>
            task.projectId === project.id &&
            task.cx?.assetId === asset.id &&
            task.cx.level === level,
        ) ||
        state.checksheets?.sheets.some(
          (sheet) => sheet.assetId === asset.id && sheet.level === level,
        ),
      )
    );
  }
  function tagCheckbox(asset: Asset, level: Level) {
    const value = drafts[asset.id] ?? asset.levels;
    const locked = protectedLevel(asset, level);
    return (
      <label
        className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2"
        title={
          locked
            ? "Linked records retain this required tag"
            : `Require ${level} for ${asset.name}`
        }
      >
        <input
          type="checkbox"
          className="size-4 accent-blue-700"
          checked={value.includes(level)}
          aria-label={`${level} required for ${asset.name}`}
          disabled={
            !canEdit ||
            busy ||
            !isOnline ||
            locked ||
            (!state.config.levels.includes(level) &&
              !asset.levels.includes(level))
          }
          onChange={(event) =>
            setDrafts((previous) => ({
              ...previous,
              [asset.id]: event.target.checked
                ? [...value, level]
                : value.filter((item) => item !== level),
            }))
          }
        />
      </label>
    );
  }
  function fieldFilter(field: "area" | "phase") {
    const value = field === "area" ? area : phase,
      set = field === "area" ? setArea : setPhase;
    return (
      <select
        className="field-select mt-1 min-h-11 min-w-28 w-full text-sm font-normal"
        aria-label={`Filter by ${field}`}
        value={value}
        onChange={(event) => {
          set(event.target.value);
          setPage(0);
        }}
      >
        <option value="all">All {field === "area" ? "areas" : "phases"}</option>
        <option value="missing">Not recorded</option>
        {assetFieldOptions(state.assets, field).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  function actions(asset: Asset) {
    return (
      canEdit && (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            className="size-11"
            size="icon"
            variant="ghost"
            aria-label={`Edit ${asset.name}`}
            title="Edit asset"
            onClick={() => onEdit(asset)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            className="size-11"
            size="icon"
            variant="ghost"
            aria-label={`Copy tags from ${asset.name}`}
            title="Copy tag selection"
            onClick={() => copyTags(asset)}
          >
            <Copy className="size-4" />
          </Button>
          <Button
            className="size-11"
            size="icon"
            variant="ghost"
            aria-label={`Duplicate ${asset.name}`}
            title="Duplicate asset"
            onClick={(event) => onDuplicate(asset, event)}
          >
            <CopyPlus className="size-4" />
          </Button>
          <Button
            className="size-11 text-red-700 hover:text-red-800"
            size="icon"
            variant="ghost"
            aria-label={`Delete ${asset.name}`}
            title="Delete asset"
            onClick={() =>
              void review({
                action: "asset-delete",
                data: { assetId: asset.id },
              })
            }
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      )
    );
  }
  function dragHandle(asset: Asset) {
    return (
      canEdit && (
        <span
          draggable
          onDragStart={(event) => {
            copyTags(asset);
            event.dataTransfer.setData(
              "application/x-fieldtrack-tags",
              JSON.stringify({
                projectId: project.id,
                levels: drafts[asset.id] ?? asset.levels,
              }),
            );
            event.dataTransfer.effectAllowed = "copy";
          }}
          className="hidden cursor-grab text-slate-500 md:inline-flex"
          title="Drag tag selection to another asset"
        >
          <GripVertical className="size-4" />
        </span>
      )
    );
  }
  function resizeHandle(
    column: RegisterColumn,
    label: string,
    minimum: number,
  ) {
    return (
      <ColumnResizeHandle
        label={label}
        width={columnWidths[column]}
        minimum={minimum}
        defaultWidth={registerColumnDefaults[column]}
        onChange={(width) =>
          setColumnWidths((current) => ({ ...current, [column]: width }))
        }
      />
    );
  }
  return (
    <section
      className="min-w-0 rounded-xl border bg-white p-3 sm:p-4 space-y-3"
      aria-label="Asset register"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1">
            <h2 className="text-lg font-semibold">Asset register</h2>
            <InfoPopover label="About required tag selection">
              <p>Checkboxes choose required tags. Review before saving.</p>
              <p>
                Copy tags from an asset, select targets, then paste. You can
                also drag the grip to one asset.
              </p>
              <p>
                Linked tags cannot be removed. Test results, approvals and
                signatures stay with their original records.
              </p>
            </InfoPopover>
          </div>
          <p className="text-sm text-slate-600">
            {state.assets.length.toLocaleString()} assets · Revision{" "}
            {state.version}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <>
              <Button className="min-h-11" onClick={onAdd}>
                <Plus className="size-4" />
                Add asset
              </Button>
              <Button className="min-h-11" variant="outline" onClick={onImport}>
                <Upload className="size-4" />
                Import / export
              </Button>
            </>
          )}
          {!hasModule(currentUser, "reports") && (
            <Button className="min-h-11" variant="outline" asChild>
              <Link
                href={`/commissioning?view=status&projectId=${encodeURIComponent(project.id)}`}
              >
                Equipment status
              </Link>
            </Button>
          )}
        </div>
      </div>
      {linked && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 bg-blue-50 p-2 text-sm text-blue-900"
          role="status"
        >
          <p>
            Assistant filters:{" "}
            {Object.entries(linkedFilters)
              .filter(([, value]) => value)
              .map(([name, value]) => `${name}: ${value}`)
              .join(" · ")}
          </p>
          <Button variant="ghost" className="min-h-11" onClick={clearFilters}>
            Clear assistant filters
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <p>
          {filtered.length.toLocaleString()} matching assets
          {selection.length
            ? ` · ${selection.length} selected across all pages`
            : ""}
        </p>
        {filtersActive && (
          <Button
            variant="link"
            className="min-h-11 px-0"
            onClick={clearFilters}
          >
            Clear filters
          </Button>
        )}
      </div>
      {canEdit && Boolean(changes.length || copied || selection.length) && (
        <div
          className="flex flex-wrap items-center gap-2 border-y py-2 text-sm"
          aria-label="Tag configuration actions"
        >
          {!!changes.length && (
            <Button
              variant="outline"
              className="min-h-11"
              disabled={busy || !isOnline}
              onClick={() =>
                void review({
                  action: "asset-tags",
                  data: {
                    updates: changes.map(([assetId, next]) => ({
                      assetId,
                      levels: next,
                    })),
                  },
                })
              }
            >
              Review tag changes{changes.length ? ` (${changes.length})` : ""}
            </Button>
          )}
          {!!changes.length && (
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setDrafts({})}
            >
              Discard tag changes
            </Button>
          )}
          {copied && !!selection.length && (
            <Button
              variant="outline"
              className="min-h-11"
              disabled={copied.projectId !== project.id || busy || !isOnline}
              onClick={() =>
                copied &&
                void review({
                  action: "asset-tags",
                  data: {
                    updates: selection.map((assetId) => ({
                      assetId,
                      levels: copied.levels,
                    })),
                  },
                })
              }
            >
              Paste tags to selected
              {selection.length ? ` (${selection.length})` : ""}
            </Button>
          )}
          {!!selection.length && (
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setSelected([])}
            >
              Clear selection
            </Button>
          )}
          {copied && (
            <span className="text-slate-600">
              Copied: {copied.name} · {copied.levels.join(", ") || "no tags"}
            </span>
          )}
        </div>
      )}
      <div className="md:hidden space-y-3">
        <Input
          aria-label="Search asset register"
          className="min-h-11"
          value={query}
          placeholder="Search assets or references"
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
        />
        <details>
          <summary className="min-h-11 cursor-pointer font-medium">
            Filters{filtersActive ? " · active" : ""}
          </summary>
          <div className="grid gap-3 sm:grid-cols-2 pb-3">
            <label className="text-sm">Area{fieldFilter("area")}</label>
            <label className="text-sm">Phase{fieldFilter("phase")}</label>
          </div>
        </details>
      </div>
      <div
        className="relative isolate hidden max-h-[70dvh] overflow-auto overscroll-contain md:block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700"
        role="region"
        aria-label="Scrollable asset register"
        tabIndex={0}
      >
        <table
          className="table-fixed text-sm text-left tabular-nums"
          style={{
            width:
              Object.values(columnWidths).reduce(
                (sum, value) => sum + value,
                0,
              ) +
              (canEdit ? 60 : 0) +
              levels.length * 80,
            minWidth: "100%",
          }}
        >
          <caption className="sr-only">
            Equipment inventory and required tag configuration. Test and
            approval status is in Reports.
          </caption>
          <colgroup>
            {canEdit && <col style={{ width: 60 }} />}
            <col style={{ width: columnWidths.asset }} />
            <col style={{ width: columnWidths.equipment }} />
            <col style={{ width: columnWidths.area }} />
            <col style={{ width: columnWidths.phase }} />
            {levels.map((level) => (
              <col key={level} style={{ width: 80 }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-50 align-top">
            <tr>
              {canEdit && (
                <th scope="col" className="p-2 w-11">
                  <label className="flex min-h-11 items-center justify-center">
                    <input
                      type="checkbox"
                      className="size-4 accent-blue-700"
                      aria-label="Select all assets on this page"
                      checked={
                        rows.length > 0 &&
                        rows.every((row) => selection.includes(row.id))
                      }
                      onChange={(event) =>
                        setSelected((previous) =>
                          event.target.checked
                            ? [
                                ...new Set([
                                  ...previous,
                                  ...rows.map((row) => row.id),
                                ]),
                              ]
                            : previous.filter(
                                (id) => !rows.some((row) => row.id === id),
                              ),
                        )
                      }
                    />
                  </label>
                </th>
              )}
              <th
                scope="col"
                className="sticky left-0 z-20 bg-slate-50 p-2 pr-4"
              >
                Asset
                <Input
                  className="mt-1 min-h-11 font-normal"
                  aria-label="Search asset register"
                  value={query}
                  placeholder="Search name or reference"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(0);
                  }}
                />
                {resizeHandle("asset", "Asset", 240)}
              </th>
              <th scope="col" className="relative p-2 pr-4">
                Equipment
                {resizeHandle("equipment", "Equipment", 144)}
              </th>
              <th scope="col" className="relative p-2 pr-4">
                Area{fieldFilter("area")}
                {resizeHandle("area", "Area", 128)}
              </th>
              <th scope="col" className="relative p-2 pr-4">
                Phase{fieldFilter("phase")}
                {resizeHandle("phase", "Phase", 128)}
              </th>
              {levels.map((level) => (
                <th key={level} scope="col" className="p-2 text-center">
                  <TagLevel
                    level={level}
                    presentation={state.config.phasePresentation}
                    compact
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((asset) => (
              <tr
                key={asset.id}
                className="border-t align-top hover:bg-slate-50"
                onDragOver={(event) => {
                  if (
                    canEdit &&
                    event.dataTransfer.types.includes(
                      "application/x-fieldtrack-tags",
                    )
                  )
                    event.preventDefault();
                }}
                onDrop={(event) => {
                  if (!canEdit) return;
                  event.preventDefault();
                  try {
                    const value = JSON.parse(
                      event.dataTransfer.getData(
                        "application/x-fieldtrack-tags",
                      ),
                    );
                    if (
                      value.projectId !== project.id ||
                      !Array.isArray(value.levels)
                    )
                      return;
                    void review({
                      action: "asset-tags",
                      data: {
                        updates: [{ assetId: asset.id, levels: value.levels }],
                      },
                    });
                  } catch {
                    toast.error(
                      "Copy tags using the row action and try again.",
                    );
                  }
                }}
              >
                {canEdit && (
                  <td className="p-2">
                    <label className="flex min-h-11 min-w-11 items-center justify-center">
                      <input
                        type="checkbox"
                        className="size-4 accent-blue-700"
                        aria-label={`Select ${asset.name}`}
                        checked={selection.includes(asset.id)}
                        onChange={(event) =>
                          toggleSelected(asset.id, event.target.checked)
                        }
                      />
                    </label>
                  </td>
                )}
                <td className="sticky left-0 z-[1] bg-white p-2">
                  <div className="flex items-start gap-1">
                    {dragHandle(asset)}
                    <button
                      className="min-h-11 break-words text-left font-semibold text-blue-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                      onClick={() => onInspect(asset.id)}
                    >
                      {asset.name}
                    </button>
                  </div>
                  {asset.clientAssetId && (
                    <p className="mt-1 break-words text-xs text-slate-600">
                      Project ref: {asset.clientAssetId}
                    </p>
                  )}
                  {actions(asset)}
                  {drafts[asset.id] &&
                    changes.some(([id]) => id === asset.id) && (
                      <p className="text-xs font-medium text-amber-800">
                        Unsaved tags
                      </p>
                    )}
                </td>
                <td className="break-words p-2">
                  {asset.equipmentType}
                  <p className="mt-1 text-xs text-slate-600">
                    {asset.location || "Location not recorded"}
                  </p>
                </td>
                <td className="break-words p-2">
                  {asset.area?.trim() || "Not recorded"}
                </td>
                <td className="break-words p-2">
                  {asset.phase?.trim() || "Not recorded"}
                </td>
                {levels.map((level) => (
                  <td key={level} className="p-1">
                    {tagCheckbox(asset, level)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden divide-y">
        {rows.map((asset) => (
          <article key={asset.id} className="py-3 space-y-2">
            <div className="flex items-start gap-2">
              {canEdit && (
                <label className="flex min-h-11 min-w-11 items-center justify-center">
                  <input
                    type="checkbox"
                    className="size-4 accent-blue-700"
                    aria-label={`Select ${asset.name}`}
                    checked={selection.includes(asset.id)}
                    onChange={(event) =>
                      toggleSelected(asset.id, event.target.checked)
                    }
                  />
                </label>
              )}
              <div className="min-w-0">
                <button
                  className="min-h-11 break-words text-left font-semibold text-blue-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  onClick={() => onInspect(asset.id)}
                >
                  {asset.name}
                </button>
                {asset.clientAssetId && (
                  <p className="text-xs text-slate-600">
                    Project ref: {asset.clientAssetId}
                  </p>
                )}
                <p className="mt-1 text-sm text-slate-600 break-words">
                  {[
                    asset.equipmentType,
                    asset.location,
                    asset.area,
                    asset.phase,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <div
              className="flex flex-wrap gap-1"
              aria-label={`Required tags for ${asset.name}`}
            >
              {levels.map((level) => (
                <div
                  key={level}
                  className="flex items-center gap-1 pr-2 text-xs"
                >
                  {tagCheckbox(asset, level)}
                  <TagLevel
                    level={level}
                    presentation={state.config.phasePresentation}
                  />
                </div>
              ))}
            </div>
            {drafts[asset.id] && changes.some(([id]) => id === asset.id) && (
              <p className="text-xs font-medium text-amber-800">Unsaved tags</p>
            )}
            {actions(asset)}
          </article>
        ))}
      </div>
      {!filtered.length && (
        <p className="py-6 text-sm text-slate-600">
          {state.assets.length
            ? "No assets match these filters."
            : "Add your first asset or import an existing register."}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm text-slate-600">
        <p>
          {filtered.length
            ? `${actualPage * 50 + 1}–${Math.min((actualPage + 1) * 50, filtered.length)}`
            : "0"}{" "}
          of {filtered.length.toLocaleString()} assets
        </p>
        {filtered.length > 50 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="min-h-11"
              variant="outline"
              disabled={actualPage === 0}
              onClick={() => setPage(actualPage - 1)}
            >
              Previous
            </Button>
            <span>
              Page {actualPage + 1} of {Math.ceil(filtered.length / 50)}
            </span>
            <Button
              className="min-h-11"
              variant="outline"
              disabled={(actualPage + 1) * 50 >= filtered.length}
              onClick={() => setPage(actualPage + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!busy) setDialogOpen(open);
        }}
      >
        <DialogContent className="!max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {command?.action === "asset-delete"
                ? "Review asset deletion"
                : "Review required tag changes"}
            </DialogTitle>
            <DialogDescription>
              {project.name} ·{" "}
              {command?.action === "asset-tags"
                ? `${command.data.updates.length} explicitly selected assets. Only required tag configuration changes.`
                : "Only an asset with no linked records can be deleted."}
            </DialogDescription>
          </DialogHeader>
          {busy && !preview && <p role="status">Preparing preview…</p>}
          {preview && (
            <>
              <p className="text-sm">
                {preview.changes.length} changes · {preview.assets} assets after
                saving
              </p>
              {preview.errors.map((error, index) => (
                <p role="alert" className="text-sm text-red-700" key={index}>
                  {error}
                </p>
              ))}
              {!!preview.references?.length && (
                <ul className="max-h-48 overflow-auto list-disc pl-5 text-sm space-y-1">
                  {preview.references.map((ref, index) => (
                    <li key={index}>{ref}</li>
                  ))}
                </ul>
              )}
              <ul className="max-h-60 overflow-auto list-disc pl-5 text-sm space-y-2">
                {preview.changes.map((change, index) => (
                  <li key={index}>{change}</li>
                ))}
              </ul>
              {preview.version !== state.version && (
                <p role="alert" className="text-sm text-amber-800">
                  The project changed. Close this preview and review again.
                </p>
              )}
              {!preview.errors.length && !!preview.changes.length && (
                <label className="text-sm font-medium">
                  Reason for this change
                  <Textarea
                    className="mt-2"
                    rows={2}
                    minLength={10}
                    maxLength={1000}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="What changed, and why?"
                  />
                  <span className="mt-1 block text-sm font-normal text-slate-600">
                    At least 10 characters, saved in project history.
                  </span>
                </label>
              )}
            </>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="min-h-11"
              variant={
                command?.action === "asset-delete" ? "destructive" : "default"
              }
              disabled={
                busy ||
                !isOnline ||
                !preview ||
                !!preview.errors.length ||
                !preview.changes.length ||
                reason.trim().length < 10 ||
                preview.version !== state.version
              }
              onClick={() => void confirm()}
            >
              {busy
                ? "Saving…"
                : command?.action === "asset-delete"
                  ? "Delete asset"
                  : "Confirm tag changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
