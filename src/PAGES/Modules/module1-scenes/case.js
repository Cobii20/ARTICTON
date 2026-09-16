export const caseScene = {
  key: "case",
  name: "Case",
  url: "/models/Case(Base).glb",
  view: {
    cameraPos: [0, 1.25, 5.3],
    boundsMargin: 1.25,
    minDistance: 2.2,
    maxDistance: 10,
    modelScale: 0.04,
    modelRotation: [0, 0, 0],
    modelPosition: [0, 0, 0],
    pinStyle: { buttonPx: 20, numberPx: 7, glowRadius: 0.05, distanceFactor: 10 },
    normalize: { enabled: false },
  },
  slides: [
    {
      id: "case-s1",
      title: "PC Case Overview",
      body:
        "The case provides structure, airflow, and mounting points for components.",
      points: [
        "Identify the motherboard tray and PSU bay.",
        "Find storage mounting areas.",
        "Understand airflow direction.",
      ],
    },
    {
      id: "case-s2",
      title: "Case Size Variations",
      body:
        "Cases are chosen by motherboard support, component clearance, cooling layout, and PSU size.\n" +
        "The case must physically fit the motherboard and leave enough room for the GPU, cooler, drives, and cables.",
      points: [
        "ATX towers support full-size ATX boards and usually offer more expansion space.",
        "Micro-ATX cases are smaller while still supporting many standard parts.",
        "Mini-ITX cases are compact and require careful checks for cooler, GPU, and PSU clearance.",
      ],
    },
  ],
  hotspots: [],
};
