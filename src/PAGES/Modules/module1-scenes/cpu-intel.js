import { cpuScene } from "./cpu";

export const cpuSceneIntel = {
  ...cpuScene,
  name: "Intel CPU",
  url: "/models/CpuINTEL(Base).glb",
  view: {
    cameraPos: [0, 8, 8],
    boundsMargin: 1.15,
    minDistance: 4,
    maxDistance: 10,
    modelScale: 0.4,
    modelRotation: [-Math.PI / 4, Math.PI / 4, 0],
    modelPosition: [0, 0, 0],
    pinStyle: { buttonPx: 32, numberPx: 9, glowRadius: 0.04, distanceFactor: 12 },
  },
  slides: [
    {
      id: "cpu-intel-s1",
      title: "Intel Central Processing Unit Overview",
      body:
        "In this module, you'll explore an Intel CPU package in 3D.\n" +
        "Intel desktop CPUs use Intel socket families, so they are not installed in AMD AM4 or AM5 motherboards.",
      points: [
        "Rotate, zoom, and inspect the CPU from any angle.",
        "Intel desktop packages commonly use flat contact pads on the CPU.",
        "Match the CPU to the exact Intel motherboard socket family before installation.",
      ],
    },
    {
      id: "cpu-intel-s2",
      title: "Intel vs AMD Socket Check",
      body:
        "Intel and AMD processors may look similar from the top, but socket compatibility is different.\n" +
        "Always identify the socket family from the CPU model and motherboard socket marking.",
      points: [
        "Intel CPUs do not use AMD AM4 or AM5 sockets.",
        "AMD AM5 uses DDR5 boards; AMD AM4 uses DDR4 boards.",
        "For any platform, never force a CPU into a socket that does not match.",
      ],
    },
  ],
  hotspots: [],
};
