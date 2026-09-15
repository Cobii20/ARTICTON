import { initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFunctionsEmulator,
  getFunctions,
} from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "articton-57fd8.firebaseapp.com",
  projectId: "articton-57fd8",
  storageBucket: "articton-57fd8.firebasestorage.app",
  messagingSenderId: "711856935030",
  appId: "1:711856935030:web:9d6a5be8da29b277fc4f57",
  measurementId: "G-MQ261SQT64",
};

const useLocalEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";
const app = initializeApp(useLocalEmulators
  ? { ...firebaseConfig, projectId: "demo-articton", apiKey: "demo-api-key" }
  : firebaseConfig);

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