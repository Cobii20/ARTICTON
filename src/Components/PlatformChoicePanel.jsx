import React from "react";

/**
 * Shared AMD / Intel platform selector used by Modules 1–3.
 *
 * Zoom behavior:
 * - Uses viewport-relative clamp() sizing instead of relying only on fixed px/rem values.
 * - When the browser is zoomed OUT, the effective CSS viewport becomes wider, so this
 *   panel and its important content grow proportionally and remain visually prominent.
 * - When the browser is zoomed IN or the window becomes narrow, it still respects 92vw
 *   and can stack the cards instead of overflowing.
 */
export default function PlatformChoicePanel({
  title = "Every PC starts with a decision",
  subtitle = "Choose the processor platform you want to work with.",
  platforms = [],
  selectedPlatform = null,
  onSelectPlatform,
  className = "",
}) {
  return (
    <section
      className={[
        "articton-platform-choice-panel relative overflow-hidden",
        "rounded-[clamp(22px,1.45vw,30px)]",
        "border border-[#00ffb4]/28 bg-[#07121c]/88",
        "shadow-[0_0_46px_rgba(0,255,180,0.10),0_28px_90px_rgba(0,0,0,0.52)]",
        "backdrop-blur-xl",
        className,
      ].join(" ")}
      style={{
        // Keep the actual platform choices visually dominant. The panel grows on
        // wide/zoomed-out viewports, but still stays inside the effective viewport.
        width: "min(88vw, max(720px, 44vw))",
      }}
    >
      <div className="pointer-events-none absolute inset-x-[12%] top-0 h-px bg-gradient-to-r from-transparent via-[#00ffb4]/70 to-transparent" />
      <div className="pointer-events-none absolute -top-28 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-[#00ffb4]/8 blur-3xl" />

      <div className="relative px-[clamp(18px,1.15vw,30px)] py-[clamp(18px,1.15vw,30px)]">
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-[clamp(7px,0.45vw,10px)] rounded-full border border-[#00ffb4]/20 bg-[#00ffb4]/[0.07] px-[clamp(10px,0.7vw,16px)] py-[clamp(5px,0.36vw,8px)]">
            <span className="h-[clamp(6px,0.36vw,8px)] w-[clamp(6px,0.36vw,8px)] rounded-full bg-[#00ffb4] shadow-[0_0_12px_rgba(0,255,180,0.85)]" />
            <span className="text-[clamp(9px,0.52vw,12px)] font-black uppercase tracking-[0.24em] text-[#67ffd1]">
              Processor Platform
            </span>
          </div>
        </div>

        <h2 className="mt-[clamp(12px,0.75vw,18px)] text-center text-[clamp(24px,1.4vw,34px)] font-black leading-tight text-white">
          {title}
        </h2>

        <p className="mx-auto mt-[clamp(7px,0.45vw,11px)] max-w-[70%] text-center text-[clamp(11px,0.68vw,15px)] leading-[1.55] text-[#9fb0c8] max-sm:max-w-full">
          {subtitle}
        </p>

        <div className="mt-[clamp(18px,1.15vw,28px)] grid grid-cols-2 gap-[clamp(12px,0.8vw,20px)] max-sm:grid-cols-1">
          {platforms.map((platform) => {
            const active = selectedPlatform === platform.id;
            const initial = platform.name?.charAt(0)?.toUpperCase() || "P";

            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => onSelectPlatform?.(platform.id)}
                aria-pressed={active}
                className={[
                  "group relative flex min-h-[clamp(190px,11.5vw,270px)] flex-col overflow-hidden",
                  "rounded-[clamp(18px,1.15vw,25px)] border p-[clamp(15px,0.95vw,23px)] text-left",
                  "transition duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/30",
                  "hover:-translate-y-1 hover:border-[#00ffb4]/45 hover:bg-[#0d2230]",
                  active
                    ? "border-[#00ffb4]/60 bg-[#0b2a2a] shadow-[0_0_28px_rgba(0,255,180,0.14)]"
                    : "border-white/10 bg-[#0c1722]/86 shadow-[0_14px_36px_rgba(0,0,0,0.20)]",
                ].join(" ")}
              >
                <div className="pointer-events-none absolute -right-[14%] -top-[20%] h-[clamp(100px,6.8vw,150px)] w-[clamp(100px,6.8vw,150px)] rounded-full border border-white/[0.05] bg-white/[0.02] transition duration-300 group-hover:scale-110 group-hover:border-[#00ffb4]/10" />

                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex h-[clamp(42px,2.65vw,58px)] w-[clamp(42px,2.65vw,58px)] items-center justify-center rounded-[clamp(12px,0.8vw,17px)] border border-[#00ffb4]/20 bg-[#00ffb4]/[0.08] text-[clamp(18px,1.05vw,25px)] font-black text-[#67ffd1] shadow-[inset_0_0_20px_rgba(0,255,180,0.04)]">
                    {initial}
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/[0.035] px-[clamp(8px,0.55vw,13px)] py-[clamp(4px,0.28vw,7px)] text-[clamp(8px,0.44vw,10px)] font-extrabold uppercase tracking-[0.18em] text-[#70839f]">
                    CPU Platform
                  </div>
                </div>

                <div className="relative mt-[clamp(13px,0.9vw,21px)]">
                  <div className="text-[clamp(22px,1.22vw,30px)] font-black leading-none text-white">
                    {platform.name}
                  </div>

                  <div className="mt-[clamp(8px,0.55vw,13px)] max-w-[95%] text-[clamp(10px,0.61vw,14px)] leading-[1.58] text-[#9eb0c7]">
                    {platform.detail}
                  </div>
                </div>

                <div className="relative mt-auto flex items-center justify-between border-t border-white/[0.07] pt-[clamp(11px,0.72vw,17px)]">
                  <span className="text-[clamp(9px,0.52vw,12px)] font-black uppercase tracking-[0.16em] text-[#00ffb4]">
                    Choose {platform.name}
                  </span>

                  <span className="flex h-[clamp(27px,1.65vw,36px)] w-[clamp(27px,1.65vw,36px)] items-center justify-center rounded-full border border-[#00ffb4]/20 bg-[#00ffb4]/[0.07] text-[clamp(13px,0.8vw,18px)] text-[#67ffd1] transition duration-200 group-hover:translate-x-0.5 group-hover:bg-[#00ffb4]/[0.12]">
                    →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}