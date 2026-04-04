import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function Dashboard({ onLogout, onOpenModule, onOpenTest }) {
  // ✅ Use "Dashboard" (NOT "Home") so the main view actually renders
  const [section, setSection] = useState("Dashboard"); // Dashboard | Modules | Practical Tests | Profile

  const navigate = useOptionalNavigate();
  const go = (path) => {
    if (navigate) navigate(path);
    else console.log("Route to:", path);
  };

  // ✅ Centralized module opener: uses App.jsx state routing if provided
  const openModule = (id) => {
    if (onOpenModule) onOpenModule(id);
    else go(`/modules/${id}`);
  };

  // ✅ NEW: Centralized test opener: uses App.jsx state routing if provided
  const openTest = (id) => {
    if (onOpenTest) onOpenTest(id);
    else go(`/tests/${id}`);
  };

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

// ✅ Listen for Firebase auth state changes
const [firebaseUser, setFirebaseUser] = useState(null);
const [profile, setProfile] = useState(null);


  // ✅ Hard lock the WHOLE PAGE scrolling
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
  { id: "software-config", title: "Software Configuration Quiz(Windows & BIOS)", desc: "20 minutes", status: "Locked" },
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
    <div className="min-h-screen w-full bg-[#061E29] text-[#F3F4F4] font-sans antialiased overflow-hidden">
      <div className="relative w-full h-screen overflow-hidden">
        <div className="pointer-events-none absolute -top-44 -left-44 h-[720px] w-[720px] rounded-full bg-[#5F9598]/18 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-56 -right-52 h-[820px] w-[820px] rounded-full bg-[#1D546D]/26 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#061E29] via-[#061E29] to-[#0B2A3A]" />

        <div className="relative w-full h-full overflow-hidden">
          <div className="relative w-full h-full overflow-hidden rounded-none md:rounded-[30px] md:m-3 border border-white/10 shadow-[0_70px_180px_rgba(0,0,0,0.70)]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#061E29] via-[#0B2A3A] to-[#1D546D]/35" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_12%,rgba(95,149,152,0.16),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_22%,rgba(29,84,109,0.22),transparent_55%)]" />
            <div className="absolute inset-0 bg-black/10 ring-1 ring-white/5" />

            <div className="relative grid grid-cols-1 lg:grid-cols-[300px_1fr] h-full overflow-hidden">
              {/* SIDEBAR */}
              <aside className="border-r border-white/10 bg-black/20 backdrop-blur-xl h-full overflow-hidden">
                <div className="h-full flex flex-col p-6 overflow-hidden">
                  <div className="flex items-center gap-3 mb-6 ml-7">
                    <button
                      onClick={() => setSection("Dashboard")}
                      className="cursor-pointer flex items-center gap-3"
                    >
                      <img
                        src="/PNG/Articton.png"
                        alt="Articton Logo"
                        className="h-10 w-10 object-contain scale-500 hover:opacity-90 transition"
                      />
                      <span className="text-lg font-bold tracking-wide">Articton</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <SideItem label="Dashboard" active={section} onClick={() => setSection("Dashboard")} icon="home" />
                    <SideItem label="Modules" active={section} onClick={() => setSection("Modules")} icon="modules" />
                    <SideItem
                      label="Practice Tests"
                      active={section}
                      onClick={() => setSection("Practice Tests")}
                      icon="tests"
                    />
                    <SideItem label="Profile" active={section} onClick={() => setSection("Profile")} icon="profile" />
                  </div>

                  <div className="flex-1" />

                  <div className="pt-5 mt-5 border-t border-white/10 space-y-3">
                     <button
                      type="button"
                     className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 transition text-white/70 focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35"
                          aria-label="Open FAQs"
                      onClick={() => go("/faqs")}
                      >
                         <span className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                          <Icon kind="help" />
                            </span>
                     <span className="text-sm font-semibold">FAQs</span>
                           </button>

                        <button
                          type="button"
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 transition text-white/70 focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35"
                          aria-label="Contact Customer Service"
                          onClick={() => go("/support")}
                        >
                          <span className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <Icon kind="support" />
                          </span>
                          <span className="text-sm font-semibold">Customer Service</span>
                        </button>
                      </div>                 
                </div>
              </aside>

              {/* MAIN */}
              <main className="h-full overflow-hidden">
                <div className="h-full p-6 lg:p-8 grid grid-rows-[auto_1fr_auto] gap-4 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <h1 className="text-[38px] lg:text-[42px] font-extrabold tracking-tight">
                        {section === "Dashboard" ? "Dashboard" : section}
                      </h1>
                      <div className="mt-2">
                        <div className="text-[17px] font-semibold text-white/90">
                          Welcome back, {user.name.split(" ")[0]}!
                        </div>
                        <div className="text-[13.5px] text-white/50">Continue learning and track your progress.</div>
                      </div>
                    </div>

                    <div className="relative z-50">
                    <details className="group">
                      <summary className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition cursor-pointer list-none">
                        <div className="h-9 w-9 rounded-full bg-[#5F9598]/25 border border-[#5F9598]/25" aria-hidden="true" />
                        <div className="leading-tight">
                          <div className="text-sm font-semibold">{user.name}</div>
                          <div className="text-[11px] text-white/45">{user.email}</div>
                        </div>
                        <div className="text-white/55 text-sm group-open:rotate-180 transform transition" aria-hidden="true">
                          ▾
                        </div>
                      </summary>

                      <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-black/80 backdrop-blur-lg border border-white/10 p-2">
                        <button
                          onClick={() => go("/settings")}
                          className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 rounded-xl"
                        >
                          Settings
                        </button>
                        <button
                          onClick={onLogout}
                          className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 rounded-xl"
                        >
                          Logout
                        </button>
                      </div>
                    </details>
                  </div>

                  </div>

                  {/* ✅ ONLY this content area scrolls, scrollbar is hidden via CSS class */}
                  <div className="min-h-0 overflow-auto scrollArea">
                    {isLoading ? (
                      <div className="h-full min-h-0 grid grid-cols-1 xl:grid-cols-[1.6fr_0.9fr] gap-6">
                        <SkeletonCard className="h-full" />
                        <div className="h-full min-h-0 flex flex-col gap-6">
                          <SkeletonCard className="h-[220px]" />
                          <SkeletonCard className="flex-1 min-h-0" />
                        </div>
                      </div>
                    ) : error ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="max-w-lg w-full rounded-[28px] border border-white/10 bg-black/18 backdrop-blur-xl shadow-[0_30px_90px_rgba(0,0,0,0.42)] p-8">
                          <div className="text-xl font-bold">Something went wrong</div>
                          <div className="mt-2 text-white/60 text-sm">{error}</div>
                          <div className="mt-6 flex gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setError("");
                                setIsLoading(true);
                                setTimeout(() => setIsLoading(false), 450);
                              }}
                              className="px-5 py-2.5 rounded-xl bg-[#5F9598]/22 border border-[#5F9598]/25 hover:bg-[#5F9598]/30 transition text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35"
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              onClick={() => go("/support")}
                              className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35"
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

                  {/* Footer */}
                  <div className="flex justify-end">
                    
                    
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


