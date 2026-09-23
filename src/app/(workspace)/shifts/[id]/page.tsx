import { currentUser } from "@/server/auth";
import { hasModule } from "@/lib/commissioning";
import { homeFor } from "@/lib/domain";
import { redirect } from "next/navigation";
import { ShiftSummary } from "@/app/components/ShiftSummary";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/");
  if (!hasModule(user, "time")) redirect(homeFor(user));
  const { id } = await params;
  return <ShiftSummary shiftId={id} />;
}
