import { TaskBoard } from "@/app/components/TaskBoard";
import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { homeFor } from "@/lib/domain";
import { hasModule } from "@/lib/commissioning";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (user.role !== "worker" || !hasModule(user, "tasks"))
    redirect(homeFor(user));
  return (
    <AppShell
      title="My tasks"
      subtitle="Your assignments, progress and completed work."
    >
      <TaskBoard />
    </AppShell>
  );
}
