import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Environment, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import Settings from "../../Components/Settings";
import * as THREE from "three";
import { auth, db } from "../../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useThree, useFrame } from "@react-three/fiber";
import {
  module1ScenesBase,
  module1ScenesAMD,
  module1ScenesIntel,
} from "./module1-scenes";

const THEME = {
  bg: "#0a0e17",
  surface: "#0d1220",
  surface2: "#111d33",
  text: "#e8ecf4",
  muted: "#7a8ba8",
  accent: "#00ffb4",
  accentSoft: "rgba(0,255,180,0.12)",
  border: "#1a2438",
};

function IntroDeck({ slides, onDone }) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [slides]);

  const safeSlides =
    slides?.length > 0
      ? slides
      : [
          {
            id: "fallback-intro",
            title: "Component Overview",
            body: "Explore this component in the 3D hardware lab.",
            points: ["Rotate the model.", "Zoom in for details.", "Select hotspots when available."],
          },
        ];
  const slide = safeSlides[Math.min(index, safeSlides.length - 1)];
  const isLast = index === safeSlides.length - 1;

  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(0,255,180,0.08),rgba(0,0,0,0.58)_58%,rgba(0,0,0,0.75))]" />

      <div className="relative flex h-full w-full items-end justify-center p-4 pb-8 sm:items-center sm:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: 0.22 }}
            className="pointer-events-auto w-[760px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[18px] border border-[#00ffb4]/30 bg-[#06131b]/72 shadow-[0_0_45px_rgba(0,255,180,0.16),0_32px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-[#00ffb4]/20 bg-[#00ffb4]/5 px-5 py-4 sm:px-7">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#00ffb4]">
                  Hologram Briefing
                </div>
                <div className="truncate text-[20px] font-extrabold text-[#e8ecf4] sm:text-[26px]">
                  {slide.title}
                </div>
              </div>

              <div className="rounded-full border border-[#00ffb4]/20 bg-[#00ffb4]/10 px-3 py-1 text-[12px] font-bold text-[#baffee]">
                {Math.min(index + 1, safeSlides.length)}/{safeSlides.length}
              </div>
            </div>

            <div className="px-5 py-5 sm:px-7 sm:py-6">
              <div className="whitespace-pre-line text-[15px] leading-7 text-[#dbe6f5] sm:text-[17px]">
                {slide.body}
              </div>

              {slide.points?.length ? (
                <ul className="mt-6 space-y-3 text-[#c8d4e6]">
                  {slide.points.map((p, i) => (
                    <li key={i} className="flex gap-3 text-[17px] leading-relaxed">
                      <span className="mt-[10px] h-2 w-2 flex-none rounded-full bg-[#00ffb4]/70" />
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
                  className="h-12 rounded-2xl border border-[#1a2438] bg-white/[0.03] px-6 text-[16px] font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06] disabled:opacity-40"
                >
                  ← Back
                </button>

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={onDone}
                    className="h-12 rounded-2xl border border-[#1a2438] bg-white/[0.03] px-6 text-[16px] font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06]"
                    title="Skip introduction"
                  >
                    Skip
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isLast) onDone();
                      else setIndex((i) => Math.min(i + 1, safeSlides.length - 1));
                    }}
                    className="h-12 rounded-2xl bg-[#00ffb4] px-7 text-[16px] font-semibold text-[#0a0e17] transition hover:scale-[1.02]"
                  >
                    {isLast ? "Start 3D →" : "Next →"}
                  </button>
                </div>
              </div>

              <div className="mt-6 text-[14px] text-[#7a8ba8]">
                Tip: press <b>D</b> then click the model to log exact hotspot coordinates.
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function HotspotPin({
  number,
  position,
  active,
  onClick,
  pin = { buttonPx: 36, glowRadius: 0.05, distanceFactor: 10 },
  uiOffset,
  frontAxis,
}) {
  const btn = pin.buttonPx ?? 36;
  const numberPx = pin.numberPx ?? Math.max(6, Math.round(btn * 0.35));
  const glow = pin.glowRadius ?? 0.05;
  const dist = pin.distanceFactor ?? 10;
  const offX = uiOffset?.[0] ?? 0;
  const offY = uiOffset?.[1] ?? 0;

  const { camera } = useThree();
  const groupRef = useRef();
  const [pinOpacity, setPinOpacity] = useState(1);

  useFrame(() => {
    if (!groupRef.current) return;

    const worldPos = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPos);

    if (!frontAxis) {
      setPinOpacity(1);
      return;
    }

    const normal = new THREE.Vector3(...frontAxis)
      .normalize()
      .transformDirection(groupRef.current.matrixWorld);

    const toCamera = camera.position.clone().sub(worldPos).normalize();
    const facing = normal.dot(toCamera);
    const nextOpacity = facing > 0.15 ? 1 : facing > -0.15 ? 0.18 : 0;

    setPinOpacity(nextOpacity);
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh visible={pinOpacity > 0.02}>
        <sphereGeometry args={[glow, 24, 24]} />
        <meshBasicMaterial
          color={active ? "#00ffb4" : "white"}
          transparent
          opacity={active ? 0.22 * pinOpacity : 0.08 * pinOpacity}
        />
      </mesh>

      <Html center distanceFactor={dist} occlude={false}>
        <motion.button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
          className={[
            "relative flex items-center justify-center rounded-full border backdrop-blur-md shadow-[0_16px_45px_rgba(0,0,0,0.55)] transition select-none",
            active
              ? "border-[#00ffb4]/30 bg-[#00ffb4]/95 text-[#0a0e17]"
              : "border-white/20 bg-white/75 text-black hover:bg-white/90",
          ].join(" ")}
          style={{
            width: btn,
            height: btn,
            opacity: pinOpacity,
            pointerEvents: pinOpacity < 0.05 ? "none" : "auto",
            transform: `translate(-50%, -50%) translate(${offX}px, ${offY}px)`,
          }}
          aria-label={`Hotspot ${number}`}
        >
          <span className="absolute inset-[3px] rounded-full border border-black/10" />
          <span
            style={{ fontSize: numberPx }}
            className="font-extrabold"
          >
            {number}
          </span>
        </motion.button>
      </Html>
    </group>
  );
}

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
  normalize,
}) {
  const { scene } = useGLTF(url);
  const groupRef = useRef();

  const normalized = useMemo(() => {
    if (!normalize?.enabled) {
      return { scale: 1, offset: new THREE.Vector3(0, 0, 0) };
    }

    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    let hasMesh = false;
    scene.updateMatrixWorld(true);

    scene.traverse((obj) => {
      if (!obj.isMesh) return;
      hasMesh = true;
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
    const target = normalize.targetSize ?? 1.6;
    const s = target / biggest;
    const offset = center.multiplyScalar(-1);

    return { scale: s, offset };
  }, [scene, normalize?.enabled, normalize?.targetSize]);

  const onPointerDown = (e) => {
    if (!debug) return;
    e.stopPropagation();
    const local = e.point.clone();
    if (groupRef.current) groupRef.current.worldToLocal(local);
    const coords = [
      Number(local.x.toFixed(3)),
      Number(local.y.toFixed(3)),
      Number(local.z.toFixed(3)),
    ];
    setLastCoords(coords);
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
      <group position={normalized.offset.toArray()} scale={normalized.scale}>
        <primitive object={scene} />
      </group>

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

function HotspotHologram({ hotspot, onClose }) {
  const position = useMemo(() => {
    const base = hotspot.position || [0, 0, 0];
    const side = base[0] >= 0 ? -0.85 : 0.85;
    return [base[0] + side, base[1] + 0.42, base[2] + 0.2];
  }, [hotspot]);

  return (
    <Html position={position} center distanceFactor={8} occlude={false}>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.96 }}
        className="w-[300px] max-w-[72vw] overflow-hidden rounded-[14px] border border-[#00ffb4]/35 bg-[#06131b]/78 text-left shadow-[0_0_35px_rgba(0,255,180,0.20),0_20px_70px_rgba(0,0,0,0.62)] backdrop-blur-xl"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,255,180,0.06)_1px,transparent_1px)] bg-[size:100%_16px]" />
        <div className="relative flex items-start justify-between gap-3 border-b border-[#00ffb4]/20 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#00ffb4]">
              Hotspot {hotspot.number}
            </div>
            <div className="mt-1 text-[14px] font-black leading-5 text-white">
              {hotspot.title}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-[#00ffb4]/20 bg-white/[0.04] text-[12px] text-white/80 transition hover:bg-white/[0.1]"
            aria-label="Close hotspot"
          >
            x
          </button>
        </div>

        <div className="relative px-4 py-3 text-[12px] leading-5 text-[#dbe6f5]">
          {hotspot.en}
        </div>
      </motion.div>
    </Html>
  );
}

