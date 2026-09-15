import { addDoc, collection, doc, getDocFromServer, getDocs, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { MOBILE_QUESTION_DEFAULTS } from "../data/mobileQuestionDefaults";
import { assertCurrentRevision, snapshotQuestionBank, validateQuestions } from "./questionBankModel";

function currentUid() {
  if (!auth.currentUser) throw new Error("Please sign in again.");
  return auth.currentUser.uid;
}

export async function loadQuestionBank(assessmentId) {
  const snapshot = await getDocFromServer(doc(db, "published_question_banks", assessmentId));
  if (snapshot.exists()) return snapshot.data();
  const defaults = MOBILE_QUESTION_DEFAULTS[assessmentId];
  if (!defaults) throw new Error("No built-in questions are available for this assessment.");
  return { revision: 0, questions: structuredClone(defaults), source: "mobile-defaults" };
}

// Call once when an attempt starts. Never subscribe an active attempt to bank changes.
export async function loadPublishedAttempt(assessmentId) {
  return snapshotQuestionBank(await loadQuestionBank(assessmentId));
}

export async function loadQuestionRequests(admin = false) {
  const constraint = admin ? where("status", "==", "pending") : where("requestedBy", "==", currentUid());
  const snapshot = await getDocs(query(collection(db, "question_change_requests"), constraint));
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.id }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function submitQuestionRequest({ assessmentId, baseRevision, before, questions, summary }) {
  const normalized = validateQuestions(questions);
  if (!summary.trim()) throw new Error("Provide a change summary before submitting.");
  if (!Number.isInteger(baseRevision) || baseRevision < 0) throw new Error("Reload the question bank before submitting.");
  return addDoc(collection(db, "question_change_requests"), {
    assessmentId, baseRevision, questionCount: normalized.length,
    before, questions: normalized, summary: summary.trim(), status: "pending",
    requestedBy: currentUid(), createdAt: serverTimestamp(), reviewedBy: null, reviewedAt: null,
  });
}

export async function reviewQuestionRequest(requestId, approve) {
  const uid = currentUid();
  return runTransaction(db, async (transaction) => {
    const requestRef = doc(db, "question_change_requests", requestId);
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists()) throw new Error("This request no longer exists.");
    const request = snapshot.data();
    if (request.status !== "pending") throw new Error("This request has already been reviewed.");
    if (approve) {
      const bankRef = doc(db, "published_question_banks", request.assessmentId);
      const bank = await transaction.get(bankRef);
      const revision = assertCurrentRevision(request, bank.exists() ? bank.data() : null);
      validateQuestions(request.questions);
      transaction.set(bankRef, {
        questions: request.questions, revision: revision + 1, sourceRequestId: requestId,
        approvedBy: uid, approvedAt: serverTimestamp(),
      });
    }
    transaction.update(requestRef, { status: approve ? "approved" : "rejected", reviewedBy: uid, reviewedAt: serverTimestamp() });
  });
}
