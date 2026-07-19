import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
  Suspense,
} from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  useGLTF,
  ContactShadows,
  Html,
} from "@react-three/drei";
import { motion, useReducedMotion } from "framer-motion";
import { auth, db } from "../../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

/* ───────────────────────────────────────────────────────────── */
/* PRACTICAL TEST SETTINGS */
/* ───────────────────────────────────────────────────────────── */

const TEST_SETTINGS = {
  id: "full-assembly-practical",
  progressKey: "fullAssembly",
  requiredQuizKey: "module2",
  requiredQuizPercent: 60,
  passingPercent: 60,
  title: "Full Assembly Practical Test",
  desc: "Step-by-step PC assembly validation",
  durationMin: 30,
};

const WRONG_CLICK_DEDUCTION = 5;

function calculatePracticalScore(progressPercent, mistakes) {
  return Math.max(0, progressPercent - mistakes * WRONG_CLICK_DEDUCTION);
}

/* ───────────────────────────────────────────────────────────── */
/* MODEL URLS */
/* Uses the same paths from your Module 2 FullAssembly scene */
/* ───────────────────────────────────────────────────────────── */

const CASE_URL = "/models/PC%20CASE(BLENDER).glb";
const MB_URL = "/models/MB(BLENDER).glb";
const CPU_URL = "/models/CPU(BLENDER).glb";
const RAM_URL = "/models/RAM(BLENDER).glb";
const SSD_URL = "/models/SSD(BLENDER).glb";
const HDD_URL = "/models/HDD(BLENDER).glb";
const PSU_URL = "/models/PSU(BLENDER).glb";

/* ───────────────────────────────────────────────────────────── */
/* MODULE 2 FULL ASSEMBLY COORDINATES */
/* Based on your uploaded FullAssembly scene */
/* ───────────────────────────────────────────────────────────── */

const CAMERA_POSITION = [45, 18, 18];
const CONTROL_TARGET = [24, -14, 7];

const BOARD_Y = -14.95;
const BOARD_CENTER_X = 24;
const BOARD_CENTER_Z = 6.5;
const BOARD_SIZE = 26;
const GRID_DIVISIONS = 13;

const MB_COLOR = "#4aa3ff";
const CPU_COLOR = "#b56dff";
const RAM_COLOR = "#00ffb4";
const SSD_COLOR = "#ffcc00";
const HDD_COLOR = "#ff8a3d";
const PSU_COLOR = "#ff4d6d";

const SNAP_DISTANCE = 0.75;
const MAGNET_DISTANCE = 3.2;
const MAGNET_STRENGTH = 0.22;

const CASE_POSITION = new THREE.Vector3(27.88, -12.79, 35.74);
const CASE_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const CASE_SCALE = 1;

const MB_POSITION = new THREE.Vector3(33.54, -14.87, 11.32);
const MB_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const MB_SCALE = 1;

const CPU_START_POSITION = new THREE.Vector3(17.49, -15.8, 0.3);
const CPU_DRAG_Y_LOCK = -15.49;
const CPU_SEATED_POSITION = new THREE.Vector3(27.91, -15.49, 6.98);
const CPU_HIGHLIGHT_POSITION = new THREE.Vector3(27.91, -15.44, 6.98);
const CPU_START_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const CPU_TARGET_ROTATION = new THREE.Euler(0, Math.PI, 0);

const RAM_START_POSITION = new THREE.Vector3(13.73, -24.61, 9.06);
const RAM_DRAG_Y_LOCK = -20.74;
const RAM_SEATED_POSITION = new THREE.Vector3(34.35, -20.74, 11.32);
const RAM_HIGHLIGHT_POSITION = new THREE.Vector3(34.35, -20.69, 11.32);
const RAM_START_ROTATION = new THREE.Euler(Math.PI / 2, 0, 0);
const RAM_TARGET_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);

const SSD_START_POSITION = new THREE.Vector3(12.94, -17.21, 7.36);
const SSD_DRAG_Y_LOCK = -17.03;
const SSD_SEATED_POSITION = new THREE.Vector3(24.39, -17.03, 11.26);
const SSD_HIGHLIGHT_POSITION = new THREE.Vector3(24.39, -16.98, 11.26);
const SSD_START_ROTATION = new THREE.Euler(0, 0, 0);
const SSD_TARGET_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);

const MB_ASSEMBLY_START_OFFSET = new THREE.Vector3(0, 0, 0);
const MB_ASSEMBLY_FRONT_OF_CASE_OFFSET = new THREE.Vector3(-4.5, -9.3, 11.5);
const MB_ASSEMBLY_FLOAT_HEIGHT_Y = 0.4;
const MB_DRAG_Y_LOCK = -9.13;
const MB_ASSEMBLY_CASE_TARGET_OFFSET = new THREE.Vector3(-2.49, -9.13, 21.59);
const MB_ASSEMBLY_START_ROTATION = new THREE.Euler(0, 0, 0);
const MB_ASSEMBLY_FRONT_ROTATION = new THREE.Euler(-Math.PI / 2, 0, 0);
const MB_ASSEMBLY_CASE_ROTATION = new THREE.Euler(-Math.PI / 2, 0, 0);
const MB_CASE_HIGHLIGHT_POSITION = new THREE.Vector3(-2.49, -9.08, 21.59);
const MB_FLOAT_TRANSITION_SPEED = 0.22;
const MB_CASE_SNAP_DISTANCE = 1.1;
const MB_CASE_MAGNET_DISTANCE = 7.0;
const MB_CASE_MAGNET_STRENGTH = 0.32;

const HDD_START_POSITION = new THREE.Vector3(15.5, -16.06, 10.96);
const HDD_DRAG_Y_LOCK = -12.18;
const HDD_INSERT_READY_POSITION = new THREE.Vector3(19.92, -12.18, 31.67);
const HDD_SEATED_POSITION = new THREE.Vector3(27.47, -12.18, 31.67);
const HDD_CLEARANCE_POSITION = new THREE.Vector3(25.8, -12.18, 31.67);
const HDD_TARGET_HIGHLIGHT_POSITION = new THREE.Vector3(19.92, -12.08, 31.36);
const HDD_START_ROTATION = new THREE.Euler(0, 0, 0);
const HDD_INSERT_READY_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const HDD_SEATED_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const HDD_INSERT_TRANSITION_SPEED = 0.24;

const PSU_START_POSITION = new THREE.Vector3(19.38, -15.81, 11.75);
const PSU_DRAG_Y_LOCK = -13.46;
const PSU_INSERT_READY_POSITION = new THREE.Vector3(14.16, -13.46, 38.36);
const PSU_SEATED_POSITION = new THREE.Vector3(20.83, -13.46, 38.36);
const PSU_CLEARANCE_POSITION = new THREE.Vector3(18.8, -13.46, 38.36);
const PSU_TARGET_HIGHLIGHT_POSITION = new THREE.Vector3(14.16, -13.36, 38.36);
const PSU_START_ROTATION = new THREE.Euler(0, Math.PI, 0);
const PSU_INSERT_READY_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const PSU_SEATED_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const PSU_INSERT_TRANSITION_SPEED = 0.24;

const INSERT_TRIGGER_DISTANCE = 1.15;
const INSERT_TRIGGER_MAGNET_DISTANCE = 5.2;
const INSERT_TRIGGER_MAGNET_STRENGTH = 0.28;

