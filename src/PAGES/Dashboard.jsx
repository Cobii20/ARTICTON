import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Settings from "../Components/Settings";
import AMDFullAssemblyPracticalTest from "./PracticalTests/AMD/AMDFullAssemblyPracticalTest.jsx";
import AMDFullDisassemblyPracticalTest from "./PracticalTests/AMD/AMDFullDisassemblyPracticalTest.jsx";
import INTELFullAssemblyPracticalTest from "./PracticalTests/INTEL/INTELFullAssemblyPracticalTest.jsx";
import INTELFullDisassemblyPracticalTest from "./PracticalTests/INTEL/INTELFullDisassemblyPracticalTest.jsx";
import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
  collection,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

const storage = getStorage();

export { auth, db, storage };

function getCurrentWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;

  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);

  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function isCompletedProgress(progress) {
  return !!progress?.completed || !!progress?.finished || (progress?.percent || 0) >= 100;
}

export default function Dashboard({
  onLogout,
  onOpenModule,
  initialSection = "Dashboard",
}) {
  const [section, setSection] = useState(initialSection);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [moduleDropdown, setModuleDropdown] = useState(null);

  const [settings, setSettings] = useState({
    sound: true,
    animations: true,
    darkMode: true,
  });

  const reduce = useReducedMotion();
  const navigate = useOptionalNavigate();

  const refreshUserProfile = useCallback(async (userOverride) => {
    const user = userOverride || auth.currentUser;

    if (!user?.uid) return;

    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setProfile(userSnap.data());
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  }, []);

  const handleSettingChange = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setFirebaseUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setFirebaseUser(user);
      await refreshUserProfile(user);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [refreshUserProfile]);

  useEffect(() => {
    const refresh = () => refreshUserProfile();

    window.addEventListener("articton-progress-updated", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("articton-progress-updated", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refreshUserProfile]);

  const go = (path) => {
    if (navigate) navigate(path);
    else console.log("Route to:", path);
  };

const openModule = (id, platform)=>{
 console.log(id, platform);
 onOpenModule(id);
}

  const openTest = (test) => {
    if (!test || test.locked) return;

    if (test.id === "amd-full-assembly-practical") {
      setSection("AMD Full Assembly Practical");
      return;
    }

    if (test.id === "amd-full-disassembly-practical") {
      setSection("AMD Full Disassembly Practical");
      return;
    }

    if (test.id === "intel-full-assembly-practical") {
      setSection("INTEL Full Assembly Practical");
      return;
    }

    if (test.id === "intel-full-disassembly-practical") {
      setSection("INTEL Full Disassembly Practical");
    }
  };

  const backToPracticeTests = async () => {
    await refreshUserProfile();
    setSection("Practice Tests");
  };

  const data = useMemo(() => {
    const currentWeekKey = getCurrentWeekKey();

    const user = {
      name: profile
        ? `${profile.firstName || ""} ${
            profile.middleInitial ? profile.middleInitial + "." : ""
          } ${profile.lastName || ""}`.trim()
        : "Loading...",
      email: firebaseUser?.email || "No email",
      avatarUrl: profile?.avatarUrl || "",
      middleInitial: profile?.middleInitial || "",
      streakDays: profile?.streakDays || 0,
      minutesThisWeek: profile?.weeklyMinutes?.[currentWeekKey] || 0,
    };

    const module1Progress = profile?.moduleProgress?.module1;
    const module1CompletedParts = module1Progress?.completedParts || {};
    const module1CompletedCount = Object.values(module1CompletedParts).filter(Boolean).length;

    const module2Progress = profile?.moduleProgress?.module2;
    const module2CompletedSteps = module2Progress?.completedSteps || {};
    const module2CompletedCount = Object.values(module2CompletedSteps).filter(Boolean).length;
    const module2TotalSteps = 7;

    const module3Progress = profile?.moduleProgress?.module3;
    const module3CompletedSteps = module3Progress?.completedSteps || {};
    const module3CompletedCount = Object.values(module3CompletedSteps).filter(Boolean).length;
    const module3TotalSteps = 7;

    const module4Progress = profile?.moduleProgress?.module4;
    const module4CompletedCount = Object.values(module4Progress?.completedSteps || {}).filter(Boolean).length;

    const module1Done = isCompletedProgress(module1Progress);
    const module2Done = isCompletedProgress(module2Progress);
    const module3Done = isCompletedProgress(module3Progress);
    const module4Done = isCompletedProgress(module4Progress);

    const moduleNames = {
      cpu: "CPU",
      motherboard: "Motherboard",
      ram: "RAM",
      hdd: "HDD",
      psu: "PSU",
      case: "Case",
    };

    const modules = [
      {
        id: "module-1",
        title: "Module 1",
        subtitle: module1Progress
          ? `Page ${module1Progress.currentPage} • ${
              moduleNames[module1Progress.lastVisitedModuleKey] || "Unknown"
            }`
          : "Name of the parts and what use",
        progress: module1Progress?.percent || 0,
        lessonsCompleted: module1CompletedCount,
        lessonsTotal: module1Progress?.totalPages || 6,
        lastOpenedAt: Date.now(),
        selectionTitle: "Introduction To PC Hardware",
        selectionModuleNo: "Module 1",
        selectionProgressText: module1Progress
          ? `${module1CompletedCount} of ${module1Progress.totalPages || 6} parts completed`
          : "Start Module",
        selectionCta:
          (module1Progress?.percent || 0) >= 100
            ? "Review"
            : (module1Progress?.percent || 0) > 0
            ? "Continue"
            : "Start",
        selectionImage: "/PNG/module1.png",
      },
      {
        id: "module-2",
        title: "Module 2",
        subtitle: module3Progress
          ? `Step ${(module3Progress.currentStep ?? 0) + 1} • Disassembly`
          : "Disassembly",
        progress: module3Progress?.percent || 0,
        lessonsCompleted: module3CompletedCount,
        lessonsTotal: module3TotalSteps,
        lastOpenedAt: Date.now() - 1000 * 60 * 60 * 36,
        selectionTitle: "Disassembly",
        selectionModuleNo: "Module 2",
        selectionProgressText: module2Progress
          ? `${module2CompletedCount} of ${module2TotalSteps} steps completed`
          : "Start Module",
        selectionCta:
          (module2Progress?.percent || 0) >= 100
            ? "Review"
            : (module2Progress?.percent || 0) > 0
            ? "Continue"
            : "Start",
        selectionImage: "/PNG/module2.png",
      },
      {
        id: "module-3",
        title: "Module 3",
        subtitle: module3Progress
          ? `Step ${(module3Progress.currentStep ?? 0) + 1} • Assembly`
          : "Assembly",
        progress: module3Progress?.percent || 0,
        lessonsCompleted: module3CompletedCount,
        lessonsTotal: module3TotalSteps,
        lastOpenedAt: Date.now() - 1000 * 60 * 60 * 20,
        selectionTitle: "Assembly",
        selectionModuleNo: "Module 3",
        selectionProgressText: module3Progress
          ? `${module3CompletedCount} of ${module3TotalSteps} steps completed`
          : "Start Module",
        selectionCta:
          (module3Progress?.percent || 0) >= 100
            ? "Review"
            : (module3Progress?.percent || 0) > 0
            ? "Continue"
            : "Start",
        selectionImage: "/PNG/module3.png",
      },
      
      {
        id: "module-4",
        title: "Module 4",
        subtitle: "Configuring Software (Windows / BIOS)",
        progress: module4Progress?.percent || 0,
        lessonsCompleted: module4CompletedCount,
        lessonsTotal: 6,
        lastOpenedAt: Date.now() - 1000 * 60 * 60 * 12,
        selectionTitle: "Configuring Software",
        selectionModuleNo: "Module 4",
        selectionProgressText: module4Progress
          ? `${module4CompletedCount} of 6 lessons completed`
          : "Module Progress 0/6 Lessons",
        selectionCta:
          (module4Progress?.percent || 0) >= 100
            ? "Review"
            : (module4Progress?.percent || 0) > 0
            ? "Continue"
            : "Start",
        selectionImage: "/PNG/module4.png",
      },
    ];

    const practiceTestAccess = profile?.practiceTestAccess || {};

    const assemblyPracticalUnlocked =
      practiceTestAccess?.module2?.unlocked === true || module2Done;

    const disassemblyPracticalUnlocked =
      practiceTestAccess?.module3?.unlocked === true || module3Done;

    const activity = [
      {
        id: "a1",
        t: "Practical Tests",
        d:
          assemblyPracticalUnlocked || disassemblyPracticalUnlocked
            ? "Available"
            : "Locked until required modules are completed",
      },
    ];

    const achievements = [
      { id: "first-steps", icon: "trophy", title: "First Steps", subtitle: "Complete Intro Lesson" },
      { id: "hands-on", icon: "badge", title: "Hands-On", subtitle: "Pass 1 Practical Test" },
    ];

    const tests = [
      {
        id: "amd-full-assembly-practical",
        title: "AMD Full Assembly Practical Test",
        desc: "AMD PC assembly validation",
        status: assemblyPracticalUnlocked ? "Ready" : "Locked",
        locked: !assemblyPracticalUnlocked,
        lockReason: "Complete Module 2 before accessing this practical test.",
      },
      {
        id: "amd-full-disassembly-practical",
        title: "AMD Full Disassembly Practical Test",
        desc: "AMD PC disassembly validation",
        status: disassemblyPracticalUnlocked ? "Ready" : "Locked",
        locked: !disassemblyPracticalUnlocked,
        lockReason: "Complete Module 3 before accessing this practical test.",
      },
      {
        id: "intel-full-assembly-practical",
        title: "Intel Full Assembly Practical Test",
        desc: "Intel PC assembly validation",
        status: assemblyPracticalUnlocked ? "Ready" : "Locked",
        locked: !assemblyPracticalUnlocked,
        lockReason: "Complete Module 2 before accessing this practical test.",
      },
      {
        id: "intel-full-disassembly-practical",
        title: "Intel Full Disassembly Practical Test",
        desc: "Intel PC disassembly validation",
        status: disassemblyPracticalUnlocked ? "Ready" : "Locked",
        locked: !disassemblyPracticalUnlocked,
        lockReason: "Complete Module 3 before accessing this practical test.",
      },
    ];    ;

    return { user, modules, activity, achievements, tests };
  }, [profile, firebaseUser]);

  useEffect(() => {
    let alive = true;

    setIsLoading(true);
    setError("");

    const t = setTimeout(() => {
      if (!alive) return;
      setIsLoading(false);
    }, 420);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  const user = data.user;
  const allModules = data.modules;

  const stats = useMemo(() => {
    const completed = allModules.filter((m) => m.progress >= 100).length;
    const inProgress = allModules.filter((m) => m.progress > 0 && m.progress < 100).length;
    const notStarted = allModules.filter((m) => m.progress === 0).length;

    const overall =
      allModules.length === 0
        ? 0
        : Math.round(allModules.reduce((sum, m) => sum + m.progress, 0) / allModules.length);

    const nextUp =
      allModules
        .filter((m) => m.progress > 0 && m.progress < 100)
        .sort((a, b) => a.progress - b.progress)[0] ||
      allModules.find((m) => m.progress === 0) ||
      allModules[0];

    return { completed, inProgress, notStarted, overall, nextUp };
  }, [allModules]);

  const sectionLabel =
    section === "Full Assembly Practical" || section === "Full Disassembly Practical"
      ? "Practice Tests"
      : section;

  return (
    <div className="min-h-screen w-full overflow-hidden bg-[#0a0e17] font-sans text-[#e8ecf4] antialiased">
      <style>{`
        .scrollArea {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .scrollArea::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="relative h-screen w-full overflow-hidden">
        <DashboardBackground />

        <div className="relative h-full w-full overflow-hidden p-0 md:p-3">
          <div className="relative h-full w-full overflow-hidden border border-[#1a2438] bg-[linear-gradient(135deg,#0a0e17,#0d1220,#101a2d)] shadow-[0_70px_180px_rgba(0,0,0,0.70)] md:rounded-[30px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(0,255,180,0.08),transparent_35%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_20%,rgba(0,255,180,0.05),transparent_30%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,180,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,180,0.025)_1px,transparent_1px)] bg-[size:54px_54px] opacity-60" />
            <div className="absolute inset-0 bg-black/10 ring-1 ring-white/5" />

            <div className="relative grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[290px_1fr] xl:grid-cols-[310px_1fr]">
              <aside className="h-full overflow-hidden border-r border-[#1a2438] bg-[#0b1220]/86 backdrop-blur-xl">
                <div className="flex h-full flex-col overflow-hidden p-6">
                  <div className="mb-8 flex items-center gap-3 px-2">
                    <button onClick={() => setSection("Dashboard")} className="flex items-center gap-3">
                      <img
                        src="/PNG/Articton.png"
                        alt="Articton Logo"
                        className="h-10 w-10 scale-300 object-contain"
                      />

                      <div>
                        <div className="text-lg font-bold tracking-wide text-white">Articton</div>
                        <div className="text-[11px] uppercase tracking-[0.24em] text-[#00ffb4]">
                          Control Panel
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <SideItem label="Dashboard" active={sectionLabel} onClick={() => setSection("Dashboard")} icon="home" />
                    <SideItem label="Modules" active={sectionLabel} onClick={() => setSection("Modules")} icon="modules" />
                    <SideItem label="Practice Tests" active={sectionLabel} onClick={() => setSection("Practice Tests")} icon="tests" />
                    <SideItem label="Profile" active={sectionLabel} onClick={() => setSection("Profile")} icon="profile" />
                  </div>

                  <div className="mt-6 rounded-[24px] border border-[#1a2438] bg-[#0d1220] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
                    <div className="text-[11px] uppercase tracking-[0.25em] text-[#00ffb4]">Current focus</div>
                    <div className="mt-3 text-sm font-semibold text-white">{stats.nextUp?.title || "No module yet"}</div>
                    <div className="mt-1 text-xs text-[#7a8ba8]">{stats.nextUp?.subtitle || "Choose a module to begin learning."}</div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-[#00ffb4]" style={{ width: `${stats.nextUp?.progress || 0}%` }} />
                    </div>

                    <div className="mt-2 text-[11px] text-[#7a8ba8]">{stats.nextUp?.progress || 0}% complete</div>
                  </div>

                  <div className="flex-1" />

                  <div className="mt-5 space-y-3 border-t border-[#1a2438] pt-5">
                    <SidebarUtilityButton icon="help" label="FAQs" onClick={() => setIsFaqOpen(true)} />
                    <SidebarUtilityButton icon="support" label="Customer Service" onClick={() => setIsSupportOpen(true)} />
                  </div>
                </div>
              </aside>

              <main className="h-full overflow-hidden">
                <div className="grid h-full grid-rows-[auto_1fr] gap-4 overflow-hidden p-6 lg:p-8">
                  <HeaderBar section={section} sectionLabel={sectionLabel} user={user} onSettings={() => setIsSettingsOpen(true)} onLogout={onLogout} />

                  <div className="scrollArea min-h-0 overflow-auto pr-1">
                    {isLoading ? (
                      <LoadingState />
                    ) : error ? (
                      <ErrorState error={error} onRetry={() => refreshUserProfile()} onSupport={() => go("/support")} />
                    ) : (
                      <AnimatePresence mode="wait">
                        {section === "Dashboard" ? (
                          <PageMotion keyName="dashboard" reduce={reduce}>
                            <HomeOverview
                              openModule={openModule}
                              setSection={setSection}
                              overall={stats.overall}
                              modules={allModules}
                              nextUp={stats.nextUp}
                              user={user}
                              stats={stats}
                              achievements={data.achievements}
                              activity={data.activity}
                            />
                          </PageMotion>
                        ) : null}

                        {section === "Modules" ? (
                          <PageMotion keyName="modules" reduce={reduce}>
                            <ModulesSelection
                              modules={allModules}
                              onBack={() => setSection("Dashboard")}
                              onOpenModule={(id) => openModule(id)}
                            />
                          </PageMotion>
                        ) : null}

                        {section === "Practice Tests" ? (
                          <PageMotion keyName="tests" reduce={reduce}>
                            <PracticalTestsList tests={data.tests} onOpen={(test) => openTest(test)} />
                          </PageMotion>
                        ) : null}

                        {section === "AMD Full Assembly Practical" ? (
                          <PageMotion keyName="amd-full-assembly" reduce={reduce}>
                            <AMDFullAssemblyPracticalTest onBack={backToPracticeTests} />
                          </PageMotion>
                        ) : null}

                        {section === "AMD Full Disassembly Practical" ? (
                          <PageMotion keyName="amd-full-disassembly" reduce={reduce}>
                            <AMDFullDisassemblyPracticalTest onBack={backToPracticeTests} />
                          </PageMotion>
                        ) : null}

                        {section === "INTEL Full Assembly Practical" ? (
                          <PageMotion keyName="intel-full-assembly" reduce={reduce}>
                            <INTELFullAssemblyPracticalTest onBack={backToPracticeTests} />
                          </PageMotion>
                        ) : null}

                        {section === "INTEL Full Disassembly Practical" ? (
                          <PageMotion keyName="intel-full-disassembly" reduce={reduce}>
                            <INTELFullDisassemblyPracticalTest onBack={backToPracticeTests} />
                          </PageMotion>
                        ) : null}

                        {section === "Profile" ? (
                          <PageMotion keyName="profile" reduce={reduce}>
                            <ProfilePage
                              user={user}
                              stats={stats}
                              achievements={data.achievements}
                              firebaseUser={firebaseUser}
                              setProfile={setProfile}
                            />
                          </PageMotion>
                        ) : null}
                      </AnimatePresence>
                    )}
                  </div>
                </div>
              </main>
            </div>

            <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.45)]" />
          </div>
        </div>
      </div>

      <FAQModal isOpen={isFaqOpen} onClose={() => setIsFaqOpen(false)} />

      <CustomerServiceModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        user={user}
      />

      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onChange={handleSettingChange}
      />
    </div>
  );
}

function PageMotion({ keyName, reduce, children }) {
  return (
    <motion.div
      key={keyName}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={reduce ? { duration: 0 } : { duration: 0.18 }}
    >
      {children}
    </motion.div>
  );
}

function DashboardBackground() {
  return (
    <>
      <div className="pointer-events-none absolute -left-44 -top-44 h-[720px] w-[720px] rounded-full bg-[#00ffb4]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 -right-52 h-[820px] w-[820px] rounded-full bg-[#00ffb4]/6 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a0e17] via-[#0a0e17] to-[#0d1220]" />
      <div className="pointer-events-none absolute left-[14%] top-[8%] h-[58%] w-[2px] animate-pulse bg-[linear-gradient(180deg,transparent,#00ffb4,transparent)] opacity-30" />
      <div className="pointer-events-none absolute right-[20%] top-[6%] h-[62%] w-[2px] animate-pulse bg-[linear-gradient(180deg,transparent,#00b4ff,transparent)] opacity-20" />
    </>
  );
}

function HeaderBar({ section, sectionLabel, user, onSettings, onLogout }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/6 px-4 py-1.5">
          <span className="h-2 w-2 rounded-full bg-[#00ffb4]" />
          <span className="text-[11px] font-medium uppercase tracking-[0.25em] text-[#00ffb4]">
            {section === "Dashboard" ? "Learning Dashboard" : sectionLabel}
          </span>
        </div>

        <h1 className="mt-5 text-[34px] font-black tracking-tight text-[#e8ecf4] lg:text-[42px]">
          {section === "Dashboard" ? "Welcome back" : sectionLabel}
        </h1>

        <div className="mt-3 text-[15px] text-[#7a8ba8] lg:text-[16px]">
          {section === "Dashboard"
            ? `Continue your hardware journey, ${(user.name || "there").split(" ")[0]}.`
            : "Track progress, launch modules, and stay in control."}
        </div>
      </div>

      <div className="relative z-50">
        <details className="group">
          <summary className="list-none cursor-pointer rounded-2xl border border-[#1a2438] bg-[#0d1220]/95 px-4 py-3 transition hover:bg-[#111b2f]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 text-sm font-bold text-[#00ffb4]">
                {(user.name || "U").charAt(0).toUpperCase()}
              </div>

              <div className="leading-tight text-left">
                <div className="text-sm font-semibold text-white">{user.name}</div>
                <div className="text-[11px] text-[#7a8ba8]">{user.email}</div>
              </div>

              <div className="text-sm text-[#7a8ba8] transition group-open:rotate-180">▾</div>
            </div>
          </summary>

          <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-[#1a2438] bg-[#0d1220]/98 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <button
              onClick={onSettings}
              className="w-full rounded-xl px-4 py-2 text-left text-sm text-[#dbe6f5] transition hover:bg-white/5"
            >
              Settings
            </button>

            <button
              onClick={onLogout}
              className="w-full rounded-xl px-4 py-2 text-left text-sm text-[#dbe6f5] transition hover:bg-white/5"
            >
              Logout
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-6 xl:grid-cols-[1.6fr_0.9fr]">
      <SkeletonCard className="h-full" />
      <div className="flex h-full min-h-0 flex-col gap-6">
        <SkeletonCard className="h-[220px]" />
        <SkeletonCard className="min-h-0 flex-1" />
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry, onSupport }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-lg rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
        <div className="text-xl font-bold text-white">Something went wrong</div>
        <div className="mt-2 text-sm text-[#7a8ba8]">{error}</div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl border border-[#00ffb4]/30 bg-[#00ffb4]/12 px-5 py-2.5 text-sm font-semibold text-[#00ffb4] transition hover:bg-[#00ffb4]/18 focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
          >
            Retry
          </button>

          <button
            type="button"
            onClick={onSupport}
            className="rounded-xl border border-[#1a2438] bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
          >
            Contact support
          </button>
        </div>
      </div>
    </div>
  );
}

function FAQModal({ isOpen, onClose }) {
  const faqs = [
    {
      q: "What is Articton?",
      a: "Articton is an interactive PC hardware learning system that helps students learn computer parts, assembly, disassembly, and configuration through modules and 3D activities.",
    },
    {
      q: "How do modules work?",
      a: "Each module contains guided steps. Your progress is tracked as you complete lessons or activities, so you can continue where you left off.",
    },
    {
      q: "How is my progress saved?",
      a: "Progress is saved locally and also synced to Firebase when you are logged in. This allows your dashboard to show completed steps, percentages, and current module status.",
    },
    {
      q: "Why is my module showing Continue instead of Start?",
      a: "Continue appears when you already have saved progress for that module. Start appears when you have not started it yet.",
    },
    {
      q: "What should I do if a 3D model does not load?",
      a: "Refresh the page first. If the issue continues, check your internet connection or contact support so the model path or file can be checked.",
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_30px_100px_rgba(0,0,0,0.65)]"
          >
            <div className="flex items-center justify-between border-b border-[#1a2438] px-6 py-5">
              <div>
                <div className="text-lg font-bold text-white">FAQs</div>
                <div className="text-xs text-[#7a8ba8]">Common questions about the Articton learning system</div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1a2438] bg-white/[0.03] text-white/70 transition hover:bg-white/[0.06]"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6">
              <div className="space-y-3">
                {faqs.map((item, index) => (
                  <details key={index} className="group rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-white">
                      {item.q}
                      <span className="text-[#7a8ba8] transition group-open:rotate-180">▾</span>
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-[#9fb0c9]">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CustomerServiceModal({ isOpen, onClose, user }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) return;

    try {
      setUploading(true);
      let screenshotURL = "";

      if (screenshot) {
        const fileRef = ref(storage, `supportTickets/${Date.now()}-${screenshot.name}`);
        await uploadBytes(fileRef, screenshot);
        screenshotURL = await getDownloadURL(fileRef);
      }

      await addDoc(collection(db, "supportTickets"), {
        name: user.name,
        email: user.email,
        subject,
        message,
        screenshotURL,
        status: "open",
        createdAt: serverTimestamp(),
      });

      setSubmitted(true);

      setTimeout(() => {
        setSubmitted(false);
        setSubject("");
        setMessage("");
        setScreenshot(null);
        onClose();
      }, 1800);
    } catch (err) {
      console.error("Error submitting support ticket:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_30px_100px_rgba(0,0,0,0.65)]"
          >
            <div className="flex items-center justify-between border-b border-[#1a2438] px-6 py-5">
              <div>
                <div className="text-lg font-bold text-white">Customer Service</div>
                <div className="text-xs text-[#7a8ba8]">Need help? Send us your concern.</div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1a2438] bg-white/[0.03] text-white/70 transition hover:bg-white/[0.06]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <LockedInput label="Name" value={user.name} />
                <LockedInput label="Email" value={user.email} />
              </div>

              <FormField label="Subject" value={subject} onChange={setSubject} placeholder="Enter your concern" />

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7a8ba8]">Message</label>
                <textarea
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue or concern..."
                  className="mt-2 w-full resize-none rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-[#00ffb4]/40 focus:ring-2 focus:ring-[#00ffb4]/15"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7a8ba8]">Screenshot / Snippet</label>
                <label className="mt-2 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[#1a2438] bg-white/[0.03] px-4 py-6 text-sm text-[#9fb0c9] transition hover:border-[#00ffb4]/40 hover:bg-white/[0.05]">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setScreenshot(e.target.files?.[0] || null)} />
                  {screenshot ? screenshot.name : "Upload screenshot"}
                </label>
              </div>

              {submitted ? (
                <div className="rounded-2xl border border-[#00ffb4]/25 bg-[#00ffb4]/10 px-4 py-3 text-sm font-semibold text-[#00ffb4]">
                  Support request submitted successfully ✓
                </div>
              ) : null}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={onClose} className="rounded-xl border border-[#1a2438] bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06]">
                  Cancel
                </button>

                <button type="button" onClick={handleSubmit} className="rounded-xl bg-[#00ffb4] px-5 py-2.5 text-sm font-bold text-[#0a0e17] transition hover:scale-[1.02]">
                  {uploading ? "Submitting..." : "Submit Ticket"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LockedInput({ label, value }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7a8ba8]">{label}</label>
      <input
        value={value}
        disabled
        className="mt-2 w-full cursor-not-allowed rounded-2xl border border-[#1a2438] bg-white/[0.02] px-4 py-3 text-sm text-[#7a8ba8]"
      />
    </div>
  );
}

function FormField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7a8ba8]">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-[#00ffb4]/40 focus:ring-2 focus:ring-[#00ffb4]/15"
      />
    </div>
  );
}

function HomeOverview({ setSection, overall, modules, nextUp, user, stats, achievements, activity, openModule }) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_1fr] gap-6 overflow-hidden">
      <div className="grid grid-cols-1 gap-6">
        <TopCardHero
          title="Continue Module"
          headline={nextUp ? nextUp.subtitle : "Start learning"}
          sub={nextUp ? nextUp.title : "Pick your first lesson"}
          meta={nextUp ? `Module Progress: ${nextUp.lessonsCompleted} / ${nextUp.lessonsTotal} Lessons` : "Ready when you are"}
          button={nextUp ? (nextUp.progress >= 100 ? "Review" : nextUp.progress > 0 ? "Resume" : "Start") : "Browse"}
          imageSrc="/PNG/PCpng1.png"
          onClick={() => (nextUp ? openModule(nextUp.id) : setSection("Modules"))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Streak" value={`${user.streakDays} days`} hint="Keep it going" />
        <StatCard title="This week" value={`${user.minutesThisWeek} min`} hint="Time spent learning" />
        <StatCard title="Completed" value={`${stats.completed}`} hint="Modules finished" />
        <StatCard title="Overall" value={`${overall}%`} hint="Across all modules" />
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <ProgressCardFillHeight overall={overall} modules={modules} onModuleClick={(id) => openModule(id)} />
        <RightColumnFill achievements={achievements} activity={activity} />
      </div>
    </div>
  );
}

function ModulesSelection({ modules, onBack, onOpenModule }) {
  const reduce = useReducedMotion();
  const [moduleDropdown, setModuleDropdown] = useState(null);
  const [broken, setBroken] = useState({});
  const selectionModules = modules.filter((m) => m.selectionTitle && m.selectionImage);

  return (
    <div className="w-full">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <button type="button" onClick={onBack} className="rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-2.5 text-sm text-[#dbe6f5] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25">
            Back to Dashboard
          </button>

          <span className="hidden rounded-full border border-[#1a2438] bg-white/[0.03] px-3 py-1.5 text-[12px] text-[#7a8ba8] sm:inline-flex">
            Select a module to begin
          </span>
        </div>

        <div className="space-y-4">
          {selectionModules.map((m) => (
            <motion.div
              key={m.id}
              whileHover={reduce ? {} : { y: -3 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 22 }}
              className="overflow-hidden rounded-[26px] border border-[#1a2438] bg-[#0d1220] shadow-[0_26px_80px_rgba(0,0,0,0.42)]"
            >
              <div className="grid grid-cols-1 items-center gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-7">
                <div className="min-w-0">
                  <div className="text-[18px] font-extrabold tracking-tight text-[#e8ecf4] lg:text-[20px]">{m.selectionTitle}</div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[12px] text-[#9fb0c9]">{m.selectionModuleNo}</span>
                    <span className="h-1 w-1 rounded-full bg-white/20" />
                    <span className="text-[12px] text-[#7a8ba8]">{m.selectionProgressText}</span>
                  </div>

                 <button
                  type="button"
                  onClick={() => {
                    if (m.id === "module-3") {
                      setModuleDropdown(
                        moduleDropdown === m.id ? null : m.id
                      );
                    } else {
                      onOpenModule?.(m.id);
                    }
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-[#00ffb4]/30 bg-[#00ffb4]/12 px-7 py-2.5 text-sm font-semibold text-[#00ffb4]"
                >
                  {m.selectionCta}
                  <span className="text-[#b7fff0]">→</span>
                </button>
                {moduleDropdown === m.id && (
                <div className="mt-3 flex gap-3">

                  <button
                    type="button"
                    onClick={() =>
                      onOpenModule?.(`${m.id}-amd`)
                    }
                    className="rounded-xl border border-[#00ffb4]/30 bg-[#00ffb4]/10 px-5 py-2 text-sm text-[#00ffb4]"
                  >
                    AMD
                  </button>


                  <button
                    type="button"
                    onClick={() =>
                      onOpenModule?.(`${m.id}-intel`)
                    }
                    className="rounded-xl border border-[#00ffb4]/30 bg-[#00ffb4]/10 px-5 py-2 text-sm text-[#00ffb4]"
                  >
                    Intel
                  </button>

                </div>
              )}
                </div>

                <div className="relative h-[150px] overflow-hidden rounded-2xl border border-[#1a2438] bg-[#0a0e17] shadow-[inset_0_0_38px_rgba(0,0,0,0.52)] sm:h-[170px] lg:h-[180px]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(0,255,180,0.12),transparent_60%)]" />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />

                  {!broken[m.id] ? (
                    <img src={m.selectionImage} alt="" className="absolute inset-0 h-full w-full object-contain p-5" onError={() => setBroken((prev) => ({ ...prev, [m.id]: true }))} />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-xl border border-[#1a2438] bg-white/[0.03] px-3 py-2 text-[12px] text-[#7a8ba8]">
                        Image not found (check {m.selectionImage})
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PracticalTestsList({ tests, onOpen }) {
  return (
    <AssessmentList
      title="Practice Tests"
      subtitle="Assembly unlocks after finishing Module 2. Disassembly unlocks after finishing Module 3."
      items={tests}
      onOpen={onOpen}
      openLabel="Open Test"
    />
  );
}

function AssessmentList({ title, subtitle, items, onOpen, openLabel, retakeLabel = "Retake" }) {
  const motionPreset = useCardMotion();

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xl font-black tracking-tight text-white">{title}</div>
        <div className="mt-1 text-sm text-[#7a8ba8]">{subtitle}</div>
      </div>

      <div className="grid grid-cols-1 gap-6 overflow-hidden lg:grid-cols-2">
        {items.map((item) => {
          const locked = !!item.locked;
          const completed = !!item.completed;
          const staticItem = !!item.isStatic;
          const hasProgress = !!item.progress;
          const hasScore =
            hasProgress &&
            item.progress.score !== null &&
            item.progress.score !== undefined &&
            item.progress.total !== null &&
            item.progress.total !== undefined;
          const hasPercent =
            hasProgress &&
            item.progress.percent !== null &&
            item.progress.percent !== undefined;

          const scoreText = hasScore ? `${item.progress.score}/${item.progress.total}` : "—";
          const scorePercentText = hasPercent
            ? `${item.progress.scorePercent ?? item.progress.percent}% Score`
            : "—";
          const completionText =
            item.progress?.completionPercent !== undefined
              ? `${item.progress.completionPercent}% Completed`
              : completed
              ? "100% Completed"
              : "0% Completed";

          return (
            <motion.div
              key={item.id}
              {...motionPreset}
              className={[
                "flex min-h-[190px] w-full flex-col items-start justify-between rounded-[28px] border p-8 text-left shadow-[0_30px_90px_rgba(0,0,0,0.42)]",
                locked
                  ? "border-[#1a2438] bg-[#0d1220]/70 opacity-80"
                  : completed
                  ? "border-[#00ffb4]/22 bg-[#0d1220] shadow-[0_30px_90px_rgba(0,255,180,0.06)]"
                  : "border-[#1a2438] bg-[#0d1220]",
              ].join(" ")}
            >
              <div className="flex w-full items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-lg font-bold tracking-tight text-[#e8ecf4]">{item.title}</div>
                  <div className="mt-1 text-sm text-[#7a8ba8]">{item.desc}</div>

                  {completed ? (
                    <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-[#00ffb4]/25 bg-[#00ffb4]/10 px-4 py-2 text-[12px] font-semibold text-[#b7fff0]">
                      <span>Previous Score: {scoreText}</span>
                      <span className="text-[#00ffb4]/65">•</span>
                      <span>{completionText}</span>
                      <span className="text-[#00ffb4]/65">•</span>
                      <span>{scorePercentText}</span>
                      <span className={item.progress?.passed ? "text-[#b7fff0]" : "text-yellow-100"}>
                        {item.progress?.passed ? "Passed" : "Completed"}
                      </span>
                    </div>
                  ) : locked ? (
                    <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-[12px] text-red-100">
                      {item.lockReason}
                    </div>
                  ) : staticItem ? (
                    <div className="mt-3 rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-2 text-[12px] text-[#9fb0c9]">
                      {item.staticReason || "This assessment is static for now."}
                    </div>
                  ) : item.unlockHint ? (
                    <div className="mt-3 rounded-2xl border border-[#00ffb4]/20 bg-[#00ffb4]/8 px-4 py-2 text-[12px] text-[#b7fff0]">
                      {item.unlockHint}
                    </div>
                  ) : null}
                </div>

                <StatusBadge status={item.status} locked={locked} completed={completed} />
              </div>

              <button
                type="button"
                disabled={locked}
                onClick={() => onOpen?.(item)}
                className={[
                  "mt-5 inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-[13px] font-semibold transition",
                  locked
                    ? "cursor-not-allowed border-[#1a2438] bg-white/[0.02] text-[#7a8ba8]"
                    : completed
                    ? "border-[#00ffb4]/30 bg-[#00ffb4]/12 text-[#00ffb4] hover:bg-[#00ffb4]/18"
                    : "border-[#1a2438] bg-white/[0.03] text-[#dbe6f5] hover:bg-white/[0.06]",
                ].join(" ")}
              >
                {locked ? "Locked" : completed ? retakeLabel : openLabel} <span className="text-[#b7fff0]">→</span>
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status, locked, completed }) {
  return (
    <span
      className={[
        "shrink-0 rounded-full border px-3 py-1.5 text-[11px]",
        completed
          ? "border-[#00ffb4]/30 bg-[#00ffb4]/12 text-[#00ffb4]"
          : !locked
          ? "border-[#00ffb4]/30 bg-[#00ffb4]/12 text-[#00ffb4]"
          : "border-[#1a2438] bg-white/[0.03] text-[#7a8ba8]",
      ].join(" ")}
    >
      {status}
    </span>
  );
}

function ComingSoonAssessment({ title, onBack }) {
  return (
    <div className="flex min-h-[520px] items-center justify-center">
      <div className="w-full max-w-xl rounded-[30px] border border-[#1a2438] bg-[#0d1220] p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 text-2xl text-[#00ffb4]">✓</div>
        <div className="text-2xl font-black text-white">{title}</div>
        <div className="mt-3 text-sm leading-7 text-[#7a8ba8]">This assessment file will be connected once it is created.</div>
        <button type="button" onClick={onBack} className="mt-7 rounded-2xl border border-[#1a2438] bg-white/[0.03] px-6 py-3 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06]">
          ← Back
        </button>
      </div>
    </div>
  );
}

function ProfilePage({ user, stats, achievements, firebaseUser, setProfile }) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mi, setMi] = useState("");
  const [previewImage, setPreviewImage] = useState(user.avatarUrl || "");

  useEffect(() => {
    const parts = (user.name || "").trim().split(" ");

    setFirstName(parts[0] || "");
    setLastName(parts.length > 1 ? parts[parts.length - 1] : "");
    setMi(user.middleInitial || "");
    setPreviewImage(user.avatarUrl || "");
  }, [user.name, user.avatarUrl, user.middleInitial]);

  const fullName = `${firstName} ${mi ? mi + "." : ""} ${lastName}`.trim();

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewImage(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!firebaseUser?.uid) {
      console.error("No logged-in user found.");
      return;
    }

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanMi = mi.trim().toUpperCase();

    try {
      const userRef = doc(db, "users", firebaseUser.uid);

      await updateDoc(userRef, {
        firstName: cleanFirstName,
        lastName: cleanLastName,
        middleInitial: cleanMi,
        updatedAt: serverTimestamp(),
      });

      setProfile((prev) => ({
        ...prev,
        firstName: cleanFirstName,
        lastName: cleanLastName,
        middleInitial: cleanMi,
      }));

      setIsEditOpen(false);
    } catch (err) {
      console.error("Error updating profile:", err);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
          <div className="p-8">
            <div className="text-lg font-bold tracking-tight text-[#e8ecf4]">My Profile</div>

            <div className="mt-6 flex items-center gap-4">
              <ProfileAvatar image={previewImage} fallback={(firstName || user.name || "U").charAt(0).toUpperCase()} />

              <div>
                <div className="text-base font-semibold text-white">{fullName || user.name}</div>
                <div className="text-sm text-[#7a8ba8]">{user.email}</div>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MiniStat title="Streak" value={`${user.streakDays} days`} />
              <MiniStat title="This week" value={`${user.minutesThisWeek} min`} />
              <MiniStat title="Completed" value={`${stats.completed}`} />
            </div>

            <div className="mt-7 rounded-2xl border border-[#1a2438] bg-white/[0.03] p-6">
              <div className="text-sm font-semibold text-white">Quick actions</div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => setIsEditOpen(true)} className="rounded-xl border border-[#1a2438] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25">
                  Edit profile
                </button>

                <button type="button" onClick={() => console.log("View achievements")} className="rounded-xl border border-[#1a2438] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25">
                  View achievements
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
          <div className="p-7">
            <div className="text-lg font-bold tracking-tight text-[#e8ecf4]">Badges</div>
            <div className="mt-5 space-y-3">
              {achievements.map((a) => (
                <AchievementRow key={a.id} icon={a.icon} title={a.title} subtitle={a.subtitle} onClick={() => console.log(a.id)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isEditOpen && (
          <motion.div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.97 }} transition={{ duration: 0.18 }} className="w-full max-w-lg overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_30px_100px_rgba(0,0,0,0.65)]">
              <div className="flex items-center justify-between border-b border-[#1a2438] px-6 py-5">
                <div>
                  <div className="text-lg font-bold text-white">Edit Profile</div>
                  <div className="text-xs text-[#7a8ba8]">Front-end preview only</div>
                </div>

                <button type="button" onClick={() => setIsEditOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1a2438] bg-white/[0.03] text-white/70 transition hover:bg-white/[0.06]">
                  ✕
                </button>
              </div>

              <div className="p-6">
                <div className="flex items-center gap-5">
                  <ProfileAvatar image={previewImage} fallback={(firstName || "U").charAt(0).toUpperCase()} large />

                  <div>
                    <label className="inline-flex cursor-pointer rounded-xl border border-[#00ffb4]/30 bg-[#00ffb4]/12 px-4 py-2.5 text-sm font-semibold text-[#00ffb4] transition hover:bg-[#00ffb4]/18">
                      Upload picture
                      <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    </label>
                    <div className="mt-2 text-xs text-[#7a8ba8]">Preview only for now. Firebase upload can be added later.</div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField label="First Name" value={firstName} onChange={setFirstName} placeholder="First name" />
                  <FormField label="Last Name" value={lastName} onChange={setLastName} placeholder="Last name" />
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7a8ba8]">MI</label>
                    <input value={mi} maxLength={1} onChange={(e) => setMi(e.target.value.toUpperCase())} className="mt-2 w-full rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-3 text-center text-sm text-white outline-none focus:border-[#00ffb4]/40 focus:ring-2 focus:ring-[#00ffb4]/15" placeholder="M" />
                  </div>
                </div>

                <div className="mt-4">
                  <LockedInput label="Email" value={user.email} />
                </div>

                <div className="mt-7 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsEditOpen(false)} className="rounded-xl border border-[#1a2438] bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06]">
                    Cancel
                  </button>

                  <button type="button" onClick={handleSave} className="rounded-xl bg-[#00ffb4] px-5 py-2.5 text-sm font-bold text-[#0a0e17] transition hover:scale-[1.02]">
                    Save changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ProfileAvatar({ image, fallback, large = false }) {
  return (
    <div className={`${large ? "h-20 w-20 text-2xl" : "h-14 w-14 text-lg"} flex items-center justify-center overflow-hidden rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 font-bold text-[#00ffb4]`}>
      {image ? <img src={image} alt="Profile" className="h-full w-full object-cover" /> : fallback}
    </div>
  );
}

function RightColumnFill({ achievements, activity }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <AchievementsCardCompact achievements={achievements} onClick={(id) => console.log(id)} />
      <RecentActivityFill items={activity} onClick={(id) => console.log(id)} />
    </div>
  );
}

function SideItem({ label, active, onClick, icon }) {
  const isActive = active === label;

  return (
    <button
      onClick={onClick}
      className={[
        "w-full rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25",
        isActive
          ? "border-[#00ffb4]/25 bg-[#00ffb4]/10 shadow-[0_18px_50px_rgba(0,255,180,0.08)]"
          : "border-transparent bg-transparent hover:border-[#1a2438] hover:bg-white/[0.03]",
      ].join(" ")}
      aria-current={isActive ? "page" : undefined}
    >
      <div className="flex items-center gap-3">
        <span className={["flex h-10 w-10 items-center justify-center rounded-2xl border", isActive ? "border-[#00ffb4]/25 bg-[#00ffb4]/10" : "border-[#1a2438] bg-[#0d1220]"].join(" ")}>
          <Icon kind={icon} active={isActive} />
        </span>
        <span className={isActive ? "text-sm font-semibold text-white" : "text-sm font-semibold text-[#c8d4e6]"}>{label}</span>
      </div>
    </button>
  );
}

function SidebarUtilityButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      className="w-full rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-3 text-left text-sm font-semibold text-[#c8d4e6] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#1a2438] bg-[#0d1220]">
          <Icon kind={icon} />
        </span>
        <span>{label}</span>
      </div>
    </button>
  );
}

function useCardMotion() {
  const reduce = useReducedMotion();

  return useMemo(() => {
    if (reduce) return { whileHover: {}, whileTap: {}, transition: { duration: 0.15 } };

    return {
      whileHover: { y: -6, scale: 1.01 },
      whileTap: { scale: 0.99 },
      transition: { type: "spring", stiffness: 260, damping: 22 },
    };
  }, [reduce]);
}

function TopCardHero({ title, headline, sub, meta, button, imageSrc, onClick }) {
  const motionPreset = useCardMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      {...motionPreset}
      className="relative w-full overflow-hidden rounded-[30px] border border-[#1a2438] bg-[linear-gradient(135deg,#0d1220,#111d33)] text-left shadow-[0_34px_110px_rgba(0,0,0,0.46)] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
      aria-label={`${title}: ${headline}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(0,255,180,0.08),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)]" />

      <div className="flex min-h-[250px] items-center gap-8 p-9 lg:min-h-[285px] lg:p-10">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#9fdccb]">{title}</div>
          <div className="mt-3 text-[34px] font-extrabold leading-[1.04] tracking-tight text-[#e8ecf4] lg:text-[38px]">{headline}</div>
          <div className="mt-1 text-[14px] text-[#9fb0c9] lg:text-[15px]">{sub}</div>
          <div className="mt-5 text-[12.5px] text-[#7a8ba8]">{meta}</div>

          <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-[#00ffb4]/30 bg-[#00ffb4]/12 px-12 py-4 text-[14px] font-semibold text-[#00ffb4] transition hover:bg-[#00ffb4]/18 lg:text-[15px]">
            {button}
            <span className="text-[#b7fff0]">→</span>
          </div>
        </div>

        <div className="relative h-[200px] w-[320px] flex-shrink-0 overflow-hidden rounded-2xl border border-[#1a2438] bg-[#0a0e17] shadow-[inset_0_0_46px_rgba(0,0,0,0.50)] sm:h-[220px] sm:w-[360px] lg:h-[240px] lg:w-[420px]">
          <img src={imageSrc} alt="" className="absolute inset-0 h-full w-full object-contain p-6 lg:p-7" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_45%_35%,rgba(0,255,180,0.20),transparent_62%)]" />
        </div>
      </div>
    </motion.button>
  );
}

function ProgressCardFillHeight({ overall, modules, onModuleClick }) {
  return (
    <div className="scrollArea h-full min-h-0 overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
      <div className="flex h-full min-h-0 flex-col p-8">
        <div className="text-lg font-bold tracking-tight text-[#e8ecf4]">My Progress</div>

        <div className="mt-6 grid grid-cols-1 items-start gap-6 md:grid-cols-[220px_1fr]">
          <DonutAnimated value={overall} />

          <div className="relative overflow-hidden rounded-2xl border border-[#1a2438] bg-white/[0.03] p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_40%,rgba(0,255,180,0.10),transparent_55%)]" />
            <div className="relative">
              <div className="mt-2 flex items-center gap-2 text-sm text-[#9fb0c9]">
                <span className="h-2 w-2 rounded-full bg-[#00ffb4]" />
                Overall Progress
              </div>
              <div className="mt-4">
                <div className="font-semibold text-white">PC Building Course</div>
                <div className="text-[12px] text-[#7a8ba8]">All modules combined</div>
                <AnimatedBar percent={overall} />
                <div className="mt-2 text-[11px] text-[#7a8ba8]">Keep going — consistency beats speed.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="scrollArea mt-6 min-h-0 space-y-4 overflow-auto pr-1">
          <StaggerList>
            {modules.map((m) => (
              <ModuleProgressRow
                key={m.id}
                title={m.title}
                subtitle={m.subtitle}
                progress={m.progress}
                lessonsCompleted={m.lessonsCompleted}
                lessonsTotal={m.lessonsTotal}
                onClick={() => onModuleClick?.(m.id)}
              />
            ))}
          </StaggerList>
        </div>
      </div>
    </div>
  );
}

function ModuleProgressRow({ title, subtitle, progress, lessonsCompleted, lessonsTotal, onClick }) {
  const motionPreset = useCardMotion();
  const cta = progress >= 100 ? "Review" : progress > 0 ? "Continue" : "Start";
  const meta = progress >= 100 ? "Completed" : `${lessonsCompleted} / ${lessonsTotal} lessons`;
  const completedStyle = progress >= 100;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      {...motionPreset}
      className={[
        "relative w-full overflow-hidden rounded-2xl border p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25",
        completedStyle ? "border-[#00ffb4]/25 bg-[#00ffb4]/8" : "border-[#1a2438] bg-white/[0.03]",
      ].join(" ")}
      aria-label={`${title} — ${cta}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.04),transparent_35%)]" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              {title}
              {completedStyle ? <span className="rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 px-2 py-0.5 text-[11px] text-[#00ffb4]">✓ Done</span> : null}
            </div>
            <div className="mt-1 text-[12px] text-[#7a8ba8]">{subtitle}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-[#dbe6f5]">{progress}%</div>
            <div className="mt-1 text-[11px] text-[#7a8ba8]">{cta}</div>
          </div>
        </div>
        <AnimatedBar percent={progress} />
        <div className="mt-2 text-[11px] text-[#7a8ba8]">{meta}</div>
      </div>
    </motion.button>
  );
}

