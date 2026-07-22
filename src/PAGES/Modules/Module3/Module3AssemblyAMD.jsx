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
  cpu: "CPU",
  ram1: "RAM 1",
  ram2: "RAM 2",
  ssd: "SSD",
  motherboard: "Motherboard",
  psu: "PSU",
  hdd: "HDD",
  gpu: "GPU",
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

const PART_BY_KEY = Object.freeze(
  Object.fromEntries(PART_MODELS.map((part) => [part.key, part]))
);

function cloneSceneForDisplay(scene, { disableRaycast = false } = {}) {
  const clone = scene.clone(true);
  clone.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
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
    () => cloneSceneForDisplay(scene, { disableRaycast }),
    [disableRaycast, scene]
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
  const canInteract = isMovablePart && (isActive || isCompleted);

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
    if (!groupRef.current || !isMovablePart || !isActive || !onTelemetry) return;

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
    isActive,
    isMovablePart,
    label,
    onTelemetry,
    partKey,
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

      // Pre-align the active component with the highlighted installation
      // height. This prevents small parts such as the CPU from beginning
      // below the desk or below the target plane before the user grabs them.
      if (isActive) {
        groupRef.current.position.y = lockedTargetYRef.current;
      }
    }

    groupRef.current.updateMatrixWorld(true);

    initialHorizontalDistanceRef.current = Math.max(
      Math.hypot(
        groupRef.current.position.x - target.position.x,
        groupRef.current.position.z - target.position.z
      ),
      1
    );

    if (isActive) {
      requestAnimationFrame(() => publishTelemetry());
    }
  }, [
    computeInstallationTarget,
    isActive,
    isCompleted,
    publishTelemetry,
    setPhaseSafely,
    startPosition,
    tableQuaternion,
  ]);

  useEffect(() => {
    if (!isActive) return;
    const id = requestAnimationFrame(() => publishTelemetry());
    return () => cancelAnimationFrame(id);
  }, [isActive, publishTelemetry]);

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
      `${label} snapped into place and is now locked. The target height and orientation were corrected automatically.`
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
        `${label} grabbed. It has been raised to the exact height of the highlighted target and is now hard-locked on that Y level. Move only left, right, forward, or backward.`
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
      `${label} released. Its Y level remains aligned with the highlight. Click it again and move it closer to the target center.`
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

    if (isActive && phaseRef.current !== "installed") {
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

          if (!magnetNoticeRef.current) {
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
    } else if (
      isActive &&
      phaseRef.current !== "installed" &&
      phaseRef.current !== "grabbed"
    ) {
      // Keep the currently active part at target height before the first grab
      // and after an out-of-range release. X and Z remain fully user-controlled.
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
    if (isActive && frameCounterRef.current % interval === 0) {
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
  isCompleted,
  onPartCompleted,
  onLockedPartClick,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
}) {
  const { scene } = useGLTF(encodeURI(part.path));
  const clone = useMemo(() => cloneSceneForDisplay(scene), [scene]);
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
    const materials = [];

    fillScene.traverse((object) => {
      if (!object.isMesh) return;
      object.raycast = () => null;
      object.renderOrder = 1000;
      const material = new THREE.MeshBasicMaterial({
        color: "#00ffb4",
        transparent: true,
        opacity: 0.1,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      object.material = material;
      materials.push(material);
    });

    wireScene.traverse((object) => {
      if (!object.isMesh) return;
      object.raycast = () => null;
      object.renderOrder = 1001;
      const material = new THREE.MeshBasicMaterial({
        color: "#7dffdc",
        transparent: true,
        opacity: 0.78,
        wireframe: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      object.material = material;
      materials.push(material);
    });

    fillScene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(fillScene);
    return {
      fillScene,
      wireScene,
      materials,
      center: bounds.getCenter(new THREE.Vector3()),
      size: bounds.getSize(new THREE.Vector3()),
    };
  }, [scene]);

  useEffect(() => {
    return () => guideData.materials.forEach((material) => material.dispose());
  }, [guideData]);

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.getElapsedTime() * 3.5) + 1) / 2;

    if (pulseRef.current) {
      const scale = 0.985 + pulse * 0.03;
      pulseRef.current.scale.setScalar(scale);
      pulseRef.current.traverse((object) => {
        if (!object.isMesh || !object.material) return;
        object.material.opacity = object.material.wireframe
          ? 0.5 + pulse * 0.36
          : 0.06 + pulse * 0.12;
      });
    }

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

      <mesh ref={markerRef} position={guideData.center} renderOrder={1002}>
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

      <mesh
        position={guideData.center}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1003}
      >
        <ringGeometry
          args={[markerRadius * 1.45, markerRadius * 2.25, 48]}
        />
        <meshBasicMaterial
          color="#00ffb4"
          transparent
          opacity={0.34}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      <Html
        center
        position={[
          guideData.center.x,
          guideData.center.y + Math.max(guideData.size.y * 0.7, 0.8),
          guideData.center.z,
        ]}
        style={{ pointerEvents: "none" }}
      >
        <div className="whitespace-nowrap rounded-xl border border-[#00ffb4]/35 bg-[#07111d]/94 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#73ffd4] shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-md">
          Install {COMPONENT_LABELS[part.key]} here
        </div>
      </Html>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Motherboard carrier: installed CPU/RAM/SSD travel with the board    */
/* ------------------------------------------------------------------ */

function MotherboardUnit({
  contentFrameRef,
  activePartKey,
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

      {activeChildPart ? (
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
  activePartKey,
  completedParts,
  onPartCompleted,
  onLockedPartClick,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
}) {
  const motherboardContentRef = useRef(null);

  return (
    <group>
      <StaticAuthoredModel part={PART_BY_KEY.table} disableRaycast />
      <StaticAuthoredModel part={PART_BY_KEY.case} disableRaycast />

      <MotherboardUnit
        contentFrameRef={motherboardContentRef}
        activePartKey={activePartKey}
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
            isCompleted={completedParts.includes(key)}
            onPartCompleted={onPartCompleted}
            onLockedPartClick={onLockedPartClick}
            onInteractionMessage={onInteractionMessage}
            onDragStateChange={onDragStateChange}
            onTelemetry={onTelemetry}
          />
        );
      })}

      {activePartKey &&
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

function AssistedCameraRig({
  telemetry,
  controlsRef,
  focusRequest,
  isDraggingPart,
}) {
  const { camera } = useThree();
  const animationRef = useRef(null);
  const fromCameraRef = useRef(new THREE.Vector3());
  const toCameraRef = useRef(new THREE.Vector3());
  const fromTargetRef = useRef(new THREE.Vector3());
  const toTargetRef = useRef(new THREE.Vector3());
  const viewDirectionRef = useRef(new THREE.Vector3());

  useEffect(() => {
    if (!telemetry || !controlsRef.current || isDraggingPart) return;

    const partPosition = new THREE.Vector3(...telemetry.position);
    const targetPosition = new THREE.Vector3(...telemetry.targetPosition);
    const midpoint = partPosition.clone().lerp(targetPosition, 0.5);
    const span = Math.max(partPosition.distanceTo(targetPosition), 3.5);

    fromCameraRef.current.copy(camera.position);
    fromTargetRef.current.copy(controlsRef.current.target);

    viewDirectionRef.current
      .copy(camera.position)
      .sub(controlsRef.current.target);

    if (viewDirectionRef.current.lengthSq() < 0.001) {
      viewDirectionRef.current.set(1.15, 0.78, 1.15);
    }

    viewDirectionRef.current.normalize();
    viewDirectionRef.current.y = Math.max(viewDirectionRef.current.y, 0.28);
    viewDirectionRef.current.normalize();

    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const fitDistance =
      (span * 0.58) / Math.max(Math.tan(verticalFov / 2), 0.2);
    const cameraDistance = THREE.MathUtils.clamp(
      fitDistance + 6.5,
      10,
      125
    );

    toTargetRef.current.copy(midpoint);
    toCameraRef.current
      .copy(midpoint)
      .addScaledVector(viewDirectionRef.current, cameraDistance);

    animationRef.current = {
      startedAt: performance.now(),
      duration: CAMERA_FOCUS_DURATION_MS,
    };
  }, [camera, controlsRef, focusRequest, isDraggingPart, telemetry?.key]);

  useFrame(() => {
    const animation = animationRef.current;
    const controls = controlsRef.current;
    if (!animation || !controls || isDraggingPart) return;

    const raw = THREE.MathUtils.clamp(
      (performance.now() - animation.startedAt) / animation.duration,
      0,
      1
    );
    const eased = raw * raw * (3 - 2 * raw);

    camera.position.lerpVectors(
      fromCameraRef.current,
      toCameraRef.current,
      eased
    );
    controls.target.lerpVectors(
      fromTargetRef.current,
      toTargetRef.current,
      eased
    );
    camera.lookAt(controls.target);
    controls.update();

    if (raw >= 1) animationRef.current = null;
  });

  return null;
}

function ModelViewer({
  activePartKey,
  completedParts,
  onPartCompleted,
  onLockedPartClick,
  onInteractionMessage,
}) {
  const [isDraggingPart, setIsDraggingPart] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const controlsRef = useRef(null);

  useEffect(() => {
    setTelemetry(null);
    setFocusRequest((value) => value + 1);
  }, [activePartKey]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [38, 24, 46], fov: 48, near: 0.01, far: 1200 }}
        dpr={[1, 2]}
        shadows
        className="h-full w-full"
        gl={{ antialias: true }}
        style={{ touchAction: "none" }}
      >
        <color attach="background" args={["#070c14"]} />
        <hemisphereLight args={["#ffffff", "#182338", 1.2]} />
        <ambientLight intensity={0.72} />
        <directionalLight
          position={[6, 10, 7]}
          intensity={1.9}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-5, 4, 2]} intensity={0.75} />

        <ModelErrorBoundary parts={PART_MODELS}>
          <Suspense fallback={<Loader />}>
            <AssemblyScene
              activePartKey={activePartKey}
              completedParts={completedParts}
              onPartCompleted={onPartCompleted}
              onLockedPartClick={onLockedPartClick}
              onInteractionMessage={onInteractionMessage}
              onDragStateChange={setIsDraggingPart}
              onTelemetry={setTelemetry}
            />
          </Suspense>
        </ModelErrorBoundary>

        <AssistedCameraRig
          telemetry={telemetry}
          controlsRef={controlsRef}
          focusRequest={focusRequest}
          isDraggingPart={isDraggingPart}
        />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!isDraggingPart}
          enablePan
          panSpeed={0.75}
          enableZoom
          zoomSpeed={0.62}
          zoomToCursor
          enableDamping
          dampingFactor={0.12}
          minDistance={2.5}
          maxDistance={190}
          mouseButtons={{
            LEFT: null,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
        />
      </Canvas>

      <div className="absolute left-4 top-4 z-[80] flex max-w-[calc(100%-180px)] flex-wrap gap-2">
        <div className="pointer-events-none rounded-xl border border-[#00ffb4]/35 bg-[#00ffb4]/14 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#b7fff0] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          {ASSEMBLY_UX_VERSION}
        </div>
        <div className="pointer-events-none rounded-xl border border-[#00ffb4]/30 bg-[#0b1220]/92 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7dffdc] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          Exact Y Lock: On
        </div>
        <div className="pointer-events-none rounded-xl border border-[#00ffb4]/30 bg-[#0b1220]/92 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7dffdc] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          Wide Magnet Zone: On
        </div>
        <button
          type="button"
          onClick={() => setFocusRequest((value) => value + 1)}
          disabled={!telemetry || isDraggingPart}
          className="rounded-xl border border-[#00ffb4]/30 bg-[#00ffb4]/12 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7dffdc] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-[#00ffb4]/20 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Focus Part + Target
        </button>
      </div>

      {telemetry ? (
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
            The glowing ring shows the normal magnet range. Move the part close to the center for the final snap.
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
              <div className="text-[11px] text-[#7a8ba8]">
                {userEmail || "No email"}
              </div>
            </div>
            <div className="text-sm text-[#7a8ba8] transition group-open:rotate-180">
              ▾
            </div>
          </div>
        </summary>

        <div className="absolute right-0 top-full z-[220] mt-2 w-52 rounded-2xl border border-[#1a2438] bg-[#0d1220]/98 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
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
}) {
  return (
    <div
      className={[
        "absolute left-0 top-0 z-[200] h-full transition-all duration-300",
        open ? "w-[280px]" : "w-[64px]",
      ].join(" ")}
    >
      <div className="h-full border-r border-[#1a2438] bg-[#0b1220]/92 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-[#1a2438] px-4 py-4">
          {open ? (
            <div>
              <div className="text-sm font-bold text-white">Assembly Steps</div>
              <div className="text-[11px] text-[#7a8ba8]">
                AMD Platform
              </div>
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
          {steps.map((item, index) => {
            const done = !!completedSteps[item.key];
            const active = currentStep === index;
            const unlocked = canSelectStep(index);

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelect(index)}
                aria-disabled={!unlocked}
                className={[
                  "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
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
                    <div className="text-sm font-semibold leading-5 text-white">
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
          <div className="border-t border-[#1a2438] p-3">
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
}) {
  const [step, setStep] = useState(0);
  const [completedParts, setCompletedParts] = useState([]);
  const [sceneRevision, setSceneRevision] = useState(0);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [validationMessage, setValidationMessage] = useState(
    "Begin with the CPU. Click it once to activate Y-level assist, then guide it across the green target plane. The normal magnet will assist only when it is close to the target."
  );

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
  const activePartKey = currentStep?.partKey || null;
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
    setValidationMessage(
      "Scene restarted. Click the CPU once; Y-level assist will align it with the target height and the normal magnet will assist near the target."
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
    } catch (error) {
      console.error(
        "Error saving final Module 3 (AMD) completion:",
        error
      );
    }
  }, [firebaseUser]);

  const handlePartCompleted = useCallback(
    (partKey) => {
      if (partKey !== activePartKey || completedParts.includes(partKey)) return;

      const nextCompletedParts = [...completedParts, partKey];
      setCompletedParts(nextCompletedParts);

      const finished =
        nextCompletedParts.length === ASSEMBLY_SEQUENCE.length;
      if (finished) {
        setStep(steps.length - 1);
        setValidationMessage(
          "Full assembly complete. Every required component has been installed in the correct order."
        );
        void saveFinalCompletion();
        return;
      }

      const nextStepIndex = step + 1;
      const nextPartKey = steps[nextStepIndex]?.partKey;
      setStep(nextStepIndex);
      setValidationMessage(
        `${COMPONENT_LABELS[partKey]} installed. Next: ${COMPONENT_LABELS[nextPartKey]}.`
      );
    }, [activePartKey, completedParts, saveFinalCompletion, step]
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
      const response = await fetch("http://127.0.0.1:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: aiInput,
          context: {
            module: "assembly",
            moduleNumber: 3,
            platform: "amd",
            currentStep: currentStep?.name,
            activeComponent: activePartLabel,
            completedParts,
          },
        }),
      });

      const data = await response.json();
      setAiMessages((previous) => [
        ...previous,
        { role: "assistant", content: data.reply },
      ]);
    } catch (error) {
      console.error(error);
      setAiMessages((previous) => [
        ...previous,
        { role: "assistant", content: "AI server error occurred." },
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
      <div className="min-h-screen w-full overflow-hidden bg-[#0a0e17] font-sans text-[#e8ecf4] antialiased">
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6">
          <ModuleBackground />
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
                You Have Completed Module 3 — AMD Assembly
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-sm leading-7 text-[#9fb0ca]">
                You completed the ordered installation of the CPU, two RAM
                modules, SSD, motherboard, PSU, HDD, and GPU.
              </p>
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="rounded-2xl bg-[#00ffb4] px-7 py-3 text-sm font-black text-[#0a0e17] shadow-[0_18px_50px_rgba(0,255,180,0.22)] transition hover:scale-[1.03]"
              >
                Back to Dashboard →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-[#0a0e17] font-sans text-[#e8ecf4] antialiased">
      <div className="relative h-full w-full overflow-hidden">
        <ModuleBackground />

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
                      AMD Assembly View
                    </div>
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
                    onClick={resetScene}
                    className="rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.07]"
                  >
                    Restart Scene
                  </button>

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
                    {currentStep?.name}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[#7a8ba8]">
                    {activePartLabel
                      ? `Click ${activePartLabel} to grab • Y-level locks to the highlight • drag across the green plane • magnet assists near the target • click again to release`
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
                />

                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(255,255,255,0.08),transparent_40%)]" />
                <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.55)]" />

                <div
                  className="absolute bottom-3 right-3 top-3 z-[40] overflow-hidden rounded-[18px] border border-[#1a2438] bg-black/20 transition-all duration-300 md:bottom-4 md:right-4 md:top-4"
                  style={{ left: sidebarOpen ? 280 : 64 }}
                >
                  <ModelViewer
                    key={sceneRevision}
                    activePartKey={activePartKey}
                    completedParts={completedParts}
                    onPartCompleted={handlePartCompleted}
                    onLockedPartClick={handleLockedPartClick}
                    onInteractionMessage={setValidationMessage}
                  />

                  <div className="absolute right-5 top-5 z-[500] flex flex-col items-end">
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