const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { PROCEDURE_DETAILS, getProcedureText } = require("./procedureNotes");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const authAdmin = admin.auth();

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_TUTOR_ENABLED = process.env.GEMINI_TUTOR_ENABLED === "true";

function requireEnv(name, message) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new HttpsError("failed-precondition", message);
  }

  return value;
}

function createEmailTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: requireEnv("GMAIL_USER", "The email sender is not configured."),
      pass: requireEnv("GMAIL_APP_PASSWORD", "The email password is not configured."),
    },
  });
}

function requireAuthenticatedUser(request) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must sign in before requesting an OTP."
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

function hashOtp({ uid, email, authTime, otp }) {
  const secret = process.env.OTP_HASH_SECRET;

  if (!secret) {
    throw new HttpsError(
      "failed-precondition",
      "The OTP hashing secret is not configured."
    );
  }

  const scope = email || authTime;

  return crypto
    .createHmac("sha256", secret)
    .update(`${uid}:${scope}:${otp}`)
    .digest("hex");
}

function hashesMatch(firstHash, secondHash) {
  try {
    const firstBuffer = Buffer.from(firstHash, "hex");
    const secondBuffer = Buffer.from(secondHash, "hex");

    return (
      firstBuffer.length === secondBuffer.length &&
      crypto.timingSafeEqual(firstBuffer, secondBuffer)
    );
  } catch {
    return false;
  }
}

async function assertOtpVerified(request) {
  const authContext = requireAuthenticatedUser(request);

  const sessionSnapshot = await db.doc(`otp_sessions/${authContext.uid}`).get();

  if (!sessionSnapshot.exists) {
    throw new HttpsError("permission-denied", "OTP verification is required.");
  }

  const session = sessionSnapshot.data();
  const correctSession =
    session.uid === authContext.uid &&
    session.email === authContext.email &&
    Number(session.authTime) === authContext.authTime;

  const hasValidExpiry =
    session.expiresAt &&
    typeof session.expiresAt.toMillis === "function" &&
    session.expiresAt.toMillis() > Date.now();

  if (!correctSession || !hasValidExpiry) {
    throw new HttpsError(
      "permission-denied",
      "Your OTP session is missing, invalid, or expired."
    );
  }

  return authContext;
}

async function assertAdmin(request) {
  const authContext = await assertOtpVerified(request);
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
      await assertOtpVerified(request);
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

exports.sendEmailOtp = onCall(
  { secrets: ["GMAIL_USER", "GMAIL_APP_PASSWORD", "OTP_HASH_SECRET"] },
  async (request) => {
    const { uid, email } = requireAuthenticatedUser(request);
    const now = Date.now();
    const otp = crypto.randomInt(100000, 1000000).toString();
    const challengeId = crypto.randomUUID();
    const challengeRef = db.doc(`otp_challenges/${uid}`);
    const sessionRef = db.doc(`otp_sessions/${uid}`);
    const expiresAt = admin.firestore.Timestamp.fromMillis(now + OTP_TTL_MS);
    const resendAvailableAt = admin.firestore.Timestamp.fromMillis(
      now + OTP_RESEND_COOLDOWN_MS
    );

    const delivery = await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(challengeRef);

      if (currentSnapshot.exists) {
        const currentChallenge = currentSnapshot.data();
        const currentExpiresAt = currentChallenge.expiresAt;
        const currentResendAvailableAt = currentChallenge.resendAvailableAt;
        const hasActiveChallenge =
          currentChallenge.uid === uid &&
          currentChallenge.email === email &&
          currentExpiresAt &&
          typeof currentExpiresAt.toMillis === "function" &&
          currentExpiresAt.toMillis() > now;

        if (
          hasActiveChallenge &&
          currentResendAvailableAt &&
          currentResendAvailableAt.toMillis() > now
        ) {
          transaction.delete(sessionRef);

          return {
            shouldSend: false,
            alreadySent: true,
            expiresAt: currentExpiresAt.toDate().toISOString(),
            resendAvailableAt: currentResendAvailableAt.toDate().toISOString(),
          };
        }
      }

      transaction.set(challengeRef, {
        uid,
        email,
        challengeId,
        otpHash: hashOtp({ uid, email, otp }),
        attempts: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
        resendAvailableAt,
      });

      transaction.delete(sessionRef);

      return {
        shouldSend: true,
        alreadySent: false,
        expiresAt: expiresAt.toDate().toISOString(),
        resendAvailableAt: resendAvailableAt.toDate().toISOString(),
      };
    });

    if (!delivery.shouldSend) {
      return {
        sent: false,
        ...delivery,
      };
    }

    try {
      const gmailUser = requireEnv("GMAIL_USER", "The email sender is not configured.");
      const transporter = createEmailTransporter();

      await transporter.sendMail({
        from: `Articton <${gmailUser}>`,
        to: email,
        subject: "Your ARTICTON verification code",
        text: [
          `Your ARTICTON verification code is: ${otp}`,
          "",
          "This code expires in 5 minutes.",
          "Do not share this code with anyone.",
        ].join("\n"),
      });
    } catch (error) {
      await db.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(challengeRef);

        if (
          currentSnapshot.exists &&
          currentSnapshot.data().challengeId === challengeId
        ) {
          transaction.delete(challengeRef);
        }
      });

      console.error("OTP email error:", error);
      throw new HttpsError("internal", "The verification email could not be sent.");
    }

    return {
      sent: true,
      ...delivery,
    };
  }
);

