"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "../contexts/AppContext";
import type { Commissioning } from "@/lib/commissioning";
import { inventoryApplySchema } from "@/lib/inventory-batch";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function InventoryBatchControls({
  projectId,
  state,
}: {
  projectId: string;
  state: Commissioning;
}) {
  const { mutate, isOnline } = useApp();
  const [file, setFile] = useState<File | null>(null),
    [source, setSource] = useState(""),
    [batchId, setBatchId] = useState(""),
    [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<{
    action: "inventory-apply" | "inventory-restore";
    data: object;
    version: number;
    changes: string[];
    errors: string[];
    insertedCount: number;
    removedCount: number;
  } | null>(null);
  async function preview(
    action: "inventory-apply" | "inventory-restore",
    data: object,
  ) {
    setBusy(true);
    setPlan(null);
    try {
      const result = await mutate<{
        changes: string[];
        errors: string[];
        insertedCount: number;
        removedCount: number;
      }>(`/api/projects/${projectId}/commissioning`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          data,
          version: state.version,
          preview: true,
          reason: "Preview scoped inventory batch without saving",
        }),
      });
      setPlan({ action, data, version: state.version, ...result });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }
  async function prepareFile() {
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 4 * 1024 * 1024)
        throw new Error("Choose an inventory JSON smaller than 4 MiB.");
      const bytes = await file.arrayBuffer(),
        raw = JSON.parse(new TextDecoder().decode(bytes));
      if (raw.schedule?.length || raw.programmeId !== undefined)
        throw new Error(
          "Choose an inventory-only file without programme records.",
        );
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      const payloadSha256 = Array.from(new Uint8Array(hash), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      const data = inventoryApplySchema.parse({
        batchId,
        sourceSha256: source,
        payloadSha256,
        assets: raw.assets,
      });
      await preview("inventory-apply", data);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "The inventory file could not be read",
      );
      setPlan(null);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!plan) return;
    setBusy(true);
    try {
      await mutate(`/api/projects/${projectId}/commissioning`, {
        method: "PATCH",
        body: JSON.stringify({
          action: plan.action,
          data: plan.data,
          version: plan.version,
          reason,
          preview: false,
        }),
      });
      toast.success(
        plan.action === "inventory-restore"
          ? "Inventory batch restored; history retained"
          : "Inventory batch saved",
      );
      setPlan(null);
      setFile(null);
      setReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border bg-white p-4 sm:p-5">
      <summary className="min-h-11 cursor-pointer font-semibold">
        Scoped inventory import and restore
      </summary>
      <div className="mt-4 space-y-4">
        <p className="max-w-prose text-sm text-slate-600">
          Add source inventory entries without creating commissioning tasks or
          asserting installed equipment. The batch keeps its source and record
          hashes. Restore removes only its unchanged, unreferenced additions.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Batch reference
            <Input
              className="mt-1 min-h-11"
              value={batchId}
              onChange={(e) => {
                setBatchId(e.target.value);
                setPlan(null);
              }}
              maxLength={150}
            />
          </label>
          <label className="text-sm font-medium">
            Original source SHA256
            <Input
              className="mt-1 min-h-11"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPlan(null);
              }}
              maxLength={64}
            />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Inventory JSON
          <input
            type="file"
            accept=".json,application/json"
            className="mt-2 block min-h-11 w-full text-sm"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPlan(null);
            }}
          />
        </label>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={
            busy ||
            !isOnline ||
            !file ||
            !batchId.trim() ||
            !/^[a-f0-9]{64}$/.test(source)
          }
          onClick={() => void prepareFile()}
        >
          Preview inventory batch
        </Button>
        {(state.inventoryBatches ?? []).length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-semibold">Saved batches</h3>
            {state.inventoryBatches?.map((batch) => (
              <div
                key={batch.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <p className="min-w-0 break-words text-sm">
                  {batch.id} · {batch.inserted.length} entries · {batch.status}
                </p>
                {batch.status === "applied" && (
                  <Button
                    className="min-h-11"
                    variant="outline"
                    disabled={busy || !isOnline}
                    onClick={() =>
                      void preview("inventory-restore", { batchId: batch.id })
                    }
                  >
                    Preview restore
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {plan && (
          <section
            aria-label="Inventory batch preview"
            className="space-y-3 border-t pt-4"
          >
            <h3 className="font-semibold">
              {plan.insertedCount} additions · {plan.removedCount} removals
            </h3>
            <p className="text-sm text-slate-600">
              Programme, existing tasks and assignments are outside this
              operation.
            </p>
            {plan.errors.map((error, i) => (
              <p className="text-sm text-red-700" role="alert" key={i}>
                {error}
              </p>
            ))}
            {plan.version !== state.version && (
              <p role="alert" className="text-sm text-amber-800">
                The project changed. Preview again before saving.
              </p>
            )}
            <label className="block text-sm font-medium">
              Reason for this change
              <Input
                className="mt-1 min-h-11"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
              />
            </label>
            <Button
              className="min-h-11"
              disabled={
                busy ||
                !isOnline ||
                plan.errors.length > 0 ||
                !plan.changes.length ||
                plan.version !== state.version ||
                reason.trim().length < 10
              }
              onClick={() => void save()}
            >
              {plan.action === "inventory-restore"
                ? "Confirm scoped restore"
                : "Confirm inventory import"}
            </Button>
          </section>
        )}
      </div>
    </details>
  );
}
