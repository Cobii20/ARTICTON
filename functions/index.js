const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { PROCEDURE_DETAILS, getProcedureText } = require("./procedureNotes");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const authAdmin = admin.auth();

function cleanProfilePhotoUrl(profile = {}) {
  const candidate = String(
    profile.avatarUrl ||
    profile.photoURL ||
    profile.profilePhotoUrl ||
    profile.profilePictureUrl ||
    profile.imageUrl ||
    ""
  ).trim();
  if (!candidate) return "";

  if (candidate.startsWith("/")) {
    return candidate.length <= 1024 && !candidate.startsWith("//") ? candidate : "";
  }

  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\r\n]+$/i.test(candidate)) {
    return candidate.length <= 750000 ? candidate : "";
  }

  if (candidate.length > 2048) return "";

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

const PROGRESS_VALUE_FIELDS = Object.freeze([
  "score", "latestScore", "finalScore", "total", "latestTotal", "maxScore",
  "scorePercent", "percent", "percentage", "progressPercent", "completionPercent", "completed",
  "finished", "passed", "status", "grade", "letterGrade", "elapsedSeconds",
  "durationSeconds", "timeSeconds", "wrongOrderCount", "wrongOrder",
  "sequenceDeduction", "orderPenaltyPoints", "timeDeduction", "timePenaltyPoints",
  "totalDeduction", "mistakes", "deductionPercent", "wrongClickDeduction",
]);

function cleanProgressEntry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const result = {};
  for (const field of PROGRESS_VALUE_FIELDS) {
    const fieldValue = value[field];
    if (["string", "number", "boolean"].includes(typeof fieldValue)) {
      result[field] = typeof fieldValue === "string" ? fieldValue.slice(0, 80) : fieldValue;
    }
  }

  // The dashboards only need to know whether a completion marker exists; they
  // do not need the timestamp value itself in this faculty-facing response.
  if (value.completedAt) result.completedAt = true;
  if (value.timestamp) result.timestamp = true;
  if (value.updatedAt) result.updatedAt = true;

  return result;
}

function cleanProgressMap(profile, field, allowedKeys) {
  const source = profile?.[field];
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};

  return Object.fromEntries(
    allowedKeys
      .map((key) => [key, cleanProgressEntry(source[key])])
      .filter(([, value]) => value !== null)
  );
}

function studentSummaryFromProfile(uid, profile = {}) {
  const firstName = String(profile.firstName || "").trim().slice(0, 80);
  const lastName = String(profile.lastName || "").trim().slice(0, 80);
  const role = String(profile.role || "student").toLowerCase();
  return {
    uid,
    firstName,
    lastName,
    displayName: [firstName, lastName].filter(Boolean).join(" ") || "Student",
    avatarUrl: cleanProfilePhotoUrl(profile),
    program: String(profile.program || "").trim().slice(0, 100),
    role: role === "student" ? "student" : role,
    status: String(profile.status || "active").trim().slice(0, 30),
    quizProgress: cleanProgressMap(profile, "quizProgress", [
      "module1", "module2", "module3", "module4",
    ]),
    practicalProgress: cleanProgressMap(profile, "practicalProgress", [
      "fullAssembly", "fullDisassembly",
    ]),
    practicalTests: cleanProgressMap(profile, "practicalTests", [
      "amdDisassembly", "intelDisassembly", "amdAssembly", "intelAssembly",
    ]),
    mobileModuleScores: cleanProgressMap(profile, "mobileModuleScores", [
      "module1Content", "module1Pre", "module1Post",
      "module2Content", "module2Pre", "module2Post",
      "module3Content", "module3Pre", "module3Post",
      "module4Content", "module4Pre", "module4Post",
    ]),
    mobilePracticeScores: cleanProgressMap(profile, "mobilePracticeScores", [
      "practiceExam1", "practiceExam2",
    ]),
    schemaVersion: 1,
  };
}

