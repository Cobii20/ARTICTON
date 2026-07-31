import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import Settings from "../../../Components/Settings";
import { auth, db } from "../../../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { AchievementToast, unlockAchievement } from "../../../utils/achievements.jsx";
import { getUserSettings } from "../../../utils/userSettings";

/* ================================================================== */
/* INTEL FULL ASSEMBLY — PRACTICAL TEST                               */
/* ------------------------------------------------------------------ */
/* Differences from the guided Module 3:                              */
/*   - No fixed step order. Any part whose real-world prerequisites    */
/*     are satisfied (e.g. the motherboard must be populated with      */
/*     CPU/RAM/SSD before it goes in the case) may be installed at any */
/*     time, in any order the learner chooses.                        */
/*   - No pulsing green/teal install-target ghost, no wireframe        */
/*     highlight, no floating "Install X here" callout. Only a neutral */
/*     cursor change signals a part can be grabbed.                    */
/*   - Only meaningful failed placement attempts are counted live.      */
/*     Sequence errors and confirmed placement errors reduce the grade. */
/*   - A results screen replaces the certificate, with score, grade,   */
/*     time, and a mistake breakdown.                                  */
/* ================================================================== */

const ASSEMBLY_SEQUENCE = ["cpu", "ram1", "ram2", "ssd", "motherboard", "psu", "hdd", "gpu"];

const PART_MODELS = [
  { key: "table", path: "/models/INTELtable.glb" },
  { key: "case", path: "/models/NEWcaseINTEL.glb" },
  { key: "motherboard", path: "/models/NEWmotherboardINTEL.glb" },
  { key: "cpu", path: "/models/NEWcpuINTEL.glb" },
  { key: "ram1", path: "/models/NEWramINTEL.glb" },
  { key: "ram2", path: "/models/NEWram2INTEL.glb" },
  { key: "ssd", path: "/models/NEWssdINTEL.glb" },
  { key: "hdd", path: "/models/NEWhddINTEL.glb" },
  { key: "psu", path: "/models/NEWpsuINTEL.glb" },
  { key: "gpu", path: "/models/NEWgpuINTEL.glb" },
];

const MOVABLE_COMPONENT_KEYS = new Set(ASSEMBLY_SEQUENCE);
const MOTHERBOARD_CHILD_KEYS = new Set(["cpu", "ram1", "ram2", "ssd"]);

const COMPONENT_LABELS = {
  cpu: "CPU (Central Processing Unit)",
  ram1: "RAM (Random Access Memory) 1",
  ram2: "RAM (Random Access Memory) 2",
  ssd: "SSD (Solid State Drive)",
  motherboard: "Motherboard",
  psu: "PSU (Power Supply Unit)",
  hdd: "HDD (Hard Disk Drive)",
  gpu: "GPU (Graphics Processing Unit)",
};

/* Physically valid prerequisites: the motherboard must carry its CPU,
   RAM, and SSD before it can go in the case (those sockets are hard to
   reach once it's mounted), and the case itself needs the motherboard
   seated before the PSU/HDD/GPU brackets make sense to fill. GPU and HDD
   and PSU do not depend on each other, so any order among them is fine
   once the motherboard is in. */
const PREREQUISITES = Object.freeze({
  cpu: [],
  ram1: [],
  ram2: [],
  ssd: [],
  motherboard: ["cpu", "ram1", "ram2", "ssd"],
  psu: ["motherboard"],
  hdd: ["motherboard"],
  gpu: ["motherboard"],
});

/* Table starting positions — identical to the physical bench seats used
   at the end of the disassembly test, since these are the same loose
   parts a learner would have in front of them. */
const TABLE_STARTS = Object.freeze({
  cpu: { position: [-12.615, -9.935, 19.679], snapDistance: 0.75, magnetDistance: 4.5 },
  ram1: { position: [-14.962, -10.105, 22.539], snapDistance: 0.85, magnetDistance: 5 },
  ram2: { position: [-15.606, -10.102, 21.06], snapDistance: 0.85, magnetDistance: 5 },
  ssd: { position: [-5.398, -7.823, 28.806], snapDistance: 1, magnetDistance: 6 },
  motherboard: { position: [-11.627, -7.507, 13.488], snapDistance: 2, magnetDistance: 11 },
  psu: {
    position: [-5.545, -0.965, 19.931],
    snapDistance: 1.6,
    magnetDistance: 9,
    preserveTableRotation: true,
  },
  hdd: { position: [-10.726, -3.46, 24.501], snapDistance: 1.25, magnetDistance: 7 },
  gpu: { position: [-11.387, -6.232, 24.891], snapDistance: 1.5, magnetDistance: 9 },
});

const DEFAULT_SNAP_DISTANCE = 1;
const DEFAULT_MAGNET_DISTANCE = 7;
const MAGNETIC_SNAP_MIN_DURATION_MS = 620;
const MAGNETIC_SNAP_MAX_DURATION_MS = 1800;
const MAGNETIC_FIELD_CAPTURE_THRESHOLD = 0.12;
const MAGNETIC_FIELD_AUTO_CAPTURE_THRESHOLD = 0.46;
const MAGNETIC_FIELD_MIN_POINTER_TRAVEL_PX = 12;
const MAGNETIC_FIELD_MIN_PULL = 0.08;
const MAGNETIC_FIELD_MAX_PULL = 0.72;
const MAGNETIC_ROUTE_CAPTURE_RATIO = 0.42;
const HOST_FIELD_PADDING_RATIO = 0.3;
const HOST_FIELD_FEATHER_RATIO = 0.58;
const DRAG_FOLLOW_SPEED = 22;
const ROTATION_FOLLOW_SPEED = 10;
const TELEMETRY_FRAME_INTERVAL = 3;
const TELEMETRY_IDLE_FRAME_INTERVAL = 16;
const CAMERA_FOCUS_DURATION_MS = 760;
const CASE_GROUND_CLEARANCE = 0.025;
const CASE_COMPONENT_CLEARANCE_MIN = 0.75;
const BOARD_COMPONENT_CLEARANCE_MIN = 0.28;
const FINAL_SEAT_CLEARANCE = 0.1;
const CPU_SEAT_DEPTH_RATIO = 0.34;
const CASE_STAND_TRANSITION_DURATION_MS = 2100;
const CASE_STAND_CARD_DELAY_MS = CASE_STAND_TRANSITION_DURATION_MS + 300;
const ASSEMBLY_UX_VERSION = "Safe-Path Magnet v6 + Verified Live Scoring";

/* -------------------------- Grading rubric ------------------------- */
const PENALTY_WRONG_ORDER_CLICK = 6;
const PENALTY_FUMBLE = 3;
const ORDER_MISTAKE_DEBOUNCE_MS = 650;
const TIME_PAR_SECONDS = 480;
const PENALTY_PER_OVER_PAR_MINUTE = 2;

function computeGrade(score) {
  if (score >= 93) return { letter: "A", tone: "Excellent" };
  if (score >= 85) return { letter: "B", tone: "Solid" };
  if (score >= 75) return { letter: "C", tone: "Passing" };
  if (score >= 65) return { letter: "D", tone: "Needs Review" };
  return { letter: "F", tone: "Retry Recommended" };
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function calculateScore(wrongOrderCount, fumbleCount, elapsedSeconds) {
  const safeElapsedSeconds = Math.max(0, Number(elapsedSeconds) || 0);
  const overParMinutes = Math.max(
    0,
    Math.ceil((safeElapsedSeconds - TIME_PAR_SECONDS) / 60)
  );
  const orderPenaltyPoints = Math.max(0, wrongOrderCount) * PENALTY_WRONG_ORDER_CLICK;
  const fumblePenaltyPoints = Math.max(0, fumbleCount) * PENALTY_FUMBLE;
  const timePenaltyPoints = overParMinutes * PENALTY_PER_OVER_PAR_MINUTE;
  const totalPenaltyPoints =
    orderPenaltyPoints + fumblePenaltyPoints + timePenaltyPoints;

  return {
    score: Math.max(0, Math.min(100, Math.round(100 - totalPenaltyPoints))),
    overParMinutes,
    orderPenaltyPoints,
    fumblePenaltyPoints,
    timePenaltyPoints,
    totalPenaltyPoints,
  };
}



function playCompletionSound(enabled, isFinal = false) {
  if (!enabled || typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const context = new AudioContextClass();
    const notes = isFinal
      ? [
          { frequency: 523.25, delay: 0, duration: 0.12 },
          { frequency: 659.25, delay: 0.11, duration: 0.14 },
          { frequency: 783.99, delay: 0.24, duration: 0.2 },
        ]
      : [
          { frequency: 659.25, delay: 0, duration: 0.1 },
          { frequency: 880, delay: 0.09, duration: 0.16 },
        ];

    const masterGain = context.createGain();
    masterGain.gain.setValueAtTime(0.0001, context.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.015);
    masterGain.connect(context.destination);

    notes.forEach(({ frequency, delay, duration }) => {
      const oscillator = context.createOscillator();
      const noteGain = context.createGain();
      const startAt = context.currentTime + delay;
      const endAt = startAt + duration;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startAt);
      noteGain.gain.setValueAtTime(0.0001, startAt);
      noteGain.gain.exponentialRampToValueAtTime(0.75, startAt + 0.012);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, endAt);
      oscillator.connect(noteGain);
      noteGain.connect(masterGain);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.02);
    });

    window.setTimeout(() => {
      context.close().catch(() => {});
    }, isFinal ? 650 : 420);
  } catch (error) {
    console.warn("Completion sound could not be played:", error);
  }
}

function playMistakeSound(enabled) {
  if (!enabled || typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(180, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(90, context.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.14, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.22);
    window.setTimeout(() => context.close().catch(() => {}), 260);
  } catch (error) {
    console.warn("Mistake sound could not be played:", error);
  }
}

function getCompletionDate() {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
  } catch {
    return new Date().toLocaleDateString();
  }
}

const PART_BY_KEY = Object.freeze(Object.fromEntries(PART_MODELS.map((part) => [part.key, part])));

function cloneSceneForDisplay(scene, { disableRaycast = false, enableShadows = true } = {}) {
  const clone = scene.clone(true);
  clone.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = enableShadows;
    object.receiveShadow = enableShadows;
    if (disableRaycast) object.raycast = () => null;
  });
  return clone;
}

function getModelBounds(scene) {
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  return {
    center: bounds.getCenter(new THREE.Vector3()),
    size: bounds.getSize(new THREE.Vector3()),
    box: bounds.clone(),
  };
}

function getAutomaticLayFlatQuaternion(modelSize) {
  const dimensions = [modelSize.x, modelSize.y, modelSize.z];
  const thinnestAxis = dimensions.indexOf(Math.min(...dimensions));
  const euler = new THREE.Euler(0, 0, 0);

  if (thinnestAxis === 0) {
    euler.set(0, 0, Math.PI / 2);
  } else if (thinnestAxis === 2) {
    euler.set(-Math.PI / 2, 0, 0);
  }

  return new THREE.Quaternion().setFromEuler(euler);
}

function getCaseLayFlatCandidates(modelSize) {
  const dimensions = [modelSize.x, modelSize.y, modelSize.z];
  const thinnestAxis = dimensions.indexOf(Math.min(...dimensions));

  if (thinnestAxis === 0) {
    return [
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2)),
    ];
  }

  if (thinnestAxis === 2) {
    return [
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
    ];
  }

  return [new THREE.Quaternion()];
}

