import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { dataMode } from "@/server/config";
import { demoDirectory } from "@/server/repository";
import { homeFor } from "@/lib/domain";
import { Login } from "./components/Login";
export const dynamic = "force-dynamic";
export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect(homeFor(user));
  const mode = dataMode();
  const directory =
    mode === "demo" ? await demoDirectory() : { users: [], companies: [] };
  return <Login mode={mode} {...directory} />;
}
