import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase.js";

const saveGuidedModuleProgressCall = httpsCallable(functions, "saveGuidedModuleProgress");

export async function saveGuidedModuleProgress(progress) {
  const response = await saveGuidedModuleProgressCall(progress);
  return response.data;
}