const STEPS = [
  { id: "cpu", label: "CPU to motherboard", color: CPU_COLOR, partName: "CPU" },
  { id: "ram", label: "RAM to motherboard", color: RAM_COLOR, partName: "RAM" },
  { id: "ssd", label: "SSD to motherboard", color: SSD_COLOR, partName: "SSD" },
  { id: "mb", label: "Motherboard to case", color: MB_COLOR, partName: "Motherboard" },
  { id: "hdd", label: "HDD to case", color: HDD_COLOR, partName: "HDD" },
  { id: "psu", label: "PSU to case", color: PSU_COLOR, partName: "PSU" },
];

/* ───────────────────────────────────────────────────────────── */
/* SCENE HELPERS */
/* ───────────────────────────────────────────────────────────── */

function cloneScene(scene, transparent = false) {
  const clone = scene.clone(true);

  clone.traverse((object) => {
    if (!object.isMesh) return;

    object.castShadow = true;
    object.receiveShadow = true;

    if (transparent && object.material) {
      if (Array.isArray(object.material)) {
        object.material = object.material.map((material) => material.clone());
      } else {
        object.material = object.material.clone();
      }
    }
  });

  return clone;
}

function setObjectOpacity(root, opacity) {
  root.traverse((object) => {
    if (!object.isMesh || !object.material) return;

    const materials = Array.isArray(object.material) ? object.material : [object.material];

    materials.forEach((material) => {
      material.transparent = opacity < 1;
      material.opacity = opacity;
      material.depthWrite = opacity >= 0.98;
      material.needsUpdate = true;
    });
  });
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function getStepIndex(id) {
  return STEPS.findIndex((step) => step.id === id);
}

function isStepUnlocked(stepId, placed) {
  const index = getStepIndex(stepId);

  if (index === 0) return true;

  for (let i = 0; i < index; i += 1) {
    if (!placed[STEPS[i].id]) return false;
  }

  return true;
}

function getCurrentStep(placed) {
  return STEPS.find((step) => !placed[step.id])?.id || "complete";
}

function getStepLabel(id) {
  if (id === "complete") return "Full Assembly Complete";
  return STEPS.find((step) => step.id === id)?.label || "Unknown step";
}

function getPartName(id) {
  return STEPS.find((step) => step.id === id)?.partName || "part";
}

/* ───────────────────────────────────────────────────────────── */
/* FULL ASSEMBLY SCENE WITH PRACTICAL VALIDATION */
/* ───────────────────────────────────────────────────────────── */

function Scene({ started, placed, currentStep, onPlaced, onWrongAttempt, onStartRequired, onComplete }) {
  const { camera } = useThree();
  const completedRef = useRef(false);
  const complete = currentStep === "complete";

  useEffect(() => {
    if (!complete) {
      completedRef.current = false;
      return;
    }

    if (completedRef.current) return;

    completedRef.current = true;
    onComplete?.();
  }, [complete, onComplete]);

  useEffect(() => {
    camera.position.set(...CAMERA_POSITION);
    camera.lookAt(...CONTROL_TARGET);
  }, [camera]);

  const markPlaced = useCallback(
    (id) => {
      onPlaced?.(id);
    },
    [onPlaced]
  );

  const guardPartClick = useCallback(
    (id) => {
      if (!started) {
        onStartRequired?.();
        return false;
      }

      if (currentStep === "complete") return false;

      if (id !== currentStep) {
        onWrongAttempt?.(id, currentStep);
        return false;
      }

      return true;
    },
    [currentStep, onStartRequired, onWrongAttempt, started]
  );

  const cpuActive = currentStep === "cpu";
  const ramActive = currentStep === "ram";
  const ssdActive = currentStep === "ssd";
  const mbActive = currentStep === "mb";
  const hddActive = currentStep === "hdd";
  const psuActive = currentStep === "psu";

  const showWorkbenchMotherboard = !placed.mb && !mbActive;
  const showMotherboardAssemblyDraggable = mbActive;
  const showInstalledMotherboardAssembly = placed.mb && !mbActive;

  return (
    <>
      <color attach="background" args={["#05080D"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 10, 6]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-3, 2, -2]} intensity={0.7} />
      <Environment preset="city" />

      <WorkBoard />
      <ComputerCase />

      {showWorkbenchMotherboard && <StaticMotherboard />}

      {!placed.mb && !mbActive && (
        <>
          <FlatTarget placed={!cpuActive || placed.cpu} position={CPU_HIGHLIGHT_POSITION} color={CPU_COLOR} label="Target: CPU socket" size={[1.75, 1.75]} />
          <FlatTarget placed={!ramActive || placed.ram} position={RAM_HIGHLIGHT_POSITION} color={RAM_COLOR} label="Target: RAM slot" size={[0.65, 3.25]} />
          <FlatTarget placed={!ssdActive || placed.ssd} position={SSD_HIGHLIGHT_POSITION} color={SSD_COLOR} label="Target: SSD slot" size={[1.6, 2.35]} />

          <PlaneSnapDraggable
            id="cpu"
            label="CPU"
            url={CPU_URL}
            color={CPU_COLOR}
            active={cpuActive}
            unlocked={isStepUnlocked("cpu", placed)}
            placed={placed.cpu}
            startPosition={CPU_START_POSITION}
            startRotation={CPU_START_ROTATION}
            targetPosition={CPU_SEATED_POSITION}
            targetRotation={CPU_TARGET_ROTATION}
            yLock={CPU_DRAG_Y_LOCK}
            guardPartClick={guardPartClick}
            onPlaced={() => markPlaced("cpu")}
          />

          <PlaneSnapDraggable
            id="ram"
            label="RAM"
            url={RAM_URL}
            color={RAM_COLOR}
            active={ramActive}
            unlocked={isStepUnlocked("ram", placed)}
            placed={placed.ram}
            startPosition={RAM_START_POSITION}
            startRotation={RAM_START_ROTATION}
            targetPosition={RAM_SEATED_POSITION}
            targetRotation={RAM_TARGET_ROTATION}
            yLock={RAM_DRAG_Y_LOCK}
            guardPartClick={guardPartClick}
            onPlaced={() => markPlaced("ram")}
          />

          <PlaneSnapDraggable
            id="ssd"
            label="SSD"
            url={SSD_URL}
            color={SSD_COLOR}
            active={ssdActive}
            unlocked={isStepUnlocked("ssd", placed)}
            placed={placed.ssd}
            startPosition={SSD_START_POSITION}
            startRotation={SSD_START_ROTATION}
            targetPosition={SSD_SEATED_POSITION}
            targetRotation={SSD_TARGET_ROTATION}
            yLock={SSD_DRAG_Y_LOCK}
            guardPartClick={guardPartClick}
            onPlaced={() => markPlaced("ssd")}
          />
        </>
      )}

      {showMotherboardAssemblyDraggable && (
        <>
          <FlatTarget placed={placed.mb} position={MB_CASE_HIGHLIGHT_POSITION} color={MB_COLOR} label="Target: motherboard standoffs" size={[5.4, 7.4]} />
          <MotherboardAssemblyToCase active={mbActive} unlocked={isStepUnlocked("mb", placed)} placed={placed.mb} guardPartClick={guardPartClick} onPlaced={() => markPlaced("mb")} />
        </>
      )}

      {showInstalledMotherboardAssembly && <StaticInstalledMotherboardAssembly />}

      <InsertTransitionDraggable
        id="hdd"
        label="HDD"
        url={HDD_URL}
        color={HDD_COLOR}
        active={hddActive}
        unlocked={isStepUnlocked("hdd", placed)}
        placed={placed.hdd}
        startPosition={HDD_START_POSITION}
        startRotation={HDD_START_ROTATION}
        yLock={HDD_DRAG_Y_LOCK}
        insertReadyPosition={HDD_INSERT_READY_POSITION}
        insertReadyRotation={HDD_INSERT_READY_ROTATION}
        seatedPosition={HDD_SEATED_POSITION}
        seatedRotation={HDD_SEATED_ROTATION}
        clearancePosition={HDD_CLEARANCE_POSITION}
        highlightPosition={HDD_TARGET_HIGHLIGHT_POSITION}
        transitionSpeed={HDD_INSERT_TRANSITION_SPEED}
        highlightSize={[3.2, 4.2]}
        targetLabel="Target: HDD insert point"
        guardPartClick={guardPartClick}
        onPlaced={() => markPlaced("hdd")}
      />

      <InsertTransitionDraggable
        id="psu"
        label="PSU"
        url={PSU_URL}
        color={PSU_COLOR}
        active={psuActive}
        unlocked={isStepUnlocked("psu", placed)}
        placed={placed.psu}
        startPosition={PSU_START_POSITION}
        startRotation={PSU_START_ROTATION}
        yLock={PSU_DRAG_Y_LOCK}
        insertReadyPosition={PSU_INSERT_READY_POSITION}
        insertReadyRotation={PSU_INSERT_READY_ROTATION}
        seatedPosition={PSU_SEATED_POSITION}
        seatedRotation={PSU_SEATED_ROTATION}
        clearancePosition={PSU_CLEARANCE_POSITION}
        highlightPosition={PSU_TARGET_HIGHLIGHT_POSITION}
        transitionSpeed={PSU_INSERT_TRANSITION_SPEED}
        highlightSize={[4.2, 4.2]}
        targetLabel="Target: PSU insert point"
        guardPartClick={guardPartClick}
        onPlaced={() => markPlaced("psu")}
      />

      <ContactShadows position={[BOARD_CENTER_X, BOARD_Y + 0.1, BOARD_CENTER_Z]} opacity={0.38} scale={46} blur={2.8} far={35} />

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
      <mesh position={[BOARD_CENTER_X, BOARD_Y, BOARD_CENTER_Z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshStandardMaterial color="#f6f7fb" roughness={0.58} metalness={0.02} />
      </mesh>

      <gridHelper args={[BOARD_SIZE, GRID_DIVISIONS, "#050505", "#050505"]} position={[BOARD_CENTER_X, BOARD_Y + 0.02, BOARD_CENTER_Z]} />
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
    <group position={CASE_POSITION} rotation={CASE_ROTATION.toArray()} scale={CASE_SCALE}>
      <primitive object={caseClone} />
    </group>
  );
}

function StaticMotherboard() {
  const { scene } = useGLTF(MB_URL);
  const clone = useMemo(() => cloneScene(scene, true), [scene]);

  useEffect(() => {
    setObjectOpacity(clone, 1);
  }, [clone]);

  return (
    <group position={MB_POSITION} rotation={MB_ROTATION.toArray()} scale={MB_SCALE}>
      <primitive object={clone} />
    </group>
  );
}

function StaticCPU() {
  const { scene } = useGLTF(CPU_URL);
  const clone = useMemo(() => cloneScene(scene, true), [scene]);
  const quat = useMemo(() => new THREE.Quaternion().setFromEuler(CPU_TARGET_ROTATION), []);

  useEffect(() => {
    setObjectOpacity(clone, 1);
  }, [clone]);

  return (
    <group position={CPU_SEATED_POSITION} quaternion={quat} scale={1}>
      <primitive object={clone} />
    </group>
  );
}

function StaticRAM() {
  const { scene } = useGLTF(RAM_URL);
  const clone = useMemo(() => cloneScene(scene, true), [scene]);
  const quat = useMemo(() => new THREE.Quaternion().setFromEuler(RAM_TARGET_ROTATION), []);

  useEffect(() => {
    setObjectOpacity(clone, 1);
  }, [clone]);

  return (
    <group position={RAM_SEATED_POSITION} quaternion={quat} scale={1}>
      <primitive object={clone} />
    </group>
  );
}

function StaticSSD() {
  const { scene } = useGLTF(SSD_URL);
  const clone = useMemo(() => cloneScene(scene, true), [scene]);
  const quat = useMemo(() => new THREE.Quaternion().setFromEuler(SSD_TARGET_ROTATION), []);

  useEffect(() => {
    setObjectOpacity(clone, 1);
  }, [clone]);

  return (
    <group position={SSD_SEATED_POSITION} quaternion={quat} scale={1}>
      <primitive object={clone} />
    </group>
  );
}

function StaticInstalledMotherboardAssembly() {
  const assemblyQuat = useMemo(() => new THREE.Quaternion().setFromEuler(MB_ASSEMBLY_CASE_ROTATION), []);

  return (
    <group position={MB_ASSEMBLY_CASE_TARGET_OFFSET} quaternion={assemblyQuat}>
      <StaticMotherboard />
      <StaticCPU />
      <StaticRAM />
      <StaticSSD />
    </group>
  );
}

function FlatTarget({ placed, position, color, label, size = [1, 1] }) {
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

  if (placed) return null;

  return (
    <group position={[position.x, position.y, position.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={fillRef}>
        <planeGeometry args={size} />
        <meshBasicMaterial color={color} transparent opacity={0.22} depthTest={false} />
      </mesh>

      <mesh ref={ringRef} position={[0, 0, 0.015]}>
        <ringGeometry args={[0.45, 0.82, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} depthTest={false} />
      </mesh>

      <Html center position={[0, -0.05, 0.03]} style={{ pointerEvents: "none" }}>
        <div
          style={{
            padding: "4px 8px",
            borderRadius: 999,
            background: "rgba(10,14,22,.86)",
            border: `1px solid ${color}aa`,
            color: "rgba(244,248,255,.95)",
            fontSize: 10,
            fontFamily: "monospace",
            whiteSpace: "nowrap",
            transform: "translateY(-18px)",
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

function PlaneSnapDraggable({
  id,
  label,
  url,
  color,
  active,
  unlocked,
  placed,
  startPosition,
  startRotation,
  targetPosition,
  targetRotation,
  yLock,
  guardPartClick,
  onPlaced,
}) {
  const { scene } = useGLTF(url);
  const { gl, camera } = useThree();

  const partRef = useRef();
  const mouse = useRef(new THREE.Vector2());
  const dragOffset = useRef(new THREE.Vector3());

  const [dragging, setDragging] = useState(false);
  const [snapped, setSnapped] = useState(placed);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);

  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -yLock), [yLock]);
  const clone = useMemo(() => cloneScene(scene, true), [scene]);
  const startQuat = useMemo(() => new THREE.Quaternion().setFromEuler(startRotation), [startRotation]);
  const targetQuat = useMemo(() => new THREE.Quaternion().setFromEuler(targetRotation), [targetRotation]);

  useEffect(() => {
    if (!partRef.current) return;

    if (placed) {
      partRef.current.position.copy(targetPosition);
      partRef.current.quaternion.copy(targetQuat);
      setSnapped(true);
      setDragging(false);
    } else {
      partRef.current.position.copy(startPosition);
      partRef.current.quaternion.copy(startQuat);
      setSnapped(false);
      setDragging(false);
    }

    partRef.current.scale.setScalar(1);
    setObjectOpacity(partRef.current, 1);
  }, [placed, startPosition, targetPosition, startQuat, targetQuat]);

  const updateMouse = useCallback(
    (event) => {
      const rect = gl.domElement.getBoundingClientRect();

      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    },
    [gl]
  );

  const isPointerOverPart = useCallback(() => {
    if (!partRef.current) return false;

    raycaster.setFromCamera(mouse.current, camera);
    return raycaster.intersectObject(partRef.current, true).length > 0;
  }, [camera, raycaster]);

  const moveToTarget = useCallback(() => {
    if (!partRef.current) return;

    partRef.current.position.copy(targetPosition);
    partRef.current.quaternion.copy(targetQuat);
  }, [targetPosition, targetQuat]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (event.button !== 0 || !partRef.current || snapped) return;

      updateMouse(event);

      const hitPart = isPointerOverPart();
      if (!hitPart && !dragging) return;

      if (!guardPartClick?.(id)) return;
      if (!active || !unlocked) return;

      if (!dragging) {
        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.set(partRef.current.position.x - hitPoint.x, 0, partRef.current.position.z - hitPoint.z);
        }

        setDragging(true);
        document.body.style.cursor = "grabbing";
      } else {
        setDragging(false);
        document.body.style.cursor = "default";

        const dist = new THREE.Vector2(partRef.current.position.x - targetPosition.x, partRef.current.position.z - targetPosition.z).length();

        if (dist < SNAP_DISTANCE * 1.25) {
          moveToTarget();
          setSnapped(true);
          onPlaced?.();
        }
      }
    };

    gl.domElement.addEventListener("pointerdown", handlePointerDown);

    return () => {
      gl.domElement.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [active, camera, dragPlane, dragging, gl, guardPartClick, hitPoint, id, isPointerOverPart, moveToTarget, onPlaced, raycaster, snapped, targetPosition, unlocked, updateMouse]);

  useEffect(() => {
    const handlePointerMove = (event) => updateMouse(event);
    const preventContext = (event) => event.preventDefault();

    gl.domElement.addEventListener("pointermove", handlePointerMove);
    gl.domElement.addEventListener("contextmenu", preventContext);

    return () => {
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
      gl.domElement.removeEventListener("contextmenu", preventContext);
      document.body.style.cursor = "default";
    };
  }, [gl, updateMouse]);

  useFrame(() => {
    if (!partRef.current) return;

    if (snapped) {
      partRef.current.position.lerp(targetPosition, 0.28);
      partRef.current.quaternion.slerp(targetQuat, 0.28);
    } else {
      partRef.current.quaternion.slerp(active ? targetQuat : startQuat, 0.08);

      if (dragging && active && unlocked) {
        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          const targetDragPosition = new THREE.Vector3(hitPoint.x + dragOffset.current.x, yLock, hitPoint.z + dragOffset.current.z);
          partRef.current.position.lerp(targetDragPosition, 0.35);
        }
      }

      if (dragging && active && unlocked) {
        partRef.current.position.y = yLock;

        const dist = new THREE.Vector2(partRef.current.position.x - targetPosition.x, partRef.current.position.z - targetPosition.z).length();

        if (dist < MAGNET_DISTANCE) {
          const pull = MAGNET_STRENGTH + (1 - dist / MAGNET_DISTANCE) * 0.22;
          const snapTarget = new THREE.Vector3(targetPosition.x, yLock, targetPosition.z);

          partRef.current.position.lerp(snapTarget, pull);
          partRef.current.quaternion.slerp(targetQuat, pull);

          if (dist < SNAP_DISTANCE) {
            moveToTarget();
            setSnapped(true);
            setDragging(false);
            document.body.style.cursor = "default";
            onPlaced?.();
          }
        }
      }
    }
  });

  return (
    <group>
      <group ref={partRef}>
        <primitive object={clone} />
      </group>
    </group>
  );
}

function MotherboardAssemblyToCase({ active, unlocked, placed, guardPartClick, onPlaced }) {
  const { gl, camera } = useThree();

  const assemblyRef = useRef();
  const mouse = useRef(new THREE.Vector2());
  const dragOffset = useRef(new THREE.Vector3());

  const transitionStartPosition = useRef(new THREE.Vector3());
  const transitionStartQuaternion = useRef(new THREE.Quaternion());
  const transitionProgress = useRef(0);

  const [phase, setPhase] = useState(placed ? "snapped" : "idle");
  const [snapped, setSnapped] = useState(placed);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -MB_DRAG_Y_LOCK), []);
  const startQuat = useMemo(() => new THREE.Quaternion().setFromEuler(MB_ASSEMBLY_START_ROTATION), []);
  const frontQuat = useMemo(() => new THREE.Quaternion().setFromEuler(MB_ASSEMBLY_FRONT_ROTATION), []);
  const caseQuat = useMemo(() => new THREE.Quaternion().setFromEuler(MB_ASSEMBLY_CASE_ROTATION), []);

  const updateMouse = useCallback(
    (event) => {
      const rect = gl.domElement.getBoundingClientRect();

      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
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
      assemblyRef.current.position.copy(MB_ASSEMBLY_START_OFFSET);
      assemblyRef.current.quaternion.copy(startQuat);
      setSnapped(false);
      setPhase("idle");
    }
  }, [placed, startQuat, moveToCaseTarget]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (event.button !== 0 || !assemblyRef.current || snapped) return;

      updateMouse(event);

      const hitAssembly = isPointerOverAssembly();
      if (!hitAssembly && phase !== "dragging") return;

      if (!guardPartClick?.("mb")) return;
      if (!active || !unlocked) return;

      if (phase === "idle") {
        beginFrontTransition();
        return;
      }

      if (phase === "floatingToCaseFront") return;

      if (phase === "readyToDrag") {
        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.set(assemblyRef.current.position.x - hitPoint.x, 0, assemblyRef.current.position.z - hitPoint.z);
        }

        setPhase("dragging");
        document.body.style.cursor = "grabbing";
        return;
      }

      if (phase === "dragging") {
        setPhase("readyToDrag");
        document.body.style.cursor = "default";

        const dist = new THREE.Vector2(assemblyRef.current.position.x - MB_ASSEMBLY_CASE_TARGET_OFFSET.x, assemblyRef.current.position.z - MB_ASSEMBLY_CASE_TARGET_OFFSET.z).length();

        if (dist < MB_CASE_SNAP_DISTANCE * 1.35) {
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
  }, [active, beginFrontTransition, camera, dragPlane, gl, guardPartClick, hitPoint, isPointerOverAssembly, moveToCaseTarget, onPlaced, phase, raycaster, snapped, unlocked, updateMouse]);

  useEffect(() => {
    const handlePointerMove = (event) => updateMouse(event);
    const preventContext = (event) => event.preventDefault();

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
      transitionProgress.current = Math.min(transitionProgress.current + delta * MB_FLOAT_TRANSITION_SPEED, 1);
      const rawT = transitionProgress.current;
      const eased = easeInOutCubic(rawT);
      const start = transitionStartPosition.current;
      const liftPoint = new THREE.Vector3(start.x, MB_ASSEMBLY_FLOAT_HEIGHT_Y, start.z);
      const currentPosition = new THREE.Vector3();

      if (rawT < 0.35) {
        const t = easeOutCubic(rawT / 0.35);
        currentPosition.lerpVectors(start, liftPoint, t);
      } else {
        const t = easeInOutCubic((rawT - 0.35) / 0.65);
        currentPosition.lerpVectors(liftPoint, MB_ASSEMBLY_FRONT_OF_CASE_OFFSET, t);
      }

      assemblyRef.current.position.copy(currentPosition);
      assemblyRef.current.quaternion.copy(transitionStartQuaternion.current).slerp(frontQuat, eased);

      if (transitionProgress.current >= 1) {
        assemblyRef.current.position.copy(MB_ASSEMBLY_FRONT_OF_CASE_OFFSET);
        assemblyRef.current.quaternion.copy(frontQuat);
        setPhase("readyToDrag");
      }
    }

    if (phase === "readyToDrag") {
      assemblyRef.current.quaternion.slerp(frontQuat, 0.12);
    }

    if (phase === "dragging") {
      raycaster.setFromCamera(mouse.current, camera);

      if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
        const targetDragPosition = new THREE.Vector3(hitPoint.x + dragOffset.current.x, MB_DRAG_Y_LOCK, hitPoint.z + dragOffset.current.z);
        assemblyRef.current.position.lerp(targetDragPosition, 0.35);
      }

      assemblyRef.current.position.y = MB_DRAG_Y_LOCK;
      assemblyRef.current.quaternion.slerp(caseQuat, 0.18);

      const dist = new THREE.Vector2(assemblyRef.current.position.x - MB_ASSEMBLY_CASE_TARGET_OFFSET.x, assemblyRef.current.position.z - MB_ASSEMBLY_CASE_TARGET_OFFSET.z).length();

      if (dist < MB_CASE_MAGNET_DISTANCE) {
        const magneticFactor = 1 - dist / MB_CASE_MAGNET_DISTANCE;
        const pull = THREE.MathUtils.clamp(MB_CASE_MAGNET_STRENGTH + magneticFactor * 0.35, 0.18, 0.62);
        const snapTarget = new THREE.Vector3(MB_ASSEMBLY_CASE_TARGET_OFFSET.x, MB_DRAG_Y_LOCK, MB_ASSEMBLY_CASE_TARGET_OFFSET.z);

        assemblyRef.current.position.lerp(snapTarget, pull);
        assemblyRef.current.quaternion.slerp(caseQuat, pull);

        if (dist < MB_CASE_SNAP_DISTANCE) {
          moveToCaseTarget();
          setSnapped(true);
          setPhase("snapped");
          document.body.style.cursor = "default";
          onPlaced?.();
        }
      }
    }

    if (phase === "snapped") {
      assemblyRef.current.position.lerp(MB_ASSEMBLY_CASE_TARGET_OFFSET, 0.28);
      assemblyRef.current.quaternion.slerp(caseQuat, 0.28);
    }
  });

  const statusText =
    phase === "idle"
      ? "Click motherboard assembly to start transition"
      : phase === "floatingToCaseFront"
      ? "Floating motherboard assembly to case..."
      : phase === "readyToDrag"
      ? "Click motherboard assembly again to grab"
      : phase === "dragging"
      ? "Drag motherboard assembly into case"
      : "Motherboard assembly installed";

  return (
    <group>
      <group ref={assemblyRef} position={MB_ASSEMBLY_START_OFFSET}>
        <StaticMotherboard />
        <StaticCPU />
        <StaticRAM />
        <StaticSSD />
      </group>
    </group>
  );
}

