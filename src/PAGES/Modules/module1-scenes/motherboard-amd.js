import { motherboardScene } from "./motherboard";

export const motherboardSceneAMD = {
  ...motherboardScene,
  name: "AMD Motherboard",
  url: "/models/MotherboardAMD(Base).glb",
  view: {
    cameraPos: [0, 1.2, 3.2],
    boundsMargin: 1.2,
    minDistance: 1.8,
    maxDistance: 7,
    modelScale: 0.1,
    modelRotation: [0, Math.PI / 180, 0],
    modelPosition: [0, 0, 0],
    pinStyle: { buttonPx: 20, numberPx: 7, glowRadius: 0.05, distanceFactor: 10 },
    normalize: { enabled: false },
  },
  slides: [
    {
      id: "mb-amd-s1",
      title: "AMD Motherboard Overview",
      body:
        "This module helps you identify the main zones of an AMD motherboard.\n" +
        "Focus on where the CPU sits, where RAM is installed, how storage connects, and where expansion cards plug in.",
      points: [
        "Learn the CPU socket, DIMM slots, PCIe slot, storage connectors, and power headers.",
        "Socket platform tells you whether the board supports AM5 or AM4 CPUs.",
        "Form factor tells you the board size, such as ATX, Micro-ATX, or Mini-ITX.",
      ],
    },
    {
      id: "mb-amd-s2",
      title: "Mini-ITX, AM5, and AM4",
      body:
        "Mini-ITX is a motherboard size, not a CPU socket. A Mini-ITX board is about 170 mm by 170 mm and usually has one main PCIe x16 slot and two RAM slots.\n" +
        "An AMD Mini-ITX board can be AM5 or AM4 depending on the CPU socket and memory support.",
      points: [
        "AM5 board: LGA socket with pins in the socket, DDR5 RAM, and chipsets such as A620, B650, X670, or newer.",
        "AM4 board: PGA socket with holes for CPU pins, DDR4 RAM, and chipsets such as A320, B450, B550, or X570.",
        "Identify the board by checking socket label, RAM type, chipset name, and manufacturer specs.",
      ],
    },
  ],
  hotspots: [],
};
