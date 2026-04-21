import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Environment, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import { auth, db } from "../../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useThree, useFrame } from "@react-three/fiber";

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

  const slide = slides[index];
  const isLast = index === slides.length - 1;

  return (
    <div className="absolute inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative flex h-full w-full items-center justify-center p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: 0.22 }}
            className="w-[1120px] max-w-[calc(100vw-40px)] min-h-[520px] overflow-hidden rounded-[32px] border border-[#1a2438] bg-[#0d1220] shadow-[0_40px_120px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-center justify-between gap-4 border-b border-[#1a2438] bg-[#111d33] px-10 py-7">
              <div className="min-w-0">
                <div className="text-[14px] text-[#00ffb4]">Introduction</div>
                <div className="truncate text-[26px] font-extrabold text-[#e8ecf4]">
                  {slide.title}
                </div>
              </div>

              <div className="text-[14px] font-medium text-[#7a8ba8]">
                {index + 1}/{slides.length}
              </div>
            </div>

            <div className="px-10 py-8">
              <div className="whitespace-pre-line text-[18px] leading-relaxed text-[#dbe6f5]">
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
                      else setIndex((i) => i + 1);
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
  frontAxis = [0, 1, 0],
}) {
  const btn = pin.buttonPx ?? 36;
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
          onClick={onClick}
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.95 }}
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
            style={{ fontSize: Math.max(11, Math.round(btn * 0.33)) }}
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

