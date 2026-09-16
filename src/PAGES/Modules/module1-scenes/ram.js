export const ramScene = {
  key: "ram",
  name: "RAM",
  url: "/models/Ram(Base).glb",
  view: {
    cameraPos: [0, 8, 8],
    boundsMargin: 1.15,
    minDistance: 3.6,
    maxDistance: 6,
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
        "This module introduces the RAM exterior and connection points.\n" +
        "RAM provides high-speed temporary storage for active programs and data.",
      points: [
        "Identify the gold contacts and the offset notch.",
        "Recognize the memory chips and optional heat spreader.",
        "Install RAM only in a motherboard slot that supports its DDR generation.",
      ],
    },
    {
      id: "ram-s2",
      title: "DDR4, DDR5, Frequency, and Speed",
      body:
        "DDR4 and DDR5 RAM modules look similar, but they are not interchangeable.\n" +
        "The notch position, motherboard support, and rated transfer speed are different.",
      points: [
        "DDR4 commonly runs around 2133-3200 MT/s, with faster XMP or EXPO kits available.",
        "DDR5 commonly starts around 4800 MT/s and can run much higher on supported boards.",
        "Speed is usually listed as MT/s, while latency timings such as CL also affect performance.",
      ],
    },
  ],
  hotspots: [],
};
