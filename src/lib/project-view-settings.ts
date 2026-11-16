import { z } from "zod";

export const DASHBOARD_PANELS = [
  "summary",
  "attention",
  "works",
  "reports",
  "tags",
  "details",
] as const;
export type DashboardPanelId = (typeof DASHBOARD_PANELS)[number];
export const dashboardPanelLabels: Record<DashboardPanelId, string> = {
  summary: "Project summary",
  attention: "Needs attention",
  works: "Works to go",
  reports: "Reports",
  tags: "Tag approvals",
  details: "Detailed progress and issues",
};
const panels = z
  .array(z.enum(DASHBOARD_PANELS))
  .min(1)
  .max(6)
  .refine(
    (rows) => new Set(rows).size === rows.length,
    "Choose each panel once",
  );
export const projectViewDefaultsSchema = z
  .object({
    dashboardPanels: panels,
    durationMode: z.enum(["days", "hours", "hidden"]),
    calendarScale: z.enum(["day", "week", "month"]).default("day"),
  })
  .strict();
export type ProjectViewDefaults = z.infer<typeof projectViewDefaultsSchema>;
export const DEFAULT_PROJECT_VIEW: ProjectViewDefaults = {
  dashboardPanels: [...DASHBOARD_PANELS],
  durationMode: "days",
  calendarScale: "day",
};
export function resolveProjectViewDefaults(
  value: unknown,
): ProjectViewDefaults {
  const parsed = projectViewDefaultsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_PROJECT_VIEW;
}
export function viewPreferenceKey(userId: string, projectId: string) {
  return `fieldtrack:view:v1:${encodeURIComponent(userId)}:${encodeURIComponent(projectId)}`;
}
export function parseViewPreference(
  value: string | null,
  defaults: ProjectViewDefaults = DEFAULT_PROJECT_VIEW,
): ProjectViewDefaults | null {
  try {
    const raw = JSON.parse(value ?? "null");
    const parsed = projectViewDefaultsSchema.safeParse(raw);
    return parsed.success
      ? {
          ...parsed.data,
          calendarScale: Object.hasOwn(raw, "calendarScale")
            ? parsed.data.calendarScale
            : defaults.calendarScale,
        }
      : null;
  } catch {
    return null;
  }
}
/** Keep new fields inherited until the user explicitly changes that field. */
export function serializeViewPreference(
  value: ProjectViewDefaults,
  previous: string | null,
  changedField?: "calendarScale",
) {
  let explicit = false;
  try {
    const raw = JSON.parse(previous ?? "null");
    explicit =
      projectViewDefaultsSchema.safeParse(raw).success &&
      Object.hasOwn(raw, "calendarScale");
  } catch {
    /* Corrupt preferences are replaced with the reviewed values. */
  }
  if (explicit || changedField === "calendarScale")
    return JSON.stringify(value);
  const { calendarScale: _inherited, ...inherited } = value;
  void _inherited;
  return JSON.stringify(inherited);
}
