import { useEffect, useState } from "react";
import { getUserSettings, subscribeUserSettings } from "../utils/userSettings";

export default function ModuleSceneBackground() {
  const [settings, setSettings] = useState(getUserSettings);
  useEffect(() => subscribeUserSettings(setSettings), []);
  const background = typeof document === "undefined" ? "#0b102f" :
    getComputedStyle(document.documentElement).getPropertyValue(
      settings.darkMode ? "--articton-nu-blue-dark" : "--articton-surface-muted"
    ).trim();
  return <color attach="background" args={[background]} />;
}
