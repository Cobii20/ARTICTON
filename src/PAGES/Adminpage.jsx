import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  BarChart3,
  ChevronDown,
  FileText,
  LogOut,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { fetchMobileScoreDocs, mergeMobileScoresIntoProfile } from "../utils/mobileScores";
import ModuleContentWorkspace from "../Components/ModuleContentWorkspace";
import AccountProfileModal from "../Components/AccountProfileModal";

const QUIZ_KEYS = [
  { key: "module1", label: "Module 1" },
  { key: "module2", label: "Module 2" },
  { key: "module3", label: "Module 3" },
  { key: "module4", label: "Module 4" },
];

const PRACTICAL_KEYS = [
  { key: "fullAssembly", label: "Assembly" },
  { key: "fullDisassembly", label: "Disassembly" },
];

const SCORE_ITEMS = [
  { key: "module1Content", label: "M1 Content", field: "module1Content" },
  { key: "module1Pre", label: "M1 Pre", field: "module1Pre" },
  { key: "module1Post", label: "M1 Post", field: "module1Post" },
  { key: "module2Content", label: "M2 Content", field: "module2Content" },
  { key: "module2Pre", label: "M2 Pre", field: "module2Pre" },
  { key: "module2Post", label: "M2 Post", field: "module2Post" },
  { key: "module3Content", label: "M3 Content", field: "module3Content" },
  { key: "module3Pre", label: "M3 Pre", field: "module3Pre" },
  { key: "module3Post", label: "M3 Post", field: "module3Post" },
  { key: "module4Content", label: "M4 Content", field: "module4Content" },
  { key: "module4Pre", label: "M4 Pre", field: "module4Pre" },
  { key: "module4Post", label: "M4 Post", field: "module4Post" },
  { key: "mobileExam1", label: "Mobile Exam 1", field: "mobileExam1" },
  { key: "mobileExam2", label: "Mobile Exam 2", field: "mobileExam2" },
  { key: "amdDisassembly", label: "AMD Disasm", field: "amdDisassembly" },
  { key: "intelDisassembly", label: "Intel Disasm", field: "intelDisassembly" },
  { key: "amdAssembly", label: "AMD Asm", field: "amdAssembly" },
  { key: "intelAssembly", label: "Intel Asm", field: "intelAssembly" },
];

const PASSING_PERCENT = 60;

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function average(values) {
  const cleanValues = values.filter((value) => Number.isFinite(value));
  if (!cleanValues.length) return 0;

  return Math.round(
    cleanValues.reduce((total, value) => total + value, 0) / cleanValues.length
  );
}

function getFullName(data) {
  const firstName = data.firstName || "";
  const lastName = data.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();

  return (
    fullName ||
    data.name ||
    data.displayName ||
    data.fullName ||
    "No Name"
  );
}

function getProfilePhotoUrl(data) {
  return (
    data.avatarUrl ||
    data.photoURL ||
    data.profilePhotoUrl ||
    data.profilePictureUrl ||
    data.imageUrl ||
    ""
  );
}

