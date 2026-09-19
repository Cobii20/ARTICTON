import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase.js";

const startPractical = httpsCallable(functions, "startPracticalAttempt");
const finishPractical = httpsCallable(functions, "finishPracticalAttempt");
const PRACTICAL_REQUEST_TIMEOUT_MS = 20_000;

function withTimeout(request, operation) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${operation} timed out. Check your connection and try again.`));
    }, PRACTICAL_REQUEST_TIMEOUT_MS);
  });

  return Promise.race([request, timeout]).finally(() => window.clearTimeout(timeoutId));
}

export function practicalErrorMessage(error, operation = "continued") {
  const code = String(error?.code || "").replace(/^functions\//, "");
  if (code === "unauthenticated") return "Your session expired. Sign in again before starting the practical test.";
  if (code === "resource-exhausted") return "Too many practical-test requests were made. Wait a minute, then try again.";
  if (code === "not-found") return "The practical-test service is not deployed yet. Ask the administrator to deploy the Firebase functions.";
  if (code === "failed-precondition") return "This practical attempt is no longer active. Retry the test to create a new attempt.";
  if (code === "permission-denied") return "This account is not allowed to use the practical-test service.";
  if (code === "internal" || code === "unavailable") return "The practical-test service is temporarily unavailable. Try again shortly.";
  return error?.message || `The practical test could not be ${operation}. Check your connection and try again.`;
}

export async function startAuthoritativePractical(practicalId) {
  const response = await withTimeout(startPractical({ practicalId }), "Starting the practical test");
  const attemptId = response?.data?.attemptId;
  if (typeof attemptId !== "string" || !attemptId) {
    throw new Error("The server did not create a valid practical attempt.");
  }
  return attemptId;
}

export async function finishAuthoritativePractical({
  attemptId,
  practicalId,
  wrongOrderCount,
  completedParts,
}) {
  if (!attemptId) throw new Error("No active server practical attempt was found.");
  const response = await withTimeout(
    finishPractical({ attemptId, practicalId, wrongOrderCount, completedParts }),
    "Finalizing the practical test"
  );
  const result = response?.data;
  if (!result || !Number.isFinite(result.score)) {
    throw new Error("The server did not return a valid practical result.");
  }
  return result;
}
