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

/* ================================================================== */
/* AMD FULL ASSEMBLY — PRACTICAL TEST                                 */
/* ------------------------------------------------------------------ */
/* Differences from the guided Module 3:                              */
/*   - No fixed step order. Any part whose real-world prerequisites    */
/*     are satisfied (e.g. the motherboard must be populated with      */
/*     CPU/RAM/SSD before it goes in the case) may be installed at any */
/*     time, in any order the learner chooses.                        */
/*   - No pulsing green/teal install-target ghost, no wireframe        */
/*     highlight, no floating "Install X here" callout. Only a neutral */
/*     cursor change signals a part can be grabbed.                    */
/*   - Every click and release is scored: installing a part whose      */
/*     prerequisites are not met, or repeatedly releasing far from the */
/*     target, counts against the final grade.                        */
/*   - A results screen replaces the certificate, with score, grade,   */
/*     time, and a mistake breakdown.                                  */
/* ================================================================== */

const ASSEMBLY_SEQUENCE = ["cpu", "ram1", "ram2", "ssd", "motherboard", "psu", "hdd", "gpu"];

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

const MOVABLE_COMPONENT_KEYS = new Set(ASSEMBLY_SEQUENCE);
const MOTHERBOARD_CHILD_KEYS = new Set(["cpu", "ram1", "ram2", "ssd"]);

