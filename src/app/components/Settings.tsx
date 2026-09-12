"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "./ui/input";
import { apiRequest } from "@/lib/api-client";
import { toast } from "sonner";
import { useApp } from "../contexts/AppContext";
import { homeFor } from "@/lib/domain";
import { AppShell } from "./AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
export function Settings() {
  const router = useRouter();
  const [changing, setChanging] = useState(false);
  const {
    currentUser,
    currentCompany,
    mode,
    isOnline,
    lastSyncTime,
    logout,
    refreshData,
  } = useApp();
  return (
    <AppShell title="Settings" back={homeFor(currentUser)}>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-semibold">{currentUser.name}</p>
          <p className="text-sm text-slate-500 break-all">
            {currentUser.email}
          </p>
          <p className="text-sm capitalize">
            {currentUser.role} · {currentCompany?.name}
          </p>
          <p className="text-xs text-slate-500">
            Access is limited to your assigned projects and role.
          </p>
        </CardContent>
      </Card>
      {mode === "neon" && (
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                setChanging(true);
                try {
                  await apiRequest("/api/auth/password", {
                    method: "POST",
                    body: JSON.stringify({
                      currentPassword: form.get("currentPassword"),
                      newPassword: form.get("newPassword"),
                    }),
                  });
                  router.replace("/");
                  router.refresh();
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Password change failed",
                  );
                } finally {
                  setChanging(false);
                }
              }}
            >
              <Input
                name="currentPassword"
                aria-label="Current password"
                type="password"
                autoComplete="current-password"
                placeholder="Current password"
                required
              />
              <Input
                name="newPassword"
                aria-label="New password"
                type="password"
                autoComplete="new-password"
                placeholder="New password (8+ characters)"
                minLength={8}
                required
              />
              <p className="text-xs text-slate-500">
                Changing your password signs out all sessions. Sign in again
                with your new password.
              </p>
              <Button disabled={changing || !isOnline}>Update password</Button>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Workspace status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            {isOnline ? "Online" : "Offline"} ·{" "}
            {mode === "neon" ? "Connected database" : "Local demo"}
          </p>
          <p className="text-sm text-slate-500">
            {mode === "neon"
              ? "Updates are saved to the server. Reconnect before saving when offline."
              : "Synthetic data is held temporarily on the local server. Restarting the server resets the demo."}
          </p>
          {lastSyncTime && (
            <p className="text-xs text-slate-500">
              Last refresh:{" "}
              {lastSyncTime.toLocaleString("en-GB", {
                timeZone: "Europe/Amsterdam",
              })}
            </p>
          )}
          <Button
            variant="outline"
            disabled={!isOnline}
            onClick={async () => {
              try {
                await refreshData();
                toast.success("Workspace refreshed");
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Refresh failed",
                );
              }
            }}
          >
            Refresh workspace
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Upcoming integrations</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-500 space-y-3">
          <p>
            Autodesk BIM 360 / ACC and the third source system are not connected
            yet. Source labels identify the origin of an activity; they do not
            imply live synchronisation.
          </p>
          <p>
            Push notifications, offline uploads and automatic site detection
            will be configured in a later phase.
          </p>
        </CardContent>
      </Card>
      <Button onClick={logout} variant="destructive" className="w-full h-12">
        Sign out
      </Button>
    </AppShell>
  );
}
