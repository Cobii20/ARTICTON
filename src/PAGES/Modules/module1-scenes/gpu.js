export const gpuScene = {
  key: "gpu",
  name: "GPU",
  url: "/models/Gpu(Base).glb",
  view: {
    cameraPos: [0, 8, 8],
    boundsMargin: 1.15,
    minDistance: 1.5,
    maxDistance: 7,
    modelScale: 0.4,
modelRotation: [
  Math.PI / 2,
  Math.PI / 4,
  Math.PI + Math.PI * 4
],
    modelPosition: [-0.2, 0, 0.2],
    normalize: { enabled: true, targetSize: 2.8 },
    pinStyle: { buttonPx: 5, numberPx: 6, glowRadius: 0.015, distanceFactor: 15 },
  },
  slides: [
    {
      id: "gpu-s1",
      title: "GPU Overview",
      body:
        "Explore the graphics card and identify its major visible parts.\n" +
        "A GPU handles graphics processing and connects to the motherboard through a PCIe slot.",
      points: [
        "Identify the PCIe connector.",
        "Recognize the cooling system.",
        "Learn how display output leaves the graphics card.",
      ],
    },
  ],
  hotspots: [
    {
      id: "gpu-hs-1",
      number: 1,
      title: "PCIe Edge Connector",
      position: [0.45, -0.22, 0.08],
      frontAxis: [0, 1, 0],
      en: "This connector slots into the motherboard PCIe slot for data transfer and power delivery.",
    },
    {
      id: "gpu-hs-2",
      number: 2,
      title: "Cooling Assembly",
      position: [-0.25, 0.18, 0.18],
      frontAxis: [0, 1, 0],
      en: "The cooling system moves heat away from the graphics processor during heavy workloads.",
    },
    {
      id: "gpu-hs-3",
      number: 3,
      title: "Display Output Area",
      position: [-0.75, 0.05, -0.12],
      frontAxis: [0, 1, 0],
      en: "Display ports connect the GPU to monitors for video output.",
    },
  ],
};
