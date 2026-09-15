import test from "node:test";
import assert from "node:assert/strict";
import { Group, Quaternion, Vector3, Euler } from "three";
import { readFileSync } from "node:fs";
import { restoreDisassemblyPlacement } from "../src/utils/disassemblyPlacement.js";
import { recordModuleVisit, getLastModuleVisit, getPracticeCheckpoint } from "../src/utils/moduleVisits.js";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
const steps = [
  { key: "cpu", partKeys: ["cpu"] },
  { key: "ram", partKeys: ["ram1", "ram2"] },
  { key: "final", partKeys: [] },
];
const sequence = ["cpu", "ram1", "ram2"];
const route = "module-3-amd";

for (const platform of ["AMD", "INTEL"]) {
  test(`${platform}: resume at SSD keeps GPU and motherboard on the table`, () => {
    const disassemblySteps = [
      { key: "gpu", partKeys: ["gpu"] },
      { key: "motherboard", partKeys: ["motherboard"] },
      { key: "ssd", partKeys: ["ssd"] },
      { key: "final", partKeys: [] },
    ];
    const route = `module-2-${platform.toLowerCase()}`;
    recordModuleVisit("disassembly-user", { route, activity: "SSD Disassembly", snapshot: {
      step: 2, completedParts: ["gpu", "motherboard"], finalRoundCompletedParts: [], showIntro: false,
    } });
    const checkpoint = getPracticeCheckpoint("disassembly-user", route, disassemblySteps, ["gpu", "motherboard", "ssd"]);
    assert.equal(checkpoint.step, 2);
    assert.deepEqual(checkpoint.completedParts, ["gpu", "motherboard"]);
    const source = readFileSync(new URL(`../src/PAGES/Modules/Module2/Module2Disassmbly${platform}.jsx`, import.meta.url), "utf8");
    for (const part of checkpoint.completedParts) {
      // Exercise actual platform-specific table coordinates with real Three.js transforms.
      const coordinates = source.match(new RegExp(`${part}: \\{\\s*position: \\[([^\\]]+)\\]`))[1].split(",").map(Number);
      const group = new Group();
      const rotation = new Group();
      group.add(rotation);
      const target = new Vector3(...coordinates);
      const orientation = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0));
      assert.equal(restoreDisassemblyPlacement(group, rotation, target, orientation), true);
      assert.deepEqual(group.position.toArray(), coordinates);
      assert.ok(rotation.quaternion.angleTo(orientation) < 1e-7);
      assert.deepEqual(group.getWorldPosition(new Vector3()).toArray(), coordinates);
    }
    assert.equal(checkpoint.completedParts.includes("ssd"), false);
    assert.deepEqual(checkpoint.finalRoundCompletedParts, []);
  });
}

test("placement restoration waits for mounted scene objects", () => {
  assert.equal(restoreDisassemblyPlacement(null, null, null, null), false);
});

test("last visit includes completed modules and keeps accounts separate", () => {
  storage.clear();
  assert.equal(getLastModuleVisit("new-user"), null);
  recordModuleVisit("a", { route, activity: "Full Assembly", progress: 100 });
  recordModuleVisit("b", { route: "module-2", activity: "Platform selection" });
  assert.equal(getLastModuleVisit("a").route, route);
  assert.equal(getLastModuleVisit("a").moduleId, "module-3");
  assert.equal(getLastModuleVisit("b").route, "module-2");
  recordModuleVisit("a", { route: "invalid", activity: "Bad route" });
  assert.equal(getLastModuleVisit("a").route, route);
  recordModuleVisit("a", { route: "module-2-intel", activity: "Introduction" });
  assert.equal(getLastModuleVisit("a").route, "module-2-intel");
  recordModuleVisit("a", { route, activity: "Full Assembly", progress: 100 });
  assert.equal(getLastModuleVisit("a").route, route);
});

test("resume accepts either RAM stick first and keeps the saved platform", () => {
  recordModuleVisit("a", { route, activity: "RAM", snapshot: {
    step: 1, completedParts: ["cpu", "ram2"], finalRoundCompletedParts: [], showIntro: false,
  } });
  assert.deepEqual(getPracticeCheckpoint("a", route, steps, sequence).completedParts, ["cpu", "ram2"]);
  assert.equal(getPracticeCheckpoint("a", "module-3-intel", steps, sequence).showIntro, true);
});

test("invalid checkpoints cannot skip prerequisites or start the final round early", () => {
  for (const snapshot of [
    { step: 1, completedParts: ["ram1"], finalRoundCompletedParts: [] },
    { step: 2, completedParts: ["cpu"], finalRoundCompletedParts: [] },
    { step: 0, completedParts: ["cpu", "cpu"], finalRoundCompletedParts: [] },
    { step: 1, completedParts: ["cpu"], finalRoundCompletedParts: ["cpu"] },
    { step: 5, completedParts: [], finalRoundCompletedParts: [] },
  ]) {
    recordModuleVisit("a", { route, activity: "Invalid", snapshot });
    assert.equal(getPracticeCheckpoint("a", route, steps, sequence).showIntro, true);
  }
});

test("reset checkpoints replace old practice state; corrupted storage is harmless", () => {
  recordModuleVisit("a", { route, activity: "Introduction", snapshot: {
    step: 0, completedParts: [], finalRoundCompletedParts: [], showIntro: true,
  } });
  assert.deepEqual(getPracticeCheckpoint("a", route, steps, sequence).completedParts, []);
  storage.set("articton-module-visits-v1:a", "broken json");
  assert.equal(getLastModuleVisit("a"), null);
});

test("assembly resumes the second RAM stage after either first stick", () => {
  const assemblySteps = [steps[0],
    { key: "ramFirst", partKeys: ["ram1", "ram2"], requiredCount: 1 },
    { key: "ramSecond", partKeys: ["ram1", "ram2"], requiredCount: 2 }, steps[2]];
  for (const ram of ["ram1", "ram2"]) {
    recordModuleVisit("a", { route, activity: "Second RAM", snapshot: {
      step: 2, completedParts: ["cpu", ram], finalRoundCompletedParts: [], showIntro: false,
    } });
    const checkpoint = getPracticeCheckpoint("a", route, assemblySteps, sequence);
    assert.equal(checkpoint.step, 2);
    assert.equal(checkpoint.showIntro, false);
  }
  recordModuleVisit("a", { route, activity: "Transition", snapshot: {
    step: 2, completedParts: sequence, finalRoundCompletedParts: [], showIntro: false,
  } });
  assert.equal(getPracticeCheckpoint("a", route, assemblySteps, sequence).step, 3);
});
