"use client";
import { AssistantEntry } from "./AssistantEntry";
import { hasModule, type Module } from "@/lib/commissioning";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
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
  Boxes,
  ShieldCheck,
  FileBarChart,
  GanttChart,
  MoreHorizontal,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";
import { InfoPopover } from "./InfoPopover";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  module?: Module;
};
const mobileTitles: Record<string, string> = {
  "Task management": "Tasks",
  "Team management": "People",
  "Management reports": "Reports",
  "Administrator control": "Admin",
  "Checksheets and remaining work": "Checksheets",
  "Project assistant": "Assistant",
  "Time & attendance": "Attendance",
  "Time tracking": "Time",
  "Activity details": "Activity",
  "Workspace feedback": "Feedback",
  "Task unavailable": "Unavailable",
};
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
  const {
    currentUser,
    currentCompany,
    mode,
    isOnline,
    refreshData,
    logout,
    projects,
    selectedProjectId,
    selectProject,
  } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const worker = currentUser.role === "worker";
  const view = params.get("view") || "tasks";
  const primary: NavigationItem[] = worker
    ? [
        {
          label: "Home",
          href: "/dashboard",
          icon: LayoutDashboard,
          module: "time",
        },
        {
          label: "My tasks",
          href: "/my-tasks",
          icon: ListTodo,
          module: "tasks",
        },
        { label: "Time", href: "/time", icon: Clock3, module: "time" },
        {
          label: "Assets",
          href: "/commissioning",
          icon: Boxes,
          module: "commissioning",
        },
      ]
    : [
        {
          label: "Overview",
          href: "/overview",
          icon: LayoutDashboard,
          module: "dashboard",
        },
        {
          label: "Schedule",
          href: hasModule(currentUser, "commissioning")
            ? "/schedule"
            : "/schedule?view=overdue",
          icon: GanttChart,
          module: hasModule(currentUser, "commissioning")
            ? "commissioning"
            : "dashboard",
        },
        {
          label: "Assets",
          href: "/commissioning",
          icon: Boxes,
          module: "commissioning",
        },
        {
          label: "Tasks",
          href: "/supervisor",
          icon: ListTodo,
          module: "tasks",
        },
      ];
  const organization: NavigationItem[] = worker
    ? [
        {
          label: "Shift history",
          href: "/shift-history",
          icon: History,
          module: "time",
        },
      ]
    : [
        {
          label: "People",
          href: "/supervisor?view=team",
          icon: Users,
          module: "team",
        },
        {
          label: "Time & attendance",
          href: "/supervisor?view=timesheets",
          icon: Clock3,
          module: "time",
        },
        {
          label: "Reports",
          href: "/reports",
          icon: FileBarChart,
          module: "reports",
        },
        ...(hasModule(currentUser, "tasks") &&
        hasModule(currentUser, "commissioning")
          ? [{ label: "Assistant", href: "/copilot", icon: MessageSquareText }]
          : []),
      ];
  const utilities: NavigationItem[] = [
    {
      label: "Checksheets & works to go",
      href: "/checksheets",
      icon: ShieldCheck,
      module: "commissioning",
    },
    ...(!worker
      ? [
          {
            label: "Project feedback",
            href: "/supervisor?view=feedback",
            icon: MessageSquare,
            module: "feedback" as Module,
          },
        ]
      : []),
    { label: "Settings", href: "/settings", icon: Settings },
    ...(currentUser.role === "admin"
      ? [{ label: "Admin control", href: "/admin", icon: ShieldCheck }]
      : []),
  ];
  const permitted = (items: NavigationItem[]) =>
    items.filter((item) => !item.module || hasModule(currentUser, item.module));
  const primaryNav = permitted(primary);
  const organizationNav = permitted(organization);
  const utilityNav = permitted(utilities);
  const secondaryNav = [...organizationNav, ...utilityNav];
  const active = (href: string) => {
    const [path, query] = href.split("?");
    return (
      (pathname === path ||
        (path === "/schedule" && pathname === "/overdue")) &&
      (path !== "/supervisor" ||
        view === new URLSearchParams(query).get("view") ||
        (!query && view === "tasks"))
    );
  };
  const secondaryActive = secondaryNav.some((item) => active(item.href));
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
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[100] inline-flex min-h-11 -translate-y-24 items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white focus:translate-y-0"
      >
        Skip to main content
      </a>
      <aside className="workspace-sidebar fixed inset-y-0 left-0 z-30 hidden lg:flex w-56 flex-col text-slate-300">
        <Link
          href={primaryNav[0]?.href ?? "/settings"}
          className="flex items-center gap-3 px-5 h-20 border-b border-white/10"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/5">
            <HardHat className="size-6 text-amber-300" />
          </span>
          <span>
            <span className="block font-semibold text-white tracking-tight">
              FieldTrack
            </span>
          </span>
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
          <nav aria-label="Project navigation" className="space-y-1">
            {primaryNav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className={`min-h-12 flex items-center gap-3 px-3 py-3 text-sm rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-blue-300 ${active(n.href) ? "sidebar-link-active text-white" : "hover:bg-white/5 hover:text-white"}`}
              >
                <n.icon className="size-4 shrink-0" />
                {n.label}
              </Link>
            ))}
          </nav>
          {organizationNav.length > 0 && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <h2 className="px-3 mb-2 text-xs font-medium text-slate-400">
                {worker ? "Your records" : "Organization"}
              </h2>
              <nav aria-label="Organization navigation" className="space-y-0.5">
                {organizationNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active(item.href) ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-blue-300 ${active(item.href) ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}
          <nav
            aria-label="Workspace tools"
            className="mt-4 border-t border-white/10 pt-3 space-y-0.5"
          >
            {utilityNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active(item.href) ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-xs focus-visible:outline-2 focus-visible:outline-blue-300 ${active(item.href) ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="border-t border-white/10 px-4 pt-3">
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <Building2 className="size-3.5 shrink-0" />
            <span className="truncate">
              {currentCompany?.name || "Project workspace"}
            </span>
          </p>
        </div>
        <div className="p-4 flex items-center gap-3">
          <span className="size-9 shrink-0 rounded-full bg-blue-500/20 text-blue-200 grid place-items-center text-xs font-semibold">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-white truncate">
              {currentUser.name}
            </span>
            <span className="block text-xs capitalize text-slate-300 mt-1">
              {currentUser.role}
            </span>
          </span>
          <button
            aria-label="Sign out"
            onClick={logout}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-300"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>
      <div className="lg:pl-56 pb-28 lg:pb-12">
        <header className="sticky top-0 z-20 border-b border-[#e2e9f4] bg-white/95 backdrop-blur-sm">
          <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-7 lg:flex lg:gap-4">
            <div className="flex min-w-0 items-center gap-2 max-[359px]:col-span-2 lg:shrink-0">
              {back && (
                <Button variant="ghost" size="icon" className="size-11" asChild>
                  <Link href={back} aria-label="Go back">
                    <ArrowLeft className="size-5" />
                  </Link>
                </Button>
              )}
              <div className="flex min-w-0 items-center gap-1">
                <h1
                  aria-label={title}
                  className="workspace-page-title text-lg leading-tight sm:text-2xl font-semibold tracking-tight text-[#111c30]"
                >
                  <span className="sm:hidden">
                    {mobileTitles[title] ?? title}
                  </span>
                  <span className="hidden sm:inline">{title}</span>
                </h1>
                {subtitle && (
                  <span
                    className={
                      back && projects.length > 0
                        ? "hidden sm:contents"
                        : "contents"
                    }
                  >
                    <InfoPopover label={`About ${title}`}>
                      <p>{subtitle}</p>
                    </InfoPopover>
                  </span>
                )}
              </div>
            </div>
            {projects.length > 0 && (
              <label className="order-3 col-span-2 flex min-w-0 items-center gap-2 text-sm text-slate-600 lg:order-none lg:ml-3 lg:flex-1 lg:max-w-md">
                <span className="shrink-0">Project</span>
                {back && subtitle && (
                  <span className="contents sm:hidden">
                    <InfoPopover label={`About ${title}`}>
                      <p>{subtitle}</p>
                    </InfoPopover>
                  </span>
                )}
                <select
                  aria-label="Active project"
                  className="min-h-11 w-full min-w-0 rounded-md border bg-slate-50 px-3 text-sm font-medium text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600"
                  value={selectedProjectId}
                  onChange={(e) => {
                    if (
                      params.has("projectId") &&
                      params.get("projectId") !== e.target.value
                    )
                      router.replace(pathname);
                    selectProject(e.target.value);
                  }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex shrink-0 items-center gap-1 max-[359px]:col-span-2 max-[359px]:row-start-2 max-[359px]:justify-self-end sm:gap-2 lg:ml-auto">
              <AssistantEntry />
              <span className="hidden sm:flex gap-1.5 items-center text-[11px] text-slate-500 mr-2">
                <span
                  className={`size-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-red-500"}`}
                />
                {isOnline ? "Online" : "Offline"}
              </span>
              <Button
                aria-label="Refresh workspace"
                onClick={refresh}
                disabled={refreshing || !isOnline}
                variant="ghost"
                size="icon"
                className="size-11"
              >
                <RefreshCw
                  className={`size-4 text-slate-500 ${refreshing ? "animate-spin" : ""}`}
                />
              </Button>
              <Link
                href="/settings"
                aria-label="Profile and settings"
                className="size-11 shrink-0 grid place-items-center rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                {initials}
              </Link>
            </div>
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
          tabIndex={-1}
          className={`${wide ? "max-w-[1440px]" : "max-w-3xl"} mx-auto p-4 sm:p-7 space-y-5`}
        >
          {children}
        </main>
      </div>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 lg:hidden grid border-t border-[#e2e9f4] bg-white pt-1 pb-[max(.5rem,env(safe-area-inset-bottom))]"
        style={{
          gridTemplateColumns: `repeat(${primaryNav.length + 1}, minmax(0, 1fr))`,
        }}
      >
        {primaryNav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active(n.href) ? "page" : undefined}
            className={`flex min-h-14 min-w-0 flex-col justify-center items-center gap-1 px-1 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-blue-600 ${active(n.href) ? "text-blue-700 bg-blue-50" : "text-slate-600"}`}
          >
            <n.icon className="size-5" />
            <span className="max-w-full truncate">{n.label}</span>
          </Link>
        ))}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-blue-600 ${secondaryActive ? "text-blue-700 bg-blue-50" : "text-slate-600"}`}
              aria-label={
                secondaryActive
                  ? "More navigation, current section"
                  : "More navigation"
              }
            >
              <MoreHorizontal className="size-5" />
              <span>More</span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[85dvh] overflow-y-auto rounded-t-xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] [&>button]:size-11 [&>button]:flex [&>button]:items-center [&>button]:justify-center"
          >
            <SheetHeader className="pr-16 pb-0">
              <SheetTitle>More</SheetTitle>
              <SheetDescription>
                {currentUser.name} · {currentCompany?.name || "Workspace"}
              </SheetDescription>
            </SheetHeader>
            <nav aria-label="More navigation" className="px-4">
              {organizationNav.length > 0 && (
                <div className="pb-3">
                  <h3 className="px-3 py-2 text-xs font-medium text-slate-600">
                    {worker ? "Your records" : "Organization"}
                  </h3>
                  {organizationNav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={active(item.href) ? "page" : undefined}
                      className={`flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-600 ${active(item.href) ? "bg-blue-50 text-blue-700" : "text-slate-800 hover:bg-slate-50"}`}
                    >
                      <item.icon className="size-5" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
              <div className="border-t pt-2">
                {utilityNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active(item.href) ? "page" : undefined}
                    className={`flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-600 ${active(item.href) ? "bg-blue-50 text-blue-700" : "text-slate-800 hover:bg-slate-50"}`}
                  >
                    <item.icon className="size-5" />
                    {item.label}
                  </Link>
                ))}
                <button
                  onClick={() => {
                    setMoreOpen(false);
                    void logout();
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-sm text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <LogOut className="size-5" />
                  Sign out
                </button>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
