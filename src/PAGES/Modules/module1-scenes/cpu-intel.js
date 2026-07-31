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
         
        ],
};
