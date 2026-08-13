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
import { OrbitControls, useGLTF, Html } from "@react-three/drei";
import Settings from "../../../Components/Settings";
import { auth, db } from "../../../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { AchievementToast, unlockAchievement } from "../../../utils/achievements.jsx";
import { getUserSettings } from "../../../utils/userSettings";

/* ================================================================== */
/* AMD FULL DISASSEMBLY — PRACTICAL TEST                              */
/* ------------------------------------------------------------------ */
/* Differences from the guided Module 2:                              */
/*   - No instructor-selected one-part prompt. The learner may choose */
/*     any currently reachable component, while physical dependencies */
/*     are enforced: GPU first, then the populated motherboard; once  */
/*     it is on the table, its CPU/SSD/two RAM sticks and the remaining*/
/*     case parts may be removed in any physically valid order.       */
/*   - No amber X-ray "click me" highlight, no green ghost target,    */
/*     no pulsing capture ring, no floating callout label. Only a     */
/*     neutral cursor change on hover.                                */
/*   - Only meaningful failed placement attempts are counted live.      */
/*     Sequence errors and confirmed placement errors reduce the grade. */
/*   - A results screen replaces the certificate, showing a grade,    */
/*     total time, and a breakdown of mistakes.                       */
/* ================================================================== */

const REMOVAL_SEQUENCE = ["gpu", "motherboard", "ssd", "ram1", "ram2", "cpu", "hdd", "psu"];
const MOTHERBOARD_MOUNTED_PARTS = new Set(["cpu", "ssd", "ram1", "ram2"]);

const PART_MODELS = [
  { key: "table", path: "/models/AMDtable.glb" },
  { key: "case", path: "/models/NEWcaseAMD.glb" },
  { key: "motherboard", path: "/models/NEWmotherboardAMD.glb" },
  { key: "cpu", path: "/models/NEWcpuAMD.glb" },
  { key: "ram1", path: "/models/NEWramAMD.glb" },
  { key: "ram2", path: "/models/NEWram2AMD.glb" },
  { key: "ssd", path: "/models/NEWssdAMD.glb" },
  { key: "hdd", path: "/models/NEWhddAMD.glb" },
  { key: "psu", path: "/models/NEWpsuAMD.glb" },
  { key: "gpu", path: "/models/NEWgpuAMD.glb" },
];

const MOVABLE_COMPONENT_KEYS = new Set(REMOVAL_SEQUENCE);

const COMPONENT_LABELS = {
  gpu: "GPU (Graphics Processing Unit)",
  ssd: "SSD (Solid State Drive)",
  hdd: "HDD (Hard Disk Drive)",
  ram1: "RAM (Random Access Memory) 1",
  ram2: "RAM (Random Access Memory) 2",
  cpu: "CPU (Central Processing Unit)",
  psu: "PSU (Power Supply Unit)",
  motherboard: "Motherboard",
};

/* Physical dependency map for the practical test. The GPU is removed
   first so the populated motherboard has a clear extraction path. The
   motherboard is then transferred intact to the worktable. Only after it
   is seated there do CPU, SSD, RAM 1, and RAM 2 become independently
   removable. HDD and PSU also become available at that stage, preserving
   the test's free-choice rule wherever more than one order is valid. */
const PREREQUISITES = Object.freeze({
  gpu: [],
  motherboard: ["gpu"],
  cpu: ["motherboard"],
  ram1: ["motherboard"],
  ram2: ["motherboard"],
  ssd: ["motherboard"],
  hdd: ["motherboard"],
  psu: ["motherboard"],
});

/* Final AMD table seats — identical physical targets to the guided module,
   since the test still measures whether the learner can physically dock
   each part, just without being told which one to pick next. */
const PLACEMENT_TARGETS = Object.freeze({
  gpu: { position: [-41.711, -17.422, 88.557], snapDistance: 1.5, magnetDistance: 9 },
  ssd: { position: [-28.53, -13.076, 98.981], snapDistance: 1, magnetDistance: 6 },
  hdd: { position: [-38.289, -9.671, 90.063], snapDistance: 1.25, magnetDistance: 7 },
  ram1: { position: [-53.836, -27.553, 80.307], snapDistance: 0.85, magnetDistance: 5 },
  ram2: { position: [-55.587, -27.596, 75.629], snapDistance: 0.85, magnetDistance: 5 },
  cpu: { position: [-24.32, -27.331, 85.547], snapDistance: 0.75, magnetDistance: 4.5 },
  psu: {
    position: [-28.697, -2.967, 75.561],
    snapDistance: 1.6,
    magnetDistance: 9,
    preserveInstalledRotation: true,
  },
  motherboard: { position: [-41.07, -21.537, 54.246], snapDistance: 2, magnetDistance: 11 },
});


