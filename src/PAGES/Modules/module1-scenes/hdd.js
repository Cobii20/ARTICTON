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
          {
            id: "hdd-hs-1",
            number: 1,
            title: "Drive Casing",
            position: [0, 0.12, 0],
            frontAxis: [0, 1, 0],
            en: "The metal casing protects the internal spinning platters and read/write mechanism.",
          },
          {
            id: "hdd-hs-2",
            number: 2,
            title: "SATA Connectors",
            position: [0.42, -0.08, 0.22],
            frontAxis: [0, 1, 0],
            en: "SATA data and power connectors link the drive to the motherboard and power supply.",
          },
          {
            id: "hdd-hs-3",
            number: 3,
            title: "Mounting Points",
            position: [-0.36, -0.08, -0.18],
            frontAxis: [0, 1, 0],
            en: "Mounting holes secure the HDD inside the case or drive bay to reduce movement and vibration.",
          },
        ],
      };
