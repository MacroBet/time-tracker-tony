import { ShiftSummary } from "@/app/components/ShiftSummary";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShiftSummary shiftId={id} />;
}