function createMagneticFieldBounds(targets) {
  const positions = Object.values(targets)
    .map((target) => target?.position)
    .filter(Boolean);
  const xs = positions.map((position) => position[0]);
  const zs = positions.map((position) => position[2]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const xSpan = Math.max(maxX - minX, 1);
  const zSpan = Math.max(maxZ - minZ, 1);
  const largestSpan = Math.max(xSpan, zSpan);

  return Object.freeze({
    minX: minX - Math.max(xSpan * 0.62, largestSpan * 0.15),
    maxX: maxX + Math.max(xSpan * 0.62, largestSpan * 0.15),
    minZ: minZ - Math.max(zSpan * 0.55, largestSpan * 0.15),
    maxZ: maxZ + Math.max(zSpan * 0.32, largestSpan * 0.15),
    feather: Math.max(largestSpan * 0.18, 2.4),
  });
}

const MAGNETIC_FIELD_BOUNDS = createMagneticFieldBounds(PLACEMENT_TARGETS);

function getMagneticFieldInfo(position) {
  const bounds = MAGNETIC_FIELD_BOUNDS;
  const outsideX =
    position.x < bounds.minX
      ? bounds.minX - position.x
      : position.x > bounds.maxX
      ? position.x - bounds.maxX
      : 0;
  const outsideZ =
    position.z < bounds.minZ
      ? bounds.minZ - position.z
      : position.z > bounds.maxZ
      ? position.z - bounds.maxZ
      : 0;
  const outsideDistance = Math.hypot(outsideX, outsideZ);
  const inside = outsideDistance <= 0.0001;
  const strength = inside
    ? 1
    : THREE.MathUtils.clamp(
        1 - outsideDistance / Math.max(bounds.feather, 0.001),
        0,
        1
      );

  return { inside, strength, outsideDistance };
}

const DEFAULT_SNAP_DISTANCE = 1;
const DEFAULT_MAGNET_DISTANCE = 7;
const DEFAULT_MAGNET_STRENGTH = 0.28;
const MAGNET_DISTANCE_MULTIPLIER = 1.65;
const EARLY_SNAP_MULTIPLIER = 1.55;
const RELEASE_SNAP_MULTIPLIER = 1.35;
const LANDING_ZONE_RATIO = 0.68;
const EASY_SEAT_MAGNET_RATIO = 0.5;
const MAX_LANDING_PULL = 0.94;
const MAGNETIC_CAPTURE_RATIO = 1.08;
const RELEASED_MAGNET_SPEED = 8.5;
const RELEASED_ROTATION_SPEED = 10;
const MAGNETIC_SNAP_MIN_DURATION_MS = 440;
const MAGNETIC_SNAP_MAX_DURATION_MS = 1150;
const DRAG_FOLLOW_SPEED = 26;
const ROTATION_FOLLOW_SPEED = 10.5;
const SETTLE_SPEED = 10;
const WORKSPACE_PADDING_MULTIPLIER = 1.5;
const TELEMETRY_FRAME_INTERVAL = 3;
const TELEMETRY_IDLE_FRAME_INTERVAL = 16;
const DRAG_SCREEN_GAIN = 1.06;
const EASY_DRAG_CAMERA_DIRECTION = [0.42, 0.96, 1.08];
const OVERVIEW_CAMERA_DISTANCE_MULTIPLIER = 1.52;
const SAFE_CARRY_RISE_START = 0.18;
const SAFE_CARRY_DESCENT_START = 0.68;
const SAFE_CARRY_Y_SPEED = 9.5;
const MAGNETIC_FIELD_MIN_POINTER_TRAVEL_PX = 14;
const MAGNETIC_FIELD_EDGE_CAPTURE_STRENGTH = 0.14;
const MAGNETIC_FIELD_MIN_PULL = 0.1;
const MAGNETIC_FIELD_MAX_PULL = 0.76;
const MAGNETIC_ROUTE_CAPTURE_RATIO = 0.55;

/* -------------------------- Grading rubric ------------------------- */
/* A fresh test starts at 100. Each mistake type deducts points. The
   deductions are calibrated so a careful first-time user who reads
   component names but has no hand-holding can realistically land a B,
   while a user who genuinely knows the disassembly order and is gentle
   with placements can reach an A without needing pixel-perfect drags. */
const PENALTY_WRONG_ORDER_CLICK = 6; // clicked a part that isn't valid yet
const PENALTY_FUMBLE = 3; // released far from any valid target
const ORDER_MISTAKE_DEBOUNCE_MS = 650;
const TIME_PAR_SECONDS = 480; // 8 minutes "par" time, mirrors a technician SLA
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

/* ------------------------------------------------------------------ */
/* Interactive part — physics/magnet logic preserved, all visual        */
/* teaching aids (X-ray guide, ghost target, tether line, capture ring, */
/* callouts) removed. Every click and release now reports to a scoring  */
/* callback instead of (or in addition to) the interaction message.     */
/* ------------------------------------------------------------------ */

function PartModel({
  part,
  isActive,
  isCompleted,
  testActive,
  hostTransformRef,
  onTransformChange,
  allowPointerThrough = false,
  onPartCompleted,
  onLockedPartClick,
  onFumble,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
}) {
  const { scene } = useGLTF(encodeURI(part.path));
  const { camera, gl } = useThree();

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    return clone;
  }, [scene]);

  const groupRef = useRef(null);
  const rotationRef = useRef(null);

  const phaseRef = useRef("installed");
  const [phase, setPhase] = useState("installed");
  const grabbingRef = useRef(false);
  const completionReportedRef = useRef(false);
  const frameCounterRef = useRef(0);
  const fumbleCountRef = useRef(0);
  const initialDistanceRef = useRef(1);
  const magnetStateRef = useRef("Detach first");
  const magnetNoticeRef = useRef(false);
  const snapStartedAtRef = useRef(0);
  const snapDurationRef = useRef(MAGNETIC_SNAP_MIN_DURATION_MS);
  const snapStartPositionRef = useRef(new THREE.Vector3());
  const snapStartQuaternionRef = useRef(new THREE.Quaternion());
  const snapArcHeightRef = useRef(0);
  const snapProgressRef = useRef(0);
  const installedQuaternionRef = useRef(new THREE.Quaternion());

  const mouseRef = useRef(new THREE.Vector2());
  const pointerClientRef = useRef(new THREE.Vector2());
  const grabPointerStartRef = useRef(new THREE.Vector2());
  const dragRightWorldRef = useRef(new THREE.Vector3(1, 0, 0));
  const dragUpWorldRef = useRef(new THREE.Vector3(0, 0, 1));
  const dragPlaneNormalWorldRef = useRef(new THREE.Vector3(0, 1, 0));
  const cameraRightWorldRef = useRef(new THREE.Vector3());
  const cameraUpWorldRef = useRef(new THREE.Vector3());
  const parentWorldQuaternionRef = useRef(new THREE.Quaternion());
  const worldUnitsPerPixelRef = useRef(0.02);
  const dragStartWorldRef = useRef(new THREE.Vector3());
  const dragStartGroupLocalRef = useRef(new THREE.Vector3());
  const dragCurrentYRef = useRef(0);
  const grabStartYRef = useRef(0);
  const safeCarryYRef = useRef(0);
  const desiredCenterWorldRef = useRef(new THREE.Vector3());
  const desiredCenterLocalRef = useRef(new THREE.Vector3());
  const desiredGroupLocalRef = useRef(new THREE.Vector3());
  const assistedGoalRef = useRef(new THREE.Vector3());
  const currentCenterLocalRef = useRef(new THREE.Vector3());
  const targetCenterLocalRef = useRef(new THREE.Vector3());
  const currentCenterWorldRef = useRef(new THREE.Vector3());
  const targetCenterWorldRef = useRef(new THREE.Vector3());
  const desiredQuaternionRef = useRef(new THREE.Quaternion());
  const hostOffsetRef = useRef(new THREE.Vector3());
  const rotatedHostOffsetRef = useRef(new THREE.Vector3());

  const isMovablePart = MOVABLE_COMPONENT_KEYS.has(part.key);
  const canInteract = isMovablePart && testActive && (isActive || isCompleted);
  const placementTarget = PLACEMENT_TARGETS[part.key];

  const targetPosition = useMemo(() => {
    if (!placementTarget?.position) return null;
    return new THREE.Vector3(...placementTarget.position);
  }, [placementTarget]);

  const snapDistance =
    placementTarget?.snapDistance ?? DEFAULT_SNAP_DISTANCE;
  // The authored values define the useful field radius around the seat.
  // Expand them slightly so the attraction is noticeable before the part is
  // already touching the target. This remains local to the active component.
  const magnetDistance =
    (placementTarget?.magnetDistance ?? DEFAULT_MAGNET_DISTANCE) *
    MAGNET_DISTANCE_MULTIPLIER;
  const autoSnapDistance = snapDistance * EARLY_SNAP_MULTIPLIER;

  const modelBounds = useMemo(() => {
    clonedScene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(clonedScene);
    return {
      center: bounds.getCenter(new THREE.Vector3()),
      size: bounds.getSize(new THREE.Vector3()),
    };
  }, [clonedScene]);

  const modelCenter = modelBounds.center;
  const modelSize = modelBounds.size;
  const modelRadius = Math.max(modelSize.x, modelSize.y, modelSize.z) * 0.5;

  const detachedQuaternion = useMemo(() => {
    if (placementTarget?.preserveInstalledRotation) {
      return new THREE.Quaternion();
    }
    return getAutomaticLayFlatQuaternion(modelSize);
  }, [modelSize, placementTarget]);

  const setPhaseSafely = useCallback((nextPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const updateMouse = useCallback(
    (event) => {
      pointerClientRef.current.set(event.clientX, event.clientY);
      const rect = gl.domElement.getBoundingClientRect();
      mouseRef.current.x = THREE.MathUtils.clamp(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -1.15,
        1.15
      );
      mouseRef.current.y = THREE.MathUtils.clamp(
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
        -1.15,
        1.15
      );
    },
    [gl]
  );

  const getVisualCenters = useCallback(() => {
    if (!groupRef.current || !targetPosition) return null;

    currentCenterLocalRef.current
      .copy(groupRef.current.position)
      .add(modelCenter);
    targetCenterLocalRef.current
      .copy(targetPosition)
      .add(modelCenter);

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
  }, [modelCenter, targetPosition]);

  const publishTelemetry = useCallback(() => {
    if (!groupRef.current || !isMovablePart || !isActive || !targetPosition) {
      return;
    }

    const centers = getVisualCenters();
    if (!centers) return;

    const distance = Math.hypot(
      centers.currentLocal.x - centers.targetLocal.x,
      centers.currentLocal.z - centers.targetLocal.z
    );

    if (initialDistanceRef.current <= 0.001) {
      initialDistanceRef.current = Math.max(distance, magnetDistance, 1);
    }

    const progress = THREE.MathUtils.clamp(
      1 - distance / Math.max(initialDistanceRef.current, 0.001),
      0,
      1
    );

    const tableField = getMagneticFieldInfo(groupRef.current.position);
    const routeCaptureDistance = Math.max(
      magnetDistance,
      initialDistanceRef.current * MAGNETIC_ROUTE_CAPTURE_RATIO
    );
    let magnetState = magnetStateRef.current;
    if (phaseRef.current === "installed") magnetState = "Detach first";
    else if (phaseRef.current === "detached") magnetState = "Ready to move";
    else if (phaseRef.current === "placed") magnetState = "Placed";
    else if (phaseRef.current === "snapping") magnetState = magnetStateRef.current;
    else if (tableField.inside || distance <= routeCaptureDistance)
      magnetState = "Inside magnetic table field";
    else if (tableField.strength > 0) magnetState = "Table field pulling";
    else if (distance <= autoSnapDistance * 1.2) magnetState = "Snap ready";
    else if (distance < magnetDistance) magnetState = "Seat magnet engaged";
    else magnetState = "Move toward table field";

    magnetStateRef.current = magnetState;

    const yDifference = Math.abs(
      groupRef.current.position.y - targetPosition.y
    );

    onTelemetry?.({
      key: part.key,
      label: COMPONENT_LABELS[part.key] || part.key,
      phase: phaseRef.current,
      position: groupRef.current.position.toArray(),
      currentCenter: centers.currentWorld.toArray(),
      targetCenter: centers.targetWorld.toArray(),
      distance,
      progress:
        phaseRef.current === "placed"
          ? 1
          : phaseRef.current === "snapping"
          ? snapProgressRef.current
          : progress,
      magnetState,
      yAligned:
        phaseRef.current !== "installed" && yDifference <= 0.08,
      yTransitioning:
        phaseRef.current !== "installed" &&
        phaseRef.current !== "placed" &&
        yDifference > 0.08,
      modelRadius: Math.max(modelRadius, 0.5),
    });
  }, [
    autoSnapDistance,
    getVisualCenters,
    isActive,
    isMovablePart,
    magnetDistance,
    modelRadius,
    onTelemetry,
    part.key,
    targetPosition,
  ]);

  useEffect(() => {
    if (!isActive || !targetPosition) return undefined;

    const centers = getVisualCenters();
    if (centers) {
      initialDistanceRef.current = Math.max(
        Math.hypot(
          centers.currentLocal.x - centers.targetLocal.x,
          centers.currentLocal.z - centers.targetLocal.z
        ),
        magnetDistance,
        1
      );
    }

    frameCounterRef.current = 0;
    magnetNoticeRef.current = false;
    const frame = requestAnimationFrame(() => publishTelemetry());
    return () => cancelAnimationFrame(frame);
  }, [getVisualCenters, isActive, magnetDistance, publishTelemetry, targetPosition]);

  const detachComponent = useCallback(() => {
    if (!isActive || phaseRef.current !== "installed") return;

    if (rotationRef.current) {
      installedQuaternionRef.current.copy(rotationRef.current.quaternion);
    }

    // Detaching no longer changes the part's position or orientation. This
    // prevents long components such as the GPU from rotating through the case
    // and appearing to fall below it on the first click.
    setPhaseSafely("detached");
    magnetStateRef.current = "Ready to move";
    onInteractionMessage(
      `${COMPONENT_LABELS[part.key]} detached safely. It will keep its installed pose until you grab and move it.`
    );

    requestAnimationFrame(() => publishTelemetry());
  }, [
    isActive,
    onInteractionMessage,
    part.key,
    publishTelemetry,
    setPhaseSafely,
  ]);

  const beginGrab = useCallback(
    (event) => {
      if (!groupRef.current || !targetPosition) return;

      updateMouse(event);

      const centers = getVisualCenters();
      if (!centers) return;

      // Preserve the current height at grab time. The component transitions
      // smoothly to its table-seat Y level while the user moves it, instead of
      // teleporting downward as soon as it is clicked.
      dragCurrentYRef.current = groupRef.current.position.y;
      grabStartYRef.current = groupRef.current.position.y;
      const safeClearance = THREE.MathUtils.clamp(
        Math.max(modelSize.y * 0.35, modelRadius * 0.18) + 0.45,
        0.65,
        3.5
      );

      // Establish the carry height only on the first grab. Re-grabbing a
      // released part reuses that height instead of adding more clearance,
      // preventing the component from ratcheting higher after every attempt.
      if (phaseRef.current === "detached") {
        safeCarryYRef.current =
          Math.max(
            grabStartYRef.current,
            targetPosition.y
          ) + safeClearance;
      } else {
        safeCarryYRef.current = Math.max(
          safeCarryYRef.current,
          grabStartYRef.current,
          targetPosition.y
        );
      }
      dragStartGroupLocalRef.current.copy(groupRef.current.position);
      desiredGroupLocalRef.current.copy(groupRef.current.position);
      assistedGoalRef.current.copy(groupRef.current.position);
      dragStartWorldRef.current.copy(centers.currentWorld);

      // Screen-space drag basis: moving the pointer left/right and up/down
      // moves the part in the same apparent screen directions at every camera
      // angle. This removes the stiff or reversed feeling caused by a fixed
      // camera-facing ray plane.
      grabPointerStartRef.current.copy(pointerClientRef.current);

      const parent = groupRef.current.parent;
      if (parent) {
        parent.updateWorldMatrix(true, false);
        parent.getWorldQuaternion(parentWorldQuaternionRef.current);
        dragPlaneNormalWorldRef.current
          .set(0, 1, 0)
          .applyQuaternion(parentWorldQuaternionRef.current)
          .normalize();
      } else {
        dragPlaneNormalWorldRef.current.set(0, 1, 0);
      }

      camera.updateMatrixWorld(true);
      cameraRightWorldRef.current
        .setFromMatrixColumn(camera.matrixWorld, 0)
        .projectOnPlane(dragPlaneNormalWorldRef.current);

      if (cameraRightWorldRef.current.lengthSq() < 0.000001) {
        cameraRightWorldRef.current.set(1, 0, 0);
      }
      cameraRightWorldRef.current.normalize();
      dragRightWorldRef.current.copy(cameraRightWorldRef.current);

      cameraUpWorldRef.current
        .setFromMatrixColumn(camera.matrixWorld, 1)
        .projectOnPlane(dragPlaneNormalWorldRef.current);

      dragUpWorldRef.current
        .crossVectors(
          dragPlaneNormalWorldRef.current,
          dragRightWorldRef.current
        )
        .normalize();

      if (
        cameraUpWorldRef.current.lengthSq() > 0.000001 &&
        dragUpWorldRef.current.dot(cameraUpWorldRef.current) < 0
      ) {
        dragUpWorldRef.current.negate();
      }

      const rect = gl.domElement.getBoundingClientRect();
      const cameraDistance = Math.max(
        camera.position.distanceTo(centers.currentWorld),
        0.1
      );

      if (camera.isPerspectiveCamera) {
        const verticalFov = THREE.MathUtils.degToRad(camera.fov);
        worldUnitsPerPixelRef.current =
          (2 * cameraDistance * Math.tan(verticalFov / 2)) /
          Math.max(rect.height, 1);
      } else if (camera.isOrthographicCamera) {
        worldUnitsPerPixelRef.current =
          Math.abs(camera.top - camera.bottom) /
          Math.max(camera.zoom * rect.height, 1);
      } else {
        worldUnitsPerPixelRef.current = 0.02;
      }

      grabbingRef.current = true;
      magnetNoticeRef.current = false;
      setPhaseSafely("grabbed");
      onDragStateChange(true);
      document.body.style.cursor = "grabbing";
      onInteractionMessage(
        `${COMPONENT_LABELS[part.key]} grabbed. Move it into the open table workspace — you do not need to reach the small highlighted seat. The invisible field will take over and animate the remaining travel.`
      );
      publishTelemetry();
    },
    [
      camera,
      getVisualCenters,
      gl,
      modelRadius,
      modelSize.y,
      onDragStateChange,
      onInteractionMessage,
      part.key,
      publishTelemetry,
      setPhaseSafely,
      targetPosition,
      updateMouse,
    ]
  );

  const reportCompletion = useCallback(() => {
    if (completionReportedRef.current || isCompleted) return;
    completionReportedRef.current = true;
    onPartCompleted(part.key);
  }, [isCompleted, onPartCompleted, part.key]);

  const finishSeatComponent = useCallback(() => {
    if (!groupRef.current || !rotationRef.current || !targetPosition) return;

    groupRef.current.position.copy(targetPosition);
    rotationRef.current.quaternion.copy(detachedQuaternion);
    dragCurrentYRef.current = targetPosition.y;
    snapProgressRef.current = 1;
    grabbingRef.current = false;
    magnetStateRef.current = "Placed";
    onDragStateChange(false);
    document.body.style.cursor = "default";
    setPhaseSafely("placed");
    onInteractionMessage(
      `${COMPONENT_LABELS[part.key]} is seated correctly.`
    );
    publishTelemetry();
    reportCompletion();
  }, [
    detachedQuaternion,
    onDragStateChange,
    onFumble,
    onInteractionMessage,
    part.key,
    publishTelemetry,
    reportCompletion,
    setPhaseSafely,
    targetPosition,
  ]);

  const seatComponent = useCallback(() => {
    if (
      !groupRef.current ||
      !rotationRef.current ||
      !targetPosition ||
      phaseRef.current === "placed" ||
      phaseRef.current === "snapping"
    ) {
      return;
    }

    const distance = groupRef.current.position.distanceTo(targetPosition);
    snapStartPositionRef.current.copy(groupRef.current.position);
    snapStartQuaternionRef.current.copy(rotationRef.current.quaternion);
    snapStartedAtRef.current = performance.now();
    snapProgressRef.current = 0;
    snapDurationRef.current = THREE.MathUtils.clamp(
      MAGNETIC_SNAP_MIN_DURATION_MS + distance * 28,
      MAGNETIC_SNAP_MIN_DURATION_MS,
      MAGNETIC_SNAP_MAX_DURATION_MS
    );
    snapArcHeightRef.current = THREE.MathUtils.clamp(
      Math.max(modelRadius * 0.16, distance * 0.06),
      0.18,
      1.8
    );

    grabbingRef.current = false;
    magnetStateRef.current = "Magnetic capture";
    onDragStateChange(false);
    document.body.style.cursor = "default";
    setPhaseSafely("snapping");
    onInteractionMessage(
      `Magnetic field captured ${COMPONENT_LABELS[part.key]}. Seating it now…`
    );
  }, [
    modelRadius,
    onDragStateChange,
    onInteractionMessage,
    part.key,
    setPhaseSafely,
    targetPosition,
  ]);

  const releaseComponent = useCallback(() => {
    if (!grabbingRef.current || !groupRef.current || !targetPosition) return;

    grabbingRef.current = false;
    onDragStateChange(false);
    document.body.style.cursor = "default";

    const centers = getVisualCenters();
    if (!centers) return;

    const distanceToTarget = Math.hypot(
      centers.currentLocal.x - centers.targetLocal.x,
      centers.currentLocal.z - centers.targetLocal.z
    );

    const easyReleaseDistance = Math.max(
      magnetDistance * MAGNETIC_CAPTURE_RATIO,
      autoSnapDistance * RELEASE_SNAP_MULTIPLIER,
      snapDistance * 2.15
    );
    const routeCaptureDistance = Math.max(
      magnetDistance,
      initialDistanceRef.current * MAGNETIC_ROUTE_CAPTURE_RATIO
    );
    const currentTableField = getMagneticFieldInfo(groupRef.current.position);
    const pointerTableField = getMagneticFieldInfo(
      desiredGroupLocalRef.current
    );
    const tableFieldStrength = Math.max(
      currentTableField.strength,
      pointerTableField.strength
    );

    if (
      currentTableField.inside ||
      pointerTableField.inside ||
      tableFieldStrength >= MAGNETIC_FIELD_EDGE_CAPTURE_STRENGTH ||
      distanceToTarget <= routeCaptureDistance ||
      distanceToTarget <= easyReleaseDistance
    ) {
      seatComponent();
      return;
    }

    const pointerTravel = Math.hypot(
      pointerClientRef.current.x - grabPointerStartRef.current.x,
      pointerClientRef.current.y - grabPointerStartRef.current.y
    );

    if (pointerTravel < MAGNETIC_FIELD_MIN_POINTER_TRAVEL_PX) {
      setPhaseSafely("released");
      magnetStateRef.current = "Released without placement attempt";
      onInteractionMessage(
        `${COMPONENT_LABELS[part.key]} was released without a meaningful drag. No placement error was recorded.`
      );
      publishTelemetry();
      return;
    }

    const nextFumbleCount = fumbleCountRef.current + 1;
    fumbleCountRef.current = nextFumbleCount;
    onFumble?.(part.key, { attempt: nextFumbleCount });

    setPhaseSafely("released");
    magnetStateRef.current = "Move toward table field";
    onInteractionMessage(
      `${COMPONENT_LABELS[part.key]} was released before the magnetic workspace. Move it into the open table area; the field will pull it to the exact highlighted seat automatically.`
    );
    publishTelemetry();
  }, [
    autoSnapDistance,
    getVisualCenters,
    magnetDistance,
    snapDistance,
    onDragStateChange,
    onInteractionMessage,
    part.key,
    publishTelemetry,
    seatComponent,
    setPhaseSafely,
    targetPosition,
  ]);

  useEffect(() => {
    const handlePointerMove = (event) => updateMouse(event);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [updateMouse]);

  useEffect(() => {
    if (phase !== "grabbed") return undefined;

    const handlePointerUp = (event) => {
      if (event.button !== 0) return;
      releaseComponent();
    };

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      releaseComponent();
    };

    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [phase, releaseComponent]);

  useEffect(() => {
    const cancelGrab = () => {
      if (!grabbingRef.current) return;
      grabbingRef.current = false;
      onDragStateChange(false);
      document.body.style.cursor = "default";
      setPhaseSafely("released");
      publishTelemetry();
    };

    window.addEventListener("blur", cancelGrab);
    window.addEventListener("pointercancel", cancelGrab);
    return () => {
      window.removeEventListener("blur", cancelGrab);
      window.removeEventListener("pointercancel", cancelGrab);
      if (grabbingRef.current) onDragStateChange(false);
      document.body.style.cursor = "default";
    };
  }, [onDragStateChange, publishTelemetry, setPhaseSafely]);

  useFrame((_, delta) => {
    if (!groupRef.current || !rotationRef.current) return;

    const safeDelta = Math.min(delta, 0.05);
    const movementAlpha = 1 - Math.exp(-DRAG_FOLLOW_SPEED * safeDelta);
    const rotationAlpha = 1 - Math.exp(-ROTATION_FOLLOW_SPEED * safeDelta);
    const settleAlpha = 1 - Math.exp(-SETTLE_SPEED * safeDelta);

    // CPU, SSD, and both RAM modules remain physically attached to the
    // motherboard until their own stage starts. The motherboard publishes its
    // live rigid transform, and mounted parts inherit it around the exact
    // motherboard model pivot. This prevents them from being left floating in
    // the case while the board is carried to the table.
    const hostTransform = hostTransformRef?.current;
    if (hostTransform && phaseRef.current === "installed" && !isCompleted) {
      hostOffsetRef.current
        .copy(hostTransform.pivot)
        .sub(modelCenter);
      rotatedHostOffsetRef.current
        .copy(hostOffsetRef.current)
        .applyQuaternion(hostTransform.quaternion);
      groupRef.current.position
        .copy(hostTransform.position)
        .add(hostOffsetRef.current)
        .sub(rotatedHostOffsetRef.current);
      rotationRef.current.quaternion.copy(hostTransform.quaternion);
      installedQuaternionRef.current.copy(hostTransform.quaternion);
    }

    const centers = targetPosition ? getVisualCenters() : null;
    const distance = centers
      ? Math.hypot(
          centers.currentLocal.x - centers.targetLocal.x,
          centers.currentLocal.z - centers.targetLocal.z
        )
      : Infinity;
    const proximity = THREE.MathUtils.clamp(
      1 - distance / Math.max(magnetDistance, 0.001),
      0,
      1
    );

    if (phaseRef.current === "snapping" && targetPosition) {
      const elapsed = performance.now() - snapStartedAtRef.current;
      const rawProgress = THREE.MathUtils.clamp(
        elapsed / Math.max(snapDurationRef.current, 1),
        0,
        1
      );
      snapProgressRef.current = rawProgress;
      // Visible magnetic motion: ease in, accelerate through the pull,
      // then ease out while position and rotation settle together.
      const easedProgress = THREE.MathUtils.smootherstep(rawProgress, 0, 1);
      const rotationProgress = easedProgress;

      groupRef.current.position.lerpVectors(
        snapStartPositionRef.current,
        targetPosition,
        easedProgress
      );
      groupRef.current.position.y +=
        Math.sin(rawProgress * Math.PI) * snapArcHeightRef.current;
      rotationRef.current.quaternion.slerpQuaternions(
        snapStartQuaternionRef.current,
        detachedQuaternion,
        rotationProgress
      );
      magnetStateRef.current = `Seating ${Math.round(rawProgress * 100)}%`;

      if (rawProgress >= 1) {
        finishSeatComponent();
      }
    } else if (grabbingRef.current) {
      const pointerDeltaX =
        pointerClientRef.current.x - grabPointerStartRef.current.x;
      const pointerDeltaY =
        pointerClientRef.current.y - grabPointerStartRef.current.y;
      const pointerTravelPx = Math.hypot(pointerDeltaX, pointerDeltaY);
      const dragScale = worldUnitsPerPixelRef.current * DRAG_SCREEN_GAIN;

      desiredCenterWorldRef.current
        .copy(dragStartWorldRef.current)
        .addScaledVector(
          dragRightWorldRef.current,
          pointerDeltaX * dragScale
        )
        .addScaledVector(
          dragUpWorldRef.current,
          -pointerDeltaY * dragScale
        );

      desiredCenterLocalRef.current.copy(desiredCenterWorldRef.current);
      const parent = groupRef.current.parent;
      if (parent) parent.worldToLocal(desiredCenterLocalRef.current);

      desiredGroupLocalRef.current
        .copy(desiredCenterLocalRef.current)
        .sub(modelCenter);

      // Keep dragging inside a generous corridor between the installed part
      // and its target. This prevents accidental pointer excursions from
      // throwing a component far outside the visible work area.
      const workspacePadding = Math.max(
        magnetDistance * WORKSPACE_PADDING_MULTIPLIER,
        modelRadius * 2.4,
        4
      );
      desiredGroupLocalRef.current.x = THREE.MathUtils.clamp(
        desiredGroupLocalRef.current.x,
        Math.min(dragStartGroupLocalRef.current.x, targetPosition.x) - workspacePadding,
        Math.max(dragStartGroupLocalRef.current.x, targetPosition.x) + workspacePadding
      );
      desiredGroupLocalRef.current.z = THREE.MathUtils.clamp(
        desiredGroupLocalRef.current.z,
        Math.min(dragStartGroupLocalRef.current.z, targetPosition.z) - workspacePadding,
        Math.max(dragStartGroupLocalRef.current.z, targetPosition.z) + workspacePadding
      );

      const desiredDistance = Math.hypot(
        desiredGroupLocalRef.current.x - targetPosition.x,
        desiredGroupLocalRef.current.z - targetPosition.z
      );

      const routeDistance = Math.max(initialDistanceRef.current, 0.001);
      const routeProgress = THREE.MathUtils.clamp(
        1 - desiredDistance / routeDistance,
        0,
        1
      );

      let safeRouteY = safeCarryYRef.current;
      if (routeProgress < SAFE_CARRY_RISE_START) {
        const riseProgress = THREE.MathUtils.smoothstep(
          routeProgress,
          0,
          SAFE_CARRY_RISE_START
        );
        safeRouteY = THREE.MathUtils.lerp(
          grabStartYRef.current,
          safeCarryYRef.current,
          riseProgress
        );
      } else if (routeProgress >= SAFE_CARRY_DESCENT_START) {
        const descentProgress = THREE.MathUtils.smoothstep(
          routeProgress,
          SAFE_CARRY_DESCENT_START,
          1
        );
        safeRouteY = THREE.MathUtils.lerp(
          safeCarryYRef.current,
          targetPosition.y,
          descentProgress
        );
      }

      const landingDistance = Math.max(
        magnetDistance * LANDING_ZONE_RATIO,
        autoSnapDistance * 2.2
      );
      if (desiredDistance < landingDistance) {
        const landingProgress = THREE.MathUtils.smoothstep(
          1 - desiredDistance / Math.max(landingDistance, 0.001),
          0,
          1
        );
        safeRouteY = THREE.MathUtils.lerp(
          safeRouteY,
          targetPosition.y,
          landingProgress
        );
      }

      const ySpeed =
        desiredDistance < landingDistance
          ? SAFE_CARRY_Y_SPEED * 1.7
          : SAFE_CARRY_Y_SPEED;
      const safeYAlpha = 1 - Math.exp(-ySpeed * safeDelta);
      dragCurrentYRef.current = THREE.MathUtils.lerp(
        dragCurrentYRef.current,
        safeRouteY,
        safeYAlpha
      );
      desiredGroupLocalRef.current.y = dragCurrentYRef.current;

      assistedGoalRef.current.copy(desiredGroupLocalRef.current);

      const tableField = getMagneticFieldInfo(desiredGroupLocalRef.current);
      const routeCaptureDistance = Math.max(
        magnetDistance,
        initialDistanceRef.current * MAGNETIC_ROUTE_CAPTURE_RATIO
      );
      const routeFieldStrength = THREE.MathUtils.clamp(
        1 - desiredDistance / Math.max(routeCaptureDistance, 0.001),
        0,
        1
      );
      const seatFieldStrength = THREE.MathUtils.clamp(
        1 - desiredDistance / Math.max(magnetDistance, 0.001),
        0,
        1
      );
      const activeFieldStrength = Math.max(
        tableField.strength,
        routeFieldStrength,
        seatFieldStrength
      );

      if (activeFieldStrength > 0) {
        const easedFieldStrength = THREE.MathUtils.smootherstep(
          activeFieldStrength,
          0,
          1
        );
        const pull = THREE.MathUtils.lerp(
          MAGNETIC_FIELD_MIN_PULL,
          MAGNETIC_FIELD_MAX_PULL,
          easedFieldStrength
        );

        assistedGoalRef.current.lerp(targetPosition, pull);
        magnetStateRef.current =
          tableField.inside || desiredDistance <= routeCaptureDistance
            ? "Table field captured"
            : "Table field pulling";

        if (!magnetNoticeRef.current && activeFieldStrength > 0.1) {
          magnetNoticeRef.current = true;
          onInteractionMessage(
            `Magnetic field engaged for ${COMPONENT_LABELS[part.key]}. It is now pulling toward the exact seat.`
          );
        }
      } else {
        magnetStateRef.current = "Move toward table field";
        magnetNoticeRef.current = false;
      }

      groupRef.current.position.lerp(assistedGoalRef.current, movementAlpha);

      const currentDistance = Math.hypot(
        groupRef.current.position.x - targetPosition.x,
        groupRef.current.position.z - targetPosition.z
      );

      const extractionDistance = centers
        ? centers.currentWorld.distanceTo(dragStartWorldRef.current)
        : 0;
      const extractionProgress = THREE.MathUtils.clamp(
        extractionDistance / Math.max(modelRadius * 1.3, 1.25),
        0,
        1
      );
      const orientationBlend = Math.max(
        extractionProgress,
        proximity
      );

      desiredQuaternionRef.current
        .copy(installedQuaternionRef.current)
        .slerp(detachedQuaternion, orientationBlend);
      rotationRef.current.quaternion.slerp(
        desiredQuaternionRef.current,
        rotationAlpha
      );

      const easySeatDistance = Math.min(
        magnetDistance * EASY_SEAT_MAGNET_RATIO,
        Math.max(snapDistance * 1.9, autoSnapDistance * 1.32)
      );
      const pointerInsideSnap = desiredDistance <= easySeatDistance;
      const partInsideSnap = currentDistance <= easySeatDistance;
      const laggingButCentered =
        pointerInsideSnap && currentDistance <= easySeatDistance * 1.85;
      const enteredTableField =
        (tableField.inside || desiredDistance <= routeCaptureDistance) &&
        pointerTravelPx >= MAGNETIC_FIELD_MIN_POINTER_TRAVEL_PX;

      if (enteredTableField || partInsideSnap || laggingButCentered) {
        magnetStateRef.current = enteredTableField
          ? "Table field auto-capture"
          : "Auto snap";
        seatComponent();
        return;
      }
    } else if (phaseRef.current === "placed" && targetPosition) {
      groupRef.current.position.lerp(targetPosition, settleAlpha);
      groupRef.current.position.y = targetPosition.y;
      rotationRef.current.quaternion.slerp(detachedQuaternion, settleAlpha);
    } else if (phaseRef.current === "released" && targetPosition) {
      // Keep the field alive after pointer release. If the component was
      // dropped anywhere inside the magnetic radius, it continues travelling
      // toward the seat instead of freezing in mid-air.
      const releasedPlanarDistance = Math.hypot(
        groupRef.current.position.x - targetPosition.x,
        groupRef.current.position.z - targetPosition.z
      );
      const releasedFieldRadius = Math.max(
        magnetDistance * MAGNETIC_CAPTURE_RATIO,
        initialDistanceRef.current * MAGNETIC_ROUTE_CAPTURE_RATIO
      );
      const releasedTableField = getMagneticFieldInfo(
        groupRef.current.position
      );
      const releasedRouteStrength = THREE.MathUtils.clamp(
        1 - releasedPlanarDistance / Math.max(releasedFieldRadius, 0.001),
        0,
        1
      );
      const releasedFieldStrength = Math.max(
        releasedTableField.strength,
        releasedRouteStrength
      );

      if (releasedFieldStrength > 0) {
        const releasedPull = THREE.MathUtils.smootherstep(
          releasedFieldStrength,
          0,
          1
        );
        const releasedMoveAlpha =
          1 -
          Math.exp(
            -(
              RELEASED_MAGNET_SPEED +
              releasedPull * RELEASED_MAGNET_SPEED
            ) * safeDelta
          );
        const releasedRotationAlpha =
          1 - Math.exp(-RELEASED_ROTATION_SPEED * safeDelta);

        groupRef.current.position.lerp(targetPosition, releasedMoveAlpha);
        rotationRef.current.quaternion.slerp(
          detachedQuaternion,
          releasedRotationAlpha
        );
        dragCurrentYRef.current = groupRef.current.position.y;
        magnetStateRef.current = releasedTableField.inside
          ? "Table field captured"
          : releasedPlanarDistance <= autoSnapDistance * 1.5
          ? "Auto snap"
          : "Magnetic pull";

        const releasedSnapDistance = Math.max(
          autoSnapDistance * 1.35,
          snapDistance * 2.2,
          magnetDistance * 0.16
        );
        if (
          releasedTableField.inside ||
          releasedPlanarDistance <= releasedSnapDistance
        ) {
          seatComponent();
          return;
        }
      } else {
        dragCurrentYRef.current = groupRef.current.position.y;
        rotationRef.current.quaternion.slerp(
          detachedQuaternion,
          rotationAlpha
        );
        magnetStateRef.current = "Move closer";
      }
    } else {
      // Installed and newly detached components keep the authored installed
      // orientation. Rotation begins only after the part has visibly cleared
      // its slot, avoiding geometry passing through the case.
      rotationRef.current.quaternion.slerp(
        installedQuaternionRef.current,
        rotationAlpha
      );
    }

    onTransformChange?.({
      position: groupRef.current.position,
      quaternion: rotationRef.current.quaternion,
      pivot: modelCenter,
      phase: phaseRef.current,
    });

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

      // A populated motherboard and its mounted components overlap in the
      // raycast. Pass-through parts must never stop the event: while the board
      // is being removed, its locked children pass clicks to the motherboard;
      // after the board is seated, the completed motherboard passes clicks to
      // the active CPU, SSD, or RAM module above it.
      if (allowPointerThrough) return;

      event.stopPropagation();

      if (!canInteract) {
        onLockedPartClick(part.key);
        return;
      }

      if (phaseRef.current === "installed") {
        // One continuous gesture now works: pointer-down detaches the part and
        // immediately starts the grab. A simple click still leaves it safely
        // detached when the pointer is released.
        detachComponent();
        beginGrab(event);
        return;
      }

      if (
        phaseRef.current === "detached" ||
        phaseRef.current === "released"
      ) {
        beginGrab(event);
        return;
      }

      if (phaseRef.current === "placed") {
        onInteractionMessage(
          `${COMPONENT_LABELS[part.key]} is already seated on the table.`
        );
      }
    },
    [
      allowPointerThrough,
      beginGrab,
      canInteract,
      detachComponent,
      isMovablePart,
      onInteractionMessage,
      onLockedPartClick,
      part.key,
      testActive,
    ]
  );

  const handlePointerOver = useCallback(
    (event) => {
      if (!isMovablePart || allowPointerThrough) return;
      event.stopPropagation();

      if (!canInteract) {
        document.body.style.cursor = "not-allowed";
      } else if (phaseRef.current === "installed") {
        document.body.style.cursor = "pointer";
      } else if (phaseRef.current === "placed") {
        document.body.style.cursor = "default";
      } else {
        document.body.style.cursor = "grab";
      }
    },
    [allowPointerThrough, canInteract, isMovablePart]
  );

  const handlePointerOut = useCallback(() => {
    if (!grabbingRef.current) document.body.style.cursor = "default";
  }, []);

  return (
    <>
      <group
        ref={groupRef}
        onPointerDown={handlePointerDown}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <group position={[modelCenter.x, modelCenter.y, modelCenter.z]}>
          <group ref={rotationRef}>
            {isMovablePart ? (
              <mesh>
                <boxGeometry
                  args={[
                    Math.max(modelSize.x * 1.12, 0.35),
                    Math.max(modelSize.y * 1.18, 0.35),
                    Math.max(modelSize.z * 1.12, 0.35),
                  ]}
                />
                <meshBasicMaterial
                  transparent
                  opacity={0}
                  depthWrite={false}
                  colorWrite={false}
                />
              </mesh>
            ) : null}
            <group position={[-modelCenter.x, -modelCenter.y, -modelCenter.z]}>
              <primitive object={clonedScene} dispose={null} />
            </group>
          </group>
        </group>
      </group>
    </>
  );
}

function Loader() {
  return (
    <Html center>
      <div className="rounded-xl border border-[#1a2438] bg-[#0b1220]/90 px-4 py-2 text-xs font-semibold text-[#FFD41C]">
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
    console.error("Failed to load one or more 3D models:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <Html center>
          <div className="max-w-[280px] rounded-xl border border-red-400/30 bg-[#0b1220]/95 px-4 py-3 text-center text-[11px] font-semibold leading-5 text-red-300">
            Couldn't load one of the 3D models.
            <br />
            Check these files exist in /public/models:
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

function AssembledPC({
  parts,
  completedParts,
  reachableKeys,
  testActive,
  onPartCompleted,
  onInvalidClick,
  onFumble,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
  rootRef,
}) {
  const motherboardTransformRef = useRef({
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    pivot: new THREE.Vector3(),
    phase: "installed",
  });

  const handleMotherboardTransform = useCallback((transform) => {
    motherboardTransformRef.current.position.copy(transform.position);
    motherboardTransformRef.current.quaternion.copy(transform.quaternion);
    motherboardTransformRef.current.pivot.copy(transform.pivot);
    motherboardTransformRef.current.phase = transform.phase;
  }, []);

  const motherboardIsActive = testActive && reachableKeys.has("motherboard");
  const motherboardIsCompleted = completedParts.includes("motherboard");
  const mountedPartIsActive = [...reachableKeys].some((key) =>
    MOTHERBOARD_MOUNTED_PARTS.has(key)
  );

  return (
    <group ref={rootRef}>
      {parts.map((part) => (
        <PartModel
          key={part.key}
          part={part}
          isActive={testActive && reachableKeys.has(part.key)}
          isCompleted={completedParts.includes(part.key)}
          testActive={testActive}
          hostTransformRef={
            MOTHERBOARD_MOUNTED_PARTS.has(part.key)
              ? motherboardTransformRef
              : undefined
          }
          onTransformChange={
            part.key === "motherboard" ? handleMotherboardTransform : undefined
          }
          allowPointerThrough={
            (motherboardIsActive && MOTHERBOARD_MOUNTED_PARTS.has(part.key)) ||
            (part.key === "motherboard" &&
              motherboardIsCompleted &&
              mountedPartIsActive)
          }
          onPartCompleted={onPartCompleted}
          onLockedPartClick={onInvalidClick}
          onFumble={onFumble}
          onInteractionMessage={onInteractionMessage}
          onDragStateChange={onDragStateChange}
          onTelemetry={onTelemetry}
        />
      ))}
    </group>
  );
}

function InitialSceneCamera({ sceneRootRef, controlsRef, overviewRequest }) {
  const { camera, size } = useThree();
  const initializedRef = useRef(false);
  const handledOverviewRequestRef = useRef(-1);

  useEffect(() => {
    const isInitialSetup = !initializedRef.current;
    const isNewOverviewRequest = overviewRequest !== handledOverviewRequestRef.current;
    if (!isInitialSetup && !isNewOverviewRequest) return undefined;

    let frameId = 0;
    let attempts = 0;

    const initialize = () => {
      const root = sceneRootRef.current;
      const controls = controlsRef.current;

      if (!root || !controls) {
        attempts += 1;
        if (attempts < 45) frameId = requestAnimationFrame(initialize);
        return;
      }

      root.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(root);
      if (box.isEmpty()) {
        attempts += 1;
        if (attempts < 45) frameId = requestAnimationFrame(initialize);
        return;
      }

      const center = box.getCenter(new THREE.Vector3());
      const sceneSize = box.getSize(new THREE.Vector3());
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(size.width / size.height, 0.5));
      const verticalDistance = (sceneSize.y * 0.58) / Math.max(Math.tan(verticalFov / 2), 0.2);
      const horizontalDistance = (sceneSize.x * 0.58) / Math.max(Math.tan(horizontalFov / 2), 0.2);
      const depthDistance = sceneSize.z * 0.72;
      const distance = Math.max(verticalDistance, horizontalDistance, depthDistance, 8);

      const direction = new THREE.Vector3(...EASY_DRAG_CAMERA_DIRECTION).normalize();
      const target = center.clone();
      target.y += sceneSize.y * 0.015;

      camera.position.copy(target).addScaledVector(direction, distance * OVERVIEW_CAMERA_DISTANCE_MULTIPLIER);
      camera.near = Math.max(0.01, distance / 500);
      camera.far = Math.max(1000, distance * 20);
      camera.updateProjectionMatrix();

      controls.target.copy(target);
      camera.lookAt(target);
      controls.update();
      initializedRef.current = true;
      handledOverviewRequestRef.current = overviewRequest;
    };

    frameId = requestAnimationFrame(initialize);
    return () => cancelAnimationFrame(frameId);
  }, [camera, controlsRef, overviewRequest, sceneRootRef, size.height, size.width]);

  return null;
}

function ModelViewer({
  parts,
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

  useEffect(() => {
    const restoreControls = () => setIsDraggingPart(false);
    window.addEventListener("pointercancel", restoreControls);
    window.addEventListener("blur", restoreControls);
    return () => {
      window.removeEventListener("pointercancel", restoreControls);
      window.removeEventListener("blur", restoreControls);
    };
  }, []);

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
        camera={{ position: [24, 18, 110], fov: 44, near: 0.01, far: 2000 }}
        dpr={[1, 1.5]}
        shadows
        performance={{ min: 0.55 }}
        className="h-full w-full"
        gl={{ antialias: true, powerPreference: "high-performance", alpha: false, stencil: false }}
        style={{ touchAction: "none" }}
      >
        <color attach="background" args={[typeof document !== "undefined" && document.documentElement.classList.contains("articton-light") ? "#f8f9ff" : "#070c14"]} />
        <hemisphereLight args={["#ffffff", "#182338", 1.15]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 10, 7]} intensity={1.75} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <directionalLight position={[-5, 4, 2]} intensity={0.68} />

        <ModelErrorBoundary parts={parts}>
          <Suspense fallback={<Loader />}>
            <AssembledPC
              rootRef={sceneRootRef}
              parts={parts}
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

        <InitialSceneCamera sceneRootRef={sceneRootRef} controlsRef={controlsRef} overviewRequest={overviewRequest} />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!isDraggingPart}
          enablePan={false}
          enableZoom
          zoomSpeed={0.46}
          zoomToCursor
          enableDamping
          dampingFactor={0.1}
          minPolarAngle={0.16}
          maxPolarAngle={Math.PI * 0.49}
          minDistance={8}
          maxDistance={260}
          mouseButtons={{ LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        />
      </Canvas>

      <div className="absolute left-4 top-4 z-[80] flex max-w-[calc(100%-180px)] flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOverviewRequest((value) => value + 1)}
          disabled={isDraggingPart}
          className="rounded-xl border border-[#FFD41C]/30 bg-[#FFD41C]/12 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7dffdc] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-[#FFD41C]/20 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Reset Camera View
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          disabled={isDraggingPart}
          aria-pressed={isFullscreen}
          className="rounded-xl border border-[#FFD41C]/30 bg-[#0b1220]/92 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7dffdc] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-[#FFD41C]/12 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isFullscreen ? "Exit Full Screen" : "Full Screen"}
        </button>
      </div>


    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header / background (visual chrome kept consistent with modules)    */
/* ------------------------------------------------------------------ */

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
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#FFD41C]/25 bg-[#FFD41C]/10 text-sm font-bold uppercase text-[#FFD41C]">
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
      <div className="pointer-events-none absolute -left-44 -top-44 h-[720px] w-[720px] rounded-full bg-[#FFD41C]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 -right-52 h-[820px] w-[820px] rounded-full bg-[#FFD41C]/6 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a0e17] via-[#0a0e17] to-[#0d1220]" />
    </>
  );
}

/* Free-order checklist sidebar — shows every required part as a card the
   learner can tap to check off mentally, but selecting one does NOT
   choose it for them; it only scrolls/highlights for reference. Progress
   is driven entirely by what has actually been removed in the 3D scene. */
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
              <div className="text-[11px] text-[#7a8ba8]">AMD Platform</div>
            </div>
          ) : null}
          <button type="button" onClick={onToggle} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1a2438] bg-white/[0.03] text-[#dbe6f5] transition hover:bg-white/[0.06]">
            {open ? "<" : ">"}
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 pr-2 [scrollbar-color:rgba(255,212,28,0.35)_rgba(255,255,255,0.05)] [scrollbar-width:thin]">
          {(checklistOrder || REMOVAL_SEQUENCE).map((key, index) => {
            const done = completedParts.includes(key);
            return (
              <div key={key} className={["flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition", done ? "border-[#FFD41C]/25 bg-[#FFD41C]/10" : "border-[#1a2438] bg-white/[0.03]"].join(" ")}>
                <span className={["flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition", done ? "bg-[#FFD41C] text-[#0a0e17]" : "border border-[#1a2438] bg-[#0d1220] text-[#7a8ba8]"].join(" ")}>{index + 1}</span>
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
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[30px] border border-[#FFD41C]/30 bg-[#0b1220]/96 p-7 shadow-[0_40px_120px_rgba(0,0,0,0.7)] md:p-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,212,28,0.13),transparent_42%)]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ff9f7d]/30 bg-[#ff9f7d]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#ff9f7d]">
            Practical Test • AMD Platform
          </div>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-white md:text-4xl">
            Full Disassembly — Practical Test
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#9fb0ca]">
            No visual hints this time. Remove all eight components and place each one in its correct bench
            position, in any order that makes physical sense. Your accuracy, order judgment, and time are
            scored.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD41C]">No Guides</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">
                No highlighted parts or target ghosts. Rely on what you know.
              </div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD41C]">Free Order</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">
                Pick any component that is realistically accessible right now.
              </div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD41C]">Scored</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">
                Confirmed sequence errors and failed placement attempts cost points.
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-[#7a8ba8]">
              Left click grabs/releases • right-drag rotates • wheel zooms
            </div>
            <button
              type="button"
              onClick={onStart}
              className="rounded-2xl bg-[#FFD41C] px-7 py-3 text-sm font-black text-[#07111d] shadow-[0_16px_45px_rgba(255,212,28,0.25)] transition hover:scale-[1.03]"
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
    <div
      className="absolute inset-0 z-[780] flex items-center justify-center bg-[#050912]/86 p-5 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[30px] border border-[#FFD41C]/35 bg-[#0b1220]/97 p-7 shadow-[0_40px_120px_rgba(0,0,0,0.76),0_0_70px_rgba(255,212,28,0.10)] md:p-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,212,28,0.16),transparent_42%)]" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD41C]/30 bg-[#FFD41C]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#73ffd4]">
            Test Complete • AMD Full Disassembly
          </div>

          <div className="mt-6 flex items-center gap-6">
            <div
              className={[
                "flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 text-4xl font-black shadow-[0_0_34px_rgba(255,212,28,0.18)]",
                isPass ? "border-[#FFD41C]/50 bg-[#FFD41C]/10 text-[#FFD41C]" : "border-[#ff7d7d]/50 bg-[#ff7d7d]/10 text-[#ff9f9f]",
              ].join(" ")}
            >
              {grade.letter}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#FFD41C]">{grade.tone}</div>
              <h2 className="mt-2 text-3xl font-black leading-tight text-white">{result.score} / 100</h2>
              <p className="mt-2 text-sm leading-6 text-[#9fb0ca]">
                {isPass
                  ? "You met the disassembly standard without any step-by-step guidance."
                  : "Below the passing threshold. Review the module and try the test again."}
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.035] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFD41C]">Time</div>
              <div className="mt-2 text-sm font-bold text-white">{formatDuration(result.elapsedSeconds)}</div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.035] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFD41C]">Parts Removed</div>
              <div className="mt-2 text-sm font-bold text-white">{result.partsCompleted} / {REMOVAL_SEQUENCE.length}</div>
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

          <div className="mt-7 rounded-2xl border border-[#FFD41C]/18 bg-[#FFD41C]/6 px-4 py-3 text-xs leading-6 text-[#b7c6dd]">
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
              className="rounded-2xl bg-[#FFD41C] px-6 py-3 text-sm font-black text-[#07111d] shadow-[0_16px_45px_rgba(255,212,28,0.18)] transition hover:scale-[1.02]"
            >
              Retry Test →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export default function AMDFullDisassemblyPracticalTest({ onFinish, onBack }) {
  const [sceneRevision, setSceneRevision] = useState(0);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [testActive, setTestActive] = useState(false);
  const [completedParts, setCompletedParts] = useState([]);
  const checklistOrder = REMOVAL_SEQUENCE;
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
    "No hints are active. Click any exposed component to begin removing it."
  );
  const [settings, setSettings] = useState(getUserSettings);

  const reachableKeys = useMemo(() => {
    const reachable = new Set();
    REMOVAL_SEQUENCE.forEach((key) => {
      if (completedParts.includes(key)) return;
      const prerequisites = PREREQUISITES[key] || [];
      const satisfied = prerequisites.every((prereq) => completedParts.includes(prereq));
      if (satisfied) reachable.add(key);
    });
    return reachable;
  }, [completedParts]);

  const allComponentsRemoved = completedParts.length === REMOVAL_SEQUENCE.length;

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
    setValidationMessage("No hints are active. Click any exposed component to begin removing it.");
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
        console.error("Error fetching AMD full disassembly profile:", error);
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
              amdDisassembly: {
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
        const achievement = await unlockAchievement(firebaseUser.uid, "amdDisassembly", { score: finalResult.score });
        setAchievementToast(achievement);
        window.setTimeout(() => setAchievementToast(null), 4200);
      } catch (error) {
        console.error("Error saving AMD Disassembly Practical Test result:", error);
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
      setValidationMessage(`${COMPONENT_LABELS[partKey]} removed and placed correctly.`);

      if (nextCompletedParts.length === REMOVAL_SEQUENCE.length) {
        finishTest(nextCompletedParts);
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
        `${COMPONENT_LABELS[partKey]} is not accessible yet — a prerequisite component must be completed first. (Sequence error ${nextCount}: -${PENALTY_WRONG_ORDER_CLICK} points.)`
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
    <div className="articton-app-shell articton-practice-page absolute inset-0 h-full w-full overflow-hidden bg-[#0a0e17] font-sans text-[#e8ecf4] antialiased">
      <div className="relative h-full w-full overflow-hidden">
        <ModuleBackground />
        <AchievementToast achievement={achievementToast} onClose={() => setAchievementToast(null)} />

        {showIntro ? <TestIntroCard onStart={handleStartTest} /> : null}
        {result ? (
          <ResultsCard result={result} onRetry={resetTest} onBackToDashboard={handleBackToDashboard} />
        ) : null}

        <div className="relative flex h-full w-full flex-col overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,212,28,0.08),transparent_35%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_20%,rgba(255,159,125,0.05),transparent_30%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,212,28,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,212,28,0.025)_1px,transparent_1px)] bg-[size:54px_54px] opacity-55" />

          <div className="relative flex h-full w-full flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 text-[12px] text-[#7a8ba8] md:px-10">
              <div>
                Practical Test — <span className="text-[#dbe6f5]">Full Disassembly (AMD)</span>
              </div>
              <div className="rounded-lg border border-[#ff9f7d]/30 bg-[#ff9f7d]/8 px-2 py-1 text-[11px] font-bold text-[#ff9f7d]">Scored Practical</div>
            </div>

            <div className="relative z-[120] mt-3 px-6 md:px-10">
              <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-[22px] border border-[#1a2438] bg-[#0b1220]/86 px-6 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.30)] backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <img src="/PNG/Articton.png" alt="Articton Logo" className="h-10 w-10 scale-300 object-contain ml-4" />
                  <div>
                    <div className="text-base font-bold tracking-wide text-white">Articton</div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-[#ff9f7d]">AMD Practical Test</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  {validationMessage ? (
                    <div className="max-w-[520px] rounded-2xl border border-[#FFD41C]/20 bg-[#FFD41C]/8 px-4 py-2 text-xs font-semibold text-[#dffef5]">
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
                  <div className="text-sm font-semibold text-white">Free-order removal — no visual guides</div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[#7a8ba8]">
                    Click a part to detach • grab and carry it to its bench spot • click again to release
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold">
                  <span className="text-[#FFD41C]">{completedParts.length} / {REMOVAL_SEQUENCE.length} removed</span>
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
                  className="absolute top-3 bottom-3 right-3 z-[40] overflow-hidden rounded-[18px] border border-[#1a2438] bg-black/20 transition-all duration-300 md:top-4 md:bottom-4 md:right-4"
                  style={{ left: sidebarOpen ? "clamp(220px, 22vw, 280px)" : 64 }}
                >
                  <ModelViewer
                    key={sceneRevision}
                    parts={PART_MODELS}
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

            <div className="flex justify-center items-center gap-4 border-t border-[#1a2438] px-6 pb-6 pt-4">
              <div className="text-center text-xs text-[#7a8ba8]">
                Left click interacts with components • right drag rotates the camera • mouse wheel zooms
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.45)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Preload the AMD table and every component model up front */
PART_MODELS.forEach((part) => useGLTF.preload(encodeURI(part.path)));


