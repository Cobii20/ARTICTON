export const psuScene = {
  key: "psu",
  name: "PSU",
  url: "/models/Psu(Base).glb",
  view: {
    cameraPos: [3.2, 2.4, 4.2],
    fov: 39,
    boundsMargin: 1.2,
    minDistance: 2.8,
    maxDistance: 10,
    modelScale: 0.4,
    modelRotation: [0, 0, 0],
    modelPosition: [-0.1, 1.5, 0.1],
    normalize: { enabled: true, targetSize: 2.6 },
    pinStyle: { buttonPx: 10, numberPx: 6, glowRadius: 0.05, distanceFactor: 14 },
  },
  slides: [
    {
      id: "psu-s1",
      title: "Power Supply Unit Overview",
      body:
        "The Power Supply Unit, or PSU, supplies power to the personal computer.\n" +
        "It converts AC current to DC current and regulates voltage to reduce spikes and surges.",
      points: [
        "Identify the AC input and DC cable output area.",
        "Rated PSUs usually use better components than generic units.",
        "Never open the PSU enclosure.",
      ],
    },
  ],
  hotspots: [
    {
      id: "psu-hs-1",
      number: 1,
      title: "Cooling Fan",
      position: [0, 0.32, 0.2],
      frontAxis: [0, 1, 0],
      en: "The fan helps move heat away while the PSU supplies regulated computer power.",
    },
    {
      id: "psu-hs-2",
      number: 2,
      title: "AC Power Input",
      position: [-0.48, 0.08, 0.2],
      frontAxis: [0, 1, 0],
      en: "This socket receives AC current before the PSU converts it to DC current.",
    },
    {
      id: "psu-hs-3",
      number: 3,
      title: "DC Cable Output Area",
      position: [0.5, 0.02, -0.12],
      frontAxis: [0, 1, 0],
      en: "Power cables from this area deliver regulated DC power to the motherboard, drives, and cards.",
    },
  ],
};
