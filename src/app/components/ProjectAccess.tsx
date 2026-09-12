"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";
export function ProjectAccess({ userId }: { userId: string }) {
  const { projects, memberships, mutate, isOnline } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <details className="pt-2">
      <summary className="text-sm font-medium cursor-pointer">
        Manage project access
      </summary>
      <form
        className="space-y-3 mt-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          try {
            await mutate(`/api/team/${userId}`, {
              method: "PATCH",
              body: JSON.stringify({ projectIds: form.getAll("projectIds") }),
            });
            toast.success("Access updated; user must sign in again");
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "Access update failed",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {projects.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm">
            <input
              name="projectIds"
              type="checkbox"
              value={p.id}
              defaultChecked={memberships.some(
                (m) => m.userId === userId && m.projectId === p.id,
              )}
              className="size-5"
            />
            {p.name}
          </label>
        ))}
        <p className="text-xs text-slate-500">
          Reassign open work before removing a worker from a project. Saving
          signs out this account.
        </p>
        <Button disabled={busy || !isOnline} variant="outline">
          Save project access
        </Button>
      </form>
    </details>
  );
}
