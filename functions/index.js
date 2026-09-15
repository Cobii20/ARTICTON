const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { PROCEDURE_DETAILS, getProcedureText } = require("./procedureNotes");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const authAdmin = admin.auth();

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_TUTOR_ENABLED = process.env.GEMINI_TUTOR_ENABLED === "true";

function requireAuthenticatedUser(request) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must sign in to continue."
    );
  }

  const uid = request.auth.uid;
  const email = String(request.auth.token.email || "").trim().toLowerCase();
  const authTime = Number(request.auth.token.auth_time);

  if (!email) {
    throw new HttpsError(
      "failed-precondition",
      "The authenticated account does not have an email address."
    );
  }

  if (!Number.isFinite(authTime)) {
    throw new HttpsError(
      "failed-precondition",
      "The authentication session is invalid."
    );
  }

  return { uid, email, authTime };
}

async function assertAdmin(request) {
  const authContext = await requireAuthenticatedUser(request);
  const profileSnapshot = await db.doc(`users/${authContext.uid}`).get();

  if (!profileSnapshot.exists) {
    throw new HttpsError("permission-denied", "Administrator profile not found.");
  }

  const role = String(profileSnapshot.data().role || "").toLowerCase();

  if (role !== "admin") {
    throw new HttpsError("permission-denied", "Administrator access is required.");
  }

  return authContext;
}

function requireNonEmptyString(value, fieldName) {
  const cleanValue = String(value || "").trim();

  if (!cleanValue) {
    throw new HttpsError("invalid-argument", `${fieldName} is required.`);
  }

  return cleanValue;
}

function cleanTutorMode(value) {
  const mode = String(value || "").trim().toLowerCase();

  if (mode !== "assembly" && mode !== "disassembly") {
    throw new HttpsError("invalid-argument", "A valid module mode is required.");
  }

  return mode;
}

function buildTutorPrompt({ message, context, procedureText }) {
  return [
    "You are the official AI tutor for the Articton PC hardware simulator.",
    "Use only the provided procedure notes and current simulator context.",
    "If the student asks outside the module, redirect them back to the current module.",
    "Be concise, specific, and student-friendly. Mention safety cautions when relevant.",
    "",
    "MODULE CONTEXT",
    `Module: ${context.moduleNumber || "Unknown"}`,
    `Mode: ${context.mode}`,
    `Platform: ${context.platform || "Unknown"}`,
    `Current step: ${context.currentStep || "Unknown"}`,
    `Active component: ${context.activeComponent || "None"}`,
    `Completed parts: ${(context.completedParts || []).join(", ") || "None"}`,
    "",
    "PROCEDURE NOTES",
    procedureText,
    "",
    "STUDENT QUESTION",
    message,
  ].join("\n");
}

