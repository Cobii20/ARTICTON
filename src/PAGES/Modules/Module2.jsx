import CPUtoMBScene from "./module2-scenes/CPUtoMB";
import RAMtoMBScene from "./module2-scenes/RAMtoMB";
import SSDtoMBScene from "./module2-scenes/SSDtoMB";
import MBtoCaseScene from "./module2-scenes/MBtoCase";
import HDDtoCaseScene from "./module2-scenes/HDDtoCase";
import PSUtoCaseScene from "./module2-scenes/PSUtoCase";
import FullAssemblyScene from "./module2-scenes/FullAssembly";
import React, { useEffect, useState } from "react";
import Settings from "../../Components/Settings";
import { auth, db } from "../../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc,serverTimestamp,} from "firebase/firestore";

function HeaderDropdown({
  userName = "Loading...",
  userEmail = "No email",
  onBack,
  onLogout,
  setIsSettingsOpen,
}) {
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
              <div className="text-[11px] text-[#7a8ba8]">{userEmail}</div>
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

function Module2Background() {
  return (
    <>
      <div className="pointer-events-none absolute -left-44 -top-44 h-[720px] w-[720px] rounded-full bg-[#00ffb4]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 -right-52 h-[820px] w-[820px] rounded-full bg-[#00ffb4]/6 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a0e17] via-[#0a0e17] to-[#0d1220]" />
    </>
  );
}
function Module2Sidebar({
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
                Assembly Steps
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
          {module2Steps.map((m, index) => {
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
const module2Steps = [
  { key: "cpu", name: "CPU to Motherboard" },
  { key: "ram", name: "RAM to Motherboard" },
  { key: "ssd", name: "SSD to Motherboard" },
  { key: "motherboard", name: "Motherboard to Case" },
  { key: "hdd", name: "HDD to Case" },
  { key: "psu", name: "PSU to Case" },
  { key: "final", name: "Full Assembly" },
];

export default function Module2Assembly({onFinish,onBack,onLogout}) {
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
  const saved = localStorage.getItem("module2CompletedSteps");
  return saved ? JSON.parse(saved) : {};
});
useEffect(() => {
  const saved = profile?.moduleProgress?.module2?.completedSteps;

  if (!saved) return;

  setLocalCompletedSteps(saved);

  localStorage.setItem(
    "module2CompletedSteps",
    JSON.stringify(saved)
  );

  const savedPage = profile?.moduleProgress?.module2?.currentStep;

  if (typeof savedPage === "number") {
    setStep(savedPage);
  }
}, [profile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setFirebaseUser(null);
        setProfile(null);
        return;
      }

      setFirebaseUser(user);

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setProfile(userSnap.data());
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Error reading profile:", err);
      }
    });

    return () => unsubscribe();
  }, []);

  const user = {
  name: profile
    ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
    : "Loading...",
  email: firebaseUser?.email || "No email",
};
  
const saveModule2Progress = async ({
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
    "module2CompletedSteps",
    JSON.stringify(mergedSteps)
  );

  const completedCount =
    Object.values(mergedSteps).filter(Boolean).length;

  const percent = Math.round(
    (completedCount / module2Steps.length) * 100
  );

  const completed =
    completedCount === module2Steps.length;

  try {
    const userRef = doc(db, "users", firebaseUser.uid);

    await setDoc(
      userRef,
      {
        moduleProgress: {
          module2: {
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
      "Error saving module 2 progress:",
      err
    );
  }
};
const goNextStep = async () => {
  if (step >= module2Steps.length - 1) return;

  const currentKey = module2Steps[step].key;

  await saveModule2Progress({
    currentStep: step + 1,
    completedSteps: {
      [currentKey]: true,
    },
  });

  setStep((prev) => prev + 1);
};

const goPrevStep = async () => {
  if (step <= 0) return;

  await saveModule2Progress({
    currentStep: step - 1,
  });

  setStep((prev) => prev - 1);
};

const handleSelectStep = async (index) => {
  await saveModule2Progress({
    currentStep: index,
  });

  setStep(index);
};
  return (
    <div className="min-h-screen w-full overflow-hidden bg-[#0a0e17] font-sans text-[#e8ecf4] antialiased">
      <div className="relative h-screen w-full overflow-hidden">
        <Module2Background />

        <div className="relative h-full w-full overflow-hidden p-0 md:p-3">
          <div className="relative h-full w-full overflow-hidden border border-[#1a2438] bg-[linear-gradient(135deg,#0a0e17,#0d1220,#101a2d)] shadow-[0_70px_180px_rgba(0,0,0,0.70)] md:rounded-[30px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(0,255,180,0.08),transparent_35%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_20%,rgba(0,255,180,0.05),transparent_30%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,180,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,180,0.025)_1px,transparent_1px)] bg-[size:54px_54px] opacity-55" />
            <div className="absolute inset-0 bg-black/10 ring-1 ring-white/5" />

            <div className="relative flex h-full w-full flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-6 text-[12px] text-[#7a8ba8] md:px-10">
                <div>
                  Module 2 — <span className="text-[#dbe6f5]">Assembly</span>
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
                        Assembly View
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

              <div className="min-h-0 flex-1 px-4 py-4 md:px-8 md:py-5">
                <div className="relative h-full overflow-hidden rounded-[24px] border border-[#1a2438] bg-[#0d1220]/78 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <Module2Sidebar
                    open={sidebarOpen}
                    onToggle={() => setSidebarOpen((v) => !v)}
                    currentStep={step}
                    completedSteps={localCompletedSteps}
                   onSelect={handleSelectStep}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(255,255,255,0.08),transparent_40%)]" />
                  <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.55)]" />

                <div
  className="absolute top-3 bottom-3 right-3 md:top-4 md:bottom-4 md:right-4 overflow-hidden rounded-[18px] border border-[#1a2438] bg-black/10 transition-all duration-300"
  style={{
    left: sidebarOpen ? 270 : 24,
  }}
  
                  >
                    <div className="pointer-events-none absolute inset-0 rounded-[18px] ring-1 ring-[#00ffb4]/15 shadow-[0_0_0_1px_rgba(0,255,180,0.08)]" />
                    <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-[#00ffb4]/10 blur-3xl" />
                    <div className="pointer-events-none absolute left-[10%] top-[8%] h-[58%] w-[2px] animate-pulse bg-[linear-gradient(180deg,transparent,#00ffb4,transparent)] opacity-25" />
                  </div>

                <div
              className="absolute top-3 bottom-3 right-3 z-[40] overflow-hidden rounded-[18px] border border-[#1a2438] bg-black/10 transition-all duration-300 md:top-4 md:bottom-4 md:right-4"
              style={{
                left: sidebarOpen ? 280 : 64,
              }}
            >
              {step === 0 && <CPUtoMBScene />}
              {step === 1 && <RAMtoMBScene />}
              {step === 2 && <SSDtoMBScene />}
              {step === 3 && <MBtoCaseScene />}
              {step === 4 && <HDDtoCaseScene />}
              {step === 5 && <PSUtoCaseScene />}
              {step === 6 && <FullAssemblyScene />}
            </div>
                </div>
              </div>

              <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-[130]">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={goPrevStep}
                    aria-label="Previous step"
                    className="pointer-events-auto absolute left-7 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#1a2438] bg-[#0d1220]/85 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:bg-white/[0.06]"
                  >
                    <span className="text-lg text-white/80">←</span>
                  </button>
                )}

                {step < 6 && (
                  <button
                    type="button"
                   onClick={goNextStep}
                    aria-label="Next step"
                    className="pointer-events-auto absolute right-7 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#1a2438] bg-[#0d1220]/85 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:bg-white/[0.06]"
                  >
                    <span className="text-lg text-white/80">→</span>
                  </button>
                )}

                {step === 6 && (
                <button
                  type="button"
                  onClick={async () => {
                    await saveModule2Progress({
                      currentStep: 6,
                      completedSteps: {
                        final: true,
                      },
                    });

                    if (typeof onFinish === "function") onFinish();
                  }}
                  aria-label="Finish module"
                  className="pointer-events-auto absolute right-7 top-1/2 flex h-12 min-w-[110px] -translate-y-1/2 items-center justify-center rounded-full border border-[#1a2438] bg-[#00ffb4] px-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] transition hover:scale-[1.03]"
                >
                  <span className="text-sm font-semibold text-[#0a0e17]">
                    Finish ✓
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