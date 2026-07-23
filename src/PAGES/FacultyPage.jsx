import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { fetchMobileScoreDocs, mergeMobileScoresIntoProfile } from "../utils/mobileScores";

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

  return {
    id: docSnap.id,
    uid: data.uid || docSnap.id,
    name: getFullName(data),
    firstName: data.firstName || "",
    lastName: data.lastName || "",
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
          ? "bg-[#00ffb4]/15 text-[#b7fff0] border border-[#00ffb4]/20"
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        fetchStudents();
      } else {
        setStudents([]);
        setSelectedStudentId(null);
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
    <div className="min-h-screen bg-[#0a0e17] text-[#e8ecf4]">
      <div className="relative h-full w-full overflow-hidden p-6 lg:p-8">
        <div className="mb-8 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-[#00ffb4]/70">
              Faculty Dashboard
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight">Class progress overview</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#9fb0c9]">
              Review student performance, open profiles, check completion status, and stay on top of class progress.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl border border-[#1a2438] bg-[#0d1220] px-4 py-3 text-sm text-[#dbe6f5]">
              {user?.email || "Faculty"}
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-2xl bg-[#00ffb4] px-5 py-3 text-sm font-semibold text-[#0a0e17] transition hover:scale-[1.01]"
            >
              Logout
            </button>
          </div>
        </div>

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
                    className="w-full rounded-2xl border border-[#1a2438] bg-[#0b1220] px-4 py-3 text-sm text-white outline-none focus:border-[#00ffb4]/40 focus:ring-2 focus:ring-[#00ffb4]/15"
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
                          ? "bg-[#00ffb4]/10"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-white">{student.name}</div>
                        <div className="text-xs text-[#7a8ba8] mt-1">
                          {student.studentId ? `ID: ${student.studentId}` : student.section}
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
                          className="rounded-2xl bg-[#00ffb4] px-4 py-2 text-sm font-semibold text-[#0a0e17] transition hover:bg-[#00e699]"
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
            <div className="rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm uppercase tracking-[0.28em] text-[#00ffb4]/70">Student profile</div>
                  <div className="mt-3 text-2xl font-bold text-white">{selectedStudent?.name || "Select a student"}</div>
                </div>

                {selectedStudent ? (
                  <div className="rounded-2xl border border-[#00ffb4]/20 bg-[#00ffb4]/10 px-4 py-2 text-sm text-[#b7fff0]">
                    {selectedStudent.role}
                  </div>
                ) : null}
              </div>

              {selectedStudent ? (
                <div className="mt-6 space-y-5">
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
