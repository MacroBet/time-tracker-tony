import { CommissioningWorkspace } from "@/app/components/CommissioningWorkspace";
import { currentUser } from "@/server/auth";
import { homeFor } from "@/lib/domain";
import { redirect } from "next/navigation";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (user.role !== "admin") redirect(homeFor(user));
  return <CommissioningWorkspace admin />;
}