function formatCreatedAt(value) {
  if (!value) return "Not set";

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : typeof value?.seconds === "number"
      ? new Date(value.seconds * 1000)
      : new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getQuizStatus(quizProgress, moduleKey) {
  const progress = quizProgress?.[moduleKey] || null;

  if (!progress) {
    return {
      type: "quiz",
      exists: false,
      completed: false,
      passed: false,
      score: null,
      total: null,
      scorePercent: null,
      completionPercent: 0,
      status: "Not started",
    };
  }

  const completed = !!progress.completed || !!progress.finished;
  const score = progress.score ?? null;
  const total = progress.total ?? null;

  const calculatedPercent =
    Number.isFinite(Number(score)) && Number.isFinite(Number(total)) && Number(total) > 0
      ? Math.round((Number(score) / Number(total)) * 100)
      : null;

  const scorePercent =
    clampPercent(progress.scorePercent ?? progress.percent) ??
    clampPercent(calculatedPercent);

  const passed =
    progress.passed === true ||
    (completed && scorePercent !== null && scorePercent >= PASSING_PERCENT);

  return {
    type: "quiz",
    exists: true,
    completed,
    passed,
    score,
    total,
    scorePercent,
    completionPercent: completed ? 100 : 0,
    status: completed ? (passed ? "Passed" : "Completed") : "In progress",
    updatedAt: progress.updatedAt ?? null,
    raw: progress,
  };
}

function getPracticalStatus(practicalProgress, practicalKey) {
  const progress = practicalProgress?.[practicalKey] || null;

  if (!progress) {
    return {
      type: "practical",
      exists: false,
      completed: false,
      passed: false,
      scorePercent: null,
      progressPercent: 0,
      completionPercent: 0,
      deductionPercent: 0,
      mistakes: 0,
      status: "Not started",
    };
  }

  const completed = !!progress.completed;
  const progressPercent =
    clampPercent(progress.progressPercent) ??
    (completed ? 100 : clampPercent(progress.percent) ?? 0);

  const scorePercent =
    clampPercent(progress.scorePercent ?? progress.percent) ??
    progressPercent;

  const mistakes = Number(progress.mistakes || 0);
  const deductionPercent =
    clampPercent(progress.deductionPercent) ??
    clampPercent(mistakes * Number(progress.wrongClickDeduction || 5)) ??
    0;

  const passed =
    progress.passed === true ||
    (completed && scorePercent !== null && scorePercent >= PASSING_PERCENT);

  return {
    type: "practical",
    exists: true,
    completed,
    passed,
    scorePercent,
    progressPercent,
    completionPercent: progressPercent,
    deductionPercent,
    mistakes,
    status: completed ? (passed ? "Passed" : "Completed") : "In progress",
    updatedAt: progress.updatedAt ?? null,
    raw: progress,
  };
}

function getScoreStatus(progress, passingPercent = PASSING_PERCENT) {
  if (!progress) {
    return {
      exists: false,
      completed: false,
      passed: false,
      scorePercent: null,
      completionPercent: 0,
      status: "Not started",
    };
  }

  const score = progress.score ?? progress.latestScore ?? progress.finalScore ?? null;
  const total = progress.total ?? progress.latestTotal ?? progress.maxScore ?? 100;
  const calculatedPercent =
    Number.isFinite(Number(score)) && Number.isFinite(Number(total)) && Number(total) > 0
      ? Math.round((Number(score) / Number(total)) * 100)
      : null;
  const scorePercent =
    clampPercent(progress.scorePercent ?? progress.percent ?? progress.percentage) ??
    clampPercent(calculatedPercent);
  const completed =
    !!progress.completed ||
    !!progress.finished ||
    !!progress.completedAt ||
    !!progress.timestamp ||
    scorePercent !== null;
  const passed =
    progress.passed === true ||
    (completed && scorePercent !== null && scorePercent >= passingPercent);

  return {
    exists: true,
    completed,
    passed,
    scorePercent,
    completionPercent: completed ? 100 : 0,
    status: completed ? (passed ? "Passed" : "Completed") : "In progress",
    raw: progress,
  };
}

function buildStudentRecord(docSnap, mobileScoreDocs = []) {
  const data = mergeMobileScoresIntoProfile(docSnap.data(), mobileScoreDocs);

  const quizProgress = data.quizProgress || {};
  const practicalProgress = data.practicalProgress || {};
  const practicalTests = data.practicalTests || {};
  const mobileModuleScores = data.mobileModuleScores || {};
  const mobilePracticeScores = data.mobilePracticeScores || {};

  const quiz1 = getQuizStatus(quizProgress, "module1");
  const quiz2 = getQuizStatus(quizProgress, "module2");
  const quiz3 = getQuizStatus(quizProgress, "module3");
  const quiz4 = getQuizStatus(quizProgress, "module4");
  const assembly = getPracticalStatus(practicalProgress, "fullAssembly");
  const disassembly = getPracticalStatus(practicalProgress, "fullDisassembly");
  const module1Post = getScoreStatus(mobileModuleScores.module1Post);
  const module1Pre = getScoreStatus(mobileModuleScores.module1Pre);
  const module1Content = getScoreStatus(mobileModuleScores.module1Content);
  const module2Post = getScoreStatus(mobileModuleScores.module2Post);
  const module2Pre = getScoreStatus(mobileModuleScores.module2Pre);
  const module2Content = getScoreStatus(mobileModuleScores.module2Content);
  const module3Post = getScoreStatus(mobileModuleScores.module3Post);
  const module3Pre = getScoreStatus(mobileModuleScores.module3Pre);
  const module3Content = getScoreStatus(mobileModuleScores.module3Content);
  const module4Post = getScoreStatus(mobileModuleScores.module4Post);
  const module4Pre = getScoreStatus(mobileModuleScores.module4Pre);
  const module4Content = getScoreStatus(mobileModuleScores.module4Content);
  const mobileExam1 = getScoreStatus(mobilePracticeScores.practiceExam1);
  const mobileExam2 = getScoreStatus(mobilePracticeScores.practiceExam2);
  const amdDisassembly = getScoreStatus(practicalTests.amdDisassembly, 75);
  const intelDisassembly = getScoreStatus(practicalTests.intelDisassembly, 75);
  const amdAssembly = getScoreStatus(practicalTests.amdAssembly, 75);
  const intelAssembly = getScoreStatus(practicalTests.intelAssembly, 75);

  const resultItems = [
    module1Content,
    module1Pre,
    module1Post.exists ? module1Post : quiz1,
    module2Content,
    module2Pre,
    module2Post.exists ? module2Post : quiz2,
    module3Content,
    module3Pre,
    module3Post.exists ? module3Post : quiz3,
    module4Content,
    module4Pre,
    module4Post.exists ? module4Post : quiz4,
    mobileExam1,
    mobileExam2,
    amdDisassembly,
    intelDisassembly,
    amdAssembly,
    intelAssembly,
  ];

  const overallProgress = average(
    resultItems.map((item) => item.completionPercent ?? 0)
  );

  const averageScore = average(
    resultItems
      .map((item) => item.scorePercent)
      .filter((value) => value !== null && value !== undefined)
  );

  const completedCount = resultItems.filter((item) => item.completed).length;
  const passedCount = resultItems.filter((item) => item.passed).length;

  const firstName = data.firstName || "";
  const lastName = data.lastName || "";

  return {
    id: docSnap.id,
    uid: data.uid || docSnap.id,
    firstName,
    lastName,
    name: getFullName(data),
    avatarUrl: getProfilePhotoUrl(data),
    email: data.email || "No email",
    contactNumber:
      data.contactNumber ||
      data.phoneNumber ||
      data.contact ||
      data.mobileNumber ||
      "",
    createdAt: data.createdAt || data.created_at || data.createdOn || data.createdTime || null,
    createdAtLabel: formatCreatedAt(
      data.createdAt || data.created_at || data.createdOn || data.createdTime
    ),
    studentId: data.studentId || data.studentID || data.schoolId || "",
    section: data.section || data.classSection || "",
    role: data.role || "student",

    quizProgress,
    practicalProgress,
    quiz1,
    quiz2,
    quiz3,
    quiz4,
    assembly,
    disassembly,
    module1Post,
    module1Pre,
    module1Content,
    module2Post,
    module2Pre,
    module2Content,
    module3Post,
    module3Pre,
    module3Content,
    module4Post,
    module4Pre,
    module4Content,
    mobileExam1,
    mobileExam2,
    amdDisassembly,
    intelDisassembly,
    amdAssembly,
    intelAssembly,

    progress: overallProgress,
    averageScore,
    completedCount,
    passedCount,
    totalActivities: resultItems.length,
  };
}

function MetricCard({ label, value, subtext }) {
  return (
    <div className="rounded-[22px] border border-[#1a2438] bg-[#0d1220] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a8ba8]">{label}</p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-white">{value}</h2>
      {subtext ? <p className="mt-2 text-sm text-[#9fb0c9]">{subtext}</p> : null}
    </div>
  );
}

function StudentAvatar({ student, size = "md" }) {
  const dimension = size === "lg" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm";
  const fallback = (student?.name || student?.email || "S").charAt(0).toUpperCase();

  return (
    <div className={`${dimension} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 font-bold text-[#00ffb4]`}>
      {student?.avatarUrl ? (
        <img src={student.avatarUrl} alt={`${student.name || "Student"} profile`} className="h-full w-full object-cover" />
      ) : (
        fallback
      )}
    </div>
  );
}

function AdminNavButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
        active
          ? "border-[#00ffb4]/30 bg-[#00ffb4]/10 text-white shadow-[0_16px_40px_rgba(0,255,180,0.08)]"
          : "border-transparent text-[#c8d4e6] hover:border-[#1a2438] hover:bg-white/[0.04]",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-10 w-10 items-center justify-center rounded-2xl border",
          active
            ? "border-[#00ffb4]/25 bg-[#00ffb4]/10 text-[#00ffb4]"
            : "border-[#1a2438] bg-[#0d1220] text-[#7a8ba8]",
        ].join(" ")}
      >
        {React.createElement(Icon, { className: "h-5 w-5" })}
      </span>
      {label}
    </button>
  );
}