function HeaderDropdown({ userName, onBack, onLogout }) {
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
          <button className="w-full rounded-xl px-4 py-2 text-left text-sm text-[#dbe6f5] transition hover:bg-white/5">
            Settings
          </button>
          <button className="w-full rounded-xl px-4 py-2 text-left text-sm text-[#dbe6f5] transition hover:bg-white/5">
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
const [localCompletedParts, setLocalCompletedParts] = useState({});

useEffect(() => {
  const saved = profile?.moduleProgress?.module1?.completedParts || {};

  setLocalCompletedParts({
    cpu: !!saved.cpu,
    motherboard: !!saved.motherboard,
    ram: !!saved.ram,
    hdd: !!saved.hdd,
    psu: !!saved.psu,
    case: !!saved.case,
  });
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
          {
            id: "cpu-hs-1",
            number: 1,
            title: "Heat Spreader (Top Cap)",
            position: [3.05, 0.28, 0.02],
            frontAxis: [0, 1, 0],
            en: "The top metal cover spreads heat from the chip to the cooler for better cooling.",
          },
          {
            id: "cpu-hs-2",
            number: 2,
            title: "Substrate / Package Base",
            position: [1.82, -0.35, -0.84],
            frontAxis: [0, -1, 0],
            en: "The base that supports the CPU package and routes signals between internal layers.",
          },
          {
            id: "cpu-hs-3",
            number: 3,
            title: "Contact / Pin Area",
            position: [0.58, -0.47, 0.28],
            frontAxis: [0, -1, 0],
            en: "The contact area connects the CPU to the motherboard socket to deliver power and data.",
          },
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
            points: [
              "Learn main connectors and slots.",
              "Understand how parts communicate on the board.",
              "Use pins to identify components quickly.",
            ],
          },
        ],
        hotspots: [
          {
            id: "mb-hs-1",
            number: 1,
            title: "CPU Socket Area",
            position: [0.2, 0.3, -0.8],
            en: "The CPU socket holds and connects the processor to the motherboard.",
          },
          {
            id: "mb-hs-2",
            number: 2,
            title: "RAM Slots",
            position: [1.4, 0.32, -1],
            en: "DIMM slots where memory modules are installed.",
          },
          {
            id: "mb-hs-3",
            number: 3,
            title: "24-pin ATX Power Connector",
            position: [2, 0.2, -0.55],
            en: "Main power input from the PSU to the motherboard.",
          },
        ],
      },
      {
        key: "ram",
        name: "RAM",
        url: "/models/ram.glb",
        view: {
          cameraPos: [0, 0.55, 2.4],
          boundsMargin: 1.05,
          minDistance: 0.9,
          maxDistance: 6.0,
          modelScale: 1.5,
          modelRotation: [0, 0.35, 0],
          modelPosition: [0, 0, 0],
          normalize: { enabled: true, targetSize: 2.8 },
          pinStyle: { buttonPx: 16, glowRadius: 0.006, distanceFactor: 18 },
        },
        slides: [
          {
            id: "ram-s1",
            title: "RAM Module Overview",
            body:
              "Explore a RAM stick and learn its key parts.\nRAM provides fast temporary storage while programs run.",
            points: [
              "Identify the IC chips and connector edge.",
              "Understand the notch alignment.",
              "Learn safe handling.",
            ],
          },
        ],
        hotspots: [
          {
            id: "ram-hs-1",
            number: 1,
            title: "Memory IC Chips",
            position: [-0.55, 0, 0.03],
            en: "These chips store data temporarily for fast access by the CPU.",
          },
          {
            id: "ram-hs-2",
            number: 2,
            title: "Gold Contacts (Edge Connector)",
            position: [0.4, 0, 0.3],
            en: "The gold contacts connect the RAM electrically to the motherboard DIMM slot.",
          },
          {
            id: "ram-hs-3",
            number: 3,
            title: "Alignment Notch",
            position: [-1.28, -0.01, 0.06],
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
            body:
              "This module introduces the HDD exterior and connection points.\nHDDs store data long-term using spinning platters internally.",
            points: [
              "Identify SATA data + power ports.",
              "Recognize the casing and mounting holes.",
              "Learn handling precautions.",
            ],
          },
        ],
        hotspots: [
           { id: "hdd-hs-1", number: 1, title: "SATA Data Port", position: [239.735, 0.039, -9.351],frontAxis: [0, 1, 1], en: "Transfers data between the HDD and motherboard via a SATA cable." },
          { id: "hdd-hs-2", number: 2, title: "SATA Power Port", position: [239.735, -0.045, 80.445],frontAxis: [0, 1, 1], en: "Receives power from the PSU through the SATA power connector." },
          { id: "hdd-hs-3", number: 3, title: "Drive Casing", position: [-13.835, 16.201, -133.387],frontAxis: [0, 1, 0], en: "Protective metal enclosure that houses internal parts." },
        ],
      },
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
          pinStyle: { buttonPx: 34, glowRadius: 0.05, distanceFactor: 14 },
        },
        slides: [
          {
            id: "psu-s1",
            title: "Power Supply Unit Overview",
            body:
              "The PSU converts AC wall power into regulated DC power for the PC.",
            points: [
              "Identify the AC input and main output area.",
              "PSUs must not be opened.",
              "Use pins to locate key areas.",
            ],
          },
        ],
        hotspots: [
          {
            id: "psu-hs-1",
            number: 1,
            title: "PSU Fan / Vent",
            position: [-0.294, -5.234, -0.641],
            frontAxis: [0, 1, 0],
            en: "Moves air to cool internal components and maintain stable power delivery.",
          },
          {
            id: "psu-hs-2",
            number: 2,
            title: "AC Input Socket",
            position: [-0.717, -5.778, -1.699],
            frontAxis: [0, 1, -1],
            en: "Where the power cable from the wall plugs into the PSU.",
          },
          {
            id: "psu-hs-3",
            number: 3,
            title: "DC Output / Cable Interface",
            position: [0.019, -5.759, 0.795],
            frontAxis: [0, 0, 1],
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
            body:
              "The case provides structure, airflow, and mounting points for components.",
            points: [
              "Identify motherboard tray and PSU bay.",
              "Find storage mounting areas.",
              "Understand airflow direction.",
            ],
          },
        ],
        hotspots: [
          {
            id: "case-hs-1",
            number: 1,
            title: "Motherboard Tray Area",
            position: [0.0, 0.2, 0.0],
            en: "Where the motherboard mounts using standoffs and screws.",
          },
          {
            id: "case-hs-2",
            number: 2,
            title: "PSU Bay",
            position: [-0.25, -0.15, 0.15],
            en: "The compartment where the power supply is installed.",
          },
          {
            id: "case-hs-3",
            number: 3,
            title: "Drive Bay / Storage Mount",
            position: [0.28, -0.05, 0.2],
            en: "Where HDD/SSD mounts are located in many case designs.",
          },
        ],
      },
    ],
    []
  );

  const current = modules[moduleIndex];

 const completedParts = localCompletedParts;