function LabEnvironment({ sceneName, activeHotspot, showLabels = true }) {
  const ringRef = useRef();
  const scanRef = useRef();

  useFrame((_, delta) => {
    if (ringRef.current) ringRef.current.rotation.z += delta * 0.22;
    if (scanRef.current) {
      scanRef.current.position.y = 0.14 + Math.sin(Date.now() * 0.0016) * 0.035;
    }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.74, 0]}>
        <circleGeometry args={[2.75, 96]} />
        <meshBasicMaterial color="#00ffb4" transparent opacity={0.045} />
      </mesh>

      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.72, 0]}>
        <ringGeometry args={[1.35, 1.38, 96]} />
        <meshBasicMaterial color="#00ffb4" transparent opacity={0.34} />
      </mesh>

      <gridHelper args={[7, 36, "#00ffb4", "#1d4450"]} position={[0, -0.78, 0]} />

      <mesh ref={scanRef} position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.05, 1.08, 96]} />
        <meshBasicMaterial color="#baffee" transparent opacity={0.18} />
      </mesh>

      {showLabels ? (
        <>
          <Html position={[-1.95, 1.12, -0.75]} center distanceFactor={8} occlude={false}>
            <div className="w-[250px] rounded-[14px] border border-[#00ffb4]/25 bg-[#06131b]/68 px-4 py-3 text-left shadow-[0_0_30px_rgba(0,255,180,0.14)] backdrop-blur-xl">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#00ffb4]">
                Articton Lab
              </div>
              <div className="mt-1 text-[18px] font-black text-white">
                {activeHotspot?.title || sceneName}
              </div>
              <div className="mt-2 text-[11px] leading-5 text-[#9fb0ca]">
                {activeHotspot?.en ||
                  "Select a glowing marker to inspect component details inside the 3D workspace."}
              </div>
            </div>
          </Html>
        </>
      ) : null}
    </group>
  );
}

function ModuleIntroExperience({
  step,
  tutorialPage,
  selectedPlatform,
  onStart,
  onOpenTutorial,
  onTutorialPrev,
  onTutorialNext,
  onSelectPlatform,
}) {
  if (step === "components") return null;

  return (
    <group>
      {step === "welcome" ? (
        <WelcomeHologram onStart={onStart} onOpenTutorial={onOpenTutorial} />
      ) : null}

      {step === "tutorial" ? (
        <NavigationTutorialHologram
          page={tutorialPage}
          onPrev={onTutorialPrev}
          onNext={onTutorialNext}
        />
      ) : null}

      {step === "platform" ? (
        <PlatformChoiceHologram
          selectedPlatform={selectedPlatform}
          onSelectPlatform={onSelectPlatform}
        />
      ) : null}
    </group>
  );
}

function IntroStageVisual({ step }) {
  const leftRef = useRef();
  const rightRef = useRef();
  const chipRef = useRef();

  useFrame((_, delta) => {
    if (leftRef.current) leftRef.current.rotation.y += delta * 0.35;
    if (rightRef.current) rightRef.current.rotation.y -= delta * 0.32;
    if (chipRef.current) {
      chipRef.current.rotation.y += delta * 0.25;
      chipRef.current.position.y = -0.06 + Math.sin(Date.now() * 0.0014) * 0.045;
    }
  });

  return (
    <group position={[0, -0.3, 0]}>
      <mesh ref={chipRef} position={[0, -0.06, 0]} rotation={[0.18, 0.35, 0]}>
        <boxGeometry args={[1.25, 0.16, 1.25]} />
        <meshStandardMaterial color="#14212b" metalness={0.7} roughness={0.25} />
      </mesh>

      <mesh position={[0, 0.055, 0]} rotation={[0.18, 0.35, 0]}>
        <boxGeometry args={[0.82, 0.18, 0.82]} />
        <meshStandardMaterial color="#9fb0ca" metalness={0.85} roughness={0.18} />
      </mesh>

      {step === "platform" ? (
        <>
          <group ref={leftRef} position={[-1.45, 0.12, -0.2]}>
            <mesh>
              <boxGeometry args={[0.72, 0.12, 0.72]} />
              <meshStandardMaterial color="#182330" metalness={0.7} roughness={0.25} />
            </mesh>
          </group>

          <group ref={rightRef} position={[1.45, 0.12, -0.2]}>
            <mesh>
              <boxGeometry args={[0.72, 0.12, 0.72]} />
              <meshStandardMaterial color="#1b2838" metalness={0.7} roughness={0.25} />
            </mesh>
          </group>
        </>
      ) : null}
    </group>
  );
}