exports.syncStudentSummary = onDocumentWritten("users/{uid}", async (event) => {
  const uid = event.params.uid;
  const after = event.data?.after;
  const summaryRef = db.doc(`student_summaries/${uid}`);
  if (!after?.exists) {
    await summaryRef.delete();
    return;
  }
  const profile = after.data();
  if (String(profile.role || "student").toLowerCase() !== "student") {
    await summaryRef.delete();
    return;
  }
  await summaryRef.set({
    ...studentSummaryFromProfile(uid, profile),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: false });
});

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_TUTOR_ENABLED = process.env.GEMINI_TUTOR_ENABLED === "true";
const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === "true";

const callableOptions = Object.freeze({
  region: "us-central1",
  enforceAppCheck: ENFORCE_APP_CHECK,
  consumeAppCheckToken: ENFORCE_APP_CHECK,
  minInstances: 0,
  maxInstances: 5,
  concurrency: 10,
  memory: "256MiB",
  timeoutSeconds: 30,
});

const tutorOptions = Object.freeze({
  ...callableOptions,
  secrets: ["GEMINI_API_KEY"],
  maxInstances: 2,
  concurrency: 5,
  timeoutSeconds: 20,
});

function requirePlainObject(value, fieldName, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", `${fieldName} must be an object.`);
  }
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (unexpected.length) {
    throw new HttpsError("invalid-argument", `${fieldName} contains unsupported fields.`);
  }
  return value;
}

