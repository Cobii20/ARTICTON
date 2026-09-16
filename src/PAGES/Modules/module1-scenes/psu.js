export const psuScene = {
  key: "psu",
  name: "PSU",
  url: "/models/Psu(Base).glb",
  view: {
    cameraPos: [0, 8, 8],
    boundsMargin: 1.2,
    minDistance: 3.8,
    maxDistance: 12,
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
        "The PSU converts AC wall power into regulated DC power for the PC.",
      points: [
        "Identify the AC input and main output area.",
        "PSUs must not be opened because capacitors can hold dangerous charge.",
        "Use the label to check wattage, efficiency rating, and output rails.",
      ],
    },
    {
      id: "psu-s2",
      title: "PSU Cable Variations",
      body:
        "Power supplies are often grouped by cable modularity.\n" +
        "Modularity affects cable management, airflow, and how easily unused cables can be removed.",
      points: [
        "Non-modular PSU: every cable is permanently attached.",
        "Semi-modular PSU: essential cables are fixed, while extra PCIe or SATA cables can detach.",
        "Fully modular PSU: most or all cables detach, but cables should only be used with compatible PSU models.",
      ],
    },
  ],
  hotspots: [],
};
