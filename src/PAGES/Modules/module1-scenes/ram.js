export const ramScene = {
  key: "ram",
  name: "RAM",
  url: "/models/Ram(Base).glb",
  view: {
    cameraPos: [2.4, 1.8, 3.1],
    fov: 38,
    boundsMargin: 1.15,
    minDistance: 2.6,
    maxDistance: 6.8,
    modelScale: 0.1,
    modelRotation: [-Math.PI / 4, Math.PI / 4, 0],
    modelPosition: [-0.1, 0, 0],
    pinStyle: { buttonPx: 15, numberPx: 6, glowRadius: 0.05, distanceFactor: 10 },
    normalize: { enabled: false },
  },
  slides: [
    {
      id: "ram-s1",
      title: "Random Access Memory Overview",
      body:
        "Random Access Memory (RAM), also called a DIMM memory module, allows stored data to be accessed randomly.\n" +
        "Its main function is to store data temporarily while the computer is powered on.",
      points: [
        "Find the gold edge connector that enters the motherboard memory holder.",
        "Use the alignment notch to match the correct slot orientation.",
        "RAM module information can include type, density, speed, and latency.",
      ],
    },
  ],
  hotspots: [
    {
      id: "ram-hs-1",
      number: 1,
      title: "Memory Chips",
      position: [0, 0.14, 0.08],
      frontAxis: [0, 1, 0],
      en: "RAM temporarily stores data used during active computer operation.",
    },
    {
      id: "ram-hs-2",
      number: 2,
      title: "Gold Edge Connector",
      position: [0.42, -0.18, 0.02],
      frontAxis: [0, 1, 0],
      en: "The gold contacts slide into the motherboard memory holder or DIMM slot.",
    },
    {
      id: "ram-hs-3",
      number: 3,
      title: "Alignment Notch",
      position: [-0.08, -0.2, 0.02],
      frontAxis: [0, 1, 0],
      en: "The notch helps match the RAM module to the correct memory slot orientation.",
    },
  ],
};
