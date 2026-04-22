import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function Dashboard({ onLogout, onOpenModule, onOpenTest,  initialSection = "Dashboard"}) {
  const [section, setSection] = useState(initialSection);
  useEffect(() => {
  setSection(initialSection);
}, [initialSection]);

  const navigate = useOptionalNavigate();
  const go = (path) => {
    if (navigate) navigate(path);
    else console.log("Route to:", path);
  };

  const openModule = (id) => {
    if (onOpenModule) onOpenModule(id);
    else go(`/modules/${id}`);
  };

  const openTest = (id) => {
    if (onOpenTest) onOpenTest(id);
    else go(`/tests/${id}`);
  };

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);

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
        return;
      }

      setFirebaseUser(user);

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) setProfile(userSnap.data());
        else setProfile(null);
      } catch (err) {
        console.error("Error reading profile:", err);
      }
    });

    return () => unsubscribe();
  }, []);

  const data = useMemo(() => {
    const user = {
      name: profile
        ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
        : "Loading...",
      email: firebaseUser?.email || "No email",
      avatarUrl: "",
      streakDays: 6,
      minutesThisWeek: 142,
    };

    const modules = [
      {
        id: "module-1",
        title: "Module 1",
        subtitle: "Name of the parts and what use",
        progress: 72,
        lessonsCompleted: 5,
        lessonsTotal: 8,
        lastOpenedAt: Date.now() - 1000 * 60 * 12,
        selectionTitle: "Introduction To Hardware",
        selectionModuleNo: "Module 1",
        selectionProgressText: "Module Progress 1/7 Lessons",
        selectionCta: "Start",
        selectionImage: "/PNG/module1.png",
      },
      {
        id: "module-2",
        title: "Module 2",
        subtitle: "Assembly",
        progress: 40,
        lessonsCompleted: 2,
        lessonsTotal: 5,
        lastOpenedAt: Date.now() - 1000 * 60 * 60 * 20,
        selectionTitle: "Assembly",
        selectionModuleNo: "Module 2",
        selectionProgressText: "Module Progress 1/7 Lessons",
        selectionCta: "Start",
        selectionImage: "/PNG/module2.png",
      },
      {
        id: "module-3",
        title: "Module 3",
        subtitle: "Disassembly",
        progress: 15,
        lessonsCompleted: 1,
        lessonsTotal: 7,
        lastOpenedAt: Date.now() - 1000 * 60 * 60 * 36,
        selectionTitle: "Disassembly",
        selectionModuleNo: "Module 3",
        selectionProgressText: "Module Progress 1/7 Lessons",
        selectionCta: "Start",
        selectionImage: "/PNG/module3.png",
      },
      {
        id: "module-4",
        title: "Module 4",
        subtitle: "Configuring Software (Windows / BIOS)",
        progress: 0,
        lessonsCompleted: 0,
        lessonsTotal: 6,
        lastOpenedAt: Date.now() - 1000 * 60 * 60 * 12,
        selectionTitle: "Configuring Software",
        selectionModuleNo: "Module 4",
        selectionProgressText: "Module Progress 0/6 Lessons",
        selectionCta: "Start",
        selectionImage: "/PNG/module4.png",
      },
    ];

    const activity = [
      { id: "a1", t: "Module 1 • Lesson 5", d: "Completed • 12 min ago" },
      { id: "a2", t: "Module 2 • Lesson 2", d: "In progress • Yesterday" },
      { id: "a3", t: "Practical Test", d: "Scheduled • This week" },
      { id: "a4", t: "Module 2 • Lesson 3", d: "Next up • Recommended" },
      { id: "a5", t: "Module 1 • Quiz", d: "Available • 10 questions" },
    ];

    const achievements = [
      { id: "first-steps", icon: "trophy", title: "First Steps", subtitle: "Complete Intro Lesson" },
      { id: "hands-on", icon: "badge", title: "Hands-On", subtitle: "Pass 1 Practical Test" },
    ];

    const tests = [
      { id: "intro-3d-identification", title: "Hardware Identification", desc: "Introduction • 3D model naming quiz", status: "Ready" },
      { id: "pc-assembly", title: "PC Assembly Test", desc: "20 minutes timer", status: "Ready" },
      { id: "pc-disassembly", title: "PC Disassembly Test", desc: "15 minutes timer", status: "Locked" },
      { id: "software-config", title: "Software Configuration Quiz (Windows & BIOS)", desc: "20 minutes", status: "Locked" },
    ];

    return { user, modules, activity, achievements, tests };
  }, [profile, firebaseUser]);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setError("");

    const t = setTimeout(() => {
      if (!alive) return;
      const shouldError = false;
      if (shouldError) setError("Failed to load dashboard data. Please try again.");
      setIsLoading(false);
    }, 520);

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

  const reduce = useReducedMotion();

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
                        <div className="text-[11px] uppercase tracking-[0.24em] text-[#00ffb4]">Control Panel</div>
                      </div>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <SideItem label="Dashboard" active={section} onClick={() => setSection("Dashboard")} icon="home" />
                    <SideItem label="Modules" active={section} onClick={() => setSection("Modules")} icon="modules" />
                    <SideItem label="Practice Tests" active={section} onClick={() => setSection("Practice Tests")} icon="tests" />
                    <SideItem label="Profile" active={section} onClick={() => setSection("Profile")} icon="profile" />
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
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-3 text-left text-sm font-semibold text-[#c8d4e6] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
                      onClick={() => go("/faqs")}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#1a2438] bg-[#0d1220]">
                          <Icon kind="help" />
                        </span>
                        <span>FAQs</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="w-full rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-3 text-left text-sm font-semibold text-[#c8d4e6] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
                      onClick={() => go("/support")}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#1a2438] bg-[#0d1220]">
                          <Icon kind="support" />
                        </span>
                        <span>Customer Service</span>
                      </div>
                    </button>
                  </div>
                </div>
              </aside>

              <main className="h-full overflow-hidden">
                <div className="grid h-full grid-rows-[auto_1fr] gap-4 overflow-hidden p-6 lg:p-8">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/6 px-4 py-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#00ffb4]" />
                        <span className="text-[11px] font-medium uppercase tracking-[0.25em] text-[#00ffb4]">
                          {section === "Dashboard" ? "Learning Dashboard" : section}
                        </span>
                      </div>

                      <h1 className="mt-5 text-[34px] font-black tracking-tight text-[#e8ecf4] lg:text-[42px]">
                        {section === "Dashboard" ? "Welcome back" : section}
                      </h1>

                      <div className="mt-3 text-[15px] text-[#7a8ba8] lg:text-[16px]">
                        {section === "Dashboard"
                          ? `Continue your hardware journey, ${user.name.split(" ")[0]}.`
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
                            onClick={() => go("/settings")}
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

                  <div className="scrollArea min-h-0 overflow-auto pr-1">
                    {isLoading ? (
                      <div className="grid h-full min-h-0 grid-cols-1 gap-6 xl:grid-cols-[1.6fr_0.9fr]">
                        <SkeletonCard className="h-full" />
                        <div className="flex h-full min-h-0 flex-col gap-6">
                          <SkeletonCard className="h-[220px]" />
                          <SkeletonCard className="min-h-0 flex-1" />
                        </div>
                      </div>
                    ) : error ? (
                      <div className="flex h-full items-center justify-center">
                        <div className="w-full max-w-lg rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
                          <div className="text-xl font-bold text-white">Something went wrong</div>
                          <div className="mt-2 text-sm text-[#7a8ba8]">{error}</div>
                          <div className="mt-6 flex gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setError("");
                                setIsLoading(true);
                                setTimeout(() => setIsLoading(false), 450);
                              }}
                              className="rounded-xl border border-[#00ffb4]/30 bg-[#00ffb4]/12 px-5 py-2.5 text-sm font-semibold text-[#00ffb4] transition hover:bg-[#00ffb4]/18 focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              onClick={() => go("/support")}
                              className="rounded-xl border border-[#1a2438] bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
                            >
                              Contact support
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <AnimatePresence mode="wait">
                        {section === "Dashboard" ? (
                          <motion.div
                            key="dashboard"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={reduce ? { duration: 0 } : { duration: 0.18 }}
                          >
                            <HomeOverview
                              openModule={openModule}
                              openTest={openTest}
                              setSection={setSection}
                              overall={stats.overall}
                              modules={allModules}
                              nextUp={stats.nextUp}
                              user={user}
                              stats={stats}
                              achievements={data.achievements}
                              activity={data.activity}
                            />
                          </motion.div>
                        ) : null}

                        {section === "Modules" ? (
                          <motion.div
                            key="modules"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={reduce ? { duration: 0 } : { duration: 0.18 }}
                          >
                            <ModulesSelection
                              modules={allModules}
                              onBack={() => setSection("Dashboard")}
                              onOpenModule={(id) => openModule(id)}
                            />
                          </motion.div>
                        ) : null}

                        {section === "Practice Tests" ? (
                          <motion.div
                            key="tests"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={reduce ? { duration: 0 } : { duration: 0.18 }}
                          >
                            <PracticalTestsPage tests={data.tests} onOpen={(id) => openTest(id)} />
                          </motion.div>
                        ) : null}

                        {section === "Profile" ? (
                          <motion.div
                            key="profile"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={reduce ? { duration: 0 } : { duration: 0.18 }}
                          >
                            <ProfilePage user={user} stats={stats} achievements={data.achievements} />
                          </motion.div>
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
    </div>
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

function HomeOverview({ openModule, openTest, setSection, overall, modules, nextUp, user, stats, achievements, activity }) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_1fr] gap-6 overflow-hidden">
      <div className="grid grid-cols-1 gap-6">
        <TopCardHero
          title="Continue Module"
          headline={nextUp ? nextUp.subtitle : "Start learning"}
          sub={nextUp ? nextUp.title : "Pick your first lesson"}
          meta={
            nextUp
              ? `Module Progress: ${nextUp.lessonsCompleted} / ${nextUp.lessonsTotal} Lessons`
              : "Ready when you are"
          }
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
        <RightColumnFill achievements={achievements} activity={activity} openTest={openTest} setSection={setSection} />
      </div>
    </div>
  );
}

function ModulesSelection({ modules, onBack, onOpenModule }) {
  const reduce = useReducedMotion();
  const [broken, setBroken] = useState({});
  const selectionModules = modules.filter((m) => m.selectionTitle && m.selectionImage);

  return (
    <div className="w-full">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-2.5 text-sm text-[#dbe6f5] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
          >
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
                    onClick={() => onOpenModule?.(m.id)}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-[#00ffb4]/30 bg-[#00ffb4]/12 px-7 py-2.5 text-sm font-semibold text-[#00ffb4] transition hover:bg-[#00ffb4]/18 focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
                  >
                    {m.selectionCta} <span className="text-[#b7fff0]">→</span>
                  </button>
                </div>

                <div className="relative h-[150px] overflow-hidden rounded-2xl border border-[#1a2438] bg-[#0a0e17] shadow-[inset_0_0_38px_rgba(0,0,0,0.52)] sm:h-[170px] lg:h-[180px]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(0,255,180,0.12),transparent_60%)]" />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />

                  {!broken[m.id] ? (
                    <img
                      src={m.selectionImage}
                      alt=""
                      className="absolute inset-0 h-full w-full object-contain p-5"
                      onError={() => setBroken((prev) => ({ ...prev, [m.id]: true }))}
                    />
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

function PracticalTestsPage({ tests, onOpen }) {
  const motionPreset = useCardMotion();
  return (
    <div className="grid grid-cols-1 gap-6 overflow-hidden lg:grid-cols-2">
      {tests.map((t) => (
        <motion.div
          key={t.id}
          {...motionPreset}
          className="flex w-full flex-col items-start justify-between rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-10 text-left shadow-[0_30px_90px_rgba(0,0,0,0.42)]"
        >
          <div className="flex items-start justify-between gap-4 w-full">
            <div>
              <div className="text-lg font-bold tracking-tight text-[#e8ecf4]">{t.title}</div>
              <div className="mt-1 text-sm text-[#7a8ba8]">{t.desc}</div>
            </div>

            <span
              className={[
                "rounded-full border px-3 py-1.5 text-[11px]",
                t.status === "Ready"
                  ? "border-[#00ffb4]/30 bg-[#00ffb4]/12 text-[#00ffb4]"
                  : "border-[#1a2438] bg-white/[0.03] text-[#7a8ba8]",
              ].join(" ")}
            >
              {t.status}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onOpen?.(t.id)}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-[#1a2438] bg-white/[0.03] px-5 py-3 text-[13px] font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06]"
          >
            Open test <span className="text-[#b7fff0]">→</span>
          </button>
        </motion.div>
      ))}
    </div>
  );
}

function ProfilePage({ user, stats, achievements }) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
        <div className="p-8">
          <div className="text-lg font-bold tracking-tight text-[#e8ecf4]">My Profile</div>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 text-lg font-bold text-[#00ffb4]">
              {(user.name || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-base font-semibold text-white">{user.name}</div>
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
              <button
                type="button"
                onClick={() => console.log("Edit profile")}
                className="rounded-xl border border-[#1a2438] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
              >
                Edit profile
              </button>
              <button
                type="button"
                onClick={() => console.log("View achievements")}
                className="rounded-xl border border-[#1a2438] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
              >
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
              <AchievementRow
                key={a.id}
                icon={a.icon}
                title={a.title}
                subtitle={a.subtitle}
                onClick={() => console.log(a.id)}
              />
            ))}
          </div>
        </div>
      </div>
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
        <span
          className={[
            "flex h-10 w-10 items-center justify-center rounded-2xl border",
            isActive ? "border-[#00ffb4]/25 bg-[#00ffb4]/10" : "border-[#1a2438] bg-[#0d1220]",
          ].join(" ")}
        >
          <Icon kind={icon} active={isActive} />
        </span>
        <span className={isActive ? "text-sm font-semibold text-white" : "text-sm font-semibold text-[#c8d4e6]"}>{label}</span>
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
          <div className="mt-3 text-[34px] font-extrabold leading-[1.04] tracking-tight text-[#e8ecf4] lg:text-[38px]">
            {headline}
          </div>
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

        <div className="mt-6 grid grid-cols-1 items-center gap-6 md:grid-cols-[220px_1fr]">
          <DonutAnimated value={overall} label="Overall Progress" />

          <div className="relative overflow-hidden rounded-2xl border border-[#1a2438] bg-white/[0.03] p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_40%,rgba(0,255,180,0.10),transparent_55%)]" />
            <div className="relative">
              <div className="flex items-center gap-2 text-sm text-[#9fb0c9]">
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

        <div className="scrollArea mt-6 min-h-0 overflow-auto pr-1 space-y-4">
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
              {completedStyle ? (
                <span className="rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 px-2 py-0.5 text-[11px] text-[#00ffb4]">
                  ✓ Done
                </span>
              ) : null}
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
      <div
        className="h-full bg-[#00ffb4] transition-[width] duration-[900ms] ease-out"
        style={{ width: ready ? `${percent}%` : "0%" }}
      />
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
            <AchievementRow
              key={a.id}
              icon={a.icon}
              title={a.title}
              subtitle={a.subtitle}
              onClick={() => onClick?.(a.id)}
            />
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
    <motion.button
      type="button"
      onClick={onClick}
      {...motionPreset}
      className="flex w-full items-center gap-4 rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4 text-left focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
      aria-label={`Open achievement ${title}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00ffb4]/18 bg-[#00ffb4]/10">
        <Icon kind={icon} active />
      </div>
      <div className="flex-1 leading-tight">
        <div className="font-semibold text-white">{title}</div>
        <div className="text-[12px] text-[#7a8ba8]">{subtitle}</div>
      </div>
      <div className="text-[#7a8ba8]">›</div>
    </motion.button>
  );
}

function RecentActivityFill({ items, onClick }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_30px_90px_rgba(0,0,0,0.42)] h-full min-h-0">
      <div className="flex h-full min-h-0 flex-col p-7">
        <div className="text-lg font-bold tracking-tight text-[#e8ecf4]">Recent Activity</div>
        <div className="scrollArea mt-5 min-h-0 overflow-auto pr-1 space-y-3">
          {items.map((x) => (
            <ActivityRow key={x.id} title={x.t} desc={x.d} onClick={() => onClick?.(x.id)} />
          ))}
        </div>
        <button
          type="button"
          className="mt-5 w-full rounded-2xl border border-[#1a2438] bg-white/[0.03] py-3 text-[13px] font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
          onClick={() => console.log("View all activity")}
        >
          View All Activity
        </button>
      </div>
    </div>
  );
}

function ActivityRow({ title, desc, onClick }) {
  const motionPreset = useCardMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      {...motionPreset}
      className="w-full rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4 text-left focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
      aria-label={`Open activity ${title}`}
    >
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-[12px] text-[#7a8ba8]">{desc}</div>
    </motion.button>
  );
}

function DonutAnimated({ value = 72, label = "Overall Progress" }) {
  const size = 156;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;

  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative mx-auto h-[156px] w-[156px]">
      <div className="absolute inset-0 rounded-full border border-[#1a2438] bg-white/[0.03]" />
      <svg width={size} height={size} className="absolute inset-0" viewBox={`0 0 ${size} ${size}`} aria-label={`${label}: ${value}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="transparent" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="transparent"
          stroke="rgba(0,255,180,1)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: ready ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, ease: "easeOut" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-4xl font-extrabold text-white">{value}%</div>
        <div className="mt-1 text-[11px] text-[#7a8ba8]">PC Building Course</div>
      </div>

      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[12px] text-[#7a8ba8]">{label}</div>
    </div>
  );
}

function StaggerList({ children }) {
  const reduce = useReducedMotion();
  const variants = {
    hidden: {},
    show: { transition: reduce ? {} : { staggerChildren: 0.06, delayChildren: 0.02 } },
  };
  const item = {
    hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 8 },
    show: reduce ? { opacity: 1 } : { opacity: 1, y: 0, transition: { duration: 0.18 } },
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
    <div className={["overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_30px_90px_rgba(0,0,0,0.42)]", className].join(" ")}>
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
    const rr = require("react-router-dom");
    return rr?.useNavigate ? rr.useNavigate() : null;
  } catch {
    return null;
  }
}

function Icon({ kind, active = false }) {
  const fill = active ? "bg-[#00ffb4]/70" : "bg-white/25";
  const soft = active ? "bg-[#00ffb4]/45" : "bg-white/20";

  if (kind === "home")
    return (
      <div className={`relative h-5 w-5 rounded ${soft}`}>
        <div className={`absolute left-[6px] top-[7px] h-[7px] w-[9px] rounded ${fill}`} />
      </div>
    );
  if (kind === "modules")
    return (
      <div className={`relative h-4 w-5 overflow-hidden rounded ${soft}`}>
        <div className={`absolute left-0 top-0 h-full w-[3px] ${fill}`} />
      </div>
    );
  if (kind === "tests")
    return (
      <div className={`relative h-4 w-5 rounded ${soft}`}>
        <div className={`absolute left-1 top-1 h-[2px] w-3 rounded ${fill}`} />
        <div className={`absolute left-1 top-2.5 h-[2px] w-4 rounded ${fill}`} />
        <div className={`absolute left-1 top-4 h-[2px] w-2 rounded ${fill}`} />
      </div>
    );
  if (kind === "profile")
    return (
      <div className={`relative h-5 w-5 rounded-full ${soft}`}>
        <div className={`absolute left-1/2 top-[5px] h-2 w-2 -translate-x-1/2 rounded-full ${fill}`} />
        <div className={`absolute bottom-[5px] left-1/2 h-2 w-4 -translate-x-1/2 rounded-full ${soft}`} />
      </div>
    );
  if (kind === "help") return <div className={`h-5 w-5 rounded-full ${soft}`} />;
  if (kind === "support") return <div className={`h-5 w-5 rounded ${soft}`} />;
  if (kind === "trophy") return <div className={`h-5 w-5 rounded ${fill}`} />;
  if (kind === "badge") return <div className={`h-5 w-5 rounded-full ${fill}`} />;
  return <div className={`h-4 w-4 rounded ${soft}`} />;
}
