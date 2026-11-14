import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { homeFor } from "@/lib/domain";
import { AiUsageDashboard } from "@/app/components/AiUsageDashboard";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (user.role !== "admin") redirect(homeFor(user));
  return <AiUsageDashboard />;
}
