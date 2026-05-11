import { AnimatePresence, motion } from "framer-motion";

export default function SettingsModal({
  isOpen,
  onClose,
  settings = {},
  onChange,
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_30px_100px_rgba(0,0,0,0.65)]"
          >
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-[#1a2438] px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Settings
                </h2>

                <p className="text-xs text-[#7a8ba8]">
                  Customize your experience
                </p>
              </div>

              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1a2438] bg-white/[0.03] text-white/70 transition hover:bg-white/[0.06]"
              >
                ✕
              </button>
            </div>

            {/* CONTENT */}
            <div className="space-y-6 p-6">
              {/* SOUND */}
              <div className="flex items-center justify-between rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Sound Effects
                  </div>

                  <div className="text-xs text-[#7a8ba8]">
                    Enable interaction sounds
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={settings.sound ?? true}
                  onChange={(e) =>
                    onChange("sound", e.target.checked)
                  }
                  className="h-5 w-5 accent-[#00ffb4]"
                />
              </div>

              {/* ANIMATIONS */}
              <div className="flex items-center justify-between rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Animations
                  </div>

                  <div className="text-xs text-[#7a8ba8]">
                    Enable UI animations
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={settings.animations ?? true}
                  onChange={(e) =>
                    onChange("animations", e.target.checked)
                  }
                  className="h-5 w-5 accent-[#00ffb4]"
                />
              </div>

              {/* DARK MODE */}
              <div className="flex items-center justify-between rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Dark Mode
                  </div>

                  <div className="text-xs text-[#7a8ba8]">
                    Use dark interface theme
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={settings.darkMode ?? true}
                  onChange={(e) =>
                    onChange("darkMode", e.target.checked)
                  }
                  className="h-5 w-5 accent-[#00ffb4]"
                />
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex justify-end gap-3 border-t border-[#1a2438] px-6 py-4">
              <button
                onClick={onClose}
                className="rounded-xl border border-[#1a2438] bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06]"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}