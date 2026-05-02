export const motherboardScene = {
        key: "motherboard",
        name: "Motherboard",
        url: "/models/motherboard.glb",
        view: {
          cameraPos: [0, 1.2, 3.2],
          boundsMargin: 1.2,
          minDistance: 1.8,
          maxDistance: 7,
          modelScale: 1,
          modelRotation: [0, 0, 0],
          modelPosition: [0, 0, 0],
          pinStyle: { buttonPx: 36, glowRadius: 0.05, distanceFactor: 10 },
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
          {
            id: "mb-hs-1",
            number: 1,
            title: "CPU Socket Area",
            position: [0.2, 0.3, -0.8],
            en: "The CPU socket holds and connects the processor to the motherboard.",
          },
          {
            id: "mb-hs-2",
            number: 2,
            title: "RAM Slots",
            position: [1.4, 0.32, -1],
            en: "DIMM slots where memory modules are installed.",
          },
          {
            id: "mb-hs-3",
            number: 3,
            title: "24-pin ATX Power Connector",
            position: [2, 0.2, -0.55],
            en: "Main power input from the PSU to the motherboard.",
          },
        ],
      };