function chooseOpenSideUpCaseQuaternion(modelSize, caseCenter, targetCenters) {
  const candidates = getCaseLayFlatCandidates(modelSize);
  if (candidates.length === 1 || !targetCenters.length) return candidates[0];

  /*
   * The authored AMD/Intel case meshes expose their removable side panel on
   * the opposite local normal from the component target origins. Choosing the
   * candidate that puts those target origins lowest therefore leaves the open
   * cavity facing upward. The previous max-score test selected the closed
   * underside and made the case appear face-down.
   */
  let bestCandidate = candidates[0];
  let bestScore = Infinity;

  candidates.forEach((candidate) => {
    const score = targetCenters.reduce((total, targetCenter) => {
      const rotatedOffset = targetCenter
        .clone()
        .sub(caseCenter)
        .applyQuaternion(candidate);
      return total + rotatedOffset.y;
    }, 0);

    if (score < bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  });

  return bestCandidate.clone();
}

function getCpuSeatCorrectionLocal(motherboardScene, cpuScene) {
  const motherboardBounds = getModelBounds(motherboardScene);
  const cpuBounds = getModelBounds(cpuScene);
  const motherboardDimensions = [
    motherboardBounds.size.x,
    motherboardBounds.size.y,
    motherboardBounds.size.z,
  ];
  const boardNormalAxis = motherboardDimensions.indexOf(
    Math.min(...motherboardDimensions)
  );

  const centerDelta =
    cpuBounds.center.getComponent(boardNormalAxis) -
    motherboardBounds.center.getComponent(boardNormalAxis);
  const outwardDirection = Math.sign(centerDelta) || 1;
  const cpuNormalThickness = Math.max(
    cpuBounds.size.getComponent(boardNormalAxis),
    Math.min(cpuBounds.size.x, cpuBounds.size.y, cpuBounds.size.z),
    0.001
  );

  // Move the CPU toward the motherboard plane by a controlled fraction of
  // its thickness. This removes the authored visual gap without burying the
  // package inside the socket and works at both AMD and Intel model scales.
  const seatDepth = cpuNormalThickness * CPU_SEAT_DEPTH_RATIO;
  const offset = new THREE.Vector3();
  offset.setComponent(boardNormalAxis, -outwardDirection * seatDepth);
  return offset;
}

function getGroundedRotationOffsetY(bounds, pivot, quaternion) {
  const rotatedBounds = new THREE.Box3();
  const { min, max } = bounds;

  for (const x of [min.x, max.x]) {
    for (const y of [min.y, max.y]) {
      for (const z of [min.z, max.z]) {
        const corner = new THREE.Vector3(x, y, z)
          .sub(pivot)
          .applyQuaternion(quaternion)
          .add(pivot);
        rotatedBounds.expandByPoint(corner);
      }
    }
  }

  return bounds.min.y - rotatedBounds.min.y + CASE_GROUND_CLEARANCE;
}

function StaticAuthoredModel({ part, disableRaycast = true }) {
  const { scene } = useGLTF(encodeURI(part.path));
  const clone = useMemo(
    () =>
      cloneSceneForDisplay(scene, {
        disableRaycast,
        enableShadows: !["cpu", "ram1", "ram2", "ssd"].includes(part.key),
      }),
    [disableRaycast, part.key, scene]
  );

  return <primitive object={clone} dispose={null} />;
}

/* ------------------------------------------------------------------ */
/* Interactive assembly object — magnet/snap physics preserved, all     */
/* visual teaching aids (ghost target mesh, wireframe, tether line,     */
/* capture ring, callout) removed. Clicking a part whose prerequisites  */
/* are unmet is still ALLOWED (per the free-order design) but is        */
/* reported as a mistake rather than blocked outright.                  */
/* ------------------------------------------------------------------ */

function InteractiveCenteredObject({
  partKey,
  label,
  modelCenter,
  modelSize,
  startConfig,
  targetFrameRef = null,
  magnetFieldRef = null,
  targetSeatOffsetLocal = null,
  isActive,
  testActive,
  isFullRun = false,
  showGuides = true,
  isCompleted,
  onPartCompleted,
  onLockedPartClick,
  onFumble,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
  contentFrameRef = null,
  children,
}) {
  const { camera, gl } = useThree();
  const groupRef = useRef(null);
  const rotationRef = useRef(null);
  const tetherRef = useRef(null);
  const tetherMaterialRef = useRef(null);
  const captureRingRef = useRef(null);
  const captureRingMaterialRef = useRef(null);

  const phaseRef = useRef("ready");
  const [phase, setPhase] = useState("ready");
  const grabbingRef = useRef(false);
  const completionReportedRef = useRef(false);
  const frameCounterRef = useRef(0);
  const fumbleCountRef = useRef(0);
  const initialDistanceRef = useRef(1);
  const magnetStateRef = useRef("Move toward host field");
  const magnetNoticeRef = useRef(false);

  const snapStartedAtRef = useRef(0);
  const snapDurationRef = useRef(MAGNETIC_SNAP_MIN_DURATION_MS);
  const snapStartPositionRef = useRef(new THREE.Vector3());
  const snapStartQuaternionRef = useRef(new THREE.Quaternion());
  const snapLiftPositionRef = useRef(new THREE.Vector3());
  const snapHoverPositionRef = useRef(new THREE.Vector3());
  const snapPreSeatPositionRef = useRef(new THREE.Vector3());
  const routeGoalRef = useRef(new THREE.Vector3());
  const routeWorldPointRef = useRef(new THREE.Vector3());

  const pointerClientRef = useRef(new THREE.Vector2());
  const pointerStartRef = useRef(new THREE.Vector2());
  const dragStartCenterWorldRef = useRef(new THREE.Vector3());
  const dragRightWorldRef = useRef(new THREE.Vector3(1, 0, 0));
  const dragUpWorldRef = useRef(new THREE.Vector3(0, 0, 1));
  const worldUnitsPerPixelRef = useRef(0.02);
  const safeCarryYRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragCurrentYRef = useRef(0);

  const desiredCenterWorldRef = useRef(new THREE.Vector3());
  const desiredCenterLocalRef = useRef(new THREE.Vector3());
  const desiredGroupLocalRef = useRef(new THREE.Vector3());
  const assistedGoalRef = useRef(new THREE.Vector3());
  const desiredVisualCenterWorldRef = useRef(new THREE.Vector3());
  const currentCenterLocalRef = useRef(new THREE.Vector3());
  const targetCenterLocalRef = useRef(new THREE.Vector3());
  const currentCenterWorldRef = useRef(new THREE.Vector3());
  const targetCenterWorldRef = useRef(new THREE.Vector3());
  const cameraForwardRef = useRef(new THREE.Vector3());
  const cameraRightRef = useRef(new THREE.Vector3());
  const cameraUpRef = useRef(new THREE.Vector3());

  const targetPositionRef = useRef(new THREE.Vector3());
  const targetQuaternionRef = useRef(new THREE.Quaternion());
  const authoredCenterWorldRef = useRef(new THREE.Vector3());
  const authoredCenterLocalRef = useRef(new THREE.Vector3());
  const targetWorldQuaternionRef = useRef(new THREE.Quaternion());
  const parentWorldQuaternionRef = useRef(new THREE.Quaternion());
  const seatOffsetParentLocalRef = useRef(new THREE.Vector3());

  const hostBoundsRef = useRef(new THREE.Box3());
  const expandedHostBoundsRef = useRef(new THREE.Box3());
  const closestHostPointRef = useRef(new THREE.Vector3());
  const hostSizeRef = useRef(new THREE.Vector3());
  const lineStartRef = useRef(new THREE.Vector3());
  const lineEndRef = useRef(new THREE.Vector3());

  const isMovablePart = MOVABLE_COMPONENT_KEYS.has(partKey);
  const canInteract = isMovablePart && testActive && isActive && !isCompleted;
  const shouldShowGuides = showGuides && isActive;

  const installedQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const targetSeatOffsetVector = useMemo(() => {
    if (!targetSeatOffsetLocal) return new THREE.Vector3();
    if (targetSeatOffsetLocal.isVector3) return targetSeatOffsetLocal.clone();
    return new THREE.Vector3().fromArray(targetSeatOffsetLocal);
  }, [targetSeatOffsetLocal]);
  const tableQuaternion = useMemo(() => {
    if (startConfig?.preserveTableRotation) return installedQuaternion.clone();
    return getAutomaticLayFlatQuaternion(modelSize);
  }, [installedQuaternion, modelSize, startConfig]);

  const startPosition = startConfig?.position || [0, 0, 0];
  const snapDistance = startConfig?.snapDistance ?? DEFAULT_SNAP_DISTANCE;
  const magnetDistance = startConfig?.magnetDistance ?? DEFAULT_MAGNET_DISTANCE;
  const modelRadius = useMemo(
    () => Math.max(modelSize.length() * 0.5, 0.35),
    [modelSize]
  );
  const captureRingRadius = THREE.MathUtils.clamp(
    Math.max(snapDistance * 1.6, modelRadius * 0.25),
    0.55,
    4.5
  );

  const setPhaseSafely = useCallback((nextPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const updatePointer = useCallback((event) => {
    pointerClientRef.current.set(event.clientX, event.clientY);
  }, []);

  const computeInstallationTarget = useCallback(() => {
    const parent = groupRef.current?.parent || null;

    if (!targetFrameRef?.current) {
      targetPositionRef.current.set(0, 0, 0);
      targetQuaternionRef.current.identity();
      return {
        position: targetPositionRef.current,
        quaternion: targetQuaternionRef.current,
      };
    }

    targetFrameRef.current.updateWorldMatrix(true, false);
    authoredCenterWorldRef.current
      .copy(modelCenter)
      .applyMatrix4(targetFrameRef.current.matrixWorld);

    authoredCenterLocalRef.current.copy(authoredCenterWorldRef.current);
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(authoredCenterLocalRef.current);
    }

    targetPositionRef.current
      .copy(authoredCenterLocalRef.current)
      .sub(modelCenter);

    targetFrameRef.current.getWorldQuaternion(targetWorldQuaternionRef.current);
    seatOffsetParentLocalRef.current
      .copy(targetSeatOffsetVector)
      .applyQuaternion(targetWorldQuaternionRef.current);

    if (parent) {
      parent.getWorldQuaternion(parentWorldQuaternionRef.current);
      parentWorldQuaternionRef.current.invert();
      seatOffsetParentLocalRef.current.applyQuaternion(
        parentWorldQuaternionRef.current
      );
      targetPositionRef.current.add(seatOffsetParentLocalRef.current);
      targetQuaternionRef.current
        .copy(parentWorldQuaternionRef.current)
        .multiply(targetWorldQuaternionRef.current);
    } else {
      targetPositionRef.current.add(seatOffsetParentLocalRef.current);
      targetQuaternionRef.current.copy(targetWorldQuaternionRef.current);
    }

    return {
      position: targetPositionRef.current,
      quaternion: targetQuaternionRef.current,
    };
  }, [modelCenter, targetFrameRef, targetSeatOffsetVector]);

  const localGroupCenterToWorld = useCallback(
    (groupPosition, output) => {
      output.copy(groupPosition).add(modelCenter);
      const parent = groupRef.current?.parent;
      if (parent) {
        parent.updateWorldMatrix(true, false);
        parent.localToWorld(output);
      }
      return output;
    },
    [modelCenter]
  );

  const worldCenterToLocalGroupPosition = useCallback(
    (worldCenter, output) => {
      output.copy(worldCenter);
      const parent = groupRef.current?.parent;
      if (parent) {
        parent.updateWorldMatrix(true, false);
        parent.worldToLocal(output);
      }
      output.sub(modelCenter);
      return output;
    },
    [modelCenter]
  );

  const getVisualCenters = useCallback(
    (installationTarget) => {
      currentCenterLocalRef.current.copy(groupRef.current.position).add(modelCenter);
      targetCenterLocalRef.current.copy(installationTarget.position).add(modelCenter);
      currentCenterWorldRef.current.copy(currentCenterLocalRef.current);
      targetCenterWorldRef.current.copy(targetCenterLocalRef.current);

      const parent = groupRef.current.parent;
      if (parent) {
        parent.updateWorldMatrix(true, false);
        parent.localToWorld(currentCenterWorldRef.current);
        parent.localToWorld(targetCenterWorldRef.current);
      }

      return {
        currentLocal: currentCenterLocalRef.current,
        targetLocal: targetCenterLocalRef.current,
        currentWorld: currentCenterWorldRef.current,
        targetWorld: targetCenterWorldRef.current,
      };
    },
    [modelCenter]
  );

  const getHostFieldInfo = useCallback(
    (worldPosition, targetWorldPosition) => {
      const host = magnetFieldRef?.current;
      if (!host) {
        const distance = worldPosition.distanceTo(targetWorldPosition);
        const radius = Math.max(magnetDistance * 1.6, modelRadius * 2.2);
        return {
          inside: distance <= radius * 0.45,
          strength: THREE.MathUtils.clamp(1 - distance / radius, 0, 1),
          outsideDistance: distance,
        };
      }

      host.updateWorldMatrix(true, true);
      hostBoundsRef.current.setFromObject(host);
      if (hostBoundsRef.current.isEmpty()) {
        const distance = worldPosition.distanceTo(targetWorldPosition);
        const radius = Math.max(magnetDistance * 1.6, modelRadius * 2.2);
        return {
          inside: distance <= radius * 0.45,
          strength: THREE.MathUtils.clamp(1 - distance / radius, 0, 1),
          outsideDistance: distance,
        };
      }

      hostBoundsRef.current.getSize(hostSizeRef.current);
      const largestHostDimension = Math.max(
        hostSizeRef.current.x,
        hostSizeRef.current.y,
        hostSizeRef.current.z,
        1
      );
      const padding = Math.max(
        largestHostDimension * HOST_FIELD_PADDING_RATIO,
        magnetDistance * 0.35,
        modelRadius * 0.45
      );
      const feather = Math.max(
        largestHostDimension * HOST_FIELD_FEATHER_RATIO,
        magnetDistance,
        modelRadius * 1.5
      );

      expandedHostBoundsRef.current.copy(hostBoundsRef.current).expandByScalar(padding);
      expandedHostBoundsRef.current.clampPoint(
        worldPosition,
        closestHostPointRef.current
      );
      const outsideDistance = worldPosition.distanceTo(closestHostPointRef.current);
      const inside = expandedHostBoundsRef.current.containsPoint(worldPosition);
      const strength = inside
        ? 1
        : THREE.MathUtils.clamp(1 - outsideDistance / feather, 0, 1);

      return { inside, strength, outsideDistance };
    },
    [magnetDistance, magnetFieldRef, modelRadius]
  );

  const computeSafeApproachPlan = useCallback(
    (installationTarget, centers) => {
      const host = magnetFieldRef?.current;
      let hostTopWorldY = Math.max(
        centers.currentWorld.y,
        centers.targetWorld.y
      );

      if (host) {
        host.updateWorldMatrix(true, true);
        hostBoundsRef.current.setFromObject(host);
        if (!hostBoundsRef.current.isEmpty()) {
          hostTopWorldY = hostBoundsRef.current.max.y;
        }
      }

      const isBoardComponent = MOTHERBOARD_CHILD_KEYS.has(partKey);
      const clearance = isBoardComponent
        ? THREE.MathUtils.clamp(
            modelRadius * 0.12,
            BOARD_COMPONENT_CLEARANCE_MIN,
            1.35
          )
        : THREE.MathUtils.clamp(
            modelRadius * 0.16,
            CASE_COMPONENT_CLEARANCE_MIN,
            4.5
          );
      const safeCenterWorldY = Math.max(
        hostTopWorldY + clearance,
        centers.currentWorld.y,
        centers.targetWorld.y + clearance
      );
      const finalSeatLift = Math.max(
        FINAL_SEAT_CLEARANCE,
        Math.min(clearance * 0.22, 0.45)
      );

      routeWorldPointRef.current
        .copy(centers.currentWorld)
        .setY(safeCenterWorldY);
      worldCenterToLocalGroupPosition(
        routeWorldPointRef.current,
        snapLiftPositionRef.current
      );

      routeWorldPointRef.current
        .copy(centers.targetWorld)
        .setY(safeCenterWorldY);
      worldCenterToLocalGroupPosition(
        routeWorldPointRef.current,
        snapHoverPositionRef.current
      );

      routeWorldPointRef.current
        .copy(centers.targetWorld)
        .setY(centers.targetWorld.y + finalSeatLift);
      worldCenterToLocalGroupPosition(
        routeWorldPointRef.current,
        snapPreSeatPositionRef.current
      );

      return {
        target: installationTarget.position,
        lift: snapLiftPositionRef.current,
        hover: snapHoverPositionRef.current,
        preSeat: snapPreSeatPositionRef.current,
        safeCenterWorldY,
        clearance,
      };
    },
    [magnetFieldRef, modelRadius, partKey, worldCenterToLocalGroupPosition]
  );

  const publishTelemetry = useCallback(() => {
    if (!groupRef.current || !isMovablePart || !onTelemetry || !isActive) return;

    const installationTarget = computeInstallationTarget();
    const centers = getVisualCenters(installationTarget);
    const distance = centers.currentWorld.distanceTo(centers.targetWorld);
    const progress = THREE.MathUtils.clamp(
      1 - distance / Math.max(initialDistanceRef.current, 0.001),
      0,
      1
    );

    onTelemetry({
      key: partKey,
      label,
      phase: phaseRef.current,
      position: centers.currentWorld.toArray(),
      targetPosition: centers.targetWorld.toArray(),
      distance,
      captureDistance: Math.max(magnetDistance, initialDistanceRef.current * MAGNETIC_ROUTE_CAPTURE_RATIO),
      hardSnapDistance: snapDistance,
      progress,
      magnetState: magnetStateRef.current,
      yLocked: false,
    });
  }, [
    computeInstallationTarget,
    getVisualCenters,
    isActive,
    isMovablePart,
    label,
    magnetDistance,
    onTelemetry,
    partKey,
    snapDistance,
  ]);

  useEffect(() => {
    if (!groupRef.current || !rotationRef.current) return;

    const target = computeInstallationTarget();
    completionReportedRef.current = false;
    grabbingRef.current = false;
    magnetNoticeRef.current = false;

    if (isCompleted) {
      groupRef.current.position.copy(target.position);
      rotationRef.current.quaternion.copy(target.quaternion);
      magnetStateRef.current = "Installed";
      setPhaseSafely("installed");
    } else {
      groupRef.current.position.set(...startPosition);
      rotationRef.current.quaternion.copy(tableQuaternion);
      dragCurrentYRef.current = groupRef.current.position.y;
      magnetStateRef.current = "Move toward host field";
      setPhaseSafely("ready");
    }

    groupRef.current.updateMatrixWorld(true);
    initialDistanceRef.current = Math.max(
      groupRef.current.position.distanceTo(target.position),
      magnetDistance,
      1
    );

    requestAnimationFrame(() => publishTelemetry());
  }, [
    computeInstallationTarget,
    isCompleted,
    magnetDistance,
    publishTelemetry,
    setPhaseSafely,
    startPosition,
    tableQuaternion,
  ]);

  const reportCompletion = useCallback(() => {
    if (completionReportedRef.current || isCompleted) return;
    completionReportedRef.current = true;
    onPartCompleted(partKey);
  }, [isCompleted, onPartCompleted, partKey]);

  const finishInstall = useCallback(() => {
    if (!groupRef.current || !rotationRef.current) return;
    const target = computeInstallationTarget();
    groupRef.current.position.copy(target.position);
    rotationRef.current.quaternion.copy(target.quaternion);
    groupRef.current.updateMatrixWorld(true);
    grabbingRef.current = false;
    magnetStateRef.current = "Installed";
    magnetNoticeRef.current = false;
    onDragStateChange(false);
    document.body.style.cursor = "default";
    setPhaseSafely("installed");
    onInteractionMessage(
      `${label} was magnetically aligned, animated into its seat, and locked in place.`
    );
    publishTelemetry();
    reportCompletion();
  }, [
    computeInstallationTarget,
    label,
    onDragStateChange,
    onInteractionMessage,
    publishTelemetry,
    reportCompletion,
    setPhaseSafely,
  ]);

  const seatComponent = useCallback(() => {
    if (
      !groupRef.current ||
      !rotationRef.current ||
      phaseRef.current === "snapping" ||
      phaseRef.current === "installed"
    ) {
      return;
    }

    const target = computeInstallationTarget();
    const centers = getVisualCenters(target);
    const route = computeSafeApproachPlan(target, centers);

    snapStartPositionRef.current.copy(groupRef.current.position);
    snapStartQuaternionRef.current.copy(rotationRef.current.quaternion);

    const pathDistance =
      snapStartPositionRef.current.distanceTo(route.lift) +
      route.lift.distanceTo(route.hover) +
      route.hover.distanceTo(route.preSeat) +
      route.preSeat.distanceTo(target.position);

    snapStartedAtRef.current = performance.now();
    snapDurationRef.current = THREE.MathUtils.clamp(
      MAGNETIC_SNAP_MIN_DURATION_MS + pathDistance * 34,
      MAGNETIC_SNAP_MIN_DURATION_MS,
      MAGNETIC_SNAP_MAX_DURATION_MS
    );

    grabbingRef.current = false;
    magnetStateRef.current = "Safe-path magnetic capture";
    onDragStateChange(false);
    document.body.style.cursor = "default";
    setPhaseSafely("snapping");
    onInteractionMessage(
      `The invisible ${MOTHERBOARD_CHILD_KEYS.has(partKey) ? "motherboard" : "case"} field captured ${label}. It will lift, align above the opening, lower vertically, and seat without passing through the chassis.`
    );
  }, [
    computeInstallationTarget,
    computeSafeApproachPlan,
    getVisualCenters,
    label,
    onDragStateChange,
    onFumble,
    onInteractionMessage,
    partKey,
    setPhaseSafely,
  ]);

  const beginGrab = useCallback(
    (event) => {
      if (!groupRef.current || !rotationRef.current) return;
      updatePointer(event);

      const target = computeInstallationTarget();
      const centers = getVisualCenters(target);
      pointerStartRef.current.copy(pointerClientRef.current);
      dragStartCenterWorldRef.current.copy(centers.currentWorld);
      dragStartYRef.current = groupRef.current.position.y;
      dragCurrentYRef.current = groupRef.current.position.y;
      initialDistanceRef.current = Math.max(
        groupRef.current.position.distanceTo(target.position),
        magnetDistance,
        1
      );
      const safeRoute = computeSafeApproachPlan(target, centers);
      safeCarryYRef.current = safeRoute.lift.y;

      cameraRightRef.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
      cameraUpRef.current.set(0, 1, 0).applyQuaternion(camera.quaternion);
      camera.getWorldDirection(cameraForwardRef.current);

      dragRightWorldRef.current
        .copy(cameraRightRef.current)
        .setY(0);
      if (dragRightWorldRef.current.lengthSq() < 0.0001) {
        dragRightWorldRef.current.set(1, 0, 0);
      } else {
        dragRightWorldRef.current.normalize();
      }

      dragUpWorldRef.current.copy(cameraUpRef.current).setY(0);
      if (dragUpWorldRef.current.lengthSq() < 0.0001) {
        dragUpWorldRef.current
          .copy(cameraForwardRef.current)
          .setY(0)
          .multiplyScalar(-1);
      }
      if (dragUpWorldRef.current.lengthSq() < 0.0001) {
        dragUpWorldRef.current.set(0, 0, 1);
      } else {
        dragUpWorldRef.current.normalize();
      }

      const distanceToCamera = Math.max(
        camera.position.distanceTo(centers.currentWorld),
        1
      );
      const visibleHeight =
        2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distanceToCamera;
      worldUnitsPerPixelRef.current = THREE.MathUtils.clamp(
        visibleHeight / Math.max(gl.domElement.clientHeight, 1),
        0.002,
        0.35
      );

      grabbingRef.current = true;
      magnetStateRef.current = "Carrying toward host field";
      magnetNoticeRef.current = false;
      setPhaseSafely("grabbed");
      onDragStateChange(true);
      document.body.style.cursor = "grabbing";
      onInteractionMessage(
        `${label} grabbed. Drag it toward the ${MOTHERBOARD_CHILD_KEYS.has(partKey) ? "motherboard" : "case"}; entering the invisible field will automatically start the seating animation.`
      );
      publishTelemetry();
    },
    [
      camera,
      computeInstallationTarget,
      computeSafeApproachPlan,
      getVisualCenters,
      gl,
      label,
      magnetDistance,
      modelRadius,
      onDragStateChange,
      onInteractionMessage,
      partKey,
      publishTelemetry,
      setPhaseSafely,
      updatePointer,
    ]
  );

  const releaseObject = useCallback(() => {
    if (!grabbingRef.current || !groupRef.current) return;
    grabbingRef.current = false;
    onDragStateChange(false);
    document.body.style.cursor = "default";

    const target = computeInstallationTarget();
    const centers = getVisualCenters(target);
    const field = getHostFieldInfo(centers.currentWorld, centers.targetWorld);
    const distance = groupRef.current.position.distanceTo(target.position);
    const routeCaptureDistance = Math.max(
      magnetDistance * 1.25,
      initialDistanceRef.current * MAGNETIC_ROUTE_CAPTURE_RATIO
    );

    if (
      field.inside ||
      field.strength >= MAGNETIC_FIELD_CAPTURE_THRESHOLD ||
      distance <= routeCaptureDistance
    ) {
      seatComponent();
      return;
    }

    const pointerTravel = Math.hypot(
      pointerClientRef.current.x - pointerStartRef.current.x,
      pointerClientRef.current.y - pointerStartRef.current.y
    );

    if (pointerTravel < MAGNETIC_FIELD_MIN_POINTER_TRAVEL_PX) {
      magnetStateRef.current = "Released without placement attempt";
      setPhaseSafely("released");
      onInteractionMessage(
        `${label} was released without a meaningful drag. No placement error was recorded.`
      );
      publishTelemetry();
      return;
    }

    const nextFumbleCount = fumbleCountRef.current + 1;
    fumbleCountRef.current = nextFumbleCount;
    onFumble?.(partKey, { attempt: nextFumbleCount });

    magnetStateRef.current = "Released outside host field";
    setPhaseSafely("released");
    onInteractionMessage(
      `${label} was released outside the magnetic field. Drag it closer to the ${MOTHERBOARD_CHILD_KEYS.has(partKey) ? "motherboard" : "case"}; exact placement is not required.`
    );
    publishTelemetry();
  }, [
    computeInstallationTarget,
    getHostFieldInfo,
    getVisualCenters,
    label,
    magnetDistance,
    onDragStateChange,
    onInteractionMessage,
    partKey,
    publishTelemetry,
    seatComponent,
    setPhaseSafely,
  ]);

  useEffect(() => {
    const handlePointerMove = (event) => updatePointer(event);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [updatePointer]);

  useEffect(() => {
    if (phase !== "grabbed") return undefined;

    const handlePointerUp = (event) => {
      if (event.button !== 0) return;
      releaseObject();
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") releaseObject();
    };

    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [phase, releaseObject]);

  useEffect(() => {
    const cancelGrab = () => {
      if (!grabbingRef.current) return;
      grabbingRef.current = false;
      onDragStateChange(false);
      document.body.style.cursor = "default";
      setPhaseSafely("released");
    };
    window.addEventListener("pointercancel", cancelGrab);
    window.addEventListener("blur", cancelGrab);
    return () => {
      window.removeEventListener("pointercancel", cancelGrab);
      window.removeEventListener("blur", cancelGrab);
      document.body.style.cursor = "default";
    };
  }, [onDragStateChange, setPhaseSafely]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current || !rotationRef.current) return;
    const safeDelta = Math.min(delta, 0.05);
    const target = computeInstallationTarget();
    const centers = getVisualCenters(target);
    const distance = groupRef.current.position.distanceTo(target.position);
    const routeCaptureDistance = Math.max(
      magnetDistance * 1.25,
      initialDistanceRef.current * MAGNETIC_ROUTE_CAPTURE_RATIO
    );
    const proximity = THREE.MathUtils.clamp(
      1 - distance / Math.max(routeCaptureDistance, 0.001),
      0,
      1
    );

    if (shouldShowGuides && phaseRef.current !== "installed") {
      if (tetherRef.current) {
        lineStartRef.current.copy(centers.currentLocal);
        lineEndRef.current.copy(centers.targetLocal);
        tetherRef.current.geometry.setFromPoints([
          lineStartRef.current,
          lineEndRef.current,
        ]);
        tetherRef.current.visible = true;
      }
      if (tetherMaterialRef.current) {
        tetherMaterialRef.current.opacity = 0.2 + proximity * 0.7;
      }
      if (captureRingRef.current) {
        captureRingRef.current.visible = true;
        captureRingRef.current.position.copy(centers.targetLocal);
        captureRingRef.current.scale.setScalar(
          1 + Math.sin(clock.elapsedTime * 4.5) * 0.055
        );
      }
      if (captureRingMaterialRef.current) {
        captureRingMaterialRef.current.opacity = 0.12 + proximity * 0.3;
      }
    } else {
      if (tetherRef.current) tetherRef.current.visible = false;
      if (captureRingRef.current) captureRingRef.current.visible = false;
    }

    if (phaseRef.current === "snapping") {
      const rawProgress = THREE.MathUtils.clamp(
        (performance.now() - snapStartedAtRef.current) /
          Math.max(snapDurationRef.current, 1),
        0,
        1
      );

      if (rawProgress < 0.24) {
        const segmentProgress = THREE.MathUtils.smootherstep(
          rawProgress,
          0,
          0.24
        );
        groupRef.current.position.lerpVectors(
          snapStartPositionRef.current,
          snapLiftPositionRef.current,
          segmentProgress
        );
        magnetStateRef.current = `Lifting clear ${Math.round(segmentProgress * 100)}%`;
      } else if (rawProgress < 0.64) {
        const segmentProgress = THREE.MathUtils.smootherstep(
          rawProgress,
          0.24,
          0.64
        );
        groupRef.current.position.lerpVectors(
          snapLiftPositionRef.current,
          snapHoverPositionRef.current,
          segmentProgress
        );
        magnetStateRef.current = `Aligning above seat ${Math.round(segmentProgress * 100)}%`;
      } else if (rawProgress < 0.93) {
        const segmentProgress = THREE.MathUtils.smootherstep(
          rawProgress,
          0.64,
          0.93
        );
        groupRef.current.position.lerpVectors(
          snapHoverPositionRef.current,
          snapPreSeatPositionRef.current,
          segmentProgress
        );
        magnetStateRef.current = `Lowering vertically ${Math.round(segmentProgress * 100)}%`;
      } else {
        const segmentProgress = THREE.MathUtils.smootherstep(
          rawProgress,
          0.93,
          1
        );
        groupRef.current.position.lerpVectors(
          snapPreSeatPositionRef.current,
          target.position,
          segmentProgress
        );
        magnetStateRef.current = `Final seating ${Math.round(segmentProgress * 100)}%`;
      }

      const rotationProgress = THREE.MathUtils.smootherstep(
        rawProgress,
        0.18,
        0.9
      );
      rotationRef.current.quaternion.slerpQuaternions(
        snapStartQuaternionRef.current,
        target.quaternion,
        rotationProgress
      );

      if (rawProgress >= 1) finishInstall();
    } else if (grabbingRef.current) {
      const pointerDeltaX = pointerClientRef.current.x - pointerStartRef.current.x;
      const pointerDeltaY = pointerClientRef.current.y - pointerStartRef.current.y;
      const pointerTravel = Math.hypot(pointerDeltaX, pointerDeltaY);
      const dragScale = worldUnitsPerPixelRef.current;

      desiredCenterWorldRef.current
        .copy(dragStartCenterWorldRef.current)
        .addScaledVector(dragRightWorldRef.current, pointerDeltaX * dragScale)
        .addScaledVector(dragUpWorldRef.current, -pointerDeltaY * dragScale);

      desiredCenterLocalRef.current.copy(desiredCenterWorldRef.current);
      const parent = groupRef.current.parent;
      if (parent) parent.worldToLocal(desiredCenterLocalRef.current);
      desiredGroupLocalRef.current
        .copy(desiredCenterLocalRef.current)
        .sub(modelCenter);

      const desiredDistance = desiredGroupLocalRef.current.distanceTo(target.position);
      const liftProgress = THREE.MathUtils.clamp(pointerTravel / 72, 0, 1);
      const safeY = THREE.MathUtils.lerp(
        dragStartYRef.current,
        safeCarryYRef.current,
        THREE.MathUtils.smootherstep(liftProgress, 0, 1)
      );
      dragCurrentYRef.current = THREE.MathUtils.damp(
        dragCurrentYRef.current,
        safeY,
        10,
        safeDelta
      );
      desiredGroupLocalRef.current.y = dragCurrentYRef.current;
      assistedGoalRef.current.copy(desiredGroupLocalRef.current);

      localGroupCenterToWorld(
        desiredGroupLocalRef.current,
        desiredVisualCenterWorldRef.current
      );
      const field = getHostFieldInfo(
        desiredVisualCenterWorldRef.current,
        centers.targetWorld
      );
      const routeStrength = THREE.MathUtils.clamp(
        1 - desiredDistance / Math.max(routeCaptureDistance, 0.001),
        0,
        1
      );
      const activeFieldStrength = Math.max(field.strength, routeStrength);

      if (activeFieldStrength > 0) {
        const easedStrength = THREE.MathUtils.smootherstep(
          activeFieldStrength,
          0,
          1
        );
        const safeRoute = computeSafeApproachPlan(target, {
          currentWorld: desiredVisualCenterWorldRef.current,
          targetWorld: centers.targetWorld,
        });
        const currentCenterHeight = centers.currentWorld.y;
        const safelyLifted =
          currentCenterHeight >= safeRoute.safeCenterWorldY - safeRoute.clearance * 0.2;
        routeGoalRef.current.copy(safelyLifted ? safeRoute.hover : safeRoute.lift);
        assistedGoalRef.current.lerp(
          routeGoalRef.current,
          THREE.MathUtils.lerp(
            MAGNETIC_FIELD_MIN_PULL,
            MAGNETIC_FIELD_MAX_PULL,
            easedStrength
          )
        );
        rotationRef.current.quaternion.slerp(
          target.quaternion,
          1 - Math.exp(-(4 + easedStrength * 8) * safeDelta)
        );
        magnetStateRef.current = field.inside
          ? "Inside host magnetic field"
          : "Host field pulling";
        if (!magnetNoticeRef.current && activeFieldStrength > 0.15) {
          magnetNoticeRef.current = true;
          onInteractionMessage(
            `${label} entered the magnetic approach zone. The ${MOTHERBOARD_CHILD_KEYS.has(partKey) ? "motherboard" : "case"} is pulling it toward the exact seat.`
          );
        }
      } else {
        magnetStateRef.current = "Move toward host field";
        magnetNoticeRef.current = false;
        rotationRef.current.quaternion.slerp(
          tableQuaternion,
          1 - Math.exp(-ROTATION_FOLLOW_SPEED * safeDelta)
        );
      }

      groupRef.current.position.lerp(
        assistedGoalRef.current,
        1 - Math.exp(-DRAG_FOLLOW_SPEED * safeDelta)
      );

      const currentCenterWorld = localGroupCenterToWorld(
        groupRef.current.position,
        currentCenterWorldRef.current
      );
      const currentField = getHostFieldInfo(
        currentCenterWorld,
        centers.targetWorld
      );
      const currentDistance = groupRef.current.position.distanceTo(target.position);
      const easySnapDistance = Math.max(
        snapDistance * 2.2,
        magnetDistance * 0.28,
        modelRadius * 0.35
      );

      if (
        pointerTravel >= MAGNETIC_FIELD_MIN_POINTER_TRAVEL_PX &&
        (currentField.inside ||
          activeFieldStrength >= MAGNETIC_FIELD_AUTO_CAPTURE_THRESHOLD ||
          currentDistance <= easySnapDistance)
      ) {
        seatComponent();
        return;
      }
    } else if (phaseRef.current === "released") {
      const field = getHostFieldInfo(centers.currentWorld, centers.targetWorld);
      const routeStrength = THREE.MathUtils.clamp(
        1 - distance / Math.max(routeCaptureDistance, 0.001),
        0,
        1
      );
      const strength = Math.max(field.strength, routeStrength);
      if (strength > 0.02) {
        magnetStateRef.current = "Safe-path capture starting";
        seatComponent();
        return;
      }
    } else if (phaseRef.current === "installed") {
      // Installed parts become rigid children of their authored host frame.
      // Directly following the moving target prevents lag or separation while
      // the completed case rotates from flat to its upright presentation.
      groupRef.current.position.copy(target.position);
      rotationRef.current.quaternion.copy(target.quaternion);
    }

    frameCounterRef.current += 1;
    const interval = grabbingRef.current
      ? TELEMETRY_FRAME_INTERVAL
      : TELEMETRY_IDLE_FRAME_INTERVAL;
    if (isActive && frameCounterRef.current % interval === 0) {
      publishTelemetry();
    }
  });

  const handlePointerDown = useCallback(
    (event) => {
      if (!isMovablePart || !testActive) return;
      event.stopPropagation();
      if (!canInteract) {
        if (isCompleted || phaseRef.current === "installed") {
          onInteractionMessage(`${label} is already installed and locked.`);
        } else {
          onLockedPartClick(partKey);
        }
        return;
      }
      if (phaseRef.current === "ready" || phaseRef.current === "released") {
        beginGrab(event);
      }
    },
    [
      beginGrab,
      canInteract,
      isCompleted,
      isMovablePart,
      label,
      onInteractionMessage,
      onLockedPartClick,
      partKey,
      testActive,
    ]
  );

  const handlePointerOver = useCallback(
    (event) => {
      if (!isMovablePart) return;
      event.stopPropagation();
      document.body.style.cursor = canInteract ? "grab" : "not-allowed";
    },
    [canInteract, isMovablePart]
  );

  const handlePointerOut = useCallback(() => {
    if (!grabbingRef.current) document.body.style.cursor = "default";
  }, []);

  return (
    <>
      <group
        ref={groupRef}
        position={startPosition}
        onPointerDown={handlePointerDown}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <group position={[modelCenter.x, modelCenter.y, modelCenter.z]}>
          <group ref={rotationRef} quaternion={tableQuaternion.toArray()}>
            <group
              ref={contentFrameRef}
              position={[-modelCenter.x, -modelCenter.y, -modelCenter.z]}
            >
              {children}
            </group>
          </group>
        </group>
      </group>

      <line ref={tetherRef} visible={false} renderOrder={1100}>
        <bufferGeometry />
        <lineBasicMaterial
          ref={tetherMaterialRef}
          color="#00ffb4"
          transparent
          opacity={0.45}
          depthTest={false}
          depthWrite={false}
        />
      </line>

      <mesh
        ref={captureRingRef}
        visible={false}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1099}
      >
        <ringGeometry args={[captureRingRadius * 0.72, captureRingRadius, 64]} />
        <meshBasicMaterial
          ref={captureRingMaterialRef}
          color="#00ffb4"
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

function AssemblyPart({
  part,
  targetFrameRef,
  magnetFieldRef,
  targetSeatOffsetLocal = null,
  isActive,
  testActive,
  isFullRun = false,
  showGuides = true,
  isCompleted,
  onPartCompleted,
  onLockedPartClick,
  onFumble,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
}) {
  const { scene } = useGLTF(encodeURI(part.path));
  const clone = useMemo(
    () => cloneSceneForDisplay(scene, { enableShadows: part.key !== "cpu" }),
    [part.key, scene]
  );
  const bounds = useMemo(() => getModelBounds(clone), [clone]);

  return (
    <InteractiveCenteredObject
      partKey={part.key}
      label={COMPONENT_LABELS[part.key] || part.key}
      modelCenter={bounds.center}
      modelSize={bounds.size}
      startConfig={TABLE_STARTS[part.key]}
      targetFrameRef={targetFrameRef}
      magnetFieldRef={magnetFieldRef}
      targetSeatOffsetLocal={targetSeatOffsetLocal}
      isActive={isActive}
      testActive={testActive}
      isFullRun={isFullRun}
      showGuides={showGuides}
      isCompleted={isCompleted}
      onPartCompleted={onPartCompleted}
      onLockedPartClick={onLockedPartClick}
      onFumble={onFumble}
      onInteractionMessage={onInteractionMessage}
      onDragStateChange={onDragStateChange}
      onTelemetry={onTelemetry}
    >
      <primitive object={clone} dispose={null} />
    </InteractiveCenteredObject>
  );
}

function CaseWorkspace({
  contentFrameRef,
  magneticFieldRef,
  activePartKeys,
  showGuides,
  standCase = false,
}) {
  const part = PART_BY_KEY.case;
  const { scene } = useGLTF(encodeURI(part.path));
  const { scene: motherboardTargetScene } = useGLTF(
    encodeURI(PART_BY_KEY.motherboard.path)
  );
  const { scene: psuTargetScene } = useGLTF(encodeURI(PART_BY_KEY.psu.path));
  const { scene: hddTargetScene } = useGLTF(encodeURI(PART_BY_KEY.hdd.path));
  const { scene: gpuTargetScene } = useGLTF(encodeURI(PART_BY_KEY.gpu.path));

  const groundedGroupRef = useRef(null);
  const caseRotationRef = useRef(null);
  const transitionStartedAtRef = useRef(0);
  const transitionFromQuaternionRef = useRef(new THREE.Quaternion());
  const transitionToQuaternionRef = useRef(new THREE.Quaternion());
  const transitioningRef = useRef(false);

  const caseClone = useMemo(
    () => cloneSceneForDisplay(scene, { disableRaycast: true }),
    [scene]
  );
  const bounds = useMemo(() => getModelBounds(caseClone), [caseClone]);
  const caseTargetCenters = useMemo(
    () =>
      [
        motherboardTargetScene,
        psuTargetScene,
        hddTargetScene,
        gpuTargetScene,
      ].map((targetScene) => getModelBounds(targetScene).center),
    [gpuTargetScene, hddTargetScene, motherboardTargetScene, psuTargetScene]
  );
  const layFlatQuaternion = useMemo(
    () =>
      chooseOpenSideUpCaseQuaternion(
        bounds.size,
        bounds.center,
        caseTargetCenters
      ),
    [bounds.center, bounds.size, caseTargetCenters]
  );
  const groundOffsetY = useMemo(
    () =>
      getGroundedRotationOffsetY(
        bounds.box,
        bounds.center,
        layFlatQuaternion
      ),
    [bounds.box, bounds.center, layFlatQuaternion]
  );
  const standingQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const inverseCenter = useMemo(
    () => bounds.center.clone().multiplyScalar(-1),
    [bounds.center]
  );
  useEffect(() => {
    const rotationGroup = caseRotationRef.current;
    if (!rotationGroup) return;

    transitionFromQuaternionRef.current.copy(rotationGroup.quaternion);
    transitionToQuaternionRef.current.copy(
      standCase ? standingQuaternion : layFlatQuaternion
    );
    transitionStartedAtRef.current = performance.now();
    transitioningRef.current = true;
  }, [layFlatQuaternion, standCase, standingQuaternion]);

  useFrame(() => {
    const groundedGroup = groundedGroupRef.current;
    const rotationGroup = caseRotationRef.current;
    if (!groundedGroup || !rotationGroup) return;

    if (transitioningRef.current) {
      const rawProgress = THREE.MathUtils.clamp(
        (performance.now() - transitionStartedAtRef.current) /
          CASE_STAND_TRANSITION_DURATION_MS,
        0,
        1
      );
      const easedProgress = THREE.MathUtils.smootherstep(rawProgress, 0, 1);
      rotationGroup.quaternion.slerpQuaternions(
        transitionFromQuaternionRef.current,
        transitionToQuaternionRef.current,
        easedProgress
      );
      if (rawProgress >= 1) {
        rotationGroup.quaternion.copy(transitionToQuaternionRef.current);
        transitioningRef.current = false;
      }
    }

    // Recalculate contact height from the current quaternion every frame so
    // the chassis rolls smoothly into position without floating or clipping
    // through the tabletop during the flat-to-standing transition.
    groundedGroup.position.y = getGroundedRotationOffsetY(
      bounds.box,
      bounds.center,
      rotationGroup.quaternion
    );
  });

  return (
    <group ref={groundedGroupRef} position={[0, groundOffsetY, 0]}>
      <group position={bounds.center.toArray()}>
        <group ref={caseRotationRef} quaternion={layFlatQuaternion.toArray()}>
          <group ref={contentFrameRef} position={inverseCenter.toArray()}>
            <group ref={magneticFieldRef}>
              <primitive object={caseClone} dispose={null} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

function MotherboardUnit({
  contentFrameRef,
  magneticFieldRef,
  targetFrameRef,
  targetMagnetFieldRef,
  activePartKeys,
  testActive,
  isFullRun = false,
  showGuides = true,
  completedParts,
  cpuSeatOffsetLocal,
  onPartCompleted,
  onLockedPartClick,
  onFumble,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
}) {
  const part = PART_BY_KEY.motherboard;
  const { scene } = useGLTF(encodeURI(part.path));
  const motherboardIsActive = activePartKeys.includes("motherboard");
  const motherboardClone = useMemo(
    () =>
      cloneSceneForDisplay(scene, {
        disableRaycast: !motherboardIsActive,
      }),
    [motherboardIsActive, scene]
  );
  const bounds = useMemo(
    () => getModelBounds(motherboardClone),
    [motherboardClone]
  );

  return (
    <InteractiveCenteredObject
      partKey="motherboard"
      label="Motherboard"
      modelCenter={bounds.center}
      modelSize={bounds.size}
      startConfig={TABLE_STARTS.motherboard}
      targetFrameRef={targetFrameRef}
      magnetFieldRef={targetMagnetFieldRef}
      isActive={motherboardIsActive}
      testActive={testActive}
      isFullRun={isFullRun}
      showGuides={showGuides}
      isCompleted={completedParts.includes("motherboard")}
      onPartCompleted={onPartCompleted}
      onLockedPartClick={onLockedPartClick}
      onFumble={onFumble}
      onInteractionMessage={onInteractionMessage}
      onDragStateChange={onDragStateChange}
      onTelemetry={onTelemetry}
      contentFrameRef={contentFrameRef}
    >
      <group ref={magneticFieldRef}>
        <primitive object={motherboardClone} dispose={null} />
      </group>

      {["cpu", "ram1", "ram2", "ssd"].map((key) =>
        completedParts.includes(key) ? (
          <group
            key={`installed-${key}`}
            position={
              key === "cpu" && cpuSeatOffsetLocal
                ? cpuSeatOffsetLocal.toArray()
                : [0, 0, 0]
            }
          >
            <StaticAuthoredModel
              part={PART_BY_KEY[key]}
              disableRaycast
            />
          </group>
        ) : null
      )}

    </InteractiveCenteredObject>
  );
}

function Loader() {
  return (
    <Html center>
      <div className="rounded-xl border border-[#1a2438] bg-[#0b1220]/90 px-4 py-2 text-xs font-semibold text-[#00ffb4]">
        Loading test scene...
      </div>
    </Html>
  );
}

class ModelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("Failed to load one or more Practical Test models:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <Html center>
          <div className="max-w-[300px] rounded-xl border border-red-400/30 bg-[#0b1220]/95 px-4 py-3 text-center text-[11px] font-semibold leading-5 text-red-300">
            Could not load one of the assembly models.
            <br />
            Verify these files in /public/models:
            <br />
            <span className="break-all text-red-200">
              {this.props.parts.map((part) => part.path.split("/").pop()).join(", ")}
            </span>
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}

function AssemblyScene({
  rootRef,
  completedParts,
  reachableKeys,
  testActive,
  onPartCompleted,
  onInvalidClick,
  onFumble,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
}) {
  const caseContentRef = useRef(null);
  const caseMagneticFieldRef = useRef(null);
  const motherboardContentRef = useRef(null);
  const motherboardMagneticFieldRef = useRef(null);
  const { scene: motherboardCalibrationScene } = useGLTF(
    encodeURI(PART_BY_KEY.motherboard.path)
  );
  const { scene: cpuCalibrationScene } = useGLTF(
    encodeURI(PART_BY_KEY.cpu.path)
  );
  const cpuSeatOffsetLocal = useMemo(
    () => getCpuSeatCorrectionLocal(motherboardCalibrationScene, cpuCalibrationScene),
    [cpuCalibrationScene, motherboardCalibrationScene]
  );
  const standCompletedCase = useMemo(
    () => ["motherboard", "psu", "hdd", "gpu"].every((key) => completedParts.includes(key)),
    [completedParts]
  );
  const activePartKeys = useMemo(
    () => (testActive ? [...reachableKeys] : []),
    [reachableKeys, testActive]
  );

  return (
    <group ref={rootRef}>
      <StaticAuthoredModel part={PART_BY_KEY.table} disableRaycast />

      <CaseWorkspace
        contentFrameRef={caseContentRef}
        magneticFieldRef={caseMagneticFieldRef}
        activePartKeys={activePartKeys}
        showGuides={false}
        standCase={standCompletedCase}
      />

      <MotherboardUnit
        contentFrameRef={motherboardContentRef}
        magneticFieldRef={motherboardMagneticFieldRef}
        targetFrameRef={caseContentRef}
        targetMagnetFieldRef={caseMagneticFieldRef}
        activePartKeys={activePartKeys}
        testActive={testActive}
        isFullRun
        showGuides={false}
        completedParts={completedParts}
        cpuSeatOffsetLocal={cpuSeatOffsetLocal}
        onPartCompleted={onPartCompleted}
        onLockedPartClick={onInvalidClick}
        onFumble={onFumble}
        onInteractionMessage={onInteractionMessage}
        onDragStateChange={onDragStateChange}
        onTelemetry={onTelemetry}
      />

      {ASSEMBLY_SEQUENCE.filter((key) => key !== "motherboard").map((key) => {
        const isMotherboardChild = MOTHERBOARD_CHILD_KEYS.has(key);
        if (isMotherboardChild && completedParts.includes(key)) return null;

        return (
          <AssemblyPart
            key={key}
            part={PART_BY_KEY[key]}
            targetFrameRef={isMotherboardChild ? motherboardContentRef : caseContentRef}
            magnetFieldRef={isMotherboardChild ? motherboardMagneticFieldRef : caseMagneticFieldRef}
            targetSeatOffsetLocal={key === "cpu" ? cpuSeatOffsetLocal : null}
            isActive={activePartKeys.includes(key)}
            testActive={testActive}
            isFullRun
            showGuides={false}
            isCompleted={completedParts.includes(key)}
            onPartCompleted={onPartCompleted}
            onLockedPartClick={onInvalidClick}
            onFumble={onFumble}
            onInteractionMessage={onInteractionMessage}
            onDragStateChange={onDragStateChange}
            onTelemetry={onTelemetry}
          />
        );
      })}
    </group>
  );
}

function FullTableBirdEyeCamera({ sceneRootRef, controlsRef, overviewRequest }) {
  const { camera, size } = useThree();
  const initializedRef = useRef(false);
  const handledRequestRef = useRef(-1);

  useEffect(() => {
    const isInitial = !initializedRef.current;
    const isRequested = overviewRequest !== handledRequestRef.current;
    if (!isInitial && !isRequested) return undefined;

    let frameId = 0;
    let attempts = 0;

    const frameWholeWorkspace = () => {
      const root = sceneRootRef.current;
      const controls = controlsRef.current;
      if (!root || !controls) {
        attempts += 1;
        if (attempts < 60) frameId = requestAnimationFrame(frameWholeWorkspace);
        return;
      }

      root.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(root);
      if (box.isEmpty()) {
        attempts += 1;
        if (attempts < 60) frameId = requestAnimationFrame(frameWholeWorkspace);
        return;
      }

      const center = box.getCenter(new THREE.Vector3());
      const sceneSize = box.getSize(new THREE.Vector3());
      const aspect = Math.max(size.width / Math.max(size.height, 1), 0.5);
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
      const verticalDistance = (sceneSize.y * 0.72) / Math.max(Math.tan(verticalFov / 2), 0.2);
      const horizontalDistance = (sceneSize.x * 0.72) / Math.max(Math.tan(horizontalFov / 2), 0.2);
      const depthDistance = sceneSize.z * 0.9;
      const distance = Math.max(verticalDistance, horizontalDistance, depthDistance, 12);

      const direction = new THREE.Vector3(0.42, 1.28, 0.88).normalize();
      const target = center.clone();
      target.y += sceneSize.y * 0.02;

      camera.position.copy(target).addScaledVector(direction, distance * 1.52);
      camera.near = Math.max(0.01, distance / 600);
      camera.far = Math.max(1600, distance * 24);
      camera.updateProjectionMatrix();

      controls.target.copy(target);
      camera.lookAt(target);
      controls.update();
      initializedRef.current = true;
      handledRequestRef.current = overviewRequest;
    };

    frameId = requestAnimationFrame(frameWholeWorkspace);
    return () => cancelAnimationFrame(frameId);
  }, [camera, controlsRef, overviewRequest, sceneRootRef, size.height, size.width]);

  return null;
}

function ModelViewer({
  completedParts,
  reachableKeys,
  testActive,
  onPartCompleted,
  onInvalidClick,
  onFumble,
  onInteractionMessage,
}) {
  const [isDraggingPart, setIsDraggingPart] = useState(false);
  const [, setTelemetry] = useState(null);
  const [overviewRequest, setOverviewRequest] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef(null);
  const controlsRef = useRef(null);
  const sceneRootRef = useRef(null);

  const refreshOverviewAfterResize = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setOverviewRequest((value) => value + 1);
      });
    });
  }, []);

  const syncFullscreenState = useCallback(() => {
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || null;
    setIsFullscreen(fullscreenElement === viewerRef.current);
    refreshOverviewAfterResize();
  }, [refreshOverviewAfterResize]);

  useEffect(() => {
    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
    };
  }, [syncFullscreenState]);

  const toggleFullscreen = useCallback(async () => {
    if (isDraggingPart || !viewerRef.current) return;
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || null;

    try {
      if (fullscreenElement === viewerRef.current) {
        const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
        if (exitFullscreen) await Promise.resolve(exitFullscreen.call(document));
        return;
      }

      if (fullscreenElement) {
        const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
        if (exitFullscreen) await Promise.resolve(exitFullscreen.call(document));
      }

      const requestFullscreen = viewerRef.current.requestFullscreen || viewerRef.current.webkitRequestFullscreen;
      if (requestFullscreen) await Promise.resolve(requestFullscreen.call(viewerRef.current));
    } catch (error) {
      console.error("Unable to toggle fullscreen mode:", error);
    }
  }, [isDraggingPart]);

  return (
    <div
      ref={viewerRef}
      className={["relative h-full w-full overflow-hidden bg-[#070c14]", isFullscreen ? "rounded-none" : ""].join(" ")}
      style={isFullscreen ? { width: "100vw", height: "100vh" } : undefined}
    >
      <Canvas
        camera={{ position: [35, 72, 52], fov: 46, near: 0.01, far: 1400 }}
        dpr={[1, 1.45]}
        shadows
        performance={{ min: 0.55 }}
        className="h-full w-full"
        gl={{ antialias: true, powerPreference: "high-performance", alpha: false, stencil: false }}
        style={{ touchAction: "none" }}
      >
        <color attach="background" args={["#070c14"]} />
        <hemisphereLight args={["#ffffff", "#182338", 1.12]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 10, 7]} intensity={1.72} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <directionalLight position={[-5, 4, 2]} intensity={0.65} />

        <ModelErrorBoundary parts={PART_MODELS}>
          <Suspense fallback={<Loader />}>
            <AssemblyScene
              rootRef={sceneRootRef}
              completedParts={completedParts}
              reachableKeys={reachableKeys}
              testActive={testActive}
              onPartCompleted={onPartCompleted}
              onInvalidClick={onInvalidClick}
              onFumble={onFumble}
              onInteractionMessage={onInteractionMessage}
              onDragStateChange={setIsDraggingPart}
              onTelemetry={setTelemetry}
            />
          </Suspense>
        </ModelErrorBoundary>

        <FullTableBirdEyeCamera sceneRootRef={sceneRootRef} controlsRef={controlsRef} overviewRequest={overviewRequest} />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!isDraggingPart}
          enablePan={false}
          enableZoom
          zoomSpeed={0.48}
          zoomToCursor
          enableDamping
          dampingFactor={0.12}
          minPolarAngle={0.08}
          maxPolarAngle={Math.PI * 0.46}
          minDistance={10}
          maxDistance={190}
          mouseButtons={{ LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        />
      </Canvas>

      <div className="absolute left-4 top-4 z-[80] flex max-w-[calc(100%-180px)] flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOverviewRequest((value) => value + 1)}
          disabled={isDraggingPart}
          className="rounded-xl border border-[#00ffb4]/30 bg-[#00ffb4]/12 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7dffdc] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-[#00ffb4]/20 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Reset Camera View
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          disabled={isDraggingPart}
          aria-pressed={isFullscreen}
          className="rounded-xl border border-[#00ffb4]/30 bg-[#0b1220]/92 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7dffdc] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-[#00ffb4]/12 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isFullscreen ? "Exit Full Screen" : "Full Screen"}
        </button>
      </div>


    </div>
  );
}

