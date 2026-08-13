import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, LogOut, Settings as SettingsIcon } from "lucide-react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { fetchMobileScoreDocs, mergeMobileScoresIntoProfile } from "../utils/mobileScores";
import ModuleContentWorkspace from "../Components/ModuleContentWorkspace";
import AccountProfileModal from "../Components/AccountProfileModal";
import SettingsModal from "../Components/Settings";
import { getUserSettings } from "../utils/userSettings";

const PASSING_PERCENT = 60;
const MODULE_ACTIVITY_GROUPS = [
  { key: "module1", label: "Module 1" },
  { key: "module2", label: "Module 2" },
  { key: "module3", label: "Module 3" },
  { key: "module4", label: "Module 4" },
];

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function getQuizStatus(quizProgress, moduleKey) {
  const progress = quizProgress?.[moduleKey] || null;

  if (!progress) {
    return {
      type: "quiz",
      completed: false,
      passed: false,
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
    completed,
    passed,
    scorePercent,
    completionPercent: completed ? 100 : 0,
    status: completed ? (passed ? "Passed" : "Completed") : "In progress",
  };
}

function getPracticalStatus(practicalProgress, practicalKey) {
  const progress = practicalProgress?.[practicalKey] || null;

  if (!progress) {
    return {
      type: "practical",
      completed: false,
      passed: false,
      scorePercent: null,
      progressPercent: 0,
      completionPercent: 0,
      status: "Not started",
    };
  }

  const completed = !!progress.completed;
  const scorePercent =
    clampPercent(progress.scorePercent ?? progress.percent) ??
    (completed ? 100 : null);

  const passed =
    progress.passed === true ||
    (completed && scorePercent !== null && scorePercent >= PASSING_PERCENT);

  return {
    type: "practical",
    completed,
    passed,
    scorePercent,
    progressPercent: completed ? 100 : 0,
    completionPercent: completed ? 100 : 0,
    status: completed ? (passed ? "Passed" : "Completed") : "In progress",
  };
}

function getScoreStatus(progress, passingPercent = PASSING_PERCENT) {
  if (!progress) {
    return {
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
    completed,
    passed,
    scorePercent,
    completionPercent: completed ? 100 : 0,
    status: completed ? (passed ? "Passed" : "Completed") : "In progress",
  };
}

function getFullName(data) {
  const firstName = data.firstName || "";
  const lastName = data.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || data.name || data.displayName || "No Name";
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
  const mobileModules = MODULE_ACTIVITY_GROUPS.map((module) => ({
    ...module,
    content: getScoreStatus(mobileModuleScores[`${module.key}Content`]),
    pre: getScoreStatus(mobileModuleScores[`${module.key}Pre`]),
    post: getScoreStatus(mobileModuleScores[`${module.key}Post`]),
  }));
  const mobileExam1 = getScoreStatus(mobilePracticeScores.practiceExam1);
  const mobileExam2 = getScoreStatus(mobilePracticeScores.practiceExam2);
  const amdDisassembly = getScoreStatus(practicalTests.amdDisassembly, 75);
  const intelDisassembly = getScoreStatus(practicalTests.intelDisassembly, 75);
  const amdAssembly = getScoreStatus(practicalTests.amdAssembly, 75);
  const intelAssembly = getScoreStatus(practicalTests.intelAssembly, 75);

  const resultItems = [
    ...mobileModules.flatMap((module) => [module.content, module.pre, module.post]),
    mobileExam1,
    mobileExam2,
    amdDisassembly,
    intelDisassembly,
    amdAssembly,
    intelAssembly,
  ];

  const overallProgress =
    resultItems.length === 0
      ? 0
      : Math.round(
          resultItems.reduce((sum, item) => sum + (item.completionPercent || 0), 0) /
            resultItems.length
        );

  const averageScore =
    resultItems.filter((item) => item.scorePercent !== null).length === 0
      ? 0
      : Math.round(
          resultItems.reduce(
            (sum, item) => sum + (item.scorePercent || 0),
            0
          ) /
            resultItems.filter((item) => item.scorePercent !== null).length
        );

  const completedCount = resultItems.filter((item) => item.completed).length;
  const passedCount = resultItems.filter((item) => item.passed).length;
  const avatarUrl = getProfilePhotoUrl(data);

  return {
    id: docSnap.id,
    uid: data.uid || docSnap.id,
    name: getFullName(data),
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    avatarUrl,
    email: data.email || "No email",
    role: data.role || "student",
    studentId: data.studentId || data.studentID || data.schoolId || "",
    section: data.section || data.classSection || data.program || "",
    quiz1,
    quiz2,
    quiz3,
    quiz4,
    assembly,
    disassembly,
    mobileModules,
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

function StatusPill({ status, passed }) {
  return (
    <span
      className={[
        "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
        passed
          ? "bg-[#FFD41C]/15 text-[#b7fff0] border border-[#FFD41C]/20"
          : "bg-white/5 text-[#9fb0c9] border border-white/10",
      ].join(" ")}
    >
      {status}
    </span>
  );
}

export default function FacultyPage({ onLogout }) {
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [facultyProfile, setFacultyProfile] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [settings, setSettings] = useState(getUserSettings);
  const [activeTab, setActiveTab] = useState("progress");

  const handleSettingChange = (key, value) => {
    setSettings((previous) => ({ ...previous, [key]: value }));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const profileSnap = await getDoc(doc(db, "users", currentUser.uid));
          setFacultyProfile(
            profileSnap.exists()
              ? { uid: currentUser.uid, email: currentUser.email, ...profileSnap.data() }
              : { uid: currentUser.uid, email: currentUser.email, role: "faculty" }
          );
        } catch (profileError) {
          console.error("Error loading faculty profile:", profileError);
          setFacultyProfile({ uid: currentUser.uid, email: currentUser.email, role: "faculty" });
        }
        fetchStudents();
      } else {
        setStudents([]);
        setSelectedStudentId(null);
        setFacultyProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError("");
      const studentQuery = query(
        collection(db, "users"),
        where("role", "==", "student")
      );
      const querySnapshot = await getDocs(studentQuery);
      const records = await Promise.all(
        querySnapshot.docs.map(async (studentDoc) => {
          const mobileScores = await fetchMobileScoreDocs(studentDoc.id);
          return buildStudentRecord(studentDoc, mobileScores);
        })
      );
      const sortedRecords = records
        .filter((record) => record.role === "student")
        .sort((a, b) => a.name.localeCompare(b.name));

      setStudents(sortedRecords);
      setSelectedStudentId((prev) => prev || sortedRecords[0]?.id || null);
    } catch (err) {
      console.error("Error fetching student records:", err);
      setError("Unable to load student progress. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return students;

    return students.filter((student) => {
      return [student.name, student.email, student.studentId, student.section]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [students, searchQuery]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) || students[0] || null,
    [students, selectedStudentId]
  );

  const metrics = useMemo(() => {
    const totalStudents = students.length;
    const avgProgress =
      totalStudents === 0
        ? 0
        : Math.round(
            students.reduce((sum, student) => sum + student.progress, 0) / totalStudents
          );
    const avgScore =
      totalStudents === 0
        ? 0
        : Math.round(
            students.reduce((sum, student) => sum + student.averageScore, 0) / totalStudents
          );
    const atRisk = students.filter((student) => student.progress < 50).length;
    const passRate =
      totalStudents === 0
        ? 0
        : Math.round(
            (students.filter((student) => student.passedCount > 0).length / totalStudents) * 100
          );

    return { totalStudents, avgProgress, avgScore, atRisk, passRate };
  }, [students]);

  return (
    <div className="articton-app-shell articton-faculty-page min-h-screen bg-[#0a0e17] text-[#e8ecf4]">
      <div className="relative h-full w-full overflow-auto p-6 lg:p-8 pb-12">
        <div className="mb-8 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-[#FFD41C]/70">
              Faculty Dashboard
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight">
              {activeTab === "progress" ? "Class progress overview" : "Mobile module editor"}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#9fb0c9]">
              {activeTab === "progress"
                ? "Review student performance, open profiles, check completion status, and stay on top of class progress."
                : "Create Firestore module content edits for the Flutter app and send them to admin approval."}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex rounded-2xl border border-[#1a2438] bg-[#0b1220] p-1">
              <button
                type="button"
                onClick={() => setActiveTab("progress")}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  activeTab === "progress"
                    ? "bg-[#FFD41C] text-[#0a0e17]"
                    : "text-[#9fb0c9] hover:text-white",
                ].join(" ")}
              >
                Progress
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("content")}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  activeTab === "content"
                    ? "bg-[#FFD41C] text-[#0a0e17]"
                    : "text-[#9fb0c9] hover:text-white",
                ].join(" ")}
              >
                Module Content
              </button>
            </div>
            <div className="relative z-[1010]">
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-3 rounded-2xl border border-[#1a2438] bg-[#0d1220] px-4 py-3 text-sm text-[#dbe6f5] transition hover:bg-white/[0.04]"
              >
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl border border-[#FFD41C]/25 bg-[#FFD41C]/10 text-sm font-bold uppercase text-[#FFD41C]">
                  {facultyProfile?.avatarUrl ? (
                    <img src={facultyProfile.avatarUrl} alt="Faculty profile" className="h-full w-full object-cover" />
                  ) : (
                    (facultyProfile?.firstName || user?.email || "F").charAt(0).toUpperCase()
                  )}
                </div>
                <span className="max-w-[220px] truncate">
                  {facultyProfile?.firstName || facultyProfile?.lastName
                    ? `${facultyProfile?.firstName || ""} ${facultyProfile?.lastName || ""}`.trim()
                    : user?.email || "Faculty"}
                </span>
                <ChevronDown className={["h-4 w-4 transition", dropdownOpen ? "rotate-180" : ""].join(" ")} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-2xl border border-[#1a2438] bg-[#0b1220] shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#dbe6f5] transition hover:bg-white/[0.05]"
                    onClick={() => {
                      setDropdownOpen(false);
                      setIsProfileOpen(true);
                    }}
                  >
                    <SettingsIcon className="h-4 w-4 text-[#7a8ba8]" />
                    Profile
                  </button>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#dbe6f5] transition hover:bg-white/[0.05]"
                    onClick={() => {
                      setDropdownOpen(false);
                      setIsSettingsOpen(true);
                    }}
                  >
                    <SettingsIcon className="h-4 w-4 text-[#7a8ba8]" />
                    Settings
                  </button>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-200 transition hover:bg-red-500/10"
                    onClick={() => {
                      setDropdownOpen(false);
                      onLogout();
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {activeTab === "content" ? (
          <ModuleContentWorkspace mode="faculty" user={user} />
        ) : (
        <div className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Students" value={metrics.totalStudents} />
              <MetricCard label="Avg progress" value={`${metrics.avgProgress}%`} />
              <MetricCard label="Avg score" value={`${metrics.avgScore}%`} />
              <MetricCard label="At risk" value={metrics.atRisk} subtext="Progress below 50%" />
            </div>

            <div className="rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.25)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-base font-semibold text-white">Students</div>
                  <div className="mt-1 text-sm text-[#7a8ba8]">
                    Search by name, email, ID, or section.
                  </div>
                </div>

                <div className="max-w-md flex-1">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search students..."
                    className="w-full rounded-2xl border border-[#1a2438] bg-[#0b1220] px-4 py-3 text-sm text-white outline-none focus:border-[#FFD41C]/40 focus:ring-2 focus:ring-[#FFD41C]/15"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_25px_80px_rgba(0,0,0,0.25)]">
              <div className="grid grid-cols-[1.4fr_1.4fr_0.9fr_0.9fr_130px] gap-4 px-5 py-4 text-sm uppercase tracking-[0.18em] text-[#7a8ba8] border-b border-white/10">
                <div>Student</div>
                <div>Email</div>
                <div>Progress</div>
                <div>Avg score</div>
                <div className="text-right">Action</div>
              </div>

              <div className="divide-y divide-white/10">
                {loading ? (
                  <div className="p-6 text-center text-[#9fb0c9]">Loading student list…</div>
                ) : error ? (
                  <div className="p-6 text-center text-red-300">{error}</div>
                ) : filteredStudents.length === 0 ? (
                  <div className="p-6 text-center text-[#9fb0c9]">No students found.</div>
                ) : (
                  filteredStudents.map((student) => (
                    <div
                      key={student.id}
                      className={`grid grid-cols-[1.4fr_1.4fr_0.9fr_0.9fr_130px] gap-4 px-5 py-4 transition ${
                        selectedStudent?.id === student.id
                          ? "bg-[#FFD41C]/10"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <StudentAvatar student={student} />

                        <div className="min-w-0">
                          <div className="truncate font-semibold text-white">
                            {student.name}
                          </div>

                          <div className="mt-1 truncate text-xs text-[#7a8ba8]">
                            {student.studentId
                              ? `ID: ${student.studentId}`
                              : student.section || "No section assigned"}
                          </div>
                        </div>
                      </div>

                      <div className="text-sm text-[#9fb0c9] break-all">{student.email}</div>

                      <div>
                        <div className="font-semibold text-white">{student.progress}%</div>
                        <div className="text-xs text-[#7a8ba8] mt-1">
                          {student.completedCount}/{student.totalActivities} completed
                        </div>
                      </div>

                      <div className="font-semibold text-white">{student.averageScore}%</div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedStudentId(student.id)}
                          className="rounded-2xl bg-[#FFD41C] px-4 py-2 text-sm font-semibold text-[#0a0e17] transition hover:bg-[#e6bd00]"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.25)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(255,212,28,0.11),transparent_34%)]" />
              <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[#FFD41C]/5 blur-3xl" />

              <div className="relative">
                {selectedStudent ? (
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-5">
                      <StudentAvatar student={selectedStudent} size="xl" />

                      <div className="min-w-0">
                        <div className="text-sm uppercase tracking-[0.28em] text-[#FFD41C]/70">
                          Student profile
                        </div>

                        <div className="mt-2 truncate text-2xl font-bold text-white">
                          {selectedStudent.name}
                        </div>

                        <div className="mt-1 truncate text-sm text-[#9fb0c9]">
                          {selectedStudent.email}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedStudent.studentId ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-[#c8d4e6]">
                              ID: {selectedStudent.studentId}
                            </span>
                          ) : null}

                          {selectedStudent.section ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-[#c8d4e6]">
                              {selectedStudent.section}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="self-start rounded-2xl border border-[#FFD41C]/20 bg-[#FFD41C]/10 px-4 py-2 text-sm capitalize text-[#b7fff0] sm:self-center">
                      {selectedStudent.role}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm uppercase tracking-[0.28em] text-[#FFD41C]/70">
                      Student profile
                    </div>
                    <div className="mt-3 text-2xl font-bold text-white">
                      Select a student
                    </div>
                  </div>
                )}

                {selectedStudent ? (
                  <div className="mt-7 space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailCard label="Email" value={selectedStudent.email} />
                    <DetailCard label="Section / Program" value={selectedStudent.section || "Not set"} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailCard label="Overall progress" value={`${selectedStudent.progress}%`} />
                    <DetailCard label="Average score" value={`${selectedStudent.averageScore}%`} />
                  </div>

                  <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
                    <div className="text-sm font-semibold text-white">Assessment status</div>
                    <div className="mt-4 space-y-4">
                      {selectedStudent.mobileModules.map((module) => (
                        <ModuleAssessmentCard key={module.key} module={module} />
                      ))}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <AssessmentRow title="Mobile Exam 1" item={selectedStudent.mobileExam1} />
                        <AssessmentRow title="Mobile Exam 2" item={selectedStudent.mobileExam2} />
                        <AssessmentRow title="3D AMD Disassembly" item={selectedStudent.amdDisassembly} />
                        <AssessmentRow title="3D Intel Disassembly" item={selectedStudent.intelDisassembly} />
                        <AssessmentRow title="3D AMD Assembly" item={selectedStudent.amdAssembly} />
                        <AssessmentRow title="3D Intel Assembly" item={selectedStudent.intelAssembly} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#1a2438] bg-[#0b1220] p-4">
                    <div className="text-sm font-semibold text-white">Faculty actions</div>
                    <div className="mt-3 text-sm leading-6 text-[#9fb0c9]">
                      This dashboard gives you visibility into student progress and completion status. In a future update, you can add feedback comments, assessment unlock controls, and announcement tools here.
                    </div>
                  </div>
                </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-[#1a2438] bg-white/[0.03] p-6 text-sm text-[#9fb0c9]">
                    Select a student from the list to view their profile and progress details.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        )}
        <AccountProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          profile={facultyProfile}
          onProfileUpdated={setFacultyProfile}
        />
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onChange={handleSettingChange}
          onEditProfile={() => setIsProfileOpen(true)}
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value, subtext }) {
  return (
    <div className="rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-5 text-center shadow-[0_20px_50px_rgba(0,0,0,0.20)]">
      <div className="text-sm uppercase tracking-[0.25em] text-[#7a8ba8]">{label}</div>
      <div className="mt-4 text-3xl font-black text-white">{value}</div>
      {subtext ? <div className="mt-2 text-sm text-[#9fb0c9]">{subtext}</div> : null}
    </div>
  );
}

function StudentAvatar({ student, size = "md" }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [student?.avatarUrl]);

  const dimension =
    size === "xl"
      ? "h-24 w-24 text-3xl ring-4 ring-[#FFD41C]/10"
      : size === "lg"
      ? "h-16 w-16 text-xl"
      : "h-11 w-11 text-sm";

  const fallback = (student?.name || student?.email || "S")
    .charAt(0)
    .toUpperCase();

  const showImage = !!student?.avatarUrl && !imageFailed;

  return (
    <div
      className={`${dimension} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#FFD41C]/30 bg-[#FFD41C]/10 font-bold text-[#FFD41C] shadow-[0_12px_34px_rgba(0,0,0,0.28)]`}
    >
      {showImage ? (
        <img
          src={student.avatarUrl}
          alt={`${student.name || "Student"} profile`}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        fallback
      )}
    </div>
  );
}

function DetailCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-[#1a2438] bg-[#0b1220] p-4">
      <div className="text-xs uppercase tracking-[0.25em] text-[#7a8ba8]">{label}</div>
      <div className="mt-3 text-sm text-white">{value}</div>
    </div>
  );
}

function ModuleAssessmentCard({ module }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1220] p-4">
      <div className="text-sm font-semibold text-white">{module.label}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <AssessmentRow title="Content" item={module.content} />
        <AssessmentRow title="Pre-test" item={module.pre} />
        <AssessmentRow title="Post-test" item={module.post} />
      </div>
    </div>
  );
}

function AssessmentRow({ title, item, status, passed }) {
  const statusText = item?.status || status || "Not started";
  const passedValue = item?.passed ?? passed;
  const scoreText =
    item?.scorePercent !== null && item?.scorePercent !== undefined
      ? `${item.scorePercent}%`
      : null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0b1220] px-4 py-3">
      <div>
        <div className="text-sm text-[#dbe6f5]">{title}</div>
        {scoreText ? <div className="mt-1 text-xs text-[#7a8ba8]">{scoreText}</div> : null}
      </div>
      <StatusPill status={statusText} passed={passedValue} />
    </div>
  );
}
