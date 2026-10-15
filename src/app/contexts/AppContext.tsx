"use client";
import {
  useEffect,
  createContext,
  useContext,
  useState,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { type Bootstrap, type Company } from "@/lib/domain";
import { apiRequest } from "@/lib/api-client";
interface AppContextType extends Bootstrap {
  selectedProjectId: string;
  selectProject: (id: string) => void;
  currentCompany: Company | null;
  isOnline: boolean;
  lastSyncTime: Date | null;
  refreshData: () => Promise<void>;
  logout: () => Promise<void>;
  mutate: <T>(url: string, options: RequestInit) => Promise<T>;
}
const AppContext = createContext<AppContextType | undefined>(undefined);
const subscribeOnline = (callback: () => void) => {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
};
export function AppProvider({
  children,
  initialData,
}: {
  children: ReactNode;
  initialData: Bootstrap;
}) {
  const [data, setData] = useState(initialData);
  const [projectId, selectProject] = useState(
    (initialData.mode === "demo" &&
      initialData.projects.find((project) => project.id === "p-demo-rich")
        ?.id) ||
      initialData.projects[0]?.id ||
      "",
  );
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const router = useRouter();
  const refreshData = useCallback(async () => {
    const next = await apiRequest<Bootstrap>("/api/bootstrap");
    setData(next);
    setLastSyncTime(new Date());
  }, []);
  useEffect(() => {
    const refresh = () => {
      if (navigator.onLine && document.visibilityState === "visible")
        void refreshData().catch(() => {});
    };
    const timer = window.setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refreshData]);
  async function mutate<T>(url: string, options: RequestInit) {
    if (!navigator.onLine)
      throw new Error("You are offline. Reconnect before saving.");
    const result = await apiRequest<T>(url, options);
    try {
      await refreshData();
    } catch {
      toast.warning(
        "Saved, but the view could not refresh. Reload when connected.",
      );
    }
    return result;
  }
  async function logout() {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      router.replace("/");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-out failed.");
    }
  }
  return (
    <AppContext.Provider
      value={{
        ...data,
        selectedProjectId: data.projects.some((p) => p.id === projectId)
          ? projectId
          : (data.projects[0]?.id ?? ""),
        selectProject,
        currentCompany:
          data.companies.find((c) => c.id === data.currentUser.companyId) ??
          null,
        isOnline,
        lastSyncTime,
        refreshData,
        logout,
        mutate,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider.");
  return context;
}
