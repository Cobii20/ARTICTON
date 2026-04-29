export const hddScene =    {
        key: "hdd",
        name: "HDD",
        url: "/models/hdd.glb",
        view: {
          cameraPos: [0, 0.9, 3.0],
          boundsMargin: 1.15,
          minDistance: 1.6,
          maxDistance: 7,
          modelScale: 1,
          modelRotation: [0, 0, 0],
          modelPosition: [0, 0, 0],
          pinStyle: { buttonPx: 34, glowRadius: 0.05, distanceFactor: 10 },
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
           { id: "hdd-hs-1", number: 1, title: "SATA Data Port", position: [239.735, 0.039, -9.351],frontAxis: [0, 1, 1], en: "Transfers data between the HDD and motherboard via a SATA cable." },
          { id: "hdd-hs-2", number: 2, title: "SATA Power Port", position: [239.735, -0.045, 80.445],frontAxis: [0, 1, 1], en: "Receives power from the PSU through the SATA power connector." },
          { id: "hdd-hs-3", number: 3, title: "Drive Casing", position: [-13.835, 16.201, -133.387],frontAxis: [0, 1, 0], en: "Protective metal enclosure that houses internal parts." },
        ],
      };