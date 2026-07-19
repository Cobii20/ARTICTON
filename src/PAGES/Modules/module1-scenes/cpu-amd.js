import { cpuScene } from "./cpu";

export const cpuSceneAMD = {
   key: "cpu",
        name: "AMD Central Processing Unit",
        url: "/models/CpuAMD(Base).glb",
       view: {
          cameraPos: [0, 8, 8],
          boundsMargin: 1.15,
          minDistance: 4,
          maxDistance: 10,
          modelScale: 0.3,
          modelRotation: [-Math.PI / 4, Math.PI / 4, 0],
          modelPosition: [-0.3, 0, 0.5],
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
        hotspots: [],
      };
      
