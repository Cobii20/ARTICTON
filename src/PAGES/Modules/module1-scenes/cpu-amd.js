export const cpuSceneAMD = {
  key: "cpu",
  name: "AMD Central Processing Unit",
  url: "/models/CpuAMD(Base).glb",
  view: {
    cameraPos: [4.8, 4.1, 5.7],
    fov: 38,
    boundsMargin: 1.15,
    minDistance: 3.2,
    maxDistance: 9,
    modelScale: 0.3,
    modelRotation: [-Math.PI / 4, Math.PI / 4, 0],
    modelPosition: [-0.3, 0, 0.5],
    pinStyle: { buttonPx: 20, numberPx: 7, glowRadius: 0.04, distanceFactor: 12 },
  },
  slides: [
    {
      id: "cpu-s1",
      title: "AMD Central Processing Unit Overview",
      body:
        "The CPU is the brain of the computer and one of the most important chips in the system.\n" +
        "It is installed directly into a CPU socket on the motherboard.",
      points: [
        "Inspect the processor package and underside contact area.",
        "Use the orientation marker before seating the CPU.",
        "Remember that the CPU fan and heatsink reduce processor heat.",
      ],
    },
  ],
  hotspots: [
    {
      id: "cpu-amd-hs-1",
      number: 1,
      title: "Integrated Heat Spreader",
      position: [2.5, 0.72, 0],
      frontAxis: [0, 0, 1],
      en: "The top surface passes processor heat to the CPU fan and heatsink assembly.",
    },
    {
      id: "cpu-amd-hs-2",
      number: 2,
      title: "Contact Pin Area",
      position: [2, -1, -0.2],
      frontAxis: [0, -1, -1],
      en: "This underside area connects the CPU to a motherboard CPU socket.",
    },
    {
      id: "cpu-amd-hs-3",
      number: 3,
      title: "Orientation Marker",
      position: [4, 2, -0.8],
      en: "The corner marker helps align the CPU correctly before installation.",
    },
  ],
};
