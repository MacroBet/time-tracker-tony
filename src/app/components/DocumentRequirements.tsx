"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  LEVELS,
  type Level,
  type DocumentRequirements,
} from "@/lib/commissioning";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Draft = {
  id: string;
  title: string;
  required: boolean;
  level: Level;
  phase?: string;
};

export function DocumentRequirementsEditor({
  initial = {},
  defaultLevel = "L1",
  phases = [],
  disabled,
}: {
  initial?: DocumentRequirements;
  defaultLevel?: Level;
  phases?: string[];
  disabled: boolean;
}) {
  const [rows, setRows] = useState<Draft[]>(() =>
    LEVELS.flatMap((level) =>
      (initial[level] ?? []).map((item) => ({ ...item, level })),
    ),
  );
  const values: DocumentRequirements = {};
  for (const { level, ...item } of rows) {
    (values[level] ??= []).push(item);
  }
  const availableLevel = [defaultLevel, ...LEVELS].find(
    (level) => (values[level]?.length ?? 0) < 50,
  );
  const phaseOptions = Array.from(
    new Set([
      ...phases,
      ...rows.flatMap((row) => (row.phase ? [row.phase] : [])),
    ]),
  ).sort();
  function edit(id: string, patch: Partial<Draft>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }
  return (
    <details className="border-t pt-4">
      <summary className="cursor-pointer text-sm font-medium">
        Document checklist by tag
      </summary>
      <fieldset disabled={disabled} className="mt-4 space-y-4">
        <legend className="sr-only">Project document checklist</legend>
        <p className="max-w-prose text-sm text-slate-600">
          Name the documents for each tag level and choose whether they are
          required. Apply them to all phases or an asset phase from this
          project. The current project checklist appears on each tag’s test
          sheet.
        </p>
        <input
          type="hidden"
          name="documentRequirements"
          value={JSON.stringify(values)}
        />
        {!rows.length && (
          <p className="text-sm text-slate-600">No documents listed yet.</p>
        )}
        <ul className="divide-y divide-slate-200">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className="grid gap-3 py-4 sm:grid-cols-2 xl:grid-cols-[6rem_10rem_minmax(0,1fr)_auto_auto] sm:items-end"
            >
              <label className="text-sm">
                Tag
                <select
                  aria-label={`Document ${index + 1} tag`}
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  value={row.level}
                  onChange={(event) =>
                    edit(row.id, { level: event.target.value as Level })
                  }
                >
                  {LEVELS.map((level) => (
                    <option
                      key={level}
                      disabled={
                        level !== row.level &&
                        (values[level]?.length ?? 0) >= 50
                      }
                    >
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-sm">
                Phase
                <select
                  aria-label={`Document ${index + 1} phase`}
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  value={row.phase ?? ""}
                  onChange={(event) =>
                    edit(row.id, { phase: event.target.value || undefined })
                  }
                >
                  <option value="">All phases</option>
                  {phaseOptions.map((phase) => (
                    <option key={phase} value={phase}>
                      {phase}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-sm">
                Document name
                <Input
                  className="mt-1 h-11"
                  aria-label={`Document ${index + 1} name`}
                  maxLength={200}
                  required
                  value={row.title}
                  onChange={(event) =>
                    edit(row.id, { title: event.target.value })
                  }
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label={`Document ${index + 1} required`}
                  checked={row.required}
                  onChange={(event) =>
                    edit(row.id, { required: event.target.checked })
                  }
                />
                Required
              </label>
              <Button
                type="button"
                variant="ghost"
                className="h-11 justify-self-start"
                aria-label={`Remove document ${index + 1}`}
                onClick={() =>
                  setRows((current) =>
                    current.filter((item) => item.id !== row.id),
                  )
                }
              >
                <Trash2 className="size-4" /> Remove
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={!availableLevel}
          onClick={() =>
            availableLevel &&
            setRows((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                level: availableLevel,
                title: "",
                required: true,
              },
            ])
          }
        >
          <Plus className="size-4" /> Add document
        </Button>
        <p className="text-xs text-slate-600">
          Save project setup below to apply these changes.
        </p>
        {LEVELS.some((level) => (values[level]?.length ?? 0) >= 50) && (
          <p className="text-sm text-slate-600">
            Tags with 50 documents are full. Choose another tag to add more.
          </p>
        )}
      </fieldset>
    </details>
  );
}

export function DocumentRequirementsList({
  items,
}: {
  items: NonNullable<DocumentRequirements[Level]>;
}) {
  return (
    <div className="border-t pt-4">
      <h3 className="font-semibold text-sm">
        Current project document checklist
      </h3>
      {items.length ? (
        <ul className="mt-2 divide-y divide-slate-200">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2 text-sm"
            >
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                {item.title}
              </span>
              <span className="shrink-0 text-slate-600">
                {item.required ? "Required" : "Not required"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          No document checklist configured for this tag.
        </p>
      )}
    </div>
  );
}
