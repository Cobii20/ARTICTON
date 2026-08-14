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
import ProcedureAssistantBubble from "../../../Components/ProcedureAssistantBubble";
import { auth, db, functions } from "../../../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { AchievementToast, unlockAchievement } from "../../../utils/achievements.jsx";
import { formatTutorReply } from "../../../utils/tutorReply.js";
import { getUserSettings } from "../../../utils/userSettings";
import { PDF_BASED_DISASSEMBLY_GUIDES } from "../../../utils/pdfBasedInstructionGuides";
import {
  GUIDED_DISASSEMBLY_CAMERA_PRESET,
  GUIDED_DISASSEMBLY_ORBIT_PROPS,
  frameSceneCamera,
} from "../../../utils/threeCameraControls";

/* ------------------------------------------------------------------ */
/* Ordered disassembly configuration (AMD platform)          */
/* ------------------------------------------------------------------ */

/*
 * Validated training order:
 * 1) remove the GPU so it cannot obstruct the board,
 * 2) remove the motherboard with the CPU, M.2 SSD, and both RAM sticks still
 *    mounted,
 * 3) service the board-mounted parts on the table,
 * 4) finish with the case-mounted HDD and PSU.
 *
 * RAM is intentionally represented as one unordered stage. Either stick can
 * be removed first, but both must be seated before the learner may continue.
 */
const steps = [
  { key: "gpu", name: "GPU Disassembly", partKeys: ["gpu"] },
  {
    key: "motherboard",
    name: "Motherboard Disassembly",
    partKeys: ["motherboard"],
  },
  { key: "ssd", name: "SSD Disassembly", partKeys: ["ssd"] },
  {
    key: "ram",
    name: "RAM Disassembly (2 Modules)",
    partKeys: ["ram1", "ram2"],
    unordered: true,
  },
  { key: "cpu", name: "CPU Disassembly", partKeys: ["cpu"] },
  { key: "hdd", name: "HDD Disassembly", partKeys: ["hdd"] },
  { key: "psu", name: "PSU Disassembly", partKeys: ["psu"] },
  { key: "final", name: "Full Disassembly", partKeys: [] },
];

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

const GUIDED_STEPS = steps.filter((step) => step.key !== "final");
const REMOVAL_SEQUENCE = GUIDED_STEPS.flatMap((step) => step.partKeys);
const MOTHERBOARD_MOUNTED_PARTS = new Set(["cpu", "ssd", "ram1", "ram2"]);

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

const STEP_INSTRUCTION_GUIDES = PDF_BASED_DISASSEMBLY_GUIDES.amd;

/* Final AMD table seats measured from the in-scene telemetry.
   These coordinates are in the same local space used by each draggable
   component group. A component is completed only after it reaches its
   assigned seat and is magnetically snapped into place. */
const PLACEMENT_TARGETS = Object.freeze({
  gpu: {
    position: [-41.711, -17.422, 88.557],
    snapDistance: 1.5,
    magnetDistance: 9,
  },
  ssd: {
    position: [-28.53, -13.076, 98.981],
    snapDistance: 1,
    magnetDistance: 6,
  },
  hdd: {
    position: [-38.289, -9.671, 90.063],
    snapDistance: 1.25,
    magnetDistance: 7,
  },
  ram1: {
    position: [-53.836, -27.553, 80.307],
    snapDistance: 0.85,
    magnetDistance: 5,
  },
  ram2: {
    position: [-55.587, -27.596, 75.629],
    snapDistance: 0.85,
    magnetDistance: 5,
  },
  cpu: {
    position: [-24.32, -27.331, 85.547],
    snapDistance: 0.75,
    magnetDistance: 4.5,
  },
  psu: {
    position: [-28.697, -2.967, 75.561],
    snapDistance: 1.6,
    magnetDistance: 9,
    preserveInstalledRotation: true,
  },
  motherboard: {
    position: [-41.07, -21.537, 54.246],
    snapDistance: 2,
    magnetDistance: 11,
  },
});

/*
 * The magnetic capture zone is the whole open table workspace, not only the
 * small holographic seat. The bounds are derived from all authored placement
 * seats, so the same logic automatically respects AMD and Intel model scale.
 */
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
const SAFE_CARRY_RISE_START = 0.18;
const SAFE_CARRY_DESCENT_START = 0.68;
const SAFE_CARRY_Y_SPEED = 9.5;
const MAGNETIC_FIELD_MIN_POINTER_TRAVEL_PX = 14;
const MAGNETIC_FIELD_EDGE_CAPTURE_STRENGTH = 0.14;
const MAGNETIC_FIELD_MIN_PULL = 0.1;
const MAGNETIC_FIELD_MAX_PULL = 0.76;
const MAGNETIC_ROUTE_CAPTURE_RATIO = 0.55;

const LEGACY_STORAGE_KEYS = [
  "module2CompletedStepsAMD",
  "module2DisassembledPartsAMD",
];

function getRemainingParts(stepConfig, completedParts) {
  if (!stepConfig?.partKeys?.length) return [];
  return stepConfig.partKeys.filter((key) => !completedParts.includes(key));
}

function isProcedureStepComplete(stepConfig, completedParts) {
  return (
    Boolean(stepConfig?.partKeys?.length) &&
    stepConfig.partKeys.every((key) => completedParts.includes(key))
  );
}

function getActiveProcedureStage(completedParts) {
  return (
    GUIDED_STEPS.find((stepConfig) =>
      stepConfig.partKeys.some((key) => !completedParts.includes(key))
    ) || null
  );
}

