"use client";
import {
  Children,
  isValidElement,
  useCallback,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp } from "lucide-react";
import { commissioning, type ProjectConfig } from "@/lib/commissioning";
import type { Project } from "@/lib/domain";
import {
  DASHBOARD_PANELS,
  dashboardPanelLabels,
  parseViewPreference,
  resolveProjectViewDefaults,
  serializeViewPreference,
  viewPreferenceKey,
  type DashboardPanelId,
  type ProjectViewDefaults,
} from "@/lib/project-view-settings";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const changed = "fieldtrack:view-preference";
export function useProjectView(project?: Project) {
  const { currentUser } = useApp();
  const key = viewPreferenceKey(currentUser.id, project?.id ?? "");
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener("storage", callback);
    window.addEventListener(changed, callback);
    return () => {
      window.removeEventListener("storage", callback);
      window.removeEventListener(changed, callback);
    };
  }, []);
  const read = useCallback(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const defaults = resolveProjectViewDefaults(
    commissioning(project).config.viewDefaults,
  );
  const personal = parseViewPreference(raw, defaults);
  function save(
    value: ProjectViewDefaults | null,
    changedField?: "calendarScale",
  ) {
    try {
      if (value)
        localStorage.setItem(
          key,
          serializeViewPreference(value, raw, changedField),
        );
      else localStorage.removeItem(key);
      window.dispatchEvent(new Event(changed));
    } catch {
      toast.error(
        "This browser could not save your preference. Enable local storage and try again.",
      );
    }
  }
  return { value: personal ?? defaults, defaults, personal: !!personal, save };
}

