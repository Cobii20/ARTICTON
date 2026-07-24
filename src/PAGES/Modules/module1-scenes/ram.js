export const ramScene =  {
        key: "ram",
        name: "RAM",
        url: "/models/Ram(Base).glb",
        view: {
           cameraPos: [0, 8, 8],
          boundsMargin: 1.15,
          minDistance: 3.6,
          maxDistance: 6,
          modelScale: 0.1,
          modelRotation: [-Math.PI / 4, Math.PI / 4, 0],
          modelPosition: [-0.1, 0, 0],
          pinStyle: { buttonPx: 15, numberPx: 6, glowRadius: 0.05, distanceFactor: 10 },
          normalize: { enabled: false },
        },
        slides: [
          {
            id: "ram-s1",
            title: "Random Access Memory Overview",
            body:
              "This module introduces the RAM exterior and connection points.\nRAM provides high-speed temporary storage for active processes.",
            points: [
              "Identify SATA data + power ports.",
              "Recognize the casing and mounting holes.",
              "Learn handling precautions.",
            ],
          },
        ],
        hotspots: [
          {
            id: "ram-hs-1",
            number: 1,
            title: "Memory Chips",
            position: [0, 0.14, 0.08],
            frontAxis: [0, 1, 0],
            en: "Memory chips temporarily store active data so the CPU can access it quickly.",
          },
          {
            id: "ram-hs-2",
            number: 2,
            title: "Gold Edge Connector",
            position: [0.42, -0.18, 0.02],
            frontAxis: [0, 1, 0],
            en: "The gold contacts slide into the motherboard DIMM slot and carry data, power, and control signals.",
          },
          {
            id: "ram-hs-3",
            number: 3,
            title: "Alignment Notch",
            position: [-0.08, -0.2, 0.02],
            frontAxis: [0, 1, 0],
            en: "The notch ensures the RAM module fits only in the correct orientation.",
          },
        ],
      
      };
