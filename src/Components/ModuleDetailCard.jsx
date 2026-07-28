import React from "react";

const COMPONENT_TERMS = {
  cpu: "CPU (Central Processing Unit)",
  ram: "RAM (Random Access Memory)",
  ssd: "SSD (Solid State Drive)",
  hdd: "HDD (Hard Disk Drive)",
  psu: "PSU (Power Supply Unit)",
  gpu: "GPU (Graphics Processing Unit)",
  motherboard: "Motherboard",
};

const MODULE_DETAILS = {
  disassembly: [
    {
      title: "1. Prepare the system",
      text:
        "Shut down the computer, switch the PSU (Power Supply Unit) off, unplug the AC power cable, press the case power button for a few seconds to discharge leftover power, then use an antistatic strap or touch the metal case before handling parts.",
    },
    {
      title: "2. Remove external and case access",
      text:
        "Disconnect display, USB, Ethernet, audio, and power cables. Remove the side panel, place screws in a labeled tray, and keep the case flat so components do not fall when released.",
    },
    {
      title: "3. Remove GPU (Graphics Processing Unit)",
      text:
        "Unplug PCIe power cables from the GPU, remove the rear bracket screw, press the PCIe slot retention clip, then lift the card straight out by its edges and place it on the table target.",
    },
    {
      title: "4. Remove storage and memory",
      text:
        "For SSD (Solid State Drive), remove the M.2 screw or SATA data/power cables depending on the drive type. For HDD (Hard Disk Drive), unplug SATA data and SATA power, remove tray screws, and slide it out. Release RAM (Random Access Memory) by opening DIMM clips and lifting modules straight up.",
    },
    {
      title: "5. Remove CPU (Central Processing Unit)",
      text:
        "Disconnect the CPU fan cable, loosen cooler screws evenly in a cross pattern, twist the cooler gently to break thermal-paste contact, lift it away, open the socket latch, and lift the CPU by the edges only.",
    },
    {
      title: "6. Remove PSU and motherboard",
      text:
        "Unplug the 24-pin ATX motherboard cable, 8-pin EPS CPU cable, SATA power, and any case/front-panel cables. Remove PSU mounting screws, slide the PSU out, then remove motherboard standoff screws and lift the board from the case.",
    },
  ],
  assembly: [
    {
      title: "1. Prepare motherboard outside the case",
      text:
        "Place the motherboard on its box or antistatic mat. Confirm AMD or Intel socket alignment, open the socket latch, and handle the CPU (Central Processing Unit) only by the edges.",
    },
    {
      title: "2. Install CPU and thermal interface",
      text:
        "Align the CPU marker with the socket marker, lower it without force, then lock the retention arm or frame. Apply a pea-sized drop of thermal paste to the CPU heat spreader before installing the cooler.",
    },
    {
      title: "3. Install RAM and SSD",
      text:
        "Install RAM (Random Access Memory) in the recommended DIMM slots, usually A2/B2 for two sticks, pressing until the clips lock. Install the SSD (Solid State Drive) into the M.2 slot at an angle, press it flat, and secure it with the M.2 screw.",
    },
    {
      title: "4. Mount motherboard in the case",
      text:
        "Check standoff positions, align the rear I/O and screw holes, lower the motherboard into place, then tighten screws evenly without overtightening.",
    },
    {
      title: "5. Install PSU and drives",
      text:
        "Slide the PSU (Power Supply Unit) into its bay with the fan facing the correct ventilation side. Connect the 24-pin ATX cable, 8-pin EPS CPU cable, SATA power, and storage data cables. Mount the HDD (Hard Disk Drive) in its tray if used.",
    },
    {
      title: "6. Install GPU and final cables",
      text:
        "Seat the GPU (Graphics Processing Unit) in the top PCIe x16 slot until the retention clip locks, screw the bracket to the case, connect PCIe power cables, then connect front-panel, USB, audio, and fan headers before closing the case.",
    },
  ],
};

export default function ModuleDetailCard({ moduleNumber, mode, platform, currentStep = 0 }) {
  const details = MODULE_DETAILS[mode] || [];
  const title = mode === "assembly" ? "Assembly Procedure Notes" : "Disassembly Procedure Notes";
  const stepLabel = `Step ${currentStep + 1}`;

  return (
    <div className="px-6 pt-4 md:px-10">
      <div className="rounded-[18px] border border-[#1a2438] bg-[#07111d]/90 px-5 py-4 shadow-[0_14px_44px_rgba(0,0,0,0.32)] backdrop-blur-xl">
        <div className="grid gap-4 xl:grid-cols-[minmax(190px,0.34fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#00ffb4]">
                Module {moduleNumber} - {platform}
              </div>
              <div className="mt-1 text-sm font-bold text-white">{title}</div>
            </div>

            <div className="inline-flex w-fit items-center rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 px-3 py-1.5 text-[11px] font-semibold text-[#b7fff0]">
              Current scene: {stepLabel}
            </div>
          </div>

          <div className="min-w-0">
            <div className="grid max-h-[182px] gap-2 overflow-y-auto pr-1 md:grid-cols-2 2xl:grid-cols-3 [scrollbar-color:rgba(0,255,180,0.35)_rgba(255,255,255,0.05)] [scrollbar-width:thin]">
              {details.map((item, index) => (
                <section
                  key={item.title}
                  className={[
                    "rounded-xl border bg-[#0d1826]/78 p-3",
                    index === currentStep ? "border-[#00ffb4]/28 shadow-[0_0_24px_rgba(0,255,180,0.06)]" : "border-white/10",
                  ].join(" ")}
                >
                  <div className="text-[11px] font-black text-[#dffef5]">{item.title}</div>
                  <div className="mt-1 text-[11px] leading-5 text-[#aebdd3]">{item.text}</div>
                </section>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3 text-[10px] font-bold text-[#7a8ba8]">
          {Object.values(COMPONENT_TERMS).map((term) => (
            <span key={term} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1">
              {term}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
