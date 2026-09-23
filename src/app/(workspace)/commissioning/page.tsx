import { CommissioningWorkspace } from "@/app/components/CommissioningWorkspace";
import { currentUser } from "@/server/auth";
import { hasModule } from "@/lib/commissioning";
import { homeFor } from "@/lib/domain";
import { redirect } from "next/navigation";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (!hasModule(user, "commissioning")) redirect(homeFor(user));
  return <CommissioningWorkspace />;
}
