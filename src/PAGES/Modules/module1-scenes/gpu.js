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
    modelRotation: [Math.PI / 2, Math.PI / 4, Math.PI + Math.PI * 4],
    modelPosition: [-0.2, 0, 0.2],
    normalize: { enabled: true, targetSize: 2.8 },
    pinStyle: { buttonPx: 5, numberPx: 6, glowRadius: 0.015, distanceFactor: 15 },
  },
  slides: [
    {
      id: "gpu-s1",
      title: "Graphics Processing Unit Overview",
      body:
        "Explore the graphics card and identify its major visible parts.\n" +
        "A GPU handles graphics processing and connects to the motherboard through a PCIe slot.",
      points: [
        "Identify the PCIe connector.",
        "Recognize the cooling system.",
        "Learn how display output leaves the graphics card.",
      ],
    },
    {
      id: "gpu-s2",
      title: "Two Common GPU Types",
      body:
        "PCs commonly use two GPU types: integrated graphics and dedicated graphics.\n" +
        "The model shown here represents a dedicated graphics card.",
      points: [
        "Integrated GPU: built into the CPU or processor package and uses system RAM.",
        "Dedicated GPU: separate PCIe card with its own VRAM, cooler, and display outputs.",
        "Dedicated GPUs are preferred for gaming, rendering, AI workloads, and other graphics-heavy tasks.",
      ],
    },
  ],
  hotspots: [],
};
