import { hasModule } from "@/lib/commissioning";
import { SupervisorDashboard } from "@/app/components/SupervisorDashboard";
import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/");
  if (user.role === "worker") redirect("/dashboard");
  const { view } = await searchParams;
  const feature =
    view === "timesheets"
      ? "time"
      : view === "team"
        ? "team"
        : view === "feedback"
          ? "feedback"
          : "tasks";
  if (!hasModule(user, feature)) redirect("/supervisor");
  return <SupervisorDashboard />;
}
