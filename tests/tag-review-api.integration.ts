import test from "node:test";
import assert from "node:assert/strict";
import { TAG_REVIEWS, type TagReview } from "../src/lib/commissioning";
import type { Bootstrap, Task } from "../src/lib/domain";

const base = process.env.TEST_BASE_URL || "http://localhost:3000";
async function request(
  path: string,
  cookie = "",
  method = "GET",
  body?: unknown,
) {
  return fetch(base + path, {
    method,
    headers: {
      Cookie: cookie,
      Origin: base,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function session(userId: string) {
  const response = await request("/api/auth/login", "", "POST", { userId });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie")!.split(";")[0];
}
async function load(cookie: string): Promise<Bootstrap> {
  const response = await request("/api/bootstrap", cookie);
  assert.equal(response.status, 200);
  return response.json();
}
function plan(task: Task, tagReview?: TagReview) {
  return {
    version: task.version,
    title: task.title,
    description: task.description,
    priority: task.priority ?? null,
    cx: { ...task.cx, tagReview },
    dueDate: task.dueDate ?? null,
    discipline: task.discipline,
    location: task.location,
    reason:
      "Verify explicit tag review persists separately from workflow and tests.",
  };
}

test("tag review persists through authorized plans without changing workflow or test outcomes", async () => {
  const info = await (await request("/api/auth/session")).json();
  assert.equal(
    info.mode,
    "demo",
    "Run only against an isolated local demo server.",
  );
  const manager = await session("u4");
  const worker = await session("u6");
  const original = (await load(manager)).tasks.find(
    (task) => task.cx?.kind === "tag",
  )!;
  assert(original, "Expected a synthetic demo tag");
  let task = original;
  try {
    assert.equal(
      (
        await request(
          `/api/tasks/${task.id}/plan`,
          worker,
          "PATCH",
          plan(task, "approved"),
        )
      ).status,
      403,
    );
    for (const review of TAG_REVIEWS) {
      assert.equal(
        (
          await request(
            `/api/tasks/${task.id}/plan`,
            manager,
            "PATCH",
            plan(task, review),
          )
        ).status,
        200,
      );
      task = (await load(manager)).tasks.find((row) => row.id === task.id)!;
      assert.equal(task.cx?.tagReview, review);
      assert.equal(task.status, original.status);
      assert.equal(task.cx?.result, original.cx?.result);
    }
    assert.equal(
      (
        await request(
          `/api/tasks/${task.id}/plan`,
          manager,
          "PATCH",
          plan(original, "issued"),
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await request(`/api/tasks/${task.id}/plan`, manager, "PATCH", {
          ...plan(task),
          cx: { ...task.cx, tagReview: "C" },
        })
      ).status,
      400,
    );
  } finally {
    task = (await load(manager)).tasks.find((row) => row.id === original.id)!;
    assert.equal(
      (
        await request(
          `/api/tasks/${task.id}/plan`,
          manager,
          "PATCH",
          plan(task, original.cx?.tagReview),
        )
      ).status,
      200,
    );
  }
});
