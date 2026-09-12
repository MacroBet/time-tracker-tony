import { ShiftHistory } from "@/app/components/ShiftHistory";
import { currentUser } from "@/server/auth";
import { redirect } from "next/navigation";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/");
  return <ShiftHistory />;
}
