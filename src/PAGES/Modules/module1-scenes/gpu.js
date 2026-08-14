export const gpuScene = {
  key: "gpu",
  name: "GPU",
  url: "/models/Gpu(Base).glb",
  view: {
    cameraPos: [3.2, 2.2, 4.3],
    fov: 39,
    boundsMargin: 1.15,
    minDistance: 1.4,
    maxDistance: 8,
    modelScale: 0.4,
    modelRotation: [Math.PI / 2, Math.PI / 4, Math.PI + Math.PI * 4],
    modelPosition: [-0.2, 0, 0.2],
    normalize: { enabled: true, targetSize: 2.8 },
    pinStyle: { buttonPx: 5, numberPx: 6, glowRadius: 0.015, distanceFactor: 15 },
  },
  slides: [
    {
      id: "gpu-s1",
      title: "Video Card Adapter Overview",
      body:
        "The video card, also called a graphics accelerator card, display adapter, or graphics card, generates and displays output images to a monitor.\n" +
        "Modern motherboards use expansion slots such as PCI Express for cards.",
      points: [
        "Identify the expansion-card connector.",
        "Recognize the cooling system.",
        "Learn where display output leaves the video card.",
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
      en: "This connector seats the video card in a motherboard PCI Express expansion slot.",
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
      en: "Display ports send the video card's output images to a monitor.",
    },
  ],
};
