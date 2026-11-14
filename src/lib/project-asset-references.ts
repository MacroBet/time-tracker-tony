import type { Commissioning } from "./commissioning";
/** References owned by features outside the original task/checksheet register. */
export function additionalProjectAssetReferences(state: Commissioning) {
  return [
    ...(state.workingSchedule?.activityPatches ?? []).flatMap((patch) =>
      (patch.assetIds ?? []).map((assetId) => ({
        assetId,
        label: `Working Schedule: ${patch.internalId}`,
      })),
    ),
    ...(state.workingSchedule?.addedActivities ?? []).map((activity) => ({
      assetId: activity.assetId,
      label: `Working Schedule: ${activity.activityId}`,
    })),
    ...(state.lessons ?? []).map((lesson) => ({
      assetId: lesson.source.assetId,
      label: `Lesson: ${lesson.title}`,
    })),
  ];
}
