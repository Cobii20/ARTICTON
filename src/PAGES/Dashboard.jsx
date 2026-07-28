import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Settings from "../Components/Settings";
import AMDFullAssemblyPracticalTest from "./PracticalTests/AMD/AMDFullAssemblyPracticalTest.jsx";
import AMDFullDisassemblyPracticalTest from "./PracticalTests/AMD/AMDFullDisassemblyPracticalTest.jsx";
import INTELFullAssemblyPracticalTest from "./PracticalTests/INTEL/INTELFullAssemblyPracticalTest.jsx";
import INTELFullDisassemblyPracticalTest from "./PracticalTests/INTEL/INTELFullDisassemblyPracticalTest.jsx";
import { auth, db, storage } from "../firebase.js";
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
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { fetchMobileScoreDocs, mergeMobileScoresIntoProfile } from "../utils/mobileScores";
import { ACHIEVEMENTS } from "../utils/achievements.jsx";
import { getUserSettings } from "../utils/userSettings";
import { createProfileImageDataUrl, validateProfileImage } from "../utils/profileImages";

function isCompletedProgress(progress) {
  return !!progress?.completed || !!progress?.finished || (progress?.percent || 0) >= 100;
}

const MOBILE_MODULE_LABELS = {
  module1: "Module 1",
  module2: "Module 2",
  module3: "Module 3",
  module4: "Module 4",
};

const PRACTICAL_ACHIEVEMENT_LABELS = {
  amdDisassembly: {
    title: "AMD Disassembly Practical",
    subtitle: "Completed the AMD full disassembly practical.",
  },
  intelDisassembly: {
    title: "Intel Disassembly Practical",
    subtitle: "Completed the Intel full disassembly practical.",
  },
  amdAssembly: {
    title: "AMD Assembly Practical",
    subtitle: "Completed the AMD full assembly practical.",
  },
  intelAssembly: {
    title: "Intel Assembly Practical",
    subtitle: "Completed the Intel full assembly practical.",
  },
  fullDisassembly: {
    title: "Full Disassembly Practical",
    subtitle: "Completed the full disassembly practical.",
  },
  fullAssembly: {
    title: "Full Assembly Practical",
    subtitle: "Completed the full assembly practical.",
  },
  practiceExam1: {
    title: "Mobile Disassembly Exam",
    subtitle: "Completed the mobile disassembly exam.",
  },
  practiceExam2: {
    title: "Mobile Assembly Exam",
    subtitle: "Completed the mobile assembly exam.",
  },
};

const MOBILE_ASSESSMENT_LABELS = {
  Content: "Content",
  Pre: "Pre-test",
  Post: "Post-test",
};

function formatAchievementScore(result) {
  const scorePercent = Number(result?.scorePercent ?? result?.percent ?? result?.percentage ?? result?.score);
  return Number.isFinite(scorePercent) ? `${Math.round(scorePercent)}%` : "";
}

function getAchievementStatus(result, passingPercent = 60) {
  const scorePercent = Number(result?.scorePercent ?? result?.percent ?? result?.percentage ?? result?.score);
  const completed =
    !!result?.completed ||
    !!result?.finished ||
    !!result?.unlocked ||
    !!result?.completedAt ||
    !!result?.timestamp ||
    Number.isFinite(scorePercent);
  const passed =
    result?.passed === true ||
    (completed && Number.isFinite(scorePercent) && scorePercent >= passingPercent);

  return {
    completed,
    passed,
    scoreText: Number.isFinite(scorePercent) ? `${Math.round(scorePercent)}%` : "",
    statusText: passed ? "Passed" : completed ? "Completed" : "Not started",
  };
}

function makeAchievement({ id, icon = "badge", title, subtitle, result, category = "Achievement", passingPercent = 60 }) {
  const status = getAchievementStatus(result, passingPercent);
  if (result && !status.completed) return null;

  return {
    id,
    icon,
    title,
    subtitle,
    category,
    scoreText: status.scoreText,
    statusText: status.statusText,
    passed: status.passed,
  };
}

