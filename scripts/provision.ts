import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { z } from "zod";
import * as schema from "../src/server/db/schema";
import { scriptDb } from "./env";
try {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      company: { type: "string" },
      project: { type: "string" },
      location: { type: "string" },
      role: { type: "string", default: "worker" },
    },
  });
  const input = z
    .object({
      email: z.email().transform((v) => v.toLowerCase()),
      name: z.string().min(1),
      company: z.string().min(1),
      project: z.string().min(1),
      location: z.string().default(""),
      role: z.enum(["worker", "supervisor", "manager", "admin"]),
    })
    .parse(values);
  const db = scriptDb();
  if (
    (
      await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, input.email))
    ).length
  )
    throw new Error(
      "User already exists. This command does not change existing roles or memberships.",
    );
  const companyMatches = await db
    .select()
    .from(schema.companies)
    .where(eq(schema.companies.name, input.company));
  const projectMatches = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.name, input.project));
  if (companyMatches.length > 1 || projectMatches.length > 1)
    throw new Error(
      "Ambiguous company or project name. Use unique names for provisioning.",
    );
  const company = companyMatches[0] || {
    id: randomUUID(),
    name: input.company,
    logo: "",
  };
  const project = projectMatches[0] || {
    id: randomUUID(),
    name: input.project,
    location: input.location,
    companyId: company.id,
  };
  const user = {
    id: randomUUID(),
    name: input.name,
    email: input.email,
    role: input.role,
    companyId: company.id,
  };
  await db.batch([
    db.insert(schema.companies).values(company).onConflictDoNothing(),
    db.insert(schema.projects).values(project).onConflictDoNothing(),
    db.insert(schema.users).values(user),
    db
      .insert(schema.memberships)
      .values({ userId: user.id, projectId: project.id }),
  ]);
  console.log(
    "User provisioned with project access. Run db:set-password to enable sign-in.",
  );
} catch (error) {
  console.error(
    error instanceof Error && !("cause" in error)
      ? error.message
      : "Provisioning failed. Check the database connection and migration status.",
  );
  process.exitCode = 1;
}
