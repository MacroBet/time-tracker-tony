import { currentUser } from "@/server/auth";
import { hasModule } from "@/lib/commissioning";
import { homeFor } from "@/lib/domain";
import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await currentUser();
  if (!user) redirect("/");
  if (!hasModule(user, "reports")) redirect(homeFor(user));
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  query.set("tab", "reports");
  redirect(`/overview?${query}`);
}
