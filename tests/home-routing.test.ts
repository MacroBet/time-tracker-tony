import test from "node:test";
import assert from "node:assert/strict";
import { homeFor, type User, type Role } from "../src/lib/domain";
import { hasModule, MODULES, type Module } from "../src/lib/commissioning";

const user = (role: Role, modules?: Module[]): User => ({
  id: "routing-user",
  name: "Routing user",
  email: "routing@example.test",
  companyId: "company",
  role,
  modules,
});

test("manager and admin open Overview; workers open Tasks before Time", () => {
  assert.equal(homeFor(user("manager")), "/overview");
  assert.equal(homeFor(user("admin", [])), "/overview");
  assert.equal(homeFor(user("worker")), "/my-tasks");
  assert.equal(homeFor(user("worker", ["tasks", "time"])), "/my-tasks");
  assert.equal(homeFor(user("worker", ["time"])), "/dashboard");
  assert.equal(homeFor(user("supervisor")), "/supervisor");
});

test("restricted profiles land on an enabled feature or Settings", () => {
  assert.equal(homeFor(user("manager", ["tasks"])), "/supervisor");
  assert.equal(homeFor(user("manager", ["commissioning"])), "/commissioning");
  assert.equal(homeFor(user("manager", ["reports"])), "/reports");
  assert.equal(homeFor(user("supervisor", ["team"])), "/supervisor?view=team");
  assert.equal(
    homeFor(user("manager", ["time"])),
    "/supervisor?view=timesheets",
  );
  assert.equal(
    homeFor(user("manager", ["feedback"])),
    "/supervisor?view=feedback",
  );
  assert.equal(homeFor(user("worker", ["commissioning"])), "/commissioning");
  assert.equal(
    homeFor(user("worker", ["dashboard", "reports", "team"])),
    "/settings",
  );
  for (const role of ["worker", "supervisor", "manager"] as const)
    assert.equal(homeFor(user(role, [])), "/settings");
});

test("every module combination resolves to a role-permitted route that passes its guard", () => {
  const routeModules: Record<string, Module | undefined> = {
    "/overview": "dashboard",
    "/my-tasks": "tasks",
    "/dashboard": "time",
    "/supervisor": "tasks",
    "/commissioning": "commissioning",
    "/reports": "reports",
    "/supervisor?view=team": "team",
    "/supervisor?view=timesheets": "time",
    "/supervisor?view=feedback": "feedback",
    "/settings": undefined,
  };
  for (const role of ["worker", "supervisor", "manager", "admin"] as const) {
    for (let mask = 0; mask < 2 ** MODULES.length; mask++) {
      const profile = user(
        role,
        MODULES.filter((_, i) => mask & (1 << i)),
      );
      const before = structuredClone(profile);
      const route = homeFor(profile);
      assert(route in routeModules, `${role}: unexpected route ${route}`);
      const feature = routeModules[route];
      if (feature)
        assert(hasModule(profile, feature), `${role}: denied ${route}`);
      if (role === "worker")
        assert(
          ["/my-tasks", "/dashboard", "/commissioning", "/settings"].includes(
            route,
          ),
        );
      else assert(!["/my-tasks", "/dashboard"].includes(route));
      assert.deepEqual(profile, before);
    }
  }
});