export default function Dashboard({
  onLogout,
  onOpenModule,
  initialSection = "Dashboard",
  profileEditRequestId = 0,
}) {
  const [section, setSection] = useState(initialSection);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);


  const [settings, setSettings] = useState(getUserSettings);

  const reduce = useReducedMotion();
  const navigate = useOptionalNavigate();

  const refreshUserProfile = useCallback(async (userOverride) => {
    const user = userOverride || auth.currentUser;

    if (!user?.uid) return;

    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const mobileScores = await fetchMobileScoreDocs(user.uid);
        setProfile(mergeMobileScoresIntoProfile(userSnap.data(), mobileScores));
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
    if (profileEditRequestId > 0) {
      setSection("Profile");
      setIsProfileEditOpen(true);
    }
  }, [profileEditRequestId]);

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
    const getTimestampValue = (value) => {
      if (!value) return 0;
      if (typeof value === "number") return value;
      if (typeof value === "string") return Date.parse(value) || 0;
      if (typeof value.toMillis === "function") return value.toMillis();
      if (typeof value.seconds === "number") return value.seconds * 1000;
      return 0;
    };

    const user = {
      name: profile
        ? `${profile.firstName || ""} ${
            profile.middleInitial ? profile.middleInitial + "." : ""
          } ${profile.lastName || ""}`.trim()
        : "Loading...",
      email: firebaseUser?.email || "No email",
      avatarUrl: profile?.avatarUrl || "",
      middleInitial: profile?.middleInitial || "",
    };

    const module1Progress = profile?.moduleProgress?.module1;
    const module1CompletedParts = module1Progress?.completedParts || {};
    const module1CompletedCount = Object.values(module1CompletedParts).filter(Boolean).length;

    const module2Progress = profile?.moduleProgress?.module2;
    const module2AMDProgress = profile?.moduleProgress?.module2AMD;
    const module2INTELProgress = profile?.moduleProgress?.module2INTEL;
    const module2CompletedSteps = module2Progress?.completedSteps || {};
    const module2CompletedCount = Object.values(module2CompletedSteps).filter(Boolean).length;
    const module2AmdCompletedCount = Object.values(module2AMDProgress?.completedSteps || {}).filter(Boolean).length;
    const module2IntelCompletedCount = Object.values(module2INTELProgress?.completedSteps || {}).filter(Boolean).length;
    const module2PlatformCompletedCount = module2AmdCompletedCount + module2IntelCompletedCount;
    const module2TotalSteps = 7;

    const module3Progress = profile?.moduleProgress?.module3;
    const module3AMDProgress = profile?.moduleProgress?.module3AMD;
    const module3INTELProgress = profile?.moduleProgress?.module3INTEL;
    const module3CompletedSteps = module3Progress?.completedSteps || {};
    const module3CompletedCount = Object.values(module3CompletedSteps).filter(Boolean).length;
    const module3AmdCompletedCount = Object.values(module3AMDProgress?.completedSteps || {}).filter(Boolean).length;
    const module3IntelCompletedCount = Object.values(module3INTELProgress?.completedSteps || {}).filter(Boolean).length;
    const module3PlatformCompletedCount = module3AmdCompletedCount + module3IntelCompletedCount;
    const module3TotalSteps = 7;

    const module4Progress = profile?.moduleProgress?.module4;
    const module4CompletedCount = Object.values(module4Progress?.completedSteps || {}).filter(Boolean).length;

    const module1LastOpenedAt = getTimestampValue(module1Progress?.updatedAt);
    const module2LastOpenedAt = getTimestampValue(module2Progress?.updatedAt);
    const module3LastOpenedAt = getTimestampValue(module3Progress?.updatedAt);

    const getPlatformCombinedProgress = (progressA, progressB) => {
      const percentA = Math.min(100, Math.max(0, progressA?.percent ?? 0));
      const percentB = Math.min(100, Math.max(0, progressB?.percent ?? 0));

      return {
        percent: Math.round((percentA + percentB) / 2),
        completed: !!progressA?.completed && !!progressB?.completed,
      };
    };

    const module1OverallProgress = module1Progress
      ? {
          percent:
            module1Progress.overallPercent ??
            module1Progress?.platformProgress
              ? getPlatformCombinedProgress(
                  module1Progress.platformProgress?.amd,
                  module1Progress.platformProgress?.intel
                ).percent
              : module1Progress.percent || 0,
          completed:
            module1Progress.overallCompleted ||
            (!!module1Progress.completed &&
              module1Progress?.platformProgress?.amd?.completed &&
              module1Progress?.platformProgress?.intel?.completed),
        }
      : { percent: 0, completed: false };

    const module2CombinedProgress = module2AMDProgress || module2INTELProgress
      ? getPlatformCombinedProgress(module2AMDProgress, module2INTELProgress)
      : { percent: module2Progress?.percent || 0, completed: module2Progress?.completed || false };

    const module3CombinedProgress = module3AMDProgress || module3INTELProgress
      ? getPlatformCombinedProgress(module3AMDProgress, module3INTELProgress)
      : { percent: module3Progress?.percent || 0, completed: module3Progress?.completed || false };

    const module1Done = module1OverallProgress.completed;
    const module2Done = module2CombinedProgress.completed;
    const module3Done = module3CombinedProgress.completed;
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
        progress: module1OverallProgress.percent,
        lessonsCompleted: module1CompletedCount,
        lessonsTotal: module1Progress?.totalPages || 6,
        lastOpenedAt: module1LastOpenedAt,
        selectionTitle: "Introduction To PC Hardware",
        selectionModuleNo: "Module 1",
        selectionProgressText: module1Progress
          ? `${module1CompletedCount} of ${module1Progress.totalPages || 6} parts completed`
          : "Start Module",
        selectionCta:
          module1OverallProgress.percent >= 100
            ? "Review"
            : module1OverallProgress.percent > 0
            ? "Continue"
            : "Start",
        selectionImage: "/PNG/module1.png",
      },
      {
        id: "module-2",
        title: "Module 2",
        subtitle:
          module2AMDProgress || module2INTELProgress
            ? `Step ${(module2CombinedProgress.percent || 0) >= 100 ? module2Progress?.currentStep ?? 0 : (module2Progress?.currentStep ?? 0) + 1} • Disassembly`
            : "Disassembly",
        progress: module2CombinedProgress.percent,
        lessonsCompleted: module2CompletedCount,
        lessonsTotal: module2TotalSteps,
        lastOpenedAt: module2LastOpenedAt,
        selectionTitle: "Disassembly",
        selectionModuleNo: "Module 2",
        selectionProgressText: module2Progress
          ? `${module2CompletedCount} of ${module2TotalSteps} steps completed`
          : "Start Module",
        selectionCta:
          module2CombinedProgress.percent >= 100
            ? "Review"
            : module2CombinedProgress.percent > 0
            ? "Continue"
            : "Start",
        selectionImage: "/PNG/module2.png",
      },
      {
        id: "module-3",
        title: "Module 3",
        subtitle:
          module3AMDProgress || module3INTELProgress
            ? `Step ${(module3CombinedProgress.percent || 0) >= 100 ? module3Progress?.currentStep ?? 0 : (module3Progress?.currentStep ?? 0) + 1} • Assembly`
            : "Assembly",
        progress: module3CombinedProgress.percent,
        lessonsCompleted: module3CompletedCount,
        lessonsTotal: module3TotalSteps,
        lastOpenedAt: module3LastOpenedAt,
        selectionTitle: "Assembly",
        selectionModuleNo: "Module 3",
        selectionProgressText: module3Progress
          ? `${module3CompletedCount} of ${module3TotalSteps} steps completed`
          : "Start Module",
        selectionCta:
          module3CombinedProgress.percent >= 100
            ? "Review"
            : module3CombinedProgress.percent > 0
            ? "Continue"
            : "Start",
        selectionImage: "/PNG/module3.png",
      },
      

    ];
