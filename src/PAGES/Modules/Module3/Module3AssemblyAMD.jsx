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
import ProcedureAssistantBubble from "../../../Components/ProcedureAssistantBubble";
import { auth, db, functions } from "../../../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { AchievementToast, unlockAchievement } from "../../../utils/achievements.jsx";
import { formatTutorReply } from "../../../utils/tutorReply.js";

/* ------------------------------------------------------------------ */
/* Module 3 ordered assembly configuration (AMD platform)     */
/* ------------------------------------------------------------------ */

const steps = [
  { key: "cpu", name: "Install CPU on Motherboard", partKey: "cpu" },
  { key: "ram1", name: "Install RAM 1 on Motherboard", partKey: "ram1" },
  { key: "ram2", name: "Install RAM 2 on Motherboard", partKey: "ram2" },
  { key: "ssd", name: "Install SSD on Motherboard", partKey: "ssd" },
  { key: "motherboard", name: "Install Motherboard in Case", partKey: "motherboard" },
  { key: "psu", name: "Install PSU in Case", partKey: "psu" },
  { key: "hdd", name: "Install HDD in Case", partKey: "hdd" },
  { key: "gpu", name: "Install GPU in Case", partKey: "gpu" },
  { key: "final", name: "Full Assembly", partKey: null },
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

const ASSEMBLY_SEQUENCE = steps.map((item) => item.partKey).filter(Boolean);
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

/* These are the final table seats measured during Module 2.
   They are the starting positions for Module 3. The installation target for
   every part remains its original GLB-authored position and orientation. */
const TABLE_STARTS = Object.freeze({
  cpu: { position: [-24.32, -27.331, 85.547], snapDistance: 0.75, magnetDistance: 4.5 },
  ram1: { position: [-53.836, -27.553, 80.307], snapDistance: 0.85, magnetDistance: 5 },
  ram2: { position: [-55.587, -27.596, 75.629], snapDistance: 0.85, magnetDistance: 5 },
  ssd: { position: [-28.53, -13.076, 98.981], snapDistance: 1, magnetDistance: 6 },
  motherboard: { position: [-41.07, -21.537, 54.246], snapDistance: 2, magnetDistance: 11 },
  psu: { position: [-28.697, -2.967, 75.561], snapDistance: 1.6, magnetDistance: 9, preserveTableRotation: true },
  hdd: { position: [-38.289, -9.671, 90.063], snapDistance: 1.25, magnetDistance: 7 },
  gpu: { position: [-41.711, -17.422, 88.557], snapDistance: 1.5, magnetDistance: 9 },
});

const DEFAULT_SNAP_DISTANCE = 1;
const DEFAULT_MAGNET_DISTANCE = 7;
const DEFAULT_MAGNET_STRENGTH = 0.18;
const MOVEMENT_SMOOTHING = 0.72;
const ROTATION_SMOOTHING = 0.18;
const TELEMETRY_FRAME_INTERVAL = 3;
const TELEMETRY_IDLE_FRAME_INTERVAL = 18;
const CAMERA_FOCUS_DURATION_MS = 760;
const ASSEMBLY_UX_VERSION = "Assisted Placement v2";

const LEGACY_STORAGE_KEYS = [
  "module3CompletedStepsAMD",
  "module3AssembledPartsAMD",
];

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


const PART_BY_KEY = Object.freeze(
  Object.fromEntries(PART_MODELS.map((part) => [part.key, part]))
);

function cloneSceneForDisplay(
  scene,
  { disableRaycast = false, enableShadows = true } = {}
) {
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
/* Reusable click-grab-move-click-release assembly interaction         */
/* ------------------------------------------------------------------ */

function InteractiveCenteredObject({
  partKey,
  label,
  modelCenter,
  modelSize,
  startConfig,
  targetFrameRef = null,
  isActive,
  isFullRun = false,
  showGuides = true,
  isCompleted,
  onPartCompleted,
  onLockedPartClick,
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
  const grabStartedAtRef = useRef(0);
  const frameCounterRef = useRef(0);
  const initialHorizontalDistanceRef = useRef(1);
  const magnetStateRef = useRef("idle");
  const magnetNoticeRef = useRef(false);

  const mouseRef = useRef(new THREE.Vector2());
  const raycasterRef = useRef(new THREE.Raycaster());
  const dragPlaneRef = useRef(new THREE.Plane());
  const dragOffsetRef = useRef(new THREE.Vector3());
  const hitPointRef = useRef(new THREE.Vector3());
  const desiredCenterWorldRef = useRef(new THREE.Vector3());
  const desiredCenterLocalRef = useRef(new THREE.Vector3());
  const desiredGroupLocalRef = useRef(new THREE.Vector3());
  const currentCenterLocalRef = useRef(new THREE.Vector3());
  const currentCenterWorldRef = useRef(new THREE.Vector3());
  const cameraDirectionRef = useRef(new THREE.Vector3());
  const worldUpRef = useRef(new THREE.Vector3(0, 1, 0));
  const targetCenterLocalRef = useRef(new THREE.Vector3());
  const targetCenterWorldRef = useRef(new THREE.Vector3());
  const lockedTargetYRef = useRef(0);
  const lineStartRef = useRef(new THREE.Vector3());
  const lineEndRef = useRef(new THREE.Vector3());

  const targetPositionRef = useRef(new THREE.Vector3());
  const targetQuaternionRef = useRef(new THREE.Quaternion());
  const authoredCenterWorldRef = useRef(new THREE.Vector3());
  const authoredCenterLocalRef = useRef(new THREE.Vector3());
  const targetWorldQuaternionRef = useRef(new THREE.Quaternion());
  const parentWorldQuaternionRef = useRef(new THREE.Quaternion());

  const isMovablePart = MOVABLE_COMPONENT_KEYS.has(partKey);
  const canInteract = isMovablePart && (isActive || isCompleted || isFullRun);
  const shouldShowGuides = showGuides && isActive;

  const installedQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const tableQuaternion = useMemo(() => {
    if (startConfig?.preserveTableRotation) return installedQuaternion.clone();
    return getAutomaticLayFlatQuaternion(modelSize);
  }, [installedQuaternion, modelSize, startConfig]);

  const startPosition = startConfig?.position || [0, 0, 0];
  const snapDistance = startConfig?.snapDistance ?? DEFAULT_SNAP_DISTANCE;
  const magnetDistance = startConfig?.magnetDistance ?? DEFAULT_MAGNET_DISTANCE;
  // Keep the magnet at a normal, local range. The exact Y lock remains active,
  // but the part is only pulled when it is genuinely close to the target.
  const captureDistance = magnetDistance;
  const hardSnapDistance = snapDistance;
  const captureRingRadius = THREE.MathUtils.clamp(
    magnetDistance * 0.22,
    0.8,
    4.5
  );

  const setPhaseSafely = useCallback((nextPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const updateMouse = useCallback(
    (event) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    },
    [gl]
  );

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

    if (parent) {
      parent.getWorldQuaternion(parentWorldQuaternionRef.current);
      targetQuaternionRef.current
        .copy(parentWorldQuaternionRef.current)
        .invert()
        .multiply(targetWorldQuaternionRef.current);
    } else {
      targetQuaternionRef.current.copy(targetWorldQuaternionRef.current);
    }

    return {
      position: targetPositionRef.current,
      quaternion: targetQuaternionRef.current,
    };
  }, [modelCenter, targetFrameRef]);

  const getVisualCenters = useCallback((installationTarget) => {
    currentCenterLocalRef.current
      .copy(groupRef.current.position)
      .add(modelCenter);
    targetCenterLocalRef.current
      .copy(installationTarget.position)
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
  }, [modelCenter]);

  const publishTelemetry = useCallback(() => {
    if (!groupRef.current || !isMovablePart || !shouldShowGuides || !onTelemetry) return;

    const installationTarget = computeInstallationTarget();
    const centers = getVisualCenters(installationTarget);
    const horizontalDistance = Math.hypot(
      centers.currentLocal.x - centers.targetLocal.x,
      centers.currentLocal.z - centers.targetLocal.z
    );
    const progress = THREE.MathUtils.clamp(
      1 - horizontalDistance / Math.max(initialHorizontalDistanceRef.current, 0.001),
      0,
      1
    );

    onTelemetry({
      key: partKey,
      label,
      phase: phaseRef.current,
      position: centers.currentWorld.toArray(),
      targetPosition: centers.targetWorld.toArray(),
      distance: horizontalDistance,
      captureDistance,
      hardSnapDistance,
      progress,
      magnetState: magnetStateRef.current,
      yLocked: grabbingRef.current,
    });
  }, [
    captureDistance,
    computeInstallationTarget,
    getVisualCenters,
    hardSnapDistance,
    isMovablePart,
    label,
    onTelemetry,
    partKey,
    shouldShowGuides,
  ]);

  useEffect(() => {
    if (!groupRef.current || !rotationRef.current) return;

    const target = computeInstallationTarget();
    lockedTargetYRef.current = target.position.y;

    if (isCompleted || phaseRef.current === "installed") {
      groupRef.current.position.copy(target.position);
      rotationRef.current.quaternion.copy(target.quaternion);
      setPhaseSafely("installed");
    } else {
      groupRef.current.position.set(...startPosition);
      rotationRef.current.quaternion.copy(tableQuaternion);

    }

    groupRef.current.updateMatrixWorld(true);

    initialHorizontalDistanceRef.current = Math.max(
      Math.hypot(
        groupRef.current.position.x - target.position.x,
        groupRef.current.position.z - target.position.z
      ),
      1
    );

    if (shouldShowGuides) {
      requestAnimationFrame(() => publishTelemetry());
    }
  }, [
    computeInstallationTarget,
    isCompleted,
    publishTelemetry,
    setPhaseSafely,
    shouldShowGuides,
    startPosition,
    tableQuaternion,
  ]);

  useEffect(() => {
    if (!shouldShowGuides) return;
    const id = requestAnimationFrame(() => publishTelemetry());
    return () => cancelAnimationFrame(id);
  }, [publishTelemetry, shouldShowGuides]);

  const reportCompletion = useCallback(() => {
    if (completionReportedRef.current || isCompleted) return;
    completionReportedRef.current = true;
    onPartCompleted(partKey);
  }, [isCompleted, onPartCompleted, partKey]);

  const installObject = useCallback(() => {
    if (!groupRef.current || !rotationRef.current) return;

    const target = computeInstallationTarget();
    groupRef.current.position.copy(target.position);
    rotationRef.current.quaternion.copy(target.quaternion);
    groupRef.current.updateMatrixWorld(true);

    grabbingRef.current = false;
    magnetStateRef.current = "locked";
    magnetNoticeRef.current = false;
    onDragStateChange(false);
    document.body.style.cursor = "default";
    setPhaseSafely("installed");
    onInteractionMessage(
      showGuides
        ? `${label} snapped into place and is now locked. The target height and orientation were corrected automatically.`
        : `${label} installed. Continue the full assembly run.`
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
    showGuides,
  ]);

  const beginGrab = useCallback(
    (event) => {
      if (!groupRef.current) return;
      updateMouse(event);

      const installationTarget = computeInstallationTarget();
      lockedTargetYRef.current = installationTarget.position.y;

      // Apply the Y lock immediately on the first click. The previous version
      // waited for a successful pointer/plane intersection during useFrame,
      // which allowed the CPU to remain below the highlighted socket.
      groupRef.current.position.y = lockedTargetYRef.current;
      groupRef.current.updateMatrixWorld(true);

      const centers = getVisualCenters(installationTarget);

      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      camera.getWorldDirection(cameraDirectionRef.current).normalize();
      const isNearlyParallel =
        Math.abs(raycasterRef.current.ray.direction.dot(worldUpRef.current)) < 0.08;

      if (isNearlyParallel) {
        cameraDirectionRef.current.y =
          cameraDirectionRef.current.y < 0 ? -0.32 : 0.32;
        cameraDirectionRef.current.normalize();
        dragPlaneRef.current.setFromNormalAndCoplanarPoint(
          cameraDirectionRef.current,
          centers.targetWorld
        );
      } else {
        dragPlaneRef.current.setFromNormalAndCoplanarPoint(
          worldUpRef.current,
          centers.targetWorld
        );
      }

      if (
        raycasterRef.current.ray.intersectPlane(
          dragPlaneRef.current,
          hitPointRef.current
        )
      ) {
        dragOffsetRef.current.copy(centers.currentWorld).sub(hitPointRef.current);
        dragOffsetRef.current.y = 0;
      } else {
        dragOffsetRef.current.set(0, 0, 0);
      }

      initialHorizontalDistanceRef.current = Math.max(
        Math.hypot(
          groupRef.current.position.x - installationTarget.position.x,
          groupRef.current.position.z - installationTarget.position.z
        ),
        1
      );

      grabbingRef.current = true;
      magnetStateRef.current = "guiding";
      magnetNoticeRef.current = false;
      grabStartedAtRef.current = performance.now();
      setPhaseSafely("grabbed");
      onDragStateChange(true);
      document.body.style.cursor = "grabbing";
      onInteractionMessage(
        showGuides
          ? `${label} grabbed. It has been raised to the exact height of the highlighted target and is now hard-locked on that Y level. Move only left, right, forward, or backward.`
          : `${label} grabbed. Place it correctly and click again to release.`
      );
      publishTelemetry();
    },
    [
      camera,
      computeInstallationTarget,
      getVisualCenters,
      label,
      onDragStateChange,
      onInteractionMessage,
      publishTelemetry,
      setPhaseSafely,
      showGuides,
      updateMouse,
    ]
  );

  const releaseObject = useCallback(() => {
    if (!grabbingRef.current || !groupRef.current) return;

    grabbingRef.current = false;
    onDragStateChange(false);
    document.body.style.cursor = "default";

    const target = computeInstallationTarget();
    const horizontalDistance = Math.hypot(
      groupRef.current.position.x - target.position.x,
      groupRef.current.position.z - target.position.z
    );
    const releaseSnapDistance = snapDistance * 1.25;

    if (horizontalDistance <= releaseSnapDistance) {
      installObject();
      return;
    }

    magnetStateRef.current = "idle";
    magnetNoticeRef.current = false;
    setPhaseSafely("released");
    onInteractionMessage(
      showGuides
        ? `${label} released. Its Y level remains aligned with the highlight. Click it again and move it closer to the target center.`
        : `${label} released. Try placing it again.`
    );
    publishTelemetry();
  }, [
    computeInstallationTarget,
    installObject,
    label,
    onDragStateChange,
    onInteractionMessage,
    publishTelemetry,
    setPhaseSafely,
    showGuides,
    snapDistance,
  ]);

  useEffect(() => {
    const handlePointerMove = (event) => updateMouse(event);
    gl.domElement.addEventListener("pointermove", handlePointerMove);
    return () =>
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
  }, [gl, updateMouse]);

  useEffect(() => {
    if (phase !== "grabbed") return undefined;

    const handleReleaseClick = (event) => {
      if (event.button !== 0) return;
      if (performance.now() - grabStartedAtRef.current < 140) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      releaseObject();
    };

    gl.domElement.addEventListener("pointerdown", handleReleaseClick, true);
    return () =>
      gl.domElement.removeEventListener("pointerdown", handleReleaseClick, true);
  }, [gl, phase, releaseObject]);

  useEffect(() => {
    const cancelGrab = () => {
      if (!grabbingRef.current) return;
      grabbingRef.current = false;
      magnetStateRef.current = "idle";
      magnetNoticeRef.current = false;
      onDragStateChange(false);
      document.body.style.cursor = "default";
      setPhaseSafely("released");
    };

    window.addEventListener("pointercancel", cancelGrab);
    window.addEventListener("blur", cancelGrab);
    return () => {
      window.removeEventListener("pointercancel", cancelGrab);
      window.removeEventListener("blur", cancelGrab);
      if (grabbingRef.current) onDragStateChange(false);
      document.body.style.cursor = "default";
    };
  }, [onDragStateChange, setPhaseSafely]);

  useFrame(({ clock }) => {
    if (!groupRef.current || !rotationRef.current) return;

    const installationTarget = computeInstallationTarget();
    const centers = getVisualCenters(installationTarget);
    const horizontalDistance = Math.hypot(
      centers.currentLocal.x - centers.targetLocal.x,
      centers.currentLocal.z - centers.targetLocal.z
    );
    const proximity = THREE.MathUtils.clamp(
      1 - horizontalDistance / captureDistance,
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
        tetherMaterialRef.current.opacity = 0.28 + proximity * 0.65;
        tetherMaterialRef.current.color.set(
          proximity > 0.65 ? "#ffffff" : "#00ffb4"
        );
      }

      if (captureRingRef.current) {
        captureRingRef.current.visible = true;
        captureRingRef.current.position.copy(centers.targetLocal);
        const pulse = 1 + Math.sin(clock.elapsedTime * 4.5) * 0.055;
        captureRingRef.current.scale.setScalar(pulse);
      }

      if (captureRingMaterialRef.current) {
        captureRingMaterialRef.current.opacity = 0.12 + proximity * 0.28;
      }
    } else {
      if (tetherRef.current) tetherRef.current.visible = false;
      if (captureRingRef.current) captureRingRef.current.visible = false;
    }

    if (grabbingRef.current) {
      lockedTargetYRef.current = installationTarget.position.y;

      // Enforce the lock every frame, even when the pointer ray temporarily
      // misses the drag plane. This makes the Y lock independent of camera
      // angle, zoom level, pointer speed, and ray/plane intersection success.
      groupRef.current.position.y = lockedTargetYRef.current;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      if (
        raycasterRef.current.ray.intersectPlane(
          dragPlaneRef.current,
          hitPointRef.current
        )
      ) {
        desiredCenterWorldRef.current
          .copy(hitPointRef.current)
          .add(dragOffsetRef.current);

        desiredCenterLocalRef.current.copy(desiredCenterWorldRef.current);
        const parent = groupRef.current.parent;
        if (parent) parent.worldToLocal(desiredCenterLocalRef.current);

        desiredGroupLocalRef.current
          .copy(desiredCenterLocalRef.current)
          .sub(modelCenter);

        // Hard Y lock: the draggable model origin is always corrected so its
        // visual center stays on the exact same Y level as the target center.
        desiredGroupLocalRef.current.y = lockedTargetYRef.current;

        const desiredDistance = Math.hypot(
          desiredGroupLocalRef.current.x - installationTarget.position.x,
          desiredGroupLocalRef.current.z - installationTarget.position.z
        );

        // Normal magnet behavior: no long-range guidance and no oversized
        // capture zone. The pull begins only inside this part's magnetDistance.
        if (desiredDistance < magnetDistance) {
          const normalizedPull = 1 - desiredDistance / magnetDistance;
          const pull = THREE.MathUtils.clamp(
            DEFAULT_MAGNET_STRENGTH + normalizedPull * 0.42,
            0,
            0.68
          );

          desiredGroupLocalRef.current.lerp(
            installationTarget.position,
            pull
          );
          desiredGroupLocalRef.current.y = lockedTargetYRef.current;

          rotationRef.current.quaternion.slerp(
            installationTarget.quaternion,
            THREE.MathUtils.clamp(pull + 0.08, 0, 0.76)
          );

          magnetStateRef.current =
            desiredDistance <= magnetDistance * 0.45
              ? "strong"
              : "engaged";

          if (showGuides && !magnetNoticeRef.current) {
            magnetNoticeRef.current = true;
            onInteractionMessage(
              `Magnet engaged for ${label}. Move closer to the center for the final snap.`
            );
          }
        } else {
          magnetStateRef.current = "idle";
          magnetNoticeRef.current = false;
          rotationRef.current.quaternion.slerp(
            tableQuaternion,
            ROTATION_SMOOTHING
          );
        }

        groupRef.current.position.lerp(
          desiredGroupLocalRef.current,
          MOVEMENT_SMOOTHING
        );
        groupRef.current.position.y = lockedTargetYRef.current;

        const currentDistance = Math.hypot(
          groupRef.current.position.x - installationTarget.position.x,
          groupRef.current.position.z - installationTarget.position.z
        );

        if (currentDistance <= snapDistance) {
          magnetStateRef.current = "auto-snap";
          installObject();
          return;
        }
      }
    } else if (shouldShowGuides && phaseRef.current === "released") {
      // After the user has grabbed the part once, keep the target-height lock
      // active between attempts. A newly selected part remains at its authored
      // table position until the first click, so it never disappears before
      // the learner can see or grab it.
      lockedTargetYRef.current = installationTarget.position.y;
      groupRef.current.position.y = lockedTargetYRef.current;
    } else if (phaseRef.current === "installed") {
      groupRef.current.position.lerp(installationTarget.position, 0.42);
      rotationRef.current.quaternion.slerp(
        installationTarget.quaternion,
        0.42
      );
    }

    frameCounterRef.current += 1;
    const interval = grabbingRef.current
      ? TELEMETRY_FRAME_INTERVAL
      : TELEMETRY_IDLE_FRAME_INTERVAL;
    if (shouldShowGuides && frameCounterRef.current % interval === 0) {
      publishTelemetry();
    }
  });

  const handlePointerDown = useCallback(
    (event) => {
      if (!isMovablePart) return;
      event.stopPropagation();

      if (!canInteract) {
        onLockedPartClick(partKey);
        return;
      }

      if (phaseRef.current === "ready" || phaseRef.current === "released") {
        beginGrab(event);
        return;
      }

      if (phaseRef.current === "installed") {
        onInteractionMessage(`${label} is already installed and locked.`);
      }
    },
    [
      beginGrab,
      canInteract,
      isMovablePart,
      label,
      onInteractionMessage,
      onLockedPartClick,
      partKey,
    ]
  );

  const handlePointerOver = useCallback(
    (event) => {
      if (!isMovablePart) return;
      event.stopPropagation();

      if (!canInteract) {
        document.body.style.cursor = "not-allowed";
      } else if (phaseRef.current === "installed") {
        document.body.style.cursor = "default";
      } else {
        document.body.style.cursor = "grab";
      }
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
        <ringGeometry
          args={[captureRingRadius * 0.72, captureRingRadius, 64]}
        />
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
  isActive,
  isFullRun = false,
  showGuides = true,
  isCompleted,
  onPartCompleted,
  onLockedPartClick,
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
      isActive={isActive}
      isFullRun={isFullRun}
      showGuides={showGuides}
      isCompleted={isCompleted}
      onPartCompleted={onPartCompleted}
      onLockedPartClick={onLockedPartClick}
      onInteractionMessage={onInteractionMessage}
      onDragStateChange={onDragStateChange}
      onTelemetry={onTelemetry}
    >
      <primitive object={clone} dispose={null} />
    </InteractiveCenteredObject>
  );
}

/* ------------------------------------------------------------------ */
/* Pulsing installation highlight at the GLB-authored target           */
/* ------------------------------------------------------------------ */


function InstallationTargetGuide({ part }) {
  const { scene } = useGLTF(encodeURI(part.path));
  const pulseRef = useRef(null);
  const markerRef = useRef(null);

  const guideData = useMemo(() => {
    const fillScene = scene.clone(true);
    const wireScene = scene.clone(true);
    const fillMaterials = [];
    const wireMaterials = [];

    fillScene.traverse((object) => {
      if (!object.isMesh) return;
      object.raycast = () => null;
      object.renderOrder = 1000;
      const material = new THREE.MeshBasicMaterial({
        color: "#00ffb4",
        transparent: true,
        opacity: part.key === "cpu" ? 0.04 : 0.09,
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
      object.renderOrder = 1001;
      const material = new THREE.MeshBasicMaterial({
        color: "#7dffdc",
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
    const callout = new THREE.Vector3(
      center.x + Math.max(size.x * 0.82, 0.95),
      center.y + Math.max(size.y * 1.25, 0.95),
      center.z + Math.max(size.z * 0.45, 0.55)
    );

    return {
      fillScene,
      wireScene,
      fillMaterials,
      wireMaterials,
      center,
      size,
      callout,
    };
  }, [part.key, scene]);

  useEffect(() => {
    return () => {
      [...guideData.fillMaterials, ...guideData.wireMaterials].forEach(
        (material) => material.dispose()
      );
    };
  }, [guideData]);

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.elapsedTime * 3.5) + 1) / 2;

    if (pulseRef.current) {
      pulseRef.current.scale.setScalar(0.985 + pulse * 0.03);
    }
    guideData.fillMaterials.forEach((material) => {
      material.opacity = (part.key === "cpu" ? 0.025 : 0.05) + pulse * 0.09;
    });
    guideData.wireMaterials.forEach((material) => {
      material.opacity = 0.5 + pulse * 0.34;
    });

    if (markerRef.current?.material) {
      markerRef.current.material.opacity = 0.35 + pulse * 0.55;
    }
  });

  const markerRadius = THREE.MathUtils.clamp(
    Math.max(guideData.size.x, guideData.size.y, guideData.size.z) * 0.16,
    0.18,
    2.5
  );

  return (
    <group>
      <group ref={pulseRef}>
        <primitive object={guideData.fillScene} dispose={null} />
        <primitive object={guideData.wireScene} dispose={null} />
      </group>

      <mesh ref={markerRef} position={guideData.center.toArray()} renderOrder={1002}>
        <sphereGeometry args={[markerRadius, 24, 16]} />
        <meshBasicMaterial
          color="#00ffb4"
          transparent
          opacity={0.7}
          wireframe
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      <Html
        center
        position={guideData.callout.toArray()}
        transform
        sprite
        distanceFactor={11}
        occlude={false}
        style={{ pointerEvents: "none" }}
      >
        <div className="whitespace-nowrap rounded-xl border border-[#00ffb4]/40 bg-[#07111d]/95 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#73ffd4] shadow-[0_12px_35px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <span className="mr-2 inline-flex rounded-full border border-[#00ffb4]/35 bg-[#00ffb4]/12 px-2 py-0.5 text-[8px]">TARGET</span>
          Install {COMPONENT_LABELS[part.key]} here
        </div>
      </Html>
    </group>
  );
}

function MotherboardUnit({
  contentFrameRef,
  activePartKey,
  isFullRun = false,
  showGuides = true,
  completedParts,
  onPartCompleted,
  onLockedPartClick,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
}) {
  const part = PART_BY_KEY.motherboard;
  const { scene } = useGLTF(encodeURI(part.path));
  const motherboardClone = useMemo(
    () => cloneSceneForDisplay(scene),
    [scene]
  );
  const bounds = useMemo(
    () => getModelBounds(motherboardClone),
    [motherboardClone]
  );

  const activeChildPart = MOTHERBOARD_CHILD_KEYS.has(activePartKey)
    ? PART_BY_KEY[activePartKey]
    : null;

  return (
    <InteractiveCenteredObject
      partKey="motherboard"
      label="Motherboard"
      modelCenter={bounds.center}
      modelSize={bounds.size}
      startConfig={TABLE_STARTS.motherboard}
      isActive={activePartKey === "motherboard"}
      isFullRun={isFullRun}
      showGuides={showGuides}
      isCompleted={completedParts.includes("motherboard")}
      onPartCompleted={onPartCompleted}
      onLockedPartClick={onLockedPartClick}
      onInteractionMessage={onInteractionMessage}
      onDragStateChange={onDragStateChange}
      onTelemetry={onTelemetry}
      contentFrameRef={contentFrameRef}
    >
      <primitive object={motherboardClone} dispose={null} />

      {["cpu", "ram1", "ram2", "ssd"].map((key) =>
        completedParts.includes(key) ? (
          <StaticAuthoredModel
            key={`installed-${key}`}
            part={PART_BY_KEY[key]}
            disableRaycast
          />
        ) : null
      )}

      {showGuides && activeChildPart ? (
        <InstallationTargetGuide
          key={`motherboard-target-${activeChildPart.key}`}
          part={activeChildPart}
        />
      ) : null}
    </InteractiveCenteredObject>
  );
}

function Loader() {
  return (
    <Html center>
      <div className="rounded-xl border border-[#1a2438] bg-[#0b1220]/90 px-4 py-2 text-xs font-semibold text-[#00ffb4]">
        Loading assembly scene...
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
    console.error("Failed to load one or more Module 3 models:", error);
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
  activePartKey,
  isFullRun = false,
  showGuides = true,
  completedParts,
  onPartCompleted,
  onLockedPartClick,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
}) {
  const motherboardContentRef = useRef(null);

  return (
    <group ref={rootRef}>
      <StaticAuthoredModel part={PART_BY_KEY.table} disableRaycast />
      <StaticAuthoredModel part={PART_BY_KEY.case} disableRaycast />

      <MotherboardUnit
        contentFrameRef={motherboardContentRef}
        activePartKey={activePartKey}
        isFullRun={isFullRun}
        showGuides={showGuides}
        completedParts={completedParts}
        onPartCompleted={onPartCompleted}
        onLockedPartClick={onLockedPartClick}
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
            targetFrameRef={
              isMotherboardChild ? motherboardContentRef : null
            }
            isActive={activePartKey === key}
            isFullRun={isFullRun}
            showGuides={showGuides}
            isCompleted={completedParts.includes(key)}
            onPartCompleted={onPartCompleted}
            onLockedPartClick={onLockedPartClick}
            onInteractionMessage={onInteractionMessage}
            onDragStateChange={onDragStateChange}
            onTelemetry={onTelemetry}
          />
        );
      })}

      {showGuides &&
      activePartKey &&
      !MOTHERBOARD_CHILD_KEYS.has(activePartKey) &&
      PART_BY_KEY[activePartKey] ? (
        <InstallationTargetGuide
          key={`case-target-${activePartKey}`}
          part={PART_BY_KEY[activePartKey]}
        />
      ) : null}
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
      const verticalDistance =
        (sceneSize.y * 0.72) / Math.max(Math.tan(verticalFov / 2), 0.2);
      const horizontalDistance =
        (sceneSize.x * 0.72) / Math.max(Math.tan(horizontalFov / 2), 0.2);
      const depthDistance = sceneSize.z * 0.9;
      const distance = Math.max(
        verticalDistance,
        horizontalDistance,
        depthDistance,
        12
      );

      // Elevated diagonal direction preserves a useful bird's-eye view while
      // keeping every loose component, the motherboard, case, and full table
      // inside the viewport on both wide and smaller screens.
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
  activePartKey,
  isFullRun = false,
  showGuides = true,
  completedParts,
  onPartCompleted,
  onLockedPartClick,
  onInteractionMessage,
}) {
  const [isDraggingPart, setIsDraggingPart] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [overviewRequest, setOverviewRequest] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef(null);
  const controlsRef = useRef(null);
  const sceneRootRef = useRef(null);

  useEffect(() => {
    // Changing steps must not zoom into one item. Keep the whole-table view
    // stable so the next loose component is immediately visible.
    setTelemetry(null);
  }, [activePartKey]);

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
      className={[
        "relative h-full w-full overflow-hidden bg-[#070c14]",
        isFullscreen ? "rounded-none" : "",
      ].join(" ")}
      style={isFullscreen ? { width: "100vw", height: "100vh" } : undefined}
    >
      <Canvas
        camera={{ position: [35, 72, 52], fov: 46, near: 0.01, far: 1400 }}
        dpr={[1, 1.45]}
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
        <hemisphereLight args={["#ffffff", "#182338", 1.12]} />
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[6, 10, 7]}
          intensity={1.72}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-5, 4, 2]} intensity={0.65} />

        <ModelErrorBoundary parts={PART_MODELS}>
          <Suspense fallback={<Loader />}>
            <AssemblyScene
              rootRef={sceneRootRef}
              activePartKey={activePartKey}
              isFullRun={isFullRun}
              showGuides={showGuides}
              completedParts={completedParts}
              onPartCompleted={onPartCompleted}
              onLockedPartClick={onLockedPartClick}
              onInteractionMessage={onInteractionMessage}
              onDragStateChange={setIsDraggingPart}
              onTelemetry={setTelemetry}
            />
          </Suspense>
        </ModelErrorBoundary>

        <FullTableBirdEyeCamera
          sceneRootRef={sceneRootRef}
          controlsRef={controlsRef}
          overviewRequest={overviewRequest}
        />

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
          mouseButtons={{
            LEFT: null,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
        />
      </Canvas>

      <div className="absolute left-4 top-4 z-[80] flex max-w-[calc(100%-180px)] flex-wrap gap-2">
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

      {showGuides && telemetry ? (
        <div className="pointer-events-none absolute bottom-4 left-4 z-[80] w-[min(320px,calc(100%-32px))] rounded-2xl border border-[#00ffb4]/25 bg-[#0b1220]/94 px-4 py-3 text-[11px] leading-5 text-[#dbe6f5] shadow-[0_12px_35px_rgba(0,0,0,0.4)] backdrop-blur-xl">
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
            <span>Target distance: {telemetry.distance.toFixed(2)}</span>
            <span>{telemetry.yLocked ? "Y locked" : "Ready"}</span>
          </div>
          <div className="mt-1 text-[10px] text-[#7a8ba8]">
            Exact target-height lock remains active. The normal magnet engages only near the installation point.
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header, background, and ordered sidebar                             */
/* ------------------------------------------------------------------ */

function HeaderDropdown({
  userName,
  userEmail = "",
  onBack,
  onLogout,
  setIsSettingsOpen,
}) {
  const handleBack = () => {
    if (typeof onBack === "function") onBack("Modules");
  };

  return (
    <div className="relative flex flex-wrap items-center justify-end gap-3">
      <button
        type="button"
        onClick={handleBack}
        className="relative z-[70] rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-2.5 text-[13px] font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06]"
      >
        Go back to Dashboard
      </button>

      <details className="group relative z-50">
        <summary className="list-none cursor-pointer rounded-2xl border border-[#1a2438] bg-[#0d1220]/95 px-3 py-2.5 transition hover:bg-[#111b2f]">
          <div className="flex max-w-[230px] items-center justify-end gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 text-sm font-bold text-[#00ffb4]">
              {(userName || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 leading-tight text-left">
              <div className="truncate text-sm font-semibold text-white">{userName}</div>
              <div className="text-[11px] text-[#7a8ba8]">Profile</div>
            </div>
            <div className="text-sm text-[#7a8ba8] transition group-open:rotate-180">
              ▾
            </div>
          </div>
        </summary>

        <div className="absolute right-0 top-full z-[220] mt-2 w-52 rounded-2xl border border-[#1a2438] bg-[#0d1220]/98 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
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
      className={[
        "absolute left-0 top-0 z-[200] h-full transition-all duration-300",
        open ? "w-[clamp(220px,22vw,280px)]" : "w-[64px]",
      ].join(" ")}
    >
      <div className="flex h-full min-h-0 flex-col border-r border-[#1a2438] bg-[#0b1220]/92 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#1a2438] px-4 py-4">
          {open ? (
            <div>
              <div className="text-sm font-bold text-white">Assembly Steps</div>
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
          className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 pr-2 [scrollbar-color:rgba(0,255,180,0.35)_rgba(255,255,255,0.05)] [scrollbar-width:thin]"
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
                  "flex w-full scroll-m-3 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
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
          <div className="shrink-0 border-t border-[#1a2438] p-3">
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

        <div className="shrink-0 border-t border-[#1a2438] p-3">
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
              ? "Install the CPU, memory, and storage onto the motherboard first, then seat the motherboard in the case and finish with the PSU, HDD, and GPU. Use the top-down workspace, exact target-height assistance, and magnetic snap guidance to keep each component aligned and seated correctly."
              : "Remove each component in order. The camera first identifies the installed part, then opens to the table workspace after detachment."}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#00ffb4]">1. Identify</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">
                Find the next component and its installation location in the workspace.
              </div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#00ffb4]">2. Move</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">
                Click to grab, align the part carefully, and release when it snaps into place.
              </div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#00ffb4]">3. Complete</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">
                Confirm each step and keep the sequence correct, including CPU seating, thermal-paste area awareness, and power connector positioning.
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


function StepCompletionCard({
  platform,
  moduleType,
  stepNumber,
  totalSteps,
  label,
  nextLabel,
  isFinal,
  onContinue,
  onCertificate,
}) {
  const isAssembly = moduleType === "Assembly";
  const actionWord = isAssembly ? "installed" : "removed and seated";
  const title = isAssembly
    ? `${label} Installation Complete`
    : `${label} Disassembly Complete`;

  return (
    <div
      className="absolute inset-0 z-[780] flex items-center justify-center bg-[#050912]/82 p-5 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-completion-title"
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[30px] border border-[#00ffb4]/35 bg-[#0b1220]/97 p-7 shadow-[0_40px_120px_rgba(0,0,0,0.76),0_0_70px_rgba(0,255,180,0.10)] md:p-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(0,255,180,0.16),transparent_42%)]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full border border-[#00ffb4]/15 bg-[#00ffb4]/5 blur-2xl" />

        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#00ffb4]/30 bg-[#00ffb4]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#73ffd4]">
              Step {stepNumber} of {totalSteps} Complete
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9fb0ca]">
              {platform} Platform
            </div>
          </div>

          <div className="mt-6 flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#00ffb4]/40 bg-[#00ffb4]/12 text-3xl font-black text-[#00ffb4] shadow-[0_0_34px_rgba(0,255,180,0.18)]">
              ✓
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#00ffb4]">
                Excellent Work
              </div>
              <h2
                id="step-completion-title"
                className="mt-2 text-2xl font-black leading-tight text-white md:text-4xl"
              >
                {title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#9fb0ca]">
                You correctly {actionWord} the {label}. The component is locked in its completed position and your progress has been updated.
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.035] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00ffb4]">Accuracy</div>
              <div className="mt-2 text-sm font-bold text-white">Correct placement</div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.035] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00ffb4]">Progress</div>
              <div className="mt-2 text-sm font-bold text-white">Step saved</div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.035] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00ffb4]">Next</div>
              <div className="mt-2 truncate text-sm font-bold text-white">
                {isFinal ? `Full ${moduleType}` : nextLabel}
              </div>
            </div>
          </div>

          <div className="mt-7 rounded-2xl border border-[#00ffb4]/18 bg-[#00ffb4]/6 px-4 py-3 text-xs leading-6 text-[#b7c6dd]">
            {isFinal
              ? `All required ${moduleType.toLowerCase()} steps are complete. You may review the finished scene or open your certificate.`
              : `The next component remains locked until you continue, so the sequence stays clear and controlled.`}
          </div>

          <div className="mt-7 flex flex-wrap justify-end gap-3">
            {isFinal ? (
              <>
                <button
                  type="button"
                  onClick={onContinue}
                  className="rounded-2xl border border-[#1a2438] bg-white/[0.04] px-5 py-3 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.08]"
                >
                  Review Full {moduleType}
                </button>
                <button
                  type="button"
                  onClick={onCertificate}
                  className="rounded-2xl bg-[#00ffb4] px-6 py-3 text-sm font-black text-[#07111d] shadow-[0_16px_45px_rgba(0,255,180,0.18)] transition hover:scale-[1.02]"
                >
                  View Certificate →
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onContinue}
                className="rounded-2xl bg-[#00ffb4] px-6 py-3 text-sm font-black text-[#07111d] shadow-[0_16px_45px_rgba(0,255,180,0.18)] transition hover:scale-[1.02]"
              >
                Continue to {nextLabel} →
              </button>
            )}
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
/* Main Module 3 component                                             */
/* ------------------------------------------------------------------ */

export default function Module3AssemblyAMD({
  onFinish,
  onBack,
  onLogout,
  onSwitchPlatform,
}) {
  const [step, setStep] = useState(0);
  const [completedParts, setCompletedParts] = useState([]);
  const [sceneRevision, setSceneRevision] = useState(0);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [finalAssemblyRun, setFinalAssemblyRun] = useState(false);
  const [pendingStepCompletion, setPendingStepCompletion] = useState(null);
  const [validationMessage, setValidationMessage] = useState(
    "Begin with the CPU. Click it once to activate Y-level assist, then guide it across the green target plane. The normal magnet will assist only when it is close to the target. In a real build, this step also includes the CPU seating area, thermal paste preparation, and the CPU power cable connection."
  );
  const [achievementToast, setAchievementToast] = useState(null);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I am your Module 3 PC Assembly assistant (AMD).",
    },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [settings, setSettings] = useState({
    sound: true,
    animations: true,
    darkMode: true,
  });

  const currentStep = steps[step];
  const activePartKey = finalAssemblyRun ? null : currentStep?.partKey || null;
  const activePartLabel = activePartKey
    ? COMPONENT_LABELS[activePartKey]
    : null;
  const allComponentsInstalled =
    completedParts.length === ASSEMBLY_SEQUENCE.length;

  const effectiveCompletedSteps = useMemo(
    () =>
      Object.fromEntries(
        steps.map((item) => [
          item.key,
          item.partKey
            ? completedParts.includes(item.partKey)
            : allComponentsInstalled,
        ])
      ),
    [allComponentsInstalled, completedParts]
  );

  const currentStepCompleted =
    currentStep?.key === "final" && allComponentsInstalled;

  const canSelectStep = useCallback((index) => index <= step, [step]);

  const handleSettingChange = (key, value) => {
    setSettings((previous) => ({ ...previous, [key]: value }));
  };

  const resetScene = useCallback(() => {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    setCompletedParts([]);
    setStep(0);
    setSceneRevision((value) => value + 1);
    setShowCertificate(false);
    setShowIntro(true);
    setFinalAssemblyRun(false);
    setPendingStepCompletion(null);
    setValidationMessage(
      "Scene restarted. Click the CPU once; Y-level assist will align it with the target height and the normal magnet will assist near the target as you work through CPU, RAM, SSD, motherboard, PSU, HDD, and GPU placement."
    );
  }, []);

  useEffect(() => {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setFirebaseUser(null);
        setProfile(null);
        return;
      }

      setFirebaseUser(currentUser);
      try {
        const userReference = doc(db, "users", currentUser.uid);
        const snapshot = await getDoc(userReference);
        if (snapshot.exists()) setProfile(snapshot.data());
      } catch (error) {
        console.error("Error fetching Module 3 (AMD) profile:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  const user = {
    name: profile
      ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
        "User"
      : "Loading...",
    email: firebaseUser?.email || "No email",
  };

  const saveFinalCompletion = useCallback(async () => {
    if (!firebaseUser) return;

    try {
      const completedSteps = Object.fromEntries(
        steps.map((item) => [item.key, true])
      );
      const userReference = doc(db, "users", firebaseUser.uid);

      await setDoc(
        userReference,
        {
          moduleProgress: {
            module3AMD: {
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
      const achievement = await unlockAchievement(firebaseUser.uid, "module3", { platform: "AMD" });
      setAchievementToast(achievement);
      window.setTimeout(() => setAchievementToast(null), 4200);
    } catch (error) {
      console.error(
        "Error saving final Module 3 (AMD) completion:",
        error
      );
    }
  }, [firebaseUser]);

  const handlePartCompleted = useCallback(
    (partKey) => {
      if (
        pendingStepCompletion ||
        (!finalAssemblyRun && partKey !== activePartKey) ||
        completedParts.includes(partKey)
      ) {
        return;
      }

      const nextCompletedParts = [...completedParts, partKey];
      const finished = nextCompletedParts.length === ASSEMBLY_SEQUENCE.length;

      if (finalAssemblyRun) {
        setCompletedParts(nextCompletedParts);
        playCompletionSound(settings.sound, finished);
        setValidationMessage(
          finished
            ? "Full assembly run complete. Your certificate is ready."
            : `${nextCompletedParts.length} of ${ASSEMBLY_SEQUENCE.length} parts installed.`
        );

        if (finished) {
          void saveFinalCompletion();
          setShowCertificate(true);
        }
        return;
      }

      const nextStepIndex = finished ? steps.length - 1 : step + 1;
      const nextPartKey = finished ? null : steps[nextStepIndex]?.partKey;

      setCompletedParts(nextCompletedParts);
      playCompletionSound(settings.sound, finished);
      setValidationMessage(
        finished
          ? `${COMPONENT_LABELS[partKey]} installed. Full assembly is now complete.`
          : `${COMPONENT_LABELS[partKey]} installed correctly. Confirm the completion card to continue.`
      );
      setPendingStepCompletion({
        partKey,
        label: COMPONENT_LABELS[partKey],
        completedStepIndex: step,
        nextStepIndex,
        nextLabel: finished ? "Full Assembly" : COMPONENT_LABELS[nextPartKey],
        isFinal: finished,
      });
    },
    [
      activePartKey,
      completedParts,
      finalAssemblyRun,
      pendingStepCompletion,
      saveFinalCompletion,
      settings.sound,
      step,
    ]
  );

  const handleContinueAfterStep = useCallback(
    (openCertificate = false) => {
      if (!pendingStepCompletion) return;

      const completed = pendingStepCompletion;
      setPendingStepCompletion(null);
      setStep(completed.nextStepIndex);

      if (completed.isFinal) {
        setCompletedParts([]);
        setFinalAssemblyRun(true);
        setStep(steps.length - 1);
        setSceneRevision((value) => value + 1);
        setValidationMessage(
          "Full assembly run started. No guide cards or target highlights are active."
        );
        return;
      }

      setValidationMessage(
        `${completed.label} installation complete. Next: ${completed.nextLabel}.`
      );
    },
    [pendingStepCompletion]
  );

  const handleLockedPartClick = useCallback(
    (partKey) => {
      const clickedLabel = COMPONENT_LABELS[partKey] || "This component";
      setValidationMessage(
        `${clickedLabel} is locked. Install ${activePartLabel || "the current component"} first.`
      );
    },
    [activePartLabel]
  );

  const handleSelectStep = useCallback(
    (index) => {
      if (index === step) return;

      if (index > step) {
        setValidationMessage(
          `That step is locked. Install ${activePartLabel || "the current component"} first.`
        );
      } else {
        setValidationMessage(
          "Completed components remain installed. Continue from the current highlighted assembly step."
        );
      }
    },
    [activePartLabel, step]
  );

  const askAI = async () => {
    if (!aiInput.trim()) return;

    const userMessage = { role: "user", content: aiInput };
    setAiMessages((previous) => [...previous, userMessage]);
    setAiLoading(true);

    try {
      const askModuleTutor = httpsCallable(functions, "askModuleTutor");
      const response = await askModuleTutor({
        message: aiInput,
        context: {
          mode: "assembly",
          moduleNumber: 3,
          platform: "amd",
          currentStep: currentStep?.name,
          activeComponent: activePartLabel,
          completedParts,
        },
      });

      setAiMessages((previous) => [
        ...previous,
        { role: "assistant", content: formatTutorReply(response.data) },
      ]);
    } catch (error) {
      console.error(error);
      setAiMessages((previous) => [
        ...previous,
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
        moduleNumber="3"
        moduleType="Assembly"
        description="You completed the ordered installation of the CPU, two RAM modules, SSD, motherboard, PSU, HDD, and GPU."
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
      <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-[#0a0e17] font-sans text-[#e8ecf4] antialiased">
      <div className="relative h-full w-full overflow-hidden">
        <ModuleBackground />
        <AchievementToast achievement={achievementToast} onClose={() => setAchievementToast(null)} />

        {showIntro ? (
          <ModuleIntroCard
            platform="AMD"
            moduleType="Assembly"
            onStart={() => setShowIntro(false)}
          />
        ) : null}

        {pendingStepCompletion ? (
          <StepCompletionCard
            platform="AMD"
            moduleType="Assembly"
            stepNumber={pendingStepCompletion.completedStepIndex + 1}
            totalSteps={ASSEMBLY_SEQUENCE.length}
            label={pendingStepCompletion.label}
            nextLabel={pendingStepCompletion.nextLabel}
            isFinal={pendingStepCompletion.isFinal}
            onContinue={() => handleContinueAfterStep(false)}
            onCertificate={() => handleContinueAfterStep(true)}
          />
        ) : null}

        <div className="relative flex h-full w-full flex-col overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(0,255,180,0.08),transparent_35%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_20%,rgba(0,255,180,0.05),transparent_30%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,180,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,180,0.025)_1px,transparent_1px)] bg-[size:54px_54px] opacity-55" />

          <div className="relative flex h-full w-full flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 text-[12px] text-[#7a8ba8] md:px-10">
              <div>
                Module 3 — <span className="text-[#dbe6f5]">Assembly (AMD)</span>
              </div>
              <div className="rounded-lg border border-[#1a2438] bg-white/[0.03] px-2 py-1 text-[11px]">
                Step {step + 1} of {steps.length}
              </div>
            </div>

            <div className="relative z-[120] mt-3 px-6 md:px-10">
              <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-[22px] border border-[#1a2438] bg-[#0b1220]/86 px-6 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.30)] backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-end gap-3">
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
                      AMD Assembly View
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  {validationMessage ? (
                    <div className="max-w-[540px] rounded-2xl border border-[#00ffb4]/20 bg-[#00ffb4]/8 px-4 py-2 text-xs font-semibold text-[#dffef5]">
                      {validationMessage}
                    </div>
                  ) : null}

                  <HeaderDropdown
                    userName={user.name}
                    userEmail={user.email}
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

            <div className="px-6 pt-4 md:px-10">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#1a2438] bg-[#0b1220]/72 px-5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {finalAssemblyRun ? "Full Assembly Run" : currentStep?.name}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[#7a8ba8]">
                    {finalAssemblyRun
                      ? `${completedParts.length} of ${ASSEMBLY_SEQUENCE.length} parts installed - full run, no target highlights`
                      : activePartLabel
                      ? `Click ${activePartLabel} to grab • align it carefully with the target • use Y-level lock and magnet assist near the seating point • click again to release`
                      : "Assembly complete • review the PC or open the certificate"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {steps.map((item, index) => (
                    <div
                      key={item.key}
                      className={`h-2.5 w-9 rounded-full transition ${
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

            <div className="min-h-0 flex-1 px-4 py-4 md:px-8 md:py-5">
              <div className="relative h-full overflow-hidden rounded-[24px] border border-[#1a2438] bg-[#0d1220]/78 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
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
                  className="absolute bottom-3 right-3 top-3 z-[40] overflow-hidden rounded-[18px] border border-[#1a2438] bg-black/20 transition-all duration-300 md:bottom-4 md:right-4 md:top-4"
                  style={{ left: sidebarOpen ? "clamp(220px, 22vw, 280px)" : 64 }}
                >
                  <ModelViewer
                    key={sceneRevision}
                    activePartKey={activePartKey}
                    isFullRun={finalAssemblyRun}
                    showGuides={!finalAssemblyRun}
                    completedParts={completedParts}
                    onPartCompleted={handlePartCompleted}
                    onLockedPartClick={handleLockedPartClick}
                    onInteractionMessage={setValidationMessage}
                  />

                  <ProcedureAssistantBubble
                    mode="assembly"
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
                    {!aiOpen ? (
                      <button
                        type="button"
                        onClick={() => setAiOpen(true)}
                        className="rounded-2xl border border-[#00ffb4]/25 bg-[#0b1220]/90 px-4 py-3 text-sm font-semibold text-[#00ffb4] shadow-[0_10px_40px_rgba(0,255,180,0.15)] backdrop-blur-xl transition hover:scale-[1.03]"
                      >
                        AI Assistant
                      </button>
                    ) : (
                      <div className="flex h-[500px] w-[360px] flex-col overflow-hidden rounded-[24px] border border-[#1a2438] bg-[#0b1220]/95 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                        <div className="flex items-center justify-between border-b border-[#1a2438] px-4 py-3">
                          <div>
                            <div className="text-sm font-bold text-white">
                              Assembly AI
                            </div>
                            <div className="text-[11px] text-[#7a8ba8]">
                              AMD step-aware assistant
                            </div>
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




