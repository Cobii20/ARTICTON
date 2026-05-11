import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  useGLTF,
  ContactShadows,
  Html,
} from "@react-three/drei";

/** MODEL URLS */
const CASE_URL = "/models/PC%20CASE(BLENDER).glb";
const MB_URL = "/models/MB(BLENDER).glb";
const CPU_URL = "/models/CPU(BLENDER).glb";
const RAM_URL = "/models/RAM(BLENDER).glb";
const SSD_URL = "/models/SSD(BLENDER).glb";

/** CAMERA */
const CAMERA_POSITION = [45, 18, 18];
const CONTROL_TARGET = [24, -14, 7];

/** SNAP / MAGNET */
const SNAP_DISTANCE = 1.1;
const MAGNET_DISTANCE = 7.0;
const MAGNET_STRENGTH = 0.32;

/** WORK AREA */
const BOARD_Y = -14.95;
const BOARD_CENTER_X = 24;
const BOARD_CENTER_Z = 6.5;
const BOARD_SIZE = 26;
const GRID_DIVISIONS = 13;

/**
 * STATIC PC CASE POSITION
 * Provided from your scene.
 */
const CASE_POSITION = new THREE.Vector3(27.88, -12.79, 35.74);
const CASE_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const CASE_SCALE = 1;

/**
 * MOTHERBOARD ASSEMBLY START OFFSET
 */
const MB_ASSEMBLY_START_OFFSET = new THREE.Vector3(0, 0, 0);

/**
 * FLOATING POSITION IN FRONT OF CASE
 * This is only the transition stop point.
 * After transition, it no longer forces the motherboard back here.
 */
const MB_ASSEMBLY_FRONT_OF_CASE_OFFSET = new THREE.Vector3(-4.5, -9.3, 11.5);

/**
 * FLOATING HEIGHT
 * This affects transition only.
 */
const MB_ASSEMBLY_FLOAT_HEIGHT_Y = 0.4;

/**
 * FLOATING MIDPOINT
 */
const MB_ASSEMBLY_FLOAT_MID_OFFSET = new THREE.Vector3(-4.5, 0.4, 11.5);

/**
 * MOTHERBOARD DRAG Y LOCK
 * This only affects the user drag after the transition is finished.
 * It does NOT affect the floating transition.
 */
const MB_DRAG_Y_LOCK = -9.13;

/**
 * MOTHERBOARD FINAL SEATED POSITION
 * Provided from your scene.
 */
const MB_ASSEMBLY_CASE_TARGET_OFFSET = new THREE.Vector3(-2.49, -9.13, 21.59);

/**
 * MOTHERBOARD ASSEMBLY ROTATION
 */
const MB_ASSEMBLY_START_ROTATION = new THREE.Euler(0, 0, 0);
const MB_ASSEMBLY_FRONT_ROTATION = new THREE.Euler(-Math.PI / 2, 0, 0);
const MB_ASSEMBLY_CASE_ROTATION = new THREE.Euler(-Math.PI / 2, 0, 0);

/**
 * ANIMATED TRANSITION SETTINGS
 */
const FLOAT_TRANSITION_SPEED = 0.22;

/**
 * MOTHERBOARD POSITION ON WORKBENCH
 */
const MB_POSITION = new THREE.Vector3(33.54, -14.87, 11.32);
const MB_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const MB_SCALE = 1;

/**
 * INSTALLED CPU POSITION
 */
const CPU_SEATED_POSITION = new THREE.Vector3(27.91, -15.49, 6.98);
const CPU_ROTATION = new THREE.Euler(0, Math.PI, 0);

/**
 * INSTALLED RAM POSITION
 */
const RAM_SEATED_POSITION = new THREE.Vector3(34.35, -20.74, 11.32);
const RAM_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);

/**
 * INSTALLED SSD POSITION
 */
const SSD_SEATED_POSITION = new THREE.Vector3(24.39, -17.03, 11.26);
const SSD_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);

/**
 * CASE TARGET HIGHLIGHT POSITION
 * Centered on the motherboard seated position.
 */