export default function AdminPage({ adminUser, onLogout }) {
  const [accounts, setAccounts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("accounts");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [adminProfile, setAdminProfile] = useState(adminUser || null);

  useEffect(() => {
    setAdminProfile(adminUser || null);
  }, [adminUser]);

  const adminName = useMemo(() => {
    if (!adminProfile) return "Admin";
    const first = adminProfile.firstName || "";
    const last = adminProfile.lastName || "";
    return `${first} ${last}`.trim() || adminProfile.displayName || "Admin";
  }, [adminProfile]);

  const adminEmail = adminProfile?.email || adminUser?.email || "admin@email.com";

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const querySnapshot = await getDocs(collection(db, "users"));
      const usersWithScores = await Promise.all(
        querySnapshot.docs.map(async (userDoc) => {
          const mobileScores = await fetchMobileScoreDocs(userDoc.id);
          return buildStudentRecord(userDoc, mobileScores);
        })
      );
      const users = usersWithScores
        .filter((user) => user.role === "student")
        .sort((a, b) => a.name.localeCompare(b.name));

      setAccounts(users);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(
        "Failed to load users. Check your Firebase rules and make sure admins can read the users collection."
      );
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (account) => {
    setEditingId(account.id);
    setEditFirstName(account.firstName || "");
    setEditLastName(account.lastName || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFirstName("");
    setEditLastName("");
  };

  const saveEdit = async (id) => {
    if (!editFirstName.trim() || !editLastName.trim()) {
      alert("First name and last name are required.");
      return;
    }

    try {
      setSavingId(id);

      await updateDoc(doc(db, "users", id), {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
      });

      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === id
            ? {
                ...acc,
                firstName: editFirstName.trim(),
                lastName: editLastName.trim(),
                name: `${editFirstName.trim()} ${editLastName.trim()}`,
              }
            : acc
        )
      );

      cancelEdit();
    } catch (err) {
      console.error("Error updating user:", err);
      alert("Failed to update user.");
    } finally {
      setSavingId(null);
    }
  };

  const removeUser = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to remove this student?"
    );

    if (!confirmed) return;

    try {
      setDeletingId(id);
      await deleteDoc(doc(db, "users", id));
      setAccounts((prev) => prev.filter((acc) => acc.id !== id));
    } catch (err) {
      console.error("Error deleting user:", err);
      alert("Failed to remove user.");
    } finally {
      setDeletingId(null);
    }
  };

  const analyticsData = useMemo(() => {
    const activeUsers = accounts.length;

    const completionRate = average(accounts.map((account) => account.progress));
    const examScore = average(accounts.map((account) => account.averageScore));

    const completionTrend = SCORE_ITEMS.map((item) => {
      if (!activeUsers) {
        return {
          ...item,
          completed: 0,
          total: 0,
          percent: 0,
        };
      }

      const completed = accounts.filter(
        (account) => account[item.field]?.completed
      ).length;

      return {
        ...item,
        completed,
        total: activeUsers,
        percent: Math.round((completed / activeUsers) * 100),
      };
    });

    const topUser =
      [...accounts].sort((a, b) => b.averageScore - a.averageScore)[0] || null;

    const totalPassed = accounts.reduce(
      (sum, account) => sum + account.passedCount,
      0
    );

    const totalActivities = accounts.reduce(
      (sum, account) => sum + account.totalActivities,
      0
    );

    const passRate = totalActivities
      ? Math.round((totalPassed / totalActivities) * 100)
      : 0;

    return {
      activeUsers,
      completionRate,
      examScore,
      completionTrend,
      passRate,
      userOverview: topUser,
    };
  }, [accounts]);

  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e8ecf4]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(0,255,180,0.08),transparent_34%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_92%_18%,rgba(0,255,180,0.05),transparent_30%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(0,255,180,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,180,0.025)_1px,transparent_1px)] bg-[size:54px_54px] opacity-60" />

      <div className="relative flex min-h-screen p-3 md:p-5">
      {/* SIDEBAR */}
      <aside className="hidden w-[282px] shrink-0 flex-col justify-between overflow-hidden rounded-[30px] border border-[#1a2438] bg-[#0b1220]/90 p-5 shadow-[0_40px_120px_rgba(0,0,0,0.42)] backdrop-blur-xl lg:flex">
        <div>
          <div className="mb-10 flex items-center gap-4 px-2 pt-1">
            <img
              src="/PNG/Articton.png"
              alt="Articton Logo"
              className="h-11 w-11 scale-[2.2] object-contain"
            />
            <div>
              <span className="block text-xl font-bold tracking-wide text-white">Articton</span>
              <span className="text-xs uppercase tracking-[0.25em] text-[#00ffb4]/70">Admin</span>
            </div>
          </div>

          <div className="space-y-2">
            <AdminNavButton
              icon={UserCog}
              label="Account Management"
              active={activeTab === "accounts"}
              onClick={() => setActiveTab("accounts")}
            />

            <AdminNavButton
              icon={BarChart3}
              label="Analytics"
              active={activeTab === "analytics"}
              onClick={() => setActiveTab("analytics")}
            />

            <AdminNavButton
              icon={FileText}
              label="Module Approvals"
              active={activeTab === "content"}
              onClick={() => setActiveTab("content")}
            />
          </div>
        </div>

        <div className="mt-auto rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#00ffb4]/25 bg-[#00ffb4]/10 text-[#00ffb4]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">Administrator</div>
              <div className="truncate text-xs text-[#7a8ba8]">{adminEmail}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN PANEL */}
      <main className="relative min-w-0 flex-1 px-0 py-1 lg:pl-5">
        {/* HEADER */}
        <div className="mb-6 rounded-[28px] border border-[#1a2438] bg-[#0d1220]/88 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3 lg:hidden">
              <img
                src="/PNG/Articton.png"
                alt="Articton Logo"
                className="h-9 w-9 scale-[2.1] object-contain"
              />
              <span className="text-xl font-bold text-white">Articton</span>
            </div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#00ffb4]/70">
              Administrator Console
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
              {activeTab === "accounts"
                ? "Account Management"
                : activeTab === "analytics"
                ? "Analytics"
                : "Module Approvals"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9fb0c9]">
              {activeTab === "content"
                ? "Review Faculty content requests and publish approved cards to the Flutter mobile app."
                : "Scores are fetched live from Firebase user documents."}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex rounded-2xl border border-[#1a2438] bg-[#0b1220] p-1 lg:hidden">
              <button
                type="button"
                onClick={() => setActiveTab("accounts")}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  activeTab === "accounts"
                    ? "bg-[#00ffb4] text-[#0a0e17]"
                    : "text-[#9fb0c9] hover:text-white",
                ].join(" ")}
              >
                Accounts
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("analytics")}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  activeTab === "analytics"
                    ? "bg-[#00ffb4] text-[#0a0e17]"
                    : "text-[#9fb0c9] hover:text-white",
                ].join(" ")}
              >
                Analytics
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("content")}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  activeTab === "content"
                    ? "bg-[#00ffb4] text-[#0a0e17]"
                    : "text-[#9fb0c9] hover:text-white",
                ].join(" ")}
              >
                Content
              </button>
            </div>
            <button
              type="button"
              onClick={fetchUsers}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#00ffb4]/30 bg-[#00ffb4]/10 px-4 py-3 text-sm font-semibold text-[#00ffb4] transition hover:bg-[#00ffb4]/16 disabled:opacity-50"
            >
              <RefreshCw className={["h-4 w-4", loading ? "animate-spin" : ""].join(" ")} />
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            {/* Dropdown */}
            <div className="relative">
              <button
                className="flex items-center gap-3 rounded-2xl border border-[#1a2438] bg-[#0b1220] px-4 py-3 text-sm text-[#dbe6f5] transition hover:bg-white/[0.04]"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#00ffb4]/25 bg-[#00ffb4]/10 text-sm font-bold uppercase text-[#00ffb4]">
                  {adminProfile?.avatarUrl ? (
                    <img src={adminProfile.avatarUrl} alt="Admin profile" className="h-full w-full rounded-xl object-cover" />
                  ) : (
                    adminName.charAt(0)
                  )}
                </div>
                <span className="max-w-[180px] truncate font-medium">{adminName}</span>
                <ChevronDown className={["h-4 w-4 transition", dropdownOpen ? "rotate-180" : ""].join(" ")} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-[#1a2438] bg-[#0b1220] shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#dbe6f5] transition hover:bg-white/[0.05]"
                    onClick={() => {
                      setDropdownOpen(false);
                      setIsProfileOpen(true);
                    }}
                  >
                    <Settings className="h-4 w-4 text-[#7a8ba8]" />
                    Profile
                  </button>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-200 transition hover:bg-red-500/10"
                    onClick={onLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>

        <AccountProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          profile={adminProfile}
          onProfileUpdated={setAdminProfile}
        />

        {/* ACCOUNT MANAGEMENT */}
        {activeTab === "accounts" && (
          <>
            {loading && (
              <div className="rounded-2xl border border-[#1a2438] bg-[#0d1220] p-6 text-center text-[#9fb0c9]">
                Loading students...
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-red-200">
                {error}
              </div>
            )}

            {!loading && !error && (
              <>
                <div className="overflow-x-auto rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_28px_80px_rgba(0,0,0,0.34)]">
                  <div className="min-w-[1320px]">
                    <div className="grid grid-cols-[1.25fr_1.55fr_0.9fr_1fr_1.6fr_0.75fr_120px_110px] gap-4 border-b border-white/10 bg-[#0b1220] px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8ba8]">
                      <div>Name</div>
                      <div>E-mail</div>
                      <div>Created</div>
                      <div>Contact No.</div>
                      <div>UID</div>
                      <div>Avg Score</div>
                      <div>Update</div>
                      <div>Remove</div>
                    </div>

                    <div className="divide-y divide-white/10">
                      {accounts.map((account) => (
                        <div
                          key={account.id}
                          className="grid grid-cols-[1.25fr_1.55fr_0.9fr_1fr_1.6fr_0.75fr_120px_110px] items-center gap-4 px-5 py-4 transition hover:bg-white/[0.04]"
                        >
                          <div>
                            {editingId === account.id ? (
                              <div className="flex flex-col gap-2">
                                <input
                                  type="text"
                                  value={editFirstName}
                                  onChange={(e) => setEditFirstName(e.target.value)}
                                  placeholder="First Name"
                                  className="rounded-xl border border-[#1a2438] bg-[#0b1220] px-3 py-2 text-sm text-white outline-none focus:border-[#00ffb4]/40 focus:ring-2 focus:ring-[#00ffb4]/15"
                                />
                                <input
                                  type="text"
                                  value={editLastName}
                                  onChange={(e) => setEditLastName(e.target.value)}
                                  placeholder="Last Name"
                                  className="rounded-xl border border-[#1a2438] bg-[#0b1220] px-3 py-2 text-sm text-white outline-none focus:border-[#00ffb4]/40 focus:ring-2 focus:ring-[#00ffb4]/15"
                                />
                              </div>
                            ) : (
                              <div className="flex min-w-0 items-center gap-3">
                                <StudentAvatar student={account} />
                                <div className="min-w-0">
                                  <div className="truncate font-semibold text-white">{account.name}</div>
                                {account.studentId || account.section ? (
                                  <div className="mt-1 text-xs text-[#7a8ba8]">
                                    {[account.studentId, account.section]
                                      .filter(Boolean)
                                      .join(" • ")}
                                  </div>
                                ) : null}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="break-all text-sm text-[#c8d4e6]">{account.email}</div>

                          <div className="text-sm text-[#c8d4e6]">
                            {account.createdAtLabel}
                          </div>

                          <div className="text-sm text-[#c8d4e6]">
                            {account.contactNumber || "Not set"}
                          </div>

                          <div
                            className="truncate font-mono text-xs text-[#9fb0c9]"
                            title={account.uid}
                          >
                            {account.uid}
                          </div>

                          <div>
                            <span className="rounded-full border border-[#00ffb4]/20 bg-[#00ffb4]/10 px-3 py-1.5 text-sm font-bold text-[#00ffb4]">
                              {account.averageScore}%
                            </span>
                          </div>

                          <div>
                            {editingId === account.id ? (
                              <div className="flex flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(account.id)}
                                  disabled={savingId === account.id}
                                  className="rounded-xl bg-[#00ffb4] px-3 py-2 text-sm font-bold text-[#0a0e17] transition hover:scale-[1.01] disabled:opacity-60"
                                >
                                  {savingId === account.id ? "Saving..." : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="rounded-xl border border-[#1a2438] bg-white/[0.04] px-3 py-2 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.07]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEdit(account)}
                                className="rounded-xl border border-[#00ffb4]/30 bg-[#00ffb4]/10 px-4 py-2 text-sm font-semibold text-[#00ffb4] transition hover:bg-[#00ffb4]/16"
                              >
                                Update
                              </button>
                            )}
                          </div>

                          <div>
                            <button
                              type="button"
                              onClick={() => removeUser(account.id)}
                              disabled={deletingId === account.id}
                              className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/16 disabled:opacity-60"
                            >
                              {deletingId === account.id ? "Removing..." : "Remove"}
                            </button>
                          </div>
                        </div>
                      ))}

                      {!accounts.length && (
                        <div className="px-5 py-8 text-center text-[#9fb0c9]">
                          No student accounts found.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ANALYTICS */}
        {activeTab === "analytics" && (
          <>
            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
              <MetricCard
                label="Students"
                value={analyticsData.activeUsers.toLocaleString()}
                subtext="registered student accounts"
              />

              <MetricCard
                label="Avg Progress"
                value={`${analyticsData.completionRate}%`}
                subtext="across quizzes and practicals"
              />

              <MetricCard
                label="Avg Score"
                value={`${analyticsData.examScore}%`}
                subtext="quiz and practical scores"
              />

              <MetricCard
                label="Pass Rate"
                value={`${analyticsData.passRate}%`}
                subtext="completed activities passed"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.34)]">
                <h3 className="mb-4 text-lg font-bold tracking-tight text-white">
                  Activity Completion
                </h3>

                <div className="overflow-x-auto pb-2">
                  <div className="min-w-[1120px]">
                    <div className="flex h-48 items-end gap-3">
                      {analyticsData.completionTrend.map((item) => (
                        <div
                          key={item.key}
                          className="flex flex-1 flex-col items-center justify-end gap-2"
                        >
                          <div
                            className="w-full rounded-t-md bg-[#00ffb4] shadow-[0_0_24px_rgba(0,255,180,0.18)] transition-all duration-300"
                            style={{ height: `${Math.max(item.percent, 4)}%` }}
                            title={`${item.completed}/${item.total} completed`}
                          />
                          <span className="text-xs text-[#9fb0c9]">
                            {item.percent}%
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex justify-between text-xs text-[#7a8ba8]">
                      {analyticsData.completionTrend.map((item) => (
                        <span key={item.key} className="max-w-[76px] text-center leading-4">
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.34)]">
                <h3 className="mb-4 text-lg font-bold tracking-tight text-white">Top User Overview</h3>

                {analyticsData.userOverview ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <StudentAvatar student={analyticsData.userOverview} size="lg" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">
                            {analyticsData.userOverview.name}
                          </p>
                          <p className="truncate text-sm text-[#7a8ba8]">
                            {analyticsData.userOverview.email}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 rounded-xl border border-[#00ffb4]/20 bg-[#00ffb4]/10 px-4 py-2 font-bold text-[#00ffb4]">
                        {analyticsData.userOverview.averageScore}%
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
                        <div className="text-sm text-[#7a8ba8]">Progress</div>
                        <div className="mt-1 text-2xl font-black text-white">
                          {analyticsData.userOverview.progress}%
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
                        <div className="text-sm text-[#7a8ba8]">Completed</div>
                        <div className="mt-1 text-2xl font-black text-white">
                          {analyticsData.userOverview.completedCount}/
                          {analyticsData.userOverview.totalActivities}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4 text-[#9fb0c9]">
                    No student score data yet.
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === "content" && (
          <ModuleContentWorkspace mode="admin" user={adminUser} />
        )}
      </main>
    </div>
    </div>
  );
}