exports.verifyEmailOtp = onCall(
  { secrets: ["OTP_HASH_SECRET"] },
  async (request) => {
    const { uid, email, authTime } = requireAuthenticatedUser(request);
    const otp = String(request.data?.otp || "").trim();

    if (!/^\d{6}$/.test(otp)) {
      throw new HttpsError("invalid-argument", "Enter a valid six-digit OTP.");
    }

    const challengeRef = db.doc(`otp_challenges/${uid}`);
    const sessionRef = db.doc(`otp_sessions/${uid}`);
    const now = Date.now();

    const result = await db.runTransaction(async (transaction) => {
      const challengeSnapshot = await transaction.get(challengeRef);

      if (!challengeSnapshot.exists) {
        return {
          ok: false,
          code: "failed-precondition",
          message: "Request a new verification code.",
        };
      }

      const challenge = challengeSnapshot.data();
      const sameAccount =
        challenge.uid === uid &&
        challenge.email === email;

      if (!sameAccount) {
        transaction.delete(challengeRef);

        return {
          ok: false,
          code: "failed-precondition",
          message: "This code belongs to another account. Request a new code.",
        };
      }

      if (!challenge.expiresAt || challenge.expiresAt.toMillis() <= now) {
        transaction.delete(challengeRef);

        return {
          ok: false,
          code: "deadline-exceeded",
          message: "The verification code has expired. Request a new code.",
        };
      }

      const attempts = Number(challenge.attempts || 0);

      if (attempts >= OTP_MAX_ATTEMPTS) {
        transaction.delete(challengeRef);

        return {
          ok: false,
          code: "resource-exhausted",
          message: "Too many incorrect attempts. Request a new code.",
        };
      }

      const submittedHash = hashOtp({ uid, email, otp });
      const legacySubmittedHash = Number.isFinite(Number(challenge.authTime))
        ? hashOtp({ uid, authTime: Number(challenge.authTime), otp })
        : "";

      if (
        !hashesMatch(challenge.otpHash, submittedHash) &&
        !hashesMatch(challenge.otpHash, legacySubmittedHash)
      ) {
        const nextAttempts = attempts + 1;

        if (nextAttempts >= OTP_MAX_ATTEMPTS) {
          transaction.delete(challengeRef);
        } else {
          transaction.update(challengeRef, {
            attempts: nextAttempts,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        return {
          ok: false,
          code: "permission-denied",
          message:
            nextAttempts >= OTP_MAX_ATTEMPTS
              ? "Too many incorrect attempts. Request a new code."
              : "The verification code is incorrect.",
        };
      }

      transaction.delete(challengeRef);
      transaction.set(sessionRef, {
        uid,
        email,
        authTime,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(
          now + OTP_SESSION_TTL_MS
        ),
      });

      return { ok: true };
    });

    if (!result.ok) {
      throw new HttpsError(result.code, result.message);
    }

    return {
      verified: true,
      sessionExpiresAt: new Date(now + OTP_SESSION_TTL_MS).toISOString(),
    };
  }
);

exports.endOtpSession = onCall(async (request) => {
  const { uid } = requireAuthenticatedUser(request);
  const batch = db.batch();

  batch.delete(db.doc(`otp_sessions/${uid}`));
  batch.delete(db.doc(`otp_challenges/${uid}`));

  await batch.commit();

  return { signedOut: true };
});

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
  const { uid, authTime } = await assertOtpVerified(request);
  const activityId = requireNonEmptyString(request.data?.activityId, "activityId");
  const definitionSnapshot = await db
    .doc(`assessment_definitions/${activityId}`)
    .get();

  if (!definitionSnapshot.exists || definitionSnapshot.data().active !== true) {
    throw new HttpsError("not-found", "Assessment not found or unavailable.");
  }

  const questionsSnapshot = await db
    .collection(`assessment_questions/${activityId}/questions`)
    .orderBy("order")
    .get();

  if (questionsSnapshot.empty) {
    throw new HttpsError(
      "failed-precondition",
      "This assessment has no questions."
    );
  }

  const questions = questionsSnapshot.docs.map((questionDocument) => ({
    id: questionDocument.id,
    ...questionDocument.data(),
  }));

  const attemptRef = db.collection(`users/${uid}/assessment_attempts`).doc();
  const durationMinutes = Number(
    definitionSnapshot.data().durationMinutes || 30
  );

  await attemptRef.set({
    uid,
    authTime,
    activityId,
    status: "in_progress",
    questionIds: questions.map((question) => question.id),
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(
      Date.now() + durationMinutes * 60 * 1000
    ),
  });

  return {
    attemptId: attemptRef.id,
    activityId,
    questions,
  };
});

exports.submitAssessment = onCall(async (request) => {
  const { uid, authTime } = await assertOtpVerified(request);
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
  const answerKeySnapshots = await Promise.all(
    questionIds.map((questionId) =>
      db.doc(`assessment_answer_keys/${activityId}/questions/${questionId}`).get()
    )
  );

  let correctCount = 0;

  answerKeySnapshots.forEach((answerKeySnapshot, index) => {
    if (!answerKeySnapshot.exists) {
      throw new HttpsError(
        "failed-precondition",
        "An assessment answer key is missing."
      );
    }

    const questionId = questionIds[index];
    const correctAnswer = answerKeySnapshot.data().correctAnswer;

    if (submittedAnswers[questionId] === correctAnswer) {
      correctCount += 1;
    }
  });

  const totalQuestions = questionIds.length;
  const scorePercentage =
    totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100);
  const definitionSnapshot = await db
    .doc(`assessment_definitions/${activityId}`)
    .get();
  const definition = definitionSnapshot.data() || {};
  const passingPercentage = Number(definition.passingPercentage || 75);
  const result = {
    correctCount,
    totalQuestions,
    scorePercentage,
    passed: scorePercentage >= passingPercentage,
  };
  const scoreCollection =
    definition.scoreCollection === "practice_scores"
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
