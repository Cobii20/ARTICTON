import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
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

/** WORK AREA */
const BOARD_Y = -14.95;
const BOARD_CENTER_X = 24;
const BOARD_CENTER_Z = 6.5;
const BOARD_SIZE = 26;
const GRID_DIVISIONS = 13;

/** COLORS */
const MB_COLOR = "#4aa3ff";
const CPU_COLOR = "#b56dff";
const RAM_COLOR = "#FFD41C";
const SSD_COLOR = "#ffcc00";
const HDD_COLOR = "#ff8a3d";
const PSU_COLOR = "#ff4d6d";

/** GENERAL SNAP / MAGNET */
const SNAP_DISTANCE = 0.75;
const MAGNET_DISTANCE = 3.2;
const MAGNET_STRENGTH = 0.22;

/** CASE */
const CASE_POSITION = new THREE.Vector3(27.88, -12.79, 35.74);
const CASE_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const CASE_SCALE = 1;

/** MOTHERBOARD ON WORKBENCH */
const MB_POSITION = new THREE.Vector3(33.54, -14.87, 11.32);
const MB_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const MB_SCALE = 1;

/** CPU - starts from final full disassembly checkerboard output */
const CPU_START_POSITION = new THREE.Vector3(17.49, -15.8, 0.3);
const CPU_DRAG_Y_LOCK = -15.49;
const CPU_SEATED_POSITION = new THREE.Vector3(27.91, -15.49, 6.98);
const CPU_HIGHLIGHT_POSITION = new THREE.Vector3(27.91, -15.44, 6.98);
const CPU_START_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const CPU_TARGET_ROTATION = new THREE.Euler(0, Math.PI, 0);

/** RAM - starts from final full disassembly checkerboard output */
const RAM_START_POSITION = new THREE.Vector3(13.73, -24.61, 9.06);
const RAM_DRAG_Y_LOCK = -20.74;
const RAM_SEATED_POSITION = new THREE.Vector3(34.35, -20.74, 11.32);
const RAM_HIGHLIGHT_POSITION = new THREE.Vector3(34.35, -20.69, 11.32);
const RAM_START_ROTATION = new THREE.Euler(Math.PI / 2, 0, 0);
const RAM_TARGET_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);

/** SSD - starts from final full disassembly checkerboard output */
const SSD_START_POSITION = new THREE.Vector3(12.94, -17.21, 7.36);
const SSD_DRAG_Y_LOCK = -17.03;
const SSD_SEATED_POSITION = new THREE.Vector3(24.39, -17.03, 11.26);
const SSD_HIGHLIGHT_POSITION = new THREE.Vector3(24.39, -16.98, 11.26);
const SSD_START_ROTATION = new THREE.Euler(0, 0, 0);
const SSD_TARGET_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);

/** MOTHERBOARD TO CASE */
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

/** HDD TO CASE - starts from final full disassembly checkerboard output */
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

/** PSU TO CASE - starts from final full disassembly checkerboard output */
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

/** INSERT SNAP / MAGNET */
const INSERT_TRIGGER_DISTANCE = 1.15;
const INSERT_TRIGGER_MAGNET_DISTANCE = 5.2;
const INSERT_TRIGGER_MAGNET_STRENGTH = 0.28;

const STEPS = [
  { id: "cpu", label: "CPU to motherboard", color: CPU_COLOR },
  { id: "ram", label: "RAM to motherboard", color: RAM_COLOR },
  { id: "ssd", label: "SSD to motherboard", color: SSD_COLOR },
  { id: "mb", label: "Motherboard to case", color: MB_COLOR },
  { id: "hdd", label: "HDD to case", color: HDD_COLOR },
  { id: "psu", label: "PSU to case", color: PSU_COLOR },
];

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

