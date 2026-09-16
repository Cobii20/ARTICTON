export const cpuSceneAMD = {
  key: "cpu",
  name: "AMD Central Processing Unit",
  url: "/models/CpuAMD(Base).glb",
  view: {
    cameraPos: [0, 8, 8],
    boundsMargin: 1.15,
    minDistance: 4,
    maxDistance: 10,
    modelScale: 0.3,
    modelRotation: [-Math.PI / 4, Math.PI / 4, 0],
    modelPosition: [-0.3, 0, 0.5],
    pinStyle: { buttonPx: 20, numberPx: 7, glowRadius: 0.04, distanceFactor: 12 },
  },
  slides: [
    {
      id: "cpu-amd-s1",
      title: "AMD Central Processing Unit Overview",
      body:
        "In this module, you'll explore an AMD CPU package in 3D.\n" +
        "The AMD learning path focuses on AM5-style identification and how it differs from AM4.",
      points: [
        "Rotate, zoom, and inspect the CPU from any angle.",
        "Notice the top heat spreader and the bottom contact area.",
        "Use the package style to confirm which motherboard socket is compatible.",
      ],
    },
    {
      id: "cpu-amd-s2",
      title: "AM5 vs AM4 Identification",
      body:
        "AM5 is AMD's newer desktop socket platform. The fastest visual check is where the pins are located.\n" +
        "AM5 CPUs have flat contact pads on the CPU and pins inside the motherboard socket. AM4 CPUs have small pins on the CPU itself.",
      points: [
        "AM5: LGA package, flat pads on the processor, DDR5 memory support.",
        "AM4: PGA package, visible CPU pins, DDR4 memory support.",
        "Check the motherboard socket label, chipset family, and RAM type before installing a CPU.",
      ],
    },
  ],
  hotspots: [],
};