const practicalTests = profile?.practicalTests || {};
const mobileModuleScores = profile?.mobileModuleScores || {};
const mobilePracticeScores = profile?.mobilePracticeScores || {};
const mobileSpecificAssessments = profile?.mobileSpecificAssessments || {};

const getScorePercent = (result) => {
  if (!result) return null;
  const direct = Number(result.scorePercent ?? result.percent ?? result.percentage);
  if (Number.isFinite(direct)) return Math.max(0, Math.min(100, Math.round(direct)));

  const score = Number(result.score ?? result.latestScore ?? result.finalScore);
  const total = Number(result.total ?? result.latestTotal ?? result.maxScore);
  if (Number.isFinite(score) && Number.isFinite(total) && total > 0) {
    return Math.max(0, Math.min(100, Math.round((score / total) * 100)));
  }
  return null;
};

const createMobileStatus = (result, passingPercent = 60) => {
  const scorePercent = getScorePercent(result);
  const completed =
    !!result?.completed ||
    !!result?.finished ||
    !!result?.completedAt ||
    !!result?.timestamp ||
    scorePercent !== null;
  const passed =
    result?.passed === true ||
    (completed && scorePercent !== null && scorePercent >= passingPercent);

  return {
    completed,
    passed,
    scorePercent,
    status: completed ? (passed ? "Passed" : "Completed") : "Not started",
  };
};

const mobileLearning = {
  modules: ["module1", "module2", "module3", "module4"].map((moduleKey, index) => ({
    key: moduleKey,
    label: `Module ${index + 1}`,
    content: createMobileStatus(mobileModuleScores[`${moduleKey}Content`]),
    pre: createMobileStatus(mobileModuleScores[`${moduleKey}Pre`]),
    post: createMobileStatus(mobileModuleScores[`${moduleKey}Post`]),
  })),
  exams: [
    {
      key: "practiceExam1",
      label: "Mobile Exam 1",
      ...createMobileStatus(mobilePracticeScores.practiceExam1),
    },
    {
      key: "practiceExam2",
      label: "Mobile Exam 2",
      ...createMobileStatus(mobilePracticeScores.practiceExam2),
    },
  ],
};

const createTestProgress = (result) => {
  if (!result) return null;

  const score = Number(result.score ?? 0);

  return {
    score,
    total: 100,
    percent: score,
    scorePercent: score,
    completionPercent: 100,
    passed: score >= 75,
    grade: result.grade || "-",
    elapsedSeconds: Number(result.elapsedSeconds ?? 0),
    wrongOrderCount: Number(result.wrongOrderCount ?? 0),
    fumbleCount: Number(result.fumbleCount ?? 0),
  };
};

const getTestStatus = (result, unlocked) => {
  if (result) {
    return Number(result.score ?? 0) >= 75
      ? "Passed"
      : "Completed";
  }

  return unlocked ? "Ready" : "Locked";
};
 const practiceTestAccess = profile?.practiceTestAccess || {};

const disassemblyPracticalUnlocked =
  practiceTestAccess?.module2?.unlocked === true ||
  module2Done;

