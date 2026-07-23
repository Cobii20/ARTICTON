import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

const QUIZ_KEYS = [
  { key: "module1", label: "Module 1" },
  { key: "module2", label: "Module 2" },
  { key: "module3", label: "Module 3" },
];

const PRACTICAL_KEYS = [
  { key: "fullAssembly", label: "Assembly" },
  { key: "fullDisassembly", label: "Disassembly" },
];

const SCORE_ITEMS = [
  { key: "module1", label: "M1", field: "quiz1" },
  { key: "module2", label: "M2", field: "quiz2" },
  { key: "module3", label: "M3", field: "quiz3" },
  { key: "fullAssembly", label: "Asm", field: "assembly" },
  { key: "fullDisassembly", label: "Disasm", field: "disassembly" },
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

function buildStudentRecord(docSnap) {
  const data = docSnap.data();

  const quizProgress = data.quizProgress || {};
  const practicalProgress = data.practicalProgress || {};

  const quiz1 = getQuizStatus(quizProgress, "module1");
  const quiz2 = getQuizStatus(quizProgress, "module2");
  const quiz3 = getQuizStatus(quizProgress, "module3");
  const assembly = getPracticalStatus(practicalProgress, "fullAssembly");
  const disassembly = getPracticalStatus(practicalProgress, "fullDisassembly");

  const resultItems = [quiz1, quiz2, quiz3, assembly, disassembly];

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
    email: data.email || "No email",
    studentId: data.studentId || data.studentID || data.schoolId || "",
    section: data.section || data.classSection || "",
    role: data.role || "student",

    quizProgress,
    practicalProgress,
    quiz1,
    quiz2,
    quiz3,
    assembly,
    disassembly,

    progress: overallProgress,
    averageScore,
    completedCount,
    passedCount,
    totalActivities: resultItems.length,
  };
}

