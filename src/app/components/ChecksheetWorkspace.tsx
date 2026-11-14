"use client";

import { useEffect, useRef, useState } from "react";
import { FileCheck2, Upload, Plus, Trash2 } from "lucide-react";
import { LEVELS, type Asset } from "@/lib/commissioning";
import type { Task, User } from "@/lib/domain";
import {
  canSignChecksheet,
  canWorkOnAsset,
  checksheetProgress,
  checksheetTemplateSchema,
  emptyChecksheetState,
  signatoryApplies,
  type ChecksheetCommand,
  type ChecksheetInstance,
  type ProjectChecksheetState,
  type SignatorySlot,
} from "@/lib/checksheets";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { InfoPopover } from "./InfoPopover";

const selectClass = "field-select mt-1 min-h-11 min-w-0 w-full";
export type ChecksheetWorkspaceProps = {
  state?: ProjectChecksheetState;
  assets: Asset[];
  users: User[];
  currentUser: User;
  tasks: Task[];
  busy?: boolean;
  onCommand: (command: ChecksheetCommand) => Promise<void>;
};
export function ChecksheetWorkspace({
  state,
  assets,
  users,
  currentUser,
  tasks,
  busy,
  onCommand,
}: ChecksheetWorkspaceProps) {
  const data = state ?? emptyChecksheetState();
  const manage = currentUser.role !== "worker";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [tagLevel, setTagLevel] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [slots, setSlots] = useState<SignatorySlot[] | null>(null);
  const disabled = busy || pending;
  const editableSlots = slots ?? data.signatorySlots;
  const availableAssets = assets.filter((a) =>
    canWorkOnAsset(currentUser, a.id, tasks),
  );
  const sheetRows = data.sheets.filter((s) => {
    const asset = assets.find((a) => a.id === s.assetId);
    return `${asset?.name ?? ""} ${s.templateName} ${s.assetId}`
      .toLowerCase()
      .includes(search.toLowerCase());
  });
  const active = data.sheets.find((s) => s.id === selected);
  async function run(command: ChecksheetCommand) {
    setError("");
    setPending(true);
    try {
      await onCommand(command);
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Refresh the project and try again.",
      );
      return false;
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="space-y-6" aria-labelledby="checksheets-heading">
      <div className="flex items-center gap-1">
        <h2 id="checksheets-heading" className="text-xl font-semibold">
          Equipment checksheets
        </h2>
        <InfoPopover label="About equipment checksheets">
          <p>
            Associate a requirement template with specific equipment. Record
            answers and explicit results, then sign using the project’s
            configured signatories.
          </p>
        </InfoPopover>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {pending && (
        <p role="status" className="text-sm text-slate-600">
          Saving checksheet changes…
        </p>
      )}
      {manage && (
        <details className="rounded-lg border border-slate-200 p-4">
          <summary className="min-h-11 cursor-pointer py-2 font-medium focus-visible:outline-2 focus-visible:outline-blue-700">
            Templates and signatories
          </summary>
          <div className="mt-5 space-y-6">
            <div>
              <div className="flex items-center gap-1">
                <h3 className="font-semibold">Requirement templates</h3>
                <InfoPopover label="About requirement templates">
                  <p>
                    Imported requirements begin without answers, results or
                    signatures. Importing a template does not create tasks or
                    equipment associations.
                  </p>
                </InfoPopover>
              </div>
              <ul className="mt-3 divide-y divide-slate-200">
                {data.templates.map((t) => (
                  <li key={t.id} className="py-3 text-sm">
                    <span className="font-medium">{t.name}</span>
                    <span className="ml-2 text-slate-600">
                      Revision {t.revision} · {t.requirements.length}{" "}
                      requirements
                    </span>
                  </li>
                ))}
              </ul>
              {!data.templates.length && (
                <p className="my-3 text-sm text-slate-600">
                  No requirement templates in this project.
                </p>
              )}
              <label
                aria-disabled={disabled}
                className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-700 aria-disabled:cursor-default aria-disabled:opacity-50"
              >
                <Upload className="size-4" />
                Import template JSON
                <input
                  type="file"
                  accept=".json,application/json"
                  disabled={disabled}
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setError("");
                    try {
                      if (file.size > 4 * 1024 * 1024)
                        throw new Error(
                          "Choose a template file smaller than 4 MiB.",
                        );
                      const raw: unknown = JSON.parse(await file.text());
                      const candidates = Array.isArray(raw)
                        ? raw
                        : raw && typeof raw === "object" && "templates" in raw
                          ? (raw as { templates: unknown }).templates
                          : [raw];
                      if (!Array.isArray(candidates))
                        throw new Error(
                          "The file must contain a templates array.",
                        );
                      const templates = candidates.map((t) =>
                        checksheetTemplateSchema.parse(t),
                      );
                      await run({ kind: "save-templates", templates });
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Template file could not be read.",
                      );
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <form
              className="space-y-4 border-t border-slate-200 pt-5"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await run({
                    kind: "configure-signatories",
                    slots: editableSlots,
                  })
                )
                  setSlots(null);
              }}
            >
              <h3 className="font-semibold">Project signatories</h3>
              <p className="text-sm text-slate-600">
                Choose an existing project user for each signature. Leave the
                tag blank to use it across all levels. Changing this
                configuration invalidates existing signatures while retaining
                their history.
              </p>
              <ul className="divide-y divide-slate-200">
                {editableSlots.map((slot, index) => (
                  <li
                    key={slot.id}
                    className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_auto] md:items-end"
                  >
                    <label className="text-sm">
                      Signature name
                      <Input
                        required
                        maxLength={150}
                        value={slot.label}
                        disabled={disabled}
                        onChange={(e) =>
                          setSlots(
                            editableSlots.map((s) =>
                              s.id === slot.id
                                ? { ...s, label: e.target.value }
                                : s,
                            ),
                          )
                        }
                        className="mt-1 min-h-11"
                      />
                    </label>
                    <label className="text-sm">
                      Project user
                      <select
                        className={selectClass}
                        required={slot.roles.length === 0}
                        value={slot.userIds[0] ?? ""}
                        disabled={disabled}
                        onChange={(e) =>
                          setSlots(
                            editableSlots.map((s) =>
                              s.id === slot.id
                                ? {
                                    ...s,
                                    userIds: e.target.value
                                      ? [e.target.value]
                                      : [],
                                    roles: [],
                                  }
                                : s,
                            ),
                          )
                        }
                      >
                        <option value="">Choose a user</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} · {u.role}
                          </option>
                        ))}
                      </select>
                      {slot.roles.length > 0 && (
                        <span className="mt-1 block text-xs text-slate-600">
                          Existing role policy: {slot.roles.join(", ")}.
                          Choosing a user replaces it.
                        </span>
                      )}
                    </label>
                    <label className="text-sm">
                      Tag level
                      <select
                        className={selectClass}
                        value={slot.level ?? ""}
                        disabled={disabled}
                        onChange={(e) =>
                          setSlots(
                            editableSlots.map((s) =>
                              s.id === slot.id
                                ? {
                                    ...s,
                                    level:
                                      (e.target
                                        .value as SignatorySlot["level"]) ||
                                      undefined,
                                  }
                                : s,
                            ),
                          )
                        }
                      >
                        <option value="">All levels</option>
                        {LEVELS.map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11"
                      disabled={disabled}
                      aria-label={`Remove signature ${index + 1}`}
                      onClick={() =>
                        setSlots(editableSlots.filter((s) => s.id !== slot.id))
                      }
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
              {!editableSlots.length && (
                <p className="text-sm text-slate-600">
                  No signatories configured. No approval is inferred.
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={disabled || editableSlots.length >= 50}
                  onClick={() =>
                    setSlots([
                      ...editableSlots,
                      {
                        id: crypto.randomUUID(),
                        label: "",
                        userIds: [],
                        roles: [],
                      },
                    ])
                  }
                >
                  <Plus className="size-4" />
                  Add signatory
                </Button>
                <Button type="submit" disabled={disabled} className="min-h-11">
                  Save signatories
                </Button>
              </div>
            </form>
          </div>
        </details>
      )}
      {manage && (
        <details className="border-y border-slate-200 py-2">
          <summary className="min-h-11 cursor-pointer py-2 font-medium focus-visible:outline-2 focus-visible:outline-blue-700">
            Associate a checksheet
          </summary>
          {(!assets.length || !data.templates.length) && (
            <p className="pb-3 text-sm text-slate-600">
              {!assets.length
                ? "Add equipment in Assets before associating a checksheet."
                : "Import a requirement template in Templates and signatories first."}
            </p>
          )}
          <form
            className="grid gap-4 pb-4 pt-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_auto] md:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              const id = crypto.randomUUID();
              if (
                await run({
                  kind: "associate",
                  id,
                  assetId,
                  templateId,
                  level: (tagLevel as SignatorySlot["level"]) || undefined,
                })
              )
                setSelected(id);
            }}
          >
            <label className="min-w-0 text-sm">
              Equipment
              <select
                aria-label="Equipment"
                required
                className={selectClass}
                value={assetId}
                disabled={disabled}
                onChange={(e) => setAssetId(e.target.value)}
              >
                <option value="">Choose equipment</option>
                {availableAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.equipmentType} · {a.phase || "No phase"} ·{" "}
                    {a.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-sm">
              Requirement template
              <select
                aria-label="Requirement template"
                required
                className={selectClass}
                value={templateId}
                disabled={disabled}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">Choose a template</option>
                {data.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.revision}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Tag level
              <select
                aria-label="Tag level"
                className={selectClass}
                value={tagLevel}
                disabled={disabled}
                onChange={(e) => setTagLevel(e.target.value)}
              >
                <option value="">No tag</option>
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <Button
              className="min-h-11"
              disabled={disabled || !assets.length || !data.templates.length}
            >
              <FileCheck2 className="size-4" />
              Associate checksheet
            </Button>
          </form>
        </details>
      )}
      <div className="space-y-3">
        <label className="block max-w-lg text-sm">
          Find an equipment checksheet
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Equipment name or template"
            className="mt-1 min-h-11"
          />
        </label>
        <p className="text-sm text-slate-600">
          {sheetRows.length} associated checksheet
          {sheetRows.length === 1 ? "" : "s"}
        </p>
        <ul className="divide-y divide-slate-200">
          {sheetRows.map((s) => {
            const p = checksheetProgress(s);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={selected === s.id}
                  onClick={() => setSelected(s.id)}
                  className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 rounded-md px-3 py-3 text-left hover:bg-slate-50 aria-pressed:bg-blue-50 aria-pressed:text-blue-900 focus-visible:outline-2 focus-visible:outline-blue-700"
                >
                  <span className="min-w-0 break-words">
                    <span className="block font-medium">
                      {assets.find((a) => a.id === s.assetId)?.name ??
                        s.assetId}
                    </span>
                    <span className="text-sm text-slate-600">
                      {s.templateName} · {s.level ?? "No tag level"}
                    </span>
                  </span>
                  <span className="text-sm text-slate-600">
                    {p.answered}/{p.total} answered · {p.activeSignatures}{" "}
                    signatures
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {!sheetRows.length && (
          <p className="py-4 text-sm text-slate-600">
            {search.trim() && data.sheets.length
              ? "No checksheets match this search."
              : manage
                ? "Associate a template with an equipment item to begin."
                : "No checksheets linked to your assigned equipment yet."}
          </p>
        )}
      </div>
      {active && (
        <SheetDetail
          key={active.id}
          sheet={active}
          slots={data.signatorySlots}
          asset={assets.find((a) => a.id === active.assetId)}
          user={currentUser}
          disabled={!!disabled}
          run={run}
        />
      )}
    </section>
  );
}
function SheetDetail({
  sheet,
  slots,
  asset,
  user,
  disabled,
  run,
}: {
  sheet: ChecksheetInstance;
  slots: SignatorySlot[];
  asset?: Asset;
  user: User;
  disabled: boolean;
  run: (c: ChecksheetCommand) => Promise<boolean>;
}) {
  const progress = checksheetProgress(sheet);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    detailHeading.current?.scrollIntoView({ block: "start" });
    detailHeading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section
      className="space-y-5 border-t border-slate-300 pt-6"
      aria-label="Selected checksheet"
    >
      <div>
        <h3
          ref={detailHeading}
          tabIndex={-1}
          className="scroll-mt-36 break-words text-lg font-semibold focus:outline-none"
        >
          {asset?.name ?? sheet.assetId} · {sheet.templateName}
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Revision {sheet.templateRevision} · {progress.answered}/
          {progress.total} answered. Results and signatures are recorded
          separately.
        </p>
      </div>
      <ol className="divide-y divide-slate-200">
        {sheet.requirements.map((step, index) => {
          const saved = sheet.responses.find((r) => r.stepId === step.id);
          return (
            <li key={step.id} className="py-5">
              <form
                key={`${step.id}:${saved?.updatedAt ?? "new"}`}
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  await run({
                    kind: "save-response",
                    sheetId: sheet.id,
                    stepId: step.id,
                    answer: String(f.get("answer") ?? ""),
                    result: (String(f.get("result") ?? "") || undefined) as
                      "passed" | "failed" | "not-applicable" | undefined,
                  });
                }}
              >
                <h4 className="max-w-prose break-words font-medium">
                  {step.item ?? index + 1}. {step.requirement}
                </h4>
                <p className="text-xs text-slate-600">
                  {step.required ? "Required answer" : "Optional answer"}
                  {step.equipment ? ` · ${step.equipment}` : ""}
                  {step.discipline ? ` · ${step.discipline}` : ""}
                </p>
                {step.notes && (
                  <details>
                    <summary className="min-h-11 cursor-pointer py-2 text-sm text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-700">
                      Requirement notes
                    </summary>
                    <p className="mt-2 max-w-prose whitespace-pre-wrap break-words text-sm text-slate-600">
                      {step.notes}
                    </p>
                  </details>
                )}
                {step.sourceRef && (
                  <p className="break-words text-xs text-slate-600">
                    Source: {step.sourceRef}
                  </p>
                )}
                <label className="block text-sm">
                  Answer / observation
                  <Textarea
                    name="answer"
                    maxLength={10000}
                    defaultValue={saved?.answer ?? ""}
                    disabled={disabled}
                    className="mt-1 min-h-24"
                  />
                </label>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-48 text-sm">
                    Recorded result
                    <select
                      name="result"
                      defaultValue={saved?.result ?? ""}
                      disabled={disabled}
                      className={selectClass}
                    >
                      <option value="">No result recorded</option>
                      <option value="passed">Passed</option>
                      <option value="failed">Failed</option>
                      <option value="not-applicable">Not applicable</option>
                    </select>
                  </label>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={disabled}
                    className="min-h-11"
                  >
                    Save answer
                  </Button>
                </div>
              </form>
            </li>
          );
        })}
      </ol>
      <div className="border-t border-slate-200 pt-5">
        <h4 className="font-semibold">Signatures</h4>
        <p className="mt-1 text-sm text-slate-600">
          Signing records your identity and time. Editing an answer invalidates
          existing signatures; history is retained.
        </p>
        <ul className="mt-3 divide-y divide-slate-200">
          {slots
            .filter((slot) => signatoryApplies(slot, sheet))
            .map((slot) => {
              const signed = sheet.signatures.find(
                (s) => s.slotId === slot.id && !s.invalidatedAt,
              );
              return (
                <li
                  key={slot.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 break-words">
                    <p className="font-medium">{slot.label}</p>
                    <p className="text-sm text-slate-600">
                      {signed
                        ? `${signed.userName} · ${new Date(signed.signedAt).toLocaleString()}`
                        : "Unsigned"}
                    </p>
                  </div>
                  {!signed && canSignChecksheet(slot, user) && (
                    <div className="max-w-full space-y-1">
                      <Button
                        type="button"
                        className="min-h-11 max-w-full whitespace-normal text-left"
                        disabled={
                          disabled ||
                          progress.requiredAnswered < progress.requiredTotal
                        }
                        onClick={() =>
                          void run({
                            kind: "sign",
                            sheetId: sheet.id,
                            slotId: slot.id,
                          })
                        }
                      >
                        Sign as {user.name}
                      </Button>
                      {progress.requiredAnswered < progress.requiredTotal && (
                        <p className="text-xs text-slate-600">
                          {progress.requiredTotal - progress.requiredAnswered}{" "}
                          required answers still missing.
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
        {!slots.some((slot) => signatoryApplies(slot, sheet)) && (
          <p className="mt-3 text-sm text-slate-600">
            No signatories configured for this level.
          </p>
        )}
        {sheet.signatures.some((s) => s.invalidatedAt) && (
          <details className="mt-4">
            <summary className="min-h-11 cursor-pointer py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-700">
              Previous signatures
            </summary>
            <ul className="mt-2 space-y-2">
              {sheet.signatures
                .filter((s) => s.invalidatedAt)
                .map((sig, index) => (
                  <li
                    key={`${sig.slotId}:${sig.signedAt}:${index}`}
                    className="text-sm text-slate-600"
                  >
                    {sig.label} · {sig.userName} ·{" "}
                    {new Date(sig.signedAt).toLocaleString()} · invalidated:{" "}
                    {sig.invalidationReason}
                  </li>
                ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