function WelcomeHologram({ onStart, onOpenTutorial }) {
  return (
    <Html position={[0, 0.65, 0.15]} center distanceFactor={3} occlude={false}>
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="w-[min(720px,82vw)] rounded-[18px] border border-[#00ffb4]/35 bg-[#06131b]/72 px-6 py-6 text-center shadow-[0_0_55px_rgba(0,255,180,0.18),0_32px_110px_rgba(0,0,0,0.62)] backdrop-blur-xl"
      >
        <div className="text-[11px] font-black uppercase tracking-[0.32em] text-[#00ffb4]">
          Welcome to Articton
        </div>
        <div className="mt-3 text-[34px] font-black leading-none text-white sm:text-[54px]">
          WELCOME TO ARTICTON
        </div>
        <div className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-[#dbe6f5]">
          A 3D interactive hardware learning experience
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onStart}
            className="h-12 rounded-full bg-[#00ffb4] px-6 text-[14px] font-black text-[#06131b] shadow-[0_0_30px_rgba(0,255,180,0.28)] transition hover:scale-[1.03]"
          >
            Start Exploration
          </button>
          <button
            type="button"
            onClick={onOpenTutorial}
            className="h-12 rounded-full border border-[#00ffb4]/25 bg-white/[0.04] px-6 text-[14px] font-bold text-[#dbe6f5] transition hover:bg-white/[0.09]"
          >
            How to Navigate
          </button>
        </div>
      </motion.div>
    </Html>
  );
}

function NavigationTutorialHologram({ page, onPrev, onNext }) {
  const isZoom = page === 1;
  const isDragSnap = page === 2;

  return (
    <Html position={[0, 0.62, 0.12]} center distanceFactor={3} occlude={false}>
      <motion.div
        key={page}
        initial={{ opacity: 0, y: 14, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        className="relative w-[min(640px,82vw)] overflow-hidden rounded-[18px] border border-[#00ffb4]/32 bg-[#06131b]/74 px-6 py-5 shadow-[0_0_48px_rgba(0,255,180,0.17),0_30px_100px_rgba(0,0,0,0.60)] backdrop-blur-xl"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,255,180,0.055)_1px,transparent_1px)] bg-[size:100%_18px]" />
        <div className="relative">
          <div className="text-[11px] font-black uppercase tracking-[0.26em] text-[#00ffb4]">
            Navigation Tutorial
          </div>
         <div className="mt-2 text-[28px] font-black text-white">
          {isDragSnap
            ? "Drag & Snap Guide"
            : isZoom
            ? "Zoom Tutorial"
            : "Rotate Tutorial"}
        </div>

          <div className="relative my-6 h-36 rounded-[16px] border border-[#00ffb4]/20 bg-black/22">
            <motion.div
              className="absolute left-1/2 top-1/2 h-20 w-32 -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[#00ffb4]/30 bg-[#00ffb4]/10 shadow-[0_0_40px_rgba(0,255,180,0.18)]"
              animate={
                isDragSnap
                  ? { x: [-40, 40, -40] }
                  : isZoom
                  ? { scale: [0.86, 1.18, 0.92] }
                  : { rotate: [-12, 12, -10] }
              }
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />

            <motion.div
              className="absolute left-1/2 top-1/2 h-9 w-9 rounded-full border border-white/30 bg-white/90 shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
             animate={
                isDragSnap
                  ? {
                      x: [-70, 70, 0],
                      y: [0, -20, 0],
                    }
                  : isZoom
                  ? {
                      x: [-10, -10, -10],
                      y: [22, -24, 22],
                      scale: [1, 0.72, 1],
                    }
                  : {
                      x: [-90, 90, -80],
                      y: [10, -12, 8],
                    }
              }
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="absolute left-3 top-3 h-3 w-3 rounded-full bg-[#06131b]" />
            </motion.div>
          </div>

          <div className="text-[16px] leading-7 text-[#dbe6f5]">
          {isDragSnap
            ? "Drag the 3D object smoothly. Release to snap the view into the closest inspection angle."
            : isZoom
            ? "Scroll or pinch to move closer and inspect hardware details."
            : "Drag to explore the hardware from different angles."}
        </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onPrev}
              disabled={page === 0}
              className="h-11 rounded-full border border-[#00ffb4]/20 bg-white/[0.04] px-5 text-[13px] font-bold text-[#dbe6f5] transition hover:bg-white/[0.09] disabled:opacity-40"
            >
              Back
            </button>

           <div className="text-[11px] font-bold text-[#7a8ba8]">
            {page + 1}/3
          </div>

            <button
              type="button"
              onClick={onNext}
              className="h-11 rounded-full bg-[#00ffb4] px-6 text-[13px] font-black text-[#06131b] shadow-[0_0_28px_rgba(0,255,180,0.22)] transition hover:scale-[1.03]"
            >
             {isDragSnap
            ? "Choose Platform"
            : isZoom
            ? "Next"
            : "Next"}
            </button>
          </div>
        </div>
      </motion.div>
    </Html>
  );
}

