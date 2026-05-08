import React, { useEffect, useState } from "react";
import Settings from "../../Components/Settings";
import DisassemblyRAM from "./module3-scenes/DisassemblyRAM";
import DisassemblyHDD from "./module3-scenes/DisassemblyHDD";
import DisassemblySSD from "./module3-scenes/DisassemblySSD";
import DisassemblyPSU from "./module3-scenes/DisassemblyPSU";
import DisassemblyCPU from "./module3-scenes/DisassemblyCPU";
import DisassemblyMB from "./module3-scenes/DisassemblyMB";
import FullDisassembly from "./module3-scenes/FullDisassembly";
import { auth, db } from "../../firebase";
import {doc,getDoc,setDoc,serverTimestamp,} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

function HeaderDropdown({  userName,   userEmail = "", onBack, onLogout,  setIsSettingsOpen, }) {
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
             <div className="text-[11px] text-[#7a8ba8]">
              {userEmail || "No email"}
            </div>
            </div>
            <div className="text-sm text-[#7a8ba8] transition group-open:rotate-180">
              ▾
            </div>
          </div>
        </summary>

        <div className="absolute right-0 top-full mt-2 z-[220] w-52 rounded-2xl border border-[#1a2438] bg-[#0d1220]/98 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-full rounded-xl px-4 py-2 text-left text-sm text-[#dbe6f5] transition hover:bg-white/5"
        >
          Settings
        </button>
          <button
          onClick={() => {
            if (typeof onBack === "function") onBack("Profile");
          }}
          className="w-full rounded-xl px-4 py-2 text-left text-sm text-[#dbe6f5] transition hover:bg-white/5"
        >
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

const module3Steps = [
  { key: "ram", name: "RAM Disassembly" },
  { key: "hdd", name: "HDD Disassembly" },
  { key: "ssd", name: "SSD Disassembly" },
  { key: "psu", name: "PSU Disassembly" },
  { key: "cpu", name: "CPU Disassembly" },
  { key: "mb", name: "Motherboard Disassembly" },
  { key: "final", name: "Full Disassembly" },
];

function Module3Sidebar({
  open,
  onToggle,
  currentStep,
  completedSteps,
  onSelect,
}) {
  return (
    <div
      className={[
        "absolute left-0 top-0 z-[200] h-full transition-all duration-300",
        open ? "w-[280px]" : "w-[64px]",
      ].join(" ")}
    >
      <div className="h-full border-r border-[#1a2438] bg-[#0b1220]/92 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
        <div className="flex items-center justify-between border-b border-[#1a2438] px-4 py-4">
          {open ? (
            <div>
              <div className="text-sm font-bold text-white">
                Disassembly Steps
              </div>
              <div className="text-[11px] text-[#7a8ba8]">
                Module navigation
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onToggle}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1a2438] bg-white/[0.03] text-[#dbe6f5] transition hover:bg-white/[0.06]"
          >
            {open ? "←" : "→"}
          </button>
        </div>

        <div className="space-y-2 p-3">
          {module3Steps.map((m, index) => {
            const done = !!completedSteps[m.key];
            const active = currentStep === index;

            return (
              <button
                key={m.key}
                type="button"
                onClick={() => onSelect(index)}
                className={[
                  "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                  active
                    ? "border-[#00ffb4]/25 bg-[#00ffb4]/10"
                    : "border-[#1a2438] bg-white/[0.03] hover:bg-white/[0.06]",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition",
                    done
                      ? "bg-[#00ffb4] text-[#0a0e17]"
                      : "border border-[#1a2438] bg-[#0d1220] text-[#7a8ba8]",
                  ].join(" ")}
                >
                  {index + 1}
                </span>

                {open ? (
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">
                      {m.name}
                    </div>

                    <div className="text-[11px] text-[#7a8ba8]">
                      {done ? "Finished" : "Not finished"}
                    </div>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Module3Disassembly({
  onFinish,
  onBack,
  onLogout,
}) {
  const [step, setStep] = useState(0);
const [firebaseUser, setFirebaseUser] = useState(null);
const [profile, setProfile] = useState(null);
const [sidebarOpen, setSidebarOpen] = useState(true);
const [isSettingsOpen, setIsSettingsOpen] = useState(false);

const [settings, setSettings] = useState({
  sound: true,
  animations: true,
  darkMode: true,
});

const handleSettingChange = (key, value) => {
  setSettings((prev) => ({
    ...prev,
    [key]: value,
  }));
};

const [localCompletedSteps, setLocalCompletedSteps] = useState(() => {
  const saved = localStorage.getItem("module3CompletedSteps");
  return saved ? JSON.parse(saved) : {};
});

  const [placements, setPlacements] = useState({
    ramPlaced: false,
    hddPlaced: false,
    ssdPlaced: false,
    psuPlaced: false,
    cpuPlaced: false,
    mbPlaced: false,
  });

useEffect(() => {
  const unsub = onAuthStateChanged(auth, async (currentUser) => {
    if (!currentUser) return;

    setFirebaseUser(currentUser);

    try {
      const userRef = doc(db, "users", currentUser.uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const data = snap.data();

        setProfile(data);

        const saved =
          data?.moduleProgress?.module3?.completedSteps;

        if (saved) {
          setLocalCompletedSteps(saved);

          localStorage.setItem(
            "module3CompletedSteps",
            JSON.stringify(saved)
          );
        }

        const savedStep =
          data?.moduleProgress?.module3?.currentStep;

        if (typeof savedStep === "number") {
          setStep(savedStep);
        }
      }
    } catch (err) {
      console.error("Error fetching module 3:", err);
    }
  });

  return () => unsub();
}, []);

  const placementApi = {
    placements,
    setPlaced: (key, value = true) =>
      setPlacements((prev) => ({ ...prev, [key]: value })),
    resetPlaced: (key) =>
      setPlacements((prev) => ({ ...prev, [key]: false })),
    resetAll: () =>
      setPlacements({
        ramPlaced: false,
        hddPlaced: false,
        ssdPlaced: false,
        psuPlaced: false,
        cpuPlaced: false,
        mbPlaced: false,
      }),
  };
const user = {
  name: profile
    ? `${profile.firstName || ""} ${
        profile.middleInitial
          ? profile.middleInitial + "."
          : ""
      } ${profile.lastName || ""}`.trim()
    : "Loading...",
  email: firebaseUser?.email || "No email",
};
  const sharedProps = { placementApi };
const saveModule3Progress = async ({
  currentStep = step,
  completedSteps = {},
} = {}) => {
  if (!firebaseUser) return;

  const mergedSteps = {
    ...localCompletedSteps,
    ...completedSteps,
  };

  setLocalCompletedSteps(mergedSteps);

  localStorage.setItem(
    "module3CompletedSteps",
    JSON.stringify(mergedSteps)
  );

  const completedCount =
    Object.values(mergedSteps).filter(Boolean).length;

  const percent = Math.round(
    (completedCount / module3Steps.length) * 100
  );

  const completed =
    completedCount === module3Steps.length;

  try {
    const userRef = doc(db, "users", firebaseUser.uid);

    await setDoc(
      userRef,
      {
        moduleProgress: {
          module3: {
            currentStep,
            completed,
            percent,
            completedSteps: mergedSteps,
            updatedAt: serverTimestamp(),
          },
        },
      },
      { merge: true }
    );
  } catch (err) {
    console.error(
      "Error saving module 3 progress:",
      err
    );
  }
};

const goNextStep = async () => {
  if (step >= module3Steps.length - 1) return;

  const currentKey = module3Steps[step].key;

  await saveModule3Progress({
    currentStep: step + 1,
    completedSteps: {
      [currentKey]: true,
    },
  });

  setStep((prev) => prev + 1);
};

const goPrevStep = async () => {
  if (step <= 0) return;

  await saveModule3Progress({
    currentStep: step - 1,
  });

  setStep((prev) => prev - 1);
};

const handleSelectStep = async (index) => {
  await saveModule3Progress({
    currentStep: index,
  });

  setStep(index);
};
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
                  Module 3 — <span className="text-[#dbe6f5]">Disassembly</span>
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

                  <HeaderDropdown
                    userName={user.name}
                    userEmail={user.email}
                    onBack={onBack}
                    onLogout={onLogout}
                    setIsSettingsOpen={setIsSettingsOpen}
                  />
                </div>
                <Settings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={settings}
                onChange={handleSettingChange}
              />
              </div>

              <div className="px-6 pt-4 md:px-10">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#1a2438] bg-[#0b1220]/72 px-5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
                  <div>
                    <div className="text-sm font-semibold text-white">
                    {module3Steps[step]?.name}
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#7a8ba8]">
                      Click to detach • click to grab • snap to floor
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                   {module3Steps.map((item, index) => (
                      <div
                        key={item.key}
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
                <div className="relative h-full overflow-hidden rounded-[24px] border border-[#1a2438] bg-[#0d1220]/78 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
  <Module3Sidebar
    open={sidebarOpen}
    onToggle={() => setSidebarOpen((v) => !v)}
    currentStep={step}
    completedSteps={localCompletedSteps}
    onSelect={handleSelectStep}
  />    

  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(255,255,255,0.08),transparent_40%)]" />
              <div className="min-h-0 flex-1 px-4 py-4 md:px-8 md:py-5">
               
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(255,255,255,0.08),transparent_40%)]" />
                  <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.55)]" />
                  <div className="absolute inset-3 md:inset-4 overflow-hidden rounded-[18px] border border-[#1a2438] bg-black/10">
                    <div className="pointer-events-none absolute inset-0 rounded-[18px] ring-1 ring-[#00ffb4]/15 shadow-[0_0_0_1px_rgba(0,255,180,0.08)]" />
                    <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-[#00ffb4]/10 blur-3xl" />
                  </div>

                <div
                    className="absolute top-3 bottom-3 right-3 z-[40] overflow-hidden rounded-[18px] transition-all duration-300 md:top-4 md:bottom-4 md:right-4"
                    style={{
                      left: sidebarOpen ? 280 : 64,
                    }}
                  >
                    {step === 0 && <DisassemblyRAM {...sharedProps} />}
                    {step === 1 && <DisassemblyHDD {...sharedProps} />}
                    {step === 2 && <DisassemblySSD {...sharedProps} />}
                    {step === 3 && <DisassemblyPSU {...sharedProps} />}
                    {step === 4 && <DisassemblyCPU {...sharedProps} />}
                    {step === 5 && <DisassemblyMB {...sharedProps} />}
                    {step === 6 && <FullDisassembly {...sharedProps} />}
                  </div>
                </div>
              </div>

              <div className="flex justify-center items-center gap-4 border-t border-[#1a2438] px-6 pb-6 pt-4">
                {step > 0 && (
                  <button
                   onClick={goPrevStep}
                    className="px-6 py-3 rounded-2xl border border-[#1a2438] bg-white/[0.03] text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06] shadow-[0_12px_40px_rgba(0,0,0,0.3)]"
                  >
                    ← Previous
                  </button>
                )}

                {step < 6 ? (
                  <button
                  onClick={goNextStep}
                    className="px-7 py-3 rounded-2xl bg-[#00ffb4] text-[#0a0e17] font-semibold text-sm shadow-[0_12px_40px_rgba(0,255,180,0.25)] transition hover:scale-[1.03]"
                  >
                    Next →
                  </button>
                ) : (
                  <button
                  onClick={async () => {
                        await saveModule3Progress({
                          currentStep: 6,
                          completedSteps: {
                            final: true,
                          },
                        });

                        if (typeof onFinish === "function") {
                          onFinish("Dashboard");
                        }

                        if (typeof onBack === "function") {
                          onBack("Dashboard");
                        }
                      }}
                    className="px-7 py-3 rounded-2xl bg-[#00ffb4] text-[#0a0e17] font-semibold text-sm shadow-[0_12px_40px_rgba(0,255,180,0.25)] transition hover:scale-[1.03]"
                  >
                    Finish ✓
                  </button>
                )}

                <button
                  onClick={placementApi.resetAll}
                  className="px-6 py-3 rounded-2xl border border-[#1a2438] bg-white/[0.03] text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06]"
                >
                  Reset Placements
                </button>
              </div>

              <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.45)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}