/* ===================== DASHBOARD OVERVIEW ===================== */
function HomeOverview({ openModule, openTest, setSection, overall, modules, nextUp, user, stats, achievements, activity }) {
  return (
    <div className="h-full min-h-0 overflow-hidden grid grid-rows-[auto_auto_1fr] gap-6">
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Streak" value={`${user.streakDays} days`} hint="Keep it going" />
        <StatCard title="This week" value={`${user.minutesThisWeek} min`} hint="Time spent learning" />
        <StatCard title="Completed" value={`${stats.completed}`} hint="Modules finished" />
        <StatCard title="Overall" value={`${overall}%`} hint="Across all modules" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_0.9fr] gap-6 min-h-0">
        <ProgressCardFillHeight overall={overall} modules={modules} onModuleClick={(id) => openModule(id)} />
        <RightColumnFill achievements={achievements} activity={activity} />
      </div>
    </div>
  );
}

/* ===================== MODULES SELECTION ===================== */
function ModulesSelection({ modules, onBack, onOpenModule }) {
  const reduce = useReducedMotion();
  const [broken, setBroken] = useState({});
  const selectionModules = modules.filter((m) => m.selectionTitle && m.selectionImage);

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-5">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm text-[#F3F4F4]/85 focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35"
          >
            Back to Menu
          </button>

          <span className="hidden sm:inline-flex text-[12px] text-white/55 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            Select a module to begin
          </span>
        </div>

        <div className="space-y-4">
          {selectionModules.map((m) => (
            <motion.div
              key={m.id}
              whileHover={reduce ? {} : { y: -3 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 22 }}
              className="rounded-[26px] border border-white/10 bg-black/18 backdrop-blur-xl shadow-[0_26px_80px_rgba(0,0,0,0.42)] overflow-hidden"
            >
              <div className="p-6 lg:p-7 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 items-center">
                <div className="min-w-0">
                  <div className="text-[18px] lg:text-[20px] font-extrabold tracking-tight">{m.selectionTitle}</div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[12px] text-white/60">{m.selectionModuleNo}</span>
                    <span className="h-1 w-1 rounded-full bg-white/20" aria-hidden="true" />
                    <span className="text-[12px] text-white/45">{m.selectionProgressText}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenModule?.(m.id)}
                    className="mt-4 inline-flex items-center gap-2 px-7 py-2.5 rounded-2xl bg-[#5F9598]/22 border border-[#5F9598]/25 hover:bg-[#5F9598]/30 transition text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35"
                  >
                    {m.selectionCta} <span className="text-white/70">→</span>
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 relative overflow-hidden shadow-[inset_0_0_38px_rgba(0,0,0,0.52)] h-[150px] sm:h-[170px] lg:h-[180px]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(95,149,152,0.16),transparent_60%)]" />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />

                  {!broken[m.id] ? (
                    <img
                      src={m.selectionImage}
                      alt=""
                      className="absolute inset-0 w-full h-full object-contain p-5"
                      onError={() => setBroken((prev) => ({ ...prev, [m.id]: true }))}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-[12px] text-white/55 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
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

/* ===================== PRACTICAL TESTS PAGE ===================== */
function PracticalTestsPage({ tests, onOpen }) {
  const motionPreset = useCardMotion();
  return (
   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
  {tests.map((t) => (
    <motion.div
      key={t.id}
      {...motionPreset}
      className="text-left w-full rounded-[28px] border border-white/10 bg-black/18 backdrop-blur-xl shadow-[0_30px_90px_rgba(0,0,0,0.42)] p-10 flex flex-col items-start justify-between"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-bold tracking-tight">{t.title}</div>
          <div className="mt-1 text-sm text-white/55">{t.desc}</div>
        </div>

        <span
          className={[
            "text-[11px] px-3 py-1.5 rounded-full border",
            t.status === "Ready"
              ? "bg-[#5F9598]/18 border-[#5F9598]/28 text-white/80"
              : "bg-white/5 border-white/10 text-white/55",
          ].join(" ")}
        >
          {t.status}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onOpen?.(t.id)}
        className="mt-5 inline-flex items-center gap-2 rounded-2xl font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition px-5 py-3 text-[13px]"
      >
        Open test <span className="text-white/70">→</span>
      </button>
    </motion.div>
  ))}
</div>

  );
}

/* ===================== PROFILE PAGE ===================== */
function ProfilePage({ user, stats, achievements }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
      <div className="rounded-[28px] border border-white/10 bg-black/18 backdrop-blur-xl shadow-[0_30px_90px_rgba(0,0,0,0.42)] overflow-hidden">
        <div className="p-8">
          <div className="text-lg font-bold tracking-tight">My Profile</div>

          <div className="mt-6 flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-[#5F9598]/25 border border-[#5F9598]/25" aria-hidden="true" />
            <div>
              <div className="text-base font-semibold">{user.name}</div>
              <div className="text-sm text-white/55">{user.email}</div>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MiniStat title="Streak" value={`${user.streakDays} days`} />
            <MiniStat title="This week" value={`${user.minutesThisWeek} min`} />
            <MiniStat title="Completed" value={`${stats.completed}`} />
          </div>

          <div className="mt-7 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold">Quick actions</div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => console.log("Edit profile")}
                className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35"
              >
                Edit profile
              </button>
              <button
                type="button"
                onClick={() => console.log("View achievements")}
                className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35"
              >
                View achievements
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-black/18 backdrop-blur-xl shadow-[0_30px_90px_rgba(0,0,0,0.42)] overflow-hidden">
        <div className="p-7">
          <div className="text-lg font-bold tracking-tight">Badges</div>
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

/* ===================== RIGHT COLUMN (ONLY ONCE) ===================== */
function RightColumnFill({ achievements, activity }) {
  return (
    <div className="h-full min-h-0 flex flex-col gap-6">
      <AchievementsCardCompact achievements={achievements} onClick={(id) => console.log(id)} />
      <RecentActivityFill items={activity} onClick={(id) => console.log(id)} />
    </div>
  );
}

/* ===================== SIDEBAR ITEM ===================== */
function SideItem({ label, active, onClick, icon }) {
  const isActive = active === label;
  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition text-left",
        "focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35",
        isActive
          ? "bg-[#5F9598]/18 border-[#5F9598]/28 shadow-[0_18px_50px_rgba(95,149,152,0.10)]"
          : "bg-transparent border-transparent hover:bg-white/5 hover:border-white/10",
      ].join(" ")}
      aria-current={isActive ? "page" : undefined}
    >
      <span
        className={[
          "h-10 w-10 rounded-2xl flex items-center justify-center border",
          isActive ? "bg-[#5F9598]/18 border-[#5F9598]/25" : "bg-white/5 border-white/10",
        ].join(" ")}
        aria-hidden="true"
      >
        <Icon kind={icon} />
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

/* ===================== Card Motion Preset ===================== */
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

/* ===================== TOP CARD (HERO) ===================== */
function TopCardHero({ title, headline, sub, meta, button, imageSrc, onClick }) {
  const motionPreset = useCardMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      {...motionPreset}
      className="text-left w-full rounded-[30px] border border-white/10 bg-black/18 backdrop-blur-xl shadow-[0_34px_110px_rgba(0,0,0,0.46)] overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35 relative"
      aria-label={`${title}: ${headline}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.07),transparent_35%)]" />

      <div className="p-9 lg:p-10 flex items-center gap-8 min-h-[250px] lg:min-h-[285px]">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white/85">{title}</div>
          <div className="mt-3 font-extrabold leading-[1.04] tracking-tight text-[34px] lg:text-[38px]">
            {headline}
          </div>
          <div className="mt-1 text-[14px] lg:text-[15px] text-white/45">{sub}</div>
          <div className="mt-5 text-[12.5px] text-white/45">{meta}</div>

          <div className="mt-6 inline-flex items-center gap-2 rounded-2xl font-semibold bg-[#5F9598]/22 border border-[#5F9598]/25 hover:bg-[#5F9598]/30 transition px-12 py-4 text-[14px] lg:text-[15px]">
            {button}
            <span className="text-white/70" aria-hidden="true">
              →
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 relative overflow-hidden shadow-[inset_0_0_46px_rgba(0,0,0,0.50)] w-[320px] sm:w-[360px] lg:w-[420px] h-[200px] sm:h-[220px] lg:h-[240px] flex-shrink-0">
          <img src={imageSrc} alt="" className="absolute inset-0 w-full h-full object-contain p-6 lg:p-7" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_45%_35%,rgba(95,149,152,0.22),transparent_62%)]" />
        </div>
      </div>
    </motion.button>
  );
}

/* ===================== PROGRESS ===================== */
function ProgressCardFillHeight({ overall, modules, onModuleClick }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-black/18 backdrop-blur-xl shadow-[0_30px_90px_rgba(0,0,0,0.42)] overflow-hidden h-full min-h-0">
      <div className="p-8 h-full min-h-0 flex flex-col">
        <div className="text-lg font-bold tracking-tight">My Progress</div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-center">
          <DonutAnimated value={overall} label="Overall Progress" />

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_40%,rgba(95,149,152,0.12),transparent_55%)]" />
            <div className="relative">
              <div className="text-sm text-white/60 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#5F9598]" aria-hidden="true" />
                Overall Progress
              </div>

              <div className="mt-4">
                <div className="font-semibold">PC Building Course</div>
                <div className="text-[12px] text-white/45">All modules combined</div>
                <AnimatedBar percent={overall} />
                <div className="mt-2 text-[11px] text-white/45">Keep going — consistency beats speed.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 min-h-0 overflow-auto pr-1 space-y-4 scrollArea">
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
        "text-left w-full rounded-2xl border p-5 transition focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35 relative overflow-hidden",
        completedStyle ? "bg-[#5F9598]/12 border-[#5F9598]/22" : "bg-white/5 border-white/10",
      ].join(" ")}
      aria-label={`${title} — ${cta}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.05),transparent_35%)]" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              {title}
              {completedStyle ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#5F9598]/18 border border-[#5F9598]/25 text-white/80">
                  ✓ Done
                </span>
              ) : null}
            </div>
            <div className="text-[12px] text-white/55 mt-1">{subtitle}</div>
          </div>

          <div className="text-right">
            <div className="text-sm font-bold text-white/80">{progress}%</div>
            <div className="mt-1 text-[11px] text-white/55">{cta}</div>
          </div>
        </div>

        <AnimatedBar percent={progress} />
        <div className="mt-2 text-[11px] text-white/45">{meta}</div>
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
    <div className="mt-4 rounded-full bg-white/10 overflow-hidden h-2" aria-label={`Progress bar ${percent}%`}>
      <div
        className="h-full bg-[#5F9598] transition-[width] duration-[900ms] ease-out"
        style={{ width: ready ? `${percent}%` : "0%" }}
      />
    </div>
  );
}

