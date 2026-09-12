import "server-only";
export function dataMode(): "neon" | "demo" | "unconfigured" {
  if (process.env.DATABASE_URL) return "neon";
  // Hosted previews must use a persistent database. The local fallback is never automatic in production.
  if (
    !process.env.VERCEL &&
    (process.env.DEMO_MODE === "true" ||
      (process.env.NODE_ENV === "development" &&
        process.env.DEMO_MODE !== "false"))
  )
    return "demo";
  return "unconfigured";
}
