import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFunctionsEmulator,
  getFunctions,
} from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "articton-57fd8.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "articton-57fd8",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "articton-57fd8.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "711856935030",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:711856935030:web:9d6a5be8da29b277fc4f57",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-MQ261SQT64",
};

const useLocalEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";
const app = initializeApp(useLocalEmulators
  ? { ...firebaseConfig, projectId: "demo-articton", apiKey: "demo-api-key" }
  : firebaseConfig);

const appCheckSiteKey = String(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY || "").trim();
if (!useLocalEmulators && import.meta.env.PROD && appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, "us-central1");
export const storage = getStorage(app);

if (useLocalEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}

if (
  useLocalEmulators || (import.meta.env.DEV &&
  import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === "true")
) {
  connectFunctionsEmulator(
    functions,
    "127.0.0.1",
    5001
  );
}

export default app;