function PlatformChoiceHologram({ selectedPlatform, onSelectPlatform }) {
  return (
    <Html position={[0, 0.6, 0.15]} center distanceFactor={3} occlude={false}>
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-[min(760px,86vw)] rounded-[18px] border border-[#00ffb4]/35 bg-[#06131b]/74 px-6 py-6 text-center shadow-[0_0_55px_rgba(0,255,180,0.18),0_32px_110px_rgba(0,0,0,0.62)] backdrop-blur-xl"
      >
        <div className="text-[11px] font-black uppercase tracking-[0.26em] text-[#00ffb4]">
          Processor Platform
        </div>
        <div className="mt-2 text-[30px] font-black leading-tight text-white">
          Every PC starts with a decision
        </div>
        <div className="mx-auto mt-3 max-w-xl text-[14px] leading-6 text-[#dbe6f5]">
          What processor platform will power your system?
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {[
            {
              id: "amd",
              name: "AMD",
              detail: "AM4 and AM5 platforms with socket, motherboard, and memory compatibility paths.",
            },
            {
              id: "intel",
              name: "Intel",
              detail: "Intel Core platforms with matching sockets, chipsets, and supported memory generations.",
            },
          ].map((platform) => {
            const active = selectedPlatform === platform.id;

            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => onSelectPlatform(platform.id)}
                className={[
                  "rounded-[16px] border px-5 py-5 text-left transition hover:scale-[1.02]",
                  active
                    ? "border-[#00ffb4]/55 bg-[#00ffb4]/16 shadow-[0_0_34px_rgba(0,255,180,0.18)]"
                    : "border-white/12 bg-white/[0.04] hover:bg-white/[0.08]",
                ].join(" ")}
              >
                <div className="text-[28px] font-black text-white">{platform.name}</div>
                <div className="mt-3 text-[12px] leading-5 text-[#b7c6dd]">{platform.detail}</div>
                <div className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-[#00ffb4]">
                  Select {platform.name}
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>
    </Html>
  );
}

function HotspotInfoCard({ hotspot, onClose }) {
  return (
    <AnimatePresence>
      {hotspot ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.18 }}
          className="absolute bottom-8 right-8 z-40"
        >
          <div className="w-[380px] max-w-[calc(100vw-64px)] overflow-hidden rounded-2xl border border-[#1a2438] bg-[#0d1220]/90 shadow-[0_22px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#1a2438] bg-white/[0.03] px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-extrabold text-white">
                  {hotspot.title}
                </div>
                <div className="text-[11px] text-[#7a8ba8]">
                  Hotspot {hotspot.number}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1a2438] bg-white/[0.03] text-white/70 transition hover:bg-white/[0.06]"
                aria-label="Close hotspot"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              <div className="text-[12px] leading-relaxed text-white/85">
                {hotspot.en}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function HeaderDropdown({ userName, onBack, onLogout, setIsSettingsOpen }) {
  const handleBack = () => {
    if (typeof onBack === "function") onBack("Modules");
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={handleBack}
        className="rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-2.5 text-[13px] font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06]"
      >
        Go back to Dashboard
      </button>

      <details className="group relative z-50">
        <summary className="list-none cursor-pointer rounded-2xl border border-[#1a2438] bg-[#0d1220]/95 px-4 py-2.5 transition hover:bg-[#111b2f]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 text-sm font-bold text-[#00ffb4]">
              {(userName || "U").charAt(0).toUpperCase()}
            </div>

            <div className="leading-tight text-left">
              <div className="text-sm font-semibold text-white">{userName}</div>
              <div className="text-[11px] text-[#7a8ba8]">Student</div>
            </div>

            <div className="text-sm text-[#7a8ba8] transition group-open:rotate-180">
              ▾
            </div>
          </div>
        </summary>

        <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-[#1a2438] bg-[#0d1220]/98 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full rounded-xl px-4 py-2 text-left text-sm text-[#dbe6f5] transition hover:bg-white/5"
          >
            Settings
          </button>

          <button
            onClick={() => {
              if (typeof onBack === "function") onBack("Profile");
            }}
            className="w-full rounded-xl px-4 py-2 text-left text-sm text-[#dbe6f5] transition hover:bg-white/5"
          >
            Profile
          </button>

          <button
            onClick={onLogout}
            className="w-full rounded-xl px-4 py-2 text-left text-sm text-red-400 transition hover:bg-red-500/10"
          >
            Logout
          </button>
        </div>
      </details>
    </div>
  );
}

export default function Module1Page({ onBack, onLogout }) {
  const [moduleIndex, setModuleIndex] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const [showIntro, setShowIntro] = useState(true);
  const [debug, setDebug] = useState(false);
  const [lastCoords, setLastCoords] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [certificateWarning, setCertificateWarning] = useState("");
  const [experienceStep, setExperienceStep] = useState("welcome");
  const [tutorialPage, setTutorialPage] = useState(0);
  const [selectedPlatform, setSelectedPlatform] = useState(() => {
    return localStorage.getItem("module1SelectedPlatform") || "";
  });
  const [afkAutoRotate, setAfkAutoRotate] = useState(false);
  const afkTimerRef = useRef(null);
  const controlsRef = useRef();

  const [settings, setSettings] = useState({
    sound: true,
    animations: true,
    darkMode: true,
  });

  const handleSettingChange = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const [localCompletedParts, setLocalCompletedParts] = useState(() => {
    try {
      const saved = localStorage.getItem("module1CompletedParts");
      return saved ? JSON.parse(saved) : {};
    } catch {
      localStorage.removeItem("module1CompletedParts");
      return {};
    }
  });

  useEffect(() => {
    const saved = profile?.moduleProgress?.module1?.completedParts;

    if (!saved) return;

    const firebaseParts = Object.fromEntries(
      Object.entries(saved).map(([key, value]) => [key, !!value])
    );

    setLocalCompletedParts(firebaseParts);
    localStorage.setItem("module1CompletedParts", JSON.stringify(firebaseParts));
  }, [profile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setFirebaseUser(null);
        setProfile(null);
        return;
      }

      setFirebaseUser(user);

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setProfile(userSnap.data());
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Error reading profile:", err);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key?.toLowerCase() === "d") setDebug((v) => !v);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (afkTimerRef.current) {
      window.clearTimeout(afkTimerRef.current);
      afkTimerRef.current = null;
    }

    if (experienceStep !== "components" || showIntro) {
      setAfkAutoRotate(false);
      return undefined;
    }

    setAfkAutoRotate(false);
    afkTimerRef.current = window.setTimeout(() => {
      setActiveId(null);
      setAfkAutoRotate(true);
    }, 15000);

    return () => {
      if (afkTimerRef.current) {
        window.clearTimeout(afkTimerRef.current);
        afkTimerRef.current = null;
      }
    };
  }, [experienceStep, showIntro, moduleIndex, activeId]);

  const modules = useMemo(() => {
    if (selectedPlatform === "amd") return module1ScenesAMD;
    if (selectedPlatform === "intel") return module1ScenesIntel;
    return module1ScenesBase;
  }, [selectedPlatform]);

  const safeModuleIndex = Math.min(Math.max(moduleIndex, 0), Math.max(modules.length - 1, 0));
  const current = useMemo(
    () => modules[safeModuleIndex] || module1ScenesBase[0],
    [modules, safeModuleIndex]
  );
  const isComponentStage = experienceStep === "components";
  const sceneCamera = isComponentStage
    ? { position: current?.view?.cameraPos || [0, 1.2, 3.2], fov: 45 }
    : { position: [0, 1.05, 3.8], fov: 42 };

  const completedParts = localCompletedParts;

  const moduleFinished = useMemo(() => {
    return modules.every((m) => completedParts[m.key]);
  }, [modules, completedParts]);

  useEffect(() => {
    if (moduleIndex >= 0 && moduleIndex < modules.length) return;

    setModuleIndex(safeModuleIndex);
    setActiveId(null);
    setLastCoords(null);
    setShowIntro(true);
  }, [moduleIndex, modules.length, safeModuleIndex]);

  useEffect(() => {
    if (!current) return;

    const isFinished = completedParts[current.key];
    setShowIntro(!isFinished);
  }, [current, completedParts]);

  useEffect(() => {
    modules.forEach((m) => useGLTF.preload(m.url));
  }, [modules]);

  const activeHotspot = useMemo(() => {
    return (current?.hotspots || []).find((hotspot) => hotspot.id === activeId) || null;
  }, [current?.hotspots, activeId]);

  const user = useMemo(
    () => ({
      name: profile
        ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
        : "Loading...",
      email: firebaseUser?.email || "No email",
    }),
    [profile, firebaseUser]
  );

  const getModule1PlatformProgress = (platform) => {
    return (
      profile?.moduleProgress?.module1?.platformProgress?.[platform] ||
      null
    );
  };

  const getModule1CompletedParts = (platform) => {
    const platformProgress = getModule1PlatformProgress(platform);
    const parts =
      platformProgress?.completedParts ||
      profile?.moduleProgress?.module1?.completedParts ||
      {};

    return Object.fromEntries(
      Object.entries(parts).map(([key, value]) => [key, !!value])
    );
  };

  const saveModule1Progress = async ({
    page = safeModuleIndex + 1,
    introDone = !showIntro,
    moduleKey = current?.key,
    completedParts: partsPatch = {},
    replaceCompletedParts = false,
    platform = selectedPlatform,
  } = {}) => {
    if (!firebaseUser) return;

    const totalPages = modules.length;

    const mergedParts = replaceCompletedParts
      ? partsPatch
      : {
          ...localCompletedParts,
          ...partsPatch,
        };

    const completedCount = modules.filter((m) => mergedParts[m.key]).length;
    const allCompleted = completedCount === totalPages;

    const completed = allCompleted;
    const percent = Math.round((completedCount / totalPages) * 100);

    setLocalCompletedParts(mergedParts);
    localStorage.setItem("module1CompletedParts", JSON.stringify(mergedParts));

    const currentPlatform = platform || selectedPlatform;
    const otherPlatform = currentPlatform === "amd" ? "intel" : "amd";
    const otherPlatformProgress =
      profile?.moduleProgress?.module1?.platformProgress?.[otherPlatform] || {};
    const otherPercent = otherPlatformProgress.percent ?? 0;
    const overallPercent = Math.round((percent + otherPercent) / 2);
    const overallCompleted = completed && otherPlatformProgress.completed === true;

    try {
      const userRef = doc(db, "users", firebaseUser.uid);

      await setDoc(
        userRef,
        {
          moduleProgress: {
            module1: {
              currentPage: page,
              totalPages,
              introDone,
              completed,
              percent,
              selectedPlatform: currentPlatform || null,
              lastVisitedModuleKey: moduleKey,
              completedParts: mergedParts,
              overallPercent,
              overallCompleted,
              platformProgress: {
                [currentPlatform]: {
                  currentPage: page,
                  totalPages,
                  introDone,
                  completed,
                  percent,
                  lastVisitedModuleKey: moduleKey,
                  completedParts: mergedParts,
                  updatedAt: serverTimestamp(),
                },
              },
              updatedAt: serverTimestamp(),
            },
          },
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Error saving module 1 progress:", err);
    }
  };

  const goNextModule = async () => {
    const nextIndex = (safeModuleIndex + 1) % modules.length;
    const nextPage = nextIndex + 1;

    setCertificateWarning("");
    setActiveId(null);
    setLastCoords(null);
    setModuleIndex(nextIndex);
    setShowIntro(true);

    await saveModule1Progress({
      page: nextPage,
      introDone: false,
      moduleKey: modules[nextIndex].key,
    });
  };

  const goPrevModule = async () => {
    const prevIndex = (safeModuleIndex - 1 + modules.length) % modules.length;
    const prevPage = prevIndex + 1;

    setCertificateWarning("");
    setActiveId(null);
    setLastCoords(null);
    setModuleIndex(prevIndex);
    setShowIntro(true);

    await saveModule1Progress({
      page: prevPage,
      introDone: false,
      moduleKey: modules[prevIndex].key,
    });
  };

  const handleViewCertificate = async () => {
    const missingModules = modules.filter((m) => !completedParts[m.key]);

    if (missingModules.length > 0) {
      setCertificateWarning(
        `Complete all scenes first. Missing: ${missingModules
          .map((m) => m.name)
          .join(", ")}.`
      );

      return;
    }

    setCertificateWarning("");

    await saveModule1Progress({
      page: modules.length,
      introDone: true,
      moduleKey: "case",
      completedParts,
    });

    setShowCertificate(true);
  };

  const handleSwitchPlatform = async () => {
    const nextPlatform = selectedPlatform === "amd" ? "intel" : "amd";
    const nextPlatformParts = getModule1CompletedParts(nextPlatform);
    const nextPlatformProgress = getModule1PlatformProgress(nextPlatform);

    setSelectedPlatform(nextPlatform);
    setLocalCompletedParts(nextPlatformParts);
    localStorage.setItem("module1SelectedPlatform", nextPlatform);
    localStorage.setItem("module1CompletedParts", JSON.stringify(nextPlatformParts));
    setCertificateWarning("");
    setShowCertificate(false);
    setExperienceStep("components");
    setActiveId(null);
    setLastCoords(null);
    setModuleIndex(
      typeof nextPlatformProgress?.currentPage === "number"
        ? Math.max(0, Math.min(nextPlatformProgress.currentPage - 1, modules.length - 1))
        : safeModuleIndex
    );
    setShowIntro(!nextPlatformParts[current?.key]);

    await saveModule1Progress({
      page: safeModuleIndex + 1,
      introDone: !nextPlatformParts[current?.key],
      moduleKey: current?.key,
      completedParts: nextPlatformParts,
      replaceCompletedParts: true,
      platform: nextPlatform,
    });
  };

  const handleBackToDashboard = async () => {
    await saveModule1Progress({
      page: modules.length,
      introDone: true,
      moduleKey: "case",
      completedParts,
    });

    if (typeof onBack === "function") {
      onBack("Modules");
    }
  };

  useEffect(() => {
    if (!profile?.moduleProgress?.module1) return;

    const saved = profile.moduleProgress.module1;
    const selected =
      typeof saved.selectedPlatform === "string" && saved.selectedPlatform
        ? saved.selectedPlatform
        : localStorage.getItem("module1SelectedPlatform") || "amd";

    setSelectedPlatform(selected);
    localStorage.setItem("module1SelectedPlatform", selected);
    localStorage.setItem("module1OnboardingDone", "true");
    setExperienceStep("welcome");
    setShowIntro(true);

    const platformProgress = getModule1PlatformProgress(selected);
    const platformParts = getModule1CompletedParts(selected);
    setLocalCompletedParts(platformParts);
    localStorage.setItem("module1CompletedParts", JSON.stringify(platformParts));

    if (
      typeof platformProgress?.currentPage === "number" &&
      platformProgress.currentPage >= 1 &&
      platformProgress.currentPage <= modules.length
    ) {
      setModuleIndex(platformProgress.currentPage - 1);
    } else if (
      typeof saved.currentPage === "number" &&
      saved.currentPage >= 1 &&
      saved.currentPage <= modules.length
    ) {
      setModuleIndex(saved.currentPage - 1);
    }
  }, [profile, modules.length]);

  const handleStartExploration = () => {
    setTutorialPage(0);
    setExperienceStep("platform");
  };

  const handleOpenTutorial = () => {
    setTutorialPage(0);
    setExperienceStep("tutorial");
  };

  const handleTutorialPrev = () => {
    setTutorialPage((page) => Math.max(0, page - 1));
  };

  const handleTutorialNext = () => {
  if (tutorialPage < 2) {
    setTutorialPage((page) => page + 1);
    return;
  }

  setExperienceStep("platform");
};

  const handleSelectPlatform = async (platform) => {
    const platformParts = getModule1CompletedParts(platform);

    setSelectedPlatform(platform);
    setLocalCompletedParts(platformParts);
    localStorage.setItem("module1SelectedPlatform", platform);
    localStorage.setItem("module1OnboardingDone", "true");
    localStorage.setItem("module1CompletedParts", JSON.stringify(platformParts));
    setExperienceStep("components");
    setShowIntro(true);
    setActiveId(null);
    setCertificateWarning("");

    await saveModule1Progress({
      page: safeModuleIndex + 1,
      introDone: false,
      moduleKey: current.key,
      completedParts: platformParts,
      replaceCompletedParts: true,
      platform,
    });
  };

  const handleReturnToWelcome = () => {
    setExperienceStep("welcome");
    setTutorialPage(0);
    setActiveId(null);
    setCertificateWarning("");
    setAfkAutoRotate(false);
  };

  const handleSceneInteraction = () => {
    if (experienceStep !== "components") return;

    setActiveId(null);
    setAfkAutoRotate(false);

    if (afkTimerRef.current) {
      window.clearTimeout(afkTimerRef.current);
    }

    afkTimerRef.current = window.setTimeout(() => {
      setActiveId(null);
      setAfkAutoRotate(true);
    }, 15000);
  };

  const handleSelectModule = async (index) => {
    const key = modules[index].key;
    const isFinished = completedParts[key];

    setCertificateWarning("");
    setActiveId(null);
    setLastCoords(null);
    setModuleIndex(index);
    setShowIntro(!isFinished);

    await saveModule1Progress({
      page: index + 1,
      introDone: isFinished,
      moduleKey: key,
    });
  };

  if (showCertificate) {
    return (
      <div className="min-h-screen w-full overflow-hidden bg-[#0a0e17] font-sans text-[#e8ecf4] antialiased">
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6">
          <ModulePageBackground />

          <div className="relative z-10 w-full max-w-3xl rounded-[34px] border border-[#00ffb4]/35 bg-[#0d1220]/90 p-8 text-center shadow-[0_40px_120px_rgba(0,0,0,0.65)] backdrop-blur-xl md:p-12">
            <div className="pointer-events-none absolute inset-4 rounded-[26px] border border-dashed border-[#00ffb4]/30" />

            <div className="relative">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#00ffb4]/40 bg-[#00ffb4]/10 text-4xl font-black text-[#00ffb4] shadow-[0_0_40px_rgba(0,255,180,0.18)]">
                ✓
              </div>

              <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.32em] text-[#00ffb4]">
                Certificate of Completion
              </div>

              <h1 className="mb-4 text-4xl font-black tracking-tight text-white md:text-6xl">
                Congratulations
              </h1>

              <h2 className="mb-6 text-xl font-bold text-[#dbe6f5] md:text-3xl">
                You Have Completed Module 1
              </h2>

              <p className="mx-auto mb-8 max-w-xl text-sm leading-7 text-[#9fb0ca]">
                You successfully completed the hardware identification module,
                including CPU, motherboard, RAM, HDD, PSU, and PC case learning.
              </p>

              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={handleBackToDashboard}
                  className="rounded-2xl bg-[#00ffb4] px-7 py-3 text-sm font-black text-[#0a0e17] shadow-[0_18px_50px_rgba(0,255,180,0.22)] transition hover:scale-[1.03]"
                >
                  Back to Dashboard →
                </button>

                <button
                  type="button"
                  onClick={handleSwitchPlatform}
                  className="rounded-2xl border border-[#00ffb4]/40 bg-[#0d1220] px-7 py-3 text-sm font-bold text-[#dbe6f5] shadow-[0_12px_32px_rgba(0,255,180,0.12)] transition hover:bg-white/5"
                >
                  Switch to {selectedPlatform === "amd" ? "Intel" : "AMD"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-hidden bg-[#0a0e17] font-sans text-[#e8ecf4] antialiased">
      <div className="relative h-screen w-full overflow-hidden">
        <ModulePageBackground />

        <div className="relative h-full w-full overflow-hidden p-0 md:p-3">
          <div className="relative h-full w-full overflow-hidden border border-[#1a2438] bg-[linear-gradient(135deg,#0a0e17,#0d1220,#101a2d)] shadow-[0_70px_180px_rgba(0,0,0,0.70)] md:rounded-[30px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(0,255,180,0.08),transparent_35%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_20%,rgba(0,255,180,0.05),transparent_30%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,180,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,180,0.025)_1px,transparent_1px)] bg-[size:54px_54px] opacity-55" />
            <div className="absolute inset-0 bg-black/10 ring-1 ring-white/5" />

            <div className="relative flex h-full w-full flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-6 text-[12px] text-[#7a8ba8] md:px-10">
                <div>
                  Module 1 (Page {safeModuleIndex + 1}) —{" "}
                  <span className="text-[#dbe6f5]">{current.name}</span>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  {debug ? (
                    <span className="rounded-lg border border-[#1a2438] bg-white/[0.03] px-2 py-1">
                      Debug ON — click model to log coords (press D)
                    </span>
                  ) : (
                    <span className="rounded-lg border border-[#1a2438] bg-white/[0.03] px-2 py-1">
                      Press D for hotspot debug
                    </span>
                  )}

                  {debug && lastCoords ? (
                    <span className="hidden rounded-lg border border-[#1a2438] bg-white/[0.03] px-2 py-1 sm:inline-flex">
                      Last: [{lastCoords.join(", ")}]
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="relative z-[120] mt-3 px-6 md:px-10">
                <div className="flex w-full items-center justify-between gap-4 rounded-[22px] border border-[#1a2438] bg-[#0b1220]/86 px-6 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.30)] backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <img
                      src="/PNG/Articton.png"
                      alt="Articton Logo"
                      className="ml-4 h-10 w-10 scale-300 object-contain"
                    />

                    <div>
                      <div className="text-base font-bold tracking-wide text-white">
                        Articton
                      </div>

                      <div className="text-[11px] uppercase tracking-[0.24em] text-[#00ffb4]">
                        3D Learning View
                      </div>
                    </div>
                  </div>

                  <HeaderDropdown
                    userName={user.name}
                    onBack={onBack}
                    onLogout={onLogout}
                    setIsSettingsOpen={setIsSettingsOpen}
                  />
                </div>

                <Settings
                  isOpen={isSettingsOpen}
                  onClose={() => setIsSettingsOpen(false)}
                  settings={settings}
                  onChange={handleSettingChange}
                />
              </div>

              <div className="min-h-0 flex-1 px-3 py-3 md:px-6 md:py-5">
                <div className="relative h-full overflow-hidden rounded-[22px] border border-[#00ffb4]/18 bg-[#031018] shadow-[0_30px_100px_rgba(0,0,0,0.52)]">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(0,255,180,0.12),transparent_36%),radial-gradient(circle_at_82%_18%,rgba(95,149,152,0.14),transparent_28%)]" />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,255,180,0.032)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,180,0.032)_1px,transparent_1px)] bg-[size:48px_48px] opacity-75" />
                  <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.68)]" />

                  <motion.div
                    key={`three-${current.key}`}
                    className="absolute inset-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Canvas
                      key={`${isComponentStage ? current.url : "module1-onboarding"}-${experienceStep}`}
                      camera={sceneCamera}
                      dpr={[1, 1.8]}
                    >
                      <color attach="background" args={["#06131b"]} />
                      <ambientLight intensity={0.78} />
                      <directionalLight position={[6, 8, 6]} intensity={1.25} />
                      <directionalLight position={[-6, -2, -6]} intensity={0.45} />
                      <pointLight position={[0, 1.2, 2.2]} intensity={0.75} color="#00ffb4" />

                      <Suspense fallback={null}>
                        <LabEnvironment
                          sceneName={isComponentStage ? current.name : "Processor Platform Lab"}
                          activeHotspot={activeHotspot}
                          showLabels={isComponentStage}
                        />

                        <ModuleIntroExperience
                          step={experienceStep}
                          tutorialPage={tutorialPage}
                          selectedPlatform={selectedPlatform}
                          onStart={handleStartExploration}
                          onOpenTutorial={handleOpenTutorial}
                          onTutorialPrev={handleTutorialPrev}
                          onTutorialNext={handleTutorialNext}
                          onSelectPlatform={handleSelectPlatform}
                        />

                        {isComponentStage ? (
                        <Bounds
                            fit
                            clip
                            margin={current?.view?.boundsMargin ?? 1.15}
                            controls={controlsRef}
                          >
                            <ModelScene
                              url={current.url}
                              hotspots={current.hotspots || []}
                              activeId={activeId}
                              setActiveId={setActiveId}
                              debug={debug}
                              setLastCoords={setLastCoords}
                              modelScale={current?.view?.modelScale}
                              modelRotation={current?.view?.modelRotation}
                              modelPosition={current?.view?.modelPosition}
                              pinStyle={current?.view?.pinStyle}
                              normalize={current?.view?.normalize}
                            />
                          </Bounds>
                        ) : (
                          <IntroStageVisual step={experienceStep} />
                        )}

                        <Environment preset="city" />
                      </Suspense>

                      <OrbitControls
                        ref={controlsRef}
                        makeDefault
                        enablePan={false}
                        enableZoom
                        minDistance={isComponentStage ? current?.view?.minDistance ?? 1.2 : 2.8}
                        maxDistance={isComponentStage ? current?.view?.maxDistance ?? 7 : 5.2}
                        autoRotate={
                          experienceStep === "components" &&
                          !showIntro &&
                          afkAutoRotate
                        }
                        autoRotateSpeed={0.85}
                        enableDamping
                        dampingFactor={0.08}
                        onStart={handleSceneInteraction}
                        onChange={() => {
                          if (activeId && experienceStep === "components") {
                            setActiveId(null);
                          }
                        }}
                      />
                    </Canvas>
                  </motion.div>

                  {isComponentStage && showIntro ? (
                    <IntroDeck
                      slides={current.slides || []}
                      onDone={async () => {
                        setShowIntro(false);
                        setActiveId(null);
                        setCertificateWarning("");

                        await saveModule1Progress({
                          page: safeModuleIndex + 1,
                          introDone: true,
                          moduleKey: current.key,
                          completedParts: {
                            [current.key]: true,
                          },
                        });
                      }}
                    />
                  ) : null}

                  {isComponentStage ? (
                    <>
                      <PartsDock
                        modules={modules}
                        currentKey={current.key}
                        completedParts={completedParts}
                        onSelect={handleSelectModule}
                        onViewCertificate={handleViewCertificate}
                        moduleFinished={moduleFinished}
                        certificateWarning={certificateWarning}
                      />

                      <SceneControls
                        current={current}
                        moduleIndex={safeModuleIndex}
                        totalModules={modules.length}
                        showIntro={showIntro}
                        debug={debug}
                        lastCoords={lastCoords}
                        selectedPlatform={selectedPlatform}
                        afkAutoRotate={afkAutoRotate}
                        completedParts={completedParts}
                        onWelcome={handleReturnToWelcome}
                        onPrev={goPrevModule}
                        onNext={goNextModule}
                      />
                    </>
                  ) : null}
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

function PartsDock({
  modules,
  currentKey,
  completedParts,
  onSelect,
  onViewCertificate,
  moduleFinished,
  certificateWarning,
}) {
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[120] flex flex-col items-center gap-2 md:inset-x-6 md:bottom-5">
      {certificateWarning ? (
        <div className="pointer-events-auto max-w-[min(720px,calc(100vw-48px))] rounded-full border border-red-300/25 bg-red-500/12 px-4 py-2 text-center text-[11px] font-semibold text-red-100 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          {certificateWarning}
        </div>
      ) : null}

      <div className="pointer-events-auto flex max-w-full items-center gap-2 overflow-x-auto rounded-full border border-[#00ffb4]/24 bg-[#06131b]/72 p-2 shadow-[0_0_35px_rgba(0,255,180,0.13),0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        {modules.map((m, index) => {
          const done = !!completedParts[m.key];
          const active = currentKey === m.key;

          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onSelect(index)}
              className={[
                "flex h-11 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-[12px] font-bold transition",
                active
                  ? "border-[#00ffb4]/45 bg-[#00ffb4]/16 text-white shadow-[0_0_22px_rgba(0,255,180,0.13)]"
                  : "border-white/10 bg-white/[0.035] text-[#b7c6dd] hover:bg-white/[0.08]",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
                  done ? "bg-[#00ffb4] text-[#06131b]" : "border border-white/15 text-[#9fb0ca]",
                ].join(" ")}
              >
                {done ? "OK" : index + 1}
              </span>
              <span className="hidden sm:inline">{m.name === "Motherboard" ? "MB" : m.name}</span>
            </button>
          );
        })}

        {moduleFinished ? (
          <button
            type="button"
            onClick={onViewCertificate}
            className="h-11 whitespace-nowrap rounded-full bg-[#00ffb4] px-4 text-[12px] font-black text-[#06131b] shadow-[0_0_28px_rgba(0,255,180,0.22)] transition hover:scale-[1.02]"
          >
            Certificate
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SceneControls({
  current,
  moduleIndex,
  totalModules,
  showIntro,
  debug,
  lastCoords,
  selectedPlatform,
  afkAutoRotate,
  completedParts,
  onWelcome,
  onPrev,
  onNext,
}) {
  return (
    <>
      <div className="pointer-events-none absolute left-4 top-4 z-[110] max-w-[calc(100vw-48px)] rounded-[16px] border border-[#00ffb4]/22 bg-[#06131b]/66 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl md:left-6 md:top-6">
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#00ffb4]">
          Module 1
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <div className="text-[20px] font-black leading-none text-white">{current.name}</div>
          <div className="text-[11px] font-semibold text-[#9fb0ca]">
            Page {moduleIndex + 1} of {totalModules}
          </div>
        </div>
        <div className="mt-2 text-[11px] text-[#8fa3bf]">
          {showIntro
            ? "Hologram briefing active"
            : `${selectedPlatform ? selectedPlatform.toUpperCase() : "PC"} platform / ${
                afkAutoRotate ? "auto-rotate active" : "select glowing pins"
              }`}
        </div>
      </div>

      <div className="absolute right-4 top-4 z-[110] flex items-center gap-2 md:right-6 md:top-6">
        <button
          type="button"
          onClick={onWelcome}
          className="rounded-full border border-[#00ffb4]/22 bg-[#06131b]/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#dbe6f5] shadow-[0_18px_60px_rgba(0,0,0,0.30)] backdrop-blur-xl transition hover:bg-white/[0.08]"
        >
          Welcome
        </button>

        <div className="pointer-events-none rounded-full border border-[#00ffb4]/18 bg-[#06131b]/60 px-3 py-2 text-[11px] text-[#9fb0ca] backdrop-blur-xl">
          {`${Object.values(completedParts).filter(Boolean).length}/${totalModules} parts complete`}
        </div>

        <div className="pointer-events-none hidden rounded-full border border-[#00ffb4]/18 bg-[#06131b]/60 px-3 py-2 text-[11px] text-[#9fb0ca] backdrop-blur-xl md:block">
          {debug
            ? lastCoords
              ? `Debug on / [${lastCoords.join(", ")}]`
              : "Debug on / click model"
            : afkAutoRotate
            ? "AFK auto-rotate"
            : "Drag / zoom / select"}
        </div>
      </div>

      {current.key !== "cpu" ? (
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous module"
          className="absolute left-4 top-1/2 z-[115] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#00ffb4]/25 bg-[#06131b]/74 text-lg font-black text-[#dbe6f5] shadow-[0_18px_60px_rgba(0,0,0,0.36)] backdrop-blur-xl transition hover:bg-white/[0.08] md:left-6"
        >
          &lt;
        </button>
      ) : null}

      {current.key !== "case" ? (
        <button
          type="button"
          onClick={onNext}
          aria-label="Next module"
          className="absolute right-4 top-1/2 z-[115] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#00ffb4]/25 bg-[#06131b]/74 text-lg font-black text-[#dbe6f5] shadow-[0_18px_60px_rgba(0,0,0,0.36)] backdrop-blur-xl transition hover:bg-white/[0.08] md:right-6"
        >
          &gt;
        </button>
      ) : null}
    </>
  );
}

function PartsSidebar({
  open,
  onToggle,
  modules,
  currentKey,
  completedParts,
  onSelect,
  onViewCertificate,
  moduleFinished,
  certificateWarning,
}) {
  return (
    <div
      className={[
        "absolute left-0 top-0 z-[80] h-full transition-all duration-300",
        open ? "w-[280px]" : "w-[64px]",
      ].join(" ")}
    >
      <div className="h-full border-r border-[#1a2438] bg-[#0b1220]/92 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
        <div className="flex items-center justify-between border-b border-[#1a2438] px-4 py-4">
          {open ? (
            <div>
              <div className="text-sm font-bold text-white">Parts List</div>
              <div className="text-[11px] text-[#7a8ba8]">Module navigation</div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onToggle}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1a2438] bg-white/[0.03] text-[#dbe6f5] transition hover:bg-white/[0.06]"
          >
            {open ? "←" : "→"}
          </button>
        </div>

        <div className="space-y-2 p-3">
          {modules.map((m, index) => {
            const done = !!completedParts[m.key];
            const active = currentKey === m.key;

            return (
              <button
                key={m.key}
                type="button"
                onClick={() => onSelect(index)}
                className={[
                  "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                  active
                    ? "border-[#00ffb4]/25 bg-[#00ffb4]/10"
                    : "border-[#1a2438] bg-white/[0.03] hover:bg-white/[0.06]",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition",
                    open
                      ? done
                        ? "bg-[#00ffb4] text-[#0a0e17]"
                        : "border border-[#1a2438] bg-[#0d1220] text-[#7a8ba8]"
                      : done
                      ? "text-[#00ffb4]"
                      : active
                      ? "text-[#00ffb4]"
                      : "text-[#7a8ba8]",
                  ].join(" ")}
                >
                  {index + 1}
                </span>

                {open ? (
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">
                      {m.name === "Motherboard" ? "MB" : m.name}
                    </div>

                    <div className="text-[11px] text-[#7a8ba8]">
                      {done ? "Finished" : "Not finished"}
                    </div>
                  </div>
                ) : null}
              </button>
            );
          })}

          {certificateWarning && open ? (
            <div className="mt-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-3 text-[11px] leading-relaxed text-red-100">
              {certificateWarning}
            </div>
          ) : null}

          {moduleFinished &&
            (open ? (
              <button
                type="button"
                onClick={onViewCertificate}
                className="mt-3 w-full rounded-2xl bg-[#00ffb4] px-4 py-3 text-sm font-semibold text-[#0a0e17] shadow-[0_12px_40px_rgba(0,255,180,0.22)] transition hover:scale-[1.01]"
              >
                View Certificate ✓
              </button>
            ) : (
              <button
                type="button"
                onClick={onViewCertificate}
                className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl bg-[#00ffb4] text-[#0a0e17] shadow-[0_12px_40px_rgba(0,255,180,0.22)] transition hover:scale-[1.01]"
                aria-label="View certificate"
              >
                ✓
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

function ModulePageBackground() {
  return (
    <>
      <div className="pointer-events-none absolute -left-44 -top-44 h-[720px] w-[720px] rounded-full bg-[#00ffb4]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 -right-52 h-[820px] w-[820px] rounded-full bg-[#00ffb4]/6 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a0e17] via-[#0a0e17] to-[#0d1220]" />
    </>
  );
}

useGLTF.preload("/models/Case(Base).glb");
useGLTF.preload("/models/CpuAMD(Base).glb");
useGLTF.preload("/models/CpuINTEL(Base).glb");
useGLTF.preload("/models/Gpu(Base).glb");
useGLTF.preload("/models/Hdd(Base).glb");
useGLTF.preload("/models/MotherboardAMD(Base).glb");
useGLTF.preload("/models/MotherboardINTEL(Base).glb");
useGLTF.preload("/models/Psu(Base).glb");
useGLTF.preload("/models/Ram(Base).glb");
useGLTF.preload("/models/Ssd(Base).glb");
