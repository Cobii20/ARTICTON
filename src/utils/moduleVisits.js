const keyFor = (uid) => `articton-module-visits-v1:${uid}`;
const routes = /^module-(1|2|3)(?:-(amd|intel))?$/;

function readVisits(uid) {
  if (!uid || typeof localStorage === "undefined") return {};
  try {
    const data = JSON.parse(localStorage.getItem(keyFor(uid)) || "{}");
    return data && typeof data === "object" ? data : {};
  } catch { return {}; }
}

export function getModuleVisit(uid, route) {
  const visit = readVisits(uid)[route];
  return visit && routes.test(visit.route) && visit.route === route &&
    typeof visit.activity === "string" && Number.isFinite(visit.visitedAt) ? visit : null;
}

export function getLastModuleVisit(uid) {
  return Object.keys(readVisits(uid)).map((route) => getModuleVisit(uid, route))
    .filter(Boolean).sort((a, b) => b.visitedAt - a.visitedAt)[0] || null;
}

export function recordModuleVisit(uid, visit) {
  if (!uid || !routes.test(visit.route) || typeof localStorage === "undefined") return;
  const data = readVisits(uid);
  const previousTime = Math.max(0, ...Object.values(data).map((item) => Number(item?.visitedAt) || 0));
  data[visit.route] = { ...visit, moduleId: visit.route.slice(0, 8), visitedAt: Math.max(Date.now(), previousTime + 1) };
  try { localStorage.setItem(keyFor(uid), JSON.stringify(data)); } catch { /* Storage may be unavailable. */ }
}

// These checkpoints restore the simulation only; they never award course credit.
export function getPracticeCheckpoint(uid, route, steps, sequence) {
  const saved = getModuleVisit(uid, route)?.snapshot;
  const empty = { step: 0, completedParts: [], finalRoundCompletedParts: [], showIntro: true };
  if (!saved || !Array.isArray(saved.completedParts) || !Array.isArray(saved.finalRoundCompletedParts)) return empty;
  const validParts = (parts) => parts.every((part) => sequence.includes(part)) && new Set(parts).size === parts.length;
  if (!validParts(saved.completedParts) || !validParts(saved.finalRoundCompletedParts) ||
      !Number.isInteger(saved.step) || saved.step < 0 || saved.step >= steps.length) return empty;
  if (saved.step === steps.length - 1 && saved.completedParts.length !== sequence.length) return empty;
  const guided = steps.filter((step) => step.key !== "final");
  const complete = (step, parts) => step.partKeys.filter((part) => parts.includes(part)).length >=
    (step.requiredCount || step.partKeys.length);
  const validOrder = (parts) => {
    const firstIncomplete = guided.findIndex((step) => !complete(step, parts));
    const available = guided.slice(0, firstIncomplete + 1).flatMap((step) => step.partKeys);
    return firstIncomplete < 0 || parts.every((part) => available.includes(part));
  };
  if (!validOrder(saved.completedParts) || !validOrder(saved.finalRoundCompletedParts) ||
      guided.slice(0, saved.step).some((step) => !complete(step, saved.completedParts)) ||
      (saved.step !== steps.length - 1 && saved.finalRoundCompletedParts.length > 0)) return empty;
  // Completed simulations start as a clean retake when reopened. Incomplete
  // simulations still resume below, while saved course completion records and
  // achievements remain untouched in Firestore.
  if (saved.finalRoundCompletedParts.length === sequence.length) return empty;
  // A visit may happen during the animation before the next instruction opens.
  const firstIncomplete = guided.findIndex((step) => !complete(step, saved.completedParts));
  const step = firstIncomplete < 0 ? steps.length - 1 : firstIncomplete;
  return { ...saved, step, showIntro: saved.showIntro !== false };
}
