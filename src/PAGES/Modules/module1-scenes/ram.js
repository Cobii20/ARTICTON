export const ramScene =  {
        key: "ram",
        name: "RAM",
        url: "/models/ram.glb",
        view: {
          cameraPos: [0, 0.55, 2.4],
          boundsMargin: 1.05,
          minDistance: 0.9,
          maxDistance: 6.0,
          modelScale: 1.5,
          modelRotation: [0, 0.35, 0],
          modelPosition: [0, 0, 0],
          normalize: { enabled: true, targetSize: 2.8 },
          pinStyle: { buttonPx: 16, glowRadius: 0.006, distanceFactor: 18 },
        },
        slides: [
          {
            id: "ram-s1",
            title: "RAM Module Overview",
            body:
              "Explore a RAM stick and learn its key parts.\nRAM provides fast temporary storage while programs run.",
            points: [
              "Identify the IC chips and connector edge.",
              "Understand the notch alignment.",
              "Learn safe handling.",
            ],
          },
        ],
        hotspots: [
          {
            id: "ram-hs-1",
            number: 1,
            title: "Memory IC Chips",
            position: [-0.55, 0, 0.03],
            en: "These chips store data temporarily for fast access by the CPU.",
          },
          {
            id: "ram-hs-2",
            number: 2,
            title: "Gold Contacts (Edge Connector)",
            position: [0.4, 0, 0.3],
            en: "The gold contacts connect the RAM electrically to the motherboard DIMM slot.",
          },
          {
            id: "ram-hs-3",
            number: 3,
            title: "Alignment Notch",
            position: [-1.28, -0.01, 0.06],
            en: "The notch ensures the RAM is inserted in the correct orientation.",
          },
        ],
      };