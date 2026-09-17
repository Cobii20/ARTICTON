export const DEPLOYMENT_MODE = String(import.meta.env.VITE_FIREBASE_DEPLOYMENT_MODE || (import.meta.env.MODE === "spark" ? "spark" : "full")).toLowerCase();
export const IS_SPARK_MODE = DEPLOYMENT_MODE === "spark";
export const BACKEND_FEATURES_ENABLED = !IS_SPARK_MODE;
export const STORAGE_UPLOADS_ENABLED = !IS_SPARK_MODE;

export function requireBackendFeature(featureName) {
  if (IS_SPARK_MODE) {
    throw new Error(`${featureName} is unavailable in the Hosting-only Spark edition because it requires a trusted backend.`);
  }
}
