export const caseScene =  {
        key: "case",
        name: "Case",
        url: "/models/Case(Base).glb",
        view: {
          cameraPos: [2.7, 1.8, 5.4],
          fov: 40,
          boundsMargin: 1.25,
          minDistance: 2,
          maxDistance: 11,
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
         
        ],
      };
