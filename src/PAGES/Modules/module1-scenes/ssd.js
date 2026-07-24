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
      title: "SSD Overview",
      body:
        "Explore a solid-state drive and identify the parts that make fast storage possible.\n" +
        "SSDs store data without spinning platters, which makes them faster and more shock resistant than HDDs.",
      points: [
        "Identify the connector edge.",
        "Recognize memory/storage chips.",
        "Understand where SSDs fit in a PC platform.",
      ],
    },
  ],
  hotspots: [
    {
      id: "ssd-hs-1",
      number: 1,
      title: "Connector Edge",
      position: [0.65, 0, 0.12],
      frontAxis: [0, 1, 0],
      en: "The connector links the SSD to the motherboard so data and power can pass through.",
    },
    {
      id: "ssd-hs-2",
      number: 2,
      title: "Storage Chips",
      position: [-0.28, 0.04, 0.05],
      frontAxis: [0, 1, 0],
      en: "Flash memory chips store files, applications, and operating system data.",
    },
    {
      id: "ssd-hs-3",
      number: 3,
      title: "Controller Area",
      position: [0.1, 0.05, -0.18],
      frontAxis: [0, 1, 0],
      en: "The controller manages how data is read, written, and organized across the SSD.",
    },
  ],
};