function formatAllowedPartLabel(partKeys) {
  if (!partKeys?.length) return "the current component";
  if (partKeys.length === 1) return COMPONENT_LABELS[partKeys[0]];
  if (partKeys.every((key) => key.startsWith("ram"))) {
    return "either RAM module";
  }
  return partKeys.map((key) => COMPONENT_LABELS[key]).join(" or ");
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

    const totalDuration = isFinal ? 650 : 420;
    window.setTimeout(() => {
      context.close().catch(() => {});
    }, totalDuration);
  } catch (error) {
    console.warn("Completion sound could not be played:", error);
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

function PartModel({
  part,
  isActive,
  isCompleted,
  hostTransformRef,
  onTransformChange,
  allowPointerThrough = false,
  onPartCompleted,
  onLockedPartClick,
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
  const canInteract = isMovablePart && (isActive || isCompleted);
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
      if (!isMovablePart) return;

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


function SourcePartGuide({ part }) {
  const { scene } = useGLTF(encodeURI(part.path));
  const pulseRef = useRef(null);

  const guideData = useMemo(() => {
    const sourceScene = scene.clone(true);
    const materials = [];

    sourceScene.traverse((object) => {
      if (!object.isMesh) return;
      object.raycast = () => null;
      object.renderOrder = 1200;
      const material = new THREE.MeshBasicMaterial({
        color: "#ffcf5a",
        transparent: true,
        opacity: 0.72,
        wireframe: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      object.material = material;
      materials.push(material);
    });

    sourceScene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(sourceScene);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const radius = THREE.MathUtils.clamp(
      Math.max(size.x, size.y, size.z) * 0.18,
      0.18,
      2.8
    );
    const callout = new THREE.Vector3(
      center.x + Math.max(size.x * 0.72, 0.85),
      center.y + Math.max(size.y * 0.95, 0.9),
      center.z + Math.max(size.z * 0.32, 0.45)
    );

    return { sourceScene, materials, center, size, radius, callout };
  }, [scene]);

  useEffect(() => {
    return () => guideData.materials.forEach((material) => material.dispose());
  }, [guideData]);

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.elapsedTime * 5) + 1) / 2;
    guideData.materials.forEach((material) => {
      material.opacity = 0.42 + pulse * 0.48;
    });
    if (pulseRef.current) {
      pulseRef.current.scale.setScalar(0.9 + pulse * 0.22);
    }
  });

  return (
    <group>
      <primitive object={guideData.sourceScene} dispose={null} />

      <mesh
        ref={pulseRef}
        position={guideData.center}
        renderOrder={1201}
      >
        <sphereGeometry args={[guideData.radius, 24, 16]} />
        <meshBasicMaterial
          color="#ffcf5a"
          transparent
          opacity={0.75}
          wireframe
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function PlacementTargetGuide({ part }) {
  const target = PLACEMENT_TARGETS[part.key];
  const { scene } = useGLTF(encodeURI(part.path));
  const pulseRef = useRef(null);
  const ringRef = useRef(null);
  const innerRingRef = useRef(null);

  const guideData = useMemo(() => {
    const fillScene = scene.clone(true);
    const wireScene = scene.clone(true);
    const fillMaterials = [];
    const wireMaterials = [];

    fillScene.traverse((object) => {
      if (!object.isMesh) return;
      object.raycast = () => null;
      object.renderOrder = 1080;
      const material = new THREE.MeshBasicMaterial({
        color: "#00ffb4",
        transparent: true,
        opacity: 0.11,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      object.material = material;
      fillMaterials.push(material);
    });

    wireScene.traverse((object) => {
      if (!object.isMesh) return;
      object.raycast = () => null;
      object.renderOrder = 1081;
      const material = new THREE.MeshBasicMaterial({
        color: "#73ffd4",
        transparent: true,
        opacity: 0.76,
        wireframe: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      object.material = material;
      wireMaterials.push(material);
    });

    fillScene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(fillScene);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const targetQuaternion = target.preserveInstalledRotation
      ? new THREE.Quaternion()
      : getAutomaticLayFlatQuaternion(size);
    const callout = new THREE.Vector3(
      center.x + Math.max(size.x * 0.76, 1.1),
      center.y + Math.max(size.y * 1.2, 1.15),
      center.z + Math.max(size.z * 0.4, 0.65)
    );

    return {
      fillScene,
      wireScene,
      fillMaterials,
      wireMaterials,
      center,
      size,
      targetQuaternion,
      callout,
    };
  }, [scene, target.preserveInstalledRotation]);

  useEffect(() => {
    return () => {
      [...guideData.fillMaterials, ...guideData.wireMaterials].forEach(
        (material) => material.dispose()
      );
    };
  }, [guideData]);

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.elapsedTime * 3.4) + 1) / 2;

    if (pulseRef.current) {
      pulseRef.current.scale.setScalar(0.985 + pulse * 0.03);
    }
    guideData.fillMaterials.forEach((material) => {
      material.opacity = 0.07 + pulse * 0.11;
    });
    guideData.wireMaterials.forEach((material) => {
      material.opacity = 0.5 + pulse * 0.34;
    });

    if (ringRef.current?.material) {
      ringRef.current.material.opacity = 0.28 + pulse * 0.48;
    }
    if (innerRingRef.current?.material) {
      innerRingRef.current.material.opacity = 0.5 + pulse * 0.42;
    }
  });

  const ringRadius = THREE.MathUtils.clamp(
    Math.max(
      Math.max(guideData.size.x, guideData.size.y, guideData.size.z) * 0.58,
      (target.snapDistance ?? DEFAULT_SNAP_DISTANCE) * 1.15
    ),
    0.7,
    8
  );

  return (
    <group position={target.position}>
      <group ref={pulseRef}>
        <group position={guideData.center.toArray()}>
          <group quaternion={guideData.targetQuaternion}>
            <group position={guideData.center.clone().multiplyScalar(-1).toArray()}>
              <primitive object={guideData.fillScene} dispose={null} />
              <primitive object={guideData.wireScene} dispose={null} />
            </group>
          </group>
        </group>
      </group>

      <mesh
        ref={ringRef}
        position={guideData.center.toArray()}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1078}
      >
        <ringGeometry args={[ringRadius * 0.78, ringRadius, 64]} />
        <meshBasicMaterial
          color="#00ffb4"
          transparent
          opacity={0.72}
          depthTest={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh
        ref={innerRingRef}
        position={guideData.center.toArray()}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1079}
      >
        <ringGeometry args={[ringRadius * 0.34, ringRadius * 0.44, 64]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.78}
          depthTest={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function Loader() {
  return (
    <Html center>
      <div className="rounded-xl border border-[#1a2438] bg-[#0b1220]/90 px-4 py-2 text-xs font-semibold text-[#00ffb4]">
        Loading model...
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

function HostTransformGuide({ hostTransformRef, children }) {
  const groupRef = useRef(null);
  const matrixRef = useRef(new THREE.Matrix4());
  const translationRef = useRef(new THREE.Matrix4());
  const pivotRef = useRef(new THREE.Matrix4());
  const inversePivotRef = useRef(new THREE.Matrix4());
  const rotationRef = useRef(new THREE.Matrix4());

  useFrame(() => {
    const group = groupRef.current;
    const transform = hostTransformRef.current;
    if (!group || !transform) return;

    translationRef.current.makeTranslation(
      transform.position.x,
      transform.position.y,
      transform.position.z
    );
    pivotRef.current.makeTranslation(
      transform.pivot.x,
      transform.pivot.y,
      transform.pivot.z
    );
    inversePivotRef.current.makeTranslation(
      -transform.pivot.x,
      -transform.pivot.y,
      -transform.pivot.z
    );
    rotationRef.current.makeRotationFromQuaternion(transform.quaternion);

    matrixRef.current
      .copy(translationRef.current)
      .multiply(pivotRef.current)
      .multiply(rotationRef.current)
      .multiply(inversePivotRef.current);
    group.matrix.copy(matrixRef.current);
    group.matrixWorldNeedsUpdate = true;
  });

  return (
    <group ref={groupRef} matrixAutoUpdate={false}>
      {children}
    </group>
  );
}


function AssembledPC({
  parts,
  activePartKeys,
  partPhases,
  completedParts,
  guidesEnabled = true,
  onPartCompleted,
  onLockedPartClick,
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

  const activeParts = parts.filter((part) => activePartKeys.includes(part.key));
  const motherboardIsActive = activePartKeys.includes("motherboard");
  const motherboardIsCompleted = completedParts.includes("motherboard");
  const mountedPartIsActive = activePartKeys.some((key) =>
    MOTHERBOARD_MOUNTED_PARTS.has(key)
  );

  return (
    <group ref={rootRef}>
      {parts.map((part) => (
        <PartModel
          key={part.key}
          part={part}
          isActive={activePartKeys.includes(part.key)}
          isCompleted={completedParts.includes(part.key)}
          hostTransformRef={
            MOTHERBOARD_MOUNTED_PARTS.has(part.key)
              ? motherboardTransformRef
              : undefined
          }
          onTransformChange={
            part.key === "motherboard"
              ? handleMotherboardTransform
              : undefined
          }
          allowPointerThrough={
            (motherboardIsActive && MOTHERBOARD_MOUNTED_PARTS.has(part.key)) ||
            (part.key === "motherboard" &&
              motherboardIsCompleted &&
              mountedPartIsActive)
          }
          onPartCompleted={onPartCompleted}
          onLockedPartClick={onLockedPartClick}
          onInteractionMessage={onInteractionMessage}
          onDragStateChange={onDragStateChange}
          onTelemetry={onTelemetry}
        />
      ))}

      {guidesEnabled
        ? activeParts.map((activePart) => {
            if (
              completedParts.includes(activePart.key) ||
              (partPhases[activePart.key] || "installed") !== "installed"
            ) {
              return null;
            }

            const guide = (
              <SourcePartGuide
                key={`source-${activePart.key}`}
                part={activePart}
              />
            );

            return MOTHERBOARD_MOUNTED_PARTS.has(activePart.key) ? (
              <HostTransformGuide
                key={`hosted-source-${activePart.key}`}
                hostTransformRef={motherboardTransformRef}
              >
                {guide}
              </HostTransformGuide>
            ) : (
              guide
            );
          })
        : null}

      {guidesEnabled
        ? activeParts.map((activePart) =>
            !completedParts.includes(activePart.key) &&
            PLACEMENT_TARGETS[activePart.key]?.position ? (
              <PlacementTargetGuide
                key={`target-${activePart.key}`}
                part={activePart}
              />
            ) : null
          )
        : null}
    </group>
  );
}

function InitialSceneCamera({ sceneRootRef, controlsRef, overviewRequest }) {
  const { camera, size } = useThree();
  const initializedRef = useRef(false);
  const handledOverviewRequestRef = useRef(-1);
  const lastFramedSizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const isInitialSetup = !initializedRef.current;
    const isNewOverviewRequest =
      overviewRequest !== handledOverviewRequestRef.current;
    const previousSize = lastFramedSizeRef.current;
    const previousAspect = previousSize.height
      ? previousSize.width / previousSize.height
      : 0;
    const nextAspect = size.height ? size.width / size.height : 0;
    const widthShift = Math.abs(size.width - previousSize.width);
    const heightShift = Math.abs(size.height - previousSize.height);
    const aspectShift = Math.abs(nextAspect - previousAspect);
    const shouldReframeForResize =
      initializedRef.current &&
      previousSize.width > 0 &&
      previousSize.height > 0 &&
      (widthShift > Math.max(48, previousSize.width * 0.08) ||
        heightShift > Math.max(40, previousSize.height * 0.08) ||
        aspectShift > 0.08);

    if (!isInitialSetup && !isNewOverviewRequest && !shouldReframeForResize) {
      return undefined;
    }

    let frameId = 0;
    let settleTimer = 0;
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

      const framed = frameSceneCamera({
        camera,
        controls,
        root,
        size: { width: size.width, height: size.height },
        preset: GUIDED_DISASSEMBLY_CAMERA_PRESET,
        minDistance: 8,
      });

      if (framed) {
        initializedRef.current = true;
        handledOverviewRequestRef.current = overviewRequest;
        lastFramedSizeRef.current = {
          width: size.width,
          height: size.height,
        };
      }
    };

    const queueFrame = () => {
      frameId = requestAnimationFrame(initialize);
    };

    // Browser zoom and sidebar transitions can emit several resize passes.
    // Wait briefly for layout to settle so the important 3D workspace is
    // framed once against the final canvas aspect ratio.
    if (shouldReframeForResize && !isNewOverviewRequest) {
      settleTimer = window.setTimeout(queueFrame, 120);
    } else {
      queueFrame();
    }

    return () => {
      if (settleTimer) window.clearTimeout(settleTimer);
      cancelAnimationFrame(frameId);
    };
  }, [
    camera,
    controlsRef,
    overviewRequest,
    sceneRootRef,
    size.height,
    size.width,
  ]);

  return null;
}



function ModelViewer({
  parts,
  activePartKeys,
  completedParts,
  guidesEnabled = true,
  onPartCompleted,
  onLockedPartClick,
  onInteractionMessage,
}) {
  const [isDraggingPart, setIsDraggingPart] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [partPhases, setPartPhases] = useState({});
  const [overviewRequest, setOverviewRequest] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef(null);
  const controlsRef = useRef(null);
  const sceneRootRef = useRef(null);
  const activePartKeySignature = activePartKeys.join("|");

  const handleTelemetry = useCallback((nextTelemetry) => {
    setTelemetry(nextTelemetry);
    setPartPhases((previous) => {
      if (previous[nextTelemetry.key] === nextTelemetry.phase) return previous;
      return { ...previous, [nextTelemetry.key]: nextTelemetry.phase };
    });
  }, []);

  useEffect(() => {
    const restoreControls = () => setIsDraggingPart(false);
    window.addEventListener("pointercancel", restoreControls);
    window.addEventListener("blur", restoreControls);

    return () => {
      window.removeEventListener("pointercancel", restoreControls);
      window.removeEventListener("blur", restoreControls);
    };
  }, []);

  useEffect(() => {
    setTelemetry(null);
  }, [activePartKeySignature]);

  useEffect(() => {
    const handleKeyboardControls = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const tagName = event.target?.tagName?.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || tagName === "select") {
        return;
      }

      if (event.key.toLowerCase() === "r" && !isDraggingPart) {
        setOverviewRequest((value) => value + 1);
      }
    };

    window.addEventListener("keydown", handleKeyboardControls);
    return () => window.removeEventListener("keydown", handleKeyboardControls);
  }, [isDraggingPart]);

  const refreshOverviewAfterResize = useCallback(() => {
    // Fullscreen changes the canvas dimensions. Wait for the browser to finish
    // laying out the fullscreen element before recalculating the overview.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setOverviewRequest((value) => value + 1);
      });
    });
  }, []);

  const syncFullscreenState = useCallback(() => {
    const fullscreenElement =
      document.fullscreenElement || document.webkitFullscreenElement || null;

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

    const fullscreenElement =
      document.fullscreenElement || document.webkitFullscreenElement || null;

    try {
      if (fullscreenElement === viewerRef.current) {
        const exitFullscreen =
          document.exitFullscreen || document.webkitExitFullscreen;

        if (exitFullscreen) {
          await Promise.resolve(exitFullscreen.call(document));
        }
        return;
      }

      // Exit another fullscreen element first, if one is active.
      if (fullscreenElement) {
        const exitFullscreen =
          document.exitFullscreen || document.webkitExitFullscreen;

        if (exitFullscreen) {
          await Promise.resolve(exitFullscreen.call(document));
        }
      }

      const requestFullscreen =
        viewerRef.current.requestFullscreen ||
        viewerRef.current.webkitRequestFullscreen;

      if (requestFullscreen) {
        await Promise.resolve(requestFullscreen.call(viewerRef.current));
      }
    } catch (error) {
      console.error("Unable to toggle fullscreen mode:", error);
    }
  }, [isDraggingPart]);

  return (
    <div
      ref={viewerRef}
      onContextMenu={(event) => event.preventDefault()}
      className={[
        "relative h-full w-full overflow-hidden bg-[#070c14]",
        isFullscreen ? "rounded-none" : "",
      ].join(" ")}
      style={isFullscreen ? { width: "100vw", height: "100vh" } : undefined}
    >
      <Canvas
        camera={{ position: [24, 18, 110], fov: 44, near: 0.01, far: 2000 }}
        dpr={[1, 1.5]}
        shadows
        performance={{ min: 0.55 }}
        className="h-full w-full"
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: false,
          stencil: false,
        }}
        style={{ touchAction: "none" }}
      >
        <color attach="background" args={["#070c14"]} />
        <hemisphereLight args={["#ffffff", "#182338", 1.15]} />
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[6, 10, 7]}
          intensity={1.75}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-5, 4, 2]} intensity={0.68} />

        <ModelErrorBoundary parts={parts}>
          <Suspense fallback={<Loader />}>
            <AssembledPC
              rootRef={sceneRootRef}
              parts={parts}
              activePartKeys={activePartKeys}
              partPhases={partPhases}
              completedParts={completedParts}
              guidesEnabled={guidesEnabled}
              onPartCompleted={onPartCompleted}
              onLockedPartClick={onLockedPartClick}
              onInteractionMessage={onInteractionMessage}
              onDragStateChange={setIsDraggingPart}
              onTelemetry={handleTelemetry}
            />
          </Suspense>
        </ModelErrorBoundary>

        <InitialSceneCamera
          sceneRootRef={sceneRootRef}
          controlsRef={controlsRef}
          overviewRequest={overviewRequest}
        />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!isDraggingPart}
          {...GUIDED_DISASSEMBLY_ORBIT_PROPS}
          mouseButtons={{
            LEFT: null,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
        />
      </Canvas>

      <div className="articton-viewer-actions absolute left-4 top-4 z-[80] flex max-w-[calc(100%-180px)] flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOverviewRequest((value) => value + 1)}
          disabled={isDraggingPart}
          className="rounded-xl border border-[#00ffb4]/30 bg-[#0b1220]/92 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7dffdc] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-[#00ffb4]/12 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Reset Camera View
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          disabled={isDraggingPart}
          aria-pressed={isFullscreen}
          className="rounded-xl border border-[#00ffb4]/30 bg-[#0b1220]/92 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7dffdc] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-[#00ffb4]/12 disabled:cursor-not-allowed disabled:opacity-45"
          title={isFullscreen ? "Exit fullscreen view" : "Open the 3D workspace in fullscreen"}
        >
          {isFullscreen ? "Exit Full Screen" : "Full Screen"}
        </button>
      </div>

      {telemetry ? (
        <div className="articton-telemetry pointer-events-none absolute bottom-4 left-4 z-[80] w-[min(350px,calc(100%-32px))] rounded-2xl border border-[#00ffb4]/25 bg-[#0b1220]/94 px-4 py-3 text-[11px] leading-5 text-[#dbe6f5] shadow-[0_12px_35px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <div className="mb-1 flex items-center justify-between gap-4">
            <span className="font-bold text-[#00ffb4]">{telemetry.label}</span>
            <span className="rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#7dffdc]">
              {telemetry.magnetState}
            </span>
          </div>

          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#00ffb4] transition-[width] duration-150"
              style={{ width: `${Math.round(telemetry.progress * 100)}%` }}
            />
          </div>

          <div className="flex justify-between gap-4 text-[#9fb0ca]">
            <span>Placement: {Math.round(telemetry.progress * 100)}%</span>
            <span>Distance: {telemetry.distance.toFixed(2)}</span>
          </div>

          <div className="mt-1 text-[10px] text-[#7a8ba8]">
            {telemetry.phase === "installed"
              ? guidesEnabled
                ? "Click the amber X-ray highlight to detach the correct part."
                : "Click the correct component to detach it — no highlight this time."
              : telemetry.phase === "snapping"
              ? "The invisible magnetic field is seating and rotating the component automatically."
              : telemetry.yTransitioning
              ? "The component is moving safely toward its table-seat height."
              : telemetry.yAligned
              ? "Height is aligned. Release inside the invisible field to start the seating animation."
              : "Hold and drag toward the green seat, then release. Press Esc to drop it safely."}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header dropdown                                                     */
/* ------------------------------------------------------------------ */

function HeaderDropdown({ userName, userEmail = "", avatarUrl = "", onBack, onLogout, setIsSettingsOpen }) {
  const handleBack = () => {
    if (typeof onBack === "function") onBack("Modules");
  };

  return (
    <div className="articton-user-controls relative flex flex-wrap items-center justify-end gap-3">
      <button
        type="button"
        onClick={handleBack}
        className="articton-back-button relative z-[70] rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-2.5 text-[13px] font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06]"
      >
        Go back to Dashboard
      </button>

      <details className="articton-profile-menu group relative z-50">
        <summary className="articton-profile-summary list-none cursor-pointer rounded-2xl border border-[#1a2438] bg-[#0d1220]/95 px-3 py-2.5 transition hover:bg-[#111b2f]">
          <div className="flex max-w-[230px] items-center justify-end gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 text-sm font-bold text-[#00ffb4]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                (userName || "U").charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 leading-tight text-left">
              <div className="truncate text-sm font-semibold text-white">{userName}</div>
              <div className="text-[11px] text-[#7a8ba8]">Profile</div>
            </div>
            <div className="text-sm text-[#7a8ba8] transition group-open:rotate-180">▾</div>
          </div>
        </summary>

        <div className="absolute right-0 top-full mt-2 z-[220] w-52 rounded-2xl border border-[#1a2438] bg-[#0d1220]/98 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="mb-1 border-b border-[#1a2438] px-4 py-2 text-[11px] leading-5 text-[#7a8ba8]">
            <div className="truncate font-semibold text-white">{userName}</div>
            <div className="truncate">{userEmail || "No email"}</div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full rounded-xl px-4 py-2 text-left text-sm text-[#dbe6f5] transition hover:bg-white/5"
          >
            Settings
          </button>
          <button
            onClick={() => typeof onBack === "function" && onBack("Profile")}
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

/* ------------------------------------------------------------------ */
/* Background + Sidebar                                                */
/* ------------------------------------------------------------------ */

function ModuleBackground() {
  return (
    <>
      <div className="pointer-events-none absolute -left-44 -top-44 h-[720px] w-[720px] rounded-full bg-[#00ffb4]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 -right-52 h-[820px] w-[820px] rounded-full bg-[#00ffb4]/6 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a0e17] via-[#0a0e17] to-[#0d1220]" />
    </>
  );
}


function Sidebar({
  open,
  onToggle,
  currentStep,
  completedSteps,
  onSelect,
  canSelectStep,
  currentStepCompleted,
  onViewCertificate,
  onResetScene,
}) {
  const activeButtonRef = useRef(null);

  useEffect(() => {
    activeButtonRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [currentStep]);

  return (
    <div
      className="articton-sidebar absolute left-0 top-0 z-[200] h-full transition-all duration-300"
      style={{
        width: open
          ? "var(--articton-sidebar-open)"
          : "var(--articton-sidebar-closed)",
      }}
    >
      <div className="flex h-full min-h-0 flex-col border-r border-[#1a2438] bg-[#0b1220]/92 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
        <div className="articton-sidebar-header flex shrink-0 items-center justify-between border-b border-[#1a2438] px-4 py-4">
          {open ? (
            <div>
              <div className="text-sm font-bold text-white">Disassembly Steps</div>
              <div className="text-[11px] text-[#7a8ba8]">AMD Platform</div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onToggle}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1a2438] bg-white/[0.03] text-[#dbe6f5] transition hover:bg-white/[0.06]"
          >
            {open ? "←" : "→"}
          </button>
        </div>

        <div
          className="articton-sidebar-list min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 pr-2 [scrollbar-color:rgba(0,255,180,0.35)_rgba(255,255,255,0.05)] [scrollbar-width:thin]"
          style={{ scrollbarGutter: "stable" }}
        >
          {steps.map((item, index) => {
            const done = !!completedSteps[item.key];
            const active = currentStep === index;
            const unlocked = canSelectStep(index);

            return (
              <button
                key={item.key}
                ref={active ? activeButtonRef : null}
                type="button"
                onClick={() => onSelect(index)}
                aria-disabled={!unlocked}
                className={[
                  "articton-sidebar-item flex w-full scroll-m-3 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                  active
                    ? "border-[#00ffb4]/25 bg-[#00ffb4]/10"
                    : "border-[#1a2438] bg-white/[0.03]",
                  unlocked
                    ? "hover:bg-white/[0.06]"
                    : "cursor-not-allowed opacity-45",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition",
                    done
                      ? "bg-[#00ffb4] text-[#0a0e17]"
                      : active
                      ? "border border-[#00ffb4]/35 bg-[#00ffb4]/10 text-[#00ffb4]"
                      : "border border-[#1a2438] bg-[#0d1220] text-[#7a8ba8]",
                  ].join(" ")}
                >
                  {done ? "✓" : index + 1}
                </span>
                {open ? (
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-[#7a8ba8]">
                      {done
                        ? "Finished"
                        : active
                        ? "Current step"
                        : unlocked
                        ? "Available"
                        : "Locked"}
                    </div>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        {currentStep === steps.length - 1 && currentStepCompleted ? (
          <div className="articton-sidebar-footer shrink-0 border-t border-[#1a2438] p-3">
            <button
              type="button"
              onClick={onViewCertificate}
              className={[
                "flex items-center justify-center rounded-2xl bg-[#00ffb4] font-black text-[#0a0e17]",
                "shadow-[0_18px_50px_rgba(0,255,180,0.22)] transition hover:scale-[1.03]",
                open ? "w-full px-5 py-3 text-sm" : "h-10 w-10 text-sm",
              ].join(" ")}
              title="View Certificate"
            >
              {open ? "View Certificate ✓" : "✓"}
            </button>
          </div>
        ) : null}

        <div className="articton-sidebar-footer shrink-0 border-t border-[#1a2438] p-3">
          <button
            type="button"
            onClick={onResetScene}
            className={[
              "flex items-center justify-center rounded-2xl border border-[#1a2438] bg-white/[0.03] font-semibold text-[#dbe6f5]",
              "transition hover:bg-white/[0.07]",
              open ? "w-full px-5 py-3 text-sm" : "h-10 w-10 text-sm",
            ].join(" ")}
            title="Reset Scene"
          >
            {open ? "Reset Scene" : "↺"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModuleIntroCard({ platform, moduleType, onStart }) {
  const isAssembly = moduleType === "Assembly";

  return (
    <div className="absolute inset-0 z-[750] flex items-center justify-center bg-[#050912]/78 p-5 backdrop-blur-md">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[30px] border border-[#00ffb4]/30 bg-[#0b1220]/96 p-7 shadow-[0_40px_120px_rgba(0,0,0,0.7)] md:p-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(0,255,180,0.13),transparent_42%)]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#00ffb4]">
            Module {isAssembly ? "3" : "2"} • {platform} Platform
          </div>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-white md:text-4xl">
            {moduleType} Guided Practice
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#9fb0ca]">
            {isAssembly
              ? "Install each component in order using the bird's-eye workspace, exact target-height assistance, and normal magnetic snap."
              : "Each task begins with an instruction card covering power and ESD precautions, release points, handling technique, correct results, and common mistakes. Remove components in the validated order, then repeat the complete sequence once without guide highlights before the certificate unlocks."}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#00ffb4]">1. Identify</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">
                Read the step card first, then identify the highlighted component, its cables, screws, latches, and safe handling points.
              </div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#00ffb4]">2. Move</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">
                Complete the required release checks, then click-hold to detach and carry the part into the table workspace.
              </div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#00ffb4]">3. Complete</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">
                Confirm the card’s expected result after seating; the next instruction guide appears only when the current stage is complete.
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-[#7a8ba8]">
              Right-drag rotates • mouse wheel zooms • camera locks while moving a part
            </div>
            <button
              type="button"
              onClick={onStart}
              className="rounded-2xl bg-[#00ffb4] px-7 py-3 text-sm font-black text-[#07111d] shadow-[0_16px_45px_rgba(0,255,180,0.25)] transition hover:scale-[1.03]"
            >
              Start Guided Practice →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



function StepInstructionCard({
  platform,
  moduleType,
  stepNumber,
  totalSteps,
  stepName,
  guide,
  isFinalChallenge = false,
  onBegin,
}) {
  const action = moduleType === "Assembly" ? "installation" : "removal";
  const safeGuide = guide || {
    title: stepName,
    summary: `Review the required ${action} procedure before interacting with the simulation.`,
    procedure: ["Identify the active component and its connection points.", "Use the highlighted workspace and complete the step without forcing the part."],
    safety: "Handle the component by its edges and keep the work area controlled.",
    verify: "The component should move freely and finish in the highlighted seated position.",
    avoid: "Do not force, twist, or drag a component through surrounding hardware.",
    simulation: "Drag the active component toward its destination. The magnetic field will take over and animate the final movement.",
  };

  return (
    <div
      className="articton-instruction-overlay absolute inset-0 z-[780] flex items-center justify-center bg-[#050912]/82 p-4 backdrop-blur-md md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-instruction-title"
    >
      <div className="articton-instruction-card relative w-full max-w-4xl overflow-hidden rounded-[30px] border border-[#00ffb4]/35 bg-[#0b1220]/97 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.76),0_0_70px_rgba(0,255,180,0.10)] md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(0,255,180,0.16),transparent_42%)]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full border border-[#00ffb4]/15 bg-[#00ffb4]/5 blur-2xl" />

        <div className="articton-instruction-content relative">
          <div className="articton-instruction-topbar flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#00ffb4]/30 bg-[#00ffb4]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#73ffd4]">
              {isFinalChallenge
                ? "Final Challenge • Before You Begin"
                : `Step ${stepNumber} of ${totalSteps} • Before You Begin`}
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9fb0ca]">
              {platform} Platform
            </div>
          </div>

          <div className="articton-instruction-hero mt-6 flex items-start gap-5">
            <div className="articton-instruction-step-icon flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#00ffb4]/40 bg-[#00ffb4]/12 text-2xl font-black text-[#00ffb4] shadow-[0_0_34px_rgba(0,255,180,0.18)]">
              {isFinalChallenge ? "★" : stepNumber}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#00ffb4]">
                Instruction Guide
              </div>
              <h2
                id="step-instruction-title"
                className="articton-instruction-title mt-2 text-2xl font-black leading-tight text-white md:text-4xl"
              >
                {safeGuide.title || stepName}
              </h2>
              <p className="articton-instruction-summary mt-3 max-w-3xl text-sm leading-7 text-[#aebdd3]">
                {safeGuide.summary}
              </p>
            </div>
          </div>

          <div className="articton-instruction-details mt-7 grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
            <section className="articton-instruction-procedure rounded-2xl border border-[#1a2438] bg-white/[0.035] p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00ffb4]">
                Correct Procedure
              </div>
              <ol className="mt-4 space-y-3">
                {safeGuide.procedure.map((item, index) => (
                  <li key={`${stepName}-instruction-${index}`} className="flex gap-3 text-sm leading-6 text-[#d7e1ee]">
                    <span className="articton-instruction-number flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#00ffb4]/30 bg-[#00ffb4]/10 text-[10px] font-black text-[#00ffb4]">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </section>

            <div className="articton-instruction-side grid gap-3">
              <div className="articton-instruction-side-card rounded-2xl border border-[#ffd166]/25 bg-[#ffd166]/[0.06] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffd166]">Safety / Handling</div>
                <p className="mt-2 text-xs leading-6 text-[#d8dfeb]">{safeGuide.safety}</p>
              </div>
              <div className="articton-instruction-side-card rounded-2xl border border-[#00ffb4]/22 bg-[#00ffb4]/[0.06] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00ffb4]">Correct Result</div>
                <p className="mt-2 text-xs leading-6 text-[#d8dfeb]">{safeGuide.verify}</p>
              </div>
              <div className="articton-instruction-side-card rounded-2xl border border-[#ff7b72]/22 bg-[#ff7b72]/[0.055] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff9a92]">Common Mistake to Avoid</div>
                <p className="mt-2 text-xs leading-6 text-[#d8dfeb]">{safeGuide.avoid}</p>
              </div>
            </div>
          </div>

          <div className="articton-instruction-simulation mt-5 rounded-2xl border border-[#00ffb4]/18 bg-[#00ffb4]/6 px-4 py-3 text-xs leading-6 text-[#c3d1e4]">
            <span className="font-black uppercase tracking-[0.14em] text-[#00ffb4]">In the simulation: </span>
            {safeGuide.simulation}
          </div>

          <div className="articton-instruction-footer mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="articton-instruction-footer-note text-xs text-[#7f91ad]">
              Read first • begin only when the component, release point, and safety check are clear
            </div>
            <button
              type="button"
              onClick={onBegin}
              className="articton-instruction-button rounded-2xl bg-[#00ffb4] px-7 py-3 text-sm font-black text-[#07111d] shadow-[0_16px_45px_rgba(0,255,180,0.20)] transition hover:scale-[1.02]"
            >
              {isFinalChallenge ? "Begin Final Challenge" : `Begin ${stepName}`} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompletionCertificate({
  platform,
  moduleNumber,
  moduleType,
  description,
  userName,
  onBack,
  onSwitchPlatform,
}) {
  const alternatePlatform = platform === "AMD" ? "INTEL" : "AMD";

  return (
    <div className="min-h-screen w-full overflow-hidden bg-[#0a0e17] font-sans text-[#e8ecf4] antialiased print:bg-white">
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-5 py-8">
        <ModuleBackground />
        <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-[34px] border border-[#00ffb4]/35 bg-[#0d1220]/94 p-7 text-center shadow-[0_40px_120px_rgba(0,0,0,0.65)] backdrop-blur-xl md:p-12 print:border-black print:bg-white print:text-black print:shadow-none">
          <div className="pointer-events-none absolute inset-4 rounded-[26px] border border-dashed border-[#00ffb4]/30 print:border-black/40" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,255,180,0.14),transparent_42%)] print:hidden" />

          <div className="relative">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#00ffb4]/40 bg-[#00ffb4]/10 text-4xl font-black text-[#00ffb4] shadow-[0_0_40px_rgba(0,255,180,0.18)] print:border-black print:bg-transparent print:text-black">
              ✓
            </div>
            <div className="mt-5 text-[11px] font-black uppercase tracking-[0.34em] text-[#00ffb4] print:text-black">
              Certificate of Completion
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-6xl print:text-black">
              Congratulations
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#9fb0ca] print:text-black/70">
              This certifies that <span className="font-bold text-white print:text-black">{userName || "the learner"}</span> successfully completed
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#dffef5] md:text-3xl print:text-black">
              Module {moduleNumber} — {platform} {moduleType}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#9fb0ca] print:text-black/70">
              {description}
            </p>

            <div className="mx-auto mt-7 grid max-w-2xl gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4 print:border-black/30 print:bg-transparent">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#7a8ba8] print:text-black/60">Platform</div>
                <div className="mt-1 text-lg font-black text-white print:text-black">{platform}</div>
              </div>
              <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4 print:border-black/30 print:bg-transparent">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#7a8ba8] print:text-black/60">Progress</div>
                <div className="mt-1 text-lg font-black text-white print:text-black">100%</div>
              </div>
              <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4 print:border-black/30 print:bg-transparent">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#7a8ba8] print:text-black/60">Completed</div>
                <div className="mt-1 text-sm font-black text-white print:text-black">{getCompletionDate()}</div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3 print:hidden">
              <button
                type="button"
                onClick={onBack}
                className="rounded-2xl bg-[#00ffb4] px-6 py-3 text-sm font-black text-[#07111d] transition hover:scale-[1.03]"
              >
                Back to Modules →
              </button>
              <button
                type="button"
                onClick={onSwitchPlatform}
                className="rounded-2xl border border-[#00ffb4]/35 bg-[#00ffb4]/10 px-6 py-3 text-sm font-black text-[#7dffdc] transition hover:bg-[#00ffb4]/18"
              >
                Try {alternatePlatform} Version
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-2xl border border-[#1a2438] bg-white/[0.04] px-6 py-3 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.08]"
              >
                Print Certificate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export default function Module2DisassemblyAMD({ onFinish, onBack, onLogout, onSwitchPlatform }) {
  const [step, setStep] = useState(0);
  const [completedParts, setCompletedParts] = useState([]);
  const [finalRoundCompletedParts, setFinalRoundCompletedParts] = useState([]);
  const [sceneRevision, setSceneRevision] = useState(0);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [instructionStepIndex, setInstructionStepIndex] = useState(null);
  const [validationMessage, setValidationMessage] = useState(
    "Begin with the GPU. Detach it, then move it into the open table workspace; the magnetic field will animate it into the highlighted seat."
  );
  const [achievementToast, setAchievementToast] = useState(null);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    { role: "assistant", content: "Hello! I'm your PC Disassembly AI assistant (AMD)." },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [settings, setSettings] = useState(getUserSettings);

  const currentStep = steps[step];
  const isFinalRound = currentStep?.key === "final";

  // Both guided and unguided modes are stage-based. The RAM stage exposes both
  // sticks at once and accepts either one first; every other stage exposes one
  // component. The final pass uses the exact same validated dependencies.
  const activeFinalStage = isFinalRound
    ? getActiveProcedureStage(finalRoundCompletedParts)
    : null;
  const activePartKeys = isFinalRound
    ? getRemainingParts(activeFinalStage, finalRoundCompletedParts)
    : getRemainingParts(currentStep, completedParts);
  const activePartLabel = activePartKeys.length
    ? formatAllowedPartLabel(activePartKeys)
    : null;

  const finalRoundComplete =
    finalRoundCompletedParts.length === REMOVAL_SEQUENCE.length;

  // The 3D viewer needs to know which parts are "already completed" so it can
  // keep them interactable/locked correctly. During the guided phase that's
  // completedParts; during the unguided final round it's finalRoundCompletedParts.
  const modelViewerCompletedParts = isFinalRound
    ? finalRoundCompletedParts
    : completedParts;

  const effectiveCompletedSteps = useMemo(() => {
    return Object.fromEntries(
      steps.map((item) => [
        item.key,
        item.key === "final"
          ? finalRoundComplete
          : isProcedureStepComplete(item, completedParts),
      ])
    );
  }, [finalRoundComplete, completedParts]);

  const currentStepCompleted = currentStep?.key === "final"
    ? finalRoundComplete
    : isProcedureStepComplete(currentStep, completedParts);

  const canSelectStep = useCallback(
    (index) => index <= step,
    [step]
  );

  const handleSettingChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const resetScene = useCallback(() => {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    setCompletedParts([]);
    setFinalRoundCompletedParts([]);
    setStep(0);
    setSceneRevision((value) => value + 1);
    setShowCertificate(false);
    setShowIntro(true);
    setInstructionStepIndex(null);
    setValidationMessage(
      "Scene restarted. Begin with the GPU, then remove the motherboard with its CPU, SSD, and both RAM modules still attached."
    );
  }, []);

  useEffect(() => {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setFirebaseUser(null);
        setProfile(null);
        return;
      }

      setFirebaseUser(currentUser);

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) setProfile(snap.data());
      } catch (error) {
        console.error("Error fetching Module 2 (AMD) profile:", error);
      }
    });

    return () => unsub();
  }, []);

  const user = {
    name: profile
      ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "User"
      : "Loading...",
    email: firebaseUser?.email || "No email",
    avatarUrl: profile?.avatarUrl || "",
  };

  const saveFinalCompletion = useCallback(async () => {
    if (!firebaseUser) return;

    try {
      const completedSteps = Object.fromEntries(
        steps.map((item) => [item.key, true])
      );
      const userRef = doc(db, "users", firebaseUser.uid);

      await setDoc(
        userRef,
        {
          moduleProgress: {
            module2AMD: {
              currentStep: steps.length - 1,
              completed: true,
              percent: 100,
              completedSteps,
              updatedAt: serverTimestamp(),
            },
          },
        },
        { merge: true }
      );
      const achievement = await unlockAchievement(firebaseUser.uid, "module2", { platform: "AMD" });
      setAchievementToast(achievement);
      window.setTimeout(() => setAchievementToast(null), 4200);
    } catch (error) {
      console.error("Error saving final Module 2 (AMD) completion:", error);
    }
  }, [firebaseUser]);

  const handlePartCompleted = useCallback(
    (partKey) => {
      const isFinalRoundNow = steps[step]?.key === "final";
      const allowedPartKeys = isFinalRoundNow
        ? getRemainingParts(
            getActiveProcedureStage(finalRoundCompletedParts),
            finalRoundCompletedParts
          )
        : getRemainingParts(steps[step], completedParts);

      if (
        instructionStepIndex !== null ||
        !allowedPartKeys.includes(partKey) ||
        (isFinalRoundNow
          ? finalRoundCompletedParts.includes(partKey)
          : completedParts.includes(partKey))
      ) {
        return;
      }

      if (isFinalRoundNow) {
        setFinalRoundCompletedParts((previous) => {
          if (previous.includes(partKey)) return previous;

          const next = [...previous, partKey];
          const practiceDone = REMOVAL_SEQUENCE.every((key) =>
            next.includes(key)
          );
          playCompletionSound(settings.sound, practiceDone);

          if (practiceDone) {
            setValidationMessage(
              "Full disassembly complete — the validated order was followed with no guides. Your certificate is ready."
            );
            void saveFinalCompletion();
          } else {
            const nextStage = getActiveProcedureStage(next);
            const nextAllowed = getRemainingParts(nextStage, next);
            const currentStageStillOpen = nextStage?.partKeys.includes(partKey);
            setValidationMessage(
              currentStageStillOpen
                ? `${COMPONENT_LABELS[partKey]} removed correctly. Remove the remaining RAM module.`
                : `${COMPONENT_LABELS[partKey]} removed correctly. Continue with ${formatAllowedPartLabel(nextAllowed)}.`
            );
          }

          return next;
        });
        return;
      }

      const nextCompletedParts = [...completedParts, partKey];
      const stageComplete = isProcedureStepComplete(
        steps[step],
        nextCompletedParts
      );

      setCompletedParts(nextCompletedParts);
      playCompletionSound(settings.sound, false);

      if (!stageComplete) {
        const remaining = getRemainingParts(steps[step], nextCompletedParts);
        setValidationMessage(
          `${COMPONENT_LABELS[partKey]} seated correctly. ${formatAllowedPartLabel(remaining)} is still attached; remove it next.`
        );
        return;
      }

      const guidedPhaseFinished = REMOVAL_SEQUENCE.every((key) =>
        nextCompletedParts.includes(key)
      );
      const completedLabel =
        steps[step].key === "ram"
          ? "Both RAM modules"
          : COMPONENT_LABELS[partKey];

      if (guidedPhaseFinished) {
        const finalStepIndex = steps.length - 1;
        setStep(finalStepIndex);
        setFinalRoundCompletedParts([]);
        setSceneRevision((value) => value + 1);
        setInstructionStepIndex(finalStepIndex);
        setValidationMessage(
          `${completedLabel} complete. Review the final unguided challenge instructions before beginning.`
        );
        return;
      }

      const nextStepIndex = step + 1;
      setStep(nextStepIndex);
      setInstructionStepIndex(nextStepIndex);
      setValidationMessage(
        `${completedLabel} complete. Read the next instruction card before starting ${steps[nextStepIndex].name}.`
      );
    },
    [
      completedParts,
      finalRoundCompletedParts,
      instructionStepIndex,
      saveFinalCompletion,
      settings.sound,
      step,
    ]
  );

  const handleBeginInstructionStep = useCallback(() => {
    if (instructionStepIndex === null) return;

    const instructionStep = steps[instructionStepIndex];
    setInstructionStepIndex(null);

    if (instructionStep?.key === "final") {
      setValidationMessage(
        "Final round active: remove GPU → populated motherboard → SSD → both RAM modules (either order) → CPU → HDD → PSU. Guide highlights are disabled."
      );
      return;
    }

    const allowed = getRemainingParts(instructionStep, completedParts);
    setValidationMessage(
      `${instructionStep.name} started. Remove ${formatAllowedPartLabel(allowed)} using the procedure and safety checks you just reviewed.`
    );
  }, [completedParts, instructionStepIndex]);

  const handleStartGuidedPractice = useCallback(() => {
    setShowIntro(false);
    setStep(0);
    setInstructionStepIndex(0);
    setValidationMessage(
      "Read the GPU instruction card before interacting with the first component."
    );
  }, []);

  const handleLockedPartClick = useCallback(
    (partKey) => {
      const clickedLabel = COMPONENT_LABELS[partKey] || "This component";
      setValidationMessage(
        `${clickedLabel} is locked. Follow the validated sequence and remove ${activePartLabel || "the current component"} first.`
      );
    }, [activePartLabel]
  );

  const handleSelectStep = useCallback(
    (index) => {
      if (index === step) return;

      if (index > step) {
        setValidationMessage(
          `That step is locked. Complete ${activePartLabel || "the current stage"} first.`
        );
      } else {
        setValidationMessage(
          "Completed steps remain visible, but the disassembly sequence continues from the current highlighted step."
        );
      }
    }, [activePartLabel, step]
  );

  const askAI = async () => {
    if (!aiInput.trim()) return;

    const userMessage = { role: "user", content: aiInput };
    setAiMessages((prev) => [...prev, userMessage]);
    setAiLoading(true);

    try {
      const askModuleTutor = httpsCallable(functions, "askModuleTutor");
      const response = await askModuleTutor({
        message: aiInput,
        context: {
          mode: "disassembly",
          moduleNumber: 2,
          platform: "amd",
          currentStep: currentStep?.name,
          activeComponent: activePartLabel,
          completedParts,
        },
      });

      setAiMessages((prev) => [
        ...prev,
        { role: "assistant", content: formatTutorReply(response.data) },
      ]);
    } catch (error) {
      console.error(error);
      setAiMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error.message ||
            "The AI tutor could not answer right now, but the procedure guide still shows this step's notes.",
        },
      ]);
    }

    setAiInput("");
    setAiLoading(false);
  };

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

  if (showCertificate) {
    return (
      <CompletionCertificate
        platform="AMD"
        moduleNumber="2"
        moduleType="Disassembly"
        description="You completed the validated board-first removal order: GPU, motherboard with mounted parts, SSD, both RAM modules in either order, CPU, HDD, and PSU — including a full unguided repeat pass."
        userName={user.name}
        onBack={handleBackToDashboard}
        onSwitchPlatform={() => {
          if (typeof onSwitchPlatform === "function") onSwitchPlatform();
          else if (typeof onBack === "function") onBack("Modules");
        }}
      />
    );
  }

  return (
    <div className="articton-workspace-page fixed inset-0 h-screen w-screen overflow-hidden bg-[#0a0e17] font-sans text-[#e8ecf4] antialiased">
      <div className="articton-workspace-frame relative h-full w-full overflow-hidden">
        <ModuleBackground />
        <AchievementToast achievement={achievementToast} onClose={() => setAchievementToast(null)} />

        {showIntro ? (
          <ModuleIntroCard
            platform="AMD"
            moduleType="Disassembly"
            onStart={handleStartGuidedPractice}
          />
        ) : null}

        {instructionStepIndex !== null ? (
          <StepInstructionCard
            platform="AMD"
            moduleType="Disassembly"
            stepNumber={Math.min(instructionStepIndex + 1, GUIDED_STEPS.length)}
            totalSteps={GUIDED_STEPS.length}
            stepName={steps[instructionStepIndex]?.name || "Disassembly Step"}
            guide={STEP_INSTRUCTION_GUIDES[steps[instructionStepIndex]?.key]}
            isFinalChallenge={steps[instructionStepIndex]?.key === "final"}
            onBegin={handleBeginInstructionStep}
          />
        ) : null}

        <div className="relative flex h-full w-full flex-col overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(0,255,180,0.08),transparent_35%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_20%,rgba(0,255,180,0.05),transparent_30%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,180,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,180,0.025)_1px,transparent_1px)] bg-[size:54px_54px] opacity-55" />

          <div className="relative flex h-full w-full flex-col overflow-hidden">
            <div className="articton-topline flex items-center justify-between px-6 pt-6 text-[12px] text-[#7a8ba8] md:px-10">
              <div>
                Module 2 — <span className="text-[#dbe6f5]">Disassembly (AMD)</span>
              </div>
              <div className="rounded-lg border border-[#1a2438] bg-white/[0.03] px-2 py-1 text-[11px]">
                Step {step + 1} of {steps.length}
              </div>
            </div>

            <div className="articton-toolbar relative z-[120] mt-3 px-6 md:px-10">
              <div className="articton-toolbar-inner flex w-full flex-wrap items-center justify-between gap-4 rounded-[22px] border border-[#1a2438] bg-[#0b1220]/86 px-6 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.30)] backdrop-blur-xl">
                <div className="articton-brand flex flex-wrap items-center justify-end gap-3">
                  <img src="/PNG/Articton.png" alt="Articton Logo" className="articton-brand-logo h-10 w-10 scale-300 object-contain ml-4" />
                  <div>
                    <div className="articton-brand-title text-base font-bold tracking-wide text-white">Articton</div>
                    <div className="articton-brand-subtitle text-[11px] uppercase tracking-[0.24em] text-[#00ffb4]">AMD Disassembly View</div>
                  </div>
                </div>

                <div className="articton-header-actions flex flex-wrap items-center justify-end gap-3">
                  {validationMessage && (
                    <div className="articton-validation max-w-[520px] rounded-2xl border border-[#00ffb4]/20 bg-[#00ffb4]/8 px-4 py-2 text-xs font-semibold text-[#dffef5]">
                      {validationMessage}
                    </div>
                  )}

                  <HeaderDropdown
                    userName={user.name}
                    userEmail={user.email}
                    avatarUrl={user.avatarUrl}
                    onBack={onBack}
                    onLogout={onLogout}
                    setIsSettingsOpen={setIsSettingsOpen}
                  />
                </div>
              </div>

              <Settings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={settings}
                onChange={handleSettingChange}
              />
            </div>

            <div className="articton-step-strip px-6 pt-4 md:px-10">
              <div className="articton-step-strip-inner flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#1a2438] bg-[#0b1220]/72 px-5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
                <div>
                  <div className="articton-step-title text-sm font-semibold text-white">{currentStep?.name}</div>
                  <div className="articton-step-description text-[11px] uppercase tracking-[0.14em] text-[#7a8ba8]">
                    {isFinalRound
                      ? activePartLabel
                        ? `Unguided pass • remove the ${activePartLabel} • ${finalRoundCompletedParts.length}/${REMOVAL_SEQUENCE.length} done`
                        : "Unguided pass complete • open your certificate from the sidebar"
                      : activePartLabel
                      ? `Click + hold: detach and drag ${activePartLabel} • release inside the magnetic field`
                      : "Sequence complete • review the result or open the certificate"}
                  </div>
                </div>
                <div className="articton-step-progress flex items-center gap-2">
                  {steps.map((item, index) => (
                    <div
                      key={item.key}
                      className={`articton-step-progress-pill h-2.5 w-9 rounded-full transition ${
                        index === step
                          ? "bg-[#00ffb4]"
                          : index < step
                          ? "bg-[#00ffb4]/55"
                          : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="articton-stage min-h-0 flex-1 px-4 py-4 md:px-8 md:py-5">
              <div className="articton-stage-frame relative h-full overflow-hidden rounded-[24px] border border-[#1a2438] bg-[#0d1220]/78 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <Sidebar
                  open={sidebarOpen}
                  onToggle={() => setSidebarOpen((value) => !value)}
                  currentStep={step}
                  completedSteps={effectiveCompletedSteps}
                  onSelect={handleSelectStep}
                  canSelectStep={canSelectStep}
                  currentStepCompleted={currentStepCompleted}
                  onViewCertificate={() => setShowCertificate(true)}
                  onResetScene={resetScene}
                />

                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(255,255,255,0.08),transparent_40%)]" />
                <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.55)]" />

                <div
                  className="articton-viewer-shell absolute top-3 bottom-3 right-3 z-[40] overflow-hidden rounded-[18px] border border-[#1a2438] bg-black/20 transition-all duration-300 md:top-4 md:bottom-4 md:right-4"
                  style={{
                    left: sidebarOpen
                      ? "var(--articton-sidebar-open)"
                      : "var(--articton-sidebar-closed)",
                  }}
                >
                  <ModelViewer
                    key={sceneRevision}
                    parts={PART_MODELS}
                    activePartKeys={activePartKeys}
                    completedParts={modelViewerCompletedParts}
                    guidesEnabled={!isFinalRound}
                    onPartCompleted={handlePartCompleted}
                    onLockedPartClick={handleLockedPartClick}
                    onInteractionMessage={setValidationMessage}
                  />

                  <ProcedureAssistantBubble
                    mode="disassembly"
                    platform="AMD"
                    currentStep={currentStep?.name}
                    activeComponent={activePartLabel}
                    open={aiOpen}
                    messages={aiMessages}
                    input={aiInput}
                    loading={aiLoading}
                    onToggle={() => setAiOpen((value) => !value)}
                    onInputChange={setAiInput}
                    onSend={askAI}
                  />

                  <div className="hidden">
                    {!aiOpen && (
                      <button
                        type="button"
                        onClick={() => setAiOpen(true)}
                        className="rounded-2xl border border-[#00ffb4]/25 bg-[#0b1220]/90 px-4 py-3 text-sm font-semibold text-[#00ffb4] shadow-[0_10px_40px_rgba(0,255,180,0.15)] backdrop-blur-xl transition hover:scale-[1.03]"
                      >
                        AI Assistant
                      </button>
                    )}

                    {aiOpen && (
                      <div className="flex h-[500px] w-[360px] flex-col overflow-hidden rounded-[24px] border border-[#1a2438] bg-[#0b1220]/95 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                        <div className="flex items-center justify-between border-b border-[#1a2438] px-4 py-3">
                          <div>
                            <div className="text-sm font-bold text-white">Disassembly AI</div>
                            <div className="text-[11px] text-[#7a8ba8]">AMD step-aware assistant</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAiOpen(false)}
                            className="rounded-lg px-2 py-1 text-sm text-[#7a8ba8] transition hover:bg-white/5 hover:text-white"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="flex-1 space-y-3 overflow-y-auto p-4">
                          {aiMessages.map((message, index) => (
                            <div
                              key={index}
                              className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                                message.role === "assistant"
                                  ? "bg-[#00ffb4]/10 text-[#dffef5]"
                                  : "bg-white/5 text-white"
                              }`}
                            >
                              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7a8ba8]">
                                {message.role === "assistant" ? "AI" : "You"}
                              </div>
                              {message.content}
                            </div>
                          ))}
                        </div>

                        <div className="border-t border-[#1a2438] p-3">
                          <div className="flex gap-2">
                            <input
                              value={aiInput}
                              onChange={(event) => setAiInput(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                  event.preventDefault();
                                  void askAI();
                                }
                              }}
                              placeholder="Ask about this step..."
                              className="flex-1 rounded-xl border border-[#1a2438] bg-[#111827] px-4 py-3 text-sm text-white outline-none transition focus:border-[#00ffb4]/35"
                            />
                            <button
                              type="button"
                              onClick={askAI}
                              disabled={aiLoading}
                              className="rounded-xl bg-[#00ffb4] px-4 py-3 text-sm font-bold text-[#0a0e17] transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {aiLoading ? "..." : "Send"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="articton-footer flex justify-center items-center gap-4 border-t border-[#1a2438] px-6 pb-6 pt-4">
              <div className="text-center text-xs text-[#7a8ba8]">
                Click + hold detaches and drags • release inside the field to animate the magnetic seat • Esc releases safely • right drag rotates • wheel zooms • R resets camera
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