const moduleFinished = useMemo(() => {
  return modules.every((m) => completedParts[m.key]);
}, [modules, completedParts]);

  useEffect(() => {
    if (!current) return;
    const isFinished = completedParts[current.key];
    setShowIntro(!isFinished);
  }, [current, completedParts]);

  useEffect(() => {
    modules.forEach((m) => useGLTF.preload(m.url));
  }, [modules]);

  const activeHotspot = useMemo(
    () => current.hotspots.find((h) => h.id === activeId) || null,
    [current, activeId]
  );

  const user = useMemo(
    () => ({
      name: profile
        ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
        : "Loading...",
      email: firebaseUser?.email || "No email",
    }),
    [profile, firebaseUser]
  );

  const saveModule1Progress = async ({
  page = moduleIndex + 1,
  introDone = !showIntro,
  moduleKey = current?.key,
  completedParts: partsPatch = {},
} = {}) => {
  if (!firebaseUser) return;

  const totalPages = modules.length;
  const prevParts = profile?.moduleProgress?.module1?.completedParts || {};

  const mergedParts = {
    ...prevParts,
    ...partsPatch,
  };

  const completedCount = modules.filter((m) => mergedParts[m.key]).length;
  const allCompleted = completedCount === totalPages;

  const completed = allCompleted;
  const percent = Math.round((completedCount / totalPages) * 100);
  
setLocalCompletedParts(mergedParts);
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
            lastVisitedModuleKey: moduleKey,
            completedParts: mergedParts,
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
  const nextIndex = (moduleIndex + 1) % modules.length;
  const nextPage = nextIndex + 1;

  setActiveId(null);
  setLastCoords(null);
  setModuleIndex(nextIndex);
  setShowIntro(true);

  await saveModule1Progress({
    page: nextPage,
    introDone: false,
    moduleKey: modules[nextIndex].key,
    completedParts: {
      [current.key]: true,
    },
  });
};

  const goPrevModule = async () => {
  const prevIndex = (moduleIndex - 1 + modules.length) % modules.length;
  const prevPage = prevIndex + 1;

  setActiveId(null);
  setLastCoords(null);
  setModuleIndex(prevIndex);
  setShowIntro(true);

  await saveModule1Progress({
    page: prevPage,
    introDone: false,
    moduleKey: modules[prevIndex].key,
    completedParts: {
      [current.key]: true,
    },
  });
};
const handleFinishModule = async () => {
  await saveModule1Progress({
    page: modules.length,
    introDone: true,
    moduleKey: "case",
    completedParts: {
      case: true,
    },
  });

  if (typeof onBack === "function") onBack("Modules");
};
  useEffect(() => {
    if (!profile?.moduleProgress?.module1) return;

    const saved = profile.moduleProgress.module1;

    if (
      typeof saved.currentPage === "number" &&
      saved.currentPage >= 1 &&
      saved.currentPage <= modules.length
    ) {
      setModuleIndex(saved.currentPage - 1);
    }

    if (typeof saved.introDone === "boolean") {
      setShowIntro(!saved.introDone);
    }
  }, [profile, modules.length]);

 const handleSelectModule = async (index) => {
  const key = modules[index].key;
  const isFinished = completedParts[key];

  setActiveId(null);
  setLastCoords(null);
  setModuleIndex(index);
  setShowIntro(!isFinished);

  await saveModule1Progress({
    page: index + 1,
    introDone: isFinished,
    moduleKey: key,
    completedParts: {
      [current.key]: true,
    },
  });
};

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
                  Module 1 (Page {moduleIndex + 1}) —{" "}
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
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 px-6 py-6 md:px-10">
                <div className="relative h-full overflow-hidden rounded-[24px] border border-[#1a2438] bg-[#0d1220]/78 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  <PartsSidebar
                    open={sidebarOpen}
                    onToggle={() => setSidebarOpen((v) => !v)}
                    modules={modules}
                    currentKey={current.key}
                    completedParts={completedParts}
                    onSelect={handleSelectModule}
                    onFinishModule={handleFinishModule}
                     moduleFinished={moduleFinished}
                  />

                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(255,255,255,0.08),transparent_40%)]" />
                  <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.55)]" />

                  <div
                    className="absolute inset-y-6 right-6 overflow-hidden rounded-[18px] border border-[#1a2438] bg-black/10 transition-all duration-300"
                    style={{
                      left: sidebarOpen ? 320 : 32,
                    }}
                  >
                    <div className="pointer-events-none absolute inset-0 rounded-[18px] ring-1 ring-[#00ffb4]/15 shadow-[0_0_0_1px_rgba(0,255,180,0.08)]" />
                    <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-[#00ffb4]/10 blur-3xl" />
                    <div className="pointer-events-none absolute left-[10%] top-[8%] h-[58%] w-[2px] animate-pulse bg-[linear-gradient(180deg,transparent,#00ffb4,transparent)] opacity-25" />
                  </div>

                  {!showIntro ? (
                    <HotspotInfoCard
                      hotspot={activeHotspot}
                      onClose={() => setActiveId(null)}
                    />
                  ) : null}

                  <div
                    className="absolute inset-y-6 right-6 overflow-hidden rounded-[18px] transition-all duration-300"
                    style={{
                      left: sidebarOpen ? 296 : 24,
                    }}
                  >
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
                            onDone={async () => {
                              setShowIntro(false);
                              setActiveId(null);

                              await saveModule1Progress({
                                page: moduleIndex + 1,
                                introDone: true,
                                moduleKey: current.key,
                                completedParts: {
                                  [current.key]: true,
                                },
                              });
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
                          <Canvas
                            key={current.url}
                            camera={{ position: current.view.cameraPos, fov: 45 }}
                            dpr={[1, 1.8]}
                          >
                            <color attach="background" args={["#071520"]} />
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

                 {current.key !== "cpu" && (
                    <button
                type="button"
                onClick={goPrevModule}
                aria-label="Previous module"
                className="absolute top-1/2 z-[200] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#1a2438] bg-[#0d1220]/85 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:bg-white/[0.06]"
                style={{
                  left: sidebarOpen ? 320 : 80, // 👈 push it OUTSIDE the sidebar
                }}
              >
                ←
              </button>
                  )}
                  {current.key !== "case" && (
                  <button
                    type="button"
                    onClick={goNextModule}
                    aria-label="Next module"
                    className="absolute right-7 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#1a2438] bg-[#0d1220]/85 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:bg-white/[0.06]"
                  >
                    <span className="text-lg text-white/80">→</span>
                  </button>
                )}
                  <div className="absolute top-8 right-9 text-[12px] text-[#7a8ba8]">
                    {showIntro
                      ? "Read the intro slides, then start the 3D"
                      : "Click pins to learn parts"}
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

function PartsSidebar({
  open,
  onToggle,
  modules,
  currentKey,
  completedParts,
  onSelect,
  onFinishModule,
   moduleFinished,
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
                      ? "text-[#00ffb4]"   // minimized + finished = green number
                      : active
                      ? "text-[#00ffb4]"   // minimized + active = green number
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

         {(currentKey === "case" || moduleFinished) &&
  (open ? (
    <button
      type="button"
      onClick={onFinishModule}
      className="mt-3 w-full rounded-2xl bg-[#00ffb4] px-4 py-3 text-sm font-semibold text-[#0a0e17] shadow-[0_12px_40px_rgba(0,255,180,0.22)] transition hover:scale-[1.01]"
    >
      ✓ Finish Module
    </button>
  ) : (
    <button
      type="button"
      onClick={onFinishModule}
      className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl bg-[#00ffb4] text-[#0a0e17] shadow-[0_12px_40px_rgba(0,255,180,0.22)] transition hover:scale-[1.01]"
      aria-label="Finish module"
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

useGLTF.preload("/models/cpu.glb");
useGLTF.preload("/models/motherboard.glb");
useGLTF.preload("/models/ram.glb");
useGLTF.preload("/models/hdd.glb");
useGLTF.preload("/models/psu.glb");
useGLTF.preload("/models/case.glb");