function Scene({ onComplete }) {
  const { camera } = useThree();

  const [placed, setPlaced] = useState({
    cpu: false,
    ram: false,
    ssd: false,
    mb: false,
    hdd: false,
    psu: false,
  });

  const completedRef = useRef(false);

  const currentStep = getCurrentStep(placed);
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

  const markPlaced = useCallback((id) => {
    setPlaced((prev) => ({ ...prev, [id]: true }));
  }, []);

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
      <color attach="background" args={[typeof document !== "undefined" && document.documentElement.classList.contains("articton-light") ? "#f8f9ff" : "#05080D"]} />

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

      {showWorkbenchMotherboard && <StaticMotherboard />}

      {!placed.mb && !mbActive && (
        <>
          <FlatTarget
            placed={!cpuActive || placed.cpu}
            position={CPU_HIGHLIGHT_POSITION}
            color={CPU_COLOR}
            label="Target: CPU socket"
            size={[1.75, 1.75]}
          />

          <FlatTarget
            placed={!ramActive || placed.ram}
            position={RAM_HIGHLIGHT_POSITION}
            color={RAM_COLOR}
            label="Target: RAM slot"
            size={[0.65, 3.25]}
          />

          <FlatTarget
            placed={!ssdActive || placed.ssd}
            position={SSD_HIGHLIGHT_POSITION}
            color={SSD_COLOR}
            label="Target: SSD slot"
            size={[1.6, 2.35]}
          />

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
            onPlaced={() => markPlaced("ssd")}
          />
        </>
      )}

      {showMotherboardAssemblyDraggable && (
        <>
          <FlatTarget
            placed={placed.mb}
            position={MB_CASE_HIGHLIGHT_POSITION}
            color={MB_COLOR}
            label="Target: motherboard standoffs"
            size={[5.4, 7.4]}
          />

          <MotherboardAssemblyToCase
            active={mbActive}
            unlocked={isStepUnlocked("mb", placed)}
            placed={placed.mb}
            onPlaced={() => markPlaced("mb")}
          />
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
        onPlaced={() => markPlaced("psu")}
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
  const quat = useMemo(
    () => new THREE.Quaternion().setFromEuler(CPU_TARGET_ROTATION),
    []
  );

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
  const quat = useMemo(
    () => new THREE.Quaternion().setFromEuler(RAM_TARGET_ROTATION),
    []
  );

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
  const quat = useMemo(
    () => new THREE.Quaternion().setFromEuler(SSD_TARGET_ROTATION),
    []
  );

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
  const assemblyQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(MB_ASSEMBLY_CASE_ROTATION),
    []
  );

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
    <group
      position={[position.x, position.y, position.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <mesh ref={fillRef}>
        <planeGeometry args={size} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.22}
          depthTest={false}
        />
      </mesh>

      <mesh ref={ringRef} position={[0, 0, 0.015]}>
        <ringGeometry args={[0.45, 0.82, 48]} />
        <meshBasicMaterial
          color={color}
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

  const dragPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -yLock),
    [yLock]
  );

  const clone = useMemo(() => cloneScene(scene, true), [scene]);

  const startQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(startRotation),
    [startRotation]
  );

  const targetQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(targetRotation),
    [targetRotation]
  );

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
    (e) => {
      const rect = gl.domElement.getBoundingClientRect();

      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
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
    const handlePointerDown = (e) => {
      if (
        e.button !== 0 ||
        !partRef.current ||
        !active ||
        !unlocked ||
        snapped
      ) {
        return;
      }

      updateMouse(e);

      const hitPart = isPointerOverPart();

      if (!hitPart && !dragging) return;

      if (!dragging) {
        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.set(
            partRef.current.position.x - hitPoint.x,
            0,
            partRef.current.position.z - hitPoint.z
          );
        }

        setDragging(true);
        document.body.style.cursor = "grabbing";
      } else {
        setDragging(false);
        document.body.style.cursor = "default";

        const dist = new THREE.Vector2(
          partRef.current.position.x - targetPosition.x,
          partRef.current.position.z - targetPosition.z
        ).length();

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
  }, [
    active,
    unlocked,
    camera,
    dragPlane,
    dragging,
    gl,
    hitPoint,
    isPointerOverPart,
    moveToTarget,
    onPlaced,
    raycaster,
    snapped,
    targetPosition,
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
          const targetDragPosition = new THREE.Vector3(
            hitPoint.x + dragOffset.current.x,
            yLock,
            hitPoint.z + dragOffset.current.z
          );

          partRef.current.position.lerp(targetDragPosition, 0.35);
        }
      }

      if (active && unlocked) {
        partRef.current.position.y = yLock;

        const dist = new THREE.Vector2(
          partRef.current.position.x - targetPosition.x,
          partRef.current.position.z - targetPosition.z
        ).length();

        if (dist < MAGNET_DISTANCE) {
          const pull = MAGNET_STRENGTH + (1 - dist / MAGNET_DISTANCE) * 0.22;

          const snapTarget = new THREE.Vector3(
            targetPosition.x,
            yLock,
            targetPosition.z
          );

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

function MotherboardAssemblyToCase({ active, unlocked, placed, onPlaced }) {
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
    const handlePointerDown = (e) => {
      if (
        e.button !== 0 ||
        !assemblyRef.current ||
        !active ||
        !unlocked ||
        snapped
      ) {
        return;
      }

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
  }, [
    active,
    unlocked,
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
        transitionProgress.current + delta * MB_FLOAT_TRANSITION_SPEED,
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

      const currentPosition = new THREE.Vector3();

      if (rawT < 0.35) {
        const t = easeOutCubic(rawT / 0.35);
        currentPosition.lerpVectors(start, liftPoint, t);
      } else {
        const t = easeInOutCubic((rawT - 0.35) / 0.65);
        currentPosition.lerpVectors(
          liftPoint,
          MB_ASSEMBLY_FRONT_OF_CASE_OFFSET,
          t
        );
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

    if (phase === "readyToDrag") {
      assemblyRef.current.quaternion.slerp(frontQuat, 0.12);
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

      assemblyRef.current.position.y = MB_DRAG_Y_LOCK;
      assemblyRef.current.quaternion.slerp(caseQuat, 0.18);

      const dist = new THREE.Vector2(
        assemblyRef.current.position.x - MB_ASSEMBLY_CASE_TARGET_OFFSET.x,
        assemblyRef.current.position.z - MB_ASSEMBLY_CASE_TARGET_OFFSET.z
      ).length();

      if (dist < MB_CASE_MAGNET_DISTANCE) {
        const magneticFactor = 1 - dist / MB_CASE_MAGNET_DISTANCE;

        const pull = THREE.MathUtils.clamp(
          MB_CASE_MAGNET_STRENGTH + magneticFactor * 0.35,
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

  const dragPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -yLock),
    [yLock]
  );

  const clone = useMemo(() => cloneScene(scene, true), [scene]);

  const startQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(startRotation),
    [startRotation]
  );

  const insertReadyQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(insertReadyRotation),
    [insertReadyRotation]
  );

  const seatedQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(seatedRotation),
    [seatedRotation]
  );

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
    (e) => {
      const rect = gl.domElement.getBoundingClientRect();

      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
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
    const handlePointerDown = (e) => {
      if (
        e.button !== 0 ||
        !partRef.current ||
        !active ||
        !unlocked ||
        phase === "snapped" ||
        phase === "inserting"
      ) {
        return;
      }

      updateMouse(e);

      const hitPart = isPointerOverPart();

      if (!hitPart && phase !== "dragging") return;

      if (phase === "readyToDrag") {
        partRef.current.position.y = yLock;

        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.set(
            partRef.current.position.x - hitPoint.x,
            0,
            partRef.current.position.z - hitPoint.z
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
          partRef.current.position.x - insertReadyPosition.x,
          partRef.current.position.z - insertReadyPosition.z
        ).length();

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
  }, [
    active,
    unlocked,
    beginInsertTransition,
    camera,
    dragPlane,
    gl,
    hitPoint,
    insertReadyPosition,
    insertReadyQuat,
    isPointerOverPart,
    phase,
    raycaster,
    updateMouse,
    yLock,
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
    if (!partRef.current) return;

    if (phase === "readyToDrag") {
      partRef.current.quaternion.slerp(active ? insertReadyQuat : startQuat, 0.12);
    }

    if (phase === "dragging" && active && unlocked) {
      raycaster.setFromCamera(mouse.current, camera);

      if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
        const targetDragPosition = new THREE.Vector3(
          hitPoint.x + dragOffset.current.x,
          yLock,
          hitPoint.z + dragOffset.current.z
        );

        partRef.current.position.lerp(targetDragPosition, 0.35);
      }

      partRef.current.position.y = yLock;
      partRef.current.quaternion.slerp(insertReadyQuat, 0.16);

      const dist = new THREE.Vector2(
        partRef.current.position.x - insertReadyPosition.x,
        partRef.current.position.z - insertReadyPosition.z
      ).length();

      if (dist < INSERT_TRIGGER_MAGNET_DISTANCE) {
        const magneticFactor = 1 - dist / INSERT_TRIGGER_MAGNET_DISTANCE;

        const pull = THREE.MathUtils.clamp(
          INSERT_TRIGGER_MAGNET_STRENGTH + magneticFactor * 0.3,
          0.14,
          0.52
        );

        const triggerTarget = new THREE.Vector3(
          insertReadyPosition.x,
          yLock,
          insertReadyPosition.z
        );

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
      insertProgress.current = Math.min(
        insertProgress.current + delta * transitionSpeed,
        1
      );

      const eased = easeInOutCubic(insertProgress.current);
      const currentPosition = new THREE.Vector3();

      if (eased < 0.5) {
        const t = easeInOutCubic(eased / 0.5);
        currentPosition.lerpVectors(
          insertStartPosition.current,
          clearancePosition,
          t
        );
      } else {
        const t = easeInOutCubic((eased - 0.5) / 0.5);
        currentPosition.lerpVectors(clearancePosition, seatedPosition, t);
      }

      partRef.current.position.copy(currentPosition);

      partRef.current.quaternion
        .copy(insertStartQuaternion.current)
        .slerp(seatedQuat, eased);

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

  return (
    <group>
      {active && phase !== "snapped" && phase !== "inserting" && (
        <FlatTarget
          placed={false}
          position={highlightPosition}
          color={color}
          label={targetLabel}
          size={highlightSize}
        />
      )}

      <group ref={partRef}>
        <primitive object={clone} />
      </group>
    </group>
  );
}

export default function FullAssembly({ onComplete }) {
  return (
    <Canvas
      shadows
      style={{ width: "100%", height: "100%" }}
      camera={{ position: CAMERA_POSITION, fov: 50 }}
    >
      <Scene onComplete={onComplete} />
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