function AnimatedBar({ percent = 0 }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10" aria-label={`Progress bar ${percent}%`}>
      <div className="h-full bg-[#00ffb4] transition-[width] duration-[900ms] ease-out" style={{ width: ready ? `${percent}%` : "0%" }} />
    </div>
  );
}

function AchievementsCardCompact({ achievements, onClick }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
      <div className="p-7">
        <div className="text-lg font-bold tracking-tight text-[#e8ecf4]">Achievements</div>
        <div className="mt-5 space-y-3">
          {achievements.slice(0, 2).map((a) => (
            <AchievementRow key={a.id} icon={a.icon} title={a.title} subtitle={a.subtitle} onClick={() => onClick?.(a.id)} />
          ))}
        </div>
        <div className="mt-4 text-right">
          <span className="inline-flex rounded-full border border-[#1a2438] bg-white/[0.03] px-3 py-1.5 text-[11px] text-[#7a8ba8]">
            +{Math.max(0, achievements.length - 2)} more…
          </span>
        </div>
      </div>
    </div>
  );
}

function AchievementRow({ icon, title, subtitle, onClick }) {
  const motionPreset = useCardMotion();

  return (
    <motion.button type="button" onClick={onClick} {...motionPreset} className="flex w-full items-center gap-4 rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4 text-left focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25" aria-label={`Open achievement ${title}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00ffb4]/18 bg-[#00ffb4]/10">
        <Icon kind={icon} active />
      </div>
      <div>
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="text-[12px] text-[#7a8ba8]">{subtitle}</div>
      </div>
    </motion.button>
  );
}

function RecentActivityFill({ items, onClick }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
      <div className="flex h-full min-h-0 flex-col p-7">
        <div className="text-lg font-bold tracking-tight text-[#e8ecf4]">Recent Activity</div>
        <div className="scrollArea mt-5 min-h-0 flex-1 space-y-3 overflow-auto pr-1">
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => onClick?.(item.id)} className="w-full rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25">
              <div className="text-sm font-semibold text-white">{item.t}</div>
              <div className="mt-1 text-[12px] text-[#7a8ba8]">{item.d}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DonutAnimated({ value = 0 }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  const currentValue = ready ? value : 0;
  const angle = Math.min(100, Math.max(0, currentValue)) * 3.6;

  return (
    <div className="flex items-center justify-center">
      <div className="relative flex h-[200px] w-[200px] items-center justify-center rounded-full transition-all duration-[900ms] ease-out" style={{ background: `conic-gradient(#00ffb4 ${angle}deg, rgba(255,255,255,0.08) 0deg)` }}>
        <div className="absolute inset-[14px] rounded-full bg-[#0d1220]" />
        <div className="relative text-center">
          <div className="text-4xl font-black text-white">{value}%</div>
          <div className="mt-1 text-[12px] text-[#7a8ba8]">Overall</div>
        </div>
      </div>
    </div>
  );
}

function StaggerList({ children }) {
  const reduce = useReducedMotion();

  if (reduce) return <div className="space-y-4">{children}</div>;

  const variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.04,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.18 } },
  };

  return (
    <motion.div variants={variants} initial="hidden" animate="show" className="space-y-4">
      {React.Children.map(children, (child, idx) => (
        <motion.div key={idx} variants={item}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

function StatCard({ title, value, hint }) {
  return (
    <div className="rounded-[22px] border border-[#1a2438] bg-[#0d1220] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.30)]">
      <div className="text-[12px] text-[#7a8ba8]">{title}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-white">{value}</div>
      <div className="mt-1 text-[12px] text-[#7a8ba8]">{hint}</div>
    </div>
  );
}

function MiniStat({ title, value }) {
  return (
    <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
      <div className="text-[12px] text-[#7a8ba8]">{title}</div>
      <div className="mt-2 text-lg font-extrabold text-white">{value}</div>
    </div>
  );
}

function SkeletonCard({ className = "" }) {
  return (
    <div className={[
      "overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_30px_90px_rgba(0,0,0,0.42)]",
      className,
    ].join(" ")}
    >
      <div className="space-y-4 p-7">
        <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-64 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-52 animate-pulse rounded bg-white/10" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-white/10" />
        <div className="h-10 w-44 animate-pulse rounded-2xl bg-white/10" />
      </div>
    </div>
  );
}

function useOptionalNavigate() {
  try {
    if (typeof require === "undefined") return null;
    const rr = require("react-router-dom");
    return rr?.useNavigate ? rr.useNavigate() : null;
  } catch {
    return null;
  }
}

function Icon({ kind, active = false }) {
  const fill = active ? "bg-[#00ffb4]/70" : "bg-white/25";
  const soft = active ? "bg-[#00ffb4]/45" : "bg-white/20";

  if (kind === "home") {
    return (
      <div className={`relative h-5 w-5 rounded ${soft}`}>
        <div className={`absolute left-[6px] top-[7px] h-[7px] w-[9px] rounded ${fill}`} />
      </div>
    );
  }

  if (kind === "modules") {
    return (
      <div className={`relative h-4 w-5 overflow-hidden rounded ${soft}`}>
        <div className={`absolute left-0 top-0 h-full w-[3px] ${fill}`} />
      </div>
    );
  }

  if (kind === "tests") {
    return (
      <div className="grid h-5 w-5 grid-cols-2 gap-1">
        <span className={`rounded ${fill}`} />
        <span className={`rounded ${soft}`} />
        <span className={`rounded ${soft}`} />
        <span className={`rounded ${fill}`} />
      </div>
    );
  }

  if (kind === "profile") {
    return (
      <div className="relative h-5 w-5">
        <div className={`mx-auto h-2.5 w-2.5 rounded-full ${fill}`} />
        <div className={`absolute bottom-0 left-1/2 h-2.5 w-4 -translate-x-1/2 rounded-t-full ${soft}`} />
      </div>
    );
  }

  if (kind === "help") return <div className="text-sm font-black text-[#00ffb4]">?</div>;
  if (kind === "support") return <div className="text-sm font-black text-[#00ffb4]">CS</div>;
  if (kind === "trophy") return <div className="text-sm font-black text-[#00ffb4]">★</div>;
  if (kind === "badge") return <div className="text-sm font-black text-[#00ffb4]">✓</div>;

  return <div className={`h-4 w-4 rounded ${fill}`} />;
}