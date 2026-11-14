import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AppData, User } from "@/lib/domain";
import { projectDate } from "@/lib/domain";
import {
  commissioning,
  hasModule,
  type Commissioning,
} from "@/lib/commissioning";
import { querySourceProgrammeIndex } from "@/lib/programme-source";
import {
  resolveWorkingSourceIndex,
  managedWorkingSourceIndex,
  workingScheduleDraftSchema,
  type WorkingScheduleDraft,
} from "@/lib/schedule-working";
import {
  queryProjectLibrary,
  type ProjectLibraryPage,
} from "@/lib/project-library";
import {
  refineAssistantReport,
  type AssistantReportState,
} from "@/lib/assistant-report-state";
import { type ProjectReportResult } from "@/lib/project-reports";
import { loadProgrammeSourceIndex, loadData } from "./repository";
import { requireUser } from "./auth";
import { loadProjectReport } from "./project-reports";
import { prepareWorkingScheduleProposal } from "./schedule-working";
import { requireCondition } from "./errors";
import {
  resolveScheduleViewRow,
  type ScheduleViewSnapshot,
} from "@/lib/schedule-view-context";
export { EXTENSION_TOOLS } from "@/lib/copilot-extension-tools";
import { EXTENSION_TOOLS } from "@/lib/copilot-extension-tools";
export function copilotExtensions({
  user,
  projectId,
  initialReport,
  scheduleView,
}: {
  user: User;
  data: AppData;
  projectId: string;
  initialReport?: AssistantReportState;
  scheduleView?: ScheduleViewSnapshot;
}) {
  let reportState = initialReport;
  const reports: ProjectReportResult[] = [],
    scheduleProposals: WorkingScheduleDraft[] = [],
    librarySearches: ProjectLibraryPage[] = [];
  const index = async (actor: User, currentState: Commissioning) => {
    const source = await loadProgrammeSourceIndex(projectId, actor.id);
    return source
      ? resolveWorkingSourceIndex(source, currentState.workingSchedule)
      : managedWorkingSourceIndex(
          currentState.schedule,
          currentState.workingSchedule,
        );
  };
  return {
    reports,
    scheduleProposals,
    librarySearches,
    get reportState() {
      return reportState;
    },
    viewContext: () => ({
      today: projectDate(),
      report: reportState ?? null,
      schedule: scheduleView ?? null,
    }),
    execute: async (
      name: string,
      args: Record<string, unknown>,
    ): Promise<{ output: unknown } | undefined> => {
      if (!EXTENSION_TOOLS.some((tool) => tool.name === name)) return undefined;
      const actor = await requireUser();
      requireCondition(
        actor.id === user.id,
        403,
        "The signed-in user changed. Start a new conversation.",
      );
      const latest = await loadData(actor),
        currentProject = latest.projects.find((p) => p.id === projectId);
      requireCondition(currentProject, 404, "Project is no longer available.");
      requireCondition(
        actor.role !== "worker" &&
          hasModule(actor, "tasks") &&
          hasModule(actor, "commissioning"),
        403,
        "Assistant management access is no longer available.",
      );
      const currentState = commissioning(currentProject);
      if (name === "project_report") {
        requireCondition(
          hasModule(actor, "reports"),
          403,
          "Reports access is required.",
        );
        requireCondition(
          reports.length < 3,
          400,
          "Maximum three reports per response.",
        );
        const query = refineAssistantReport(reportState?.query, args);
        const result = await loadProjectReport(projectId, query);
        reportState = { projectId, query: result.query };
        reports.push(result);
        const output = {
          dataOnly: true,
          ...result,
          facets: {
            ...result.facets,
            vendors: result.facets.vendors.slice(0, 15),
            disciplines: result.facets.disciplines.slice(0, 15),
          },
          rows: result.rows.slice(0, 10).map((row) =>
            row.kind === "vendors"
              ? { ...row, sources: row.sources.slice(0, 5) }
              : row.kind === "tagging"
                ? {
                    ...row,
                    levels: row.levels.map((level) => ({
                      ...level,
                      reviews: level.reviews.slice(0, 3),
                    })),
                  }
                : row.kind === "lookahead"
                  ? { ...row, assets: row.assets.slice(0, 5) }
                  : { ...row, notes: row.notes.slice(0, 400) },
          ),
          shownToModel: Math.min(result.rows.length, 10),
          uiShows: result.rows.length,
          modelPreviewTruncated: false,
        };
        // A single supplier can reference thousands of activities. The full UI
        // report remains available; only the model's preview is bounded here.
        while (
          new TextEncoder().encode(JSON.stringify(output)).byteLength > 28000 &&
          output.rows.length
        )
          output.rows.pop();
        output.shownToModel = output.rows.length;
        output.modelPreviewTruncated = output.rows.length < result.rows.length;
        return { output };
      }
      if (name === "search_schedule_activities") {
        requireCondition(
          hasModule(actor, "commissioning"),
          403,
          "Commissioning access is required.",
        );
        const input = z
          .object({
            query: z.string().max(200),
            rowNumber: z.number().int().min(1).max(1000000).nullable(),
            offset: z.number().int().min(0).max(1000000),
            limit: z.number().int().min(1).max(20),
          })
          .strict()
          .parse(args);
        const source = await index(actor, currentState);
        const result = querySourceProgrammeIndex(source, {
          q: input.query,
          page: 0,
          pageSize: 50,
        });
        // Index querying supports page sizing; filter before custom bounded offset without truncating totals.
        if (input.rowNumber !== null) {
          requireCondition(
            scheduleView,
            400,
            "Open the Schedule view first or provide an activity ID/name; row numbers need a saved view context.",
          );
          const resolved = resolveScheduleViewRow(
            source,
            scheduleView,
            { projectId, projectVersion: currentState.version },
            input.rowNumber,
          );
          const activity = resolved.activity;
          return {
            output: {
              dataOnly: true,
              sourceSha256: source.summary.sha256,
              projectVersion: currentState.version,
              rowNumber: resolved.rowNumber,
              filters: resolved.query,
              total: resolved.total,
              records: [activity],
              relationships:
                source.byId
                  .get(activity.internalId)
                  ?.relationships.slice(0, 30)
                  .map((link) => ({
                    sourceLine: link.sourceLine,
                    predecessorId: link.predecessorId,
                    successorId: link.successorId,
                    type: link.type,
                    lagHours: link.lagHours,
                  })) ?? [],
            },
          };
        }
        const needle = input.query.trim().toLocaleLowerCase();
        const matching = source.activities.filter(
          (a) =>
            !needle ||
            [a.internalId, a.activityId, a.name].some((s) =>
              s.toLocaleLowerCase().includes(needle),
            ),
        );
        const records = matching
          .slice(input.offset, input.offset + input.limit)
          .map((a) => ({
            internalId: a.internalId,
            activityId: a.activityId,
            name: a.name.slice(0, 200),
            start: a.start,
            finish: a.finish,
            status: a.status,
            calendarId: a.calendarId,
            calendarName: a.calendarName.slice(0, 100),
            relationshipCount:
              source.byId.get(a.internalId)?.relationships.length ?? 0,
            relationships:
              source.byId
                .get(a.internalId)
                ?.relationships.slice(0, input.limit === 1 ? 30 : 3)
                .map((link) => ({
                  sourceLine: link.sourceLine,
                  predecessorId: link.predecessorId,
                  predecessorActivityId: link.predecessorActivityId,
                  successorId: link.successorId,
                  successorActivityId: link.successorActivityId,
                  type: link.type,
                  lagHours: link.lagHours,
                })) ?? [],
            href: `/schedule?projectId=${encodeURIComponent(projectId)}&${source.summary.sha256 === "managed" ? "activityId" : "activity"}=${encodeURIComponent(source.summary.sha256 === "managed" ? a.activityId : a.internalId)}`,
          }));
        return {
          output: {
            dataOnly: true,
            sourceSha256: source.summary.sha256,
            projectVersion: currentState.version,
            total: matching.length,
            offset: input.offset,
            records,
            calendars: result.filters.calendars.slice(0, 30),
            recalculation: "explicit-dates-only",
          },
        };
      }
      if (
        name === "propose_asset_activity" ||
        name === "propose_schedule_edit"
      ) {
        requireCondition(
          scheduleProposals.length < 3,
          400,
          "Maximum three schedule proposals per response.",
        );
        const base = {
          sourceSha256:
            currentState.sourceProgrammeSummary?.sha256 ?? "managed",
          idempotencyKey: randomUUID(),
        };
        let draft: WorkingScheduleDraft;
        if (name === "propose_asset_activity") {
          const input = z
            .object({
              assetId: z.string().min(1).max(150),
              title: z.string().trim().min(3).max(150),
              description: z.string().max(5000).nullable(),
              start: z.iso.date().nullable(),
              deadline: z.iso.date(),
              reason: z.string().min(10).max(1000),
            })
            .strict()
            .parse(args);
          draft = workingScheduleDraftSchema.parse({
            ...base,
            kind: "create-asset-activity",
            ...input,
            description: input.description ?? undefined,
            start: input.start ?? undefined,
          });
        } else {
          const input = z
            .object({
              internalId: z.string().min(1).max(150),
              start: z.iso.date().nullable(),
              finish: z.iso.date().nullable(),
              addLinks: z
                .array(
                  z
                    .object({
                      predecessorId: z.string(),
                      successorId: z.string(),
                      type: z.enum(["PR_FS", "PR_SS", "PR_FF", "PR_SF"]),
                      lagHours: z.number(),
                    })
                    .strict(),
                )
                .max(100)
                .nullable(),
              assetIds: z.array(z.string().min(1).max(150)).max(200).nullable(),
              removeLinkIds: z.array(z.number().int()).max(100).nullable(),
              reason: z.string().min(10).max(1000),
            })
            .strict()
            .parse(args);
          draft = workingScheduleDraftSchema.parse({
            ...base,
            kind: "edit-activity",
            ...Object.fromEntries(
              Object.entries(input).filter(([, v]) => v !== null),
            ),
          });
        }
        const prepared = await prepareWorkingScheduleProposal(projectId, draft);
        scheduleProposals.push(draft);
        return {
          output: {
            dataOnly: true,
            proposal: prepared.proposal,
            requiresHumanPreview: true,
            requiresHumanConfirmation: true,
            executed: false,
            canConfirm: prepared.canConfirm,
          },
        };
      }
      if (name === "search_project_library") {
        const input = z
          .object({
            query: z.string().max(200),
            projectId: z.string().max(150).nullable(),
            kind: z.enum(["all", "asset", "issue", "lesson"]),
            offset: z.number().int().min(0).max(1000000),
            limit: z.number().int().min(1).max(20),
          })
          .strict()
          .parse(args);
        const result = queryProjectLibrary(latest, actor, {
          q: input.query,
          projectId: input.projectId ?? undefined,
          kind: input.kind,
          offset: input.offset,
          limit: input.limit,
        });
        librarySearches.push(result);
        return {
          output: {
            dataOnly: true,
            ...result,
            facets: {
              ...result.facets,
              projects: result.facets.projects.slice(0, 30),
            },
            results: result.results.map((row) => ({
              ...row,
              snippet: row.snippet.slice(0, 400),
              lesson: undefined,
            })),
          },
        };
      }
      return undefined;
    },
  };
}