function HeaderDropdown({ onBack, setIsSettingsOpen, profile }) {
  const displayName = profile
    ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "Profile"
    : "Profile";
  const avatarUrl = profile?.avatarUrl || "";
  const handleBack = () => {
    if (typeof onBack === "function") onBack("Modules");
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <div className="flex max-w-[230px] items-center gap-3 rounded-2xl border border-[#1a2438] bg-[#0d1220]/95 px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 text-sm font-bold uppercase text-[#00ffb4]">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </span>
        <span className="min-w-0 leading-tight text-left">
          <span className="block truncate text-sm font-semibold text-white">{displayName}</span>
          <span className="block text-[11px] text-[#7a8ba8]">Profile</span>
        </span>
      </div>
      <button
        type="button"
        onClick={handleBack}
        className="rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-2.5 text-[13px] font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06]"
      >
        Go back to Dashboard
      </button>
      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        className="rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-2.5 text-[13px] font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06]"
      >
        Settings
      </button>
    </div>
  );
}

function ModuleBackground() {
  return (
    <>
      <div className="pointer-events-none absolute -left-44 -top-44 h-[720px] w-[720px] rounded-full bg-[#00ffb4]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 -right-52 h-[820px] w-[820px] rounded-full bg-[#00ffb4]/6 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a0e17] via-[#0a0e17] to-[#0d1220]" />
    </>
  );
}

