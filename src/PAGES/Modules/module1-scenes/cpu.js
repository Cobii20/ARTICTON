export const cpuScene = {
        key: "cpu",
        name: "CPU",
        url: "/models/cpu.glb",
        view: {
          cameraPos: [0, 1.2, 3.2],
          boundsMargin: 1.15,
          minDistance: 1.8,
          maxDistance: 7,
          modelScale: 1,
          modelRotation: [0, 0, 0],
          modelPosition: [0, 0, 0],
          pinStyle: { buttonPx: 36, glowRadius: 0.05, distanceFactor: 10 },
          normalize: { enabled: false },
        },
        slides: [
          {
            id: "cpu-s1",
            title: "CPU Disassembly Overview",
            body:
              "In this module, you’ll explore a CPU package in 3D.\n" +
              "You will identify key external parts before moving into deeper disassembly steps.",
            points: [
              "Rotate, zoom, and inspect the CPU from any angle.",
              "Tap numbered pins to learn each component.",
              "Use this as a visual guide before physical disassembly.",
            ],
          },
        ],
        hotspots: [
          {
            id: "cpu-hs-1",
            number: 1,
            title: "Heat Spreader (Top Cap)",
            position: [3.05, 0.28, 0.02],
            frontAxis: [0, 1, 0],
            en: "The top metal cover spreads heat from the chip to the cooler for better cooling.",
          },
          {
            id: "cpu-hs-2",
            number: 2,
            title: "Substrate / Package Base",
            position: [1.82, -0.35, -0.84],
            frontAxis: [0, -1, 0],
            en: "The base that supports the CPU package and routes signals between internal layers.",
          },
          {
            id: "cpu-hs-3",
            number: 3,
            title: "Contact / Pin Area",
            position: [0.58, -0.47, 0.28],
            frontAxis: [0, -1, 0],
            en: "The contact area connects the CPU to the motherboard socket to deliver power and data.",
          },
        ],
      };
      