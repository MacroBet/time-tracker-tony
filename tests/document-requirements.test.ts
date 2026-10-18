import test from "node:test";
import assert from "node:assert/strict";
import {
  configSchema,
  documentRequirementChanges,
  documentRequirementsSchema,
  documentsForTag,
} from "../src/lib/commissioning";

const id = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";

test("legacy project configuration remains valid; document requirements keep stable IDs and independent applicability", () => {
  const legacy = { levels: ["L2A"], priorities: ["P1"] };
  assert.equal(configSchema.parse(legacy).documentRequirements, undefined);
  const requirements = documentRequirementsSchema.parse({
    L2A: [{ id, title: "  Synthetic receipt certificate  ", required: true }],
    L2B: [
      { id: otherId, title: "Synthetic installation photo", required: false },
    ],
  });
  assert.equal(requirements.L2A![0].title, "Synthetic receipt certificate");
  assert.equal(requirements.L2B![0].required, false);
  assert.equal(requirements.L3, undefined);
  assert.equal(
    configSchema.parse({ ...legacy, documentRequirements: requirements })
      .documentRequirements!.L2B![0].id,
    otherId,
  );
});

test("document catalog rejects duplicate IDs across levels, empty names and unrecognised workflow data", () => {
  const item = { id, title: "Synthetic report", required: true };
  for (const invalid of [
    { L2A: [item], L3: [item] },
    { L2A: [{ ...item, title: " " }] },
    { L2A: [{ ...item, required: "yes" }] },
    { L2A: [{ ...item, result: "passed" }] },
    { L0: [item] },
    { L2A: [{ ...item, id: "same-as-an-asset" }] },
    { L2A: [{ ...item, phase: " " }] },
    { L2A: [{ ...item, phase: "x".repeat(151) }] },
  ]) {
    assert.equal(documentRequirementsSchema.safeParse(invalid).success, false);
  }
});

test("tag documents include all-phase entries and only the linked asset phase at the selected level", () => {
  const common = { id, title: "Common report", required: true };
  const phaseOne = {
    id: otherId,
    title: "Phase one photo",
    required: false,
    phase: "Phase 1",
  };
  const requirements = documentRequirementsSchema.parse({
    L3: [common, phaseOne],
  });
  assert.deepEqual(documentsForTag(requirements, "L3", " Phase 1 "), [
    common,
    phaseOne,
  ]);
  assert.deepEqual(documentsForTag(requirements, "L3", "Phase 2"), [common]);
  assert.deepEqual(documentsForTag(requirements, "L3"), [common]);
  assert.deepEqual(documentsForTag(requirements, "L4", "Phase 1"), []);
  assert.deepEqual(documentsForTag(undefined, "L3", "Phase 1"), []);
  assert.deepEqual(
    documentRequirementChanges(
      { L3: [common] },
      { L3: [{ ...common, phase: "Phase 1" }] },
    ),
    ["L3 document updated: Common report (required); phase Phase 1"],
  );
});

test("catalog enforces the per-level capacity without imposing a lower project-wide limit", () => {
  const entries = Array.from({ length: 51 }, (_, index) => ({
    id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
    title: `Report ${index}`,
    required: true,
  }));
  assert.equal(
    documentRequirementsSchema.safeParse({ L3: entries }).success,
    false,
  );
  assert.equal(
    documentRequirementsSchema.safeParse({
      L3: entries.slice(0, 50),
      L4: [entries[50]],
    }).success,
    true,
  );
});

test("audit distinguishes requiredness changes and removal without losing the previous title", () => {
  const before = { L2A: [{ id, title: "Synthetic report", required: true }] };
  assert.deepEqual(documentRequirementChanges(before, before), []);
  assert.deepEqual(
    documentRequirementChanges(before, {
      L2A: [{ id, title: "Synthetic report", required: false }],
    }),
    ["L2A document updated: Synthetic report (not required)"],
  );
  assert.deepEqual(documentRequirementChanges(before, {}), [
    "L2A document removed from checklist: Synthetic report",
  ]);
});
