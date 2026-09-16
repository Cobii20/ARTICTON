export const hddScene = {
  key: "hdd",
  name: "HDD",
  url: "/models/Hdd(Base).glb",
  view: {
    cameraPos: [0, 8, 8],
    boundsMargin: 1.15,
    minDistance: 1,
    maxDistance: 5,
    modelScale: 0.2,
    modelRotation: [0, 0, 0],
    modelPosition: [0, 0, 0],
    pinStyle: { buttonPx: 20, numberPx: 7, glowRadius: 0.05, distanceFactor: 10 },
    normalize: { enabled: false },
  },
  slides: [
    {
      id: "hdd-s1",
      title: "Hard Disk Drive Overview",
      body:
        "This module introduces the HDD exterior and connection points.\n" +
        "HDDs store data long-term using spinning platters internally.",
      points: [
        "Identify SATA data and power ports.",
        "Recognize the casing and mounting holes.",
        "Handle HDDs carefully because shock can damage internal moving parts.",
      ],
    },
    {
      id: "hdd-s2",
      title: "HDD Variations",
      body:
        "Hard drives vary by physical size, spindle speed, and workload rating.\n" +
        "They are slower than SSDs but still useful for large, low-cost storage.",
      points: [
        "3.5-inch HDDs are common in desktop PCs.",
        "2.5-inch HDDs are common in older laptops and compact systems.",
        "Common spindle speeds include 5400 RPM and 7200 RPM.",
      ],
    },
  ],
  hotspots: [],
};
