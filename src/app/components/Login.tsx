"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ArrowRight, ShieldCheck, ListChecks } from "lucide-react";
import { type Company, type User } from "@/lib/domain";
import { apiRequest } from "@/lib/api-client";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
export function Login({
  mode,
  users,
  companies,
}: {
  mode: "demo" | "neon" | "unconfigured";
  users: User[];
  companies: Company[];
}) {
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{ redirectTo: string }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify(
            mode === "demo" ? { userId } : { email, password },
          ),
        },
      );
      router.replace(result.redirectTo);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign-in failed.");
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-5">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-12 items-center">
        <div className="text-white space-y-6 hidden md:block">
          <div className="inline-flex items-center gap-2 text-blue-300 text-sm font-medium">
            <ListChecks className="size-5" /> CONSTRUCTION & COMMISSIONING
          </div>
          <h1 className="text-5xl font-semibold tracking-tight leading-tight">
            Clear priorities.
            <br />
            Confident teams.
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed">
            The right activity, the right person, and a clear record of what
            happened on site.
          </p>
          <div className="border-t border-white/15 pt-6 flex gap-3 text-sm text-slate-300">
            <ShieldCheck className="size-5 text-blue-300 shrink-0" />
            One workspace for field teams, supervisors and project managers.
          </div>
        </div>
        <Card className="w-full border-0 shadow-2xl">
          <CardHeader className="space-y-4">
            <div className="size-14 bg-blue-600 rounded-2xl flex items-center justify-center">
              <Building2 className="size-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-3xl tracking-tight">
                FieldTrack
              </CardTitle>
              <CardDescription className="mt-2 text-base">
                Your site. Your next step.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {mode === "unconfigured" ? (
              <div
                role="status"
                className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
              >
                This workspace is being set up. Sign-in will be available when
                the database is connected.
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                {mode === "demo" ? (
                  <>
                    <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
                      Demo workspace · sample data. Changes reset when the local
                      server restarts.
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <select
                        id="company"
                        className="field-select"
                        value={companyId}
                        onChange={(e) => {
                          setCompanyId(e.target.value);
                          setUserId("");
                        }}
                        required
                      >
                        <option value="">Choose your company</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user">User</Label>
                      <select
                        id="user"
                        className="field-select"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        required
                        disabled={!companyId}
                      >
                        <option value="">Choose your name</option>
                        {users
                          .filter((u) => u.companyId === companyId)
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} · {u.role}
                            </option>
                          ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-12"
                      />
                    </div>
                  </>
                )}
                {error && (
                  <p role="alert" className="text-sm text-red-700">
                    {error}
                  </p>
                )}
                <Button disabled={busy} className="h-12 w-full text-base">
                  {busy ? "Signing in…" : "Open workspace"}
                  <ArrowRight className="size-4" />
                </Button>
              </form>
            )}
            <p className="text-xs text-slate-500 text-center">
              Built for the people who get the work done.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
