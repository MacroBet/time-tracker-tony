import { hasModule } from "@/lib/commissioning";
import { WorkerDashboard } from "@/app/components/WorkerDashboard";
import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/domain";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (user.role !== "worker") redirect(homeFor(user));
  if (!hasModule(user, "time")) redirect("/my-tasks");
  return <WorkerDashboard />;
}
