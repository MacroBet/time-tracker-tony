import type { Level, ProjectConfig } from "@/lib/commissioning";

export function TagLevel({
  level,
  presentation,
}: {
  level: Level;
  presentation?: ProjectConfig["phasePresentation"];
}) {
  const display = presentation?.[level];
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-2 align-middle">
      {display?.color && (
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-sm border border-slate-500"
          style={{ backgroundColor: display.color }}
        />
      )}
      <span className="min-w-0 break-words">
        {level}
        {display?.label && display.label !== level ? ` · ${display.label}` : ""}
      </span>
    </span>
  );
}
