import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ASSEMBLY_PREREQUISITES,
  ASSEMBLY_SEQUENCE,
  ASSEMBLY_STEPS,
  DISASSEMBLY_PREREQUISITES,
  DISASSEMBLY_SEQUENCE,
  DISASSEMBLY_STEPS,
} from "../src/utils/hardwareSequences.js";
import {
  PRACTICAL_PASSING_PERCENT,
  SEQUENCE_DEDUCTION_CAP,
  TIME_DEDUCTION_CAP,
  TIME_GRACE_SECONDS,
  calculatePracticalScore,
  normalizePracticalResult,
} from "../src/utils/practicalScoring.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const practicalExamFiles = [
  {
    label: "AMD assembly practical",
    path: "src/PAGES/PracticalTests/AMD/AMDFullAssemblyPracticalTest.jsx",
    sequence: "ASSEMBLY_SEQUENCE",
    prerequisites: "ASSEMBLY_PREREQUISITES",
  },
  {
    label: "INTEL assembly practical",
    path: "src/PAGES/PracticalTests/INTEL/INTELFullAssemblyPracticalTest.jsx",
    sequence: "ASSEMBLY_SEQUENCE",
    prerequisites: "ASSEMBLY_PREREQUISITES",
  },
  {
    label: "AMD disassembly practical",
    path: "src/PAGES/PracticalTests/AMD/AMDFullDisassemblyPracticalTest.jsx",
    sequence: "DISASSEMBLY_SEQUENCE",
    prerequisites: "DISASSEMBLY_PREREQUISITES",
    localSequenceAlias: "REMOVAL_SEQUENCE",
  },
  {
    label: "INTEL disassembly practical",
    path: "src/PAGES/PracticalTests/INTEL/INTELFullDisassemblyPracticalTest.jsx",
    sequence: "DISASSEMBLY_SEQUENCE",
    prerequisites: "DISASSEMBLY_PREREQUISITES",
    localSequenceAlias: "REMOVAL_SEQUENCE",
  },
];

function unique(values) {
  return [...new Set(values)];
}

function readRepoFile(path) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("guided assembly steps and practical assembly sequence stay aligned", () => {
  const guided = unique(
    ASSEMBLY_STEPS.filter((step) => step.key !== "final").flatMap((step) => step.partKeys)
  );

  assert.deepEqual(guided, ASSEMBLY_SEQUENCE);
  assert.deepEqual(ASSEMBLY_PREREQUISITES.psu, []);
  assert.deepEqual(ASSEMBLY_PREREQUISITES.motherboard, [
    "cpu",
    "ram1",
    "ram2",
    "ssd",
    "psu",
  ]);
  assert.deepEqual(ASSEMBLY_PREREQUISITES.hdd, ["motherboard", "psu"]);
  assert.deepEqual(ASSEMBLY_PREREQUISITES.gpu, ["motherboard", "psu"]);
});

test("guided disassembly steps and practical disassembly sequence stay aligned", () => {
  const guided = DISASSEMBLY_STEPS.filter((step) => step.key !== "final").flatMap(
    (step) => step.partKeys
  );

  assert.deepEqual(guided, DISASSEMBLY_SEQUENCE);
  assert.deepEqual(DISASSEMBLY_PREREQUISITES.psu, []);
  assert.deepEqual(DISASSEMBLY_PREREQUISITES.hdd, ["psu"]);
  assert.deepEqual(DISASSEMBLY_PREREQUISITES.gpu, ["psu", "hdd", "ram1", "ram2"]);
  assert.deepEqual(DISASSEMBLY_PREREQUISITES.motherboard, [
    "psu",
    "hdd",
    "ram1",
    "ram2",
    "gpu",
  ]);
  assert.deepEqual(DISASSEMBLY_PREREQUISITES.cpu, [
    "psu",
    "hdd",
    "ram1",
    "ram2",
    "gpu",
    "motherboard",
    "ssd",
  ]);
  assert.equal(
    DISASSEMBLY_SEQUENCE[0],
    "psu",
    "PSU is the first modeled PDF disassembly removal"
  );
});

test("practical exams use the shared PDF-based sequence constants", () => {
  for (const practical of practicalExamFiles) {
    const source = readRepoFile(practical.path);

    assert.match(
      source,
      new RegExp(`import \\{[^}]*${practical.prerequisites}[^}]*${practical.sequence}|import \\{[^}]*${practical.sequence}[^}]*${practical.prerequisites}`),
      `${practical.label} imports shared sequence/prerequisite constants`
    );

    assert.match(
      source,
      new RegExp(`const PREREQUISITES = ${practical.prerequisites};`),
      `${practical.label} applies shared prerequisites`
    );

    if (practical.localSequenceAlias) {
      assert.match(
        source,
        new RegExp(`const ${practical.localSequenceAlias} = ${practical.sequence};`),
        `${practical.label} applies shared removal sequence`
      );
    } else {
      assert.match(
        source,
        new RegExp(`const MOVABLE_COMPONENT_KEYS = new Set\\(${practical.sequence}\\);`),
        `${practical.label} applies shared assembly sequence`
      );
      assert.match(
        source,
        new RegExp(`const checklistOrder = ${practical.sequence};`),
        `${practical.label} displays the shared sequence in its checklist`
      );
    }
  }
});

test("practical exams score sequence errors but keep placement mistakes feedback-only", () => {
  for (const practical of practicalExamFiles) {
    const source = readRepoFile(practical.path);

    for (const token of [
      "PENALTY_WRONG_ORDER_CLICK",
      "calculateScore(",
      "wrongOrderCount",
      "handleInvalidClick",
      "handleFumble",
      "onInvalidClick",
      "onFumble",
      "orderPenaltyPoints",
      "sequenceDeduction",
      "timeDeduction",
    ]) {
      assert.ok(source.includes(token), `${practical.label} keeps ${token} wired`);
    }

    for (const removedToken of [
      "PENALTY_FUMBLE",
      "fumblePenaltyPoints",
      "Placement Errors",
      "placement error",
      "liveScoring",
    ]) {
      assert.ok(!source.includes(removedToken), `${practical.label} removes ${removedToken}`);
    }
  }
});

test("practical scoring uses unrounded 75 percent passing and capped deductions", () => {
  assert.equal(PRACTICAL_PASSING_PERCENT, 75);

  assert.equal(normalizePracticalResult({ scorePercent: 74.999, passed: true }).passed, false);
  assert.equal(normalizePracticalResult({ scorePercent: 75 }).passed, true);
  assert.equal(normalizePracticalResult({ score: 74, total: 100, passed: true }).status, "Failed");
  assert.equal(normalizePracticalResult({ score: 75, total: 100 }).status, "Passed");

  assert.equal(calculatePracticalScore({ wrongOrderCount: 0, elapsedSeconds: TIME_GRACE_SECONDS }).timeDeduction, 0);
  assert.equal(calculatePracticalScore({ wrongOrderCount: 0, elapsedSeconds: TIME_GRACE_SECONDS + 1 }).timeDeduction, 1);
  assert.equal(calculatePracticalScore({ wrongOrderCount: 0, elapsedSeconds: TIME_GRACE_SECONDS + 90 }).timeDeduction, TIME_DEDUCTION_CAP);
  assert.equal(calculatePracticalScore({ wrongOrderCount: 99, elapsedSeconds: 0 }).sequenceDeduction, SEQUENCE_DEDUCTION_CAP);
  assert.equal(calculatePracticalScore({ wrongOrderCount: 1, elapsedSeconds: 145 }).passed, false);
});
