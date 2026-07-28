const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const authAdmin = admin.auth();

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

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

function hashOtp({ uid, authTime, otp }) {
  const secret = process.env.OTP_HASH_SECRET;

  if (!secret) {
    throw new HttpsError(
      "failed-precondition",
      "The OTP hashing secret is not configured."
    );
  }

  return crypto
    .createHmac("sha256", secret)
    .update(`${uid}:${authTime}:${otp}`)
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

exports.sendEmailOtp = onCall(
  { secrets: ["GMAIL_USER", "GMAIL_APP_PASSWORD", "OTP_HASH_SECRET"] },
  async (request) => {
    const { uid, email, authTime } = requireAuthenticatedUser(request);
    const now = Date.now();
    const otp = crypto.randomInt(100000, 1000000).toString();
    const challengeId = crypto.randomUUID();
    const challengeRef = db.doc(`otp_challenges/${uid}`);
    const sessionRef = db.doc(`otp_sessions/${uid}`);

    await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(challengeRef);

      if (currentSnapshot.exists) {
        const resendAvailableAt = currentSnapshot.data().resendAvailableAt;

        if (resendAvailableAt && resendAvailableAt.toMillis() > now) {
          throw new HttpsError(
            "resource-exhausted",
            "Please wait before requesting another OTP."
          );
        }
      }

      transaction.set(challengeRef, {
        uid,
        email,
        authTime,
        challengeId,
        otpHash: hashOtp({ uid, authTime, otp }),
        attempts: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(now + OTP_TTL_MS),
        resendAvailableAt: admin.firestore.Timestamp.fromMillis(
          now + OTP_RESEND_COOLDOWN_MS
        ),
      });

      transaction.delete(sessionRef);
    });

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

    return { sent: true };
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
      const sameLoginSession =
        challenge.uid === uid &&
        challenge.email === email &&
        Number(challenge.authTime) === authTime;

      if (!sameLoginSession) {
        transaction.delete(challengeRef);

        return {
          ok: false,
          code: "failed-precondition",
          message: "This code belongs to an older login session. Request a new code.",
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

      const submittedHash = hashOtp({ uid, authTime, otp });

      if (!hashesMatch(challenge.otpHash, submittedHash)) {
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
