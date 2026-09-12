"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen grid place-items-center p-6 bg-slate-50">
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-bold">We could not load the workspace</h1>
        <p className="text-slate-600">
          Please retry. If this continues after database setup, check the
          deployment configuration and migrations.
        </p>
        <button
          className="rounded-lg bg-blue-600 text-white px-5 py-3"
          onClick={reset}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
