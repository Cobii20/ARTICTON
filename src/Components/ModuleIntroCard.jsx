import React from "react";

// Preparation reference: keit104.pdf, printed pp. 213–215 and 222–223.
export default function ModuleIntroCard({ platform, moduleType, onStart }) {
  const assembly = moduleType === "Assembly";
  return (
    <div className="articton-module-intro-overlay absolute inset-0 z-[750] overflow-y-auto bg-[#050912]/78 p-4 backdrop-blur-md sm:p-6">
      <section aria-labelledby="module-intro-title" className="articton-module-intro relative mx-auto my-4 w-full max-w-5xl rounded-[30px] border border-[#00ffb4]/30 bg-[#0b1220]/96 p-5 text-[#9fb0ca] shadow-[0_40px_120px_rgba(0,0,0,0.7)] sm:p-8">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[#00ffb4]">Module {assembly ? "3" : "2"} · {platform} Platform</div>
        <h2 id="module-intro-title" className="mt-3 text-3xl font-black tracking-tight text-white">{moduleType} Guided Practice</h2>
        <section aria-labelledby="module-learning-reference" className="mt-4 rounded-2xl border border-[#00ffb4]/30 bg-[#00ffb4]/[0.06] p-4 sm:p-5">
          <h3 id="module-learning-reference" className="text-base font-extrabold text-[#00ffb4]">Learning Reference: Computer Assembly and Disassembly</h3>
          <p className="mt-2 text-sm leading-6">
            The assembly and disassembly guidance in this module draws on the provided reference from the <strong className="font-bold text-white">National Council of Educational Research and Training (NCERT)</strong>, particularly its preparation, tools, and safe-handling guidance. Follow the simulation's guided sequence and consult manufacturer instructions when working with real hardware.
          </p>
        </section>
        <p className="mt-3 text-sm leading-6">
          {assembly
            ? "Learn to identify compatible parts, align connectors, and secure components as you assemble a PC."
            : "Learn to identify connections, release fasteners, and safely remove and organise PC components for servicing."}
          {" "}Read each instruction card, complete the guided steps, then practise the full sequence without guide highlights.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
            <h3 className="font-bold text-[#00ffb4]">Prepare for real hardware work</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
              <li>A screwdriver that fits the screws, an antistatic mat, and an antistatic wrist strap.</li>
              <li>A clear, well-lit workbench, a labelled screw container, and antistatic bags for loose components.</li>
              <li>{assembly ? "Compatible components, their manuals, and the specified CPU cooling and thermal materials." : "The PC's service manual and a way to label cables and record their original connections."}</li>
            </ul>
          </section>
          <section className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
            <h3 className="font-bold text-[#00ffb4]">Before handling components</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
              <li>Shut down and disconnect external power before opening the case.</li>
              <li>Set up the mat and wrist strap according to their grounding instructions to reduce electrostatic discharge (ESD).</li>
              <li>Hold circuit boards by their edges, avoid contacts and pins, and check alignment or release clips before applying pressure.</li>
            </ul>
          </section>
        </div>
        <section className="mt-4 rounded-2xl border border-[#00ffb4]/20 bg-[#00ffb4]/[0.06] p-4">
          <h3 className="font-bold text-[#00ffb4]">In this virtual practice</h3>
          <p className="mt-2 text-sm leading-6">You need a computer and mouse; physical tools are for real hardware work. Read the step card, then click and hold to {assembly ? "carry the component to its highlighted target" : "detach and carry the component to the table target"}. Release inside the target field and check the result. Right-drag rotates the view; the mouse wheel zooms. The camera locks while you move a part.</p>
        </section>
        <p className="mt-4 text-sm leading-6">Different safe approaches may be valid depending on the hardware. This module teaches a structured procedure based on recognized safety practices. Follow the guided sequence during the simulation, and consult the manufacturer's instructions when working with real equipment.</p>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-4">
          <button type="button" onClick={onStart} className="rounded-2xl bg-[#00ffb4] px-6 py-3 text-sm font-black text-[#07111d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00ffb4]">Start Guided Practice →</button>
        </div>
      </section>
    </div>
  );
}
