export const cpuScene = {
  key: "cpu",
  name: "CPU",
  slides: [
    {
      id: "cpu-s1",
      title: "Central Processing Unit Overview",
      body:
        "In this module, you'll explore a CPU package in 3D.\n" +
        "You will identify key external parts before moving into deeper disassembly steps.",
      points: [
        "Rotate, zoom, and inspect the CPU from any angle.",
        "Tap numbered pins to learn each component.",
        "Use this as a visual guide before physical disassembly.",
      ],
    },
    {
      id: "cpu-s2",
      title: "Common CPU Platform Variations",
      body:
        "Desktop processors are matched to a motherboard socket family.\n" +
        "AMD platforms include AM4 and AM5, while Intel platforms use their own LGA socket families.",
      points: [
        "AM4 AMD CPUs have pins on the CPU and use DDR4 motherboards.",
        "AM5 AMD CPUs have flat contact pads, pins in the socket, and use DDR5 motherboards.",
        "Always match the CPU socket, chipset support, and memory type before installation.",
      ],
    },
  ],
};
