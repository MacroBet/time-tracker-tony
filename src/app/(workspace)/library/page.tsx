import { redirect } from "next/navigation";
import { ProjectLibrary } from "@/app/components/ProjectLibrary";
import { canReadProjectLibrary } from "@/lib/project-library";
import { homeFor } from "@/lib/domain";
import { currentUser } from "@/server/auth";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (!canReadProjectLibrary(user)) redirect(homeFor(user));
  return <ProjectLibrary />;
}
