import { cpuScene } from "./cpu";
import { cpuSceneAMD } from "./cpu-amd";
import { cpuSceneIntel } from "./cpu-intel";
import { motherboardScene } from "./motherboard";
import { motherboardSceneAMD } from "./motherboard-amd";
import { motherboardSceneIntel } from "./motherboard-intel";
import { ramScene } from "./ram";
import { hddScene } from "./hdd";
import { psuScene } from "./psu";
import { caseScene } from "./case";
import { gpuScene } from "./gpu";
import { ssdScene } from "./ssd";

// Fallbacks for AMD/Intel variant scenes that don't have dedicated files yet.
const ramSceneAMD = ramScene;
const ramSceneIntel = ramScene;
const hddSceneAMD = hddScene;
const hddSceneIntel = hddScene;
const psuSceneAMD = psuScene;
const psuSceneIntel = psuScene;
const caseSceneAMD = caseScene;
const caseSceneIntel = caseScene;


export const module1ScenesBase = [
  cpuScene,
  motherboardScene,
  ramScene,
  ssdScene,
  hddScene,
  psuScene,
  gpuScene,
  caseScene,
];

// Keep AMD list indices aligned with `module1ScenesBase` to avoid index mismatches
export const module1ScenesAMD = [
  cpuSceneAMD,
  motherboardSceneAMD,
  ramSceneAMD,
  ssdScene,
  hddSceneAMD,
  psuSceneAMD,
  gpuScene,
  caseSceneAMD,
];

// Keep Intel list indices aligned with `module1ScenesBase` as well
export const module1ScenesIntel = [
  cpuSceneIntel,
  motherboardSceneIntel,
  ramSceneIntel,
  ssdScene,
  hddSceneIntel,
  psuSceneIntel,
  gpuScene,
  caseSceneIntel,
];