function MetricCard({ label, value, subtext }) {
  return (
    <div className="p-6 rounded-xl bg-[#13304a]/50 backdrop-blur-lg border border-white/10">
      <p className="text-sm text-white/70">{label}</p>
      <h2 className="text-2xl font-bold mt-2">{value}</h2>
      {subtext ? <p className="text-[#b7fff0] text-sm mt-1">{subtext}</p> : null}
    </div>
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

  const adminName = useMemo(() => {
    if (!adminUser) return "Admin";
    const first = adminUser.firstName || "";
    const last = adminUser.lastName || "";
    return `${first} ${last}`.trim() || adminUser.displayName || "Admin";
  }, [adminUser]);

  const adminEmail = adminUser?.email || "admin@email.com";

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const querySnapshot = await getDocs(collection(db, "users"));
      const users = querySnapshot.docs
        .map(buildStudentRecord)
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
      if (!activeUsers) return 0;

      const completed = accounts.filter(
        (account) => account[item.field]?.completed
      ).length;

      return Math.round((completed / activeUsers) * 100);
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
    <div className="min-h-screen bg-[#0B2E5A] text-white flex">
      {/* SIDEBAR */}
      <aside className="w-[250px] bg-[#03234A] p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="h-10 w-10 rounded-xl bg-[#1E4D7A] flex items-center justify-center">
              <div className="h-5 w-5 rounded-full border-2 border-white" />
            </div>
            <span className="text-xl font-semibold">Articton</span>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setActiveTab("accounts")}
              className={`w-full text-left px-4 py-3 rounded-xl transition ${
                activeTab === "accounts"
                  ? "bg-[#2E78A6]"
                  : "hover:bg-[#1E4D7A]"
              }`}
            >
              Account Management
            </button>

            <button
              onClick={() => setActiveTab("analytics")}
              className={`w-full text-left px-4 py-3 rounded-xl transition ${
                activeTab === "analytics"
                  ? "bg-[#2E78A6]"
                  : "hover:bg-[#1E4D7A]"
              }`}
            >
              Analytics
            </button>
          </div>
        </div>

        <div className="mt-auto bg-[#2E78A6] rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-lg font-semibold">A</span>
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">Administrator Account</div>
            <div className="text-xs text-white/70 truncate">{adminEmail}</div>
          </div>
        </div>
      </aside>

      {/* MAIN PANEL */}
      <main className="flex-1 relative p-8 overflow-hidden">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-bold">
              {activeTab === "accounts" ? "Account Management" : "Analytics"}
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Scores are fetched live from Firebase user documents.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchUsers}
              disabled={loading}
              className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 transition disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            {/* Dropdown */}
            <div className="relative">
              <button
                className="flex items-center gap-3 bg-[#2E78A6]/70 px-4 py-2.5 rounded-full hover:bg-[#2E78A6] transition"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold uppercase">
                  {adminName.charAt(0)}
                </div>
                <span className="font-medium">{adminName}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 transition ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#194066] border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden">
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-[#2E78A6] transition"
                    onClick={() => alert("Settings clicked")}
                  >
                    Settings
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-[#2E78A6] transition"
                    onClick={onLogout}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ACCOUNT MANAGEMENT */}
        {activeTab === "accounts" && (
          <>
            {loading && <p className="text-white/80">Loading students...</p>}
            {error && <p className="text-red-300 mb-4">{error}</p>}

            {!loading && !error && (
              <>
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
                  <div className="min-w-[1450px]">
                    <div className="grid grid-cols-[1.25fr_1.6fr_repeat(5,1fr)_0.8fr_120px_110px] gap-4 px-5 py-4 text-sm text-white/80 border-b border-white/10">
                      <div>Name</div>
                      <div>E-mail</div>
                      <div>Module 1</div>
                      <div>Module 2</div>
                      <div>Module 3</div>
                      <div>Assembly PT</div>
                      <div>Disassembly PT</div>
                      <div>Avg Score</div>
                      <div>Update</div>
                      <div>Remove</div>
                    </div>

                    <div className="divide-y divide-white/10">
                      {accounts.map((account) => (
                        <div
                          key={account.id}
                          className="grid grid-cols-[1.25fr_1.6fr_repeat(5,1fr)_0.8fr_120px_110px] gap-4 items-center px-5 py-4 bg-[#3A7EA4]/85 hover:bg-[#3A7EA4] transition"
                        >
                          <div>
                            {editingId === account.id ? (
                              <div className="flex flex-col gap-2">
                                <input
                                  type="text"
                                  value={editFirstName}
                                  onChange={(e) => setEditFirstName(e.target.value)}
                                  placeholder="First Name"
                                  className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white outline-none"
                                />
                                <input
                                  type="text"
                                  value={editLastName}
                                  onChange={(e) => setEditLastName(e.target.value)}
                                  placeholder="Last Name"
                                  className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white outline-none"
                                />
                              </div>
                            ) : (
                              <div>
                                <div className="font-semibold">{account.name}</div>
                                {account.studentId || account.section ? (
                                  <div className="text-xs text-white/65 mt-1">
                                    {[account.studentId, account.section]
                                      .filter(Boolean)
                                      .join(" • ")}
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>

                          <div className="text-sm break-all">{account.email}</div>

                          <div>
                            <div className="text-xl font-bold">
                              {account.progress}%
                            </div>
                            <div className="text-xs text-white/65">
                              {account.completedCount}/{account.totalActivities} done
                            </div>
                          </div>

                          <div className="font-semibold text-white">{account.averageScore}%</div>

                          <div>
                            {editingId === account.id ? (
                              <div className="flex flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(account.id)}
                                  disabled={savingId === account.id}
                                  className="px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-60"
                                >
                                  {savingId === account.id ? "Saving..." : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="px-3 py-2 rounded-lg bg-gray-500 hover:bg-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEdit(account)}
                                className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
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
                              className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-60"
                            >
                              {deletingId === account.id ? "Removing..." : "Remove"}
                            </button>
                          </div>
                        </div>
                      ))}

                      {!accounts.length && (
                        <div className="px-5 py-8 text-center text-white/70">
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-[#13304a]/50 backdrop-blur-lg border border-white/10">
                <h3 className="text-lg font-semibold mb-4">
                  Activity Completion
                </h3>

                <div className="h-48 flex items-end gap-3">
                  {analyticsData.completionTrend.map((value, index) => (
                    <div
                      key={SCORE_ITEMS[index].label}
                      className="flex-1 flex flex-col items-center justify-end gap-2"
                    >
                      <div
                        className="w-full bg-[#5F9598] rounded-t-md transition-all duration-300"
                        style={{ height: `${Math.max(value, 4)}%` }}
                        title={`${value}%`}
                      />
                      <span className="text-xs text-white/60">
                        {value}%
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between text-xs text-white/60 mt-3">
                  {SCORE_ITEMS.map((item) => (
                    <span key={item.key}>{item.label}</span>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-xl bg-[#13304a]/50 backdrop-blur-lg border border-white/10">
                <h3 className="text-lg font-semibold mb-4">Top User Overview</h3>

                {analyticsData.userOverview ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-[#1b365d] rounded-xl p-4">
                      <div>
                        <p className="font-semibold">
                          {analyticsData.userOverview.name}
                        </p>
                        <p className="text-sm text-white/60">
                          {analyticsData.userOverview.email}
                        </p>
                      </div>

                      <div className="bg-[#5F9598]/30 px-4 py-2 rounded-lg font-semibold">
                        {analyticsData.userOverview.averageScore}%
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                        <div className="text-sm text-white/60">Progress</div>
                        <div className="mt-1 text-2xl font-bold">
                          {analyticsData.userOverview.progress}%
                        </div>
                      </div>
                      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                        <div className="text-sm text-white/60">Completed</div>
                        <div className="mt-1 text-2xl font-bold">
                          {analyticsData.userOverview.completedCount}/
                          {analyticsData.userOverview.totalActivities}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#1b365d] rounded-xl p-4 text-white/60">
                    No student score data yet.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
