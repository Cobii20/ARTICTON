import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase.js";

const completeGuidedModuleCall = httpsCallable(functions, "completeGuidedModule");

export async function completeGuidedModule(moduleId) {
  const response = await completeGuidedModuleCall({ moduleId });
  if (response?.data?.moduleId !== moduleId || response?.data?.completed !== true) {
    throw new Error("The server did not confirm module completion.");
  }
  return response.data;
}

export function saveLocalModuleNavigation(uid, moduleId, state) {
  if (!uid || !moduleId || typeof window === "undefined") return;
  const safeState = JSON.parse(JSON.stringify(state));
  window.localStorage.setItem(
    `articton:module-navigation:${uid}:${moduleId}`,
    JSON.stringify({ ...safeState, savedAt: new Date().toISOString() })
  );
}
