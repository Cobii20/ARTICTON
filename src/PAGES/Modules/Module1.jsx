import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Environment, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";

const COLORS = {
  pineBlue: "#50757B",
  lightBlue: "#B2C9CF",
  lightBlueHeader: "#A6BEC5",
  graphite: "#2C2C2E",
};

/* ===================== INTRO "POWERPOINT" DECK ===================== */
function IntroDeck({ slides, onDone }) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [slides]);

  const slide = slides[index];
  const isLast = index === slides.length - 1;

  return (
    <div className="absolute inset-0 z-50">
      <div className="absolute inset-0 bg-black/55" />

      <div className="relative h-full w-full flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: 0.22 }}
            className={[
              "w-[1120px] max-w-[calc(100vw-40px)]",
              "min-h-[520px]",
              "rounded-[32px] overflow-hidden",
              "shadow-[0_40px_120px_rgba(0,0,0,0.45)]",
            ].join(" ")}
            style={{ backgroundColor: COLORS.lightBlue }}
          >
            <div
              className="px-10 py-7 flex items-center justify-between gap-4"
              style={{ backgroundColor: COLORS.lightBlueHeader }}
            >
              <div className="min-w-0">
                <div className="text-[14px]" style={{ color: `${COLORS.graphite}B3` }}>
                  Introduction
                </div>
                <div className="text-[26px] font-extrabold truncate" style={{ color: COLORS.graphite }}>
                  {slide.title}
                </div>
              </div>

              <div className="text-[14px] font-medium" style={{ color: `${COLORS.graphite}B3` }}>
                {index + 1}/{slides.length}
              </div>
            </div>

            <div className="px-10 py-8">
              <div className="text-[18px] leading-relaxed whitespace-pre-line" style={{ color: COLORS.graphite }}>
                {slide.body}
              </div>

              {slide.points?.length ? (
                <ul className="mt-6 space-y-3" style={{ color: `${COLORS.graphite}CC` }}>
                  {slide.points.map((p, i) => (
                    <li key={i} className="flex gap-3 text-[17px] leading-relaxed">
                      <span
                        className="mt-[10px] h-2 w-2 rounded-full flex-none"
                        style={{ backgroundColor: `${COLORS.graphite}99` }}
                      />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-10 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index === 0}
                  className="h-12 px-6 rounded-2xl border transition disabled:opacity-40 text-[16px] font-semibold"
                  style={{
                    borderColor: `${COLORS.graphite}1A`,
                    backgroundColor: "rgba(255,255,255,0.50)",
                    color: COLORS.graphite,
                  }}
                >
                  ← Back
                </button>

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={onDone}
                    className="h-12 px-6 rounded-2xl border transition text-[16px] font-semibold"
                    style={{
                      borderColor: `${COLORS.graphite}1A`,
                      backgroundColor: "rgba(255,255,255,0.50)",
                      color: COLORS.graphite,
                    }}
                    title="Skip introduction"
                  >
                    Skip
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isLast) onDone();
                      else setIndex((i) => i + 1);
                    }}
                    className="h-12 px-7 rounded-2xl font-semibold transition text-[16px]"
                    style={{ backgroundColor: COLORS.pineBlue, color: "white" }}
                  >
                    {isLast ? "Start 3D →" : "Next →"}
                  </button>
                </div>
              </div>

              <div className="mt-6 text-[14px]" style={{ color: `${COLORS.graphite}99` }}>
                Tip: press <b>D</b> then click the model to log exact hotspot coordinates.
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ===================== HOTSPOT PIN (with UI offset) ===================== */
function HotspotPin({
  number,
  position,
  active,
  onClick,
  pin = { buttonPx: 36, glowRadius: 0.05, distanceFactor: 10 },
  uiOffset, // [xPx, yPx]
}) {
  const btn = pin.buttonPx ?? 36;
  const glow = pin.glowRadius ?? 0.05;
  const dist = pin.distanceFactor ?? 10;
  const offX = uiOffset?.[0] ?? 0;
  const offY = uiOffset?.[1] ?? 0;

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[glow, 24, 24]} />
        <meshBasicMaterial color={active ? "#5F9598" : "white"} transparent opacity={active ? 0.2 : 0.08} />
      </mesh>

      <Html center distanceFactor={dist} occlude={false}>
        <motion.button
          type="button"
          onClick={onClick}
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.95 }}
          className={[
            "relative rounded-full flex items-center justify-center",
            "border backdrop-blur-md",
            "shadow-[0_16px_45px_rgba(0,0,0,0.55)]",
            "transition select-none",
            active
              ? "bg-white/92 text-black border-white/60"
              : "bg-white/72 text-black border-white/30 hover:bg-white/90",
          ].join(" ")}
          aria-label={`Hotspot ${number}`}
          style={{
            width: btn,
            height: btn,
            transform: `translate(-50%, -50%) translate(${offX}px, ${offY}px)`,
          }}
        >
          <span className="absolute inset-[3px] rounded-full border border-black/10" />
          <span style={{ fontSize: Math.max(11, Math.round(btn * 0.33)) }} className="font-extrabold">
            {number}
          </span>

          {!active ? (
            <motion.span
              className="absolute inset-0 rounded-full border border-white/45"
              initial={{ opacity: 0.0, scale: 1 }}
              animate={{ opacity: [0.0, 0.35, 0.0], scale: [1, 1.35, 1.55] }}
              transition={{ duration: 2.3, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : null}
        </motion.button>
      </Html>
    </group>
  );
}

/* ===================== 3D SCENE (FIX: normalize center/scale so Bounds doesn't shrink it) ===================== */
function ModelScene({
  url,
  hotspots,
  activeId,
  setActiveId,
  debug,
  setLastCoords,
  modelScale = 1,
  modelRotation = [0, 0, 0],
  modelPosition = [0, 0, 0],
  pinStyle,
  normalize, // { enabled: true, targetSize: 1.6 }  <-- used for RAM/PSU
}) {
  const { scene } = useGLTF(url);
  const groupRef = useRef();

  // ✅ This fixes "model looks tiny" when the GLB has a huge empty bounding box.
  // We compute a tight box from meshes only, then recenter + scale to a target size.
  const normalized = useMemo(() => {
    if (!normalize?.enabled) return { scale: 1, offset: new THREE.Vector3(0, 0, 0) };

    const box = new THREE.Box3();
    const tmp = new THREE.Box3();

    let hasMesh = false;
    scene.updateMatrixWorld(true);

    scene.traverse((obj) => {
      if (!obj.isMesh) return;
      hasMesh = true;

      // geometry bounds in local space -> transform to world
      if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
      tmp.copy(obj.geometry.boundingBox);
      tmp.applyMatrix4(obj.matrixWorld);
      box.union(tmp);
    });

    if (!hasMesh || !isFinite(box.min.x) || !isFinite(box.max.x)) {
      return { scale: 1, offset: new THREE.Vector3(0, 0, 0) };
    }

    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const biggest = Math.max(size.x, size.y, size.z) || 1;
    const target = normalize.targetSize ?? 1.6; // world units
    const s = target / biggest;

    // offset to re-center model at origin
    const offset = center.multiplyScalar(-1);

    return { scale: s, offset };
  }, [scene, normalize?.enabled, normalize?.targetSize]);

  const onPointerDown = (e) => {
    if (!debug) return;
    e.stopPropagation();

    const local = e.point.clone();
    if (groupRef.current) groupRef.current.worldToLocal(local);

    const coords = [Number(local.x.toFixed(3)), Number(local.y.toFixed(3)), Number(local.z.toFixed(3))];
    setLastCoords(coords);
    // eslint-disable-next-line no-console
    console.log(`[HOTSPOT COORD] ${url} clicked: [${coords.join(", ")}]`);
  };

  return (
    <group
      ref={groupRef}
      onPointerDown={onPointerDown}
      rotation={modelRotation}
      position={modelPosition}
      scale={modelScale}
    >
      {/* ✅ normalized wrapper (centered, scaled) */}
      <group position={normalized.offset.toArray()} scale={normalized.scale}>
        <primitive object={scene} />
      </group>

      {/* Pins */}
      {hotspots.map((h) => (
        <HotspotPin
          key={h.id}
          {...h}
          active={activeId === h.id}
          pin={pinStyle}
          uiOffset={h.uiOffset}
          onClick={() => setActiveId((prev) => (prev === h.id ? null : h.id))}
        />
      ))}
    </group>
  );
}

/* ===================== INFO CARD (ENGLISH ONLY) ===================== */
function HotspotInfoCard({ hotspot, onClose }) {
  return (
    <AnimatePresence>
      {hotspot ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.18 }}
          className="absolute left-8 bottom-8 z-40"
        >
          <div className="w-[380px] max-w-[calc(100vw-64px)] rounded-2xl border border-white/10 bg-black/75 backdrop-blur-xl shadow-[0_22px_80px_rgba(0,0,0,0.65)] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-extrabold text-white truncate">{hotspot.title}</div>
                <div className="text-[11px] text-white/45">Hotspot {hotspot.number}</div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center justify-center text-white/70"
                aria-label="Close hotspot"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              <div className="text-[12px] leading-relaxed text-white/85">{hotspot.en}</div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function Module1Page({ onBack }) {
  const [moduleIndex, setModuleIndex] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const [showIntro, setShowIntro] = useState(true);

  const [debug, setDebug] = useState(false);
  const [lastCoords, setLastCoords] = useState(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key?.toLowerCase() === "d") setDebug((v) => !v);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ✅ pc.glb intentionally excluded
  const modules = useMemo(
    () => [
      {
        key: "cpu",
        name: "CPU",
        url: "/models/cpu.glb",
        view: {
          cameraPos: [0, 1.2, 3.2],
          boundsMargin: 1.15,
          minDistance: 1.8,
          maxDistance: 7,
          modelScale: 1,
          modelRotation: [0, 0, 0],
          modelPosition: [0, 0, 0],
          pinStyle: { buttonPx: 36, glowRadius: 0.05, distanceFactor: 10 },
          normalize: { enabled: false },
        },
        slides: [
          {
            id: "cpu-s1",
            title: "CPU Disassembly Overview",
            body:
              "In this module, you’ll explore a CPU package in 3D.\n" +
              "You will identify key external parts before moving into deeper disassembly steps.",
            points: [
              "Rotate, zoom, and inspect the CPU from any angle.",
              "Tap numbered pins to learn each component.",
              "Use this as a visual guide before physical disassembly.",
            ],
          },
        ],
        hotspots: [
          { id: "cpu-hs-1", number: 1, title: "Heat Spreader (Top Cap)", position: [0.05, 0.18, 0.02], en: "The top metal cover spreads heat from the chip to the cooler for better cooling." },
          { id: "cpu-hs-2", number: 2, title: "Substrate / Package Base", position: [0.32, 0.05, 0.14], en: "The base that supports the CPU package and routes signals between internal layers." },
          { id: "cpu-hs-3", number: 3, title: "Contact / Pin Area", position: [0.28, -0.07, 0.28], en: "The contact area connects the CPU to the motherboard socket to deliver power and data." },
        ],
      },

      {
        key: "motherboard",
        name: "Motherboard",
        url: "/models/motherboard.glb",
        view: {
          cameraPos: [0, 1.2, 3.2],
          boundsMargin: 1.2,
          minDistance: 1.8,
          maxDistance: 7,
          modelScale: 1,
          modelRotation: [0, 0, 0],
          modelPosition: [0, 0, 0],
          pinStyle: { buttonPx: 36, glowRadius: 0.05, distanceFactor: 10 },
          normalize: { enabled: false },
        },
        slides: [
          {
            id: "mb-s1",
            title: "Motherboard Overview",
            body:
              "This module helps you identify major motherboard zones.\n" +
              "Focus on where power comes in, where the CPU/RAM sit, and how storage connects.",
            points: ["Learn main connectors and slots.", "Understand how parts communicate on the board.", "Use pins to identify components quickly."],
          },
        ],
        hotspots: [
          { id: "mb-hs-1", number: 1, title: "CPU Socket Area", position: [0.0, 0.2, 0.0], en: "The CPU socket holds and connects the processor to the motherboard." },
          { id: "mb-hs-2", number: 2, title: "RAM Slots", position: [0.35, 0.12, 0.1], en: "DIMM slots where memory modules are installed." },
          { id: "mb-hs-3", number: 3, title: "24-pin ATX Power Connector", position: [0.45, 0.0, 0.25], en: "Main power input from the PSU to the motherboard." },
        ],
      },

      /* ✅ RAM FIX:
         - normalize enabled (fix tiny model from huge GLB bounds)
         - rotate/position to make rotation look good
         - pins moved to LEFT empty space + made SMALLER (no giant circles)
      */
      {
        key: "ram",
        name: "RAM",
        url: "/models/ram.glb",
        view: {
          cameraPos: [0, 0.65, 3.2],
          boundsMargin: 1.1,
          minDistance: 1.0,
          maxDistance: 7.0,
          modelScale: 1.25,
          modelRotation: [0, 0.35, 0], // slight angle for nicer display; change if you want
          modelPosition: [0, 0, 0],
          normalize: { enabled: true, targetSize: 2.2 },
          // SMALL pins (your screenshot shows them huge)
          pinStyle: { buttonPx: 26, glowRadius: 0.02, distanceFactor: 18 },
        },
        slides: [
          {
            id: "ram-s1",
            title: "RAM Module Overview",
            body: "Explore a RAM stick and learn its key parts.\nRAM provides fast temporary storage while programs run.",
            points: ["Identify the IC chips and connector edge.", "Understand the notch alignment.", "Learn safe handling."],
          },
        ],
        hotspots: [
          {
            id: "ram-hs-1",
            number: 1,
            title: "Memory IC Chips",
            position: [0, 0, 0],
            uiOffset: [-460, -170],
            en: "These chips store data temporarily for fast access by the CPU.",
          },
          {
            id: "ram-hs-2",
            number: 2,
            title: "Gold Contacts (Edge Connector)",
            position: [0, 0, 0],
            uiOffset: [-460, 0],
            en: "The gold contacts connect the RAM electrically to the motherboard DIMM slot.",
          },
          {
            id: "ram-hs-3",
            number: 3,
            title: "Alignment Notch",
            position: [0, 0, 0],
            uiOffset: [-460, 170],
            en: "The notch ensures the RAM is inserted in the correct orientation.",
          },
        ],
      },

      {
        key: "hdd",
        name: "HDD",
        url: "/models/hdd.glb",
        view: {
          cameraPos: [0, 0.9, 3.0],
          boundsMargin: 1.15,
          minDistance: 1.6,
          maxDistance: 7,
          modelScale: 1,
          modelRotation: [0, 0, 0],
          modelPosition: [0, 0, 0],
          pinStyle: { buttonPx: 34, glowRadius: 0.05, distanceFactor: 10 },
          normalize: { enabled: false },
        },
        slides: [
          {
            id: "hdd-s1",
            title: "Hard Disk Drive Overview",
            body: "This module introduces the HDD exterior and connection points.\nHDDs store data long-term using spinning platters internally.",
            points: ["Identify SATA data + power ports.", "Recognize the casing and mounting holes.", "Learn handling precautions."],
          },
        ],
        hotspots: [
          { id: "hdd-hs-1", number: 1, title: "SATA Data Port", position: [0.15, -0.03, 0.22], en: "Transfers data between the HDD and motherboard via a SATA cable." },
          { id: "hdd-hs-2", number: 2, title: "SATA Power Port", position: [0.22, -0.03, 0.22], en: "Receives power from the PSU through the SATA power connector." },
          { id: "hdd-hs-3", number: 3, title: "Drive Casing", position: [0.0, 0.1, 0.0], en: "Protective metal enclosure that houses internal parts." },
        ],
      },

      /* ✅ PSU FIX:
         - normalize enabled (prevents Bounds from using huge empty bounds)
         - zoom out a bit (cameraPos farther + minDistance higher)
         - pins moved to RIGHT empty space + bigger than RAM but NOT absurd
      */
      {
        key: "psu",
        name: "PSU",
        url: "/models/psu.glb",
        view: {
          cameraPos: [0, 1.15, 6.2],
          boundsMargin: 1.2,
          minDistance: 3.8,
          maxDistance: 12,
          modelScale: 1.0,
          modelRotation: [0, -0.25, 0],
          modelPosition: [0, 0, 0],
          normalize: { enabled: true, targetSize: 2.6 },
          pinStyle: { buttonPx: 44, glowRadius: 0.05, distanceFactor: 14 },
        },
        slides: [
          {
            id: "psu-s1",
            title: "Power Supply Unit Overview",
            body: "The PSU converts AC wall power into regulated DC power for the PC.",
            points: ["Identify the AC input and main output area.", "PSUs must not be opened.", "Use pins to locate key areas."],
          },
        ],
        hotspots: [
          {
            id: "psu-hs-1",
            number: 1,
            title: "PSU Fan / Vent",
            position: [0, 0, 0],
            uiOffset: [460, -170],
            en: "Moves air to cool internal components and maintain stable power delivery.",
          },
          {
            id: "psu-hs-2",
            number: 2,
            title: "AC Input Socket",
            position: [0, 0, 0],
            uiOffset: [460, 0],
            en: "Where the power cable from the wall plugs into the PSU.",
          },
          {
            id: "psu-hs-3",
            number: 3,
            title: "DC Output / Cable Interface",
            position: [0, 0, 0],
            uiOffset: [460, 170],
            en: "Where PSU cables connect to supply power to the motherboard, GPU, and storage.",
          },
        ],
      },

      {
        key: "case",
        name: "Case",
        url: "/models/case.glb",
        view: {
          cameraPos: [0, 1.25, 5.3],
          boundsMargin: 1.25,
          minDistance: 2.2,
          maxDistance: 10,
          modelScale: 1,
          modelRotation: [0, 0, 0],
          modelPosition: [0, 0, 0],
          pinStyle: { buttonPx: 36, glowRadius: 0.05, distanceFactor: 10 },
          normalize: { enabled: false },
        },
        slides: [
          {
            id: "case-s1",
            title: "PC Case Overview",
            body: "The case provides structure, airflow, and mounting points for components.",
            points: ["Identify motherboard tray and PSU bay.", "Find storage mounting areas.", "Understand airflow direction."],
          },
        ],
        hotspots: [
          { id: "case-hs-1", number: 1, title: "Motherboard Tray Area", position: [0.0, 0.2, 0.0], en: "Where the motherboard mounts using standoffs and screws." },
          { id: "case-hs-2", number: 2, title: "PSU Bay", position: [-0.25, -0.15, 0.15], en: "The compartment where the power supply is installed." },
          { id: "case-hs-3", number: 3, title: "Drive Bay / Storage Mount", position: [0.28, -0.05, 0.2], en: "Where HDD/SSD mounts are located in many case designs." },
        ],
      },
    ],
    []
  );

  const current = modules[moduleIndex];

  // Preload (excluding pc.glb)
  useEffect(() => {
    modules.forEach((m) => useGLTF.preload(m.url));
  }, [modules]);

  const activeHotspot = useMemo(
    () => current.hotspots.find((h) => h.id === activeId) || null,
    [current, activeId]
  );

  const user = useMemo(() => ({ name: "John Doe" }), []);

  const goNextModule = () => {
    setActiveId(null);
    setLastCoords(null);
    setModuleIndex((i) => (i + 1) % modules.length);
    setShowIntro(true);
  };

  const goPrevModule = () => {
    setActiveId(null);
    setLastCoords(null);
    setModuleIndex((i) => (i - 1 + modules.length) % modules.length);
    setShowIntro(true);
  };

  return (
    <div className="min-h-screen w-full bg-[#061E29] text-[#F3F4F4] font-sans antialiased overflow-hidden">
      <div className="relative w-full h-screen overflow-hidden">
        <div className="pointer-events-none absolute -top-44 -left-44 h-[720px] w-[720px] rounded-full bg-[#5F9598]/18 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-56 -right-52 h-[820px] w-[820px] rounded-full bg-[#1D546D]/26 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#061E29] via-[#061E29] to-[#0B2A3A]" />

        <div className="relative w-full h-full overflow-hidden">
          <div className="relative w-full h-full overflow-hidden rounded-none md:rounded-[30px] md:m-3 border border-white/10 shadow-[0_70px_180px_rgba(0,0,0,0.70)]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#061E29] via-[#0B2A3A] to-[#1D546D]/35" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_12%,rgba(95,149,152,0.16),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_22%,rgba(29,84,109,0.22),transparent_55%)]" />
            <div className="absolute inset-0 bg-black/10 ring-1 ring-white/5" />

            <div className="relative h-full w-full overflow-hidden flex flex-col">
              {/* top label */}
              <div className="px-6 md:px-10 pt-6 flex items-center justify-between">
                <div className="text-[12px] text-white/55">
                  Module {moduleIndex + 1} — {current.name}
                </div>

                <div className="text-[11px] text-white/45 flex items-center gap-2">
                  {debug ? (
                    <span className="px-2 py-1 rounded-lg bg-white/10 border border-white/10">
                      Debug ON — click model to log coords (press D)
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                      Press D for hotspot debug
                    </span>
                  )}

                  {debug && lastCoords ? (
                    <span className="hidden sm:inline-flex px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                      Last: [{lastCoords.join(", ")}]
                    </span>
                  ) : null}
                </div>
              </div>

              {/* top nav */}
              <div className="px-6 md:px-10 mt-3">
                <div className="w-full rounded-[18px] border border-white/10 bg-black/20 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.30)] px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-[#5F9598]/16 border border-[#5F9598]/25 flex items-center justify-center shadow-sm">
                      <div className="h-3 w-3 rounded-full bg-[#5F9598]" />
                    </div>
                    <div className="text-base font-bold tracking-wide">Articton</div>
                  </div>

                  <button type="button" onClick={onBack} className="text-[13px] text-white/80 hover:text-white transition">
                    Back to Dashboard
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="text-[13px] text-white/80">{user.name}</div>
                    <div className="h-10 w-10 rounded-full bg-white/10 border border-white/10" />
                  </div>
                </div>
              </div>

              {/* viewer */}
              <div className="flex-1 px-6 md:px-10 py-6 min-h-0">
                <div className="relative h-full rounded-[22px] border border-white/10 bg-black/20 backdrop-blur-xl overflow-hidden shadow-[0_28px_90px_rgba(0,0,0,0.45)]">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(255,255,255,0.08),transparent_40%)]" />
                  <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.55)]" />

                  <div className="absolute inset-6 rounded-[18px] border border-white/10 bg-black/10">
                    <div className="pointer-events-none absolute inset-0 rounded-[18px] ring-1 ring-[#5F9598]/20 shadow-[0_0_0_1px_rgba(95,149,152,0.14)]" />
                    <div className="pointer-events-none absolute -top-24 -left-24 h-56 w-56 rounded-full bg-[#5F9598]/12 blur-3xl" />
                  </div>

                  {!showIntro ? <HotspotInfoCard hotspot={activeHotspot} onClose={() => setActiveId(null)} /> : null}

                  <div className="absolute inset-6 rounded-[18px] overflow-hidden">
                    <AnimatePresence mode="wait">
                      {showIntro ? (
                        <motion.div
                          key={`intro-${current.key}`}
                          className="absolute inset-0"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.28 }}
                        >
                          <IntroDeck
                            slides={current.slides}
                            onDone={() => {
                              setShowIntro(false);
                              setActiveId(null);
                            }}
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key={`three-${current.key}`}
                          className="absolute inset-0"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.28 }}
                        >
                          <Canvas key={current.url} camera={{ position: current.view.cameraPos, fov: 45 }} dpr={[1, 1.8]}>
                            <color attach="background" args={["#071f29"]} />
                            <ambientLight intensity={0.75} />
                            <directionalLight position={[6, 8, 6]} intensity={1.25} />
                            <directionalLight position={[-6, -2, -6]} intensity={0.4} />

                            <Suspense fallback={null}>
                              <Bounds fit clip observe margin={current.view.boundsMargin}>
                                <ModelScene
                                  url={current.url}
                                  hotspots={current.hotspots}
                                  activeId={activeId}
                                  setActiveId={setActiveId}
                                  debug={debug}
                                  setLastCoords={setLastCoords}
                                  modelScale={current.view.modelScale}
                                  modelRotation={current.view.modelRotation}
                                  modelPosition={current.view.modelPosition}
                                  pinStyle={current.view.pinStyle}
                                  normalize={current.view.normalize}
                                />
                              </Bounds>
                              <Environment preset="city" />
                            </Suspense>

                            <OrbitControls
                              makeDefault
                              enablePan={false}
                              enableZoom
                              minDistance={current.view.minDistance}
                              maxDistance={current.view.maxDistance}
                              autoRotate={!activeId}
                              autoRotateSpeed={0.9}
                              enableDamping
                              dampingFactor={0.08}
                            />
                          </Canvas>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* module navigation */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(null);
                      setLastCoords(null);
                      setModuleIndex((i) => (i - 1 + modules.length) % modules.length);
                      setShowIntro(true);
                    }}
                    aria-label="Previous module"
                    className="absolute left-7 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full border border-white/15 bg-black/35 backdrop-blur-md hover:bg-white/10 transition flex items-center justify-center shadow-[0_18px_60px_rgba(0,0,0,0.35)]"
                  >
                    <span className="text-white/80 text-lg">←</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(null);
                      setLastCoords(null);
                      setModuleIndex((i) => (i + 1) % modules.length);
                      setShowIntro(true);
                    }}
                    aria-label="Next module"
                    className="absolute right-7 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full border border-white/15 bg-black/35 backdrop-blur-md hover:bg-white/10 transition flex items-center justify-center shadow-[0_18px_60px_rgba(0,0,0,0.35)]"
                  >
                    <span className="text-white/80 text-lg">→</span>
                  </button>

                  <div className="absolute left-9 bottom-8 text-[12px] text-white/45">
                    {showIntro ? "Read the intro slides, then start the 3D" : "Click pins to learn parts"}
                  </div>
                </div>
              </div>

              <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.45)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* preload known models (excluding pc.glb) */
useGLTF.preload("/models/cpu.glb");
useGLTF.preload("/models/motherboard.glb");
useGLTF.preload("/models/ram.glb");
useGLTF.preload("/models/hdd.glb");
useGLTF.preload("/models/psu.glb");
useGLTF.preload("/models/case.glb");
