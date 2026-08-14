import { motherboardScene } from "./motherboard";

export const motherboardSceneIntel = {
  ...motherboardScene,
  name: "Intel Motherboard",
  url: "/models/MotherboardINTEL(Base).glb",
  view: {
    cameraPos: [1.8, 1.55, 3.4],
    fov: 39,
    boundsMargin: 1.2,
    minDistance: 1.6,
    maxDistance: 7.5,
    modelScale: 0.1,
    modelRotation: [0, Math.PI / 180, 0],
    modelPosition: [0, 0, 0],
    pinStyle: { buttonPx: 36, numberPx: 10, glowRadius: 0.05, distanceFactor: 10 },
    normalize: { enabled: false },
  },
  slides: [
    {
      id: "mb-s1",
      title: "Motherboard Overview",
      body:
        "The motherboard, also called the system board, is the main printed circuit board in the computer.\n" +
        "It contains sockets, slots, controllers, and ports that allow other components to connect.",
      points: [
        "Find the CPU holder and memory holder.",
        "Recognize power, SATA, and expansion areas.",
        "Use back-panel and front-panel pins to identify connections.",
      ],
    },
  ],
  hotspots: [
    {
      id: "mb-hs-1",
      number: 1,
      title: "CPU Socket Area",
      position: [0.2, 0.3, -0.8],
      frontAxis: [0, 1, 0],
      en: "The CPU holder is the motherboard portion that holds the processor.",
    },
    {
      id: "mb-hs-2",
      number: 2,
      title: "RAM Slots",
      position: [1.4, 0.32, -1],
      frontAxis: [0, 1, 0],
      en: "The memory holder is the slot where the RAM module or memory card is inserted.",
    },
    {
      id: "mb-hs-3",
      number: 3,
      title: "24-pin ATX Power Connector",
      position: [2, 0.2, -0.55],
      frontAxis: [0, 1, 0],
      en: "The power supply controller area receives the PSU cable connector.",
    },
  ],
};
