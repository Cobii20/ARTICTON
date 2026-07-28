import { createElement } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic2, Moon, Sun, UserPen, Volume2, X } from "lucide-react";
import { getUserSettings, requestEditProfile, saveUserSetting } from "../utils/userSettings";

const MotionDiv = motion.div;

export default function SettingsModal({
  isOpen,
  onClose,
  settings = {},
  onChange,
  onSettingChange,
  onEditProfile,
}) {
  const mergedSettings = {
    ...getUserSettings(),
    ...settings,
  };

  const updateSetting = (key, value) => {
    const nextSettings = saveUserSetting(key, value);
    const changeHandler = onChange || onSettingChange;

    if (typeof changeHandler === "function") {
      changeHandler(key, nextSettings[key]);
    }
  };

  const handleEditProfile = () => {
    if (typeof onEditProfile === "function") onEditProfile();
    else requestEditProfile();

    if (typeof onClose === "function") onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <MotionDiv
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <MotionDiv
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-[#1a2438] bg-[#0d1220] shadow-[0_30px_100px_rgba(0,0,0,0.65)]"
          >
            <div className="flex items-center justify-between border-b border-[#1a2438] px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-white">Settings</h2>
                <p className="text-xs text-[#7a8ba8]">Customize your experience</p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1a2438] bg-white/[0.03] text-white/70 transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <SettingSwitch
                icon={Volume2}
                title="Sound Effects"
                subtitle="Enable interaction sounds"
                checked={mergedSettings.sound ?? true}
                onChange={(value) => updateSetting("sound", value)}
              />

              <SettingSwitch
                icon={Mic2}
                title="AI Voiceover"
                subtitle="Enable narrated AI guidance"
                checked={mergedSettings.aiVoiceover ?? false}
                onChange={(value) => updateSetting("aiVoiceover", value)}
              />

              <SettingSwitch
                icon={mergedSettings.darkMode ? Moon : Sun}
                title="Dark Mode / Light Mode"
                subtitle={mergedSettings.darkMode ? "Use dark interface theme" : "Use light interface theme"}
                checked={mergedSettings.darkMode ?? true}
                onChange={(value) => updateSetting("darkMode", value)}
              />

              <button
                type="button"
                onClick={handleEditProfile}
                className="flex w-full items-center justify-between rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4 text-left transition hover:border-[#00ffb4]/35 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00ffb4]/10 text-[#00ffb4]">
                    <UserPen className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">Edit Profile</span>
                    <span className="block text-xs text-[#7a8ba8]">Update your name and profile photo</span>
                  </span>
                </span>
                <span className="shrink-0 rounded-xl border border-[#00ffb4]/25 bg-[#00ffb4]/10 px-3 py-2 text-xs font-bold text-[#00ffb4]">
                  Open
                </span>
              </button>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#1a2438] px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#1a2438] bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25"
              >
                Close
              </button>
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
}

function SettingSwitch({ icon: Icon, title, subtitle, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00ffb4]/10 text-[#00ffb4]">
          {createElement(Icon, { className: "h-5 w-5" })}
        </div>

        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="text-xs text-[#7a8ba8]">{subtitle}</div>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/25 ${
          checked ? "border-[#00ffb4]/60 bg-[#00ffb4]" : "border-[#2a3550] bg-[#111827]"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
