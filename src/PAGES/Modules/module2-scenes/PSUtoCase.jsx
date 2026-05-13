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
const HDD_URL = "/models/HDD(BLENDER).glb";
const PSU_URL = "/models/PSU(BLENDER).glb";

/** CAMERA */
const CAMERA_POSITION = [45, 18, 18];
const CONTROL_TARGET = [24, -14, 7];

/** SNAP / MAGNET */
const TRIGGER_DISTANCE = 1.15;
const TRIGGER_MAGNET_DISTANCE = 5.2;
const TRIGGER_MAGNET_STRENGTH = 0.28;

/** WORK AREA */
const BOARD_Y = -14.95;
const BOARD_CENTER_X = 24;
const BOARD_CENTER_Z = 6.5;
const BOARD_SIZE = 26;
const GRID_DIVISIONS = 13;

/**
 * STATIC PC CASE POSITION
 */
const CASE_POSITION = new THREE.Vector3(27.88, -12.79, 35.74);
const CASE_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const CASE_SCALE = 1;

/**
 * INSTALLED MOTHERBOARD ASSEMBLY POSITION
 */
const MB_ASSEMBLY_CASE_TARGET_OFFSET = new THREE.Vector3(-2.49, -9.13, 21.59);
const MB_ASSEMBLY_CASE_ROTATION = new THREE.Euler(-Math.PI / 2, 0, 0);

/**
 * MOTHERBOARD POSITION INSIDE ASSEMBLY
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
 * INSTALLED HDD POSITION
 * Current seated HDD values from your HDD assembly.
 */
const HDD_SEATED_POSITION = new THREE.Vector3(27.47, -12.18, 31.67);
const HDD_SEATED_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);

/**
 * PSU START POSITION
 * Temporary checkerboard start position.
 */
const PSU_START_POSITION = new THREE.Vector3(17.8, -15.8, 7.8);

/**
 * PSU Y LOCK
 * This applies only after the PSU is clicked/grabbed.
 */
const PSU_DRAG_Y_LOCK = -13.46;

/**
 * PSU INSERT READY POSITION
 * Drag PSU here first. When it reaches this point,
 * it locks and starts the smooth transition into the seated position.
 */
const PSU_INSERT_READY_POSITION = new THREE.Vector3(14.16, -13.46, 38.36);

/**
 * PSU FINAL SEATED POSITION
 * Provided from your scene.
 */
const PSU_SEATED_POSITION = new THREE.Vector3(20.83, -13.46, 38.36);

/**
 * PSU CLEARANCE POSITION
 * Middle point used for smooth non-clipping transition.
 * Adjust this if the PSU clips while sliding in.
 */
const PSU_CLEARANCE_POSITION = new THREE.Vector3(18.8, -13.46, 38.36);

/**
 * PSU TARGET HIGHLIGHT POSITION
 * Shows where the user should drag the PSU first.
 */
const PSU_TARGET_HIGHLIGHT_POSITION = new THREE.Vector3(14.16, -13.36, 38.36);

/**
 * PSU ROTATION
 * Adjust these if the PSU faces the wrong way.
 */
const PSU_START_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const PSU_INSERT_READY_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const PSU_SEATED_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);

/**
 * SMOOTH INSERT TRANSITION
 * Lower = slower.
 */
const PSU_INSERT_TRANSITION_SPEED = 0.24;

const MB_COLOR = "#4aa3ff";
const CPU_COLOR = "#b56dff";
const RAM_COLOR = "#00ffb4";
const SSD_COLOR = "#ffcc00";
const HDD_COLOR = "#ff8a3d";
const PSU_COLOR = "#ff4d6d";

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

function Scene({
  onNext,
  onComplete,
}) {
  const { camera } = useThree();
  const [psuPlaced, setPsuPlaced] = useState(false);
  const [psuInserting, setPsuInserting] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!psuPlaced) {
      completedRef.current = false;
      return;
    }

    if (completedRef.current) return;

    completedRef.current = true;
    onComplete?.();
  }, [psuPlaced, onComplete]);

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

      <InstalledMotherboardAssembly />

      <InstalledHDD />

      <PsuTarget placed={psuPlaced} inserting={psuInserting} />

      <PSUDraggable
        placed={psuPlaced}
        onInsertStart={() => setPsuInserting(true)}
        onPlaced={() => {
          setPsuInserting(false);
          setPsuPlaced(true);
        }}
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

