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
          modelRotation: [0, Math.PI /180, 0],
          modelPosition: [0, 0, 0],
          pinStyle: { buttonPx: 20, numberPx: 7, glowRadius: 0.05, distanceFactor: 10 },
          normalize: { enabled: false },
        },
        slides: [
          {
            id: "mb-s1",
            title: "Motherboard Overview",
            body:
              "This module helps you identify major motherboard zones.\n" +
              "Focus on where power comes in, where the CPU/RAM sit, and how storage connects.",
            points: [
              "Learn main connectors and slots.",
              "Understand how parts communicate on the board.",
              "Use pins to identify components quickly.",
            ],
          },
        ],
        hotspots: [
         
        ],
};