function buildFallbackTutorReply({ message, context, procedureText }) {
  const activeComponent = String(context.activeComponent || "").trim();
  const currentStep = String(context.currentStep || "").trim();
  const stepLabel = currentStep || activeComponent || `this ${context.mode} step`;
  const lowerMessage = String(message || "").toLowerCase();
  const notes = PROCEDURE_DETAILS[context.mode] || [];
  const isGreeting = /^(hi|hello|hey|good\s+(morning|afternoon|evening))[\s!.]*$/i.test(
    String(message || "").trim()
  );
  const wantsBefore = /\b(before|prior|prepare|preparation|first|start|begin)\b/.test(lowerMessage);
  const wantsAfter = /\b(after|next|then|following|finish|done)\b/.test(lowerMessage);
  const wantsWhy = /\b(why|reason|purpose|important)\b/.test(lowerMessage);
  const wantsHow = /\b(how|what should i do|what do i do|steps?|remove|install|detach|attach)\b/.test(lowerMessage);
  const wantsSafety = /\b(safe|safety|power|unplug|shutdown|shut down|static|antistatic|damage)\b/.test(lowerMessage);
  const wantsOrder = /\b(order|sequence|which first|what first|correct order)\b/.test(lowerMessage);

  const normalize = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const componentAliases = [
    ["gpu", "graphics", "graphics processing"],
    ["ssd", "solid state", "m 2", "nvme"],
    ["hdd", "hard disk", "hard drive"],
    ["ram", "memory", "dimm"],
    ["cpu", "processor", "central processing"],
    ["psu", "power supply"],
    ["motherboard", "mainboard", "board"],
    ["case", "side panel", "external"],
  ];

  const findNote = () => {
    const haystacks = [activeComponent, currentStep, message].map(normalize);

    for (const note of notes) {
      const noteText = normalize(`${note.title} ${note.text}`);
      if (haystacks.some((haystack) => haystack && noteText.includes(haystack))) {
        return note;
      }
    }

    for (const aliases of componentAliases) {
      if (!haystacks.some((haystack) => aliases.some((alias) => haystack.includes(alias)))) {
        continue;
      }

      const note = notes.find((item) => {
        const noteText = normalize(`${item.title} ${item.text}`);
        return aliases.some((alias) => noteText.includes(alias));
      });

      if (note) return note;
    }

    return notes[0];
  };

  const note = findNote();
  const noteIndex = Math.max(0, notes.indexOf(note));
  const previousNotes = notes.slice(0, noteIndex);
  const nextNote = notes[noteIndex + 1];
  const safetyNote =
    notes.find((item) => /prepare|shut down|unplug|antistatic/i.test(`${item.title} ${item.text}`)) ||
    notes[0];
  const completedParts = Array.isArray(context.completedParts)
    ? context.completedParts.filter(Boolean)
    : [];
  const orderText = notes.map((item) => item.title).join(" -> ");

  if (isGreeting) {
    return [
      `Hi. I am here for ${stepLabel}.`,
      `Current focus: ${note?.title || stepLabel}.`,
      "You can ask what to do, why it matters, what comes before or after, or what safety check to make.",
    ].join("\n");
  }

  if (wantsOrder) {
    return [
      `The ${context.mode} sequence is: ${orderText}.`,
      completedParts.length
        ? `Already completed: ${completedParts.join(", ")}.`
        : `Start with ${notes[0]?.title || "the preparation step"}.`,
      `Current focus: ${note?.title || stepLabel}.`,
    ].join("\n");
  }

  if (wantsBefore) {
    const beforeText = previousNotes.length
      ? previousNotes.map((item) => `${item.title}: ${item.text}`).join("\n")
      : `${safetyNote?.title || "Safety check"}: ${safetyNote?.text || "Shut down and unplug the system before handling parts."}`;

    return [
      `Before ${note?.title || stepLabel}, make sure these are done:`,
      beforeText,
      "If any cable or screw is still attached, stop and release it before lifting the part.",
    ].join("\n");
  }

  if (wantsAfter) {
    return nextNote
      ? [
          `After ${note.title}, continue with ${nextNote.title}.`,
          nextNote.text,
          "Keep removed parts organized so the next step is easier to verify.",
        ].join("\n")
      : `After ${note?.title || stepLabel}, review the full system, confirm all required parts are placed correctly, and finish the module.`;
  }

  if (wantsSafety) {
    return [
      "Safety check first:",
      safetyNote?.text || "Shut down the system, unplug AC power, and discharge leftover power before touching components.",
      `For ${note?.title || stepLabel}, hold components by their edges and avoid forcing clips, sockets, or connectors.`,
    ].join("\n");
  }

  if (wantsWhy) {
    return [
      `${note?.title || stepLabel} matters because forcing or skipping this step can damage connectors, slots, screws, or the component itself.`,
      "The simulator expects you to release power, screws, latches, and cables before moving the highlighted part.",
      `Relevant note: ${note?.text || procedureText}`,
    ].join("\n");
  }

  if (wantsHow || note) {
    return [
      `For ${note?.title || stepLabel}:`,
      note?.text || "Follow the highlighted component and the current procedure guide.",
      "Move slowly, check for attached cables or clips, and only place the part when it is fully released.",
    ].join("\n");
  }

  return `I can help with ${stepLabel}. Ask about the correct order, safety checks, what to do before this step, or how to handle the highlighted component.`;
}

async function generateTutorReply({ message, context, procedureText }) {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();

  if (!GEMINI_TUTOR_ENABLED) {
    return {
      reply: buildFallbackTutorReply({ message, context, procedureText }),
      source: "procedure-fallback",
    };
  }

  if (!apiKey || apiKey === "replace_with_your_gemini_api_key") {
    console.warn("Gemini tutor fallback: GEMINI_API_KEY is missing or placeholder.");
    return {
      reply: buildFallbackTutorReply({ message, context, procedureText }),
      source: "procedure-fallback",
      setupIssue: "missing-gemini-key",
    };
  }

  let response;

  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: buildTutorPrompt({ message, context, procedureText }) }],
            },
          ],
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 320,
          },
        }),
      }
    );
  } catch (error) {
    console.error("Gemini tutor network error:", error);
    return {
      reply: buildFallbackTutorReply({ message, context, procedureText }),
      setupIssue: "gemini-network-error",
    };
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini tutor error:", response.status, errorText);
    const setupIssue =
      response.status === 429 && /prepayment credits are depleted|RESOURCE_EXHAUSTED/i.test(errorText)
        ? "gemini-credits-depleted"
        : "gemini-request-failed";

    return {
      reply: buildFallbackTutorReply({ message, context, procedureText }),
      setupIssue,
    };
  }

  const data = await response.json();
  const reply = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!reply) {
    throw new HttpsError("internal", "The AI tutor returned an empty answer.");
  }

  return { reply };
}

