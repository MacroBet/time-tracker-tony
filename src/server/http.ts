import "server-only";
import { ZodError } from "zod";
import { HttpError, requireCondition } from "./errors";
import { sameOrigin } from "@/lib/origin";
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  requireCondition(
    sameOrigin(
      origin,
      request.headers.get("host") || new URL(request.url).host,
      !!process.env.VERCEL,
    ),
    403,
    "Request origin not allowed.",
  );
}
export async function readJson(request: Request, maxBytes = 32000) {
  requireCondition(
    request.headers.get("content-type")?.startsWith("application/json"),
    415,
    "Expected JSON.",
  );
  return JSON.parse(
    new TextDecoder().decode(await readBody(request, maxBytes)),
  );
}
export async function readBody(request: Request, maxBytes: number) {
  requireCondition(
    Number(request.headers.get("content-length") || 0) <= maxBytes,
    413,
    "File or request is too large.",
  );
  const reader = request.body?.getReader();
  requireCondition(reader, 400, "Request body is required.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "File or request is too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
export function api(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) checkOrigin(request);
      return await handler(request);
    } catch (error) {
      if (error instanceof HttpError)
        return json({ error: error.message }, error.status);
      if (error instanceof ZodError)
        return json(
          {
            error: error.issues
              .map((i) => `${i.path.join(".") || "Input"}: ${i.message}`)
              .join("; "),
          },
          400,
        );
      if (error instanceof SyntaxError)
        return json({ error: "Invalid JSON." }, 400);
      // Avoid logging connection strings, SQL values or uploaded evidence.
      console.error("API request failed", {
        type: error instanceof Error ? error.name : "UnknownError",
      });
      return json(
        { error: "The server could not complete the request. Please retry." },
        500,
      );
    }
  };
}
