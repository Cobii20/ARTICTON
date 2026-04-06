const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

/* ===========================
   EMAIL TRANSPORTER
   =========================== */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "projectarticton@gmail.com",
    pass: "gskiddlavlwoftys", 
  },
});

/* ===========================
   SEND OTP
   =========================== */
exports.sendEmailOtp = onCall(async (request) => {
  const { email } = request.data;

  console.log("📩 Incoming email:", email);

  if (!email) {
    throw new HttpsError("invalid-argument", "Email is required");
  }

  // generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // save OTP
    await db.collection("otp_codes").doc(email).set({
      otp,
      email,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
  } catch (err) {
    console.error("🔥 FIRESTORE ERROR:", err);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to save OTP",
      err.message
    );
  }

  try {
    // send email
    await transporter.sendMail({
      from: "Articton <projectarticton@gmail.com>",
      to: email,
      subject: "Your Articton Login OTP",
      text: `Your OTP code is: ${otp}\n\nThis code expires in 5 minutes.`,
    });
  } catch (err) {
    console.error("🔥 EMAIL ERROR:", err);

    // cleanup if email fails
    await db.collection("otp_codes").doc(email).delete().catch(() => {});

    throw new functions.https.HttpsError(
      "internal",
      "Failed to send OTP email",
      err.message
    );
  }

  return { message: "OTP sent successfully" };
});

/* ===========================
   VERIFY OTP
   =========================== */
exports.verifyEmailOtp = onCall(async (request) => {
  const { email, otp } = request.data;

  if (!email || !otp) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Email and OTP are required"
    );
  }

  let docSnap;

  try {
    docSnap = await db.collection("otp_codes").doc(email).get();
  } catch (err) {
    console.error("🔥 FIRESTORE READ ERROR:", err);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to read OTP",
      err.message
    );
  }

  if (!docSnap.exists) {
    throw new functions.https.HttpsError("not-found", "No OTP found");
  }

  const record = docSnap.data();

  if (Date.now() > record.expiresAt) {
    throw new functions.https.HttpsError("deadline-exceeded", "OTP expired");
  }

  if (otp !== record.otp) {
    throw new functions.https.HttpsError("permission-denied", "Invalid OTP");
  }

  // success → delete OTP
  try {
    await db.collection("otp_codes").doc(email).delete();
  } catch (err) {
    console.error("🔥 DELETE ERROR:", err);
  }

  return { verified: true };
});