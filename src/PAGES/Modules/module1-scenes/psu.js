export const psuScene = {
        key: "psu",
        name: "PSU",
        url: "/models/psu.glb",
        view: {
          cameraPos: [0, 1.15, 6.2],
          boundsMargin: 1.2,
          minDistance: 3.8,
          maxDistance: 12,
          modelScale: 1.0,
          modelRotation: [0, -0.25, 0],
          modelPosition: [0, 0, 0],
          normalize: { enabled: true, targetSize: 2.6 },
          pinStyle: { buttonPx: 34, glowRadius: 0.05, distanceFactor: 14 },
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
            title: "PSU Fan / Vent",
            position: [-0.294, -5.234, -0.641],
            frontAxis: [0, 1, 0],
            en: "Moves air to cool internal components and maintain stable power delivery.",
          },
          {
            id: "psu-hs-2",
            number: 2,
            title: "AC Input Socket",
            position: [-0.717, -5.778, -1.699],
            frontAxis: [0, 1, -1],
            en: "Where the power cable from the wall plugs into the PSU.",
          },
          {
            id: "psu-hs-3",
            number: 3,
            title: "DC Output / Cable Interface",
            position: [0.019, -5.759, 0.795],
            frontAxis: [0, 0, 1],
            en: "Where PSU cables connect to supply power to the motherboard, GPU, and storage.",
          },
        ],
      };