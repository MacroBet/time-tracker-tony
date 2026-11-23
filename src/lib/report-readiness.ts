import { commissioning, tagRows, taskKind } from "./commissioning";
import { projectDate, type AppData } from "./domain";
import type { SourceProgrammeIndex } from "./programme-source";
import { projectProgressPopulation } from "./project-progress";
import { assetStepProgress, buildProjectReport } from "./project-reports";

export type ReportReadinessState =
  "ready" | "partial" | "missing" | "unavailable";
export type ReportCriterion = {
  id: string;
  label: string;
  recorded: number;
  total: number;
  required: boolean;
  remedy: string;
  href: string;
};
export type ReportReadinessItem = {
  id: string;
  title: string;
  state: ReportReadinessState;
  records: number | null;
  criteria: ReportCriterion[];
};
export type ReportReadiness = {
  projectId: string;
  revision: { register: number; sourceSha: string | null };
  checkedAt: string;
  summary: {
    sourceActivities: number | null;
    managedActivities: number;
    activities: number | null;
    assets: number;
    applicableTags: number | null;
    tasks: number | null;
    sourceUnavailable: boolean;
    taskAccess: boolean;
  };
  reports: ReportReadinessItem[];
  notes: string[];
};

/** Readiness describes recorded inputs, never whether work has passed or been approved. */
export function buildReportReadiness(
  data: AppData,
  projectId: string,
  sourceIndex?: SourceProgrammeIndex,
  {
    now = new Date(),
    taskAccess = true,
  }: { now?: Date; taskAccess?: boolean } = {},
): ReportReadiness {
  const project = data.projects.find((row) => row.id === projectId);
  if (!project) throw Error("Project not found.");
  const state = commissioning(project);
  const tasks = taskAccess
    ? data.tasks.filter((row) => row.projectId === projectId)
    : [];
  const population = projectProgressPopulation(state, sourceIndex);
  const sourceRows = population.rows.filter((row) => row.source === "source");
  const managedRows = population.rows.filter((row) => row.source === "managed");
  const tags = tagRows(project, tasks);
  const applicableTags = tags.filter((row) => row.applicable);
  const steps = state.assets.map((asset) => assetStepProgress(state, asset.id));
  const missingSheets = steps.reduce(
    (total, row) => total + row.missingSheets,
    0,
  );
  const tagLevelCount = state.assets.reduce(
    (total, asset) =>
      total +
      asset.levels.filter((level) => state.config.levels.includes(level))
        .length,
    0,
  );
  const requiredSteps = steps.reduce(
    (total, row) => total + row.totalRequired,
    0,
  );
  const activeSheets = (state.checksheets?.sheets ?? []).filter((sheet) => {
    const asset = state.assets.find((row) => row.id === sheet.assetId);
    return (
      sheet.level &&
      asset?.levels.includes(sheet.level) &&
      state.config.levels.includes(sheet.level)
    );
  });
  const answeredSteps = activeSheets.reduce(
    (total, sheet) =>
      total +
      sheet.requirements.filter(
        (step) =>
          step.required &&
          sheet.responses.some(
            (response) =>
              response.stepId === step.id && Boolean(response.answer.trim()),
          ),
      ).length,
    0,
  );
  const lookahead = buildProjectReport(
    data,
    projectId,
    { report: "lookahead", limit: 1 },
    { sourceIndex, now },
  );
  const vendors = buildProjectReport(
    data,
    projectId,
    { report: "vendors", limit: 1 },
    { sourceIndex, now },
  );
  const scheduleHref = `/schedule?projectId=${encodeURIComponent(projectId)}`;
  const assetHref = `/commissioning?projectId=${encodeURIComponent(projectId)}`;
  const sheetHref = `/checksheets?projectId=${encodeURIComponent(projectId)}`;
  const taskHref = `/supervisor?projectId=${encodeURIComponent(projectId)}`;
  const need = (total: number) => Math.max(1, total);
  const criterion = (
    id: string,
    label: string,
    recorded: number,
    total: number,
    remedy: string,
    href: string,
    required = true,
  ): ReportCriterion => ({
    id,
    label,
    recorded,
    total,
    required,
    remedy,
    href,
  });
  const inventory = () =>
    criterion(
      "assets",
      "Equipment register",
      state.assets.length,
      need(state.assets.length),
      "Import or add the equipment register. A programme import does not create equipment records.",
      assetHref,
    );
  const levels = () =>
    criterion(
      "applicable-levels",
      "Recorded enabled equipment-tag assignments",
      tagLevelCount,
      need(tagLevelCount),
      "Enable the required project levels and explicitly assign applicable levels to equipment. Equipment with no required tags can remain without levels; no level is inferred from an activity name.",
      assetHref,
    );
  const schedule = () =>
    criterion(
      "activities",
      "Saved Schedule activities",
      population.rows.length,
      need(population.rows.length),
      "Import a programme or add managed Schedule activities.",
      scheduleHref,
    );
  const dates = () =>
    criterion(
      "activity-dates",
      "Activities with both start and finish",
      lookahead.coverage.activities - lookahead.coverage.undatedActivities,
      need(lookahead.coverage.activities),
      "Record explicit start and finish dates. Undated activities cannot be placed in a lookahead window.",
      scheduleHref,
    );
  const report = (
    id: string,
    title: string,
    records: number | null,
    criteria: ReportCriterion[],
    unavailable = false,
  ): ReportReadinessItem => {
    const required = criteria.filter((row) => row.required);
    const incomplete = required.filter((row) => row.recorded < row.total);
    return {
      id,
      title,
      records,
      criteria,
      state: unavailable
        ? "unavailable"
        : incomplete.length
          ? required.every((row) => row.recorded === 0)
            ? "missing"
            : "partial"
          : "ready",
    };
  };
  const planned = population.rows.filter((row) => row.plannedFinish).length;
  const completed = population.rows.filter((row) => row.completed).length;
  const actual = population.rows.filter(
    (row) => row.actualFinish && row.actualFinish <= projectDate(now),
  ).length;
  const knownCriticality = sourceRows.filter(
    (row) => row.criticality !== "unknown",
  ).length;
  const linkedWindow =
    lookahead.total - lookahead.coverage.activitiesWithoutAssetLinks;
  const vendorWindow =
    lookahead.total - lookahead.coverage.activitiesMissingVendor;
  const tasksAvailable = (
    id: string,
    title: string,
    records: number,
    criteria: ReportCriterion[],
  ) =>
    report(
      id,
      title,
      taskAccess ? records : null,
      taskAccess ? criteria : [],
      !taskAccess,
    );
  return {
    projectId,
    revision: population.revision,
    checkedAt: now.toISOString(),
    summary: {
      sourceActivities: population.sourceUnavailable ? null : sourceRows.length,
      managedActivities: managedRows.length,
      activities: population.sourceUnavailable ? null : population.rows.length,
      assets: state.assets.length,
      applicableTags: taskAccess ? applicableTags.length : null,
      tasks: taskAccess ? tasks.length : null,
      sourceUnavailable: population.sourceUnavailable,
      taskAccess,
    },
    reports: [
      report(
        "progress",
        "Project progress",
        population.sourceUnavailable ? null : population.rows.length,
        [
          schedule(),
          criterion(
            "planned-finishes",
            "Saved original planned finishes",
            planned,
            need(population.rows.length),
            "Record source planned targets or managed baseline finishes. Current dates do not replace an original plan.",
            scheduleHref,
          ),
          criterion(
            "actual-finishes",
            "Dated completed activities",
            actual,
            completed,
            "Record actual finishes for completed activities. Missing and future actual dates are not estimated.",
            scheduleHref,
            completed > 0,
          ),
        ],
        population.sourceUnavailable,
      ),
      report(
        "critical",
        "Saved P6 critical activities",
        population.sourceUnavailable
          ? null
          : sourceRows.filter((row) => row.criticality === "critical").length,
        [
          criterion(
            "saved-criticality",
            "Source activities with a supported saved P6 float criterion",
            knownCriticality,
            need(sourceRows.length),
            "Import a P6 source containing its project criticality rule and activity total float. Managed dates do not establish a critical path.",
            scheduleHref,
          ),
          criterion(
            "criticality-current",
            "No working edits since the saved classification",
            population.criticality.workingStale ? 0 : 1,
            1,
            "Review the saved P6 classification after working changes. FieldTrack does not recalculate CPM or infer a Phase 1 finish milestone.",
            scheduleHref,
            knownCriticality > 0,
          ),
        ],
        population.sourceUnavailable,
      ),
      report(
        "lookahead",
        "Two-week lookahead",
        population.sourceUnavailable ? null : lookahead.total,
        [schedule(), dates()],
        population.sourceUnavailable,
      ),
      report(
        "vendors",
        "Equipment supplier lookahead",
        population.sourceUnavailable || !taskAccess ? null : vendors.total,
        taskAccess
          ? [
              schedule(),
              dates(),
              criterion(
                "activity-equipment",
                "Lookahead activities explicitly linked to equipment",
                linkedWindow,
                lookahead.total,
                "Map equipment to its exact Schedule Activity ID, or save an explicit working equipment link. Names are not automatic links.",
                assetHref,
              ),
              criterion(
                "equipment-supplier",
                "Lookahead activities with complete equipment-supplier mapping",
                vendorWindow,
                lookahead.total,
                "Record the equipment supplier on every linked equipment record. Owner, manufacturer and assignee are not supplier fields.",
                assetHref,
              ),
              criterion(
                "equipment-discipline",
                "Equipment with a recorded discipline",
                state.assets.filter((asset) =>
                  Boolean(asset.discipline?.trim()),
                ).length,
                state.assets.length,
                "Record equipment discipline to use that filter. The report can still run without the discipline filter.",
                assetHref,
                false,
              ),
            ]
          : [],
        population.sourceUnavailable || !taskAccess,
      ),
      report("tags", "Tag approvals", tags.length, [
        inventory(),
        levels(),
        ...(taskAccess
          ? [
              criterion(
                "tag-reviews",
                "Applicable tags with recorded review states",
                applicableTags.filter(
                  (row) => row.task?.cx?.tagReview !== undefined,
                ).length,
                applicableTags.length,
                "Record tag reviews as work is reviewed. No review does not mean approved, failed or a broken report.",
                taskHref,
                false,
              ),
            ]
          : []),
      ]),
      report("tagging", "Tagging step progress", state.assets.length, [
        inventory(),
        levels(),
        criterion(
          "tag-checksheets",
          "Enabled equipment levels with a checksheet",
          tagLevelCount - missingSheets,
          need(tagLevelCount),
          "Assign the appropriate checksheet to each equipment level. A P6 activity does not create a test sheet.",
          sheetHref,
        ),
        criterion(
          "required-steps",
          "Required checksheet steps",
          requiredSteps,
          need(requiredSteps),
          "Add the required checksheet steps before calculating step progress.",
          sheetHref,
        ),
        criterion(
          "step-responses",
          "Required steps with recorded answers",
          answeredSteps,
          requiredSteps,
          "Record real step answers and outcomes as work is performed. Answers, signatures and tag approval remain distinct.",
          sheetHref,
          false,
        ),
      ]),
      report(
        "works-to-go",
        "Works to go",
        state.checksheets?.worksToGo.length ?? 0,
        [
          criterion(
            "remaining-work",
            "Recorded remaining-work items",
            state.checksheets?.worksToGo.length ?? 0,
            state.checksheets?.worksToGo.length ?? 0,
            "Add remaining-work items only when identified. No recorded items is a valid empty report, not proof that no work remains.",
            sheetHref,
            false,
          ),
        ],
      ),
      tasksAvailable("tasks", "Tasks and issues", tasks.length, [
        criterion(
          "tasks",
          "Saved execution tasks and issues",
          tasks.length,
          need(tasks.length),
          "Create or import execution tasks. Importing a programme does not automatically create or assign tasks.",
          taskHref,
        ),
      ]),
      tasksAvailable(
        "handover",
        "Handover",
        tasks.filter((task) => taskKind(task) === "documentation").length,
        [
          criterion(
            "handover-records",
            "Recorded documentation tasks",
            tasks.filter((task) => taskKind(task) === "documentation").length,
            tasks.filter((task) => taskKind(task) === "documentation").length,
            "Classify documentation tasks when they are recorded. An empty report is not evidence of completed handover.",
            taskHref,
            false,
          ),
        ],
      ),
      tasksAvailable(
        "conformance",
        "Checklist conformance",
        tasks.filter(
          (task) =>
            task.cx?.conforming !== undefined ||
            task.cx?.nonConforming !== undefined,
        ).length,
        [
          criterion(
            "conformance-records",
            "Tasks with recorded conformance figures",
            tasks.filter(
              (task) =>
                task.cx?.conforming !== undefined ||
                task.cx?.nonConforming !== undefined,
            ).length,
            tasks.filter(
              (task) =>
                task.cx?.conforming !== undefined ||
                task.cx?.nonConforming !== undefined,
            ).length,
            "Record observed conforming/non-conforming figures. No figures is not zero defects or passed testing.",
            taskHref,
            false,
          ),
        ],
      ),
      report(
        "equipment",
        "Equipment",
        new Set(state.assets.map((asset) => asset.equipmentType)).size,
        [inventory()],
      ),
    ],
    notes: [
      "This is a deterministic check of saved project inputs, not an AI-generated import review or a claim about the live import's cause.",
      "Ready means the report's required inputs are recorded; it does not mean the work is complete, tests passed, suppliers confirmed or tags approved.",
      "The lookahead and supplier checks use the same unfiltered open two-week window as the project reports. A valid empty window is distinct from missing dates.",
      "P6 imports preserve programme records. Equipment, applicable tag levels, checksheets, supplier mappings, execution tasks and actual outcomes need explicit records.",
      ...(taskAccess
        ? []
        : [
            "Task-based checks are unavailable with the current account's task permissions; no zero task count is inferred.",
          ]),
    ],
  };
}
