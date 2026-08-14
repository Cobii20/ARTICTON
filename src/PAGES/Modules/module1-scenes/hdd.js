export const hddScene = {
  key: "hdd",
  name: "HDD",
  url: "/models/Hdd(Base).glb",
  view: {
    cameraPos: [2.8, 2.1, 3.8],
    fov: 39,
    boundsMargin: 1.15,
    minDistance: 1.1,
    maxDistance: 6,
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
        "A Hard Disk Drive, or hard drive, is the computer's main storage device for permanent data.\n" +
        "It stores data on spinning platters with a thin magnetic coating.",
      points: [
        "Identify SATA data and power connections.",
        "Recognize the casing and mounting points.",
        "Remember that tracks, sectors, and cylinders organize data on platters.",
      ],
    },
  ],
  hotspots: [
    {
      id: "hdd-hs-1",
      number: 1,
      title: "Drive Casing",
      position: [0, 0.12, 0],
      frontAxis: [0, 1, 0],
      en: "The casing protects the spinning platters and read/write heads inside the hard drive.",
    },
    {
      id: "hdd-hs-2",
      number: 2,
      title: "SATA Connectors",
      position: [0.42, -0.08, 0.22],
      frontAxis: [0, 1, 0],
      en: "A SATA data cable connects the hard drive to the motherboard, and SATA power comes from the PSU.",
    },
    {
      id: "hdd-hs-3",
      number: 3,
      title: "Mounting Points",
      position: [-0.36, -0.08, -0.18],
      frontAxis: [0, 1, 0],
      en: "Mounting holes secure the HDD inside the case or drive bay to reduce movement and vibration.",
    },
  ],
};
