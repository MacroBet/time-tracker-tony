// Browsers cannot override Host. Next.js may normalize request.url to localhost behind a proxy.
export function sameOrigin(
  origin: string | null,
  host: string,
  requireHttps = false,
) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.host === host &&
      (!requireHttps || url.protocol === "https:")
    );
  } catch {
    return false;
  }
}
