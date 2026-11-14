import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sanitizeConversationInput } from "../src/lib/assistant-conversations";
import {
  conversationCreateQuery,
  conversationDeleteQuery,
  conversationDetailQuery,
  conversationListQuery,
  conversationUpdateQuery,
} from "../src/server/db/assistant-conversations";

test("private PostgreSQL history enforces owner/project, fresh permissions, CAS, text-only storage and pagination", async () => {
  const pg = new PGlite(),
    dialect = new PgDialect();
  const execute = async (q: Parameters<typeof dialect.sqlToQuery>[0]) => {
    const parsed = dialect.sqlToQuery(q);
    return (await pg.query<Record<string, unknown>>(parsed.sql, parsed.params))
      .rows;
  };
  const id = randomUUID();
  const input = sanitizeConversationInput(
    {
      id,
      version: 0,
      messages: [
        {
          id: "m1",
          role: "user",
          text: "Check the pump",
          answer: { token: "private", action: "change" },
        },
      ],
      reportState: { projectId: "p", query: { report: "tagging" } },
    },
    "p",
  );
  try {
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    for (const entry of journal.entries)
      await pg.exec(await readFile(`drizzle/${entry.tag}.sql`, "utf8"));
    await pg.exec(
      "INSERT INTO companies(id,name)VALUES('c','Test');INSERT INTO users(id,name,email,role,company_id)VALUES('u','Manager','u@test.invalid','manager','c'),('v','Supervisor','v@test.invalid','supervisor','c');INSERT INTO projects(id,name,location,company_id,commissioning)VALUES('p','P','','c','{\"privateSource\":\"unchanged\"}'),('q','Q','','c',NULL);INSERT INTO project_memberships(user_id,project_id)VALUES('u','p'),('u','q'),('v','p');",
    );
    const saved = (await execute(conversationCreateQuery("u", "p", input)))[0];
    assert.equal(saved.version, 1);
    assert.equal(saved.title, "Check the pump");
    assert.deepEqual(saved.messages, [
      { id: "m1", role: "user", text: "Check the pump" },
    ]);
    assert.equal(
      (await execute(conversationCreateQuery("u", "p", input))).length,
      0,
      "Create retry cannot duplicate a UUID",
    );
    assert.equal(
      (await execute(conversationDetailQuery("v", "p", id))).length,
      0,
      "Even another member cannot read the owner's chat",
    );
    assert.equal(
      (await execute(conversationDetailQuery("u", "q", id))).length,
      0,
      "Same owner cannot use a different project URL",
    );
    assert.equal(
      (await execute(conversationDeleteQuery("v", "p", id, 1))).length,
      0,
    );
    assert.equal(
      (
        await execute(
          conversationUpdateQuery("v", "p", { ...input, version: 1 }),
        )
      ).length,
      0,
    );
    for (let i = 0; i < 31; i++)
      await execute(
        conversationCreateQuery("u", "p", { ...input, id: randomUUID() }),
      );
    const first = (await execute(conversationListQuery("u", "p", 0, 30)))[0],
      second = (await execute(conversationListQuery("u", "p", 30, 30)))[0],
      empty = (await execute(conversationListQuery("u", "p", 100, 30)))[0];
    assert.equal(first.total, 32);
    assert.equal((first.conversations as unknown[]).length, 30);
    assert.equal((second.conversations as unknown[]).length, 2);
    assert.equal(empty.total, 32);
    assert.deepEqual(empty.conversations, []);
    const summary = (first.conversations as Record<string, unknown>[])[0];
    assert.equal(summary.messageCount, 1);
    assert(!("messages" in summary));
    assert(!("userId" in summary));
    assert.equal(
      (await execute(conversationListQuery("v", "p", 0, 30)))[0].total,
      0,
    );
    const changed = {
      ...input,
      version: 1,
      messages: [
        ...input.messages,
        { id: "m2", role: "assistant" as const, text: "**Saved** result" },
      ],
    };
    const updated = (
      await execute(conversationUpdateQuery("u", "p", changed))
    )[0];
    assert.equal(updated.version, 2);
    assert.deepEqual(updated.createdAt, saved.createdAt);
    assert.equal(
      (await execute(conversationUpdateQuery("u", "p", changed))).length,
      0,
      "CAS protects an update retry; server may read and recognize identical v+1",
    );
    assert.equal(
      (await execute(conversationDeleteQuery("u", "p", id, 1))).length,
      0,
    );
    for (const unsafe of [
      [
        {
          id: "m",
          role: "assistant",
          text: "Reply",
          answer: { action: "write" },
        },
      ],
      [{ id: "m", role: "assistant", text: "Reply", token: "secret" }],
      [
        {
          id: "m",
          role: "assistant",
          text: "Reply",
          error: { action: "write" },
        },
      ],
      [{ id: "m", role: "system", text: "Reply" }],
      [{ role: "user", text: "No identity" }],
    ])
      await assert.rejects(
        pg.query(
          "INSERT INTO assistant_conversations(id,user_id,project_id,title,messages)VALUES($1,'u','p','Unsafe',$2::jsonb)",
          [randomUUID(), JSON.stringify(unsafe)],
        ),
        /assistant_conversations_messages/,
      );
    for (const report of [
      { projectId: "q", query: { report: "tagging" } },
      { query: { report: "tagging" } },
    ])
      await assert.rejects(
        pg.query(
          "INSERT INTO assistant_conversations(id,user_id,project_id,title,report_state)VALUES($1,'u','p','Foreign',$2::jsonb)",
          [randomUUID(), JSON.stringify(report)],
        ),
        /assistant_conversations_report_scope/,
      );
    const deny = async () => {
      assert.equal(
        (await execute(conversationListQuery("u", "p", 0, 30)))[0].total,
        0,
      );
      assert.equal(
        (await execute(conversationDetailQuery("u", "p", id))).length,
        0,
      );
      assert.equal(
        (
          await execute(
            conversationCreateQuery("u", "p", { ...input, id: randomUUID() }),
          )
        ).length,
        0,
      );
      assert.equal(
        (
          await execute(
            conversationUpdateQuery("u", "p", { ...changed, version: 2 }),
          )
        ).length,
        0,
      );
      assert.equal(
        (await execute(conversationDeleteQuery("u", "p", id, 2))).length,
        0,
      );
    };
    await pg.exec("UPDATE users SET modules='[\"tasks\"]' WHERE id='u'");
    await deny();
    await pg.exec("UPDATE users SET modules=NULL,role='worker' WHERE id='u'");
    await deny();
    await pg.exec(
      "UPDATE users SET role='manager' WHERE id='u';DELETE FROM project_memberships WHERE user_id='u' AND project_id='p'",
    );
    await deny();
    await pg.exec(
      "INSERT INTO project_memberships(user_id,project_id)VALUES('u','p')",
    );
    assert.equal(
      (await execute(conversationDetailQuery("u", "p", id)))[0].version,
      2,
    );
    assert.equal(
      (await execute(conversationDeleteQuery("u", "p", id, 2))).length,
      1,
    );
    assert.deepEqual(
      (
        await pg.query<{ commissioning: unknown }>(
          "SELECT commissioning FROM projects WHERE id='p'",
        )
      ).rows[0].commissioning,
      { privateSource: "unchanged" },
    );
    assert.equal(
      (
        await pg.query<{ count: number }>(
          "SELECT count(*)::integer count FROM tasks",
        )
      ).rows[0].count,
      0,
    );
  } finally {
    await pg.close();
  }
});
