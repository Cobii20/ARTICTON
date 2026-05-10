import React, { useEffect, useState } from "react";
import DisassemblyRAM from "./module3-scenes/DisassemblyRAM";
import DisassemblyHDD from "./module3-scenes/DisassemblyHDD";
import DisassemblySSD from "./module3-scenes/DisassemblySSD";
import DisassemblyPSU from "./module3-scenes/DisassemblyPSU";
import DisassemblyCPU from "./module3-scenes/DisassemblyCPU";
import DisassemblyMB from "./module3-scenes/DisassemblyMB";
import FullDisassembly from "./module3-scenes/FullDisassembly";

function HeaderDropdown({ userName = "John Doe", onBack, onLogout }) {
  const handleBack = () => {
    if (typeof onBack === "function") onBack("Modules");
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={handleBack}
        className="rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-2.5 text-[13px] font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06]"
      >
        Go back to Dashboard
      </button>

      <details className="group relative z-50">
        <summary className="list-none cursor-pointer rounded-2xl border border-[#1a2438] bg-[#0d1220]/95 px-4 py-2.5 transition hover:bg-[#111b2f]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 text-sm font-bold text-[#00ffb4]">
              {(userName || "U").charAt(0).toUpperCase()}
            </div>

            <div className="leading-tight text-left">
              <div className="text-sm font-semibold text-white">{userName}</div>
              <div className="text-[11px] text-[#7a8ba8]">Student</div>
            </div>

            <div className="text-sm text-[#7a8ba8] transition group-open:rotate-180">
              ▾
            </div>
          </div>
        </summary>

        <div className="absolute right-0 top-full mt-2 z-[220] w-52 rounded-2xl border border-[#1a2438] bg-[#0d1220]/98 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <button className="w-full rounded-xl px-4 py-2 text-left text-sm text-[#dbe6f5] transition hover:bg-white/5">
            Settings
          </button>

          <button className="w-full rounded-xl px-4 py-2 text-left text-sm text-[#dbe6f5] transition hover:bg-white/5">
            Profile
          </button>

          <button
            onClick={onLogout}
            className="w-full rounded-xl px-4 py-2 text-left text-sm text-red-400 transition hover:bg-red-500/10"
          >
            Logout
          </button>
        </div>
      </details>
    </div>
  );
}

function Module3Background() {
  return (
    <>
      <div className="pointer-events-none absolute -left-44 -top-44 h-[720px] w-[720px] rounded-full bg-[#00ffb4]/10 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-56 -right-52 h-[820px] w-[820px] rounded-full bg-[#00ffb4]/6 blur-3xl" />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a0e17] via-[#0a0e17] to-[#0d1220]" />
    </>
  );
}

const STEP_TITLES = [
  "RAM Disassembly",
  "HDD Disassembly",
  "SSD Disassembly",
  "PSU Disassembly",
  "CPU Disassembly",
  "Motherboard Disassembly",
  "Full Disassembly",
];

const STEP_PLACEMENT_KEYS = [
  "ramPlaced",
  "hddPlaced",
  "ssdPlaced",
  "psuPlaced",
  "cpuPlaced",
  "mbPlaced",
];

function createEmptyPlacements() {
  return {
    ramPlaced: false,
    hddPlaced: false,
    ssdPlaced: false,
    psuPlaced: false,
    cpuPlaced: false,
    mbPlaced: false,
  };
}

export default function Module3Disassembly({
  onFinish,
  onBack,
  onLogout,
  userName = "John Doe",
}) {
  const [step, setStep] = useState(0);

  const [placements, setPlacements] = useState(createEmptyPlacements);

  const [fullPlacements, setFullPlacements] = useState(createEmptyPlacements);

  const [showCertificate, setShowCertificate] = useState(false);

  const currentStepCompleted =
    step < 6
      ? placements[STEP_PLACEMENT_KEYS[step]]
      : STEP_PLACEMENT_KEYS.every((key) => fullPlacements[key]);

  useEffect(() => {
    if (step === 6 && currentStepCompleted) {
      setShowCertificate(true);
    }
  }, [step, currentStepCompleted]);

  const placementApi = {
    placements,
    setPlaced: (key, value = true) =>
      setPlacements((prev) => ({ ...prev, [key]: value })),
    resetPlaced: (key) =>
      setPlacements((prev) => ({ ...prev, [key]: false })),
    resetAll: () => setPlacements(createEmptyPlacements()),
  };

  const fullPlacementApi = {
    placements: fullPlacements,
    setPlaced: (key, value = true) =>
      setFullPlacements((prev) => ({ ...prev, [key]: value })),
    resetPlaced: (key) =>
      setFullPlacements((prev) => ({ ...prev, [key]: false })),
    resetAll: () => setFullPlacements(createEmptyPlacements()),
  };

  const sharedProps = { placementApi };

  const fullSharedProps = { placementApi: fullPlacementApi };

  const handleResetAll = () => {
    placementApi.resetAll();
    fullPlacementApi.resetAll();
    setShowCertificate(false);
  };

  const handleBackToDashboard = () => {
    if (typeof onFinish === "function") {
      onFinish();
      return;
    }

    if (typeof onBack === "function") {
      onBack("Modules");
      return;
    }

    window.location.href = "/dashboard";
  };

  if (showCertificate) {
    return (
      <div className="min-h-screen w-full overflow-hidden bg-[#0a0e17] font-sans text-[#e8ecf4] antialiased">
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6">
          <Module3Background />

          <div className="relative z-10 w-full max-w-3xl rounded-[34px] border border-[#00ffb4]/35 bg-[#0d1220]/90 p-8 text-center shadow-[0_40px_120px_rgba(0,0,0,0.65)] backdrop-blur-xl md:p-12">
            <div className="pointer-events-none absolute inset-4 rounded-[26px] border border-dashed border-[#00ffb4]/30" />

            <div className="relative">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#00ffb4]/40 bg-[#00ffb4]/10 text-4xl font-black text-[#00ffb4] shadow-[0_0_40px_rgba(0,255,180,0.18)]">
                ✓
              </div>

              <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.32em] text-[#00ffb4]">
                Certificate of Completion
              </div>

              <h1 className="mb-4 text-4xl font-black tracking-tight text-white md:text-6xl">
                Congratulations
              </h1>

              <h2 className="mb-6 text-xl font-bold text-[#dbe6f5] md:text-3xl">
                You Have Completed Module 3
              </h2>

              <p className="mx-auto mb-8 max-w-xl text-sm leading-7 text-[#9fb0ca]">
                You successfully completed the full PC disassembly sequence,
                including RAM, HDD, SSD, PSU, CPU, and motherboard removal.
              </p>

              <button
                type="button"
                onClick={handleBackToDashboard}
                className="rounded-2xl bg-[#00ffb4] px-7 py-3 text-sm font-black text-[#0a0e17] shadow-[0_18px_50px_rgba(0,255,180,0.22)] transition hover:scale-[1.03]"
              >
                Back to Dashboard →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-hidden bg-[#0a0e17] font-sans text-[#e8ecf4] antialiased">
      <div className="relative h-screen w-full overflow-hidden">
        <Module3Background />

        <div className="relative h-full w-full overflow-hidden p-0 md:p-3">
          <div className="relative h-full w-full overflow-hidden border border-[#1a2438] bg-[linear-gradient(135deg,#0a0e17,#0d1220,#101a2d)] shadow-[0_70px_180px_rgba(0,0,0,0.70)] md:rounded-[30px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(0,255,180,0.08),transparent_35%)]" />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_20%,rgba(0,255,180,0.05),transparent_30%)]" />

            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,180,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,180,0.025)_1px,transparent_1px)] bg-[size:54px_54px] opacity-55" />

            <div className="absolute inset-0 bg-black/10 ring-1 ring-white/5" />

            <div className="relative flex h-full w-full flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-6 text-[12px] text-[#7a8ba8] md:px-10">
                <div>
                  Module 3 —{" "}
                  <span className="text-[#dbe6f5]">Disassembly</span>
                </div>

                <div className="rounded-lg border border-[#1a2438] bg-white/[0.03] px-2 py-1 text-[11px]">
                  Step {step + 1} of 7
                </div>
              </div>

              <div className="relative z-[120] mt-3 px-6 md:px-10">
                <div className="flex w-full items-center justify-between gap-4 rounded-[22px] border border-[#1a2438] bg-[#0b1220]/86 px-6 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.30)] backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <img
                      src="/PNG/Articton.png"
                      alt="Articton Logo"
                      className="h-10 w-10 scale-300 object-contain ml-4"
                    />

                    <div>
                      <div className="text-base font-bold tracking-wide text-white">
                        Articton
                      </div>

                      <div className="text-[11px] uppercase tracking-[0.24em] text-[#00ffb4]">
                        Disassembly View
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {step < 6 && currentStepCompleted && (
                      <button
                        type="button"
                        onClick={() => setStep((prev) => prev + 1)}
                        className="rounded-2xl bg-[#b56dff] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(181,109,255,0.35)] transition hover:scale-[1.03]"
                      >
                        Next →
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleResetAll}
                      className="rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-2.5 text-[13px] font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06]"
                    >
                      Reset Placements
                    </button>
                  </div>

                  <HeaderDropdown
                    userName={userName}
                    onBack={onBack}
                    onLogout={onLogout}
                  />
                </div>
              </div>

              <div className="px-6 pt-4 md:px-10">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#1a2438] bg-[#0b1220]/72 px-5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {STEP_TITLES[step]}
                    </div>

                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#7a8ba8]">
                      Click to detach • click to grab • snap to floor
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {STEP_TITLES.map((label, index) => (
                      <div
                        key={label}
                        className={`h-2.5 w-10 rounded-full transition ${
                          index === step
                            ? "bg-[#00ffb4]"
                            : index < step
                            ? "bg-[#00ffb4]/55"
                            : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 px-4 py-4 md:px-8 md:py-5">
                <div className="relative h-full overflow-hidden rounded-[24px] border border-[#1a2438] bg-[#0d1220]/78 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(255,255,255,0.08),transparent_40%)]" />

                  <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.55)]" />

                  <div className="absolute inset-3 md:inset-4 overflow-hidden rounded-[18px] border border-[#1a2438] bg-black/10">
                    <div className="pointer-events-none absolute inset-0 rounded-[18px] ring-1 ring-[#00ffb4]/15 shadow-[0_0_0_1px_rgba(0,255,180,0.08)]" />

                    <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-[#00ffb4]/10 blur-3xl" />
                  </div>

                  <div className="relative h-full w-full">
                    {step === 0 && <DisassemblyRAM {...sharedProps} />}

                    {step === 1 && <DisassemblyHDD {...sharedProps} />}

                    {step === 2 && <DisassemblySSD {...sharedProps} />}

                    {step === 3 && <DisassemblyPSU {...sharedProps} />}

                    {step === 4 && <DisassemblyCPU {...sharedProps} />}

                    {step === 5 && <DisassemblyMB {...sharedProps} />}

                    {step === 6 && <FullDisassembly {...fullSharedProps} />}
                  </div>
                </div>
              </div>

              <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-[130]">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((prev) => prev - 1)}
                    aria-label="Previous step"
                    className="pointer-events-auto absolute left-7 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#1a2438] bg-[#0d1220]/85 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:bg-white/[0.06]"
                  >
                    <span className="text-lg text-white/80">
                      ←
                    </span>
                  </button>
                )}
              </div>

              <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.45)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}