function InsertTransitionDraggable({
  id,
  label,
  url,
  color,
  active,
  unlocked,
  placed,
  startPosition,
  startRotation,
  yLock,
  insertReadyPosition,
  insertReadyRotation,
  seatedPosition,
  seatedRotation,
  clearancePosition,
  highlightPosition,
  transitionSpeed,
  highlightSize,
  targetLabel,
  guardPartClick,
  onPlaced,
}) {
  const { scene } = useGLTF(url);
  const { gl, camera } = useThree();

  const partRef = useRef();
  const mouse = useRef(new THREE.Vector2());
  const dragOffset = useRef(new THREE.Vector3());

  const insertStartPosition = useRef(new THREE.Vector3());
  const insertStartQuaternion = useRef(new THREE.Quaternion());
  const insertProgress = useRef(0);

  const [phase, setPhase] = useState(placed ? "snapped" : "readyToDrag");

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -yLock), [yLock]);
  const clone = useMemo(() => cloneScene(scene, true), [scene]);
  const startQuat = useMemo(() => new THREE.Quaternion().setFromEuler(startRotation), [startRotation]);
  const insertReadyQuat = useMemo(() => new THREE.Quaternion().setFromEuler(insertReadyRotation), [insertReadyRotation]);
  const seatedQuat = useMemo(() => new THREE.Quaternion().setFromEuler(seatedRotation), [seatedRotation]);

  useEffect(() => {
    if (!partRef.current) return;

    if (placed) {
      partRef.current.position.copy(seatedPosition);
      partRef.current.quaternion.copy(seatedQuat);
      setPhase("snapped");
    } else {
      partRef.current.position.copy(startPosition);
      partRef.current.quaternion.copy(startQuat);
      setPhase("readyToDrag");
    }

    partRef.current.scale.setScalar(1);
    setObjectOpacity(partRef.current, 1);
  }, [placed, seatedPosition, startPosition, seatedQuat, startQuat]);

  const updateMouse = useCallback(
    (event) => {
      const rect = gl.domElement.getBoundingClientRect();

      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    },
    [gl]
  );

  const isPointerOverPart = useCallback(() => {
    if (!partRef.current) return false;

    raycaster.setFromCamera(mouse.current, camera);
    return raycaster.intersectObject(partRef.current, true).length > 0;
  }, [camera, raycaster]);

  const beginInsertTransition = useCallback(() => {
    if (!partRef.current) return;

    insertStartPosition.current.copy(partRef.current.position);
    insertStartQuaternion.current.copy(partRef.current.quaternion);
    insertProgress.current = 0;
    setPhase("inserting");
    document.body.style.cursor = "default";
  }, []);

  const moveToSeatedPosition = useCallback(() => {
    if (!partRef.current) return;

    partRef.current.position.copy(seatedPosition);
    partRef.current.quaternion.copy(seatedQuat);
  }, [seatedPosition, seatedQuat]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (event.button !== 0 || !partRef.current || phase === "snapped" || phase === "inserting") return;

      updateMouse(event);

      const hitPart = isPointerOverPart();
      if (!hitPart && phase !== "dragging") return;

      if (!guardPartClick?.(id)) return;
      if (!active || !unlocked) return;

      if (phase === "readyToDrag") {
        partRef.current.position.y = yLock;
        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.set(partRef.current.position.x - hitPoint.x, 0, partRef.current.position.z - hitPoint.z);
        }

        setPhase("dragging");
        document.body.style.cursor = "grabbing";
        return;
      }

      if (phase === "dragging") {
        setPhase("readyToDrag");
        document.body.style.cursor = "default";

        const dist = new THREE.Vector2(partRef.current.position.x - insertReadyPosition.x, partRef.current.position.z - insertReadyPosition.z).length();

        if (dist < INSERT_TRIGGER_DISTANCE * 1.35) {
          partRef.current.position.copy(insertReadyPosition);
          partRef.current.quaternion.copy(insertReadyQuat);
          beginInsertTransition();
        }
      }
    };

    gl.domElement.addEventListener("pointerdown", handlePointerDown);

    return () => {
      gl.domElement.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [active, beginInsertTransition, camera, dragPlane, gl, guardPartClick, hitPoint, id, insertReadyPosition, insertReadyQuat, isPointerOverPart, phase, raycaster, unlocked, updateMouse, yLock]);

  useEffect(() => {
    const handlePointerMove = (event) => updateMouse(event);
    const preventContext = (event) => event.preventDefault();

    gl.domElement.addEventListener("pointermove", handlePointerMove);
    gl.domElement.addEventListener("contextmenu", preventContext);

    return () => {
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
      gl.domElement.removeEventListener("contextmenu", preventContext);
      document.body.style.cursor = "default";
    };
  }, [gl, updateMouse]);

  useFrame((_, delta) => {
    if (!partRef.current) return;

    if (phase === "readyToDrag") {
      partRef.current.quaternion.slerp(active ? insertReadyQuat : startQuat, 0.12);
    }

    if (phase === "dragging" && active && unlocked) {
      raycaster.setFromCamera(mouse.current, camera);

      if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
        const targetDragPosition = new THREE.Vector3(hitPoint.x + dragOffset.current.x, yLock, hitPoint.z + dragOffset.current.z);
        partRef.current.position.lerp(targetDragPosition, 0.35);
      }

      partRef.current.position.y = yLock;
      partRef.current.quaternion.slerp(insertReadyQuat, 0.16);

      const dist = new THREE.Vector2(partRef.current.position.x - insertReadyPosition.x, partRef.current.position.z - insertReadyPosition.z).length();

      if (dist < INSERT_TRIGGER_MAGNET_DISTANCE) {
        const magneticFactor = 1 - dist / INSERT_TRIGGER_MAGNET_DISTANCE;
        const pull = THREE.MathUtils.clamp(INSERT_TRIGGER_MAGNET_STRENGTH + magneticFactor * 0.3, 0.14, 0.52);
        const triggerTarget = new THREE.Vector3(insertReadyPosition.x, yLock, insertReadyPosition.z);

        partRef.current.position.lerp(triggerTarget, pull);
        partRef.current.quaternion.slerp(insertReadyQuat, pull);

        if (dist < INSERT_TRIGGER_DISTANCE) {
          partRef.current.position.copy(insertReadyPosition);
          partRef.current.quaternion.copy(insertReadyQuat);
          beginInsertTransition();
        }
      }
    }

    if (phase === "inserting") {
      insertProgress.current = Math.min(insertProgress.current + delta * transitionSpeed, 1);
      const eased = easeInOutCubic(insertProgress.current);
      const currentPosition = new THREE.Vector3();

      if (eased < 0.5) {
        const t = easeInOutCubic(eased / 0.5);
        currentPosition.lerpVectors(insertStartPosition.current, clearancePosition, t);
      } else {
        const t = easeInOutCubic((eased - 0.5) / 0.5);
        currentPosition.lerpVectors(clearancePosition, seatedPosition, t);
      }

      partRef.current.position.copy(currentPosition);
      partRef.current.quaternion.copy(insertStartQuaternion.current).slerp(seatedQuat, eased);

      if (insertProgress.current >= 1) {
        moveToSeatedPosition();
        setPhase("snapped");
        onPlaced?.();
      }
    }

    if (phase === "snapped") {
      partRef.current.position.lerp(seatedPosition, 0.28);
      partRef.current.quaternion.slerp(seatedQuat, 0.28);
    }
  });

  const statusText =
    phase === "readyToDrag"
      ? `Click ${label} to grab`
      : phase === "dragging"
      ? `Drag ${label} to insert point`
      : phase === "inserting"
      ? `Sliding ${label} into seated position...`
      : `${label} installed`;

  return (
    <group>
      {active && phase !== "snapped" && phase !== "inserting" && <FlatTarget placed={false} position={highlightPosition} color={color} label={targetLabel} size={highlightSize} />}

      <group ref={partRef}>
        <primitive object={clone} />
      </group>
    </group>
  );
}