exports.askModuleTutor = onCall(
  { secrets: ["GEMINI_API_KEY"] },
  async (request) => {
    if (process.env.FUNCTIONS_EMULATOR !== "true") {
      await requireAuthenticatedUser(request);
    }

    const message = requireNonEmptyString(request.data?.message, "message");
    const rawContext = request.data?.context || {};
    const mode = cleanTutorMode(rawContext.mode || rawContext.module);
    const context = {
      mode,
      moduleNumber: rawContext.moduleNumber,
      platform: String(rawContext.platform || "").trim(),
      currentStep: String(rawContext.currentStep || "").trim(),
      activeComponent: String(rawContext.activeComponent || "").trim(),
      completedParts: Array.isArray(rawContext.completedParts)
        ? rawContext.completedParts.map((part) => String(part)).slice(0, 12)
        : [],
    };
    const procedureText = getProcedureText(mode);

    if (!procedureText) {
      throw new HttpsError("failed-precondition", "Procedure notes are missing.");
    }

    const tutorResult = await generateTutorReply({ message, context, procedureText });

    return tutorResult;
  }
);

exports.deleteStudentAccount = onCall(async (request) => {
  const administrator = await assertAdmin(request);
  const targetUid = String(request.data?.uid || "").trim();

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "The student UID is required.");
  }

  if (targetUid === administrator.uid) {
    throw new HttpsError(
      "failed-precondition",
      "You cannot delete your own account using the student-deletion function."
    );
  }

  const studentRef = db.doc(`users/${targetUid}`);
  const studentSnapshot = await studentRef.get();

  if (!studentSnapshot.exists) {
    throw new HttpsError("not-found", "Student profile not found.");
  }

  const targetRole = String(studentSnapshot.data().role || "").toLowerCase();

  if (targetRole !== "student") {
    throw new HttpsError(
      "failed-precondition",
      "This function can delete student accounts only."
    );
  }

  try {
    await authAdmin.deleteUser(targetUid);
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      console.error("Authentication deletion failed:", error);
      throw new HttpsError(
        "internal",
        "The Authentication account could not be deleted."
      );
    }
  }

  await db.recursiveDelete(studentRef);

  await Promise.all([
    db.doc(`otp_challenges/${targetUid}`).delete(),
    db.doc(`otp_sessions/${targetUid}`).delete(),
  ]);

  return { deleted: true, uid: targetUid };
});

exports.startAssessment = onCall(async (request) => {
  const { uid, authTime } = await requireAuthenticatedUser(request);
  const activityId = requireNonEmptyString(request.data?.activityId, "activityId");
  const definitionSnapshot = await db
    .doc(`assessment_definitions/${activityId}`)
    .get();

  const knownAssessment = /^(module_[1-4]_(pre|post)_test|practice_exam_[12])$/.test(activityId);
  if ((!definitionSnapshot.exists && !knownAssessment) || (definitionSnapshot.exists && definitionSnapshot.data().active !== true)) {
    throw new HttpsError("not-found", "Assessment not found or unavailable.");
  }
  const definition = definitionSnapshot.data() || {};

  const bankSnapshot = await db.doc(`published_question_banks/${activityId}`).get();
  const bank = bankSnapshot.data();
  if (!bankSnapshot.exists || !Array.isArray(bank.questions) || !bank.questions.length || !Number.isInteger(bank.revision)) {
    throw new HttpsError("failed-precondition", "This assessment has no published questions.");
  }
  const questionSnapshot = bank.questions.map((question, index) => {
    if (typeof question.text !== "string" || !question.text.trim() || !Array.isArray(question.options)
      || question.options.length < 2 || question.options.length > 4
      || question.options.some((option) => typeof option !== "string" || !option.trim())
      || !Number.isInteger(question.correctAnswerIndex) || question.correctAnswerIndex < 0
      || question.correctAnswerIndex >= question.options.length || typeof question.explanation !== "string") {
      throw new HttpsError("failed-precondition", "The published question bank needs correction.");
    }
    return { ...question, id: String(index) };
  });
  const questions = questionSnapshot.map(({ id, text, options }) => ({ id, text, options }));

  const attemptRef = db.collection(`users/${uid}/assessment_attempts`).doc();
  const durationMinutes = Number(
    definition.durationMinutes || 30
  );

  await attemptRef.set({
    uid,
    authTime,
    activityId,
    status: "in_progress",
    questionIds: questions.map((question) => question.id),
    questionSnapshot,
    bankRevision: bank.revision,
    passingPercentage: Number(definition.passingPercentage || 75),
    scoreCollection:
      definition.scoreCollection === "practice_scores" || activityId.startsWith("practice_exam_")
        ? "practice_scores"
        : "module_scores",
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(
      Date.now() + durationMinutes * 60 * 1000
    ),
  });

  return {
    attemptId: attemptRef.id,
    activityId,
    revision: bank.revision,
    questions,
  };
});