function ChecklistSidebar({ open, onToggle, completedParts, checklistOrder, onResetScene }) {
  return (
    <div
      className={[
        "absolute left-0 top-0 z-[200] h-full transition-all duration-300",
        open ? "w-[clamp(220px,22vw,280px)]" : "w-[64px]",
      ].join(" ")}
    >
      <div className="flex h-full min-h-0 flex-col border-r border-[#1a2438] bg-[#0b1220]/92 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#1a2438] px-4 py-4">
          {open ? (
            <div>
              <div className="text-sm font-bold text-white">Practical Steps</div>
              <div className="text-[11px] text-[#7a8ba8]">Intel Platform</div>
            </div>
          ) : null}
          <button type="button" onClick={onToggle} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1a2438] bg-white/[0.03] text-[#dbe6f5] transition hover:bg-white/[0.06]">
            {open ? "<" : ">"}
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 pr-2 [scrollbar-color:rgba(0,255,180,0.35)_rgba(255,255,255,0.05)] [scrollbar-width:thin]">
          {(checklistOrder || ASSEMBLY_SEQUENCE).map((key, index) => {
            const done = completedParts.includes(key);
            return (
              <div key={key} className={["flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition", done ? "border-[#00ffb4]/25 bg-[#00ffb4]/10" : "border-[#1a2438] bg-white/[0.03]"].join(" ")}>
                <span className={["flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition", done ? "bg-[#00ffb4] text-[#0a0e17]" : "border border-[#1a2438] bg-[#0d1220] text-[#7a8ba8]"].join(" ")}>{index + 1}</span>
                {open ? (
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">Step {index + 1}</div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-[#1a2438] p-3">
          <button type="button" onClick={onResetScene} className={["flex items-center justify-center rounded-2xl border border-[#1a2438] bg-white/[0.03] font-semibold text-[#dbe6f5]", "transition hover:bg-white/[0.07]", open ? "w-full px-5 py-3 text-sm" : "h-10 w-10 text-sm"].join(" ")} title="Reset Scene">
            {open ? "Reset Scene" : "R"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TestIntroCard({ onStart }) {
  return (
    <div className="absolute inset-0 z-[750] flex items-center justify-center bg-[#050912]/78 p-5 backdrop-blur-md">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[30px] border border-[#00ffb4]/30 bg-[#0b1220]/96 p-7 shadow-[0_40px_120px_rgba(0,0,0,0.7)] md:p-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(0,255,180,0.13),transparent_42%)]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ff9f7d]/30 bg-[#ff9f7d]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#ff9f7d]">
            Practical Test • INTEL Platform
          </div>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-white md:text-4xl">
            Full Assembly — Practical Test
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#9fb0ca]">
            No visual hints this time. Install all eight loose components onto the motherboard and into the
            case, in any order that makes physical sense. Your accuracy, order judgment, and time are scored.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#00ffb4]">No Guides</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">No install targets or wireframes shown. Rely on what you know.</div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#00ffb4]">Free Order</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">Populate the motherboard before it goes in the case, then fill the case.</div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#00ffb4]">Scored</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">Confirmed sequence errors and failed placement attempts cost points.</div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-[#7a8ba8]">Left click grabs/releases • right-drag rotates • wheel zooms</div>
            <button
              type="button"
              onClick={onStart}
              className="rounded-2xl bg-[#00ffb4] px-7 py-3 text-sm font-black text-[#07111d] shadow-[0_16px_45px_rgba(0,255,180,0.25)] transition hover:scale-[1.03]"
            >
              Begin Test →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultsCard({ result, onRetry, onBackToDashboard }) {
  const grade = computeGrade(result.score);
  const isPass = result.score >= 75;

  return (
    <div className="absolute inset-0 z-[780] flex items-center justify-center bg-[#050912]/86 p-5 backdrop-blur-md" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[30px] border border-[#00ffb4]/35 bg-[#0b1220]/97 p-7 shadow-[0_40px_120px_rgba(0,0,0,0.76),0_0_70px_rgba(0,255,180,0.10)] md:p-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(0,255,180,0.16),transparent_42%)]" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00ffb4]/30 bg-[#00ffb4]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#73ffd4]">
            Test Complete • INTEL Full Assembly
          </div>

          <div className="mt-6 flex items-center gap-6">
            <div
              className={[
                "flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 text-4xl font-black shadow-[0_0_34px_rgba(0,255,180,0.18)]",
                isPass ? "border-[#00ffb4]/50 bg-[#00ffb4]/10 text-[#00ffb4]" : "border-[#ff7d7d]/50 bg-[#ff7d7d]/10 text-[#ff9f9f]",
              ].join(" ")}
            >
              {grade.letter}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#00ffb4]">{grade.tone}</div>
              <h2 className="mt-2 text-3xl font-black leading-tight text-white">{result.score} / 100</h2>
              <p className="mt-2 text-sm leading-6 text-[#9fb0ca]">
                {isPass
                  ? "You met the assembly standard without any step-by-step guidance."
                  : "Below the passing threshold. Review the module and try the test again."}
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.035] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00ffb4]">Time</div>
              <div className="mt-2 text-sm font-bold text-white">{formatDuration(result.elapsedSeconds)}</div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.035] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00ffb4]">Parts Installed</div>
              <div className="mt-2 text-sm font-bold text-white">{result.partsCompleted} / {ASSEMBLY_SEQUENCE.length}</div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.035] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff9f7d]">Order Mistakes</div>
              <div className="mt-2 text-sm font-bold text-white">{result.wrongOrderCount}</div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.035] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffd27d]">Placement Errors</div>
              <div className="mt-2 text-sm font-bold text-white">{result.fumbleCount}</div>
              <div className="mt-1 text-[10px] text-[#7a8ba8]">-{result.fumbleCount * PENALTY_FUMBLE} points</div>
            </div>
          </div>

          <div className="mt-7 rounded-2xl border border-[#00ffb4]/18 bg-[#00ffb4]/6 px-4 py-3 text-xs leading-6 text-[#b7c6dd]">
            Score starts at 100. Each confirmed sequence error costs {PENALTY_WRONG_ORDER_CLICK} points, each
            meaningful failed placement costs {PENALTY_FUMBLE} points, and time beyond {Math.round(TIME_PAR_SECONDS / 60)}{" "}
            minutes costs {PENALTY_PER_OVER_PAR_MINUTE} points per extra minute. Click-release actions without a real drag are ignored. 75+ is a pass.
          </div>

          <div className="mt-7 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onBackToDashboard}
              className="rounded-2xl border border-[#1a2438] bg-white/[0.04] px-5 py-3 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.08]"
            >
              Back to Dashboard
            </button>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-2xl bg-[#00ffb4] px-6 py-3 text-sm font-black text-[#07111d] shadow-[0_16px_45px_rgba(0,255,180,0.18)] transition hover:scale-[1.02]"
            >
              Retry Test →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function INTELFullAssemblyPracticalTest({ onFinish, onBack }) {
  const [sceneRevision, setSceneRevision] = useState(0);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [testActive, setTestActive] = useState(false);
  const [completedParts, setCompletedParts] = useState([]);
  const checklistOrder = ASSEMBLY_SEQUENCE;
  const [wrongOrderCount, setWrongOrderCount] = useState(0);
  const [fumbleCount, setFumbleCount] = useState(0);
  const completedPartsRef = useRef([]);
  const wrongOrderCountRef = useRef(0);
  const fumbleCountRef = useRef(0);
  const lastOrderMistakeRef = useRef({ partKey: null, timestamp: 0 });
  const startedAtRef = useRef(null);
  const finalizationTimerRef = useRef(null);
  const [startedAt, setStartedAt] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState(null);
  const [achievementToast, setAchievementToast] = useState(null);
  const [validationMessage, setValidationMessage] = useState(
    "No hints are active. Click any loose component that is ready to be installed."
  );
  const [settings, setSettings] = useState(getUserSettings);

  const reachableKeys = useMemo(() => {
    const reachable = new Set();
    ASSEMBLY_SEQUENCE.forEach((key) => {
      if (completedParts.includes(key)) return;
      const prerequisites = PREREQUISITES[key] || [];
      const satisfied = prerequisites.every((prereq) => completedParts.includes(prereq));
      if (satisfied) reachable.add(key);
    });
    return reachable;
  }, [completedParts]);

  const liveScoring = calculateScore(
    wrongOrderCount,
    fumbleCount,
    elapsedSeconds
  );

  const handleSettingChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const resetTest = useCallback(() => {
    setCompletedParts([]);
    setWrongOrderCount(0);
    setFumbleCount(0);
    completedPartsRef.current = [];
    wrongOrderCountRef.current = 0;
    fumbleCountRef.current = 0;
    lastOrderMistakeRef.current = { partKey: null, timestamp: 0 };
    startedAtRef.current = null;
    setElapsedSeconds(0);
    if (finalizationTimerRef.current) {
      window.clearTimeout(finalizationTimerRef.current);
      finalizationTimerRef.current = null;
    }
    setStartedAt(null);
    setResult(null);
    setTestActive(false);
    setSceneRevision((value) => value + 1);

    setShowIntro(true);
    setValidationMessage("No hints are active. Click any loose component that is ready to be installed.");
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser || null);
      if (!currentUser) {
        setProfile(null);
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", currentUser.uid));
        setProfile(userSnap.exists() ? userSnap.data() : null);
      } catch (error) {
        console.error("Error fetching INTEL full assembly profile:", error);
        setProfile(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => () => {
    if (finalizationTimerRef.current) {
      window.clearTimeout(finalizationTimerRef.current);
      finalizationTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!testActive || !startedAtRef.current || result) return undefined;

    const updateElapsed = () => {
      setElapsedSeconds(
        Math.max(0, (Date.now() - startedAtRef.current) / 1000)
      );
    };

    updateElapsed();
    const timerId = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timerId);
  }, [result, testActive]);

  const saveTestResult = useCallback(
    async (finalResult) => {
      if (!firebaseUser) return;
      try {
        const userRef = doc(db, "users", firebaseUser.uid);
        await setDoc(
          userRef,
          {
            practicalTests: {
              intelAssembly: {
                score: finalResult.score,
                grade: computeGrade(finalResult.score).letter,
                elapsedSeconds: finalResult.elapsedSeconds,
                wrongOrderCount: finalResult.wrongOrderCount,
                fumbleCount: finalResult.fumbleCount,
                penalizedFumbleCount: finalResult.penalizedFumbleCount,
                completedAt: serverTimestamp(),
              },
            },
          },
          { merge: true }
        );
        const achievement = await unlockAchievement(firebaseUser.uid, "intelAssembly", { score: finalResult.score });
        setAchievementToast(achievement);
        window.setTimeout(() => setAchievementToast(null), 4200);
      } catch (error) {
        console.error("Error saving INTEL Assembly Practical Test result:", error);
      }
    },
    [firebaseUser]
  );

  const finishTest = useCallback(
    (
      finalCompletedParts = completedPartsRef.current,
      finalWrongOrder = wrongOrderCountRef.current,
      finalFumbles = fumbleCountRef.current
    ) => {
      const startTimestamp = startedAtRef.current ?? startedAt;
      const finalElapsedSeconds = startTimestamp
        ? (Date.now() - startTimestamp) / 1000
        : 0;
      const scoring = calculateScore(
        finalWrongOrder,
        finalFumbles,
        finalElapsedSeconds
      );
      const score = scoring.score;
      const finalResult = {
        score,
        elapsedSeconds: finalElapsedSeconds,
        partsCompleted: finalCompletedParts.length,
        wrongOrderCount: finalWrongOrder,
        fumbleCount: finalFumbles,
        penalizedFumbleCount: finalFumbles,
      };

      setResult(finalResult);
      setTestActive(false);
      playCompletionSound(settings.sound, true);
      void saveTestResult(finalResult);
    },
    [saveTestResult, settings.sound, startedAt]
  );

  const handlePartCompleted = useCallback(
    (partKey) => {
      if (completedPartsRef.current.includes(partKey)) return;

      const nextCompletedParts = [...completedPartsRef.current, partKey];
      completedPartsRef.current = nextCompletedParts;
      setCompletedParts(nextCompletedParts);
      playCompletionSound(settings.sound, false);
      setValidationMessage(`${COMPONENT_LABELS[partKey]} installed correctly.`);

      if (nextCompletedParts.length === ASSEMBLY_SEQUENCE.length) {
        setValidationMessage("All components are installed. The completed case is rotating smoothly back to its standing position…");
        if (finalizationTimerRef.current) window.clearTimeout(finalizationTimerRef.current);
        finalizationTimerRef.current = window.setTimeout(() => {
          finishTest(nextCompletedParts);
          finalizationTimerRef.current = null;
        }, CASE_STAND_CARD_DELAY_MS);
      }
    },
    [finishTest, settings.sound]
  );

  const handleInvalidClick = useCallback(
    (partKey) => {
      const now = Date.now();
      const previous = lastOrderMistakeRef.current;
      if (
        previous.partKey === partKey &&
        now - previous.timestamp < ORDER_MISTAKE_DEBOUNCE_MS
      ) {
        return;
      }

      lastOrderMistakeRef.current = { partKey, timestamp: now };
      const nextCount = wrongOrderCountRef.current + 1;
      wrongOrderCountRef.current = nextCount;
      setWrongOrderCount(nextCount);
      playMistakeSound(settings.sound);
      setValidationMessage(
        `${COMPONENT_LABELS[partKey]} is not ready to install yet — a prerequisite component is missing. (Sequence error ${nextCount}: -${PENALTY_WRONG_ORDER_CLICK} points.)`
      );
    },
    [settings.sound]
  );

  const handleFumble = useCallback(
    (partKey, { attempt = 1 } = {}) => {
      const nextTotal = fumbleCountRef.current + 1;
      fumbleCountRef.current = nextTotal;
      setFumbleCount(nextTotal);
      playMistakeSound(settings.sound);

      setValidationMessage(
        `${COMPONENT_LABELS[partKey]} was released outside the magnetic capture field. Placement error ${nextTotal} (attempt ${attempt} for this part): -${PENALTY_FUMBLE} points.`
      );
    },
    [settings.sound]
  );

  const handleStartTest = useCallback(() => {
    setShowIntro(false);
    setTestActive(true);
    const started = Date.now();
    startedAtRef.current = started;
    setStartedAt(started);
    setElapsedSeconds(0);
  }, []);

  const handleBackToDashboard = () => {
    let handled = false;
    if (typeof onFinish === "function") {
      onFinish("Dashboard");
      handled = true;
    }
    if (typeof onBack === "function") {
      onBack("Modules");
      handled = true;
    }
    if (!handled) window.location.href = "/dashboard";
  };

  return (
    <div className="absolute inset-0 h-full w-full overflow-hidden bg-[#0a0e17] font-sans text-[#e8ecf4] antialiased">
      <div className="relative h-full w-full overflow-hidden">
        <ModuleBackground />
        <AchievementToast achievement={achievementToast} onClose={() => setAchievementToast(null)} />

        {showIntro ? <TestIntroCard onStart={handleStartTest} /> : null}
        {result ? <ResultsCard result={result} onRetry={resetTest} onBackToDashboard={handleBackToDashboard} /> : null}

        <div className="relative flex h-full w-full flex-col overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(0,255,180,0.08),transparent_35%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_20%,rgba(255,159,125,0.05),transparent_30%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,180,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,180,0.025)_1px,transparent_1px)] bg-[size:54px_54px] opacity-55" />

          <div className="relative flex h-full w-full flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 text-[12px] text-[#7a8ba8] md:px-10">
              <div>
                Practical Test — <span className="text-[#dbe6f5]">Full Assembly (INTEL)</span>
              </div>
              <div className="rounded-lg border border-[#ff9f7d]/30 bg-[#ff9f7d]/8 px-2 py-1 text-[11px] font-bold text-[#ff9f7d]">Scored Practical</div>
            </div>

            <div className="relative z-[120] mt-3 px-6 md:px-10">
              <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-[22px] border border-[#1a2438] bg-[#0b1220]/86 px-6 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.30)] backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <img src="/PNG/Articton.png" alt="Articton Logo" className="ml-4 h-10 w-10 scale-300 object-contain" />
                  <div>
                    <div className="text-base font-bold tracking-wide text-white">Articton</div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-[#ff9f7d]">INTEL Practical Test</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  {validationMessage ? (
                    <div className="max-w-[540px] rounded-2xl border border-[#00ffb4]/20 bg-[#00ffb4]/8 px-4 py-2 text-xs font-semibold text-[#dffef5]">
                      {validationMessage}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={resetTest}
                    className="rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.07]"
                  >
                    Restart Test
                  </button>

                  <HeaderDropdown onBack={onBack} setIsSettingsOpen={setIsSettingsOpen} profile={profile} />
                </div>
              </div>

              <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onChange={handleSettingChange} />
            </div>

            <div className="px-6 pt-4 md:px-10">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#1a2438] bg-[#0b1220]/72 px-5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
                <div>
                  <div className="text-sm font-semibold text-white">Free-order installation — no visual guides</div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[#7a8ba8]">
                    Drag a valid loose part toward its host field • release anywhere inside the field • animated safe-path seating takes over
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold">
                  <span className="text-[#00ffb4]">{completedParts.length} / {ASSEMBLY_SEQUENCE.length} installed</span>
                  <span className="text-[#ff9f7d]">
                    {wrongOrderCount} sequence {wrongOrderCount === 1 ? "error" : "errors"}{liveScoring.orderPenaltyPoints > 0 ? ` (-${liveScoring.orderPenaltyPoints} pts)` : ""}
                  </span>
                  <span className="text-[#ffd27d]">
                    {fumbleCount} placement {fumbleCount === 1 ? "error" : "errors"}{liveScoring.fumblePenaltyPoints > 0 ? ` (-${liveScoring.fumblePenaltyPoints} pts)` : ""}
                  </span>
                  <span className="text-[#8ec5ff]">
                    {formatDuration(elapsedSeconds)} • Score {liveScoring.score} / 100
                  </span>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 px-4 py-4 md:px-8 md:py-5">
              <div className="relative h-full overflow-hidden rounded-[24px] border border-[#1a2438] bg-[#0d1220]/78 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <ChecklistSidebar
                  open={sidebarOpen}
                  onToggle={() => setSidebarOpen((value) => !value)}
                  completedParts={completedParts}
                  checklistOrder={checklistOrder}
                  onResetScene={resetTest}
                />

                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(255,255,255,0.08),transparent_40%)]" />
                <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.55)]" />

                <div
                  className="absolute bottom-3 right-3 top-3 z-[40] overflow-hidden rounded-[18px] border border-[#1a2438] bg-black/20 transition-all duration-300 md:bottom-4 md:right-4 md:top-4"
                  style={{ left: sidebarOpen ? "clamp(220px, 22vw, 280px)" : 64 }}
                >
                  <ModelViewer
                    key={sceneRevision}
                    completedParts={completedParts}
                    reachableKeys={reachableKeys}
                    testActive={testActive}
                    onPartCompleted={handlePartCompleted}
                    onInvalidClick={handleInvalidClick}
                    onFumble={handleFumble}
                    onInteractionMessage={setValidationMessage}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 border-t border-[#1a2438] px-6 pb-6 pt-4">
              <div className="text-center text-xs text-[#7a8ba8]">
                Left click grabs/releases components • right drag rotates the camera • mouse wheel zooms
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.45)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Preload the table, case, and every assembly component. */
PART_MODELS.forEach((part) => useGLTF.preload(encodeURI(part.path)));


