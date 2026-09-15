export const hddScene =    {
        key: "hdd",
        name: "HDD",
        url: "/models/Hdd(Base).glb",
        view: {
            cameraPos: [0, 8, 8],
          boundsMargin: 1.15,
          minDistance: 1,
          maxDistance: 5,
          modelScale: 0.2,
          modelRotation: [0, 0, 0],
          modelPosition: [0, 0, 0],
          pinStyle: { buttonPx: 20, numberPx: 7, glowRadius: 0.05, distanceFactor: 10 },
          normalize: { enabled: false },
        },
        slides: [
          {
            id: "hdd-s1",
            title: "Hard Disk Drive Overview",
            body:
              "This module introduces the HDD exterior and connection points.\nHDDs store data long-term using spinning platters internally.",
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
