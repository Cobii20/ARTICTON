export const DEFAULT_USER_SETTINGS = {
  sound: true,
  animations: true,
  aiVoiceover: false,
  darkMode: true,
};

const SETTINGS_STORAGE_KEY = "artictonUserSettings";
const SETTINGS_EVENT_NAME = "articton-settings-changed";
const EDIT_PROFILE_EVENT_NAME = "articton-edit-profile-requested";

function canUseDOM() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function getUserSettings() {
  if (!canUseDOM()) return DEFAULT_USER_SETTINGS;

  try {
    const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
    return {
      ...DEFAULT_USER_SETTINGS,
      ...savedSettings,
    };
  } catch {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    return DEFAULT_USER_SETTINGS;
  }
}

export function applyThemeSettings(settings = getUserSettings()) {
  if (!canUseDOM()) return;

  const darkMode = settings.darkMode ?? DEFAULT_USER_SETTINGS.darkMode;

  document.documentElement.classList.toggle("articton-light", !darkMode);
  document.documentElement.classList.toggle("articton-dark", darkMode);
  document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
}

export function saveUserSettings(settings) {
  const nextSettings = {
    ...getUserSettings(),
    ...settings,
  };

  if (!canUseDOM()) return nextSettings;

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  applyThemeSettings(nextSettings);
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT_NAME, { detail: nextSettings }));

  return nextSettings;
}

export function saveUserSetting(key, value) {
  return saveUserSettings({ [key]: value });
}

export function subscribeUserSettings(listener) {
  if (!canUseDOM()) return () => {};

  const handleSettingsChange = (event) => {
    listener(event.detail || getUserSettings());
  };

  const handleStorageChange = (event) => {
    if (event.key === SETTINGS_STORAGE_KEY) listener(getUserSettings());
  };

  window.addEventListener(SETTINGS_EVENT_NAME, handleSettingsChange);
  window.addEventListener("storage", handleStorageChange);

  return () => {
    window.removeEventListener(SETTINGS_EVENT_NAME, handleSettingsChange);
    window.removeEventListener("storage", handleStorageChange);
  };
}

export function requestEditProfile() {
  if (!canUseDOM()) return;
  window.dispatchEvent(new CustomEvent(EDIT_PROFILE_EVENT_NAME));
}

export function subscribeEditProfileRequests(listener) {
  if (!canUseDOM()) return () => {};

  window.addEventListener(EDIT_PROFILE_EVENT_NAME, listener);
  return () => window.removeEventListener(EDIT_PROFILE_EVENT_NAME, listener);
}
