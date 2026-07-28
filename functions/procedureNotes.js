const PROCEDURE_DETAILS = {
  disassembly: [
    {
      title: "Prepare the system",
      text:
        "Shut down the computer, switch the PSU (Power Supply Unit) off, unplug the AC power cable, press the case power button for a few seconds to discharge leftover power, then use an antistatic strap or touch the metal case before handling parts.",
    },
    {
      title: "Remove external and case access",
      text:
        "Disconnect display, USB, Ethernet, audio, and power cables. Remove the side panel, place screws in a labeled tray, and keep the case flat so components do not fall when released.",
    },
    {
      title: "Remove GPU (Graphics Processing Unit)",
      text:
        "Unplug PCIe power cables from the GPU, remove the rear bracket screw, press the PCIe slot retention clip, then lift the card straight out by its edges and place it on the table target.",
    },
    {
      title: "Remove storage and memory",
      text:
        "For SSD (Solid State Drive), remove the M.2 screw or SATA data/power cables depending on the drive type. For HDD (Hard Disk Drive), unplug SATA data and SATA power, remove tray screws, and slide it out. Release RAM (Random Access Memory) by opening DIMM clips and lifting modules straight up.",
    },
    {
      title: "Remove CPU (Central Processing Unit)",
      text:
        "Disconnect the CPU fan cable, loosen cooler screws evenly in a cross pattern, twist the cooler gently to break thermal-paste contact, lift it away, open the socket latch, and lift the CPU by the edges only.",
    },
    {
      title: "Remove PSU and motherboard",
      text:
        "Unplug the 24-pin ATX motherboard cable, 8-pin EPS CPU cable, SATA power, and any case/front-panel cables. Remove PSU mounting screws, slide the PSU out, then remove motherboard standoff screws and lift the board from the case.",
    },
  ],
  assembly: [
    {
      title: "Prepare motherboard outside the case",
      text:
        "Place the motherboard on its box or antistatic mat. Confirm AMD or Intel socket alignment, open the socket latch, and handle the CPU (Central Processing Unit) only by the edges.",
    },
    {
      title: "Install CPU and thermal interface",
      text:
        "Align the CPU marker with the socket marker, lower it without force, then lock the retention arm or frame. Apply a pea-sized drop of thermal paste to the CPU heat spreader before installing the cooler.",
    },
    {
      title: "Install RAM and SSD",
      text:
        "Install RAM (Random Access Memory) in the recommended DIMM slots, usually A2/B2 for two sticks, pressing until the clips lock. Install the SSD (Solid State Drive) into the M.2 slot at an angle, press it flat, and secure it with the M.2 screw.",
    },
    {
      title: "Mount motherboard in the case",
      text:
        "Check standoff positions, align the rear I/O and screw holes, lower the motherboard into place, then tighten screws evenly without overtightening.",
    },
    {
      title: "Install PSU and drives",
      text:
        "Slide the PSU (Power Supply Unit) into its bay with the fan facing the correct ventilation side. Connect the 24-pin ATX cable, 8-pin EPS CPU cable, SATA power, and storage data cables. Mount the HDD (Hard Disk Drive) in its tray if used.",
    },
    {
      title: "Install GPU and final cables",
      text:
        "Seat the GPU (Graphics Processing Unit) in the top PCIe x16 slot until the retention clip locks, screw the bracket to the case, connect PCIe power cables, then connect front-panel, USB, audio, and fan headers before closing the case.",
    },
  ],
};

function getProcedureText(mode) {
  return (PROCEDURE_DETAILS[mode] || [])
    .map((item) => `${item.title}: ${item.text}`)
    .join("\n");
}

module.exports = {
  PROCEDURE_DETAILS,
  getProcedureText,
};
