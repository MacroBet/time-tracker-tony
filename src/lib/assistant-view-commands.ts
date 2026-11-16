import type { SourceGanttViewCommand } from "./source-gantt";

export type AssistantViewIntent = {
  commands: SourceGanttViewCommand[];
  description: string;
};
/** Exact display intents only. A question about data or a change to work is never guessed. */
export function parseAssistantViewCommand(
  message: string,
): AssistantViewIntent | null {
  const text = message
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "")
    .replace(/\s+/g, " ");
  if (
    /^(?:please )?(?:show(?: me)?|open) (?:the )?(?:schedule|gantt)$/.test(text)
  )
    return {
      commands: [{ type: "show" }],
      description: "The current Schedule stays open.",
    };
  if (/^(?:go to |show |show me )?today$/.test(text))
    return {
      commands: [{ type: "today" }],
      description: "Schedule centered on today.",
    };
  const scale = text.match(
    /^(?:please )?(?:show(?: me)?|switch to|use) (?:the )?(days?|weeks?|months?|daily|weekly|monthly)(?: view| scale)?$/,
  );
  if (scale) {
    const value =
      scale[1].startsWith("day") || scale[1] === "daily"
        ? "day"
        : scale[1].startsWith("week")
          ? "week"
          : "month";
    return {
      commands: [{ type: "scale", scale: value }],
      description: `Schedule displayed by ${value}.`,
    };
  }
  const horizon = text.match(
    /^show(?: me)? (?:the )?(?:schedule|gantt) (?:for )?(?:the )?next (two|2|four|4|six|6) weeks$/,
  );
  if (horizon) {
    const weeks = ["two", "2"].includes(horizon[1])
      ? 2
      : ["four", "4"].includes(horizon[1])
        ? 4
        : 6;
    return {
      commands: [
        { type: "today" },
        { type: "horizon", horizon: (weeks * 7) as 14 | 28 | 42 },
      ],
      description: `Schedule display window: ${weeks} weeks from today. This changes the view, not the activity population or report filters.`,
    };
  }
  const column = text.match(
    /^(show|hide|add|remove)(?: me)? (?:the )?(progress|start|finish|dates|wbs|calendar)(?: columns?| percentage)?$/,
  );
  if (column) {
    const visible = column[1] === "show" || column[1] === "add";
    const columns =
      column[2] === "dates"
        ? (["start", "finish"] as const)
        : [column[2] as "progress" | "start" | "finish" | "wbs" | "calendar"];
    return {
      commands: columns.map((name) => ({
        type: "column",
        column: name,
        visible,
      })),
      description: `${column[2]} ${visible ? "shown" : "hidden"} in the Schedule. Saved work is unchanged.`,
    };
  }
  if (/^(show|hide) (?:the )?(?:days|duration)(?: column)?$/.test(text)) {
    const hidden = text.startsWith("hide");
    return {
      commands: [{ type: "duration", mode: hidden ? "hidden" : "days" }],
      description: `Schedule duration ${hidden ? "hidden" : "shown in source-calendar days"}.`,
    };
  }
  if (
    /^(?:show(?: me)?|hide) (?:the )?(?:p6 )?critical(?: path| activities)?$/.test(
      text,
    )
  )
    return {
      commands: [
        { type: "critical", filter: text.startsWith("hide") ? "all" : "yes" },
      ],
      description: text.startsWith("hide")
        ? "Criticality filter removed."
        : "Showing activities marked critical by the saved P6 criterion. Missing float remains unknown; working changes do not recalculate criticality.",
    };
  return null;
}

/** Commands are only recognized in an explicitly armed, separate review recording. */
export function parseVoiceReviewCommand(text: string): "send" | "edit" | null {
  const value = text
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "")
    .trim();
  return value === "send question"
    ? "send"
    : value === "edit question"
      ? "edit"
      : null;
}

export function resolveVoiceReview(
  text: string,
  reviewedDraft: string,
  currentDraft: string,
) {
  const command = parseVoiceReviewCommand(text);
  if (command === "edit") return "edit" as const;
  if (command !== "send") return "unknown" as const;
  return currentDraft.trim() && reviewedDraft === currentDraft.trim()
    ? ("send" as const)
    : ("draft-changed" as const);
}
