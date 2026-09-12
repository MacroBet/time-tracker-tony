import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { loadData } from "@/server/repository";
import { dataMode } from "@/server/config";
import { AppProvider } from "../contexts/AppContext";
import { FeedbackButton } from "../components/FeedbackButton";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/");
  const data = await loadData(user);
  return (
    <AppProvider
      initialData={{
        ...data,
        currentUser: user,
        mode: dataMode() === "neon" ? "neon" : "demo",
      }}
    >
      {children}
      <FeedbackButton />
    </AppProvider>
  );
}
