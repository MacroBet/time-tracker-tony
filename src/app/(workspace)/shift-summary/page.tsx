import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ shiftId?: string }>;
}) {
  const { shiftId } = await searchParams;
  redirect(shiftId ? "/shifts/" + encodeURIComponent(shiftId) : "/");
}
