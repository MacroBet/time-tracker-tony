"use client";
import { useState } from "react";
import {
  commissioning,
  TAG_REVIEWS,
  tagReviewLabels,
  type CommissioningTask,
} from "@/lib/commissioning";
import type { Project, Task } from "@/lib/domain";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { useApp } from "../contexts/AppContext";
import { toast } from "sonner";
export function cxFromForm(
  form: FormData,
  base?: CommissioningTask,
): CommissioningTask {
  const text = (key: string) =>
    String(form.get(`cx-${key}`) ?? "").trim() || undefined;
  const number = (key: string) =>
    text(key) === undefined ? undefined : Number(text(key));
  return {
    ...base,
    kind: (text("kind") ?? "task") as CommissioningTask["kind"],
    result: base?.result ?? "untested",
    assetId: text("assetId"),
    activityId: text("activityId"),
    level: text("level") as CommissioningTask["level"],
    qualityTag: text("qualityTag"),
    tagReview:
      text("kind") === "tag"
        ? (text("tagReview") as CommissioningTask["tagReview"])
        : undefined,
    blockerRisk: text("blockerRisk"),
    handoverType: text("handoverType") as CommissioningTask["handoverType"],
    conforming: number("conforming"),
    nonConforming: number("nonConforming"),
  };
}
export function CommissioningFields({
  project,
  value,
}: {
  project?: Project;
  value?: CommissioningTask;
}) {
  const state = commissioning(project),
    [kind, setKind] = useState(value?.kind ?? "task"),
    [assetId, setAssetId] = useState(value?.assetId ?? "");
  const asset = state.assets.find((a) => a.id === assetId);
  const levels = state.config.levels.filter(
    (l) => !asset || asset.levels.includes(l),
  );
  return (
    <fieldset className="border-t pt-4 space-y-3">
      <legend className="text-sm font-semibold">Commissioning links</legend>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">
          Record type
          <select
            name="cx-kind"
            className="field-select"
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as CommissioningTask["kind"])
            }
          >
            {["task", "issue", "tag", "documentation"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        {kind === "tag" && (
          <label className="text-sm">
            Tag review status
            <select
              name="cx-tagReview"
              className="field-select"
              defaultValue={value?.tagReview ?? ""}
            >
              <option value="">Not recorded (legacy workflow approval)</option>
              {TAG_REVIEWS.map((review) => (
                <option key={review} value={review}>
                  {tagReviewLabels[review]}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-600">
              Separate from workflow and test result. Only A counts as explicit
              approval; AC requires further review.
            </span>
          </label>
        )}
        <label className="text-sm">
          Asset / group
          <select
            name="cx-assetId"
            className="field-select"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
          >
            <option value="">Unlinked</option>
            {state.assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          P6 Activity ID
          <select
            name="cx-activityId"
            className="field-select"
            defaultValue={value?.activityId ?? ""}
          >
            <option value="">Unlinked</option>
            {state.schedule.map((s) => (
              <option key={s.activityId} value={s.activityId}>
                {s.activityId} · {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Commissioning level
          <select
            key={assetId}
            name="cx-level"
            className="field-select"
            defaultValue={value?.level ?? ""}
          >
            <option value="">Not specified</option>
            {[
              ...new Set([...levels, ...(value?.level ? [value.level] : [])]),
            ].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Quality tag
          <Input
            name="cx-qualityTag"
            defaultValue={value?.qualityTag}
            maxLength={100}
            placeholder="Tag reference / colour"
          />
        </label>
        <label className="text-sm">
          Handover document type
          <select
            name="cx-handoverType"
            className="field-select"
            defaultValue={value?.handoverType ?? ""}
          >
            <option value="">Not applicable</option>
            {["manual", "warranty", "training", "sign-off", "test-report"].map(
              (t) => (
                <option key={t}>{t}</option>
              ),
            )}
          </select>
        </label>
        <label className="text-sm">
          Conforming observations
          <Input
            type="number"
            min={0}
            max={100000}
            name="cx-conforming"
            defaultValue={value?.conforming}
            placeholder="Not recorded"
          />
        </label>
        <label className="text-sm">
          Non-conforming observations
          <Input
            type="number"
            min={0}
            max={100000}
            name="cx-nonConforming"
            defaultValue={value?.nonConforming}
            placeholder="Not recorded"
          />
        </label>
      </div>
      <label className="block text-sm">
        Blocker impact / risk
        <Textarea
          name="cx-blockerRisk"
          maxLength={2000}
          defaultValue={value?.blockerRisk}
        />
      </label>
      <p className="text-xs text-slate-500">
        Linked forecast finish determines whether the activity is overdue. Tags
        require an asset and an applicable level. Upload manuals, test reports
        and approvals as evidence.
      </p>
    </fieldset>
  );
}
export function TestProgress({ task }: { task: Task }) {
  const { mutate, isOnline } = useApp(),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await mutate(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          version: task.version,
          result: f.get("result"),
          ...(f.get("progress") !== ""
            ? { progress: Number(f.get("progress")) }
            : {}),
          notes: f.get("note"),
        }),
      });
      toast.success("Test result recorded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      key={task.version}
      onSubmit={save}
      className="rounded-xl border bg-white p-5 space-y-3"
    >
      <h3 className="font-semibold">Test result & progress</h3>
      <p className="text-xs text-slate-500">
        Recording a passed test does not approve or close the activity.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Test result
          <select
            name="result"
            className="field-select"
            defaultValue={task.cx?.result ?? "untested"}
          >
            {["untested", "passed", "failed", "retest"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Progress (%)
          <Input
            name="progress"
            type="number"
            min={0}
            max={100}
            defaultValue={task.cx?.progress}
          />
        </label>
      </div>
      <label className="block text-sm">
        Result / retest note
        <Textarea name="note" required minLength={10} maxLength={5000} />
      </label>
      <Button disabled={busy || !isOnline}>Record progress</Button>
    </form>
  );
}
