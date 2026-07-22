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

/* ------------------------------------------------------------------ */
/* Ordered disassembly configuration (AMD platform)          */
/* ------------------------------------------------------------------ */

const steps = [
  { key: "gpu", name: "GPU Disassembly", partKey: "gpu" },
  { key: "ssd", name: "SSD Disassembly", partKey: "ssd" },
  { key: "hdd", name: "HDD Disassembly", partKey: "hdd" },
  { key: "ram1", name: "RAM 1 Disassembly", partKey: "ram1" },
  { key: "ram2", name: "RAM 2 Disassembly", partKey: "ram2" },
  { key: "cpu", name: "CPU Disassembly", partKey: "cpu" },
  { key: "psu", name: "PSU Disassembly", partKey: "psu" },
  { key: "motherboard", name: "Motherboard Disassembly", partKey: "motherboard" },
  { key: "final", name: "Full Disassembly", partKey: null },
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

const REMOVAL_SEQUENCE = steps
  .map((step) => step.partKey)
  .filter(Boolean);

const MOVABLE_COMPONENT_KEYS = new Set(REMOVAL_SEQUENCE);

const COMPONENT_LABELS = {
  gpu: "GPU",
  ssd: "SSD",
  hdd: "HDD",
  ram1: "RAM 1",
  ram2: "RAM 2",
  cpu: "CPU",
  psu: "PSU",
  motherboard: "Motherboard",
};

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

const DEFAULT_SNAP_DISTANCE = 1;
const DEFAULT_MAGNET_DISTANCE = 7;
const DEFAULT_MAGNET_STRENGTH = 0.2;
const MINIMUM_REMOVAL_DISTANCE = 0.04;
const EARLY_SNAP_MULTIPLIER = 1.3;
const RELEASE_SNAP_MULTIPLIER = 1.15;
const DRAG_FOLLOW_SPEED = 26;
const ROTATION_FOLLOW_SPEED = 10.5;
const HEIGHT_TRANSITION_SPEED = 3.8;
const SETTLE_SPEED = 10;
const WORKSPACE_PADDING_MULTIPLIER = 1.5;
const TELEMETRY_FRAME_INTERVAL = 3;
const TELEMETRY_IDLE_FRAME_INTERVAL = 16;
const CAMERA_FOCUS_DURATION_MS = 620;
const DRAG_SCREEN_GAIN = 1.06;
const EASY_DRAG_CAMERA_DIRECTION = [0.42, 0.96, 1.08];
const OVERVIEW_CAMERA_DISTANCE_MULTIPLIER = 1.28;
const DISASSEMBLY_UX_VERSION = "Overview-Angle Assisted Disassembly";

const LEGACY_STORAGE_KEYS = [
  "module2CompletedStepsAMD",
  "module2DisassembledPartsAMD",
];

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
  const tetherRef = useRef(null);
  const tetherMaterialRef = useRef(null);
  const captureRingRef = useRef(null);
  const captureRingMaterialRef = useRef(null);

  const phaseRef = useRef("installed");
  const [phase, setPhase] = useState("installed");
  const grabbingRef = useRef(false);
  const completionReportedRef = useRef(false);
  const grabStartedAtRef = useRef(0);
  const frameCounterRef = useRef(0);
  const initialDistanceRef = useRef(1);
  const magnetStateRef = useRef("Detach first");
  const magnetNoticeRef = useRef(false);

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
  const raycasterRef = useRef(new THREE.Raycaster());
  const dragPlaneRef = useRef(new THREE.Plane());
  const dragOffsetRef = useRef(new THREE.Vector3());
  const dragStartWorldRef = useRef(new THREE.Vector3());
  const dragStartGroupLocalRef = useRef(new THREE.Vector3());
  const dragCurrentYRef = useRef(0);
  const hitPointRef = useRef(new THREE.Vector3());
  const desiredCenterWorldRef = useRef(new THREE.Vector3());
  const desiredCenterLocalRef = useRef(new THREE.Vector3());
  const desiredGroupLocalRef = useRef(new THREE.Vector3());
  const assistedGoalRef = useRef(new THREE.Vector3());
  const currentCenterLocalRef = useRef(new THREE.Vector3());
  const targetCenterLocalRef = useRef(new THREE.Vector3());
  const currentCenterWorldRef = useRef(new THREE.Vector3());
  const targetCenterWorldRef = useRef(new THREE.Vector3());
  const cameraDirectionRef = useRef(new THREE.Vector3());
  const lineStartRef = useRef(new THREE.Vector3());
  const lineEndRef = useRef(new THREE.Vector3());
  const desiredQuaternionRef = useRef(new THREE.Quaternion());

  const isMovablePart = MOVABLE_COMPONENT_KEYS.has(part.key);
  const canInteract = isMovablePart && (isActive || isCompleted);
  const placementTarget = PLACEMENT_TARGETS[part.key];

  const targetPosition = useMemo(() => {
    if (!placementTarget?.position) return null;
    return new THREE.Vector3(...placementTarget.position);
  }, [placementTarget]);

  const lockedY = targetPosition?.y ?? null;
  const snapDistance =
    placementTarget?.snapDistance ?? DEFAULT_SNAP_DISTANCE;
  const magnetDistance =
    placementTarget?.magnetDistance ?? DEFAULT_MAGNET_DISTANCE;
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

  const captureRingRadius = THREE.MathUtils.clamp(
    Math.max(modelRadius * 0.78, autoSnapDistance * 0.9),
    0.7,
    7
  );

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

    let magnetState = magnetStateRef.current;
    if (phaseRef.current === "installed") magnetState = "Detach first";
    else if (phaseRef.current === "detached") magnetState = "Ready to move";
    else if (phaseRef.current === "placed") magnetState = "Placed";
    else if (distance <= autoSnapDistance * 1.2) magnetState = "Snap ready";
    else if (distance < magnetDistance) magnetState = "Magnet engaged";
    else magnetState = "Move closer";

    magnetStateRef.current = magnetState;

    const yDifference =
      lockedY === null ? 0 : Math.abs(groupRef.current.position.y - lockedY);

    onTelemetry?.({
      key: part.key,
      label: COMPONENT_LABELS[part.key] || part.key,
      phase: phaseRef.current,
      position: groupRef.current.position.toArray(),
      currentCenter: centers.currentWorld.toArray(),
      targetCenter: centers.targetWorld.toArray(),
      distance,
      progress: phaseRef.current === "placed" ? 1 : progress,
      magnetState,
      yLocked:
        lockedY !== null &&
        phaseRef.current !== "installed" &&
        yDifference <= 0.08,
      yTransitioning:
        lockedY !== null &&
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
    lockedY,
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
      dragStartGroupLocalRef.current.copy(groupRef.current.position);
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
      grabStartedAtRef.current = performance.now();
      magnetNoticeRef.current = false;
      setPhaseSafely("grabbed");
      onDragStateChange(true);
      document.body.style.cursor = "grabbing";
      onInteractionMessage(
        `${COMPONENT_LABELS[part.key]} grabbed. Move it toward the glowing target; its height and orientation will adjust smoothly.`
      );
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
    ]
  );

  const reportCompletion = useCallback(() => {
    if (completionReportedRef.current || isCompleted) return;
    completionReportedRef.current = true;
    onPartCompleted(part.key);
  }, [isCompleted, onPartCompleted, part.key]);

  const seatComponent = useCallback(() => {
    if (!groupRef.current || !targetPosition || phaseRef.current === "placed") {
      return;
    }

    groupRef.current.position.copy(targetPosition);
    dragCurrentYRef.current = targetPosition.y;
    if (rotationRef.current) {
      rotationRef.current.quaternion.copy(detachedQuaternion);
    }

    grabbingRef.current = false;
    magnetStateRef.current = "Placed";
    onDragStateChange(false);
    document.body.style.cursor = "default";
    setPhaseSafely("placed");
    onInteractionMessage(
      `${COMPONENT_LABELS[part.key]} smoothly snapped into its highlighted table position.`
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

    if (distanceToTarget <= autoSnapDistance * RELEASE_SNAP_MULTIPLIER) {
      seatComponent();
      return;
    }

    setPhaseSafely("released");
    magnetStateRef.current =
      distanceToTarget < magnetDistance ? "Magnet engaged" : "Move closer";
    onInteractionMessage(
      `${COMPONENT_LABELS[part.key]} released safely. Click it again to continue moving it toward the target.`
    );
    publishTelemetry();
  }, [
    autoSnapDistance,
    getVisualCenters,
    magnetDistance,
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

  useFrame(({ clock }, delta) => {
    if (!groupRef.current || !rotationRef.current) return;

    const safeDelta = Math.min(delta, 0.05);
    const movementAlpha = 1 - Math.exp(-DRAG_FOLLOW_SPEED * safeDelta);
    const rotationAlpha = 1 - Math.exp(-ROTATION_FOLLOW_SPEED * safeDelta);
    const heightAlpha = 1 - Math.exp(-HEIGHT_TRANSITION_SPEED * safeDelta);
    const settleAlpha = 1 - Math.exp(-SETTLE_SPEED * safeDelta);

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

    if (isActive && phaseRef.current !== "placed" && centers) {
      if (tetherRef.current) {
        lineStartRef.current.copy(centers.currentLocal);
        lineEndRef.current.copy(centers.targetLocal);
        tetherRef.current.geometry.setFromPoints([
          lineStartRef.current,
          lineEndRef.current,
        ]);
        tetherRef.current.visible = phaseRef.current !== "installed";
      }

      if (tetherMaterialRef.current) {
        tetherMaterialRef.current.opacity = 0.18 + proximity * 0.58;
        tetherMaterialRef.current.color.set(
          proximity > 0.72 ? "#ffffff" : "#00ffb4"
        );
      }

      if (captureRingRef.current) {
        captureRingRef.current.visible = true;
        captureRingRef.current.position.copy(centers.targetLocal);
        const pulse = 1 + Math.sin(clock.elapsedTime * 4.2) * 0.05;
        captureRingRef.current.scale.setScalar(pulse);
      }

      if (captureRingMaterialRef.current) {
        captureRingMaterialRef.current.opacity = 0.16 + proximity * 0.4;
      }
    } else {
      if (tetherRef.current) tetherRef.current.visible = false;
      if (captureRingRef.current) captureRingRef.current.visible = false;
    }

    if (grabbingRef.current) {
      const pointerDeltaX =
        pointerClientRef.current.x - grabPointerStartRef.current.x;
      const pointerDeltaY =
        pointerClientRef.current.y - grabPointerStartRef.current.y;
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

      if (lockedY !== null) {
        dragCurrentYRef.current = THREE.MathUtils.lerp(
          dragCurrentYRef.current,
          lockedY,
          heightAlpha
        );
        desiredGroupLocalRef.current.y = dragCurrentYRef.current;
      }

      const desiredDistance = Math.hypot(
        desiredGroupLocalRef.current.x - targetPosition.x,
        desiredGroupLocalRef.current.z - targetPosition.z
      );

      assistedGoalRef.current.copy(desiredGroupLocalRef.current);

      // Preserve the same/default magnet range and strength. Only the drag
      // solver changed, so the part follows the pointer freely until it enters
      // the normal magnetic capture range.
      if (desiredDistance < magnetDistance) {
        const normalizedPull = THREE.MathUtils.clamp(
          1 - desiredDistance / magnetDistance,
          0,
          1
        );
        const easedPull = normalizedPull * normalizedPull *
          (3 - 2 * normalizedPull);
        const pull = DEFAULT_MAGNET_STRENGTH * easedPull;

        assistedGoalRef.current.lerp(targetPosition, pull);
        if (lockedY !== null) {
          assistedGoalRef.current.y = dragCurrentYRef.current;
        }

        magnetStateRef.current =
          desiredDistance <= autoSnapDistance * 1.5
            ? "Snap ready"
            : "Magnet engaged";

        if (!magnetNoticeRef.current && normalizedPull > 0.18) {
          magnetNoticeRef.current = true;
          onInteractionMessage(
            `Magnet engaged for ${COMPONENT_LABELS[part.key]}. Keep moving naturally toward the center.`
          );
        }
      } else {
        magnetStateRef.current = "Move closer";
        magnetNoticeRef.current = false;
      }

      groupRef.current.position.lerp(assistedGoalRef.current, movementAlpha);

      if (lockedY !== null) {
        groupRef.current.position.y = dragCurrentYRef.current;
      }

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
        proximity * 0.72
      );

      desiredQuaternionRef.current
        .copy(installedQuaternion)
        .slerp(detachedQuaternion, orientationBlend);
      rotationRef.current.quaternion.slerp(
        desiredQuaternionRef.current,
        rotationAlpha
      );

      const pointerInsideSnap = desiredDistance <= snapDistance * 1.05;
      const partInsideSnap = currentDistance <= autoSnapDistance;
      const laggingButCentered =
        pointerInsideSnap && currentDistance <= autoSnapDistance * 1.75;

      if (partInsideSnap || laggingButCentered) {
        magnetStateRef.current = "Auto snap";
        seatComponent();
        return;
      }
    } else if (phaseRef.current === "placed" && targetPosition) {
      groupRef.current.position.lerp(targetPosition, settleAlpha);
      groupRef.current.position.y = targetPosition.y;
      rotationRef.current.quaternion.slerp(detachedQuaternion, settleAlpha);
    } else if (phaseRef.current === "released") {
      if (lockedY !== null) {
        dragCurrentYRef.current = THREE.MathUtils.lerp(
          groupRef.current.position.y,
          lockedY,
          heightAlpha
        );
        groupRef.current.position.y = dragCurrentYRef.current;
      }
      rotationRef.current.quaternion.slerp(
        detachedQuaternion,
        rotationAlpha
      );
    } else {
      // Installed and newly detached components keep the authored installed
      // orientation. Rotation begins only after the part has visibly cleared
      // its slot, avoiding geometry passing through the case.
      rotationRef.current.quaternion.slerp(
        installedQuaternion,
        rotationAlpha
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
        onLockedPartClick(part.key);
        return;
      }

      if (phaseRef.current === "installed") {
        detachComponent();
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
      if (!isMovablePart) return;
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
    [canInteract, isMovablePart]
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
            <group position={[-modelCenter.x, -modelCenter.y, -modelCenter.z]}>
              <primitive object={clonedScene} dispose={null} />
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
          opacity={0.42}
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
          opacity={0.2}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </>
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
    const materials = [];

    fillScene.traverse((object) => {
      if (!object.isMesh) return;
      object.raycast = () => null;
      const material = new THREE.MeshBasicMaterial({
        color: "#00ffb4",
        transparent: true,
        opacity: 0.13,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      object.material = material;
      object.renderOrder = 1080;
      materials.push(material);
    });

    wireScene.traverse((object) => {
      if (!object.isMesh) return;
      object.raycast = () => null;
      const material = new THREE.MeshBasicMaterial({
        color: "#73ffd4",
        transparent: true,
        opacity: 0.72,
        wireframe: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      object.material = material;
      object.renderOrder = 1081;
      materials.push(material);
    });

    fillScene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(fillScene);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const targetQuaternion = target.preserveInstalledRotation
      ? new THREE.Quaternion()
      : getAutomaticLayFlatQuaternion(size);

    return {
      fillScene,
      wireScene,
      materials,
      center,
      size,
      targetQuaternion,
    };
  }, [part.key, scene, target.preserveInstalledRotation]);

  useEffect(() => {
    return () => {
      guideData.materials.forEach((material) => material.dispose());
    };
  }, [guideData]);

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.getElapsedTime() * 3.4) + 1) / 2;

    if (pulseRef.current) {
      const scale = 0.985 + pulse * 0.03;
      pulseRef.current.scale.setScalar(scale);
      pulseRef.current.traverse((object) => {
        if (object.isMesh && object.material) {
          object.material.opacity = object.material.wireframe
            ? 0.5 + pulse * 0.34
            : 0.08 + pulse * 0.12;
        }
      });
    }

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
        <group
          position={[
            guideData.center.x,
            guideData.center.y,
            guideData.center.z,
          ]}
        >
          <group quaternion={guideData.targetQuaternion}>
            <group
              position={[
                -guideData.center.x,
                -guideData.center.y,
                -guideData.center.z,
              ]}
            >
              <primitive object={guideData.fillScene} dispose={null} />
              <primitive object={guideData.wireScene} dispose={null} />
            </group>
          </group>
        </group>
      </group>

      <mesh
        ref={ringRef}
        position={[
          guideData.center.x,
          guideData.center.y,
          guideData.center.z,
        ]}
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
        position={[
          guideData.center.x,
          guideData.center.y,
          guideData.center.z,
        ]}
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

      <Html
        center
        position={[
          guideData.center.x,
          guideData.center.y + Math.max(guideData.size.y, 1) + 1.2,
          guideData.center.z,
        ]}
        style={{ pointerEvents: "none" }}
      >
        <div className="whitespace-nowrap rounded-xl border border-[#00ffb4]/35 bg-[#07111d]/92 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#73ffd4] shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-md">
          Place {COMPONENT_LABELS[part.key]} here
        </div>
      </Html>
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

function AssembledPC({
  parts,
  activePartKey,
  completedParts,
  onPartCompleted,
  onLockedPartClick,
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
          isActive={part.key === activePartKey}
          isCompleted={completedParts.includes(part.key)}
          onPartCompleted={onPartCompleted}
          onLockedPartClick={onLockedPartClick}
          onInteractionMessage={onInteractionMessage}
          onDragStateChange={onDragStateChange}
          onTelemetry={onTelemetry}
        />
      ))}
      {parts
        .filter(
          (part) =>
            part.key === activePartKey &&
            PLACEMENT_TARGETS[part.key]?.position
        )
        .map((part) => (
          <PlacementTargetGuide
            key={`target-${part.key}`}
            part={part}
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
    const isNewOverviewRequest =
      overviewRequest !== handledOverviewRequestRef.current;

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
      const horizontalFov = 2 * Math.atan(
        Math.tan(verticalFov / 2) * Math.max(size.width / size.height, 0.5)
      );
      const verticalDistance =
        (sceneSize.y * 0.58) / Math.max(Math.tan(verticalFov / 2), 0.2);
      const horizontalDistance =
        (sceneSize.x * 0.58) / Math.max(Math.tan(horizontalFov / 2), 0.2);
      const depthDistance = sceneSize.z * 0.72;
      const distance = Math.max(
        verticalDistance,
        horizontalDistance,
        depthDistance,
        8
      );

      // Positive Z gives a consistent front three-quarter view for both
      // platform scenes. It avoids the old starting angle behind the case.
      const direction = new THREE.Vector3(...EASY_DRAG_CAMERA_DIRECTION).normalize();
      const target = center.clone();
      target.y += sceneSize.y * 0.015;

      camera.position
        .copy(target)
        .addScaledVector(
          direction,
          distance * OVERVIEW_CAMERA_DISTANCE_MULTIPLIER
        );
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

function AssistedCameraRig({
  telemetry,
  controlsRef,
  focusRequest,
  isDraggingPart,
}) {
  const { camera, size } = useThree();
  const animationRef = useRef(null);
  const fromCameraRef = useRef(new THREE.Vector3());
  const toCameraRef = useRef(new THREE.Vector3());
  const fromTargetRef = useRef(new THREE.Vector3());
  const toTargetRef = useRef(new THREE.Vector3());
  const preferredDirectionRef = useRef(
    new THREE.Vector3(...EASY_DRAG_CAMERA_DIRECTION).normalize()
  );
  const handledFocusRequestRef = useRef(0);

  useEffect(() => {
    if (isDraggingPart) animationRef.current = null;
  }, [isDraggingPart]);

  useEffect(() => {
    // Keep the wide overview camera as the normal/default view.
    // A close part-and-target camera move happens only after the user
    // explicitly presses the Focus Part + Target button.
    if (focusRequest <= 0) return;
    if (handledFocusRequestRef.current === focusRequest) return;
    if (!telemetry || !controlsRef.current || isDraggingPart) return;

    handledFocusRequestRef.current = focusRequest;

    const partPosition = new THREE.Vector3(...telemetry.currentCenter);
    const targetPosition = new THREE.Vector3(...telemetry.targetCenter);
    const radius = Math.max(telemetry.modelRadius || 1, 0.5);

    const focusBox = new THREE.Box3()
      .setFromPoints([partPosition, targetPosition])
      .expandByScalar(radius * 1.35 + 0.8);
    const midpoint = focusBox.getCenter(new THREE.Vector3());
    const focusSize = focusBox.getSize(new THREE.Vector3());

    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(
      Math.tan(verticalFov / 2) * Math.max(size.width / size.height, 0.5)
    );
    const verticalDistance =
      (focusSize.y * 0.56) / Math.max(Math.tan(verticalFov / 2), 0.2);
    const horizontalDistance =
      (focusSize.x * 0.56) / Math.max(Math.tan(horizontalFov / 2), 0.2);
    const depthDistance = focusSize.z * 0.72;
    const cameraDistance = THREE.MathUtils.clamp(
      Math.max(verticalDistance, horizontalDistance, depthDistance, radius * 4, 5),
      5,
      220
    );

    fromCameraRef.current.copy(camera.position);
    fromTargetRef.current.copy(controlsRef.current.target);
    toTargetRef.current.copy(midpoint);
    toTargetRef.current.y += radius * 0.12;
    toCameraRef.current
      .copy(toTargetRef.current)
      .addScaledVector(preferredDirectionRef.current, cameraDistance * 1.08);

    animationRef.current = {
      startedAt: performance.now(),
      duration: CAMERA_FOCUS_DURATION_MS,
    };
  }, [
    camera,
    controlsRef,
    focusRequest,
    isDraggingPart,
    size.height,
    size.width,
    telemetry,
  ]);

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
  parts,
  activePartKey,
  completedParts,
  onPartCompleted,
  onLockedPartClick,
  onInteractionMessage,
}) {
  const [isDraggingPart, setIsDraggingPart] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [overviewRequest, setOverviewRequest] = useState(0);
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

  useEffect(() => {
    // Changing steps keeps the stable overview camera. The user can still
    // request a close framing at any time with Focus Part + Target.
    setTelemetry(null);
  }, [activePartKey]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [24, 18, 110], fov: 44, near: 0.01, far: 2000 }}
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

        <ModelErrorBoundary parts={parts}>
          <Suspense fallback={<Loader />}>
            <AssembledPC
              rootRef={sceneRootRef}
              parts={parts}
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

        <InitialSceneCamera
          sceneRootRef={sceneRootRef}
          controlsRef={controlsRef}
          overviewRequest={overviewRequest}
        />

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
          enablePan={false}
          enableZoom
          zoomSpeed={0.5}
          zoomToCursor
          enableDamping
          dampingFactor={0.1}
          minPolarAngle={0.18}
          maxPolarAngle={Math.PI * 0.49}
          minDistance={1.2}
          maxDistance={260}
          mouseButtons={{
            LEFT: null,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
        />
      </Canvas>

      <div className="absolute left-4 top-4 z-[80] flex max-w-[calc(100%-180px)] flex-wrap gap-2">
        <div className="pointer-events-none rounded-xl border border-[#00ffb4]/35 bg-[#00ffb4]/14 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#b7fff0] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          {DISASSEMBLY_UX_VERSION}
        </div>
        <div className="pointer-events-none rounded-xl border border-[#00ffb4]/30 bg-[#0b1220]/92 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7dffdc] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          Default Overview Camera
        </div>
        <button
          type="button"
          onClick={() => setOverviewRequest((value) => value + 1)}
          disabled={isDraggingPart}
          className="rounded-xl border border-[#00ffb4]/30 bg-[#0b1220]/92 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7dffdc] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-[#00ffb4]/12 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Reset Overview
        </button>
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
        <div className="pointer-events-none absolute bottom-4 left-4 z-[80] w-[min(350px,calc(100%-32px))] rounded-2xl border border-[#00ffb4]/25 bg-[#0b1220]/94 px-4 py-3 text-[11px] leading-5 text-[#dbe6f5] shadow-[0_12px_35px_rgba(0,0,0,0.4)] backdrop-blur-xl">
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
            {telemetry.yTransitioning
              ? "Safe extraction is lowering the part smoothly to the table-seat height."
              : telemetry.yLocked
              ? "Table-height alignment is active. The normal magnet engages only near the target."
              : "Detach the part, then grab it. Screen-space dragging stays responsive from any allowed camera angle."}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header dropdown                                                     */
/* ------------------------------------------------------------------ */

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

        <div className="absolute right-0 top-full mt-2 z-[220] w-52 rounded-2xl border border-[#1a2438] bg-[#0d1220]/98 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
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

function Sidebar({ open, onToggle, currentStep, completedSteps, onSelect, canSelectStep, currentStepCompleted, onViewCertificate }) {
  return (
    <div
      className={[
        "absolute left-0 top-0 z-[200] h-full transition-all duration-300",
        open ? "w-[280px]" : "w-[64px]",
      ].join(" ")}
    >
      <div className="h-full border-r border-[#1a2438] bg-[#0b1220]/92 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
        <div className="flex items-center justify-between border-b border-[#1a2438] px-4 py-4">
          {open ? (
            <div>
              <div className="text-sm font-bold text-white">Disassembly Steps</div>
              <div className="text-[11px] text-[#7a8ba8]">AMD Platform</div>
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
          {steps.map((m, index) => {
            const done = !!completedSteps[m.key];
            const active = currentStep === index;
            const unlocked = canSelectStep(index);

            return (
              <button
                key={m.key}
                type="button"
                onClick={() => onSelect(index)}
                aria-disabled={!unlocked}
                className={[
                  "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                  active ? "border-[#00ffb4]/25 bg-[#00ffb4]/10" : "border-[#1a2438] bg-white/[0.03]",
                  unlocked ? "hover:bg-white/[0.06]" : "cursor-not-allowed opacity-45",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition",
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
                    <div className="text-sm font-semibold text-white">{m.name}</div>
                    <div className="text-[11px] text-[#7a8ba8]">
                      {done ? "Finished" : active ? "Current step" : unlocked ? "Available" : "Locked"}
                    </div>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        {currentStep === steps.length - 1 && currentStepCompleted && (
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
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export default function Module2DisassemblyAMD({ onFinish, onBack, onLogout }) {
  const [step, setStep] = useState(0);
  const [completedParts, setCompletedParts] = useState([]);
  const [sceneRevision, setSceneRevision] = useState(0);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [validationMessage, setValidationMessage] = useState(
    "Begin with the GPU. Detach it, grab it, then move it into the highlighted table seat."
  );

  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    { role: "assistant", content: "Hello! I'm your PC Disassembly AI assistant (AMD)." },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [settings, setSettings] = useState({ sound: true, animations: true, darkMode: true });

  const currentStep = steps[step];
  const activePartKey = currentStep?.partKey || null;
  const activePartLabel = activePartKey ? COMPONENT_LABELS[activePartKey] : null;
  const allComponentsRemoved = completedParts.length === REMOVAL_SEQUENCE.length;

  const effectiveCompletedSteps = useMemo(() => {
    return Object.fromEntries(
      steps.map((item) => [
        item.key,
        item.partKey
          ? completedParts.includes(item.partKey)
          : allComponentsRemoved,
      ])
    );
  }, [allComponentsRemoved, completedParts]);

  const currentStepCompleted =
    currentStep?.key === "final" && allComponentsRemoved;

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
    setStep(0);
    setSceneRevision((value) => value + 1);
    setShowCertificate(false);
    setValidationMessage(
      "Scene restarted. Begin with the GPU and place it in the highlighted table seat."
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
    } catch (error) {
      console.error("Error saving final Module 2 (AMD) completion:", error);
    }
  }, [firebaseUser]);

  const handlePartCompleted = useCallback(
    (partKey) => {
      if (partKey !== activePartKey || completedParts.includes(partKey)) return;

      const nextCompletedParts = [...completedParts, partKey];
      setCompletedParts(nextCompletedParts);

      const finished = nextCompletedParts.length === REMOVAL_SEQUENCE.length;
      if (finished) {
        setStep(steps.length - 1);
        setValidationMessage(
          "Full disassembly complete. Every required component has been removed in order."
        );
        void saveFinalCompletion();
        return;
      }

      const nextStepIndex = step + 1;
      const nextPartKey = steps[nextStepIndex]?.partKey;
      setStep(nextStepIndex);
      setValidationMessage(
        `${COMPONENT_LABELS[partKey]} completed. Next: ${COMPONENT_LABELS[nextPartKey]}.`
      );
    }, [activePartKey, completedParts, saveFinalCompletion, step]
  );

  const handleLockedPartClick = useCallback(
    (partKey) => {
      const clickedLabel = COMPONENT_LABELS[partKey] || "This component";
      setValidationMessage(
        `${clickedLabel} is locked. Follow the sequence and remove ${activePartLabel || "the current component"} first.`
      );
    }, [activePartLabel]
  );

  const handleSelectStep = useCallback(
    (index) => {
      if (index === step) return;

      if (index > step) {
        setValidationMessage(
          `That step is locked. Complete ${activePartLabel || "the current step"} first.`
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
      const response = await fetch("http://127.0.0.1:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: aiInput,
          context: {
            module: "disassembly",
            platform: "amd",
            currentStep: currentStep?.name,
            activeComponent: activePartLabel,
            completedParts,
          },
        }),
      });

      const data = await response.json();
      setAiMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch (error) {
      console.error(error);
      setAiMessages((prev) => [
        ...prev,
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
              <h1 className="mb-4 text-4xl font-black tracking-tight text-white md:text-6xl">Congratulations</h1>
              <h2 className="mb-6 text-xl font-bold text-[#dbe6f5] md:text-3xl">
                You Have Completed Module 2 — AMD Disassembly
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-sm leading-7 text-[#9fb0ca]">
                You completed the ordered removal of the GPU, SSD, HDD, both RAM modules,
                CPU, PSU, and motherboard.
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
                Module 2 — <span className="text-[#dbe6f5]">Disassembly (AMD)</span>
              </div>
              <div className="rounded-lg border border-[#1a2438] bg-white/[0.03] px-2 py-1 text-[11px]">
                Step {step + 1} of {steps.length}
              </div>
            </div>

            <div className="relative z-[120] mt-3 px-6 md:px-10">
              <div className="flex w-full items-center justify-between gap-4 rounded-[22px] border border-[#1a2438] bg-[#0b1220]/86 px-6 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.30)] backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <img src="/PNG/Articton.png" alt="Articton Logo" className="h-10 w-10 scale-300 object-contain ml-4" />
                  <div>
                    <div className="text-base font-bold tracking-wide text-white">Articton</div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-[#00ffb4]">AMD Disassembly View</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {validationMessage && (
                    <div className="max-w-[520px] rounded-2xl border border-[#00ffb4]/20 bg-[#00ffb4]/8 px-4 py-2 text-xs font-semibold text-[#dffef5]">
                      {validationMessage}
                    </div>
                  )}

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
                  <div className="text-sm font-semibold text-white">{currentStep?.name}</div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[#7a8ba8]">
                    {activePartLabel
                      ? `1st click: detach ${activePartLabel} • 2nd click: grab • move mouse • 3rd click: release`
                      : "Sequence complete • review the result or open the certificate"}
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
                  className="absolute top-3 bottom-3 right-3 z-[40] overflow-hidden rounded-[18px] border border-[#1a2438] bg-black/20 transition-all duration-300 md:top-4 md:bottom-4 md:right-4"
                  style={{ left: sidebarOpen ? 280 : 64 }}
                >
                  <ModelViewer
                    key={sceneRevision}
                    parts={PART_MODELS}
                    activePartKey={activePartKey}
                    completedParts={completedParts}
                    onPartCompleted={handlePartCompleted}
                    onLockedPartClick={handleLockedPartClick}
                    onInteractionMessage={setValidationMessage}
                  />

                  <div className="absolute right-5 top-5 z-[500] flex flex-col items-end">
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