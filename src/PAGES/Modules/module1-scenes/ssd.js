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
      title: "Solid State Drive Overview",
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
 
  ],
};
