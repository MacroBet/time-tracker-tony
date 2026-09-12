"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  HardHat,
  LogOut,
  Settings,
  RefreshCw,
  LayoutDashboard,
  ListTodo,
  Users,
  Clock3,
  History,
  MessageSquare,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";
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
  const pathname = usePathname();
  const params = useSearchParams();
  const worker = currentUser.role === "worker";
  const view = params.get("view") || "tasks";
  const nav = worker
    ? [
        { label: "Home", href: "/dashboard", icon: LayoutDashboard },
        { label: "My tasks", href: "/my-tasks", icon: ListTodo },
        { label: "Time", href: "/time", icon: Clock3 },
        { label: "History", href: "/shift-history", icon: History },
        { label: "Settings", href: "/settings", icon: Settings },
      ]
    : [
        { label: "Dashboard", href: "/overview", icon: LayoutDashboard },
        { label: "Tasks", href: "/supervisor", icon: ListTodo },
        { label: "Team", href: "/supervisor?view=team", icon: Users },
        {
          label: "Time & attendance",
          short: "Time",
          href: "/supervisor?view=timesheets",
          icon: Clock3,
        },
        {
          label: "Feedback",
          href: "/supervisor?view=feedback",
          icon: MessageSquare,
        },
        { label: "Settings", href: "/settings", icon: Settings },
      ];
  const active = (href: string) => {
    const [path, query] = href.split("?");
    return (
      pathname === path &&
      (path !== "/supervisor" ||
        view === new URLSearchParams(query).get("view") ||
        (!query && view === "tasks"))
    );
  };
  const mobileNav = worker ? nav : nav.filter((n) => n.label !== "Feedback");
  const initials = currentUser.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  async function refresh() {
    setRefreshing(true);
    try {
      await refreshData();
      toast.success("Workspace refreshed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <div className="app-workspace min-h-screen">
      <aside className="workspace-sidebar fixed inset-y-0 left-0 z-30 hidden lg:flex w-56 flex-col text-slate-300">
        <Link
          href={worker ? "/dashboard" : "/overview"}
          className="flex items-center gap-3 px-5 h-20 border-b border-white/10"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/5">
            <HardHat className="size-6 text-amber-300" />
          </span>
          <span>
            <span className="block font-semibold text-white tracking-tight">
              FieldTrack
            </span>
            <span className="block text-[10px] uppercase tracking-[.15em] text-slate-400 mt-0.5">
              Time & task tracker
            </span>
          </span>
        </Link>
        <p className="px-5 pt-7 pb-3 text-[10px] uppercase tracking-[.16em] text-slate-500">
          Workspace
        </p>
        <nav aria-label="Main navigation" className="space-y-1 px-3">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n.href) ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-3 text-[13px] rounded-lg transition-colors ${active(n.href) ? "sidebar-link-active text-white" : "hover:bg-white/5 hover:text-white"}`}
            >
              <n.icon className="size-4 shrink-0" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mx-4 mt-7 rounded-lg border border-white/10 p-3">
          <div className="flex gap-2 items-center text-xs text-slate-400">
            <Building2 className="size-3.5" />
            Your company
          </div>
          <p className="text-xs text-slate-200 mt-2 truncate">
            {currentCompany?.name || "Project workspace"}
          </p>
        </div>
        <div className="mt-auto p-4 border-t border-white/10 flex items-center gap-3">
          <span className="size-9 shrink-0 rounded-full bg-blue-500/20 text-blue-200 grid place-items-center text-xs font-semibold">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-white truncate">
              {currentUser.name}
            </span>
            <span className="block text-[10px] capitalize text-slate-400 mt-1">
              {currentUser.role}
            </span>
          </span>
          <button
            aria-label="Sign out"
            onClick={logout}
            className="p-2 hover:text-white"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>
      <div className="lg:pl-56 pb-28 lg:pb-12">
        <header className="sticky top-0 z-20 border-b border-[#e2e9f4] bg-white/95 backdrop-blur-sm">
          <div className="max-w-[1440px] mx-auto h-[76px] px-4 sm:px-7 flex items-center gap-3">
            {back && (
              <Button variant="ghost" size="icon" asChild>
                <Link href={back} aria-label="Go back">
                  <ArrowLeft className="size-5" />
                </Link>
              </Button>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate text-[#111c30]">
                {title}
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                {subtitle ||
                  `${currentCompany?.name || "Your workspace"} · ${worker ? "Field team" : "Project operations"}`}
              </p>
            </div>
            <span className="hidden sm:flex gap-1.5 items-center text-[11px] text-slate-500 mr-2">
              <span
                className={`size-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-red-500"}`}
              />
              {isOnline ? "Connected" : "Offline"}
            </span>
            <Button
              aria-label="Refresh workspace"
              onClick={refresh}
              disabled={refreshing || !isOnline}
              variant="ghost"
              size="icon"
            >
              <RefreshCw
                className={`size-4 text-slate-500 ${refreshing ? "animate-spin" : ""}`}
              />
            </Button>
            <Link
              href="/settings"
              aria-label="Profile and settings"
              className="size-9 shrink-0 grid place-items-center rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-semibold"
            >
              {initials}
            </Link>
          </div>
        </header>
        {mode === "demo" && (
          <div className="bg-amber-50 text-amber-900 text-xs text-center p-2 border-b border-amber-100">
            Demo workspace · sample data · resets with the server
          </div>
        )}
        {!isOnline && (
          <div
            role="alert"
            className="bg-red-50 text-red-800 text-sm text-center p-3"
          >
            You are offline. Reconnect before saving updates.
          </div>
        )}
        <main
          id="main-content"
          className={`${wide ? "max-w-[1440px]" : "max-w-3xl"} mx-auto p-4 sm:p-7 space-y-5`}
        >
          {children}
        </main>
      </div>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 lg:hidden grid grid-cols-5 border-t border-[#e2e9f4] bg-white/95 backdrop-blur-sm pt-2 pb-[max(.6rem,env(safe-area-inset-bottom))]"
      >
        {mobileNav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active(n.href) ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2 text-[10px] font-medium ${active(n.href) ? "text-blue-600" : "text-slate-500"}`}
          >
            <n.icon className="size-5" />
            {"short" in n ? n.short : n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
