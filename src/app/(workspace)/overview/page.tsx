import { Overview } from "@/app/components/Overview";
import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (user.role === "worker") redirect("/dashboard");
  return <Overview />;
}
