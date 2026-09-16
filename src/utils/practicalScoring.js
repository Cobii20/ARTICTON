export const PRACTICAL_STARTING_SCORE = 100;
export const PRACTICAL_PASSING_PERCENT = 75;
export const SEQUENCE_ERROR_PENALTY = 6;
export const SEQUENCE_DEDUCTION_CAP = 25;
export const TIME_GRACE_SECONDS = 120;
export const TIME_DEDUCTION_CAP = 25;

export function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function calculatePracticalScore({
  wrongOrderCount = 0,
  elapsedSeconds = 0,
  startingScore = PRACTICAL_STARTING_SCORE,
} = {}) {
  const safeStartingScore = Math.max(0, Number(startingScore) || PRACTICAL_STARTING_SCORE);
  const safeWrongOrderCount = Math.max(0, Math.floor(Number(wrongOrderCount) || 0));
  const safeElapsedSeconds = Math.max(0, Number(elapsedSeconds) || 0);
  const completedElapsedSeconds = Math.floor(safeElapsedSeconds);

  const sequenceDeduction = Math.min(
    SEQUENCE_DEDUCTION_CAP,
    safeWrongOrderCount * SEQUENCE_ERROR_PENALTY
  );
  const timeOverageSeconds = Math.max(0, completedElapsedSeconds - TIME_GRACE_SECONDS);
  const timeDeduction = Math.min(TIME_DEDUCTION_CAP, timeOverageSeconds);
  const finalScore = Math.max(0, safeStartingScore - sequenceDeduction - timeDeduction);
  const finalPercentage =
    safeStartingScore > 0 ? (finalScore / safeStartingScore) * 100 : 0;
  const passed = finalPercentage >= PRACTICAL_PASSING_PERCENT;

  return {
    startingScore: safeStartingScore,
    score: finalScore,
    finalScore,
    percent: finalPercentage,
    percentage: finalPercentage,
    scorePercent: finalPercentage,
    passed,
    status: passed ? "Passed" : "Failed",
    wrongOrderCount: safeWrongOrderCount,
    sequenceDeduction,
    orderPenaltyPoints: sequenceDeduction,
    timeDeduction,
    timePenaltyPoints: timeDeduction,
    elapsedSeconds: safeElapsedSeconds,
    completedElapsedSeconds,
    totalDeduction: sequenceDeduction + timeDeduction,
  };
}

export function computePracticalGrade(scoreOrPercent) {
  const percent = Math.max(0, Number(scoreOrPercent) || 0);
  if (percent >= 93) return { letter: "A", tone: "Excellent" };
  if (percent >= 85) return { letter: "B", tone: "Solid" };
  if (percent >= PRACTICAL_PASSING_PERCENT) return { letter: "C", tone: "Passing" };
  if (percent >= 65) return { letter: "D", tone: "Needs Review" };
  return { letter: "F", tone: "Retry Recommended" };
}

export function normalizePracticalResult(data = {}) {
  const startingScore = Number(data.startingScore ?? data.total ?? PRACTICAL_STARTING_SCORE);
  const rawScore = Number(data.finalScore ?? data.score ?? data.latestScore);
  const directPercent = Number(data.scorePercent ?? data.percent ?? data.percentage);
  const score = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(startingScore || PRACTICAL_STARTING_SCORE, rawScore))
    : Number.isFinite(directPercent)
    ? Math.max(0, Math.min(100, directPercent))
    : 0;
  const scorePercent =
    Number.isFinite(directPercent)
      ? Math.max(0, Math.min(100, directPercent))
      : startingScore > 0
      ? (score / startingScore) * 100
      : 0;
  const passed = scorePercent >= PRACTICAL_PASSING_PERCENT;

  return {
    ...data,
    startingScore: startingScore || PRACTICAL_STARTING_SCORE,
    score,
    finalScore: score,
    percent: scorePercent,
    percentage: scorePercent,
    scorePercent,
    passed,
    status: passed ? "Passed" : "Failed",
    elapsedSeconds: Number(data.elapsedSeconds ?? data.durationSeconds ?? data.timeSeconds ?? 0),
    wrongOrderCount: Number(data.wrongOrderCount ?? data.wrongOrder ?? 0),
    sequenceDeduction: Number(data.sequenceDeduction ?? data.orderPenaltyPoints ?? 0),
    timeDeduction: Number(data.timeDeduction ?? data.timePenaltyPoints ?? 0),
  };
}