/* ───────────────────────────────────────────────────────────── */
/* PAGE */
/* ───────────────────────────────────────────────────────────── */

export default function FullAssemblyPracticalTest({ onBack }) {
  const reduce = useReducedMotion();

  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState("");

  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitSaving, setSubmitSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [secondsLeft, setSecondsLeft] = useState(TEST_SETTINGS.durationMin * 60);
  const [placed, setPlaced] = useState({ cpu: false, ram: false, ssd: false, mb: false, hdd: false, psu: false });
  const [warning, setWarning] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [mistakes, setMistakes] = useState(0);

  const requiredQuizProgress = profile?.quizProgress?.[TEST_SETTINGS.requiredQuizKey];
  const requiredPracticeAccess = profile?.practiceTestAccess?.[TEST_SETTINGS.requiredQuizKey];

  const quizPercent = requiredQuizProgress?.percent || 0;
  const practiceUnlocked =
    requiredPracticeAccess?.unlocked === true ||
    quizPercent >= TEST_SETTINGS.requiredQuizPercent;

  const isLocked = !practiceUnlocked;

  const currentStep = getCurrentStep(placed);
  const completedCount = Object.values(placed).filter(Boolean).length;
  const totalSteps = STEPS.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);
  const deductionPercent = mistakes * WRONG_CLICK_DEDUCTION;
  const scorePercent = calculatePracticalScore(progressPercent, mistakes);
  const canFinish = completedCount === totalSteps;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setAccessLoading(true);
      setAccessError("");

      if (!currentUser) {
        setFirebaseUser(null);
        setProfile(null);
        setAccessLoading(false);
        return;
      }

      setFirebaseUser(currentUser);

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) setProfile(snap.data());
        else setProfile(null);
      } catch (err) {
        setAccessError(err.message || "Unable to check practical test access.");
      } finally {
        setAccessLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!started || finished) return;

    if (secondsLeft <= 0) {
      handleSubmit(true);
      return;
    }

    const timer = setInterval(() => setSecondsLeft((current) => current - 1), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, finished, secondsLeft]);

  const formatTime = (seconds) => {
    const minutesText = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secondsText = String(seconds % 60).padStart(2, "0");
    return `${minutesText}:${secondsText}`;
  };

  const clearTemporaryMessages = () => {
    window.clearTimeout(clearTemporaryMessages.warningTimer);
    clearTemporaryMessages.warningTimer = window.setTimeout(() => {
      setWarning("");
      setSuccessMessage("");
    }, 2400);
  };

  const handleStart = () => {
    if (isLocked) return;

    setStarted(true);
    setFinished(false);
    setConfirmSubmit(false);
    setSaveError("");
    setWarning("");
    setSuccessMessage(`Practical test started. Follow the Module 2 full assembly order. Each wrong component click deducts ${WRONG_CLICK_DEDUCTION}% from your score.`);
    clearTemporaryMessages();
  };

  const handleStartRequired = useCallback(() => {
    setWarning("Click Start before selecting or dragging a part.");
    setSuccessMessage("");
    clearTemporaryMessages();
  }, []);

  const handleWrongAttempt = useCallback((clickedId, expectedId) => {
    setMistakes((value) => value + 1);
    setWarning(`Wrong part. Select ${getStepLabel(expectedId)} next, not ${getPartName(clickedId)}. -${WRONG_CLICK_DEDUCTION}% score deduction.`);
    setSuccessMessage("");
    clearTemporaryMessages();
  }, []);

  const handlePlaced = useCallback((id) => {
    setPlaced((previous) => {
      const next = { ...previous, [id]: true };
      const nextStep = getCurrentStep(next);

      if (nextStep === "complete") {
        setSuccessMessage("Full assembly complete. Submit your practical test.");
        setConfirmSubmit(true);
      } else {
        setSuccessMessage(`${getStepLabel(id)} completed. Next: ${getStepLabel(nextStep)}.`);
      }

      setWarning("");
      clearTemporaryMessages();
      return next;
    });
  }, []);

  const handleComplete = useCallback(() => {
    setSuccessMessage("Full assembly complete. Submit your practical test.");
    setConfirmSubmit(true);
    clearTemporaryMessages();
  }, []);

  const savePracticalProgress = async ({ autoSubmitted = false }) => {
    const currentUser = firebaseUser || auth.currentUser;

    if (!currentUser) {
      throw new Error("No logged-in user. Practical test progress was not saved.");
    }

    const completedStepCount = Object.values(placed).filter(Boolean).length;
    const completed = completedStepCount === STEPS.length;
    const progressPercentValue = Math.round((completedStepCount / STEPS.length) * 100);
    const deductionPercentValue = mistakes * WRONG_CLICK_DEDUCTION;
    const scorePercentValue = calculatePracticalScore(progressPercentValue, mistakes);
    const passed = completed && scorePercentValue >= TEST_SETTINGS.passingPercent;
    const userRef = doc(db, "users", currentUser.uid);

    await setDoc(
      userRef,
      {
        practicalProgress: {
          [TEST_SETTINGS.progressKey]: {
            completed,
            passed,
            percent: scorePercentValue,
            scorePercent: scorePercentValue,
            progressPercent: progressPercentValue,
            deductionPercent: deductionPercentValue,
            wrongClickDeduction: WRONG_CLICK_DEDUCTION,
            passingPercent: TEST_SETTINGS.passingPercent,
            mistakes,
            completedStepCount,
            totalSteps: STEPS.length,
            completedSteps: placed,
            requiredQuizKey: TEST_SETTINGS.requiredQuizKey,
            requiredQuizPercent: TEST_SETTINGS.requiredQuizPercent,
            autoSubmitted,
            updatedAt: serverTimestamp(),
          },
        },
      },
      { merge: true }
    );
  };

  const handleSubmit = async (auto = false) => {
    if (submitSaving || finished) return;

    if (!auto && !canFinish) {
      setWarning("Finish all assembly steps before submitting.");
      setSuccessMessage("");
      clearTemporaryMessages();
      return;
    }

    setSubmitSaving(true);
    setConfirmSubmit(false);
    setSaveError("");

    try {
      await savePracticalProgress({ autoSubmitted: auto });

      setStarted(false);
      setFinished(true);

      if (auto) alert("Time is up! Your practical test has been submitted automatically.");
    } catch (err) {
      setSaveError(err.message || "Practical test was not saved. Please check Firebase rules or your internet connection, then submit again.");
    } finally {
      setSubmitSaving(false);
    }
  };

  const resetTest = () => {
    setStarted(false);
    setFinished(false);
    setConfirmSubmit(false);
    setSubmitSaving(false);
    setSaveError("");
    setSecondsLeft(TEST_SETTINGS.durationMin * 60);
    setPlaced({ cpu: false, ram: false, ssd: false, mb: false, hdd: false, psu: false });
    setWarning("");
    setSuccessMessage("");
    setMistakes(0);
  };

  const motionPreset = useMemo(() => {
    if (reduce) return { whileHover: {}, whileTap: {}, transition: { duration: 0.15 } };

    return {
      whileHover: { y: -2, scale: 1.004 },
      whileTap: { scale: 0.99 },
      transition: { type: "spring", stiffness: 260, damping: 22 },
    };
  }, [reduce]);

  if (accessLoading) {
    return (
      <FullscreenShell>
        <CenteredPanel>
          <div className="mx-auto mb-5 h-12 w-12 animate-pulse rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10" />
          <div className="text-xl font-black text-white">Checking access...</div>
          <div className="mt-2 text-sm text-white/50">Please wait while your quiz progress is loaded.</div>
        </CenteredPanel>
      </FullscreenShell>
    );
  }

  if (accessError || isLocked) {
    return (
      <FullscreenShell>
        <CenteredPanel>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-red-400/25 bg-red-500/10 text-2xl">🔒</div>
          <div className="text-[12px] font-bold uppercase tracking-[0.28em] text-red-200/80">Locked Practical Test</div>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white">{TEST_SETTINGS.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/60">
            {accessError
              ? accessError
              : `Score ${TEST_SETTINGS.requiredQuizPercent}% or higher in the Module 2 Quiz to unlock the Full Assembly Practical Test.`}
          </p>
          <button type="button" onClick={onBack} className="mt-7 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10">
            ← Back
          </button>
        </CenteredPanel>
      </FullscreenShell>
    );
  }

  return (
    <FullscreenShell>
      <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
        <TopControlBar
          onBack={onBack}
          time={formatTime(secondsLeft)}
          status={finished ? "Submitted" : started ? "Running" : "Paused"}
          completedCount={completedCount}
          totalSteps={totalSteps}
          progressPercent={progressPercent}
          scorePercent={scorePercent}
          deductionPercent={deductionPercent}
          mistakes={mistakes}
          started={started}
          finished={finished}
          submitSaving={submitSaving}
          canFinish={canFinish}
          confirmSubmit={confirmSubmit}
          onStart={handleStart}
          onSubmitPrompt={() => setConfirmSubmit(true)}
          onSubmit={() => handleSubmit(false)}
          onCancelSubmit={() => setConfirmSubmit(false)}
          onReset={resetTest}
          onExit={onBack}
        />

        <div className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_330px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <GlassPanel className="min-h-0 overflow-hidden">
            <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 p-4">
              <StageHeader currentStep={currentStep} completedCount={completedCount} totalSteps={totalSteps} warning={warning} successMessage={successMessage} saveError={saveError} />

              <div className="min-h-0 overflow-hidden rounded-[24px] border border-[#5F9598]/20 bg-[#061E29]">
                <Canvas shadows style={{ width: "100%", height: "100%" }} camera={{ position: CAMERA_POSITION, fov: 50 }}>
                  <Suspense fallback={null}>
                    <Scene
                      started={started}
                      placed={placed}
                      currentStep={currentStep}
                      onPlaced={handlePlaced}
                      onWrongAttempt={handleWrongAttempt}
                      onStartRequired={handleStartRequired}
                      onComplete={handleComplete}
                    />
                  </Suspense>
                </Canvas>
              </div>
            </div>
          </GlassPanel>

          <RightRail motionPreset={motionPreset} currentStep={currentStep} placed={placed} started={started} finished={finished} progressPercent={progressPercent} mistakes={mistakes} />
        </div>
      </div>
    </FullscreenShell>
  );
}

