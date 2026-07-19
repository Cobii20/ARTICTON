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
          pinStyle: { buttonPx: 34, glowRadius: 0.05, distanceFactor: 10 },
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
       
        ],
      
      };