const COMPONENT_LABELS = {
  cpu: "CPU",
  ram1: "RAM 1",
  ram2: "RAM 2",
  ssd: "SSD",
  motherboard: "Motherboard",
  psu: "PSU",
  hdd: "HDD",
  gpu: "GPU",
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
  cpu: { position: [-24.32, -27.331, 85.547], snapDistance: 0.75, magnetDistance: 4.5 },
  ram1: { position: [-53.836, -27.553, 80.307], snapDistance: 0.85, magnetDistance: 5 },
  ram2: { position: [-55.587, -27.596, 75.629], snapDistance: 0.85, magnetDistance: 5 },
  ssd: { position: [-28.53, -13.076, 98.981], snapDistance: 1, magnetDistance: 6 },
  motherboard: { position: [-41.07, -21.537, 54.246], snapDistance: 2, magnetDistance: 11 },
  psu: {
    position: [-28.697, -2.967, 75.561],
    snapDistance: 1.6,
    magnetDistance: 9,
    preserveTableRotation: true,
  },
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

/* -------------------------- Grading rubric ------------------------- */
const PENALTY_WRONG_ORDER_CLICK = 6;
const PENALTY_FUMBLE = 3;
const FUMBLE_THRESHOLD_PER_PART = 2;
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
  isReachable,
  isCompleted,
  testActive,
  onPartCompleted,
  onInvalidClick,
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
  const phaseRef = useRef("ready");
  const [phase, setPhase] = useState("ready");
  const grabbingRef = useRef(false);
  const completionReportedRef = useRef(false);
  const grabStartedAtRef = useRef(0);
  const frameCounterRef = useRef(0);
  const initialHorizontalDistanceRef = useRef(1);
  const fumbleCountRef = useRef(0);

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

  const targetPositionRef = useRef(new THREE.Vector3());
  const targetQuaternionRef = useRef(new THREE.Quaternion());
  const authoredCenterWorldRef = useRef(new THREE.Vector3());
  const authoredCenterLocalRef = useRef(new THREE.Vector3());
  const targetWorldQuaternionRef = useRef(new THREE.Quaternion());
  const parentWorldQuaternionRef = useRef(new THREE.Quaternion());

  const isMovablePart = MOVABLE_COMPONENT_KEYS.has(partKey);
  const canInteract = isMovablePart && testActive && !isCompleted;

  const installedQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const tableQuaternion = useMemo(() => {
    if (startConfig?.preserveTableRotation) return installedQuaternion.clone();
    return getAutomaticLayFlatQuaternion(modelSize);
  }, [installedQuaternion, modelSize, startConfig]);

  const startPosition = startConfig?.position || [0, 0, 0];
  const snapDistance = startConfig?.snapDistance ?? DEFAULT_SNAP_DISTANCE;
  const magnetDistance = startConfig?.magnetDistance ?? DEFAULT_MAGNET_DISTANCE;

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
      return { position: targetPositionRef.current, quaternion: targetQuaternionRef.current };
    }

    targetFrameRef.current.updateWorldMatrix(true, false);
    authoredCenterWorldRef.current.copy(modelCenter).applyMatrix4(targetFrameRef.current.matrixWorld);

    authoredCenterLocalRef.current.copy(authoredCenterWorldRef.current);
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(authoredCenterLocalRef.current);
    }

    targetPositionRef.current.copy(authoredCenterLocalRef.current).sub(modelCenter);
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

    return { position: targetPositionRef.current, quaternion: targetQuaternionRef.current };
  }, [modelCenter, targetFrameRef]);

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

  const publishTelemetry = useCallback(() => {
    if (!groupRef.current || !isMovablePart || !onTelemetry) return;

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

    onTelemetry({ key: partKey, label, phase: phaseRef.current, distance: horizontalDistance, progress });
  }, [computeInstallationTarget, getVisualCenters, isMovablePart, label, onTelemetry, partKey]);

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
      Math.hypot(groupRef.current.position.x - target.position.x, groupRef.current.position.z - target.position.z),
      1
    );
  }, [computeInstallationTarget, isCompleted, setPhaseSafely, startPosition, tableQuaternion]);

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
    onDragStateChange(false);
    document.body.style.cursor = "default";
    setPhaseSafely("installed");
    onInteractionMessage(`${label} installed and locked correctly.`);
    publishTelemetry();
    reportCompletion();
  }, [computeInstallationTarget, label, onDragStateChange, onInteractionMessage, publishTelemetry, reportCompletion, setPhaseSafely]);

  const beginGrab = useCallback(
    (event) => {
      if (!groupRef.current) return;
      updateMouse(event);

      const installationTarget = computeInstallationTarget();
      lockedTargetYRef.current = installationTarget.position.y;
      groupRef.current.position.y = lockedTargetYRef.current;
      groupRef.current.updateMatrixWorld(true);

      const centers = getVisualCenters(installationTarget);
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      camera.getWorldDirection(cameraDirectionRef.current).normalize();
      const isNearlyParallel = Math.abs(raycasterRef.current.ray.direction.dot(worldUpRef.current)) < 0.08;

      if (isNearlyParallel) {
        cameraDirectionRef.current.y = cameraDirectionRef.current.y < 0 ? -0.32 : 0.32;
        cameraDirectionRef.current.normalize();
        dragPlaneRef.current.setFromNormalAndCoplanarPoint(cameraDirectionRef.current, centers.targetWorld);
      } else {
        dragPlaneRef.current.setFromNormalAndCoplanarPoint(worldUpRef.current, centers.targetWorld);
      }

      if (raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, hitPointRef.current)) {
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
      grabStartedAtRef.current = performance.now();
      setPhaseSafely("grabbed");
      onDragStateChange(true);
      document.body.style.cursor = "grabbing";
      onInteractionMessage(`${label} grabbed. Guide it to its socket, then click again to release.`);
      publishTelemetry();
    },
    [camera, computeInstallationTarget, getVisualCenters, label, onDragStateChange, onInteractionMessage, publishTelemetry, setPhaseSafely, updateMouse]
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

    fumbleCountRef.current += 1;
    if (fumbleCountRef.current > FUMBLE_THRESHOLD_PER_PART) {
      onFumble(partKey);
    }

    setPhaseSafely("released");
    onInteractionMessage(`${label} released away from its socket. Grab it again and move it closer.`);
    publishTelemetry();
  }, [computeInstallationTarget, installObject, label, onDragStateChange, onFumble, onInteractionMessage, partKey, publishTelemetry, setPhaseSafely, snapDistance]);

  useEffect(() => {
    const handlePointerMove = (event) => updateMouse(event);
    gl.domElement.addEventListener("pointermove", handlePointerMove);
    return () => gl.domElement.removeEventListener("pointermove", handlePointerMove);
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
    return () => gl.domElement.removeEventListener("pointerdown", handleReleaseClick, true);
  }, [gl, phase, releaseObject]);

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
      if (grabbingRef.current) onDragStateChange(false);
      document.body.style.cursor = "default";
    };
  }, [onDragStateChange, setPhaseSafely]);

  useFrame(() => {
    if (!groupRef.current || !rotationRef.current) return;

    const installationTarget = computeInstallationTarget();

    if (grabbingRef.current) {
      lockedTargetYRef.current = installationTarget.position.y;
      groupRef.current.position.y = lockedTargetYRef.current;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      if (raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, hitPointRef.current)) {
        desiredCenterWorldRef.current.copy(hitPointRef.current).add(dragOffsetRef.current);

        desiredCenterLocalRef.current.copy(desiredCenterWorldRef.current);
        const parent = groupRef.current.parent;
        if (parent) parent.worldToLocal(desiredCenterLocalRef.current);

        desiredGroupLocalRef.current.copy(desiredCenterLocalRef.current).sub(modelCenter);
        desiredGroupLocalRef.current.y = lockedTargetYRef.current;

        const desiredDistance = Math.hypot(
          desiredGroupLocalRef.current.x - installationTarget.position.x,
          desiredGroupLocalRef.current.z - installationTarget.position.z
        );

        if (desiredDistance < magnetDistance) {
          const normalizedPull = 1 - desiredDistance / magnetDistance;
          const pull = THREE.MathUtils.clamp(DEFAULT_MAGNET_STRENGTH + normalizedPull * 0.42, 0, 0.68);

          desiredGroupLocalRef.current.lerp(installationTarget.position, pull);
          desiredGroupLocalRef.current.y = lockedTargetYRef.current;

          rotationRef.current.quaternion.slerp(installationTarget.quaternion, THREE.MathUtils.clamp(pull + 0.08, 0, 0.76));
        } else {
          rotationRef.current.quaternion.slerp(tableQuaternion, ROTATION_SMOOTHING);
        }

        groupRef.current.position.lerp(desiredGroupLocalRef.current, MOVEMENT_SMOOTHING);
        groupRef.current.position.y = lockedTargetYRef.current;

        const currentDistance = Math.hypot(
          groupRef.current.position.x - installationTarget.position.x,
          groupRef.current.position.z - installationTarget.position.z
        );

        if (currentDistance <= snapDistance) {
          installObject();
          return;
        }
      }
    } else if (phaseRef.current === "released") {
      lockedTargetYRef.current = installationTarget.position.y;
      groupRef.current.position.y = lockedTargetYRef.current;
    } else if (phaseRef.current === "installed") {
      groupRef.current.position.lerp(installationTarget.position, 0.42);
      rotationRef.current.quaternion.slerp(installationTarget.quaternion, 0.42);
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
        onInteractionMessage(`${label} is already installed.`);
        return;
      }

      if (!isReachable) {
        onInvalidClick(partKey);
        return;
      }

      if (phaseRef.current === "ready" || phaseRef.current === "released") {
        beginGrab(event);
      }
    },
    [beginGrab, isCompleted, isMovablePart, isReachable, label, onInteractionMessage, onInvalidClick, partKey, testActive]
  );

  const handlePointerOver = useCallback(
    (event) => {
      if (!isMovablePart || !testActive || isCompleted) return;
      event.stopPropagation();
      document.body.style.cursor = "grab";
    },
    [isCompleted, isMovablePart, testActive]
  );

  const handlePointerOut = useCallback(() => {
    if (!grabbingRef.current) document.body.style.cursor = "default";
  }, []);

  return (
    <group
      ref={groupRef}
      position={startPosition}
      onPointerDown={handlePointerDown}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <group position={[modelCenter.x, modelCenter.y, modelCenter.z]}>
        <group ref={rotationRef} quaternion={tableQuaternion.toArray()}>
          <group ref={contentFrameRef} position={[-modelCenter.x, -modelCenter.y, -modelCenter.z]}>
            {children}
          </group>
        </group>
      </group>
    </group>
  );
}

