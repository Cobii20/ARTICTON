export const caseScene =  {
        key: "case",
        name: "Case",
        url: "/models/Case(Base).glb",
        view: {
          cameraPos: [0, 1.25, 5.3],
          boundsMargin: 1.25,
          minDistance: 2.2,
          maxDistance: 10,
          modelScale: 0.04,
          modelRotation: [0, 0, 0],
          modelPosition: [0, 0, 0],
          pinStyle: { buttonPx: 20, numberPx: 7, glowRadius: 0.05, distanceFactor: 10 },
          normalize: { enabled: false },
        },
        slides: [
          {
            id: "case-s1",
            title: "PC Case Overview",
            body:
              "The case provides structure, airflow, and mounting points for components.",
            points: [
              "Identify motherboard tray and PSU bay.",
              "Find storage mounting areas.",
              "Understand airflow direction.",
            ],
          },
        ],
        hotspots: [
          {
            id: "case-hs-1",
            number: 1,
            title: "Motherboard Tray Area",
            position: [0.0, 0.2, 0.0],
            frontAxis: [0, 1, 0],
            en: "Where the motherboard mounts using standoffs and screws.",
          },
          {
            id: "case-hs-2",
            number: 2,
            title: "PSU Bay",
            position: [-0.25, -0.15, 0.15],
            frontAxis: [0, 1, 0],
            en: "The compartment where the power supply is installed.",
          },
          {
            id: "case-hs-3",
            number: 3,
            title: "Drive Bay / Storage Mount",
            position: [0.28, -0.05, 0.2],
            frontAxis: [0, 1, 0],
            en: "Where HDD/SSD mounts are located in many case designs.",
          },
        ],
      };
