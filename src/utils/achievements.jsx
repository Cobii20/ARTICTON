import React from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase.js";

export const ACHIEVEMENTS = {
  module2: { id: "module-2-complete", title: "Module 2 Complete", subtitle: "Completed the full disassembly module." },
  module3: { id: "module-3-complete", title: "Module 3 Complete", subtitle: "Completed the full assembly module." },
  module2AMD: { id: "module-2-amd-disassembly-complete", title: "AMD Disassembly Module", subtitle: "Completed Module 2 on the AMD disassembly path." },
  module2Intel: { id: "module-2-intel-disassembly-complete", title: "Intel Disassembly Module", subtitle: "Completed Module 2 on the Intel disassembly path." },
  module3AMD: { id: "module-3-amd-assembly-complete", title: "AMD Assembly Module", subtitle: "Completed Module 3 on the AMD assembly path." },
  module3Intel: { id: "module-3-intel-assembly-complete", title: "Intel Assembly Module", subtitle: "Completed Module 3 on the Intel assembly path." },
  amdAssembly: { id: "amd-assembly-exam", title: "AMD Assembly Practical", subtitle: "Finished the AMD full assembly practical test." },
  amdDisassembly: { id: "amd-disassembly-exam", title: "AMD Disassembly Practical", subtitle: "Finished the AMD full disassembly practical test." },
  intelAssembly: { id: "intel-assembly-exam", title: "Intel Assembly Practical", subtitle: "Finished the Intel full assembly practical test." },
  intelDisassembly: { id: "intel-disassembly-exam", title: "Intel Disassembly Practical", subtitle: "Finished the Intel full disassembly practical test." },
};

function getPlatformKey(platform) {
  const normalized = String(platform || "").trim().toLowerCase();
  if (normalized === "amd") return "AMD";
  if (normalized === "intel") return "Intel";
  return "";
}

function resolveAchievement(key, extra = {}) {
  const platform = getPlatformKey(extra.platform);

  if (key === "module2" && platform) {
    return ACHIEVEMENTS[`module2${platform}`] || ACHIEVEMENTS.module2;
  }

  if (key === "module3" && platform) {
    return ACHIEVEMENTS[`module3${platform}`] || ACHIEVEMENTS.module3;
  }

  return ACHIEVEMENTS[key];
}

export async function unlockAchievement(userId, key, extra = {}) {
  const achievement = resolveAchievement(key, extra);
  if (!userId || !achievement) return null;

  await setDoc(
    doc(db, "users", userId),
    {
      accountAchievements: {
        [achievement.id]: {
          ...achievement,
          ...extra,
          unlocked: true,
          unlockedAt: serverTimestamp(),
        },
      },
    },
    { merge: true }
  );
  return achievement;
}

export function AchievementToast({ achievement, onClose }) {
  if (!achievement) return null;
  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[950]">
      <div className="pointer-events-auto w-[min(360px,calc(100vw-40px))] rounded-2xl border border-[#FFD41C]/35 bg-[#07111d]/96 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.48),0_0_40px_rgba(255,212,28,0.12)] backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFD41C] text-sm font-black text-[#07111d]">OK</div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFD41C]">Achievement Unlocked</div>
            <div className="mt-1 text-sm font-black text-white">{achievement.title}</div>
            <div className="mt-1 text-xs leading-5 text-[#aebdd3]">{achievement.subtitle}</div>
          </div>
          <button type="button" onClick={onClose} className="pointer-events-auto rounded-lg px-2 py-1 text-xs font-bold text-[#7a8ba8] transition hover:bg-white/5 hover:text-white">
            x
          </button>
        </div>
      </div>
    </div>
  );
}
