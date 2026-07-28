import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export const MOBILE_SCORE_SUBCOLLECTIONS = [
  "module_scores",
  "practice_scores",
  "scores",
  "mobileScores",
  "studentScores",
  "quizScores",
  "practicalScores",
];

const SCORE_KEY_ALIASES = {
  module1: ["module1", "module_1", "module 1", "m1", "quiz1", "quiz 1"],
  module2: ["module2", "module_2", "module 2", "m2", "quiz2", "quiz 2"],
  module3: ["module3", "module_3", "module 3", "m3", "quiz3", "quiz 3"],
  module4: ["module4", "module_4", "module 4", "m4", "quiz4", "quiz 4"],
  fullAssembly: ["fullassembly", "full_assembly", "assembly", "assemble"],
  fullDisassembly: ["fulldisassembly", "full_disassembly", "disassembly", "disassemble"],
  practiceExam1: ["practice_exam_1", "practice exam 1"],
  practiceExam2: ["practice_exam_2", "practice exam 2"],
  amdAssembly: ["amdassembly", "amd_assembly", "amd assembly"],
  intelAssembly: ["intelassembly", "intel_assembly", "intel assembly"],
  amdDisassembly: ["amddisassembly", "amd_disassembly", "amd disassembly"],
  intelDisassembly: ["inteldisassembly", "intel_disassembly", "intel disassembly"],
};