exports.submitAssessment = onCall(async (request) => {
  const { uid, authTime } = await requireAuthenticatedUser(request);
  const attemptId = requireNonEmptyString(request.data?.attemptId, "attemptId");
  const submittedAnswers = request.data?.answers;

  if (
    !submittedAnswers ||
    typeof submittedAnswers !== "object" ||
    Array.isArray(submittedAnswers)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Answers must be provided as an object."
    );
  }

  const attemptRef = db.doc(`users/${uid}/assessment_attempts/${attemptId}`);
  const attemptSnapshot = await attemptRef.get();

  if (!attemptSnapshot.exists) {
    throw new HttpsError("not-found", "Assessment attempt not found.");
  }

  const attempt = attemptSnapshot.data();

  if (attempt.uid !== uid || Number(attempt.authTime) !== authTime) {
    throw new HttpsError(
      "permission-denied",
      "This assessment attempt does not belong to the current session."
    );
  }

  if (attempt.status === "submitted") {
    return attempt.result;
  }

  if (attempt.status !== "in_progress") {
    throw new HttpsError(
      "failed-precondition",
      "This assessment attempt is not active."
    );
  }

  if (!attempt.expiresAt || attempt.expiresAt.toMillis() <= Date.now()) {
    await attemptRef.update({ status: "expired" });
    throw new HttpsError("deadline-exceeded", "The assessment attempt has expired.");
  }

  const activityId = attempt.activityId;
  const questionIds = attempt.questionIds || [];
  let correctCount = 0;
  if (Array.isArray(attempt.questionSnapshot)) {
    // Grade against this attempt's immutable snapshot, never the latest bank.
    correctCount = attempt.questionSnapshot.filter((question) =>
      submittedAnswers[question.id] === question.correctAnswerIndex
    ).length;
  } else {
    // Preserve attempts started before published-bank snapshots were introduced.
    const answerKeySnapshots = await Promise.all(questionIds.map((questionId) =>
      db.doc(`assessment_answer_keys/${activityId}/questions/${questionId}`).get()
    ));
    answerKeySnapshots.forEach((answerKeySnapshot, index) => {
      if (!answerKeySnapshot.exists) throw new HttpsError("failed-precondition", "An assessment answer key is missing.");
      if (submittedAnswers[questionIds[index]] === answerKeySnapshot.data().correctAnswer) correctCount += 1;
    });
  }

  const totalQuestions = questionIds.length;
  const scorePercentage =
    totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100);
  const definitionSnapshot = await db
    .doc(`assessment_definitions/${activityId}`)
    .get();
  const definition = definitionSnapshot.data() || {};
  const passingPercentage = Number(attempt.passingPercentage ?? definition.passingPercentage ?? 75);
  const result = {
    correctCount,
    totalQuestions,
    scorePercentage,
    passed: scorePercentage >= passingPercentage,
  };
  const scoreCollection =
    attempt.scoreCollection === "practice_scores" ||
    definition.scoreCollection === "practice_scores" ||
    activityId.startsWith("practice_exam_")
      ? "practice_scores"
      : "module_scores";
  const scoreRef = db.doc(`users/${uid}/${scoreCollection}/${attemptId}`);

  await db.runTransaction(async (transaction) => {
    const latestAttempt = await transaction.get(attemptRef);

    if (!latestAttempt.exists) {
      throw new HttpsError("not-found", "Assessment attempt no longer exists.");
    }

    const latestAttemptData = latestAttempt.data();

    if (latestAttemptData.status === "submitted") {
      return;
    }

    if (latestAttemptData.status !== "in_progress") {
      throw new HttpsError(
        "failed-precondition",
        "This assessment is no longer active."
      );
    }

    transaction.set(scoreRef, {
      uid,
      activityId,
      attemptId,
      correctCount,
      totalQuestions,
      scorePercentage,
      passed: scorePercentage >= passingPercentage,
      source: "server",
      schemaVersion: 1,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.update(attemptRef, {
      status: "submitted",
      result,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return result;
});
