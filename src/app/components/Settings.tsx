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
  const [refreshing, setRefreshing] = useState(false);
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
      <div className="max-w-2xl space-y-5">
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
                aria-busy={changing}
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
                <div className="space-y-2">
                  <label
                    className="block text-sm font-medium"
                    htmlFor="settings-current-password"
                  >
                    Current password
                  </label>
                  <Input
                    id="settings-current-password"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    disabled={changing}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className="block text-sm font-medium"
                    htmlFor="settings-new-password"
                  >
                    New password
                  </label>
                  <Input
                    id="settings-new-password"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    disabled={changing}
                    aria-describedby="settings-password-help"
                    minLength={8}
                    required
                  />
                </div>
                <p
                  id="settings-password-help"
                  className="text-sm text-slate-600"
                >
                  Use at least 8 characters. Changing your password signs out
                  all sessions. Sign in again with your new password.
                </p>
                <Button disabled={changing || !isOnline}>
                  {changing ? "Updating password…" : "Update password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Workspace status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm" role="status">
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
              disabled={!isOnline || refreshing}
              aria-busy={refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await refreshData();
                  toast.success("Workspace refreshed");
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Refresh failed",
                  );
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              {refreshing ? "Refreshing workspace…" : "Refresh workspace"}
            </Button>
          </CardContent>
        </Card>
        <details className="border-y border-slate-200 py-2">
          <summary className="min-h-11 cursor-pointer py-2 font-medium focus-visible:outline-2 focus-visible:outline-blue-700">
            Upcoming integrations
          </summary>
          <div className="text-sm leading-6 text-slate-600 space-y-3 pb-3">
            <p>
              Autodesk BIM 360 / ACC and the third source system are not
              connected yet. Source labels identify the origin of an activity;
              they do not imply live synchronisation.
            </p>
            <p>
              Push notifications, offline uploads and automatic site detection
              will be configured in a later phase.
            </p>
          </div>
        </details>
        <Button
          onClick={logout}
          variant="destructive"
          className="w-full h-12 sm:w-auto"
        >
          Sign out
        </Button>
      </div>
    </AppShell>
  );
}
