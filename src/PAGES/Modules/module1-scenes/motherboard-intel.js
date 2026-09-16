import { motherboardScene } from "./motherboard";

export const motherboardSceneIntel = {
  ...motherboardScene,
  name: "Intel Motherboard",
  url: "/models/MotherboardINTEL(Base).glb",
  view: {
    cameraPos: [0, 1.2, 3.2],
    boundsMargin: 1.2,
    minDistance: 1.8,
    maxDistance: 7,
    modelScale: 0.1,
    modelRotation: [0, Math.PI / 180, 0],
    modelPosition: [0, 0, 0],
    pinStyle: { buttonPx: 36, numberPx: 10, glowRadius: 0.05, distanceFactor: 10 },
    normalize: { enabled: false },
  },
  slides: [
    {
      id: "mb-intel-s1",
      title: "Intel Motherboard Overview",
      body:
        "This module helps you identify the main zones of an Intel motherboard.\n" +
        "Focus on the CPU socket, RAM slots, PCIe expansion area, storage connectors, and power connectors.",
      points: [
        "Intel boards use Intel LGA socket families, not AMD AM4 or AM5.",
        "Form factor describes board size, such as ATX, Micro-ATX, or Mini-ITX.",
        "Memory support may be DDR4 or DDR5 depending on the exact board generation.",
      ],
    },
    {
      id: "mb-intel-s2",
      title: "Form Factor vs Socket",
      body:
        "A motherboard can be small or large and still belong to a specific CPU platform.\n" +
        "Mini-ITX means compact size; the socket label and chipset determine CPU compatibility.",
      points: [
        "Mini-ITX boards are compact and usually have one PCIe x16 slot and two RAM slots.",
        "Intel compatibility is identified by the Intel socket and chipset, such as LGA1700 or a newer LGA family.",
        "Do not match an Intel CPU to an AMD AM4 or AM5 board.",
      ],
    },
  ],
  hotspots: [],
};
