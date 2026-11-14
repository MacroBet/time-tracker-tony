"use client";
import { ScheduleWorkspace } from "./ScheduleWorkspace";

/** Preserve bookmarked /overdue links inside the Schedule workspace. */
export function OverdueWorkspace() {
  return <ScheduleWorkspace initialView="overdue" />;
}
