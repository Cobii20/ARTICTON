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
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

function HeaderDropdown({
  userName,
  userEmail = "",
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
              <div className="text-sm font-semibold text-white">
                {userName}
              </div>

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

const stepPlacementKeys = {
  ram: "ramPlaced",
  hdd: "hddPlaced",
  ssd: "ssdPlaced",
  psu: "psuPlaced",
  cpu: "cpuPlaced",
  mb: "mbPlaced",
};

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

function Module3Sidebar({
  open,
  onToggle,
  currentStep,
  completedSteps,
  onSelect,
  canSelectStep,
  currentStepCompleted,
  onViewCertificate,
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
                Complete each step to unlock the next
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
            const unlocked = canSelectStep(index);

            return (
              <button
                key={m.key}
                type="button"
                onClick={() => onSelect(index)}
                aria-disabled={!unlocked}
                className={[
                  "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                  active
                    ? "border-[#00ffb4]/25 bg-[#00ffb4]/10"
                    : "border-[#1a2438] bg-white/[0.03]",
                  unlocked
                    ? "hover:bg-white/[0.06]"
                    : "cursor-not-allowed opacity-45",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition",
                    done
                      ? "bg-[#00ffb4] text-[#0a0e17]"
                      : active
                      ? "border border-[#00ffb4]/35 bg-[#00ffb4]/10 text-[#00ffb4]"
                      : "border border-[#1a2438] bg-[#0d1220] text-[#7a8ba8]",
                  ].join(" ")}
                >
                  {done ? "✓" : index + 1}
                </span>

                {open ? (
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">
                      {m.name}
                    </div>

                    <div className="text-[11px] text-[#7a8ba8]">
                      {done
                        ? "Finished"
                        : active
                        ? "Current step"
                        : unlocked
                        ? "Available"
                        : "Locked"}
                    </div>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        {currentStep === module3Steps.length - 1 && currentStepCompleted && (
          <div className="border-t border-[#1a2438] p-3">
            <button
              type="button"
              onClick={onViewCertificate}
              className={[
                "flex items-center justify-center rounded-2xl bg-[#00ffb4] font-black text-[#0a0e17]",
                "shadow-[0_18px_50px_rgba(0,255,180,0.22)] transition hover:scale-[1.03]",
                open ? "w-full px-5 py-3 text-sm" : "h-10 w-10 text-sm",
              ].join(" ")}
              title="View Certificate"
            >
              {open ? "View Certificate ✓" : "✓"}
            </button>
          </div>
        )}
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

  const [showCertificate, setShowCertificate] = useState(false);

  const [validationMessage, setValidationMessage] = useState("");

  const [aiOpen, setAiOpen] = useState(false);

const [aiMessages, setAiMessages] = useState([
  {
    role: "assistant",
    content:
      "Hello! I'm your PC Disassembly AI assistant.",
  },
]);

const [aiInput, setAiInput] = useState("");

const [aiLoading, setAiLoading] = useState(false);

  const [settings, setSettings] = useState({
    sound: true,
    animations: true,
    darkMode: true,
  });

  const [localCompletedSteps, setLocalCompletedSteps] = useState(() => {
    const saved = localStorage.getItem("module3CompletedSteps");
    return saved ? JSON.parse(saved) : {};
  });

  const [placements, setPlacements] = useState(createEmptyPlacements);

  const [fullPlacements, setFullPlacements] = useState(createEmptyPlacements);

  const currentStepKey = module3Steps[step]?.key;

  const currentPlacementCompleted =
    step < 6
      ? !!placements[stepPlacementKeys[currentStepKey]]
      : Object.values(fullPlacements).every(Boolean);

  const currentStepCompleted =
    !!localCompletedSteps[currentStepKey] || currentPlacementCompleted;

  const currentStepAlreadySaved = !!localCompletedSteps[currentStepKey];

  const canSelectStep = (index) => {
    if (index <= step) return true;

    for (let i = 0; i < index; i += 1) {
      const requiredKey = module3Steps[i]?.key;

      if (!requiredKey) return false;

      if (i === step && currentStepCompleted) continue;

      if (!localCompletedSteps[requiredKey]) return false;
    }

    return true;
  };

  const handleSettingChange = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };
const askAI = async () => {
  if (!aiInput.trim()) return;

  const userMessage = {
    role: "user",
    content: aiInput,
  };

  setAiMessages((prev) => [...prev, userMessage]);

  setAiLoading(true);

  try {
    const response = await fetch(
      "http://127.0.0.1:5000/api/chat",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          message: aiInput,

          context: {
            module: "disassembly",

            currentStep:
              module3Steps[step]?.name,

            completedSteps:
              localCompletedSteps,

            currentStepCompleted,
          },
        }),
      }
    );

    const data = await response.json();

    setAiMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: data.reply,
      },
    ]);
  } catch (err) {
    console.error(err);

    setAiMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "AI server error occurred.",
      },
    ]);
  }

  setAiInput("");

  setAiLoading(false);
};

  useEffect(() => {
    setValidationMessage("");
  }, [step]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setFirebaseUser(null);
        setProfile(null);
        return;
      }

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

  const fullSharedProps = { placementApi: fullPlacementApi };

  const saveModule3Progress = async ({
    currentStep = step,
    completedSteps = {},
  } = {}) => {
    const mergedSteps = {
      ...localCompletedSteps,
      ...completedSteps,
    };

    setLocalCompletedSteps(mergedSteps);

    localStorage.setItem(
      "module3CompletedSteps",
      JSON.stringify(mergedSteps)
    );

    if (!firebaseUser) return;

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

  useEffect(() => {
    if (!currentStepKey) return;
    if (!currentStepCompleted) return;
    if (currentStepAlreadySaved) return;
    if (step === 6) return;

    saveModule3Progress({
      currentStep: step,
      completedSteps: {
        [currentStepKey]: true,
      },
    });
  }, [
    currentStepKey,
    currentStepCompleted,
    currentStepAlreadySaved,
    step,
  ]);

  useEffect(() => {
    if (step !== 6 || !currentStepCompleted) return;
    if (localCompletedSteps.final) return;

    const completeFinalStep = async () => {
      await saveModule3Progress({
        currentStep: 6,
        completedSteps: {
          final: true,
        },
      });
    };

    completeFinalStep();
  }, [step, currentStepCompleted, localCompletedSteps.final]);

  const goNextStep = async () => {
    if (step >= module3Steps.length - 1) return;

    if (!currentStepCompleted) {
      setValidationMessage("Finish the current scene first before going to the next step.");
      return;
    }

    const currentKey = module3Steps[step].key;

    await saveModule3Progress({
      currentStep: step + 1,
      completedSteps: {
        [currentKey]: true,
      },
    });

    setValidationMessage("");

    setStep((prev) => prev + 1);
  };

  const goPrevStep = async () => {
    if (step <= 0) return;

    await saveModule3Progress({
      currentStep: step - 1,
    });

    setValidationMessage("");

    setStep((prev) => prev - 1);
  };

  const handleSelectStep = async (index) => {
    if (!canSelectStep(index)) {
      setValidationMessage("This step is locked. Finish the current scene first.");
      return;
    }

    const completedSteps = {};

    if (index > step && currentStepKey && currentStepCompleted) {
      completedSteps[currentStepKey] = true;
    }

    await saveModule3Progress({
      currentStep: index,
      completedSteps,
    });

    setValidationMessage("");

    setStep(index);
  };

  const handleBackToDashboard = async () => {
    await saveModule3Progress({
      currentStep: 6,
      completedSteps: {
        final: true,
      },
    });

    let handled = false;

    if (typeof onFinish === "function") {
      onFinish("Dashboard");
      handled = true;
    }

    if (typeof onBack === "function") {
      onBack("Modules");
      handled = true;
    }

    if (!handled) {
      window.location.href = "/dashboard";
    }
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
                    {validationMessage && (
                      <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-200">
                        {validationMessage}
                      </div>
                    )}

                    {step < 6 && currentStepCompleted && (
                      <button
                        type="button"
                        onClick={goNextStep}
                        className="rounded-2xl bg-[#b56dff] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(181,109,255,0.35)] transition hover:scale-[1.03]"
                      >
                        Next →
                      </button>
                    )}

                    <HeaderDropdown
                      userName={user.name}
                      userEmail={user.email}
                      onBack={onBack}
                      onLogout={onLogout}
                      setIsSettingsOpen={setIsSettingsOpen}
                    />
                  </div>
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

              <div className="min-h-0 flex-1 px-4 py-4 md:px-8 md:py-5">
                <div className="relative h-full overflow-hidden rounded-[24px] border border-[#1a2438] bg-[#0d1220]/78 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  <Module3Sidebar
                    open={sidebarOpen}
                    onToggle={() => setSidebarOpen((v) => !v)}
                    currentStep={step}
                    completedSteps={localCompletedSteps}
                    onSelect={handleSelectStep}
                    canSelectStep={canSelectStep}
                    currentStepCompleted={currentStepCompleted}
                    onViewCertificate={() => setShowCertificate(true)}
                  />

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
                    <div className="absolute right-5 top-5 z-[500] flex flex-col items-end">
  {!aiOpen && (
    <button
      type="button"
      onClick={() => setAiOpen(true)}
      className="rounded-2xl border border-[#00ffb4]/25 bg-[#0b1220]/90 px-4 py-3 text-sm font-semibold text-[#00ffb4] shadow-[0_10px_40px_rgba(0,255,180,0.15)] backdrop-blur-xl transition hover:scale-[1.03]"
    >
      AI Assistant
    </button>
  )}

  {aiOpen && (
    <div className="flex h-[500px] w-[360px] flex-col overflow-hidden rounded-[24px] border border-[#1a2438] bg-[#0b1220]/95 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-[#1a2438] px-4 py-3">
        <div>
          <div className="text-sm font-bold text-white">
            Disassembly AI
          </div>

          <div className="text-[11px] text-[#7a8ba8]">
            Step-aware assistant
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAiOpen(false)}
          className="rounded-lg px-2 py-1 text-sm text-[#7a8ba8] transition hover:bg-white/5 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {aiMessages.map((msg, index) => (
          <div
            key={index}
            className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
              msg.role === "assistant"
                ? "bg-[#00ffb4]/10 text-[#dffef5]"
                : "bg-white/5 text-white"
            }`}
          >
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7a8ba8]">
              {msg.role === "assistant"
                ? "AI"
                : "You"}
            </div>

            {msg.content}
          </div>
        ))}
      </div>

      <div className="border-t border-[#1a2438] p-3">
        <div className="flex gap-2">
          <input
            value={aiInput}
            onChange={(e) =>
              setAiInput(e.target.value)
            }
            placeholder="Ask about this step..."
            className="flex-1 rounded-xl border border-[#1a2438] bg-[#111827] px-4 py-3 text-sm text-white outline-none transition focus:border-[#00ffb4]/35"
          />

          <button
            type="button"
            onClick={askAI}
            disabled={aiLoading}
            className="rounded-xl bg-[#00ffb4] px-4 py-3 text-sm font-bold text-[#0a0e17] transition hover:scale-[1.03]"
          >
            {aiLoading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  )}
</div>
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

              <div className="flex justify-center items-center gap-4 border-t border-[#1a2438] px-6 pb-6 pt-4">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={goPrevStep}
                    className="px-6 py-3 rounded-2xl border border-[#1a2438] bg-white/[0.03] text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06] shadow-[0_12px_40px_rgba(0,0,0,0.3)]"
                  >
                    ← Previous
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