/* ===================== ACHIEVEMENTS ===================== */
function AchievementsCardCompact({ achievements, onClick }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-black/18 backdrop-blur-xl shadow-[0_30px_90px_rgba(0,0,0,0.42)] overflow-hidden">
      <div className="p-7">
        <div className="text-lg font-bold tracking-tight">Achievements</div>
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
          <span className="inline-flex text-[11px] text-white/55 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
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
      className="text-left w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35"
      aria-label={`Open achievement ${title}`}
    >
      <div className="h-12 w-12 rounded-2xl bg-[#5F9598]/16 border border-[#5F9598]/18 flex items-center justify-center" aria-hidden="true">
        <Icon kind={icon} />
      </div>
      <div className="flex-1 leading-tight">
        <div className="font-semibold">{title}</div>
        <div className="text-[12px] text-white/45">{subtitle}</div>
      </div>
      <div className="text-white/50" aria-hidden="true">
        ›
      </div>
    </motion.button>
  );
}

/* ===================== RECENT ACTIVITY ===================== */
function RecentActivityFill({ items, onClick }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-black/18 backdrop-blur-xl shadow-[0_30px_90px_rgba(0,0,0,0.42)] overflow-hidden h-full min-h-0">
      <div className="p-7 h-full min-h-0 flex flex-col">
        <div className="text-lg font-bold tracking-tight">Recent Activity</div>
        <div className="mt-5 min-h-0 overflow-auto pr-1 space-y-3 scrollArea">
          {items.map((x) => (
            <ActivityRow key={x.id} title={x.t} desc={x.d} onClick={() => onClick?.(x.id)} />
          ))}
        </div>
        <button
          type="button"
          className="mt-5 w-full rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition py-3 text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35"
          aria-label="View all activity"
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
      className="text-left w-full rounded-2xl border border-white/10 bg-white/5 p-4 focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35"
      aria-label={`Open activity ${title}`}
    >
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-[12px] text-white/45 mt-1">{desc}</div>
    </motion.button>
  );
}

