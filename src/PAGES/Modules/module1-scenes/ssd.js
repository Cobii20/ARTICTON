export const ssdScene = {
  key: "ssd",
  name: "SSD",
  url: "/models/Ssd(Base).glb",
  view: {
    cameraPos: [1.7, 1.15, 2.8],
    fov: 38,
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
      title: "Solid State Storage Overview",
      body:
        "Solid state storage devices have no moving parts and are more reliable and require less power than hard disks.\n" +
        "SSDs use solid state memory and are faster, more durable, more expensive, and often lower in capacity than HDDs.",
      points: [
        "Identify the connector edge.",
        "Recognize solid state memory chips.",
        "Compare SSDs with hard disk drives.",
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
      en: "The connector links the SSD to the computer so storage data can be read and written.",
    },
    {
      id: "ssd-hs-2",
      number: 2,
      title: "Storage Chips",
      position: [-0.28, 0.04, 0.05],
      frontAxis: [0, 1, 0],
      en: "Solid state memory stores files, applications, and operating system data without moving parts.",
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
