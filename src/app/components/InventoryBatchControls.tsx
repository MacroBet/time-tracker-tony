"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "../contexts/AppContext";
import type { Commissioning } from "@/lib/commissioning";
import {
  inventoryApplySchema,
  inventoryFileIdentity,
} from "@/lib/inventory-batch";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function InventoryBatchControls({
  projectId,
  state,
  embedded = false,
}: {
  projectId: string;
  state: Commissioning;
  embedded?: boolean;
}) {
  const { mutate, isOnline } = useApp();
  const [file, setFile] = useState<File | null>(null);
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
          "Choose an inventory-only file without schedule records.",
        );
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      const payloadSha256 = Array.from(new Uint8Array(hash), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      const data = inventoryApplySchema.parse({
        ...inventoryFileIdentity(payloadSha256, state.inventoryBatches ?? []),
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
          reason:
            plan.action === "inventory-restore"
              ? "Remove unchanged assets from the selected inventory import"
              : "Import inventory from selected JSON file",
          preview: false,
        }),
      });
      toast.success(
        plan.action === "inventory-restore"
          ? "Imported assets removed; history retained"
          : "Inventory imported",
      );
      setPlan(null);
      setFile(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className={
        embedded ? "border-t pt-3" : "rounded-xl border bg-white p-4 sm:p-5"
      }
    >
      <summary className="min-h-11 cursor-pointer font-semibold">
        Import inventory
      </summary>
      <div className="mt-4 space-y-4">
        <p className="max-w-prose text-sm text-slate-600">
          Choose an inventory JSON file, review the changes, then import.
          Existing assets, tasks and assignments are preserved.
        </p>
        <label className="block text-sm font-medium">
          Inventory JSON
          <Input
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
          disabled={busy || !isOnline || !file}
          onClick={() => void prepareFile()}
        >
          Preview import
        </Button>
        {plan && (
          <section
            aria-label="Inventory batch preview"
            className="space-y-3 border-t pt-4"
          >
            <h3 className="font-semibold">
              {plan.insertedCount} additions · {plan.removedCount} removals
            </h3>
            <p className="text-sm text-slate-600">
              Schedule, existing tasks and assignments are outside this
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
            {plan.action === "inventory-apply" && (
              <details className="text-sm text-slate-600">
                <summary className="min-h-11 cursor-pointer">
                  Technical details
                </summary>
                <p className="break-all">
                  Import reference: {(plan.data as { batchId: string }).batchId}
                </p>
                <p className="break-all">
                  JSON SHA256:{" "}
                  {(plan.data as { payloadSha256: string }).payloadSha256}
                </p>
                <p>
                  The selected file is JSON. Its fingerprint does not identify
                  the original Excel. Any previously recorded source provenance
                  is retained.
                </p>
              </details>
            )}
            {!plan.errors.length && !plan.changes.length && (
              <p className="text-sm text-slate-600">
                No changes to save. This operation has already been completed.
              </p>
            )}
            <Button
              className="min-h-11"
              disabled={
                busy ||
                !isOnline ||
                plan.errors.length > 0 ||
                !plan.changes.length ||
                plan.version !== state.version
              }
              onClick={() => void save()}
            >
              {plan.action === "inventory-restore"
                ? "Remove imported assets"
                : "Import inventory"}
            </Button>
          </section>
        )}
        {(state.inventoryBatches ?? []).length > 0 && (
          <details className="space-y-2 border-t pt-4">
            <summary className="min-h-11 cursor-pointer font-medium">
              Previous imports and removal
            </summary>
            <p className="text-sm text-slate-600">
              Remove only unchanged imported assets with no task or checksheet
              links. History is retained.
            </p>

            {state.inventoryBatches?.map((batch) => (
              <div
                key={batch.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0 break-words text-sm">
                  {new Date(batch.appliedAt).toLocaleDateString()} ·{" "}
                  {batch.inserted.length} assets · {batch.status}
                  <details>
                    <summary className="min-h-11 content-center cursor-pointer">
                      Technical details
                    </summary>
                    <span className="break-all">
                      Import reference: {batch.id}
                      <br />
                      Source SHA256: {batch.sourceSha256}
                      <br />
                      JSON SHA256: {batch.payloadSha256}
                    </span>
                  </details>
                </div>
                {batch.status === "applied" && (
                  <Button
                    className="min-h-11"
                    variant="outline"
                    disabled={busy || !isOnline}
                    onClick={() =>
                      void preview("inventory-restore", { batchId: batch.id })
                    }
                  >
                    Preview removal
                  </Button>
                )}
              </div>
            ))}
          </details>
        )}
      </div>
    </details>
  );
}