function InstalledMotherboardAssembly() {
  const assemblyQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(MB_ASSEMBLY_CASE_ROTATION),
    []
  );

  return (
    <group position={MB_ASSEMBLY_CASE_TARGET_OFFSET} quaternion={assemblyQuat}>
      <InstalledMotherboard />
      <InstalledCPU />
      <InstalledRAM />
      <InstalledSSD />
    </group>
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

function InstalledHDD() {
  const { scene } = useGLTF(HDD_URL);
  const hddClone = useMemo(() => cloneScene(scene, true), [scene]);

  const hddQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(HDD_SEATED_ROTATION),
    []
  );

  useEffect(() => {
    setObjectOpacity(hddClone, 1);
  }, [hddClone]);

  return (
    <group position={HDD_SEATED_POSITION} quaternion={hddQuat} scale={1}>
      <primitive object={hddClone} />
    </group>
  );
}

function PsuTarget({ placed, inserting }) {
  const ringRef = useRef();
  const fillRef = useRef();

  useFrame(({ clock }) => {
    if (placed || inserting) return;

    const t = (Math.sin(clock.getElapsedTime() * 2.5) + 1) / 2;

    if (ringRef.current) {
      ringRef.current.scale.setScalar(1 + t * 0.12);
      ringRef.current.material.opacity = 0.5 + t * 0.35;
    }

    if (fillRef.current) {
      fillRef.current.material.opacity = 0.14 + t * 0.14;
    }
  });

  if (placed || inserting) return null;

  return (
    <group
      position={[
        PSU_TARGET_HIGHLIGHT_POSITION.x,
        PSU_TARGET_HIGHLIGHT_POSITION.y,
        PSU_TARGET_HIGHLIGHT_POSITION.z,
      ]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <mesh ref={fillRef}>
        <planeGeometry args={[4.2, 4.2]} />
        <meshBasicMaterial
          color={PSU_COLOR}
          transparent
          opacity={0.22}
          depthTest={false}
        />
      </mesh>

      <mesh ref={ringRef} position={[0, 0, 0.015]}>
        <ringGeometry args={[0.65, 1.05, 48]} />
        <meshBasicMaterial
          color={PSU_COLOR}
          transparent
          opacity={0.85}
          depthTest={false}
        />
      </mesh>

      <Html center position={[0, -0.05, 0.03]} style={{ pointerEvents: "none" }}>
        <div
          style={{
            padding: "4px 8px",
            borderRadius: 999,
            background: "rgba(10,14,22,.86)",
            border: `1px solid ${PSU_COLOR}aa`,
            color: "rgba(244,248,255,.95)",
            fontSize: 10,
            fontFamily: "monospace",
            whiteSpace: "nowrap",
            transform: "translateY(-18px)",
          }}
        >
          Target: PSU insert point
        </div>
      </Html>
    </group>
  );
}

function PSUDraggable({ placed, onInsertStart, onPlaced }) {
  const { scene } = useGLTF(PSU_URL);
  const { gl, camera } = useThree();

  const psuRef = useRef();
  const mouse = useRef(new THREE.Vector2());
  const dragOffset = useRef(new THREE.Vector3());

  const insertStartPosition = useRef(new THREE.Vector3());
  const insertStartQuaternion = useRef(new THREE.Quaternion());
  const insertProgress = useRef(0);

  const [phase, setPhase] = useState(placed ? "snapped" : "readyToDrag");

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);

  const dragPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -PSU_DRAG_Y_LOCK),
    []
  );

  const psuClone = useMemo(() => cloneScene(scene, true), [scene]);

  const startQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(PSU_START_ROTATION),
    []
  );

  const insertReadyQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(PSU_INSERT_READY_ROTATION),
    []
  );

  const seatedQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(PSU_SEATED_ROTATION),
    []
  );

  useEffect(() => {
    if (!psuRef.current) return;

    if (placed) {
      psuRef.current.position.copy(PSU_SEATED_POSITION);
      psuRef.current.quaternion.copy(seatedQuat);
      psuRef.current.scale.setScalar(1);
      setPhase("snapped");
    } else {
      psuRef.current.position.copy(PSU_START_POSITION);
      psuRef.current.quaternion.copy(startQuat);
      psuRef.current.scale.setScalar(1);
      setPhase("readyToDrag");
    }

    setObjectOpacity(psuRef.current, 1);
  }, [placed, startQuat, seatedQuat]);

  const updateMouse = useCallback(
    (e) => {
      const rect = gl.domElement.getBoundingClientRect();

      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    },
    [gl]
  );

  const isPointerOverPSU = useCallback(() => {
    if (!psuRef.current) return false;

    raycaster.setFromCamera(mouse.current, camera);
    return raycaster.intersectObject(psuRef.current, true).length > 0;
  }, [camera, raycaster]);

  const beginInsertTransition = useCallback(() => {
    if (!psuRef.current) return;

    insertStartPosition.current.copy(psuRef.current.position);
    insertStartQuaternion.current.copy(psuRef.current.quaternion);
    insertProgress.current = 0;

    setPhase("inserting");
    document.body.style.cursor = "default";
    onInsertStart?.();
  }, [onInsertStart]);

  const moveToSeatedPosition = useCallback(() => {
    if (!psuRef.current) return;

    psuRef.current.position.copy(PSU_SEATED_POSITION);
    psuRef.current.quaternion.copy(seatedQuat);
  }, [seatedQuat]);

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (
        e.button !== 0 ||
        !psuRef.current ||
        phase === "snapped" ||
        phase === "inserting"
      ) {
        return;
      }

      updateMouse(e);

      const hitPSU = isPointerOverPSU();

      if (!hitPSU && phase !== "dragging") return;

      if (phase === "readyToDrag") {
        psuRef.current.position.y = PSU_DRAG_Y_LOCK;

        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.set(
            psuRef.current.position.x - hitPoint.x,
            0,
            psuRef.current.position.z - hitPoint.z
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
          psuRef.current.position.x - PSU_INSERT_READY_POSITION.x,
          psuRef.current.position.z - PSU_INSERT_READY_POSITION.z
        ).length();

        if (dist < TRIGGER_DISTANCE * 1.35) {
          psuRef.current.position.copy(PSU_INSERT_READY_POSITION);
          psuRef.current.quaternion.copy(insertReadyQuat);
          beginInsertTransition();
        }
      }
    };

    gl.domElement.addEventListener("pointerdown", handlePointerDown);

    return () => {
      gl.domElement.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [
    beginInsertTransition,
    camera,
    dragPlane,
    gl,
    hitPoint,
    insertReadyQuat,
    isPointerOverPSU,
    phase,
    raycaster,
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
    if (!psuRef.current) return;

    if (phase === "readyToDrag") {
      psuRef.current.quaternion.slerp(startQuat, 0.12);
    }

    if (phase === "dragging") {
      raycaster.setFromCamera(mouse.current, camera);

      if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
        const targetDragPosition = new THREE.Vector3(
          hitPoint.x + dragOffset.current.x,
          PSU_DRAG_Y_LOCK,
          hitPoint.z + dragOffset.current.z
        );

        psuRef.current.position.lerp(targetDragPosition, 0.35);
      }

      psuRef.current.position.y = PSU_DRAG_Y_LOCK;
      psuRef.current.quaternion.slerp(insertReadyQuat, 0.16);

      const dist = new THREE.Vector2(
        psuRef.current.position.x - PSU_INSERT_READY_POSITION.x,
        psuRef.current.position.z - PSU_INSERT_READY_POSITION.z
      ).length();

      if (dist < TRIGGER_MAGNET_DISTANCE) {
        const magneticFactor = 1 - dist / TRIGGER_MAGNET_DISTANCE;

        const pull = THREE.MathUtils.clamp(
          TRIGGER_MAGNET_STRENGTH + magneticFactor * 0.3,
          0.14,
          0.52
        );

        const triggerTarget = new THREE.Vector3(
          PSU_INSERT_READY_POSITION.x,
          PSU_DRAG_Y_LOCK,
          PSU_INSERT_READY_POSITION.z
        );

        psuRef.current.position.lerp(triggerTarget, pull);
        psuRef.current.quaternion.slerp(insertReadyQuat, pull);

        if (dist < TRIGGER_DISTANCE) {
          psuRef.current.position.copy(PSU_INSERT_READY_POSITION);
          psuRef.current.quaternion.copy(insertReadyQuat);
          beginInsertTransition();
        }
      }
    }

    if (phase === "inserting") {
      insertProgress.current = Math.min(
        insertProgress.current + delta * PSU_INSERT_TRANSITION_SPEED,
        1
      );

      const eased = easeInOutCubic(insertProgress.current);

      const currentPosition = new THREE.Vector3();

      if (eased < 0.5) {
        const t = easeInOutCubic(eased / 0.5);
        currentPosition.lerpVectors(
          insertStartPosition.current,
          PSU_CLEARANCE_POSITION,
          t
        );
      } else {
        const t = easeInOutCubic((eased - 0.5) / 0.5);
        currentPosition.lerpVectors(
          PSU_CLEARANCE_POSITION,
          PSU_SEATED_POSITION,
          t
        );
      }

      psuRef.current.position.copy(currentPosition);

      psuRef.current.quaternion
        .copy(insertStartQuaternion.current)
        .slerp(seatedQuat, eased);

      if (insertProgress.current >= 1) {
        moveToSeatedPosition();
        setPhase("snapped");
        onPlaced?.();
      }
    }

    if (phase === "snapped") {
      psuRef.current.position.lerp(PSU_SEATED_POSITION, 0.28);
      psuRef.current.quaternion.slerp(seatedQuat, 0.28);
    }
  });

  return (
    <group>
      <group ref={psuRef}>
        <primitive object={psuClone} />
      </group>
    </group>
  );
}

export default function PSUtoCase({
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
useGLTF.preload(HDD_URL);
useGLTF.preload(PSU_URL);