const assemblyPracticalUnlocked =
  practiceTestAccess?.module3?.unlocked === true ||
  module3Done;
  
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

    const savedAchievements = Object.values(profile?.accountAchievements || {})
      .filter((achievement) => achievement?.unlocked)
      .map((achievement) =>
        makeAchievement({
          id: achievement.id,
          icon: achievement.id?.includes("exam") || achievement.id?.includes("practical") ? "badge" : "trophy",
          title: achievement.title,
          subtitle: achievement.subtitle,
          result: achievement,
          category: achievement.platform ? `${achievement.platform} Path` : "Saved",
          passingPercent: 75,
        })
      )
      .filter(Boolean);

    const moduleAchievements = [
      module2AMDProgress?.finished || module2AMDProgress?.completedSteps
        ? makeAchievement({
            id: "module-2-amd-disassembly-complete",
            icon: "trophy",
            title: "AMD Disassembly Module",
            subtitle: "Completed Module 2 on the AMD disassembly path.",
            result: { ...module2AMDProgress, completed: true },
            category: "Module",
          })
        : null,
      module2INTELProgress?.finished || module2INTELProgress?.completedSteps
        ? makeAchievement({
            id: "module-2-intel-disassembly-complete",
            icon: "trophy",
            title: "Intel Disassembly Module",
            subtitle: "Completed Module 2 on the Intel disassembly path.",
            result: { ...module2INTELProgress, completed: true },
            category: "Module",
          })
        : null,
      module3AMDProgress?.finished || module3AMDProgress?.completedSteps
        ? makeAchievement({
            id: "module-3-amd-assembly-complete",
            icon: "trophy",
            title: "AMD Assembly Module",
            subtitle: "Completed Module 3 on the AMD assembly path.",
            result: { ...module3AMDProgress, completed: true },
            category: "Module",
          })
        : null,
      module3INTELProgress?.finished || module3INTELProgress?.completedSteps
        ? makeAchievement({
            id: "module-3-intel-assembly-complete",
            icon: "trophy",
            title: "Intel Assembly Module",
            subtitle: "Completed Module 3 on the Intel assembly path.",
            result: { ...module3INTELProgress, completed: true },
            category: "Module",
          })
        : null,
      module2Done
        ? makeAchievement({
            id: ACHIEVEMENTS.module2.id,
            icon: "trophy",
            title: ACHIEVEMENTS.module2.title,
            subtitle: ACHIEVEMENTS.module2.subtitle,
            result: { ...(module2Progress || {}), completed: true },
            category: "Module",
          })
        : null,
      module3Done
        ? makeAchievement({
            id: ACHIEVEMENTS.module3.id,
            icon: "trophy",
            title: ACHIEVEMENTS.module3.title,
            subtitle: ACHIEVEMENTS.module3.subtitle,
            result: { ...(module3Progress || {}), completed: true },
            category: "Module",
          })
        : null,
    ].filter(Boolean);

    const mobileModuleAchievements = Object.entries(MOBILE_MODULE_LABELS).flatMap(([moduleKey, moduleLabel]) =>
      Object.entries(MOBILE_ASSESSMENT_LABELS)
        .map(([activityKey, activityLabel]) => {
          const result = mobileModuleScores[`${moduleKey}${activityKey}`];
          if (!result) return null;

          const score = formatAchievementScore(result);
          return makeAchievement({
            id: `mobile-${moduleKey}-${activityKey.toLowerCase()}`,
            icon: activityKey === "Content" ? "mobile" : activityKey === "Pre" ? "pre" : "post",
            title: `${moduleLabel} ${activityLabel}`,
            subtitle: `${score ? `${score} on ` : ""}${moduleLabel} mobile ${activityLabel.toLowerCase()}.`,
            result,
            category: "Mobile",
          });
        })
        .filter(Boolean)
    );

    const mobileSpecificAchievements = Object.entries(mobileSpecificAssessments).flatMap(([assessmentKey, result]) =>
      Object.entries(MOBILE_ASSESSMENT_LABELS)
        .map(([activityKey, activityLabel]) => {
          if (!assessmentKey.endsWith(activityKey)) return null;

          const baseKey = assessmentKey.slice(0, -activityKey.length);
          const labels = PRACTICAL_ACHIEVEMENT_LABELS[baseKey];
          if (!labels) return null;

          const score = formatAchievementScore(result);
          return makeAchievement({
            id: `mobile-${baseKey}-${activityKey.toLowerCase()}`,
            icon: activityKey === "Pre" ? "pre" : "post",
            title: `${labels.title} ${activityLabel}`,
            subtitle: `${score ? `${score} on ` : ""}${labels.title} mobile ${activityLabel.toLowerCase()}.`,
            result,
            category: "Mobile",
          });
        })
        .filter(Boolean)
    );

    const mobilePracticeAchievements = Object.entries(mobilePracticeScores)
      .map(([practiceKey, result]) => {
        const labels = PRACTICAL_ACHIEVEMENT_LABELS[practiceKey];
        if (!labels) return null;

        const score = formatAchievementScore(result);
        return makeAchievement({
          id: `mobile-${practiceKey}`,
          icon: "mobile",
          title: labels.title,
          subtitle: `${score ? `${score} on ` : ""}${labels.subtitle}`,
          result,
          category: "Mobile Exam",
        });
      })
      .filter(Boolean);

    const practicalAchievements = Object.entries(PRACTICAL_ACHIEVEMENT_LABELS)
      .map(([testKey, labels]) => {
        const result = practicalTests[testKey];
        if (!result) return null;

        const score = formatAchievementScore(result);
        return makeAchievement({
          id: `${testKey}-practical-achievement`,
          icon: "badge",
          title: labels.title,
          subtitle: `${score ? `${score} on ` : ""}${labels.subtitle}`,
          result,
          category: testKey.toLowerCase().includes("amd")
            ? "AMD"
            : testKey.toLowerCase().includes("intel")
            ? "Intel"
            : "Practical",
          passingPercent: 75,
        });
      })
      .filter(Boolean);

    const achievements = [
      ...moduleAchievements,
      ...mobileModuleAchievements,
      ...mobileSpecificAchievements,
      ...mobilePracticeAchievements,
      ...practicalAchievements,
      ...savedAchievements,
    ].filter(
      (achievement, index, list) =>
        index === list.findIndex((item) => item.id === achievement.id)
    );

    const tests = [
  {
    id: "amd-full-disassembly-practical",
    title: "AMD Full Disassembly Practical Test",
    desc: "AMD PC disassembly validation",

    completed: !!practicalTests.amdDisassembly,

    progress: createTestProgress(
      practicalTests.amdDisassembly
    ),

    status: getTestStatus(
      practicalTests.amdDisassembly,
      disassemblyPracticalUnlocked
    ),

    locked:
      !disassemblyPracticalUnlocked &&
      !practicalTests.amdDisassembly,

    lockReason:
      "Complete Module 2 before accessing this practical test.",
  },

  {
    id: "intel-full-disassembly-practical",
    title: "Intel Full Disassembly Practical Test",
    desc: "Intel PC disassembly validation",

    completed: !!practicalTests.intelDisassembly,

    progress: createTestProgress(
      practicalTests.intelDisassembly
    ),

    status: getTestStatus(
      practicalTests.intelDisassembly,
      disassemblyPracticalUnlocked
    ),

    locked:
      !disassemblyPracticalUnlocked &&
      !practicalTests.intelDisassembly,

    lockReason:
      "Complete Module 2 before accessing this practical test.",
  },

  {
    id: "amd-full-assembly-practical",
    title: "AMD Full Assembly Practical Test",
    desc: "AMD PC assembly validation",

    completed: !!practicalTests.amdAssembly,

    progress: createTestProgress(
      practicalTests.amdAssembly
    ),

    status: getTestStatus(
      practicalTests.amdAssembly,
      assemblyPracticalUnlocked
    ),

    locked:
      !assemblyPracticalUnlocked &&
      !practicalTests.amdAssembly,

    lockReason:
      "Complete Module 3 before accessing this practical test.",
  },

  {
    id: "intel-full-assembly-practical",
    title: "INTEL Full Assembly Practical Test",
    desc: "INTEL PC assembly validation",

    completed: !!practicalTests.intelAssembly,

    progress: createTestProgress(
      practicalTests.intelAssembly
    ),

    status: getTestStatus(
      practicalTests.intelAssembly,
      assemblyPracticalUnlocked
    ),

    locked:
      !assemblyPracticalUnlocked &&
      !practicalTests.intelAssembly,

    lockReason:
      "Complete Module 3 before accessing this practical test.",
  },
];

    return { user, modules, activity, achievements, tests, mobileLearning };
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
        .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)[0] ||
      allModules.find((m) => m.progress === 0) ||
      allModules[0];

    return { completed, inProgress, notStarted, overall, nextUp };
  }, [allModules]);

  const isFullPracticalSection = [
    "AMD Full Assembly Practical",
    "AMD Full Disassembly Practical",
    "INTEL Full Assembly Practical",
    "INTEL Full Disassembly Practical",
  ].includes(section);
  const sectionLabel =
    isFullPracticalSection ||
    section === "Full Assembly Practical" ||
    section === "Full Disassembly Practical"
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
                    <SideItem label="3D Modules" active={sectionLabel} onClick={() => setSection("Modules")} icon="modules" />
                    <SideItem label="Practice Tests" active={sectionLabel} onClick={() => setSection("Practice Tests")} icon="tests" />
                    <SideItem label="Achievements" active={sectionLabel} onClick={() => setSection("Achievements")} icon="trophy" />
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
                <div
                  className={[
                    "grid h-full gap-4 overflow-hidden p-6 lg:p-8",
                    isFullPracticalSection ? "grid-rows-[1fr]" : "grid-rows-[auto_1fr]",
                  ].join(" ")}
                >
                  {isFullPracticalSection ? null : (
                    <HeaderBar section={section} sectionLabel={sectionLabel} user={user} onSettings={() => setIsSettingsOpen(true)} onLogout={onLogout} />
                  )}

                  <div
                    className={[
                      "scrollArea min-h-0 overflow-auto pr-1",
                      isFullPracticalSection ? "h-full overflow-hidden pr-0" : "",
                    ].join(" ")}
                  >
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
                              onAchievements={() => setSection("Achievements")}
                              tests={data.tests}
                              mobileLearning={data.mobileLearning}
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

                        {section === "Achievements" ? (
                          <PageMotion keyName="achievements" reduce={reduce}>
                            <AchievementsPage achievements={data.achievements} tests={data.tests} modules={allModules} />
                          </PageMotion>
                        ) : null}

                        {section === "AMD Full Assembly Practical" ? (
                          <PageMotion keyName="amd-full-assembly" reduce={reduce} className="relative h-full min-h-[680px] overflow-hidden">
                            <AMDFullAssemblyPracticalTest onBack={backToPracticeTests} />
                          </PageMotion>
                        ) : null}

                        {section === "AMD Full Disassembly Practical" ? (
                          <PageMotion keyName="amd-full-disassembly" reduce={reduce} className="relative h-full min-h-[680px] overflow-hidden">
                            <AMDFullDisassemblyPracticalTest onBack={backToPracticeTests} />
                          </PageMotion>
                        ) : null}

                        {section === "INTEL Full Assembly Practical" ? (
                          <PageMotion keyName="intel-full-assembly" reduce={reduce} className="relative h-full min-h-[680px] overflow-hidden">
                            <INTELFullAssemblyPracticalTest onBack={backToPracticeTests} />
                          </PageMotion>
                        ) : null}

                        {section === "INTEL Full Disassembly Practical" ? (
                          <PageMotion keyName="intel-full-disassembly" reduce={reduce} className="relative h-full min-h-[680px] overflow-hidden">
                            <INTELFullDisassemblyPracticalTest onBack={backToPracticeTests} />
                          </PageMotion>
                        ) : null}

                        {section === "Profile" ? (
                          <PageMotion keyName="profile" reduce={reduce}>
                            <ProfilePage
                              user={user}
                              stats={stats}
                              achievements={data.achievements}
                              tests={data.tests}
                              mobileLearning={data.mobileLearning}
                              firebaseUser={firebaseUser}
                              setProfile={setProfile}
                              isEditOpen={isProfileEditOpen}
                              onEditOpenChange={setIsProfileEditOpen}
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

function PageMotion({ keyName, reduce, children, className = "" }) {
  return (
    <motion.div
      key={keyName}
      className={className}
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
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 text-sm font-bold text-[#00ffb4]">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  (user.name || "U").charAt(0).toUpperCase()
                )}
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

function HomeOverview({
  setSection,
  overall,
  modules,
  nextUp,
  user,
  stats,
  achievements,
  activity,
  openModule,
  onAchievements,
  tests = [],
  mobileLearning,
}) {
  return (
   <div className="grid h-full min-h-0 grid-rows-[auto_auto_auto_auto_auto] gap-6 overflow-auto">
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Completed" value={`${stats.completed}`} hint="Modules finished" />
        <StatCard title="Overall" value={`${overall}%`} hint="Across all modules" />
        <StatCard title="Next up" value={nextUp?.title || "None"} hint="Last visited module" />
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <ProgressCardFillHeight overall={overall} modules={modules} onModuleClick={(id) => openModule(id)} />
        <RightColumnFill achievements={achievements} activity={activity} onAchievements={onAchievements} />
      </div>

      <MobileLearningSummaryCard mobileLearning={mobileLearning} />

      <PracticalScoresCard
        tests={tests}
        onViewAll={() => setSection("Practice Tests")}
      />
    </div>
  );
}
function PracticalScoresCard({ tests = [], onViewAll }) {
  const completedTests = tests.filter((test) => test.completed);

  return (
    <div className="rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-lg font-bold tracking-tight text-white">
            Practical Exam Scores
          </div>

          <div className="mt-1 text-sm text-[#7a8ba8]">
            Your latest results from Firebase Firestore
          </div>
        </div>

        {onViewAll ? (
        <button
          type="button"
          onClick={onViewAll}
          className="rounded-xl border border-[#00ffb4]/30 bg-[#00ffb4]/10 px-4 py-2 text-sm font-semibold text-[#00ffb4] transition hover:bg-[#00ffb4]/20"
        >
          View Tests →
        </button>
        ) : null}
      </div>

      {completedTests.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-[#1a2438] bg-white/[0.03] px-5 py-4 text-sm text-[#7a8ba8]">
          No practical-test result has been recorded yet.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {completedTests.map((test) => {
            const score = Number(test.progress?.score ?? 0);
            const passed = score >= 75;

            return (
              <div
                key={test.id}
                className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-5"
              >
                <div className="text-sm font-semibold leading-5 text-white">
                  {test.title}
                </div>

                <div className="mt-4 flex items-end gap-1">
                  <span className="text-3xl font-black text-[#00ffb4]">
                    {score}
                  </span>

                  <span className="pb-1 text-sm text-[#7a8ba8]">
                    /100
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-[#9fb0c9]">
                    Grade: {test.progress?.grade || "—"}
                  </span>

                  <span
                    className={
                      passed
                        ? "text-[#00ffb4]"
                        : "text-yellow-300"
                    }
                  >
                    {passed ? "Passed" : "Needs Retry"}
                  </span>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#00ffb4]"
                    style={{
                      width: `${Math.min(100, Math.max(0, score))}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MobileLearningSummaryCard({ mobileLearning }) {
  const modules = mobileLearning?.modules || [];
  const exams = mobileLearning?.exams || [];
  const moduleSummaries = modules.map((module) => {
    const passed = !!module.content?.completed && !!module.pre?.passed && !!module.post?.passed;
    const completed = !!module.content?.completed && !!module.pre?.completed && !!module.post?.completed;
    return {
      key: module.key,
      label: module.label,
      passed,
      status: passed ? "Passed" : completed ? "Completed" : "In progress",
    };
  });
  const passedModules = moduleSummaries.filter((module) => module.passed).length;
  const passedExams = exams.filter((exam) => exam.passed).length;

  return (
    <div className="rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-lg font-bold tracking-tight text-white">Mobile Learning Summary</div>
          <div className="mt-1 text-sm text-[#7a8ba8]">
            {passedModules}/{modules.length} modules passed · {passedExams}/{exams.length} exams passed
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          {moduleSummaries.map((module) => (
            <SummaryPill key={module.key} label={module.label.replace("Module ", "M")} status={module.status} passed={module.passed} />
          ))}
          {exams.map((exam, index) => (
            <SummaryPill key={exam.key} label={`Exam ${index + 1}`} status={exam.passed ? "Passed" : exam.completed ? "Completed" : "Not started"} passed={exam.passed} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryPill({ label, status, passed }) {
  return (
    <div
      className={[
        "min-w-[92px] rounded-2xl border px-3 py-2 text-center",
        passed
          ? "border-[#00ffb4]/25 bg-[#00ffb4]/10"
          : "border-white/10 bg-white/[0.03]",
      ].join(" ")}
    >
      <div className="text-xs font-semibold text-white">{label}</div>
      <div className={passed ? "mt-1 text-[11px] text-[#00ffb4]" : "mt-1 text-[11px] text-[#7a8ba8]"}>
        {status}
      </div>
    </div>
  );
}

function MobileLearningCard({ mobileLearning }) {
  const modules = mobileLearning?.modules || [];
  const exams = mobileLearning?.exams || [];

  return (
    <div className="rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-lg font-bold tracking-tight text-white">
            Mobile Learning Progress
          </div>
          <div className="mt-1 text-sm text-[#7a8ba8]">
            Module content, pre-tests, post-tests, and mobile exam results from Firestore
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {modules.map((module) => (
          <div
            key={module.key}
            className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4"
          >
            <div className="text-sm font-semibold text-white">{module.label}</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MobileStatusChip label="Content" item={module.content} />
              <MobileStatusChip label="Pre-test" item={module.pre} />
              <MobileStatusChip label="Post-test" item={module.post} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {exams.map((exam) => (
          <MobileStatusChip key={exam.key} label={exam.label} item={exam} large />
        ))}
      </div>
    </div>
  );
}

function MobileStatusChip({ label, item, large = false }) {
  const completed = !!item?.completed;
  const passed = !!item?.passed;
  const scoreText =
    item?.scorePercent !== null && item?.scorePercent !== undefined
      ? `${item.scorePercent}%`
      : "No score";

  return (
    <div
      className={[
        "rounded-2xl border px-3 py-3",
        large ? "bg-white/[0.03]" : "bg-[#0b1220]",
        completed
          ? passed
            ? "border-[#00ffb4]/25 text-[#b7fff0]"
            : "border-yellow-300/25 text-yellow-200"
          : "border-white/10 text-[#9fb0c9]",
      ].join(" ")}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</div>
      <div className="mt-2 text-sm font-bold text-white">
        {completed ? item.status : "Not started"}
      </div>
      <div className="mt-1 text-xs text-[#7a8ba8]">{scoreText}</div>
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
                  onClick={() => onOpenModule?.(m.id)}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-[#00ffb4]/30 bg-[#00ffb4]/12 px-7 py-2.5 text-sm font-semibold text-[#00ffb4]"
                >
                  {m.selectionCta}
                  <span className="text-[#b7fff0]">→</span>
                </button>
               
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

function ProfilePage({
  user,
  stats,
  achievements,
  tests = [],
  mobileLearning,
  firebaseUser,
  setProfile,
  isEditOpen: controlledIsEditOpen,
  onEditOpenChange,
}) {
  const [localIsEditOpen, setLocalIsEditOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mi, setMi] = useState("");
  const [previewImage, setPreviewImage] = useState(user.avatarUrl || "");
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const isEditOpen = typeof controlledIsEditOpen === "boolean" ? controlledIsEditOpen : localIsEditOpen;
  const setIsEditOpen = typeof onEditOpenChange === "function" ? onEditOpenChange : setLocalIsEditOpen;

  useEffect(() => {
    const parts = (user.name || "").trim().split(" ");

    setFirstName(parts[0] || "");
    setLastName(parts.length > 1 ? parts[parts.length - 1] : "");
    setMi(user.middleInitial || "");
    setPreviewImage(user.avatarUrl || "");
    setSelectedImageFile(null);
    setProfileError("");
  }, [user.name, user.avatarUrl, user.middleInitial]);

  const fullName = `${firstName} ${mi ? mi + "." : ""} ${lastName}`.trim();

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateProfileImage(file);
    if (validationError) {
      setProfileError(validationError);
      return;
    }

    setProfileError("");
    setSelectedImageFile(file);
    setPreviewImage(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!firebaseUser?.uid) {
      setProfileError("No logged-in user found.");
      return;
    }

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanMi = mi.trim().toUpperCase();

    if (!cleanFirstName || !cleanLastName) {
      setProfileError("First name and last name are required.");
      return;
    }

    setIsSavingProfile(true);
    setProfileError("");

    try {
      let avatarUrl = user.avatarUrl || "";

      if (selectedImageFile) {
        const fallbackAvatarUrl = await createProfileImageDataUrl(selectedImageFile);
        const safeFileName = selectedImageFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const imageRef = ref(
          storage,
          `profile-photos/${firebaseUser.uid}/${Date.now()}-${safeFileName}`
        );

        try {
          await uploadBytes(imageRef, selectedImageFile, {
            contentType: selectedImageFile.type,
          });
          avatarUrl = await getDownloadURL(imageRef);
        } catch (uploadError) {
          console.warn("Profile photo storage upload failed; saving compressed image to Firestore instead.", uploadError);
          avatarUrl = fallbackAvatarUrl;
        }
      }

      const userRef = doc(db, "users", firebaseUser.uid);

      await updateDoc(userRef, {
        firstName: cleanFirstName,
        lastName: cleanLastName,
        middleInitial: cleanMi,
        avatarUrl,
        updatedAt: serverTimestamp(),
      });

      setProfile((prev) => ({
        ...prev,
        firstName: cleanFirstName,
        lastName: cleanLastName,
        middleInitial: cleanMi,
        avatarUrl,
      }));

      setPreviewImage(avatarUrl);
      setSelectedImageFile(null);
      setIsEditOpen(false);
    } catch (err) {
      console.error("Error updating profile:", err);
      setProfileError(err?.code === "permission-denied"
        ? "You do not have permission to update this profile."
        : "Could not save your profile. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <>
      <div className="w-full">
        <div className="relative min-h-[280px] w-full overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_26px_80px_rgba(0,0,0,0.38)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(0,255,180,0.09),transparent_34%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_92%_15%,rgba(0,180,255,0.04),transparent_30%)]" />

          <div className="relative grid min-h-[280px] grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)]">
            <section className="flex h-full flex-col p-6 lg:p-8 xl:border-r xl:border-[#1a2438]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold tracking-tight text-[#e8ecf4]">
                    My Profile
                  </div>
                  <div className="mt-1 text-xs text-[#7a8ba8]">
                    Account and learning overview
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditOpen(true)}
                  className="rounded-xl border border-[#00ffb4]/25 bg-[#00ffb4]/10 px-3.5 py-2 text-xs font-semibold text-[#00ffb4] transition hover:bg-[#00ffb4]/16 focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
                >
                  Edit Profile
                </button>
              </div>

              <div className="mt-6 flex items-center gap-4">
                <ProfileAvatar
                  image={previewImage}
                  fallback={(firstName || user.name || "U").charAt(0).toUpperCase()}
                  large
                />

                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold text-white">
                    {fullName || user.name}
                  </div>
                  <div className="mt-1 truncate text-sm text-[#7a8ba8]">
                    {user.email}
                  </div>
                </div>
              </div>

              <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
                <MiniStat title="Completed" value={`${stats.completed}`} />
                <MiniStat title="Overall" value={`${stats.overall}%`} />

                <div className="col-span-2">
                  <MiniStat
                    title="Current Focus"
                    value={stats.nextUp?.title || "No module yet"}
                  />
                </div>
              </div>
            </section>

            <section className="flex min-w-0 flex-col p-6 lg:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold tracking-tight text-[#e8ecf4]">
                    Badges
                  </div>
                  <div className="mt-1 text-xs text-[#7a8ba8]">
                    Your latest unlocked achievements
                  </div>
                </div>

                <span className="rounded-full border border-[#00ffb4]/20 bg-[#00ffb4]/10 px-3 py-1.5 text-xs font-semibold text-[#00ffb4]">
                  {achievements.length} unlocked
                </span>
              </div>

              <div className="mt-5 grid flex-1 auto-rows-fr gap-3 md:grid-cols-2 2xl:grid-cols-4">
                {achievements.length ? (
                  achievements.slice(0, 4).map((achievement) => (
                    <AchievementRow
                      key={achievement.id}
                      {...achievement}
                      onClick={() => console.log(achievement.id)}
                    />
                  ))
                ) : (
                  <div className="md:col-span-2 2xl:col-span-4">
                    <EmptyBadgeState />
                  </div>
                )}
              </div>

              {achievements.length > 4 ? (
                <div className="mt-auto pt-4 text-right text-xs text-[#7a8ba8]">
                  +{achievements.length - 4} more badge
                  {achievements.length - 4 === 1 ? "" : "s"} available on the
                  Achievements page
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <MobileLearningCard mobileLearning={mobileLearning} />
        <PracticalScoresCard tests={tests} />
      </div>

      <AnimatePresence>
        {isEditOpen && (
          <motion.div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.97 }} transition={{ duration: 0.18 }} className="w-full max-w-lg overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_30px_100px_rgba(0,0,0,0.65)]">
              <div className="flex items-center justify-between border-b border-[#1a2438] px-6 py-5">
                <div>
                  <div className="text-lg font-bold text-white">Edit Profile</div>
                  <div className="text-xs text-[#7a8ba8]">Update your saved profile</div>
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
                      <input type="file" accept="image/*" onChange={handleImageChange} disabled={isSavingProfile} className="hidden" />
                    </label>
                    <div className="mt-2 text-xs text-[#7a8ba8]">JPG, PNG, or WebP up to 5MB.</div>
                  </div>
                </div>

                {profileError ? (
                  <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
                    {profileError}
                  </div>
                ) : null}

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
                  <button type="button" onClick={() => setIsEditOpen(false)} disabled={isSavingProfile} className="rounded-xl border border-[#1a2438] bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60">
                    Cancel
                  </button>

                  <button type="button" onClick={handleSave} disabled={isSavingProfile} className="rounded-xl bg-[#00ffb4] px-5 py-2.5 text-sm font-bold text-[#0a0e17] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100">
                    {isSavingProfile ? "Saving..." : "Save changes"}
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
    <div className={`${large ? "h-20 w-20 text-2xl" : "h-12 w-12 text-base"} flex items-center justify-center overflow-hidden rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 font-bold text-[#00ffb4]`}>
      {image ? <img src={image} alt="Profile" className="h-full w-full object-cover" /> : fallback}
    </div>
  );
}

function RightColumnFill({ achievements, activity, onAchievements }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <AchievementsCardCompact achievements={achievements} onClick={onAchievements} />
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
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-bold tracking-tight text-[#e8ecf4]">Achievements</div>
          <button type="button" onClick={onClick} className="rounded-xl border border-[#1a2438] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-[#9fb0c9] transition hover:bg-white/[0.06]">
            View all
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {achievements.length ? (
            achievements.slice(0, 3).map((achievement) => (
              <AchievementRow key={achievement.id} {...achievement} onClick={onClick} />
            ))
          ) : (
            <EmptyBadgeState compact />
          )}
        </div>
        <div className="mt-4 text-right">
          <button type="button" onClick={onClick} className="inline-flex rounded-full border border-[#1a2438] bg-white/[0.03] px-3 py-1.5 text-[11px] text-[#7a8ba8] transition hover:bg-white/[0.06]">
            +{Math.max(0, achievements.length - 3)} more
          </button>
        </div>
      </div>
    </div>
  );
}

function AchievementsPage({ achievements = [], tests = [], modules = [] }) {
  const passedTests = tests.filter((test) => test.completed && Number(test.progress?.score ?? 0) >= 75).length;
  const completedModules = modules.filter((module) => module.progress >= 100).length;
  const mobileBadges = achievements.filter((achievement) => achievement.category?.includes("Mobile")).length;
  const prePostBadges = achievements.filter((achievement) => achievement.icon === "pre" || achievement.icon === "post").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Achievements" value={`${achievements.length}`} hint="Unlocked badges" />
        <StatCard title="Mobile Badges" value={`${mobileBadges}`} hint="Pre-tests, post-tests, and exams" />
        <StatCard title="Pre/Post Tests" value={`${prePostBadges}`} hint="Specific assessment badges" />
      </div>

      <div className="rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-7 shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
        <div>
          <div className="text-lg font-bold tracking-tight text-[#e8ecf4]">All Achievements</div>
          <div className="mt-1 text-sm text-[#7a8ba8]">
            {completedModules} modules complete, {passedTests} practical passes
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {achievements.length ? (
            achievements.map((achievement) => (
              <AchievementRow key={achievement.id} {...achievement} />
            ))
          ) : (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyBadgeState />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AchievementRow({
  icon,
  title,
  subtitle,
  category = "Achievement",
  scoreText = "",
  statusText = "",
  passed = false,
  onClick,
}) {
  const motionPreset = useCardMotion();
  const interactive = typeof onClick === "function";

  return (
    <motion.button type="button" onClick={onClick} {...motionPreset} className="flex h-full w-full items-start gap-4 rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4 text-left focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25 disabled:cursor-default" aria-label={`Open achievement ${title}`} disabled={!interactive}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00ffb4]/18 bg-[#00ffb4]/10">
        <Icon kind={icon} active />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 text-sm font-semibold text-white">{title}</div>
          <span className="rounded-full border border-[#00ffb4]/20 bg-[#00ffb4]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#00ffb4]">
            {category}
          </span>
        </div>
        <div className="mt-1 text-[12px] leading-5 text-[#7a8ba8]">{subtitle}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {statusText ? (
            <span className={passed ? "rounded-full bg-[#00ffb4]/10 px-2 py-1 text-[11px] font-bold text-[#00ffb4]" : "rounded-full bg-yellow-300/10 px-2 py-1 text-[11px] font-bold text-yellow-200"}>
              {statusText}
            </span>
          ) : null}
          {scoreText ? (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] font-bold text-[#dbe6f5]">
              {scoreText}
            </span>
          ) : null}
        </div>
      </div>
    </motion.button>
  );
}

function EmptyBadgeState({ compact = false }) {
  return (
    <div className={compact ? "rounded-2xl border border-dashed border-[#1a2438] bg-white/[0.02] p-4 text-sm text-[#7a8ba8]" : "rounded-2xl border border-dashed border-[#1a2438] bg-white/[0.02] p-5 text-sm text-[#7a8ba8]"}>
      No achievements unlocked yet.
    </div>
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
    <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] text-[#7a8ba8]">{title}</div>
      <div className="mt-1 text-base font-extrabold text-white">{value}</div>
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

  if (kind === "mobile") return <div className="text-xs font-black text-[#00ffb4]">MB</div>;
  if (kind === "pre") return <div className="text-[10px] font-black text-[#00ffb4]">PRE</div>;
  if (kind === "post") return <div className="text-[9px] font-black text-[#00ffb4]">POST</div>;

  return <div className={`h-4 w-4 rounded ${fill}`} />;
}