/* ===================== Donut (Animated) ===================== */
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
    <div className="relative h-[156px] w-[156px] mx-auto">
      <div className="absolute inset-0 rounded-full bg-white/5 border border-white/10" />
      <svg
        width={size}
        height={size}
        className="absolute inset-0"
        viewBox={`0 0 ${size} ${size}`}
        aria-label={`${label}: ${value}%`}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="transparent" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="transparent"
          stroke="rgba(95,149,152,1)"
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
        <div className="text-4xl font-extrabold">{value}%</div>
        <div className="text-[11px] text-white/45 mt-1">PC Building Course</div>
      </div>

      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[12px] text-white/55">{label}</div>
    </div>
  );
}

/* ===================== Stagger List ===================== */
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

/* ===================== Stats ===================== */
function StatCard({ title, value, hint }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/18 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.30)] p-5">
      <div className="text-[12px] text-white/55">{title}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight">{value}</div>
      <div className="mt-1 text-[12px] text-white/45">{hint}</div>
    </div>
  );
}

function MiniStat({ title, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-[12px] text-white/55">{title}</div>
      <div className="mt-2 text-lg font-extrabold">{value}</div>
    </div>
  );
}

/* ===================== Skeleton ===================== */
function SkeletonCard({ className = "" }) {
  return (
    <div
      className={[
        "rounded-[28px] border border-white/10 bg-black/18 backdrop-blur-xl shadow-[0_30px_90px_rgba(0,0,0,0.42)] overflow-hidden",
        className,
      ].join(" ")}
    >
      <div className="p-7 space-y-4">
        <div className="h-6 w-40 rounded bg-white/10 animate-pulse" />
        <div className="h-4 w-64 rounded bg-white/10 animate-pulse" />
        <div className="h-4 w-52 rounded bg-white/10 animate-pulse" />
        <div className="h-24 w-full rounded-2xl bg-white/10 animate-pulse" />
        <div className="h-10 w-44 rounded-2xl bg-white/10 animate-pulse" />
      </div>
    </div>
  );
}

