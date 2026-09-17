const projectId = String(process.env.FIREBASE_SPARK_PROJECT_ID || "").trim();
const forbidden = new Set(["articton-57fd8", "demo-articton"]);
if (!projectId || forbidden.has(projectId) || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
  console.error("Set FIREBASE_SPARK_PROJECT_ID to the separately verified Spark project. The existing ARTICTON project is rejected.");
  process.exit(1);
}
console.log(`Spark target accepted for review: ${projectId}`);
