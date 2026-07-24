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
            id: "cpu-s1",
            title: "AMD Central Processing Unit Overview",
            body:
              "In this module, you’ll explore an AMD CPU package in 3D.\n" +
              "You will identify key external parts before moving into deeper disassembly steps.",
            points: [
              "Rotate, zoom, and inspect the CPU from any angle.",
              "Tap numbered pins to learn each component.",
              "Use this as a visual guide before physical disassembly.",
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
            en: "The metal top surface spreads heat evenly so the cooler can remove it from the CPU.",
          },
          {
            id: "cpu-intel-hs-2",
            number: 2,
            title: "Contact Pad Area",
            position: [0.34, -0.08, 0.18],
            frontAxis: [0, 1, 0],
            en: "Flat contact pads connect the Intel CPU to socket pins on the motherboard.",
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