function requireBoundedString(value, fieldName, maxLength, pattern) {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${fieldName} must be text.`);
  }
  const cleanValue = value.trim();
  if (!cleanValue || cleanValue.length > maxLength || (pattern && !pattern.test(cleanValue))) {
    throw new HttpsError("invalid-argument", `${fieldName} is invalid.`);
  }
  return cleanValue;
}

async function enforceRateLimit(uid, action, { windowMs, windowMax, dailyMax }) {
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const ref = db.doc(`function_rate_limits/${uid}_${action}`);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const previous = snapshot.data() || {};
    const sameWindow = Number(previous.windowStartedAt || 0) + windowMs > now;
    const windowCount = sameWindow ? Number(previous.windowCount || 0) : 0;
    const dayCount = previous.day === day ? Number(previous.dayCount || 0) : 0;
    if (windowCount >= windowMax || dayCount >= dailyMax) {
      throw new HttpsError("resource-exhausted", "Request limit reached. Please try again later.");
    }
    transaction.set(ref, {
      uid,
      action,
      day,
      dayCount: dayCount + 1,
      windowStartedAt: sameWindow ? Number(previous.windowStartedAt) : now,
      windowCount: windowCount + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(now + 2 * 24 * 60 * 60 * 1000),
    });
  });
}

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

async function assertFacultyOrAdmin(request) {
  const authContext = await requireAuthenticatedUser(request);
  const profileSnapshot = await db.doc(`users/${authContext.uid}`).get();

  if (!profileSnapshot.exists) {
    throw new HttpsError("permission-denied", "Faculty profile not found.");
  }

  const role = String(profileSnapshot.data().role || "").trim().toLowerCase();
  if (role !== "faculty" && role !== "admin") {
    throw new HttpsError("permission-denied", "Faculty access is required.");
  }

  return authContext;
}

exports.listStudentSummaries = onCall(callableOptions, async (request) => {
  await assertFacultyOrAdmin(request);
  const snapshot = await db.collection("users")
    .where("role", "==", "student")
    .limit(1000)
    .get();

  return {
    students: snapshot.docs.map((studentDoc) =>
      studentSummaryFromProfile(studentDoc.id, studentDoc.data())
    ),
  };
});

exports.submitSupportTicket = onCall(callableOptions, async (request) => {
  const { uid, email } = await requireAuthenticatedUser(request);
  requirePlainObject(request.data, "request", ["subject", "message"]);
  const subject = requireBoundedString(request.data.subject, "subject", 160);
  const message = requireBoundedString(request.data.message, "message", 5000);

  // One ticket per ten minutes and no more than ten per day prevents repeated
  // submissions while still leaving room for legitimate follow-up concerns.
  await enforceRateLimit(uid, "submit_support_ticket", {
    windowMs: 10 * 60 * 1000,
    windowMax: 1,
    dailyMax: 10,
  });

  const profileSnapshot = await db.doc(`users/${uid}`).get();
  const profile = profileSnapshot.exists ? profileSnapshot.data() : {};
  const firstName = String(profile.firstName || "").trim();
  const lastName = String(profile.lastName || "").trim();
  const name = [firstName, lastName].filter(Boolean).join(" ") ||
    String(profile.displayName || "Student").trim().slice(0, 120);

  const ticketRef = db.collection("supportTickets").doc();
  await ticketRef.set({
    uid,
    name: name.slice(0, 120),
    email,
    subject,
    message,
    screenshotURL: "",
    status: "open",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ticketId: ticketRef.id, submitted: true };
});

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
            maxOutputTokens: 240,
          },
        }),
        signal: AbortSignal.timeout(12000),
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
  tutorOptions,
  async (request) => {
    const { uid } = await requireAuthenticatedUser(request);
    requirePlainObject(request.data, "request", ["message", "context"]);
    const message = requireBoundedString(request.data.message, "message", 800);
    const rawContext = requirePlainObject(request.data.context || {}, "context", [
      "mode", "module", "moduleNumber", "platform", "currentStep", "activeComponent", "completedParts",
    ]);
    const mode = cleanTutorMode(rawContext.mode || rawContext.module);
    if (rawContext.completedParts !== undefined && (!Array.isArray(rawContext.completedParts) || rawContext.completedParts.length > 12)) {
      throw new HttpsError("invalid-argument", "completedParts must contain at most 12 items.");
    }
    const context = {
      mode,
      moduleNumber: String(rawContext.moduleNumber || "").slice(0, 20),
      platform: String(rawContext.platform || "").trim().slice(0, 30),
      currentStep: String(rawContext.currentStep || "").trim().slice(0, 120),
      activeComponent: String(rawContext.activeComponent || "").trim().slice(0, 80),
      completedParts: Array.isArray(rawContext.completedParts)
        ? rawContext.completedParts.map((part) => requireBoundedString(part, "completed part", 60)).slice(0, 12)
        : [],
    };
    await enforceRateLimit(uid, "tutor", { windowMs: 60_000, windowMax: 5, dailyMax: 50 });
    const procedureText = getProcedureText(mode);

    if (!procedureText) {
      throw new HttpsError("failed-precondition", "Procedure notes are missing.");
    }

    const tutorResult = await generateTutorReply({ message, context, procedureText });

    return tutorResult;
  }
);

exports.deleteStudentAccount = onCall(callableOptions, async (request) => {
  const administrator = await assertAdmin(request);
  requirePlainObject(request.data, "request", ["uid"]);
  const targetUid = requireBoundedString(request.data.uid, "uid", 128, /^[A-Za-z0-9_-]+$/);

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "The student UID is required.");
  }

  if (targetUid === administrator.uid) {
    throw new HttpsError(
      "failed-precondition",
      "You cannot delete your own account using the student-deletion function."
    );
  }
  await enforceRateLimit(administrator.uid, "delete_student", { windowMs: 60_000, windowMax: 3, dailyMax: 20 });

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

exports.startAssessment = onCall(callableOptions, async (request) => {
  const { uid, authTime } = await requireAuthenticatedUser(request);
  requirePlainObject(request.data, "request", ["activityId"]);
  const activityId = requireBoundedString(request.data.activityId, "activityId", 80, /^[a-z0-9_-]+$/);
  const definitionSnapshot = await db
    .doc(`assessment_definitions/${activityId}`)
    .get();

  const knownAssessment = /^(module_[1-4]_(pre|post)_test|practice_exam_[12])$/.test(activityId);
  if ((!definitionSnapshot.exists && !knownAssessment) || (definitionSnapshot.exists && definitionSnapshot.data().active !== true)) {
    throw new HttpsError("not-found", "Assessment not found or unavailable.");
  }
  await enforceRateLimit(uid, "start_assessment", { windowMs: 60_000, windowMax: 6, dailyMax: 40 });
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

exports.submitAssessment = onCall(callableOptions, async (request) => {
  const { uid, authTime } = await requireAuthenticatedUser(request);
  requirePlainObject(request.data, "request", ["attemptId", "answers"]);
  const attemptId = requireBoundedString(request.data.attemptId, "attemptId", 128, /^[A-Za-z0-9_-]+$/);
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
  const answerEntries = Object.entries(submittedAnswers);
  if (answerEntries.length > 100 || answerEntries.some(([key, value]) => key.length > 20 || !Number.isInteger(value) || value < 0 || value > 3)) {
    throw new HttpsError("invalid-argument", "Answers contain invalid question identifiers or choices.");
  }
  await enforceRateLimit(uid, "submit_assessment", { windowMs: 60_000, windowMax: 8, dailyMax: 50 });

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

const PRACTICAL_IDS = Object.freeze({
  amdAssembly: { mode: "assembly", platform: "amd" },
  intelAssembly: { mode: "assembly", platform: "intel" },
  amdDisassembly: { mode: "disassembly", platform: "amd" },
  intelDisassembly: { mode: "disassembly", platform: "intel" },
});
const PRACTICAL_COMPONENTS = Object.freeze([
  "cpu", "ram1", "ram2", "ssd", "psu", "motherboard", "hdd", "gpu",
]);

function practicalScore(wrongOrderCount, elapsedSeconds) {
  const sequenceDeduction = Math.min(25, wrongOrderCount * 6);
  const timeDeduction = Math.min(25, Math.max(0, Math.floor(elapsedSeconds) - 120));
  const score = Math.max(0, 100 - sequenceDeduction - timeDeduction);
  return {
    startingScore: 100,
    score,
    finalScore: score,
    scorePercent: score,
    percent: score,
    percentage: score,
    passed: score >= 75,
    status: score >= 75 ? "Passed" : "Failed",
    wrongOrderCount,
    sequenceDeduction,
    orderPenaltyPoints: sequenceDeduction,
    timeDeduction,
    timePenaltyPoints: timeDeduction,
    totalDeduction: sequenceDeduction + timeDeduction,
    elapsedSeconds,
  };
}

exports.startPracticalAttempt = onCall(callableOptions, async (request) => {
  const { uid, authTime } = await requireAuthenticatedUser(request);
  requirePlainObject(request.data, "request", ["practicalId"]);
  const practicalId = requireBoundedString(request.data.practicalId, "practicalId", 40, /^[A-Za-z]+$/);
  if (!PRACTICAL_IDS[practicalId]) {
    throw new HttpsError("invalid-argument", "Unknown practical test.");
  }
  await enforceRateLimit(uid, "start_practical", { windowMs: 60_000, windowMax: 5, dailyMax: 30 });
  const attemptRef = db.collection(`users/${uid}/practical_attempts`).doc();
  await attemptRef.set({
    uid,
    authTime,
    practicalId,
    status: "in_progress",
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 2 * 60 * 60 * 1000),
  });
  return { attemptId: attemptRef.id, practicalId };
});

exports.finishPracticalAttempt = onCall(callableOptions, async (request) => {
  const { uid, authTime } = await requireAuthenticatedUser(request);
  requirePlainObject(request.data, "request", ["attemptId", "practicalId", "wrongOrderCount", "completedParts"]);
  const attemptId = requireBoundedString(request.data.attemptId, "attemptId", 128, /^[A-Za-z0-9_-]+$/);
  const practicalId = requireBoundedString(request.data.practicalId, "practicalId", 40, /^[A-Za-z]+$/);
  const wrongOrderCount = request.data.wrongOrderCount;
  const completedParts = request.data.completedParts;
  if (!PRACTICAL_IDS[practicalId] || !Number.isInteger(wrongOrderCount) || wrongOrderCount < 0 || wrongOrderCount > 100) {
    throw new HttpsError("invalid-argument", "Practical result fields are invalid.");
  }
  if (!Array.isArray(completedParts) || completedParts.length !== PRACTICAL_COMPONENTS.length ||
      completedParts.some((part) => typeof part !== "string" || !part.trim() || part.length > 60) ||
      new Set(completedParts).size !== completedParts.length ||
      PRACTICAL_COMPONENTS.some((part) => !completedParts.includes(part))) {
    throw new HttpsError("invalid-argument", "The completed component list is invalid.");
  }
  await enforceRateLimit(uid, "finish_practical", { windowMs: 60_000, windowMax: 6, dailyMax: 30 });
  const attemptRef = db.doc(`users/${uid}/practical_attempts/${attemptId}`);
  const resultRef = db.doc(`users/${uid}/practical_results/${practicalId}`);
  let responseResult;
  await db.runTransaction(async (transaction) => {
    const [snapshot, previousResultSnapshot] = await Promise.all([
      transaction.get(attemptRef),
      transaction.get(resultRef),
    ]);
    if (!snapshot.exists) throw new HttpsError("not-found", "Practical attempt not found.");
    const attempt = snapshot.data();
    if (attempt.uid !== uid || Number(attempt.authTime) !== authTime || attempt.practicalId !== practicalId) {
      throw new HttpsError("permission-denied", "This practical attempt does not belong to this session.");
    }
    if (attempt.status === "submitted") {
      responseResult = attempt.result;
      return;
    }
    if (attempt.status !== "in_progress" || !attempt.startedAt || attempt.expiresAt.toMillis() <= Date.now()) {
      throw new HttpsError("failed-precondition", "This practical attempt is not active.");
    }
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - attempt.startedAt.toMillis()) / 1000));
    const result = practicalScore(wrongOrderCount, elapsedSeconds);
    const previousResult = previousResultSnapshot.exists ? previousResultSnapshot.data() : {};
    const highestScore = Math.max(
      Number(previousResult.highestScore ?? previousResult.bestScore ?? previousResult.score ?? 0),
      Number(result.score || 0),
    );
    responseResult = { ...result, highestScore };
    transaction.update(attemptRef, {
      status: "submitted",
      result: responseResult,
      completedParts,
      trustLevel: "client-reported-actions-server-timed",
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.set(resultRef, {
      ...result,
      highestScore,
      uid,
      practicalId,
      attemptId,
      source: "server",
      schemaVersion: 1,
      trustLevel: "client-reported-actions-server-timed",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.set(db.doc(`users/${uid}/achievements/${practicalId}`), {
      uid,
      achievementId: practicalId,
      earned: result.passed,
      score: result.score,
      source: "server",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return responseResult;
});

const GUIDED_MODULES = Object.freeze({
  module2AMD: { module: 2, platform: "amd", achievementId: "module-2-amd-disassembly-complete" },
  module2INTEL: { module: 2, platform: "intel", achievementId: "module-2-intel-disassembly-complete" },
  module3AMD: { module: 3, platform: "amd", achievementId: "module-3-amd-assembly-complete" },
  module3INTEL: { module: 3, platform: "intel", achievementId: "module-3-intel-assembly-complete" },
});

exports.completeGuidedModule = onCall(callableOptions, async (request) => {
  const { uid, authTime } = await requireAuthenticatedUser(request);
  requirePlainObject(request.data, "request", ["moduleId"]);
  const moduleId = requireBoundedString(request.data.moduleId, "moduleId", 30, /^[A-Za-z0-9]+$/);
  const definition = GUIDED_MODULES[moduleId];
  if (!definition) throw new HttpsError("invalid-argument", "Unknown guided module.");
  await enforceRateLimit(uid, "complete_guided_module", { windowMs: 60_000, windowMax: 6, dailyMax: 40 });

  const completionRef = db.doc(`users/${uid}/module_completions/${moduleId}`);
  const achievementRef = db.doc(`users/${uid}/achievements/${definition.achievementId}`);
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(completionRef);
    const previous = current.exists ? current.data() : {};
    transaction.set(completionRef, {
      uid,
      authTime,
      moduleId,
      ...definition,
      completed: true,
      source: "server",
      trustLevel: "client-reported-guided-actions",
      attemptCount: Number(previous.attemptCount || 0) + 1,
      firstCompletedAt: previous.firstCompletedAt || admin.firestore.FieldValue.serverTimestamp(),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      schemaVersion: 1,
    });
    transaction.set(achievementRef, {
      uid,
      achievementId: definition.achievementId,
      earned: true,
      source: "server",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  return { moduleId, completed: true };
});