function compactText(...values) {
  return values
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesAlias(text, aliases) {
  const normalized = compactText(text);
  return aliases.some((alias) => normalized.includes(compactText(alias)));
}

function getScorePercent(data) {
  const direct =
    data.scorePercent ??
    data.percent ??
    data.percentage ??
    data.latestPercent ??
    data.finalPercent;

  const directNumber = Number(direct);
  if (Number.isFinite(directNumber)) {
    return Math.max(0, Math.min(100, Math.round(directNumber)));
  }

  const score = Number(data.score ?? data.latestScore ?? data.finalScore);
  const total = Number(data.total ?? data.latestTotal ?? data.maxScore);

  if (Number.isFinite(score) && Number.isFinite(total) && total > 0) {
    return Math.max(0, Math.min(100, Math.round((score / total) * 100)));
  }

  if (Number.isFinite(score) && score >= 0 && score <= 100) {
    return Math.round(score);
  }

  return null;
}

function getModuleScorePriority(data) {
  const testType = normalizeAssessmentType(data);
  if (testType === "post_test") return 3;
  if (testType === "pre_test") return 2;
  if (testType === "content") return 1;
  return 0;
}

function normalizeAssessmentType(data = {}) {
  const text = compactText(
    data.testType,
    data.assessmentType,
    data.type,
    data.category,
    data.title,
    data.name,
    data.id,
    data.assessmentId,
    data.testId
  );

  if (text.includes("post test") || text.includes("posttest") || text.includes("post")) {
    return "post_test";
  }

  if (text.includes("pre test") || text.includes("pretest") || text.includes("pre")) {
    return "pre_test";
  }

  if (text.includes("content") || text.includes("lesson")) {
    return "content";
  }

  return data.testType || "";
}

function getModuleActivityName(data) {
  const testType = normalizeAssessmentType(data);
  if (testType === "content") return "Content";
  if (testType === "pre_test") return "Pre";
  if (testType === "post_test") return "Post";
  return "";
}

function shouldReplaceModuleScore(current, incoming) {
  if (!current) return true;
  if (normalizeAssessmentType(incoming) === "content" && getScorePercent(current) !== null) {
    return false;
  }

  const currentPriority = getModuleScorePriority(current);
  const incomingPriority = getModuleScorePriority(incoming);
  if (incomingPriority !== currentPriority) {
    return incomingPriority > currentPriority;
  }

  const currentPercent = getScorePercent(current) ?? -1;
  const incomingPercent = getScorePercent(incoming) ?? -1;
  return incomingPercent >= currentPercent;
}

function toProgressPayload(data) {
  const scorePercent = getScorePercent(data);
  const completed =
    data.completed === true ||
    data.finished === true ||
    data.status === "completed" ||
    data.status === "passed" ||
    scorePercent !== null;

  return {
    ...data,
    completed,
    finished: data.finished ?? completed,
    score: data.score ?? data.latestScore ?? data.finalScore ?? scorePercent,
    total: data.total ?? data.latestTotal ?? data.maxScore ?? 100,
    percent: data.percent ?? scorePercent,
    scorePercent,
    passed: data.passed ?? (scorePercent !== null ? scorePercent >= 60 : false),
  };
}

function toPracticalTestPayload(data) {
  const scorePercent = getScorePercent(data);

  return {
    ...data,
    score: data.score ?? data.latestScore ?? data.finalScore ?? scorePercent ?? 0,
    grade: data.grade || data.letterGrade || "-",
    elapsedSeconds: Number(data.elapsedSeconds ?? data.durationSeconds ?? data.timeSeconds ?? 0),
    wrongOrderCount: Number(data.wrongOrderCount ?? data.wrongOrder ?? 0),
    fumbleCount: Number(data.fumbleCount ?? data.fumbles ?? 0),
  };
}

function detectScoreKey(data, id) {
  const text = compactText(
    id,
    data.key,
    data.scoreKey,
    data.assessmentKey,
    data.assessmentId,
    data.testId,
    data.quizId,
    data.moduleId,
    data.module,
    data.type,
    data.title,
    data.name
  );

  if (includesAlias(text, SCORE_KEY_ALIASES.amdDisassembly)) return "amdDisassembly";
  if (includesAlias(text, SCORE_KEY_ALIASES.intelDisassembly)) return "intelDisassembly";
  if (includesAlias(text, SCORE_KEY_ALIASES.amdAssembly)) return "amdAssembly";
  if (includesAlias(text, SCORE_KEY_ALIASES.intelAssembly)) return "intelAssembly";
  if (includesAlias(text, SCORE_KEY_ALIASES.practiceExam1)) return "practiceExam1";
  if (includesAlias(text, SCORE_KEY_ALIASES.practiceExam2)) return "practiceExam2";
  if (includesAlias(text, SCORE_KEY_ALIASES.fullDisassembly)) return "fullDisassembly";
  if (includesAlias(text, SCORE_KEY_ALIASES.fullAssembly)) return "fullAssembly";
  if (includesAlias(text, SCORE_KEY_ALIASES.module1)) return "module1";
  if (includesAlias(text, SCORE_KEY_ALIASES.module2)) return "module2";
  if (includesAlias(text, SCORE_KEY_ALIASES.module3)) return "module3";
  if (includesAlias(text, SCORE_KEY_ALIASES.module4)) return "module4";

  return null;
}

export async function fetchMobileScoreDocs(userId) {
  const reads = await Promise.allSettled(
    MOBILE_SCORE_SUBCOLLECTIONS.map(async (collectionName) => {
      const snapshot = await getDocs(collection(db, "users", userId, collectionName));
      return snapshot.docs.map((scoreDoc) => ({
        id: scoreDoc.id,
        collectionName,
        ...scoreDoc.data(),
      }));
    })
  );

  return reads.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

export function mergeMobileScoresIntoProfile(profile = {}, mobileScoreDocs = []) {
  const quizProgress = { ...(profile.quizProgress || {}) };
  const practicalProgress = { ...(profile.practicalProgress || {}) };
  const practicalTests = { ...(profile.practicalTests || {}) };
  const mobileModuleScores = { ...(profile.mobileModuleScores || {}) };
  const mobilePracticeScores = { ...(profile.mobilePracticeScores || {}) };
  const mobileSpecificAssessments = { ...(profile.mobileSpecificAssessments || {}) };

  mobileScoreDocs.forEach((scoreDoc) => {
    const scoreKey = detectScoreKey(scoreDoc, scoreDoc.id);
    if (!scoreKey) return;

    const activityName = getModuleActivityName(scoreDoc);

    if (scoreKey.startsWith("module")) {
      if (activityName) {
        mobileModuleScores[`${scoreKey}${activityName}`] = toProgressPayload(scoreDoc);
      }

      if (shouldReplaceModuleScore(quizProgress[scoreKey], scoreDoc)) {
        quizProgress[scoreKey] = toProgressPayload(scoreDoc);
      }
      return;
    }

    if (activityName) {
      mobileSpecificAssessments[`${scoreKey}${activityName}`] = toProgressPayload(scoreDoc);
      return;
    }

    if (scoreKey === "practiceExam1" || scoreKey === "practiceExam2") {
      const payload = toProgressPayload(scoreDoc);
      mobilePracticeScores[scoreKey] = payload;

      if (scoreKey === "practiceExam1") {
        practicalProgress.fullDisassembly = payload;
      } else {
        practicalProgress.fullAssembly = payload;
      }
      return;
    }

    if (scoreKey === "fullAssembly" || scoreKey === "fullDisassembly") {
      practicalProgress[scoreKey] = toProgressPayload(scoreDoc);
      return;
    }

    practicalTests[scoreKey] = toPracticalTestPayload(scoreDoc);
  });

  const hasMobileScores = mobileScoreDocs.length > 0;

  return {
    ...profile,
    quizProgress,
    practicalProgress,
    practicalTests,
    mobileModuleScores,
    mobilePracticeScores,
    mobileSpecificAssessments,
    hasMobileScores,
  };
}
