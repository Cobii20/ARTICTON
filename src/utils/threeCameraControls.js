import * as THREE from "three";

export const GUIDED_ASSEMBLY_CAMERA_PRESET = Object.freeze({
  direction: [0.16, 1.62, 0.42],
  fitPadding: 1.34,
  distanceMultiplier: 1.05,
  targetYOffset: 0.01,
  minDistanceRatio: 0.5,
  maxDistanceRatio: 2.15,
  minDistanceFloor: 8,
  maxDistanceFloor: 180,
  maxDistanceCeiling: 200,
  nearRatio: 700,
  farRatio: 28,
});

export const ASSEMBLY_MOTHERBOARD_TASK_CAMERA_PRESET = Object.freeze({
  direction: [0.02, 1.78, 0.18],
  fitPadding: 1.42,
  distanceMultiplier: 1.02,
  targetYOffset: 0.025,
  minDistanceRatio: 0.5,
  maxDistanceRatio: 2.05,
  minDistanceFloor: 4.5,
  maxDistanceFloor: 150,
  maxDistanceCeiling: 200,
  nearRatio: 650,
  farRatio: 20,
});

export const ASSEMBLY_CASE_TASK_CAMERA_PRESET = Object.freeze({
  direction: [0.16, 1.48, 0.34],
  fitPadding: 1.18,
  distanceMultiplier: 0.98,
  targetYOffset: 0.015,
  minDistanceRatio: 0.5,
  maxDistanceRatio: 2.18,
  minDistanceFloor: 7,
  maxDistanceFloor: 150,
  maxDistanceCeiling: 200,
  nearRatio: 680,
  farRatio: 24,
});

export const GUIDED_DISASSEMBLY_CAMERA_PRESET = Object.freeze({
  direction: [0.5, 0.88, 1.16],
  fitPadding: 1.16,
  distanceMultiplier: 1.1,
  targetYOffset: 0.025,
  minDistanceRatio: 0.5,
  maxDistanceRatio: 2.15,
  minDistanceFloor: 7,
  maxDistanceFloor: 150,
  maxDistanceCeiling: 200,
  nearRatio: 650,
  farRatio: 26,
});

export const GUIDED_ASSEMBLY_ORBIT_PROPS = Object.freeze({
  enablePan: true,
  enableZoom: true,
  zoomSpeed: 0.46,
  zoomToCursor: true,
  enableDamping: true,
  dampingFactor: 0.09,
  panSpeed: 0.62,
  rotateSpeed: 0.52,
  minPolarAngle: 0.1,
  maxPolarAngle: Math.PI * 0.5,
  minDistance: 5,
  maxDistance: 200,
  mouseButtons: Object.freeze({
    LEFT: null,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.ROTATE,
  }),
  touches: Object.freeze({
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  }),
});

export const GUIDED_DISASSEMBLY_ORBIT_PROPS = Object.freeze({
  enablePan: true,
  enableZoom: true,
  zoomSpeed: 0.6,
  zoomToCursor: true,
  enableDamping: true,
  dampingFactor: 0.085,
  panSpeed: 0.68,
  rotateSpeed: 0.7,
  minPolarAngle: 0.18,
  maxPolarAngle: Math.PI * 0.52,
  minDistance: 7,
  maxDistance: 200,
  mouseButtons: Object.freeze({
    LEFT: null,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.ROTATE,
  }),
  touches: Object.freeze({
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  }),
});

export const INSPECTION_ORBIT_PROPS = Object.freeze({
  enablePan: true,
  enableZoom: true,
  zoomSpeed: 0.72,
  enableDamping: true,
  dampingFactor: 0.07,
  panSpeed: 0.65,
  rotateSpeed: 0.76,
  minPolarAngle: 0.05,
  maxPolarAngle: Math.PI * 0.84,
  mouseButtons: Object.freeze({
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.ROTATE,
  }),
  touches: Object.freeze({
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  }),
});

const ASSEMBLY_BOARD_KEYS = new Set(["cpu", "ram1", "ram2", "ssd"]);
const ASSEMBLY_CASE_KEYS = new Set(["motherboard", "psu", "hdd", "gpu"]);

function safeAspect(size) {
  return Math.max((size?.width || 1) / Math.max(size?.height || 1, 1), 0.5);
}

function distanceForBounds(sceneSize, camera, size, fitPadding) {
  const verticalFov = THREE.MathUtils.degToRad(camera.fov || 45);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * safeAspect(size));
  const largestHorizontal = Math.max(sceneSize.x, sceneSize.z * 0.9);
  const practicalHeight = Math.max(sceneSize.y, sceneSize.z * 0.42);

  const verticalDistance =
    (practicalHeight * fitPadding * 0.5) / Math.max(Math.tan(verticalFov / 2), 0.2);
  const horizontalDistance =
    (largestHorizontal * fitPadding * 0.5) / Math.max(Math.tan(horizontalFov / 2), 0.2);
  const depthDistance = Math.max(sceneSize.x, sceneSize.z) * fitPadding * 0.48;

  return Math.max(verticalDistance, horizontalDistance, depthDistance);
}

