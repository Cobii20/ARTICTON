export const ASSEMBLY_SEQUENCE = Object.freeze([
  "cpu",
  "ram1",
  "ram2",
  "ssd",
  "psu",
  "motherboard",
  "hdd",
  "gpu",
]);

export const DISASSEMBLY_SEQUENCE = Object.freeze([
  "psu",
  "hdd",
  "ram1",
  "ram2",
  "gpu",
  "motherboard",
  "ssd",
  "cpu",
]);

export const ASSEMBLY_STEPS = Object.freeze([
  { key: "cpu", name: "Install CPU on Motherboard", partKeys: ["cpu"] },
  {
    key: "ramFirst",
    name: "Install First RAM Module",
    partKeys: ["ram1", "ram2"],
    requiredCount: 1,
    unordered: true,
  },
  {
    key: "ramSecond",
    name: "Install Second RAM Module",
    partKeys: ["ram1", "ram2"],
    requiredCount: 2,
    unordered: true,
  },
  { key: "ssd", name: "Install SSD on Motherboard", partKeys: ["ssd"] },
  { key: "psu", name: "Install PSU in Case", partKeys: ["psu"] },
  {
    key: "motherboard",
    name: "Install Populated Motherboard in Case",
    partKeys: ["motherboard"],
  },
  { key: "hdd", name: "Install HDD in Case", partKeys: ["hdd"] },
  { key: "gpu", name: "Install GPU in Case", partKeys: ["gpu"] },
  { key: "final", name: "Full Assembly", partKeys: [] },
]);

export const DISASSEMBLY_STEPS = Object.freeze([
  { key: "psu", name: "PSU Disassembly", partKeys: ["psu"] },
  { key: "hdd", name: "HDD Disassembly", partKeys: ["hdd"] },
  {
    key: "ram",
    name: "RAM Disassembly (2 Modules)",
    partKeys: ["ram1", "ram2"],
    unordered: true,
  },
  { key: "gpu", name: "GPU Disassembly", partKeys: ["gpu"] },
  {
    key: "motherboard",
    name: "Motherboard Disassembly",
    partKeys: ["motherboard"],
  },
  { key: "ssd", name: "SSD Disassembly", partKeys: ["ssd"] },
  { key: "cpu", name: "CPU Disassembly", partKeys: ["cpu"] },
  { key: "final", name: "Full Disassembly", partKeys: [] },
]);

export const ASSEMBLY_PREREQUISITES = Object.freeze({
  cpu: [],
  ram1: [],
  ram2: [],
  ssd: [],
  psu: [],
  motherboard: ["cpu", "ram1", "ram2", "ssd", "psu"],
  hdd: ["motherboard", "psu"],
  gpu: ["motherboard", "psu"],
});

export const DISASSEMBLY_PREREQUISITES = Object.freeze({
  psu: [],
  hdd: ["psu"],
  ram1: ["psu", "hdd"],
  ram2: ["psu", "hdd"],
  gpu: ["psu", "hdd", "ram1", "ram2"],
  motherboard: ["psu", "hdd", "ram1", "ram2", "gpu"],
  ssd: ["psu", "hdd", "ram1", "ram2", "gpu", "motherboard"],
  cpu: ["psu", "hdd", "ram1", "ram2", "gpu", "motherboard", "ssd"],
});

export const SEQUENCE_REFERENCE_NOTES = Object.freeze({
  source:
    "NCERT KEIT104 Unit 4, Computer Assembly and Disassembly, computer assembly and disassembly sequence sections.",
  assembly:
    "The PDF sequence opens the case, installs the power supply, attaches motherboard components, installs the motherboard, installs storage, installs the video card, then connects internal cables.",
  disassembly:
    "The PDF desktop disassembly sequence unplugs power and peripherals, opens the case, disconnects connectors, removes fans, removes the power supply, removes drives, removes RAM, removes expansion cards, then removes the motherboard.",
  adaptation:
    "ARTICTON models the case as already open and does not provide separate cable, screw, cooler, fan, or optical-drive interactions. Disassembly therefore starts with the PSU, then HDD, RAM, GPU, and motherboard. SSD and CPU are retained as app-specific motherboard-mounted removals after the board reaches the table.",
});