function AssemblyPart({
  part,
  targetFrameRef,
  isReachable,
  isCompleted,
  testActive,
  onPartCompleted,
  onInvalidClick,
  onFumble,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
}) {
  const { scene } = useGLTF(encodeURI(part.path));
  const clone = useMemo(() => cloneSceneForDisplay(scene, { enableShadows: part.key !== "cpu" }), [part.key, scene]);
  const bounds = useMemo(() => getModelBounds(clone), [clone]);

  return (
    <InteractiveCenteredObject
      partKey={part.key}
      label={COMPONENT_LABELS[part.key] || part.key}
      modelCenter={bounds.center}
      modelSize={bounds.size}
      startConfig={TABLE_STARTS[part.key]}
      targetFrameRef={targetFrameRef}
      isReachable={isReachable}
      isCompleted={isCompleted}
      testActive={testActive}
      onPartCompleted={onPartCompleted}
      onInvalidClick={onInvalidClick}
      onFumble={onFumble}
      onInteractionMessage={onInteractionMessage}
      onDragStateChange={onDragStateChange}
      onTelemetry={onTelemetry}
    >
      <primitive object={clone} dispose={null} />
    </InteractiveCenteredObject>
  );
}

function MotherboardUnit({
  contentFrameRef,
  isReachable,
  completedParts,
  testActive,
  onPartCompleted,
  onInvalidClick,
  onFumble,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
}) {
  const part = PART_BY_KEY.motherboard;
  const { scene } = useGLTF(encodeURI(part.path));
  const motherboardClone = useMemo(() => cloneSceneForDisplay(scene), [scene]);
  const bounds = useMemo(() => getModelBounds(motherboardClone), [motherboardClone]);

  return (
    <InteractiveCenteredObject
      partKey="motherboard"
      label="Motherboard"
      modelCenter={bounds.center}
      modelSize={bounds.size}
      startConfig={TABLE_STARTS.motherboard}
      isReachable={isReachable}
      isCompleted={completedParts.includes("motherboard")}
      testActive={testActive}
      onPartCompleted={onPartCompleted}
      onInvalidClick={onInvalidClick}
      onFumble={onFumble}
      onInteractionMessage={onInteractionMessage}
      onDragStateChange={onDragStateChange}
      onTelemetry={onTelemetry}
      contentFrameRef={contentFrameRef}
    >
      <primitive object={motherboardClone} dispose={null} />
      {["cpu", "ram1", "ram2", "ssd"].map((key) =>
        completedParts.includes(key) ? (
          <StaticAuthoredModel key={`installed-${key}`} part={PART_BY_KEY[key]} disableRaycast />
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
  const motherboardContentRef = useRef(null);

  return (
    <group ref={rootRef}>
      <StaticAuthoredModel part={PART_BY_KEY.table} disableRaycast />
      <StaticAuthoredModel part={PART_BY_KEY.case} disableRaycast />

      <MotherboardUnit
        contentFrameRef={motherboardContentRef}
        isReachable={reachableKeys.has("motherboard")}
        completedParts={completedParts}
        testActive={testActive}
        onPartCompleted={onPartCompleted}
        onInvalidClick={onInvalidClick}
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
            targetFrameRef={isMotherboardChild ? motherboardContentRef : null}
            isReachable={reachableKeys.has(key)}
            isCompleted={completedParts.includes(key)}
            testActive={testActive}
            onPartCompleted={onPartCompleted}
            onInvalidClick={onInvalidClick}
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
  const [telemetry, setTelemetry] = useState(null);
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
          Reset Bird&apos;s-eye
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

      {telemetry ? (
        <div className="pointer-events-none absolute bottom-4 left-4 z-[80] w-[min(280px,calc(100%-32px))] rounded-2xl border border-[#00ffb4]/25 bg-[#0b1220]/94 px-4 py-3 text-[11px] leading-5 text-[#dbe6f5] shadow-[0_12px_35px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <div className="mb-1 flex items-center justify-between gap-4">
            <span className="font-bold text-[#00ffb4]">{telemetry.label}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#00ffb4] transition-[width] duration-150" style={{ width: `${Math.round(telemetry.progress * 100)}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HeaderDropdown({ userName, userEmail = "", onBack, onLogout, setIsSettingsOpen }) {
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
              <div className="text-[11px] text-[#7a8ba8]">{userEmail || "No email"}</div>
            </div>
            <div className="text-sm text-[#7a8ba8] transition group-open:rotate-180">▾</div>
          </div>
        </summary>

        <div className="absolute right-0 top-full z-[220] mt-2 w-52 rounded-2xl border border-[#1a2438] bg-[#0d1220]/98 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <button onClick={() => setIsSettingsOpen(true)} className="w-full rounded-xl px-4 py-2 text-left text-sm text-[#dbe6f5] transition hover:bg-white/5">
            Settings
          </button>
          <button onClick={() => typeof onBack === "function" && onBack("Profile")} className="w-full rounded-xl px-4 py-2 text-left text-sm text-[#dbe6f5] transition hover:bg-white/5">
            Profile
          </button>
          <button onClick={onLogout} className="w-full rounded-xl px-4 py-2 text-left text-sm text-red-400 transition hover:bg-red-500/10">
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

function ChecklistSidebar({ open, onToggle, completedParts, mistakes, fumbles }) {
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
              <div className="text-sm font-bold text-white">Install Checklist</div>
              <div className="text-[11px] text-[#7a8ba8]">Any order • AMD Platform</div>
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

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 pr-2 [scrollbar-color:rgba(0,255,180,0.35)_rgba(255,255,255,0.05)] [scrollbar-width:thin]">
          {ASSEMBLY_SEQUENCE.map((key) => {
            const done = completedParts.includes(key);
            return (
              <div
                key={key}
                className={[
                  "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                  done ? "border-[#00ffb4]/25 bg-[#00ffb4]/10" : "border-[#1a2438] bg-white/[0.03]",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition",
                    done ? "bg-[#00ffb4] text-[#0a0e17]" : "border border-[#1a2438] bg-[#0d1220] text-[#7a8ba8]",
                  ].join(" ")}
                >
                  {done ? "✓" : "•"}
                </span>
                {open ? (
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{COMPONENT_LABELS[key]}</div>
                    <div className="text-[11px] text-[#7a8ba8]">{done ? "Installed" : "Not yet installed"}</div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {open ? (
          <div className="shrink-0 border-t border-[#1a2438] p-3 text-[11px] text-[#7a8ba8]">
            <div className="flex justify-between">
              <span>Mistakes</span>
              <span className="font-bold text-[#ff9f7d]">{mistakes}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>Fumbles</span>
              <span className="font-bold text-[#ffd27d]">{fumbles}</span>
            </div>
          </div>
        ) : null}
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
            Practical Test • AMD Platform
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
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">Wrong-order attempts and fumbled placements cost points.</div>
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
            Test Complete • AMD Full Assembly
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

export default function AMDFullAssemblyPracticalTest({ onFinish, onBack, onLogout }) {
  const [sceneRevision, setSceneRevision] = useState(0);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [testActive, setTestActive] = useState(false);
  const [completedParts, setCompletedParts] = useState([]);
  const [wrongOrderCount, setWrongOrderCount] = useState(0);
  const [fumbleCount, setFumbleCount] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [result, setResult] = useState(null);
  const [validationMessage, setValidationMessage] = useState(
    "No hints are active. Click any loose component that is ready to be installed."
  );
  const [settings, setSettings] = useState({ sound: true, animations: true, darkMode: true });

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
    setValidationMessage("No hints are active. Click any loose component that is ready to be installed.");
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
        console.error("Error fetching AMD Assembly Practical Test profile:", error);
      }
    });
    return () => unsub();
  }, []);

  const user = {
    name: profile ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "User" : "Loading...",
    email: firebaseUser?.email || "No email",
  };

  const saveTestResult = useCallback(
    async (finalResult) => {
      if (!firebaseUser) return;
      try {
        const userRef = doc(db, "users", firebaseUser.uid);
        await setDoc(
          userRef,
          {
            practicalTests: {
              amdAssembly: {
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
      } catch (error) {
        console.error("Error saving AMD Assembly Practical Test result:", error);
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
      setValidationMessage(`${COMPONENT_LABELS[partKey]} installed correctly.`);

      if (nextCompletedParts.length === ASSEMBLY_SEQUENCE.length) {
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
        `${COMPONENT_LABELS[partKey]} is not ready to install yet — a prerequisite component is missing. (Order mistake logged.)`
      );
    },
    [settings.sound]
  );

  const handleFumble = useCallback((partKey) => {
    setFumbleCount((value) => value + 1);
    setValidationMessage(`${COMPONENT_LABELS[partKey]} was released far from its socket. (Fumble logged.)`);
  }, []);

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
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-[#0a0e17] font-sans text-[#e8ecf4] antialiased">
      <div className="relative h-full w-full overflow-hidden">
        <ModuleBackground />

        {showIntro ? <TestIntroCard onStart={handleStartTest} /> : null}
        {result ? <ResultsCard result={result} onRetry={resetTest} onBackToDashboard={handleBackToDashboard} /> : null}

        <div className="relative flex h-full w-full flex-col overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(0,255,180,0.08),transparent_35%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_20%,rgba(255,159,125,0.05),transparent_30%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,180,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,180,0.025)_1px,transparent_1px)] bg-[size:54px_54px] opacity-55" />

          <div className="relative flex h-full w-full flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 text-[12px] text-[#7a8ba8] md:px-10">
              <div>
                Practical Test — <span className="text-[#dbe6f5]">Full Assembly (AMD)</span>
              </div>
              <div className="rounded-lg border border-[#ff9f7d]/30 bg-[#ff9f7d]/8 px-2 py-1 text-[11px] font-bold text-[#ff9f7d]">
                {completedParts.length} / {ASSEMBLY_SEQUENCE.length} installed
              </div>
            </div>

            <div className="relative z-[120] mt-3 px-6 md:px-10">
              <div className="flex w-full items-center justify-between gap-4 rounded-[22px] border border-[#1a2438] bg-[#0b1220]/86 px-6 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.30)] backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <img src="/PNG/Articton.png" alt="Articton Logo" className="ml-4 h-10 w-10 scale-300 object-contain" />
                  <div>
                    <div className="text-base font-bold tracking-wide text-white">Articton</div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-[#ff9f7d]">AMD Practical Test</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
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

                  <HeaderDropdown userName={user.name} userEmail={user.email} onBack={onBack} onLogout={onLogout} setIsSettingsOpen={setIsSettingsOpen} />
                </div>
              </div>

              <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onChange={handleSettingChange} />
            </div>

            <div className="px-6 pt-4 md:px-10">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#1a2438] bg-[#0b1220]/72 px-5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
                <div>
                  <div className="text-sm font-semibold text-white">Free-order installation — no visual guides</div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[#7a8ba8]">
                    Click a loose part to grab • guide it to its socket • click again to release
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] font-bold">
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
                  mistakes={wrongOrderCount}
                  fumbles={fumbleCount}
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