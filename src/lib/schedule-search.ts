export const normalizeSavedScheduleQuery = (value: string) =>
  // The singular noun matches both chiller and chillers; never stem arbitrary words.
  value
    .trim()
    .toLowerCase()
    .replace(/\bchillers\b/g, "chiller");

/** IDs and names are separate literal fields; every destination uses the same population. */
export function matchesSavedScheduleQuery(
  activity: { internalId: string; activityId: string; name: string },
  query: string,
) {
  const needle = normalizeSavedScheduleQuery(query);
  return (
    !needle ||
    [activity.internalId, activity.activityId, activity.name].some((value) =>
      normalizeSavedScheduleQuery(value).includes(needle),
    )
  );
}