/* ===================== Optional React Router Hook ===================== */
function useOptionalNavigate() {
  try {
    // eslint-disable-next-line global-require
    const rr = require("react-router-dom");
    return rr?.useNavigate ? rr.useNavigate() : null;
  } catch {
    return null;
  }
}

/* ===================== ICONS ===================== */
function Icon({ kind }) {
  if (kind === "home")
    return (
      <div className="h-5 w-5 rounded bg-white/20 relative">
        <div className="absolute left-[6px] top-[7px] h-[7px] w-[9px] rounded bg-white/25" />
      </div>
    );
  if (kind === "modules")
    return (
      <div className="h-4 w-5 rounded bg-white/20 relative overflow-hidden">
        <div className="absolute left-0 top-0 h-full w-[3px] bg-white/25" />
      </div>
    );
  if (kind === "tests")
    return (
      <div className="h-4 w-5 rounded bg-white/20 relative">
        <div className="absolute left-1 top-1 h-[2px] w-3 rounded bg-white/25" />
        <div className="absolute left-1 top-2.5 h-[2px] w-4 rounded bg-white/25" />
        <div className="absolute left-1 top-4 h-[2px] w-2 rounded bg-white/25" />
      </div>
    );
  if (kind === "profile")
    return (
      <div className="h-5 w-5 rounded-full bg-white/20 relative">
        <div className="absolute left-1/2 top-[5px] -translate-x-1/2 h-2 w-2 rounded-full bg-white/25" />
        <div className="absolute left-1/2 bottom-[5px] -translate-x-1/2 h-2 w-4 rounded-full bg-white/20" />
      </div>
    );
  if (kind === "settings") return <div className="h-5 w-5 rounded bg-white/20" />;
  if (kind === "trophy") return <div className="h-5 w-5 rounded bg-white/25" />;
  if (kind === "badge") return <div className="h-5 w-5 rounded-full bg-white/25" />;
  return <div className="h-4 w-4 rounded bg-white/20" />;
}