const CASE_TARGET_HIGHLIGHT_POSITION = new THREE.Vector3(-2.49, -9.08, 21.59);

const MB_COLOR = "#4aa3ff";
const CPU_COLOR = "#b56dff";
const RAM_COLOR = "#00ffb4";
const SSD_COLOR = "#ffcc00";

function cloneScene(scene, transparent = false) {
  const clone = scene.clone(true);

  clone.traverse((o) => {
    if (!o.isMesh) return;

    o.castShadow = true;
    o.receiveShadow = true;

    if (transparent && o.material) {
      if (Array.isArray(o.material)) {
        o.material = o.material.map((mat) => mat.clone());
      } else {
        o.material = o.material.clone();
      }
    }
  });

  return clone;
}

function setObjectOpacity(root, opacity) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;

    const materials = Array.isArray(o.material) ? o.material : [o.material];

    materials.forEach((mat) => {
      mat.transparent = opacity < 1;
      mat.opacity = opacity;
      mat.depthWrite = opacity >= 0.98;
      mat.needsUpdate = true;
    });
  });
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function Scene({
  onNext,
  onComplete,
}) {
  const { camera } = useThree();
  const [mbPlaced, setMbPlaced] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!mbPlaced) {
      completedRef.current = false;
      return;
    }

    if (completedRef.current) return;

    completedRef.current = true;
    onComplete?.();
  }, [mbPlaced, onComplete]);

  useEffect(() => {
    camera.position.set(...CAMERA_POSITION);
    camera.lookAt(...CONTROL_TARGET);
  }, [camera]);

  return (
    <>
      <color attach="background" args={["#05080D"]} />

      <ambientLight intensity={0.55} />

      <directionalLight
        position={[6, 10, 6]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      <pointLight position={[-3, 2, -2]} intensity={0.7} />

      <Environment preset="city" />

      <WorkBoard />

      <ComputerCase />

      <CaseTarget placed={mbPlaced} />

      <MotherboardAssemblyDraggable
        placed={mbPlaced}
        onPlaced={() => setMbPlaced(true)}
      />

      <InstructionPanel
        placed={mbPlaced}
        onNext={onNext}
      />

      <ContactShadows
        position={[BOARD_CENTER_X, BOARD_Y + 0.1, BOARD_CENTER_Z]}
        opacity={0.38}
        scale={46}
        blur={2.8}
        far={35}
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={14}
        maxDistance={80}
        target={CONTROL_TARGET}
        maxPolarAngle={Math.PI / 2}
        mouseButtons={{
          LEFT: null,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
      />
    </>
  );
}

function WorkBoard() {
  return (
    <group>
      <mesh
        position={[BOARD_CENTER_X, BOARD_Y, BOARD_CENTER_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshStandardMaterial color="#f6f7fb" roughness={0.58} metalness={0.02} />
      </mesh>

      <gridHelper
        args={[BOARD_SIZE, GRID_DIVISIONS, "#050505", "#050505"]}
        position={[BOARD_CENTER_X, BOARD_Y + 0.02, BOARD_CENTER_Z]}
      />
    </group>
  );
}

function ComputerCase() {
  const { scene } = useGLTF(CASE_URL);
  const caseClone = useMemo(() => cloneScene(scene, true), [scene]);

  useEffect(() => {
    setObjectOpacity(caseClone, 1);
  }, [caseClone]);

  return (
    <group
      position={CASE_POSITION}
      rotation={CASE_ROTATION.toArray()}
      scale={CASE_SCALE}
    >
      <primitive object={caseClone} />
    </group>
  );
}

function CaseTarget({ placed }) {
  const ringRef = useRef();
  const fillRef = useRef();

  useFrame(({ clock }) => {
    if (placed) return;

    const t = (Math.sin(clock.getElapsedTime() * 2.5) + 1) / 2;

    if (ringRef.current) {
      ringRef.current.scale.setScalar(1 + t * 0.12);
      ringRef.current.material.opacity = 0.5 + t * 0.35;
    }

    if (fillRef.current) {
      fillRef.current.material.opacity = 0.14 + t * 0.14;
    }
  });

  return (
    <group
      position={[
        CASE_TARGET_HIGHLIGHT_POSITION.x,
        CASE_TARGET_HIGHLIGHT_POSITION.y,
        CASE_TARGET_HIGHLIGHT_POSITION.z,
      ]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <mesh ref={fillRef}>
        <planeGeometry args={[5.4, 7.4]} />
        <meshBasicMaterial
          color={MB_COLOR}
          transparent
          opacity={placed ? 0.12 : 0.22}
          depthTest={false}
        />
      </mesh>

      {!placed && (
        <mesh ref={ringRef} position={[0, 0, 0.015]}>
          <ringGeometry args={[0.65, 1.1, 48]} />
          <meshBasicMaterial
            color={MB_COLOR}
            transparent
            opacity={0.85}
            depthTest={false}
          />
        </mesh>
      )}

      {!placed && (
        <Html center position={[0, -0.05, 0.03]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              padding: "4px 8px",
              borderRadius: 999,
              background: "rgba(10,14,22,.86)",
              border: `1px solid ${MB_COLOR}aa`,
              color: "rgba(244,248,255,.95)",
              fontSize: 10,
              fontFamily: "monospace",
              whiteSpace: "nowrap",
              transform: "translateY(-18px)",
            }}
          >
            Target: motherboard standoffs
          </div>
        </Html>
      )}
    </group>
  );
}

function MotherboardAssembly() {
  return (
    <>
      <InstalledMotherboard />
      <InstalledCPU />
      <InstalledRAM />
      <InstalledSSD />
    </>
  );
}

function InstalledMotherboard() {
  const { scene } = useGLTF(MB_URL);
  const mbClone = useMemo(() => cloneScene(scene, true), [scene]);

  useEffect(() => {
    setObjectOpacity(mbClone, 1);
  }, [mbClone]);

  return (
    <group position={MB_POSITION} rotation={MB_ROTATION.toArray()} scale={MB_SCALE}>
      <primitive object={mbClone} />
    </group>
  );
}

function InstalledCPU() {
  const { scene } = useGLTF(CPU_URL);
  const cpuClone = useMemo(() => cloneScene(scene, true), [scene]);

  const cpuQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(CPU_ROTATION),
    []
  );

  useEffect(() => {
    setObjectOpacity(cpuClone, 1);
  }, [cpuClone]);

  return (
    <group position={CPU_SEATED_POSITION} quaternion={cpuQuat} scale={1}>
      <primitive object={cpuClone} />
    </group>
  );
}

function InstalledRAM() {
  const { scene } = useGLTF(RAM_URL);
  const ramClone = useMemo(() => cloneScene(scene, true), [scene]);

  const ramQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(RAM_ROTATION),
    []
  );

  useEffect(() => {
    setObjectOpacity(ramClone, 1);
  }, [ramClone]);

  return (
    <group position={RAM_SEATED_POSITION} quaternion={ramQuat} scale={1}>
      <primitive object={ramClone} />
    </group>
  );
}

function InstalledSSD() {
  const { scene } = useGLTF(SSD_URL);
  const ssdClone = useMemo(() => cloneScene(scene, true), [scene]);

  const ssdQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(SSD_ROTATION),
    []
  );

  useEffect(() => {
    setObjectOpacity(ssdClone, 1);
  }, [ssdClone]);

  return (
    <group position={SSD_SEATED_POSITION} quaternion={ssdQuat} scale={1}>
      <primitive object={ssdClone} />
    </group>
  );
}

function MotherboardAssemblyDraggable({ placed, onPlaced }) {
  const { gl, camera } = useThree();

  const assemblyRef = useRef();
  const mouse = useRef(new THREE.Vector2());
  const dragOffset = useRef(new THREE.Vector3());

  const transitionStartPosition = useRef(new THREE.Vector3());
  const transitionStartQuaternion = useRef(new THREE.Quaternion());
  const transitionProgress = useRef(0);

  const [phase, setPhase] = useState("idle");
  const [snapped, setSnapped] = useState(placed);
  const [pos, setPos] = useState({
    x: MB_ASSEMBLY_START_OFFSET.x,
    y: MB_ASSEMBLY_START_OFFSET.y,
    z: MB_ASSEMBLY_START_OFFSET.z,
  });

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);

  /**
   * Drag plane is locked to the final motherboard Y level.
   * This is only used when phase === "readyToDrag" or "dragging".
   */
  const dragPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -MB_DRAG_Y_LOCK),
    []
  );

  const startQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(MB_ASSEMBLY_START_ROTATION),
    []
  );

  const frontQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(MB_ASSEMBLY_FRONT_ROTATION),
    []
  );

  const caseQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(MB_ASSEMBLY_CASE_ROTATION),
    []
  );

  const updateMouse = useCallback(
    (e) => {
      const rect = gl.domElement.getBoundingClientRect();

      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    },
    [gl]
  );

  const isPointerOverAssembly = useCallback(() => {
    if (!assemblyRef.current) return false;

    raycaster.setFromCamera(mouse.current, camera);
    return raycaster.intersectObject(assemblyRef.current, true).length > 0;
  }, [camera, raycaster]);

  const beginFrontTransition = useCallback(() => {
    if (!assemblyRef.current) return;

    transitionStartPosition.current.copy(assemblyRef.current.position);
    transitionStartQuaternion.current.copy(assemblyRef.current.quaternion);
    transitionProgress.current = 0;

    setPhase("floatingToCaseFront");
  }, []);

  const moveToStart = useCallback(() => {
    if (!assemblyRef.current) return;

    assemblyRef.current.position.copy(MB_ASSEMBLY_START_OFFSET);
    assemblyRef.current.quaternion.copy(startQuat);
  }, [startQuat]);

  const moveToCaseTarget = useCallback(() => {
    if (!assemblyRef.current) return;

    assemblyRef.current.position.copy(MB_ASSEMBLY_CASE_TARGET_OFFSET);
    assemblyRef.current.quaternion.copy(caseQuat);
  }, [caseQuat]);

  useEffect(() => {
    if (!assemblyRef.current) return;

    if (placed) {
      moveToCaseTarget();
      setSnapped(true);
      setPhase("snapped");
    } else {
      moveToStart();
      setSnapped(false);
      setPhase("idle");
    }
  }, [placed, moveToStart, moveToCaseTarget]);

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (e.button !== 0 || !assemblyRef.current || snapped) return;

      updateMouse(e);

      const hitAssembly = isPointerOverAssembly();

      if (!hitAssembly && phase !== "dragging") return;

      if (phase === "idle") {
        beginFrontTransition();
        return;
      }

      if (phase === "floatingToCaseFront") {
        return;
      }

      if (phase === "readyToDrag") {
        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.set(
            assemblyRef.current.position.x - hitPoint.x,
            0,
            assemblyRef.current.position.z - hitPoint.z
          );
        }

        setPhase("dragging");
        document.body.style.cursor = "grabbing";
        return;
      }

      if (phase === "dragging") {
        setPhase("readyToDrag");
        document.body.style.cursor = "default";

        const dist = new THREE.Vector2(
          assemblyRef.current.position.x - MB_ASSEMBLY_CASE_TARGET_OFFSET.x,
          assemblyRef.current.position.z - MB_ASSEMBLY_CASE_TARGET_OFFSET.z
        ).length();

        if (dist < SNAP_DISTANCE * 1.35) {
          moveToCaseTarget();
          setSnapped(true);
          setPhase("snapped");
          onPlaced?.();
        }
      }
    };

    gl.domElement.addEventListener("pointerdown", handlePointerDown);

    return () => {
      gl.domElement.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [
    beginFrontTransition,
    camera,
    dragPlane,
    gl,
    hitPoint,
    isPointerOverAssembly,
    moveToCaseTarget,
    onPlaced,
    phase,
    raycaster,
    snapped,
    updateMouse,
  ]);

  useEffect(() => {
    const handlePointerMove = (e) => updateMouse(e);
    const preventContext = (e) => e.preventDefault();

    gl.domElement.addEventListener("pointermove", handlePointerMove);
    gl.domElement.addEventListener("contextmenu", preventContext);

    return () => {
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
      gl.domElement.removeEventListener("contextmenu", preventContext);
      document.body.style.cursor = "default";
    };
  }, [gl, updateMouse]);

  useFrame((_, delta) => {
    if (!assemblyRef.current) return;

    if (phase === "floatingToCaseFront") {
      transitionProgress.current = Math.min(
        transitionProgress.current + delta * FLOAT_TRANSITION_SPEED,
        1
      );

      const rawT = transitionProgress.current;
      const eased = easeInOutCubic(rawT);

      const start = transitionStartPosition.current;

      const liftPoint = new THREE.Vector3(
        start.x,
        MB_ASSEMBLY_FLOAT_HEIGHT_Y,
        start.z
      );

      const end = MB_ASSEMBLY_FRONT_OF_CASE_OFFSET;

      const currentPosition = new THREE.Vector3();

      if (rawT < 0.35) {
        const t = easeOutCubic(rawT / 0.35);
        currentPosition.lerpVectors(start, liftPoint, t);
      } else {
        const t = easeInOutCubic((rawT - 0.35) / 0.65);
        currentPosition.lerpVectors(liftPoint, end, t);
      }

      assemblyRef.current.position.copy(currentPosition);

      assemblyRef.current.quaternion
        .copy(transitionStartQuaternion.current)
        .slerp(frontQuat, eased);

      if (transitionProgress.current >= 1) {
        assemblyRef.current.position.copy(MB_ASSEMBLY_FRONT_OF_CASE_OFFSET);
        assemblyRef.current.quaternion.copy(frontQuat);
        setPhase("readyToDrag");
      }
    }

    /**
     * Waiting after transition:
     * Keep rotation upright only.
     * Do NOT force position back to transition point.
     */
    if (phase === "readyToDrag") {
      assemblyRef.current.quaternion.slerp(frontQuat, 0.12);
    }

    if (phase === "snapped") {
      assemblyRef.current.position.lerp(MB_ASSEMBLY_CASE_TARGET_OFFSET, 0.28);
      assemblyRef.current.quaternion.slerp(caseQuat, 0.28);
    }

    if (phase === "dragging") {
      raycaster.setFromCamera(mouse.current, camera);

      if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
        const targetDragPosition = new THREE.Vector3(
          hitPoint.x + dragOffset.current.x,
          MB_DRAG_Y_LOCK,
          hitPoint.z + dragOffset.current.z
        );

        assemblyRef.current.position.lerp(targetDragPosition, 0.35);
      }

      /**
       * Drag-only Y lock.
       * This does not affect transition because it only runs during dragging.
       */
      assemblyRef.current.position.y = MB_DRAG_Y_LOCK;

      assemblyRef.current.quaternion.slerp(caseQuat, 0.18);

      const dist = new THREE.Vector2(
        assemblyRef.current.position.x - MB_ASSEMBLY_CASE_TARGET_OFFSET.x,
        assemblyRef.current.position.z - MB_ASSEMBLY_CASE_TARGET_OFFSET.z
      ).length();

      /**
       * Magnet to seated position.
       * When close enough, the motherboard is pulled toward the target.
       * It automatically snaps when inside SNAP_DISTANCE.
       */
      if (dist < MAGNET_DISTANCE) {
        const magneticFactor = 1 - dist / MAGNET_DISTANCE;

        const pull = THREE.MathUtils.clamp(
          MAGNET_STRENGTH + magneticFactor * 0.35,
          0.18,
          0.62
        );

        const snapTarget = new THREE.Vector3(
          MB_ASSEMBLY_CASE_TARGET_OFFSET.x,
          MB_DRAG_Y_LOCK,
          MB_ASSEMBLY_CASE_TARGET_OFFSET.z
        );

        assemblyRef.current.position.lerp(snapTarget, pull);
        assemblyRef.current.quaternion.slerp(caseQuat, pull);

        if (dist < SNAP_DISTANCE) {
          moveToCaseTarget();
          setSnapped(true);
          setPhase("snapped");
          document.body.style.cursor = "default";
          onPlaced?.();
        }
      }
    }

    const worldPos = new THREE.Vector3();
    assemblyRef.current.getWorldPosition(worldPos);

    setPos({
      x: worldPos.x,
      y: worldPos.y,
      z: worldPos.z,
    });
  });

  const statusText =
    phase === "idle"
      ? "Click motherboard to start floating transition"
      : phase === "floatingToCaseFront"
      ? "Floating motherboard to case height..."
      : phase === "readyToDrag"
      ? "Click motherboard again to grab and drag into case"
      : phase === "dragging"
      ? "Dragging motherboard into case"
      : "Motherboard installed into case";

  return (
    <group>
      <group ref={assemblyRef} position={MB_ASSEMBLY_START_OFFSET}>
        <MotherboardAssembly />
      </group>

      {!snapped && (
        <Html fullscreen style={{ pointerEvents: "none" }}>
          <div
            style={{
              position: "absolute",
              left: 24,
              bottom: 24,
              padding: "12px 16px",
              minWidth: 330,
              borderRadius: 16,
              background: "rgba(10,14,22,.78)",
              border: `1px solid ${MB_COLOR}66`,
              backdropFilter: "blur(8px)",
              color: "rgba(234,240,255,.95)",
              fontSize: 12,
              fontFamily: "monospace",
              textAlign: "center",
              boxShadow: "0 10px 30px rgba(0,0,0,.35)",
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: 4 }}>
              Motherboard Assembly
            </div>

            <div style={{ marginBottom: 8 }}>{statusText}</div>

            <div>x: {pos.x.toFixed(2)}</div>
            <div>y: {pos.y.toFixed(2)}</div>
            <div>z: {pos.z.toFixed(2)}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function InstructionPanel({
  placed,
  onNext,
}) {
  return (
    <Html fullscreen style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 22,
          left: 24,
          padding: "12px 16px",
          minWidth: 410,
          borderRadius: 16,
          background: "rgba(10,14,22,.78)",
          border: "1px solid rgba(255,255,255,.14)",
          backdropFilter: "blur(8px)",
          color: "rgba(234,240,255,.95)",
          fontSize: 12,
          fontFamily: "monospace",
          boxShadow: "0 10px 30px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 8 }}>
          Step 4: Motherboard to Case
        </div>

        <div style={{ marginBottom: 10 }}>
          {placed
            ? "Motherboard assembly seated inside the case."
            : "Click the motherboard to float it to case height, then drag it near the seated position. The magnet will pull it into place."}
        </div>

        <div style={{ display: "grid", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: CPU_COLOR,
                display: "inline-block",
              }}
            />
            <span>1. CPU</span>
            <span style={{ marginLeft: "auto" }}>done</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: RAM_COLOR,
                display: "inline-block",
              }}
            />
            <span>2. RAM</span>
            <span style={{ marginLeft: "auto" }}>done</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: SSD_COLOR,
                display: "inline-block",
              }}
            />
            <span>3. SSD</span>
            <span style={{ marginLeft: "auto" }}>done</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: MB_COLOR,
                display: "inline-block",
                boxShadow: placed ? "none" : `0 0 14px ${MB_COLOR}`,
              }}
            />
            <span>4. Motherboard to case</span>
            <span style={{ marginLeft: "auto" }}>
              {placed ? "done" : "active"}
            </span>
          </div>
        </div>
      </div>
    </Html>
  );
}

export default function MBtoCase({
  onNext,
  onComplete,
}) {
  return (
    <Canvas
      shadows
      style={{ width: "100%", height: "100%" }}
      camera={{ position: CAMERA_POSITION, fov: 50 }}
    >
      <Scene
        onNext={onNext}
        onComplete={onComplete}
      />
    </Canvas>
  );
}

useGLTF.preload(CASE_URL);
useGLTF.preload(MB_URL);
useGLTF.preload(CPU_URL);
useGLTF.preload(RAM_URL);
useGLTF.preload(SSD_URL);