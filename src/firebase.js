import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAnqDM-W_4ZyPLFCaLjbTnX1X4ig0Zs7pE",
  authDomain: "articton-57fd8.firebaseapp.com",
  projectId: "articton-57fd8",
  storageBucket: "articton-57fd8.firebasestorage.app",
  messagingSenderId: "711856935030",
  appId: "1:711856935030:web:9d6a5be8da29b277fc4f57",
  measurementId: "G-MQ261SQT64"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;