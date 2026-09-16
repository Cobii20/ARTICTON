export const ssdScene = {
  key: "ssd",
  name: "SSD",
  url: "/models/Ssd(Base).glb",
  view: {
    cameraPos: [0, 0.65, 2.7],
    boundsMargin: 1.15,
    minDistance: 1.1,
    maxDistance: 6,
    modelScale: 0.8,
    modelRotation: [0, 0.2, 0],
    modelPosition: [0, 0, 0],
    normalize: { enabled: true, targetSize: 2.3 },
    pinStyle: { buttonPx: 10, numberPx: 6, glowRadius: 0.012, distanceFactor: 16 },
  },
  slides: [
    {
      id: "ssd-s1",
      title: "Solid-State Drive Overview",
      body:
        "Explore a solid-state drive and identify the parts that make fast storage possible.\n" +
        "This module shows an M.2-style SSD, a compact drive that installs directly on the motherboard.",
      points: [
        "Identify the connector edge.",
        "Recognize memory/storage chips.",
        "Understand where M.2 SSDs fit in a PC platform.",
      ],
    },
    {
      id: "ssd-s2",
      title: "SSD Varieties",
      body:
        "M.2 is only one SSD form factor. SSDs also vary by physical shape and by data interface.\n" +
        "Some M.2 drives use PCIe/NVMe for high speed, while some use SATA signaling.",
      points: [
        "M.2 NVMe SSD: small stick-shaped drive using PCIe lanes for high performance.",
        "2.5-inch SATA SSD: rectangular drive using SATA data and power cables.",
        "Other varieties include mSATA, U.2 enterprise drives, and PCIe add-in card SSDs.",
      ],
    },
  ],
  hotspots: [],
};
