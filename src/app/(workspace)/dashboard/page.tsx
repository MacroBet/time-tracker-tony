import { WorkerDashboard } from "@/app/components/WorkerDashboard";
import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/domain";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (user.role !== "worker") redirect(homeFor(user));
  return <WorkerDashboard />;
}