/* ───────────────────────────────────────────────────────────── */
/* PAGE LAYOUT */
/* ───────────────────────────────────────────────────────────── */

function FullscreenShell({ children }) {
  return (
    <div className="relative h-[calc(100dvh-270px)] max-h-[calc(100dvh-270px)] min-h-0 w-full overflow-hidden rounded-[24px] bg-[#061E29] p-3 font-sans text-[#F3F4F4] antialiased">
      <div className="pointer-events-none absolute -left-48 -top-48 h-[520px] w-[520px] rounded-full bg-[#5F9598]/18 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-52 -right-44 h-[620px] w-[620px] rounded-full bg-[#1D546D]/26 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,#061E29_0%,#061E29_42%,#0B2A3A_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:58px_58px] opacity-35" />
      <div className="relative h-full min-h-0 w-full overflow-hidden">{children}</div>
    </div>
  );
}

function GlassPanel({ className = "", children }) {
  return <div className={["rounded-[28px] border border-white/10 bg-black/18 shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl", className].join(" ")}>{children}</div>;
}

function CenteredPanel({ children }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center">
      <GlassPanel className="w-full max-w-3xl p-9 text-center">{children}</GlassPanel>
    </div>
  );
}

function TopControlBar({ onBack, time, status, completedCount, totalSteps, progressPercent, scorePercent, deductionPercent, mistakes, started, finished, submitSaving, canFinish, confirmSubmit, onStart, onSubmitPrompt, onSubmit, onCancelSubmit, onReset, onExit }) {
  return (
    <GlassPanel className="shrink-0 overflow-hidden">
      <div className="grid min-h-[74px] items-center gap-3 px-4 py-2.5 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
        <button type="button" onClick={onBack} className="w-fit rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-[#00ffb4]/30 hover:bg-[#00ffb4]/10">
          ← Back
        </button>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label="Assembly Practical" />
            <MetricPill label={`${completedCount}/${totalSteps} steps`} />
            <MetricPill label={`${progressPercent}% progress`} />
            <MetricPill label={`${scorePercent}% score`} />
            <MetricPill label={`Deduction: -${deductionPercent}%`} subtle />
            <MetricPill label={`Mistakes: ${mistakes}`} subtle />
          </div>

          <div className="mt-1.5 min-w-0">
            <h1 className="truncate text-[22px] font-black leading-none tracking-tight text-white lg:text-[28px]">{TEST_SETTINGS.title}</h1>
            <div className="mt-1 truncate text-[12px] text-white/50">{TEST_SETTINGS.desc}</div>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#5F9598,#00ffb4)] shadow-[0_0_24px_rgba(0,255,180,0.45)] transition-[width] duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <TimerCard time={time} status={status} />

          {!finished ? (
            !started ? (
              <button type="button" onClick={onStart} className="rounded-2xl border border-[#5F9598]/35 bg-[#5F9598]/24 px-5 py-3 text-sm font-bold text-white transition hover:bg-[#5F9598]/32">
                Start
              </button>
            ) : (
              <button type="button" onClick={onSubmitPrompt} disabled={submitSaving || !canFinish} className="rounded-2xl border border-[#00ffb4]/25 bg-[#00ffb4]/12 px-5 py-3 text-sm font-bold text-[#b7fff0] transition hover:bg-[#00ffb4]/18 disabled:cursor-not-allowed disabled:opacity-45">
                {submitSaving ? "Saving..." : "Submit"}
              </button>
            )
          ) : (
            <button type="button" onClick={onReset} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/85 transition hover:bg-white/10">
              Retake
            </button>
          )}

          <button type="button" onClick={onExit} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/75 transition hover:bg-white/10">
            Exit
          </button>
        </div>
      </div>

      {confirmSubmit && !finished ? (
        <div className="border-t border-white/10 bg-[#00ffb4]/8 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-white">Submit practical test?</div>
              <div className="text-[12px] text-white/60">All required assembly steps are complete.</div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={onSubmit} disabled={submitSaving} className="rounded-xl border border-[#00ffb4]/25 bg-[#00ffb4]/18 px-4 py-2 text-sm font-bold text-[#b7fff0] transition hover:bg-[#00ffb4]/24 disabled:opacity-60">
                {submitSaving ? "Saving..." : "Yes, submit"}
              </button>
              <button type="button" onClick={onCancelSubmit} disabled={submitSaving} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/75 transition hover:bg-white/10 disabled:opacity-60">
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </GlassPanel>
  );
}

function StageHeader({ currentStep, completedCount, totalSteps, warning, successMessage, saveError }) {
  return (
    <div className="shrink-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#b7fff0]/70">
            Step {Math.min(completedCount + 1, totalSteps)} of {totalSteps}
          </div>
          <h2 className="mt-1 text-[20px] font-black leading-tight tracking-tight text-white lg:text-[25px]">{getStepLabel(currentStep)}</h2>
          <div className="mt-1 text-[13px] text-white/45">Follow the exact Module 2 full assembly sequence.</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-right">
          <div className="text-[10px] text-white/45">Expected Step</div>
          <div className="mt-0.5 text-sm font-bold text-[#b7fff0]">{getStepLabel(currentStep)}</div>
        </div>
      </div>

      {warning ? <MessageBox type="warning" text={warning} /> : null}
      {successMessage ? <MessageBox type="success" text={successMessage} /> : null}
      {saveError ? <MessageBox type="error" text={saveError} /> : null}
    </div>
  );
}

function MessageBox({ type, text }) {
  const styles = {
    warning: "border-yellow-400/25 bg-yellow-500/10 text-yellow-100",
    success: "border-[#00ffb4]/25 bg-[#00ffb4]/10 text-[#b7fff0]",
    error: "border-red-400/20 bg-red-500/10 text-red-100",
  };

  return <div className={["mt-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[0_12px_35px_rgba(0,0,0,0.22)]", styles[type]].join(" ")}>{text}</div>;
}

function RightRail({ motionPreset, currentStep, placed, started, finished, progressPercent, scorePercent, deductionPercent, mistakes }) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3 overflow-hidden">
      <GlassPanel className="min-h-0 overflow-hidden p-3">
        <div className="text-lg font-black tracking-tight text-white">Required Order</div>
        <div className="mt-1 text-[11px] text-white/50">This follows your Module 2 FullAssembly scene.</div>

        <div className="mt-3 space-y-2">
          {STEPS.map((step, index) => {
            const done = !!placed[step.id];
            const active = currentStep === step.id && !done;
            const locked = !done && !active;

            return (
              <motion.div key={step.id} {...motionPreset} className={["rounded-2xl border p-3 transition", done ? "border-[#00ffb4]/30 bg-[#00ffb4]/12" : active ? "border-[#5F9598]/40 bg-[#5F9598]/18 shadow-[0_12px_35px_rgba(95,149,152,0.12)]" : "border-white/10 bg-white/[0.035] opacity-65"].join(" ")}>
                <div className="flex items-center gap-3">
                  <div className={["flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-black", done ? "border-[#00ffb4]/30 bg-[#00ffb4] text-[#061E29]" : active ? "border-[#5F9598]/45 bg-[#5F9598]/25 text-white" : "border-white/10 bg-black/20 text-white/45"].join(" ")}>{done ? "✓" : index + 1}</div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-white/85">{step.label}</div>
                    <div className="mt-0.5 truncate text-[11px] text-white/45">{done ? "Completed" : active ? "Current required step" : locked ? "Locked until previous step is done" : "Pending"}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </GlassPanel>

      <GlassPanel className="p-3">
        <div className="text-lg font-black tracking-tight text-white">Summary</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <SummaryItem label="Progress" value={`${progressPercent}%`} />
          <SummaryItem label="Score" value={`${scorePercent}%`} />
          <SummaryItem label="Deduction" value={`-${deductionPercent}%`} />
          <SummaryItem label="Mistakes" value={`${mistakes}`} />
          <SummaryItem label="Status" value={finished ? "Done" : started ? "Running" : "Paused"} />
        </div>
      </GlassPanel>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-white/[0.045] p-3">
      <div className="text-[10px] text-white/45">{label}</div>
      <div className="mt-1 text-sm font-black tracking-tight text-white">{value}</div>
    </div>
  );
}

function StatusPill({ label }) {
  return <span className="rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#b7fff0]">{label}</span>;
}

function MetricPill({ label, subtle = false }) {
  return <span className={["rounded-full border px-3 py-1.5 text-[10.5px] font-semibold", subtle ? "border-white/10 bg-white/5 text-white/55" : "border-[#5F9598]/30 bg-[#5F9598]/16 text-white/75"].join(" ")}>{label}</span>;
}

function TimerCard({ time, status }) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-white/7 px-4 py-2 text-center shadow-[0_18px_55px_rgba(0,0,0,0.25)] backdrop-blur-xl">
      <div className="text-[10px] text-white/55">Time left</div>
      <div className="mt-0.5 text-[22px] font-black leading-none tracking-tight text-white">{time}</div>
      <div className="mt-1 text-[8px] uppercase tracking-[0.18em] text-white/35">{status}</div>
    </div>
  );
}

useGLTF.preload(CASE_URL);
useGLTF.preload(MB_URL);
useGLTF.preload(CPU_URL);
useGLTF.preload(RAM_URL);
useGLTF.preload(SSD_URL);
useGLTF.preload(HDD_URL);
useGLTF.preload(PSU_URL);