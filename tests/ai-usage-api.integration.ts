import test from "node:test";
import assert from "node:assert/strict";
import type { AiUsageResult } from "../src/lib/ai-usage";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3107",
  path = "/api/admin/ai-usage";
async function request(url: string, cookie = "", method = "GET") {
  return fetch(base + url, {
    method,
    headers: {
      Cookie: cookie,
      Origin: base,
      "Content-Type": "application/json",
    },
  });
}
async function decoded<T>(response: Response, status = 200) {
  const body = await response.text();
  assert.equal(response.status, status, body);
  return JSON.parse(body) as T;
}
async function login(userId: string) {
  const response = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  await decoded(response);
  const cookie = response.headers.get("set-cookie");
  assert(cookie);
  return cookie.split(";")[0];
}
type Result = AiUsageResult & { dataSource: "synthetic-demo" | "database" };
test("AI accounting API is admin-only, read-only, aggregate-only and clearly labels deterministic local demo data", async () => {
  assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname));
  assert.equal(
    (await decoded<{ mode: string }>(await request("/api/auth/session"))).mode,
    "demo",
    "Only local isolated demo. No DB writes or provider calls.",
  );
  await decoded(await request(path), 401);
  for (const userId of ["u1", "u3", "u4"]) {
    const cookie = await login(userId);
    await decoded(await request(path, cookie), 403);
    await decoded(
      await request(path + "?from=invalid&projectId=p1", cookie),
      403,
    );
  }
  const admin = await login("u-admin"),
    response = await request(path, admin);
  assert(response.headers.get("cache-control")?.includes("no-store"));
  assert(response.headers.get("cache-control")?.includes("private"));
  const result = await decoded<Result>(response);
  assert.equal(result.dataSource, "synthetic-demo");
  assert.equal(result.scope, "all-fieldtrack-projects");
  assert.equal(result.coverage, "recorded-fieldtrack-attempts-only");
  assert.equal(result.days.length, 30);
  assert.equal(result.query.timezone, "Europe/Rome");
  assert(result.totals.attempts > 30);
  assert(result.totals.pendingAttempts > 0);
  assert(result.totals.failedAttempts > 0);
  assert(result.totals.missingUsageAttempts > 0);
  assert(result.totals.unpricedAttempts > 0);
  assert(result.totals.pricedAttempts > 0);
  assert.equal(result.totals.billedUsd, null);
  assert.equal(result.pricing.currency, "USD");
  assert(result.totals.unknownTokenAttempts.cacheWriteInputTokens > 0);
  const protectedKeys = new Set([
    "attemptId",
    "eventId",
    "requestId",
    "providerRequestId",
    "projectId",
    "jobId",
    "userId",
    "token",
    "apiKey",
    "authorization",
    "prompt",
    "messages",
    "observation",
    "event",
  ]);
  function noPrivateFields(value: unknown) {
    if (value && typeof value === "object")
      for (const [key, nested] of Object.entries(value)) {
        assert(!protectedKeys.has(key), `Aggregate DTO must not expose ${key}`);
        noPrivateFields(nested);
      }
  }
  noPrivateFields(result);
  const params = new URLSearchParams({
    ...result.query,
    model: "gpt-5.6-terra",
  });
  const filtered = await decoded<Result>(
    await request(`${path}?${params}`, admin),
  );
  assert(filtered.totals.attempts < result.totals.attempts);
  assert.equal(filtered.byModel.length, 1);
  assert.equal(filtered.byModel[0].model, "gpt-5.6-terra");
  assert.deepEqual(filtered.facets.models, result.facets.models);
  assert.deepEqual(filtered.facets.sources, result.facets.sources);
  const repeat = await decoded<Result>(
    await request(`${path}?${params}`, admin),
  );
  assert.deepEqual(repeat.totals, filtered.totals);
  assert.deepEqual(
    repeat.days,
    filtered.days,
    "Demo data is deterministic across reads",
  );
  params.delete("model");
  params.set("source", "transcription");
  params.set("timezone", "UTC");
  const audio = await decoded<Result>(
    await request(`${path}?${params}`, admin),
  );
  assert.equal(audio.bySource.length, 1);
  assert.equal(audio.bySource[0].source, "transcription");
  assert.equal(audio.byModel[0].model, "gpt-transcribe");
  assert(audio.totals.pricedAttempts > 0);
  assert(
    audio.totals.unpricedAttempts > 0,
    "Legacy audio missing duration stays unpriced",
  );
  for (const invalid of [
    "from=2026-02-30",
    "from=2026-11-15&through=2026-11-14",
    "from=2024-01-01&through=2026-11-14",
    "timezone=Europe/London",
    "source=other",
  ])
    await decoded(await request(`${path}?${invalid}`, admin), 400);
  const empty = await decoded<Result>(
    await request(`${path}?from=2000-01-01&through=2000-01-02`, admin),
  );
  assert.equal(empty.totals.attempts, 0);
  assert.equal(empty.days.length, 2);
  assert.equal(empty.dataSource, "synthetic-demo");
  assert.equal((await request(path, admin, "POST")).status, 405);
});
