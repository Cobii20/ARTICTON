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
/* INTEL FULL DISASSEMBLY — PRACTICAL TEST                            */
/* ------------------------------------------------------------------ */
/* Differences from the guided Module 2:                              */
/*   - No fixed step order. Any exposed/removable part may be grabbed */
/*     at any time (free order), as long as it is "reachable" given   */
/*     what has already been removed (a GPU cannot be lifted out from */
/*     underneath an installed HDD bay if that is physically nested,  */
/*     mirrored below in REACHABILITY).                               */
/*   - No amber X-ray "click me" highlight, no green ghost target,    */
/*     no pulsing capture ring, no floating callout label. Only a     */
/*     neutral cursor change on hover.                                */
/*   - Every interaction is scored: wrong-order attempts and repeated */
/*     fumbled releases count against the final grade.                */
/*   - A results screen replaces the certificate, showing a grade,    */
/*     total time, and a breakdown of mistakes.                       */
/* ================================================================== */

const REMOVAL_SEQUENCE = ["gpu", "ssd", "hdd", "ram1", "ram2", "cpu", "psu", "motherboard"];

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

/* Real disassembly order is not arbitrary: the motherboard cannot be
   pulled while the CPU/RAM/other parts sit on top of it in this rig, and
   the case fans/shroud mean the GPU should realistically come out before
   the drives are disturbed. This map defines which parts must ALREADY be
   removed before a given part becomes a valid (non-mistake) target. It is
   intentionally permissive — several valid real-world orders exist — but
   it stops nonsensical sequences like removing the motherboard first. */
const PREREQUISITES = Object.freeze({
  gpu: [],
  ssd: [],
  hdd: [],
  ram1: [],
  ram2: [],
  cpu: [],
  psu: [],
  motherboard: ["cpu", "ram1", "ram2", "ssd", "gpu", "hdd", "psu"],
});

/* Final INTEL table seats — identical physical targets to the guided module,
   since the test still measures whether the learner can physically dock
   each part, just without being told which one to pick next. */
const PLACEMENT_TARGETS = Object.freeze({
  gpu: { position: [-11.387, -6.232, 24.891], snapDistance: 1.5, magnetDistance: 9 },
  ssd: { position: [-5.398, -7.823, 28.806], snapDistance: 1, magnetDistance: 6 },
  hdd: { position: [-10.726, -3.46, 24.501], snapDistance: 1.25, magnetDistance: 7 },
  ram1: { position: [-14.962, -10.105, 22.539], snapDistance: 0.85, magnetDistance: 5 },
  ram2: { position: [-15.606, -10.102, 21.06], snapDistance: 0.85, magnetDistance: 5 },
  cpu: { position: [-12.615, -9.935, 19.679], snapDistance: 0.75, magnetDistance: 4.5 },
  psu: {
    position: [-5.545, -0.965, 19.931],
    snapDistance: 1.6,
    magnetDistance: 9,
    preserveInstalledRotation: true,
  },
  motherboard: { position: [-11.627, -7.507, 13.488], snapDistance: 2, magnetDistance: 11 },
});

const DEFAULT_SNAP_DISTANCE = 1;
const DEFAULT_MAGNET_DISTANCE = 7;
const DEFAULT_MAGNET_STRENGTH = 0.2;
const EARLY_SNAP_MULTIPLIER = 1.55;
const RELEASE_SNAP_MULTIPLIER = 1.35;
const LANDING_ZONE_RATIO = 0.62;
const EASY_SEAT_MAGNET_RATIO = 0.42;
const MAX_LANDING_PULL = 0.58;
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

/* -------------------------- Grading rubric ------------------------- */
/* A fresh test starts at 100. Each mistake type deducts points. The
   deductions are calibrated so a careful first-time user who reads
   component names but has no hand-holding can realistically land a B,
   while a user who genuinely knows the disassembly order and is gentle
   with placements can reach an A without needing pixel-perfect drags. */
