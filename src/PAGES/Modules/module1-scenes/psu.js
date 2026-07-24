export const psuScene = {
        key: "psu",
        name: "PSU",
        url: "/models/Psu(Base).glb",
        view: {
          cameraPos: [0, 8, 8],
          boundsMargin: 1.2,
          minDistance: 3.8,
          maxDistance: 12,
          modelScale: 0.4,
          modelRotation: [0, 0, 0],
          modelPosition: [-0.1, 1.5, 0.1],
          normalize: { enabled: true, targetSize: 2.6 },
          pinStyle: { buttonPx: 10, numberPx: 6, glowRadius: 0.05, distanceFactor: 14 },
        },
        slides: [
          {
            id: "psu-s1",
            title: "Power Supply Unit Overview",
            body:
              "The PSU converts AC wall power into regulated DC power for the PC.",
            points: [
              "Identify the AC input and main output area.",
              "PSUs must not be opened.",
              "Use pins to locate key areas.",
            ],
          },
        ],
        hotspots: [
          {
            id: "psu-hs-1",
            number: 1,
            title: "Cooling Fan",
            position: [0, 0.32, 0.2],
            frontAxis: [0, 1, 0],
            en: "The PSU fan moves heat away from internal power components during operation.",
          },
          {
            id: "psu-hs-2",
            number: 2,
            title: "AC Power Input",
            position: [-0.48, 0.08, 0.2],
            frontAxis: [0, 1, 0],
            en: "This socket receives AC wall power before the PSU converts it into regulated DC outputs.",
          },
          {
            id: "psu-hs-3",
            number: 3,
            title: "DC Cable Output Area",
            position: [0.5, 0.02, -0.12],
            frontAxis: [0, 1, 0],
            en: "Power cables from this area deliver DC power to the motherboard, CPU, GPU, and drives.",
          },
        ],
      };
