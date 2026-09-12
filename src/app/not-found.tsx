import Link from "next/link";
export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p>This page may have moved, or you may not have access.</p>
        <Link className="text-blue-600 underline" href="/">
          Back to your workspace
        </Link>
      </div>
    </main>
  );
}
