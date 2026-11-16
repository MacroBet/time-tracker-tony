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
  })
  .strict();
export type ProjectViewDefaults = z.infer<typeof projectViewDefaultsSchema>;
export const DEFAULT_PROJECT_VIEW: ProjectViewDefaults = {
  dashboardPanels: [...DASHBOARD_PANELS],
  durationMode: "days",
};
export function viewPreferenceKey(userId: string, projectId: string) {
  return `fieldtrack:view:v1:${encodeURIComponent(userId)}:${encodeURIComponent(projectId)}`;
}
export function parseViewPreference(
  value: string | null,
): ProjectViewDefaults | null {
  try {
    const parsed = projectViewDefaultsSchema.safeParse(
      JSON.parse(value ?? "null"),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
