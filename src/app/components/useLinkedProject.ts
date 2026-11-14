"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../contexts/AppContext";
/** Deep links select an authorized project; later project selection updates the URL. */
export function useLinkedProject() {
  const { projects, selectedProjectId, selectProject } = useApp();
  const params = useSearchParams(),
    pathname = usePathname(),
    router = useRouter();
  const requested = params.get("projectId"),
    applied = useRef<string | null>(null),
    previousSelected = useRef(selectedProjectId);
  const available = projects.some((project) => project.id === requested);
  useEffect(() => {
    const userChangedProject = previousSelected.current !== selectedProjectId;
    previousSelected.current = selectedProjectId;
    if (!requested) {
      applied.current = null;
      return;
    }
    if (available && applied.current !== requested) {
      applied.current = requested;
      if (selectedProjectId !== requested) selectProject(requested);
      return;
    }
    if (
      (applied.current === requested && selectedProjectId !== requested) ||
      (!available && userChangedProject)
    ) {
      const next = new URLSearchParams(params.toString());
      next.set("projectId", selectedProjectId);
      next.delete("activity");
      next.delete("activityId");
      next.delete("internalId");
      next.delete("work");
      next.delete("asset");
      router.replace(`${pathname}?${next}`);
    }
  }, [
    requested,
    available,
    selectedProjectId,
    selectProject,
    pathname,
    router,
    params,
  ]);
  return {
    requested,
    unavailable: Boolean(requested && !available),
    opening: Boolean(requested && available && selectedProjectId !== requested),
    project: projects.find((project) => project.id === selectedProjectId),
  };
}
