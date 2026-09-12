"use client";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  LogOut,
  Settings,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";
import { homeFor } from "@/lib/domain";
export function AppShell({
  title,
  subtitle,
  back,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const { currentUser, currentCompany, mode, isOnline, refreshData, logout } =
    useApp();
  const [refreshing, setRefreshing] = useState(false);
  async function refresh() {
    setRefreshing(true);
    try {
      await refreshData();
      toast.success("Workspace refreshed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header
        className={`sticky top-0 z-20 text-white shadow-sm ${currentUser.role === "worker" ? "bg-gradient-to-r from-blue-600 to-blue-700" : "bg-gradient-to-r from-purple-600 to-purple-700"}`}
      >
        <div
          className={`${wide ? "max-w-6xl" : "max-w-2xl"} mx-auto px-4 py-4 flex items-center gap-3`}
        >
          {back ? (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-white hover:bg-white/15"
              asChild
            >
              <Link href={back} aria-label="Go back">
                <ArrowLeft />
              </Link>
            </Button>
          ) : (
            <Building2 className="size-8 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight truncate">
              {title}
            </h1>
            <p className="text-xs sm:text-sm text-white/80 truncate">
              {subtitle ||
                `${currentUser.name} · ${currentCompany?.name || "Project team"}`}
            </p>
          </div>
          {!back && (
            <>
              <Button
                aria-label="Refresh workspace"
                onClick={refresh}
                disabled={refreshing || !isOnline}
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/15"
              >
                <RefreshCw className={refreshing ? "animate-spin" : ""} />
              </Button>
              <Button
                aria-label="Settings"
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/15"
                asChild
              >
                <Link href="/settings">
                  <Settings />
                </Link>
              </Button>
              <Button
                aria-label="Sign out"
                onClick={logout}
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/15"
              >
                <LogOut />
              </Button>
            </>
          )}
        </div>
      </header>
      {mode === "demo" && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs text-center py-2 px-4">
          Demo workspace · sample data · changes reset with the local server
        </div>
      )}
      {!isOnline && (
        <div
          role="alert"
          className="bg-red-50 border-b border-red-200 text-red-800 text-sm text-center py-3 px-4"
        >
          You are offline. Reconnect before saving updates.
        </div>
      )}
      <main
        id="main-content"
        className={`${wide ? "max-w-6xl" : "max-w-2xl"} mx-auto p-4 sm:p-6 space-y-5`}
      >
        {children}
      </main>
      <footer className="text-center text-xs text-slate-400 py-6">
        <Link href={homeFor(currentUser)}>FieldTrack · Site operations</Link>
      </footer>
    </div>
  );
}