function ViewEditor({
  value,
  onChange,
}: {
  value: ProjectViewDefaults;
  onChange: (
    value: ProjectViewDefaults,
    changedField?: "calendarScale",
  ) => void;
}) {
  const selected = value.dashboardPanels;
  const rows = [
    ...selected,
    ...DASHBOARD_PANELS.filter((id) => !selected.includes(id)),
  ];
  function move(id: DashboardPanelId, delta: number) {
    const next = [...selected],
      from = next.indexOf(id),
      to = from + delta;
    if (from < 0 || to < 0 || to >= next.length) return;
    [next[from], next[to]] = [next[to], next[from]];
    onChange({ ...value, dashboardPanels: next });
  }
  return (
    <div className="space-y-3">
      <ul className="divide-y">
        {rows.map((id) => (
          <li key={id} className="flex min-h-11 items-center gap-2">
            <label className="flex min-h-11 flex-1 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(id)}
                disabled={selected.length === 1 && selected.includes(id)}
                onChange={(event) =>
                  onChange({
                    ...value,
                    dashboardPanels: event.target.checked
                      ? [...selected, id]
                      : selected.filter((row) => row !== id),
                  })
                }
              />
              {dashboardPanelLabels[id]}
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Move ${dashboardPanelLabels[id]} up`}
              disabled={selected.indexOf(id) <= 0}
              onClick={() => move(id, -1)}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Move ${dashboardPanelLabels[id]} down`}
              disabled={
                !selected.includes(id) ||
                selected.indexOf(id) === selected.length - 1
              }
              onClick={() => move(id, 1)}
            >
              <ArrowDown className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      <label className="block text-sm font-medium">
        Schedule calendar scale
        <Select
          value={value.calendarScale}
          onValueChange={(
            calendarScale: ProjectViewDefaults["calendarScale"],
          ) => onChange({ ...value, calendarScale }, "calendarScale")}
        >
          <SelectTrigger
            className="mt-1"
            aria-label="Default schedule calendar scale"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">DAY · Days</SelectItem>
            <SelectItem value="week">WK · Weeks</SelectItem>
            <SelectItem value="month">MTH · Months</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label className="block text-sm font-medium">
        Schedule duration
        <Select
          value={value.durationMode}
          onValueChange={(durationMode: ProjectViewDefaults["durationMode"]) =>
            onChange({ ...value, durationMode })
          }
        >
          <SelectTrigger
            className="mt-1"
            aria-label="Default schedule duration"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="days">Days</SelectItem>
            <SelectItem value="hours">Hours</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>
      </label>
    </div>
  );
}

export function PersonalViewSettings({ project }: { project: Project }) {
  const preference = useProjectView(project);
  return (
    <details className="rounded-lg border bg-white px-3">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
        Customize my view ·{" "}
        {preference.personal ? "Personal" : "Project default"}
      </summary>
      <div className="max-w-lg space-y-3 pb-3">
        <p className="text-xs text-slate-600">
          Only your view in this browser changes. Project records and shared
          defaults stay the same.
        </p>
        <ViewEditor value={preference.value} onChange={preference.save} />
        <Button
          variant="outline"
          disabled={!preference.personal}
          onClick={() => preference.save(null)}
        >
          Use project defaults
        </Button>
      </div>
    </details>
  );
}

export function DashboardPanel({
  id,
  panels,
  children,
}: {
  id: DashboardPanelId;
  panels: DashboardPanelId[];
  children: ReactNode;
}) {
  const index = panels.indexOf(id);
  if (index < 0) return null;
  return (
    <div className="min-w-0 space-y-5" data-dashboard-panel={id}>
      {children}
    </div>
  );
}

/** Keyboard and screen-reader order follows the visible panel order. */
export function DashboardLayout({
  panels,
  children,
}: {
  panels: DashboardPanelId[];
  children: ReactNode;
}) {
  const order = (child: ReactNode) => {
    if (
      !isValidElement<{ id?: DashboardPanelId }>(child) ||
      child.type !== DashboardPanel
    )
      return -1;
    const index = panels.indexOf(child.props.id!);
    return index < 0 ? panels.length : index;
  };
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {Children.toArray(children).sort((a, b) => order(a) - order(b))}
    </div>
  );
}

export function ProjectDefaultSettings({ project }: { project: Project }) {
  const { currentUser } = useApp();
  if (currentUser.role !== "admin") return null;
  const state = commissioning(project);
  return (
    <ProjectDefaultEditor
      key={`${project.id}:${state.version}`}
      project={project}
      config={state.config}
      version={state.version}
    />
  );
}
function ProjectDefaultEditor({
  project,
  config,
  version,
}: {
  project: Project;
  config: ProjectConfig;
  version: number;
}) {
  const { mutate, isOnline } = useApp();
  const [value, setValue] = useState(
    resolveProjectViewDefaults(config.viewDefaults),
  );
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await mutate(
        `/api/projects/${encodeURIComponent(project.id)}/commissioning`,
        {
          method: "PATCH",
          body: JSON.stringify({
            action: "configure",
            version,
            reason,
            config: { ...config, viewDefaults: value },
          }),
        },
      );
      toast.success("Shared project view saved");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save project defaults",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className="rounded-xl border bg-white p-4"
      id="project-view-defaults"
    >
      <summary className="min-h-11 cursor-pointer font-semibold">
        Dashboard and Schedule defaults
      </summary>
      <div className="max-w-lg space-y-4 pt-2">
        <p className="text-sm text-slate-600">
          Shared starting view for {project.name}. Personal preferences take
          precedence. Existing project metrics and permissions apply.
        </p>
        <ViewEditor
          value={value}
          onChange={(next) => {
            setValue(next);
            setPreview(false);
          }}
        />
        <label className="block text-sm font-medium">
          Reason
          <Textarea
            value={reason}
            maxLength={1000}
            onChange={(event) => {
              setReason(event.target.value);
              setPreview(false);
            }}
          />
        </label>
        {preview && (
          <p role="status" className="text-sm">
            Save{" "}
            {value.dashboardPanels
              .map((id) => dashboardPanelLabels[id])
              .join(" → ")}{" "}
            with calendar scale {value.calendarScale} and duration{" "}
            {value.durationMode} as the project starting view?
          </p>
        )}
        <Button
          disabled={!isOnline || busy || reason.trim().length < 10}
          onClick={() => (preview ? void save() : setPreview(true))}
        >
          {busy
            ? "Saving…"
            : preview
              ? "Confirm shared defaults"
              : "Review shared defaults"}
        </Button>
      </div>
    </details>
  );
}