const PENALTY_WRONG_ORDER_CLICK = 6; // clicked a part that isn't valid yet
const PENALTY_FUMBLE = 3; // released far from any valid target
const FUMBLE_THRESHOLD_PER_PART = 2; // fumbles allowed before next one penalizes
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
  isReachable,
  isCompleted,
  onPartCompleted,
  onInvalidClick,
  onFumble,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
  testActive,
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
  const grabStartedAtRef = useRef(0);
  const frameCounterRef = useRef(0);
  const initialDistanceRef = useRef(1);
  const fumbleCountRef = useRef(0);

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

  const isMovablePart = MOVABLE_COMPONENT_KEYS.has(part.key);
  const canInteract = isMovablePart && testActive && !isCompleted;
  const placementTarget = PLACEMENT_TARGETS[part.key];

  const targetPosition = useMemo(() => {
    if (!placementTarget?.position) return null;
    return new THREE.Vector3(...placementTarget.position);
  }, [placementTarget]);

  const lockedY = targetPosition?.y ?? null;
  const snapDistance = placementTarget?.snapDistance ?? DEFAULT_SNAP_DISTANCE;
  const magnetDistance = placementTarget?.magnetDistance ?? DEFAULT_MAGNET_DISTANCE;
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

  const installedQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const detachedQuaternion = useMemo(() => {
    if (placementTarget?.preserveInstalledRotation) {
      return installedQuaternion.clone();
    }
    return getAutomaticLayFlatQuaternion(modelSize);
  }, [installedQuaternion, modelSize, placementTarget]);

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

    currentCenterLocalRef.current.copy(groupRef.current.position).add(modelCenter);
    targetCenterLocalRef.current.copy(targetPosition).add(modelCenter);

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
    if (!groupRef.current || !isMovablePart || !targetPosition) return;

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

    onTelemetry?.({
      key: part.key,
      label: COMPONENT_LABELS[part.key] || part.key,
      phase: phaseRef.current,
      distance,
      progress: phaseRef.current === "placed" ? 1 : progress,
    });
  }, [getVisualCenters, isMovablePart, magnetDistance, onTelemetry, part.key, targetPosition]);

  const detachComponent = useCallback(() => {
    if (!testActive || phaseRef.current !== "installed") return;
    setPhaseSafely("detached");
    onInteractionMessage(`${COMPONENT_LABELS[part.key]} detached. Grab it and carry it to its bench position.`);
    requestAnimationFrame(() => publishTelemetry());
  }, [testActive, onInteractionMessage, part.key, publishTelemetry, setPhaseSafely]);

  const beginGrab = useCallback(
    (event) => {
      if (!groupRef.current || !targetPosition) return;
      updateMouse(event);

      const centers = getVisualCenters();
      if (!centers) return;

      dragCurrentYRef.current = groupRef.current.position.y;
      grabStartYRef.current = groupRef.current.position.y;
      const safeClearance = THREE.MathUtils.clamp(
        Math.max(modelSize.y * 0.35, modelRadius * 0.18) + 0.45,
        0.65,
        3.5
      );

      if (phaseRef.current === "detached") {
        safeCarryYRef.current =
          Math.max(grabStartYRef.current, lockedY ?? grabStartYRef.current) + safeClearance;
      } else {
        safeCarryYRef.current = Math.max(
          safeCarryYRef.current,
          grabStartYRef.current,
          lockedY ?? grabStartYRef.current
        );
      }
      dragStartGroupLocalRef.current.copy(groupRef.current.position);
      dragStartWorldRef.current.copy(centers.currentWorld);
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
        .crossVectors(dragPlaneNormalWorldRef.current, dragRightWorldRef.current)
        .normalize();

      if (
        cameraUpWorldRef.current.lengthSq() > 0.000001 &&
        dragUpWorldRef.current.dot(cameraUpWorldRef.current) < 0
      ) {
        dragUpWorldRef.current.negate();
      }

      const rect = gl.domElement.getBoundingClientRect();
      const cameraDistance = Math.max(camera.position.distanceTo(centers.currentWorld), 0.1);

      if (camera.isPerspectiveCamera) {
        const verticalFov = THREE.MathUtils.degToRad(camera.fov);
        worldUnitsPerPixelRef.current =
          (2 * cameraDistance * Math.tan(verticalFov / 2)) / Math.max(rect.height, 1);
      } else if (camera.isOrthographicCamera) {
        worldUnitsPerPixelRef.current =
          Math.abs(camera.top - camera.bottom) / Math.max(camera.zoom * rect.height, 1);
      } else {
        worldUnitsPerPixelRef.current = 0.02;
      }

      grabbingRef.current = true;
      grabStartedAtRef.current = performance.now();
      setPhaseSafely("grabbed");
      onDragStateChange(true);
      document.body.style.cursor = "grabbing";
      onInteractionMessage(`${COMPONENT_LABELS[part.key]} grabbed. Carry it to its bench position and click again to release.`);
      publishTelemetry();
    },
    [
      camera,
      getVisualCenters,
      onDragStateChange,
      onInteractionMessage,
      part.key,
      publishTelemetry,
      setPhaseSafely,
      targetPosition,
      updateMouse,
      lockedY,
      modelRadius,
      modelSize.y,
      gl,
    ]
  );

  const reportCompletion = useCallback(() => {
    if (completionReportedRef.current || isCompleted) return;
    completionReportedRef.current = true;
    onPartCompleted(part.key);
  }, [isCompleted, onPartCompleted, part.key]);

  const seatComponent = useCallback(() => {
    if (!groupRef.current || !targetPosition || phaseRef.current === "placed") return;

    groupRef.current.position.copy(targetPosition);
    dragCurrentYRef.current = targetPosition.y;
    if (rotationRef.current) {
      rotationRef.current.quaternion.copy(detachedQuaternion);
    }

    grabbingRef.current = false;
    onDragStateChange(false);
    document.body.style.cursor = "default";
    setPhaseSafely("placed");
    onInteractionMessage(`${COMPONENT_LABELS[part.key]} placed correctly on the bench.`);
    publishTelemetry();
    reportCompletion();
  }, [
    detachedQuaternion,
    onDragStateChange,
    onInteractionMessage,
    part.key,
    publishTelemetry,
    reportCompletion,
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

    const easyReleaseDistance = Math.min(
      magnetDistance * LANDING_ZONE_RATIO,
      Math.max(autoSnapDistance * RELEASE_SNAP_MULTIPLIER, snapDistance * 2.15)
    );

    if (distanceToTarget <= easyReleaseDistance) {
      seatComponent();
      return;
    }

    fumbleCountRef.current += 1;
    if (fumbleCountRef.current > FUMBLE_THRESHOLD_PER_PART) {
      onFumble(part.key);
    }

    setPhaseSafely("released");
    onInteractionMessage(`${COMPONENT_LABELS[part.key]} released away from its bench position. Grab it again and move it closer.`);
    publishTelemetry();
  }, [
    autoSnapDistance,
    getVisualCenters,
    magnetDistance,
    snapDistance,
    onDragStateChange,
    onFumble,
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

    const handleReleaseClick = (event) => {
      if (event.button !== 0) return;
      if (performance.now() - grabStartedAtRef.current < 120) return;
      if (!gl.domElement.contains(event.target)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      releaseComponent();
    };

    window.addEventListener("pointerdown", handleReleaseClick, true);
    return () => window.removeEventListener("pointerdown", handleReleaseClick, true);
  }, [gl, phase, releaseComponent]);

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

    const centers = targetPosition ? getVisualCenters() : null;
    const distance = centers
      ? Math.hypot(centers.currentLocal.x - centers.targetLocal.x, centers.currentLocal.z - centers.targetLocal.z)
      : Infinity;
    const proximity = THREE.MathUtils.clamp(1 - distance / Math.max(magnetDistance, 0.001), 0, 1);

    if (grabbingRef.current) {
      const pointerDeltaX = pointerClientRef.current.x - grabPointerStartRef.current.x;
      const pointerDeltaY = pointerClientRef.current.y - grabPointerStartRef.current.y;
      const dragScale = worldUnitsPerPixelRef.current * DRAG_SCREEN_GAIN;

      desiredCenterWorldRef.current
        .copy(dragStartWorldRef.current)
        .addScaledVector(dragRightWorldRef.current, pointerDeltaX * dragScale)
        .addScaledVector(dragUpWorldRef.current, -pointerDeltaY * dragScale);

      desiredCenterLocalRef.current.copy(desiredCenterWorldRef.current);
      const parent = groupRef.current.parent;
      if (parent) parent.worldToLocal(desiredCenterLocalRef.current);

      desiredGroupLocalRef.current.copy(desiredCenterLocalRef.current).sub(modelCenter);

      const workspacePadding = Math.max(magnetDistance * WORKSPACE_PADDING_MULTIPLIER, modelRadius * 2.4, 4);
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

      if (lockedY !== null) {
        const routeDistance = Math.max(initialDistanceRef.current, 0.001);
        const routeProgress = THREE.MathUtils.clamp(1 - desiredDistance / routeDistance, 0, 1);

        let safeRouteY = safeCarryYRef.current;
        if (routeProgress < SAFE_CARRY_RISE_START) {
          const riseProgress = THREE.MathUtils.smoothstep(routeProgress, 0, SAFE_CARRY_RISE_START);
          safeRouteY = THREE.MathUtils.lerp(grabStartYRef.current, safeCarryYRef.current, riseProgress);
        } else if (routeProgress >= SAFE_CARRY_DESCENT_START) {
          const descentProgress = THREE.MathUtils.smoothstep(routeProgress, SAFE_CARRY_DESCENT_START, 1);
          safeRouteY = THREE.MathUtils.lerp(safeCarryYRef.current, lockedY, descentProgress);
        }

        const landingDistance = Math.max(magnetDistance * LANDING_ZONE_RATIO, autoSnapDistance * 2.2);
        if (desiredDistance < landingDistance) {
          const landingProgress = THREE.MathUtils.smoothstep(1 - desiredDistance / Math.max(landingDistance, 0.001), 0, 1);
          safeRouteY = THREE.MathUtils.lerp(safeRouteY, lockedY, landingProgress);
        }

        const ySpeed = desiredDistance < landingDistance ? SAFE_CARRY_Y_SPEED * 1.7 : SAFE_CARRY_Y_SPEED;
        const safeYAlpha = 1 - Math.exp(-ySpeed * safeDelta);
        dragCurrentYRef.current = THREE.MathUtils.lerp(dragCurrentYRef.current, safeRouteY, safeYAlpha);
        desiredGroupLocalRef.current.y = dragCurrentYRef.current;
      }

      assistedGoalRef.current.copy(desiredGroupLocalRef.current);

      if (desiredDistance < magnetDistance) {
        const normalizedPull = THREE.MathUtils.clamp(1 - desiredDistance / magnetDistance, 0, 1);
        const easedPull = normalizedPull * normalizedPull * (3 - 2 * normalizedPull);
        const pull = THREE.MathUtils.clamp(
          DEFAULT_MAGNET_STRENGTH + easedPull * 0.38,
          DEFAULT_MAGNET_STRENGTH,
          MAX_LANDING_PULL
        );

        assistedGoalRef.current.lerp(targetPosition, pull);
        if (lockedY !== null) assistedGoalRef.current.y = dragCurrentYRef.current;
      }

      groupRef.current.position.lerp(assistedGoalRef.current, movementAlpha);
      if (lockedY !== null) groupRef.current.position.y = dragCurrentYRef.current;

      const currentDistance = Math.hypot(
        groupRef.current.position.x - targetPosition.x,
        groupRef.current.position.z - targetPosition.z
      );

      const extractionDistance = centers ? centers.currentWorld.distanceTo(dragStartWorldRef.current) : 0;
      const extractionProgress = THREE.MathUtils.clamp(extractionDistance / Math.max(modelRadius * 1.3, 1.25), 0, 1);
      const orientationBlend = Math.max(extractionProgress, proximity);

      desiredQuaternionRef.current.copy(installedQuaternion).slerp(detachedQuaternion, orientationBlend);
      rotationRef.current.quaternion.slerp(desiredQuaternionRef.current, rotationAlpha);

      const easySeatDistance = Math.min(
        magnetDistance * EASY_SEAT_MAGNET_RATIO,
        Math.max(snapDistance * 1.9, autoSnapDistance * 1.32)
      );
      const pointerInsideSnap = desiredDistance <= easySeatDistance;
      const partInsideSnap = currentDistance <= easySeatDistance;
      const laggingButCentered = pointerInsideSnap && currentDistance <= easySeatDistance * 1.85;

      if (partInsideSnap || laggingButCentered) {
        seatComponent();
        return;
      }
    } else if (phaseRef.current === "placed" && targetPosition) {
      groupRef.current.position.lerp(targetPosition, settleAlpha);
      groupRef.current.position.y = targetPosition.y;
      rotationRef.current.quaternion.slerp(detachedQuaternion, settleAlpha);
    } else if (phaseRef.current === "released") {
      dragCurrentYRef.current = groupRef.current.position.y;
      rotationRef.current.quaternion.slerp(detachedQuaternion, rotationAlpha);
    } else {
      rotationRef.current.quaternion.slerp(installedQuaternion, rotationAlpha);
    }

    frameCounterRef.current += 1;
    const interval = grabbingRef.current ? TELEMETRY_FRAME_INTERVAL : TELEMETRY_IDLE_FRAME_INTERVAL;
    if (frameCounterRef.current % interval === 0) publishTelemetry();
  });

  const handlePointerDown = useCallback(
    (event) => {
      if (!isMovablePart || !testActive) return;
      event.stopPropagation();

      if (isCompleted) {
        onInteractionMessage(`${COMPONENT_LABELS[part.key]} is already removed.`);
        return;
      }

      if (!isReachable) {
        onInvalidClick(part.key);
        return;
      }

      if (phaseRef.current === "installed") {
        detachComponent();
        return;
      }

      if (phaseRef.current === "detached" || phaseRef.current === "released") {
        beginGrab(event);
        return;
      }
    },
    [
      beginGrab,
      detachComponent,
      isCompleted,
      isMovablePart,
      isReachable,
      onInteractionMessage,
      onInvalidClick,
      part.key,
      testActive,
    ]
  );

  const handlePointerOver = useCallback(
    (event) => {
      if (!isMovablePart || !testActive || isCompleted) return;
      event.stopPropagation();
      document.body.style.cursor = phaseRef.current === "installed" ? "pointer" : "grab";
    },
    [isCompleted, isMovablePart, testActive]
  );

  const handlePointerOut = useCallback(() => {
    if (!grabbingRef.current) document.body.style.cursor = "default";
  }, []);

  return (
    <group
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <group position={[modelCenter.x, modelCenter.y, modelCenter.z]}>
        <group ref={rotationRef}>
          <group position={[-modelCenter.x, -modelCenter.y, -modelCenter.z]}>
            <primitive object={clonedScene} dispose={null} />
          </group>
        </group>
      </group>
    </group>
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
  return (
    <group ref={rootRef}>
      {parts.map((part) => (
        <PartModel
          key={part.key}
          part={part}
          isReachable={reachableKeys.has(part.key)}
          isCompleted={completedParts.includes(part.key)}
          testActive={testActive}
          onPartCompleted={onPartCompleted}
          onInvalidClick={onInvalidClick}
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
        <color attach="background" args={["#070c14"]} />
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
              <div className="text-[11px] text-[#7a8ba8]">Intel Platform</div>
            </div>
          ) : null}
          <button type="button" onClick={onToggle} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1a2438] bg-white/[0.03] text-[#dbe6f5] transition hover:bg-white/[0.06]">
            {open ? "<" : ">"}
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 pr-2 [scrollbar-color:rgba(0,255,180,0.35)_rgba(255,255,255,0.05)] [scrollbar-width:thin]">
          {(checklistOrder || REMOVAL_SEQUENCE).map((key, index) => {
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
            Full Disassembly — Practical Test
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#9fb0ca]">
            No visual hints this time. Remove all eight components and place each one in its correct bench
            position, in any order that makes physical sense. Your accuracy, order judgment, and time are
            scored.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#00ffb4]">No Guides</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">
                No highlighted parts or target ghosts. Rely on what you know.
              </div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#00ffb4]">Free Order</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">
                Pick any component that is realistically accessible right now.
              </div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#00ffb4]">Scored</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">
                Wrong-order attempts and fumbled placements cost points.
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
    <div
      className="absolute inset-0 z-[780] flex items-center justify-center bg-[#050912]/86 p-5 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[30px] border border-[#00ffb4]/35 bg-[#0b1220]/97 p-7 shadow-[0_40px_120px_rgba(0,0,0,0.76),0_0_70px_rgba(0,255,180,0.10)] md:p-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(0,255,180,0.16),transparent_42%)]" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00ffb4]/30 bg-[#00ffb4]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#73ffd4]">
            Test Complete • INTEL Full Disassembly
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
                  ? "You met the disassembly standard without any step-by-step guidance."
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
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00ffb4]">Parts Removed</div>
              <div className="mt-2 text-sm font-bold text-white">{result.partsCompleted} / {REMOVAL_SEQUENCE.length}</div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.035] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff9f7d]">Order Mistakes</div>
              <div className="mt-2 text-sm font-bold text-white">{result.wrongOrderCount}</div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.035] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffd27d]">Fumbles</div>
              <div className="mt-2 text-sm font-bold text-white">{result.fumbleCount}</div>
            </div>
          </div>

          <div className="mt-7 rounded-2xl border border-[#00ffb4]/18 bg-[#00ffb4]/6 px-4 py-3 text-xs leading-6 text-[#b7c6dd]">
            Score starts at 100. Each out-of-order attempt costs {PENALTY_WRONG_ORDER_CLICK} points, each
            excess fumble costs {PENALTY_FUMBLE} points, and time beyond {Math.round(TIME_PAR_SECONDS / 60)}{" "}
            minutes costs {PENALTY_PER_OVER_PAR_MINUTE} points per extra minute. 75+ is a pass.
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

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export default function INTELFullDisassemblyPracticalTest({ onFinish, onBack }) {
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
  const [startedAt, setStartedAt] = useState(null);
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

  const handleSettingChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const resetTest = useCallback(() => {
    setCompletedParts([]);
    setWrongOrderCount(0);
    setFumbleCount(0);
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
        console.error("Error fetching INTEL full disassembly profile:", error);
        setProfile(null);
      }
    });
    return () => unsub();
  }, []);

  const saveTestResult = useCallback(
    async (finalResult) => {
      if (!firebaseUser) return;
      try {
        const userRef = doc(db, "users", firebaseUser.uid);
        await setDoc(
          userRef,
          {
            practicalTests: {
              intelDisassembly: {
                score: finalResult.score,
                grade: computeGrade(finalResult.score).letter,
                elapsedSeconds: finalResult.elapsedSeconds,
                wrongOrderCount: finalResult.wrongOrderCount,
                fumbleCount: finalResult.fumbleCount,
                completedAt: serverTimestamp(),
              },
            },
          },
          { merge: true }
        );
        const achievement = await unlockAchievement(firebaseUser.uid, "intelDisassembly", { score: finalResult.score });
        setAchievementToast(achievement);
        window.setTimeout(() => setAchievementToast(null), 4200);
      } catch (error) {
        console.error("Error saving INTEL Disassembly Practical Test result:", error);
      }
    },
    [firebaseUser]
  );

  const finishTest = useCallback(
    (finalCompletedParts, finalWrongOrder, finalFumbles) => {
      const elapsedSeconds = startedAt ? (Date.now() - startedAt) / 1000 : 0;
      const overParMinutes = Math.max(0, Math.ceil((elapsedSeconds - TIME_PAR_SECONDS) / 60));

      const rawScore =
        100 -
        finalWrongOrder * PENALTY_WRONG_ORDER_CLICK -
        finalFumbles * PENALTY_FUMBLE -
        overParMinutes * PENALTY_PER_OVER_PAR_MINUTE;

      const score = Math.max(0, Math.min(100, Math.round(rawScore)));

      const finalResult = {
        score,
        elapsedSeconds,
        partsCompleted: finalCompletedParts.length,
        wrongOrderCount: finalWrongOrder,
        fumbleCount: finalFumbles,
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
      if (completedParts.includes(partKey)) return;

      const nextCompletedParts = [...completedParts, partKey];
      setCompletedParts(nextCompletedParts);
      playCompletionSound(settings.sound, false);
      setValidationMessage(`${COMPONENT_LABELS[partKey]} removed and placed correctly.`);

      if (nextCompletedParts.length === REMOVAL_SEQUENCE.length) {
        finishTest(nextCompletedParts, wrongOrderCount, fumbleCount);
      }
    },
    [completedParts, finishTest, fumbleCount, settings.sound, wrongOrderCount]
  );

  const handleInvalidClick = useCallback(
    (partKey) => {
      setWrongOrderCount((value) => value + 1);
      playMistakeSound(settings.sound);
      setValidationMessage(
        `${COMPONENT_LABELS[partKey]} is not accessible yet — something else needs to come out first. (Order mistake logged.)`
      );
    },
    [settings.sound]
  );

  const handleFumble = useCallback(
    (partKey) => {
      setFumbleCount((value) => value + 1);
      setValidationMessage(`${COMPONENT_LABELS[partKey]} was released far from its bench position. (Fumble logged.)`);
    },
    []
  );

  const handleStartTest = useCallback(() => {
    setShowIntro(false);
    setTestActive(true);
    setStartedAt(Date.now());
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
        {result ? (
          <ResultsCard result={result} onRetry={resetTest} onBackToDashboard={handleBackToDashboard} />
        ) : null}

        <div className="relative flex h-full w-full flex-col overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(0,255,180,0.08),transparent_35%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_20%,rgba(255,159,125,0.05),transparent_30%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,180,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,180,0.025)_1px,transparent_1px)] bg-[size:54px_54px] opacity-55" />

          <div className="relative flex h-full w-full flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 text-[12px] text-[#7a8ba8] md:px-10">
              <div>
                Practical Test — <span className="text-[#dbe6f5]">Full Disassembly (INTEL)</span>
              </div>
              <div className="rounded-lg border border-[#ff9f7d]/30 bg-[#ff9f7d]/8 px-2 py-1 text-[11px] font-bold text-[#ff9f7d]">Scored Practical</div>
            </div>

            <div className="relative z-[120] mt-3 px-6 md:px-10">
              <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-[22px] border border-[#1a2438] bg-[#0b1220]/86 px-6 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.30)] backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <img src="/PNG/Articton.png" alt="Articton Logo" className="h-10 w-10 scale-300 object-contain ml-4" />
                  <div>
                    <div className="text-base font-bold tracking-wide text-white">Articton</div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-[#ff9f7d]">INTEL Practical Test</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  {validationMessage ? (
                    <div className="max-w-[520px] rounded-2xl border border-[#00ffb4]/20 bg-[#00ffb4]/8 px-4 py-2 text-xs font-semibold text-[#dffef5]">
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
                  <span className="text-[#00ffb4]">{completedParts.length} / {REMOVAL_SEQUENCE.length} removed</span>
                  <span className="text-[#ff9f7d]">{wrongOrderCount} order mistakes</span>
                  <span className="text-[#ffd27d]">{fumbleCount} fumbles</span>
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

/* Preload the INTEL table and every component model up front */
PART_MODELS.forEach((part) => useGLTF.preload(encodeURI(part.path)));


