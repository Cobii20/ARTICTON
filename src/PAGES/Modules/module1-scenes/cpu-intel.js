import { cpuScene } from "./cpu";

export const cpuSceneIntel = {
  ...cpuScene,
  name: "Intel CPU",
  url: "/models/CpuINTEL(Base).glb",
  view: {
    cameraPos: [4.6, 3.9, 5.4],
    fov: 38,
    boundsMargin: 1.15,
    minDistance: 3.1,
    maxDistance: 9,
    modelScale: 0.4,
    modelRotation: [-Math.PI / 4, Math.PI / 4, 0],
    modelPosition: [0, 0, 0],
    pinStyle: { buttonPx: 32, numberPx: 9, glowRadius: 0.04, distanceFactor: 12 },
  },
  slides: [
    {
      id: "cpu-s1",
      title: "Intel Central Processing Unit Overview",
      body:
        "The CPU is the brain of the computer and one of the most important chips in the system.\n" +
        "It is installed directly into a CPU socket on the motherboard.",
      points: [
        "Inspect the processor package and flat contact pad area.",
        "Use the orientation notches before seating the CPU.",
        "Remember that the CPU fan and heatsink reduce processor heat.",
      ],
    },
  ],
  hotspots: [
    {
      id: "cpu-intel-hs-1",
      number: 1,
      title: "Integrated Heat Spreader",
      position: [0, 0.12, 0],
      frontAxis: [0, 1, 0],
      en: "The top surface passes processor heat to the CPU fan and heatsink assembly.",
    },
    {
      id: "cpu-intel-hs-2",
      number: 2,
      title: "Contact Pad Area",
      position: [0.34, -0.08, 0.18],
      frontAxis: [0, 1, 0],
      en: "Flat contact pads connect this land-grid CPU package to the motherboard CPU socket.",
    },
    {
      id: "cpu-intel-hs-3",
      number: 3,
      title: "Alignment Notch",
      position: [-0.28, 0.1, -0.24],
      frontAxis: [0, 1, 0],
      en: "Alignment notches help prevent the processor from being seated in the wrong orientation.",
    },
  ],
};