export function frameSceneCamera({
  camera,
  controls,
  root,
  objects,
  size,
  preset,
  minDistance = 8,
  durationMs = 0,
}) {
  if (!camera || !controls || !root) return false;

  root.updateWorldMatrix(true, true);
  const focusObjects = Array.isArray(objects) ? objects.filter(Boolean) : [];
  const box = new THREE.Box3();
  if (focusObjects.length) {
    focusObjects.forEach((object) => {
      object.updateWorldMatrix(true, true);
      box.expandByObject(object);
    });
  } else {
    box.setFromObject(root);
  }
  if (box.isEmpty()) return false;

  const center = box.getCenter(new THREE.Vector3());
  const sceneSize = box.getSize(new THREE.Vector3());
  const baseDistance = distanceForBounds(
    sceneSize,
    camera,
    size,
    preset.fitPadding ?? 1.15
  );
  const distance = Math.max(baseDistance * (preset.distanceMultiplier ?? 1.1), minDistance);
  const direction = new THREE.Vector3(...(preset.direction || [0.5, 0.9, 1])).normalize();
  const target = center.clone();
  target.y += sceneSize.y * (preset.targetYOffset ?? 0.02);

  const nextPosition = target.clone().addScaledVector(direction, distance);
  camera.near = Math.max(0.01, distance / (preset.nearRatio ?? 650));
  camera.far = Math.max(1000, distance * (preset.farRatio ?? 24));
  camera.updateProjectionMatrix();
  controls.minDistance = Math.max(
    preset.minDistanceFloor ?? minDistance,
    distance * (preset.minDistanceRatio ?? 0.16)
  );
  const calculatedMaxDistance = Math.max(
    preset.maxDistanceFloor ?? distance * 2,
    distance * (preset.maxDistanceRatio ?? 2.6)
  );
  const cappedMaxDistance =
    typeof preset.maxDistanceCeiling === "number"
      ? Math.min(preset.maxDistanceCeiling, calculatedMaxDistance)
      : calculatedMaxDistance;
  controls.maxDistance = Math.max(controls.minDistance + 1, cappedMaxDistance);

  const applyFrame = (position, lookTarget) => {
    camera.position.copy(position);
    controls.target.copy(lookTarget);
    camera.lookAt(lookTarget);
    controls.update();
  };

  if (typeof controls.__artictonCancelFrameCamera === "function") {
    controls.__artictonCancelFrameCamera();
  }

  const safeDuration = Math.max(0, Number(durationMs) || 0);
  if (safeDuration <= 0 || typeof requestAnimationFrame !== "function") {
    applyFrame(nextPosition, target);
    return true;
  }

  const startPosition = camera.position.clone();
  const startTarget = controls.target.clone();
  const startAt = performance.now();
  let frameId = 0;
  let interrupted = false;

  const stopAnimation = () => {
    interrupted = true;
    if (frameId) cancelAnimationFrame(frameId);
    if (controls.domElement) {
      controls.domElement.removeEventListener("pointerdown", stopAnimation);
      controls.domElement.removeEventListener("wheel", stopAnimation);
      controls.domElement.removeEventListener("touchstart", stopAnimation);
    }
    controls.__artictonCancelFrameCamera = null;
  };

  controls.__artictonCancelFrameCamera = stopAnimation;
  if (controls.domElement) {
    controls.domElement.addEventListener("pointerdown", stopAnimation, { once: true });
    controls.domElement.addEventListener("wheel", stopAnimation, { once: true });
    controls.domElement.addEventListener("touchstart", stopAnimation, { once: true });
  }

  const step = (now) => {
    if (interrupted) return;

    const rawProgress = Math.min(1, (now - startAt) / safeDuration);
    const easedProgress =
      rawProgress < 0.5
        ? 4 * rawProgress * rawProgress * rawProgress
        : 1 - Math.pow(-2 * rawProgress + 2, 3) / 2;
    const position = startPosition.clone().lerp(nextPosition, easedProgress);
    const lookTarget = startTarget.clone().lerp(target, easedProgress);

    applyFrame(position, lookTarget);

    if (rawProgress < 1) {
      frameId = requestAnimationFrame(step);
      return;
    }

    stopAnimation();
    applyFrame(nextPosition, target);
  };

  frameId = requestAnimationFrame(step);

  return true;
}

export function getAssemblyCameraFocus(activePartKeys = []) {
  const activeKeys = activePartKeys.filter(Boolean);
  const activeBoardKeys = activeKeys.filter((key) => ASSEMBLY_BOARD_KEYS.has(key));
  const activeCaseKeys = activeKeys.filter((key) => ASSEMBLY_CASE_KEYS.has(key));

  if (activeBoardKeys.length) {
    return {
      keys: ["motherboard", ...activeBoardKeys],
      minDistance: 6,
      preset: ASSEMBLY_MOTHERBOARD_TASK_CAMERA_PRESET,
    };
  }

  if (activeCaseKeys.length) {
    return {
      keys: ["case", ...activeCaseKeys],
      minDistance: 10,
      preset: ASSEMBLY_CASE_TASK_CAMERA_PRESET,
    };
  }

  return {
    keys: null,
    minDistance: 12,
    preset: GUIDED_ASSEMBLY_CAMERA_PRESET,
  };
}

export function collectFocusObjects(root, focusKeys) {
  if (!root || !Array.isArray(focusKeys) || !focusKeys.length) return [];

  const keySet = new Set(focusKeys);
  const objects = [];
  root.traverse((object) => {
    const focusKey = object.userData?.artictonFocusKey;
    if (focusKey && keySet.has(focusKey)) {
      objects.push(object);
    }
  });
  return objects;
}
