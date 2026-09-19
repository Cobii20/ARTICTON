"use strict";

const admin = require("firebase-admin");
const EXPECTED_PROJECT = "articton-57fd8";
const execute = process.argv.includes("--execute");
const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";

if (project !== EXPECTED_PROJECT) throw new Error(`Refusing project '${project || "unset"}'. Set GCLOUD_PROJECT=${EXPECTED_PROJECT}.`);
if (execute && process.env.ARTICTON_MIGRATION_APPROVED !== `BACKFILL_${EXPECTED_PROJECT}`) {
  throw new Error(`Execution requires ARTICTON_MIGRATION_APPROVED=BACKFILL_${EXPECTED_PROJECT}.`);
}

admin.initializeApp({ projectId: EXPECTED_PROJECT });
const db = admin.firestore();

function toSummary(uid, profile) {
  const firstName = String(profile.firstName || "").trim().slice(0, 80);
  const lastName = String(profile.lastName || "").trim().slice(0, 80);
  return {
    uid, firstName, lastName,
    displayName: [firstName, lastName].filter(Boolean).join(" ") || "Student",
    program: String(profile.program || "").trim().slice(0, 100),
    role: "student",
    status: String(profile.status || "active").trim().slice(0, 30),
    schemaVersion: 1,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function main() {
  const students = await db.collection("users").where("role", "==", "student").get();
  console.log(`${execute ? "EXECUTE" : "DRY RUN"}: ${students.size} student summaries in ${EXPECTED_PROJECT}.`);
  if (!execute) {
    students.docs.forEach((doc) => console.log(`would upsert student_summaries/${doc.id}`));
    return;
  }
  let batch = db.batch();
  let count = 0;
  for (const doc of students.docs) {
    batch.set(db.doc(`student_summaries/${doc.id}`), toSummary(doc.id, doc.data()), { merge: false });
    count += 1;
    if (count % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  if (count % 400 !== 0) await batch.commit();
  console.log(`Upserted ${count} summaries. Private fields and legacy scores were not copied.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
