/** Display-only date formatting: source values and date inputs remain ISO. */
export function formatScheduleDate(date: string | undefined): string {
  if (!date) return "Not set";
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return parts ? `${parts[3]}/${parts[2]}/${parts[1]}` : date;
}
