import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase.js";

const saveModuleOneProgressCall = httpsCallable(functions, "saveModuleOneProgress");

export async function persistModuleOneProgress(progress) {
  const response = await saveModuleOneProgressCall(progress);
  return response.data;
}
