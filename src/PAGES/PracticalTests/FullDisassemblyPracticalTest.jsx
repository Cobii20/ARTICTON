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
  id: "full-disassembly-practical",
  progressKey: "fullDisassembly",
  requiredQuizKey: "module3",
  title: "Full Disassembly Practical Test",
  desc: "Step-by-step PC disassembly validation",
  durationMin: 30,
};

/* ───────────────────────────────────────────────────────────── */
/* MODEL URLS */
/* Uses the same paths from your Module 3 FullDisassembly scene */
/* ───────────────────────────────────────────────────────────── */

const CASE_URL = "/models/PC CASE(BLENDER).glb";
const MB_URL = "/models/MB(BLENDER).glb";
const CPU_URL = "/models/CPU(BLENDER).glb";
const RAM_URL = "/models/RAM(BLENDER).glb";
const SSD_URL = "/models/SSD(BLENDER).glb";
const HDD_URL = "/models/HDD(BLENDER).glb";
const PSU_URL = "/models/PSU(BLENDER).glb";

/* ───────────────────────────────────────────────────────────── */
/* MODULE 3 FULL DISASSEMBLY COORDINATES */
/* Based on your uploaded FullDisassemblyPC scene */
/* ───────────────────────────────────────────────────────────── */

const CASE_POSITION = new THREE.Vector3(0, -15, 0);
const CASE_ROTATION = new THREE.Euler(0, 0, 0);
const CASE_SCALE = 1;
const ASSEMBLY_SCALE = 1;

const CAMERA_POSITION = [70, 14, -20];
const CONTROL_TARGET = [20, -12, 2];

const SNAP_DISTANCE = 0.75;
const MAGNET_DISTANCE = 3.2;
const MAGNET_STRENGTH = 0.22;

const BOARD_Y = -14.95;
const BOARD_CENTER_X = 24;
const BOARD_CENTER_Z = 6.5;
const BOARD_SIZE = 22;
const GRID_DIVISIONS = 11;
const CELL_SIZE = BOARD_SIZE / GRID_DIVISIONS;

const MB_HOVER_Y = -6.25;
const MB_EXTRACT_SPEED = 0.9;
const MB_PULL_OUT_POSITION = new THREE.Vector3(4.2, -0.6, 3.8);
const MB_DETACHED_READY_POSITION = new THREE.Vector3(25.8, MB_HOVER_Y, 3.8);
const MB_RING_OFFSET = new THREE.Vector3(-4.2, 0, -1.8);

const PARTS = [
  {
    id: "ram",
    label: "RAM",
    url: RAM_URL,
    color: "#00ffb4",
    installedPosition: new THREE.Vector3(-6.44, -0.59, 3.79),
    installedRotation: new THREE.Euler(0, 0, -Math.PI / 2),
    floorPosition: new THREE.Vector3(13.73, -24.61, 9.06),
    floorRotation: new THREE.Euler(Math.PI / 2, 0, 0),
  },
  {
    id: "hdd",
    label: "HDD",
    url: HDD_URL,
    color: "#3aa6ff",
    installedPosition: new THREE.Vector3(4.16, -14.32, -0.49),
    installedRotation: new THREE.Euler(0, 0, 0),
    floorPosition: new THREE.Vector3(15.5, -16.06, 10.96),
    floorRotation: new THREE.Euler(0, 0, 0),
  },
  {
    id: "ssd",
    label: "SSD",
    url: SSD_URL,
    color: "#ffcc00",
    installedPosition: new THREE.Vector3(-2.75, -0.66, -6.24),
    installedRotation: new THREE.Euler(0, 0, -Math.PI / 2),
    floorPosition: new THREE.Vector3(12.94, -17.21, 7.36),
    floorRotation: new THREE.Euler(0, 0, 0),
  },
  {
    id: "psu",
    label: "PSU",
    url: PSU_URL,
    color: "#ff6b6b",
    installedPosition: new THREE.Vector3(4.27, -15.66, 6.22),
    installedRotation: new THREE.Euler(0, Math.PI, 0),
    floorPosition: new THREE.Vector3(19.38, -15.81, 11.75),
    floorRotation: new THREE.Euler(0, Math.PI, 0),
  },
  {
    id: "cpu",
    label: "CPU",
    url: CPU_URL,
    color: "#b56dff",
    installedPosition: new THREE.Vector3(-1.25, -4.95, -2.66),
    installedRotation: new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2),
    floorPosition: new THREE.Vector3(17.49, -15.8, 0.3),
    floorRotation: new THREE.Euler(0, Math.PI / 2, 0),
  },
  {
    id: "mb",
    label: "Motherboard",
    url: MB_URL,
    color: "#00e5ff",
    installedPosition: new THREE.Vector3(-0.6, -0.6, 2.99),
    installedRotation: new THREE.Euler(0, 0, -Math.PI / 2),
    floorPosition: new THREE.Vector3(33.54, -14.87, 11.32),
    floorRotation: new THREE.Euler(0, Math.PI / 2, 0),
  },
];

/* ───────────────────────────────────────────────────────────── */
/* SHARED HELPERS */
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

function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

function getPlacementKey(id) {
  return `${id}Placed`;
}

function getCurrentPart(placements) {
  return PARTS.find((part) => !placements[getPlacementKey(part.id)]) || null;
}

function getStepLabel(id) {
  if (id === "complete") return "Full Disassembly Complete";
  return PARTS.find((part) => part.id === id)?.label || "Unknown part";
}

function emptyPlacements() {
  return {
    ramPlaced: false,
    hddPlaced: false,
    ssdPlaced: false,
    psuPlaced: false,
    cpuPlaced: false,
    mbPlaced: false,
  };
}

/* ───────────────────────────────────────────────────────────── */
/* FULL DISASSEMBLY SCENE WITH PRACTICAL VALIDATION */
/* ───────────────────────────────────────────────────────────── */

function Scene({
  started,
  placements,
  activePart,
  onPlaced,
  onWrongAttempt,
  onStartRequired,
  onComplete,
}) {
  const { camera } = useThree();
  const completedRef = useRef(false);

  const allPlaced = useMemo(() => {
    return PARTS.every((part) => placements[getPlacementKey(part.id)]);
  }, [placements]);

  useEffect(() => {
    if (!allPlaced) {
      completedRef.current = false;
      return;
    }

    if (completedRef.current) return;

    completedRef.current = true;
    onComplete?.();
  }, [allPlaced, onComplete]);

  useEffect(() => {
    camera.position.set(...CAMERA_POSITION);
    camera.lookAt(...CONTROL_TARGET);
  }, [camera]);

  const guardPartClick = useCallback(
    (id) => {
      if (!started) {
        onStartRequired?.();
        return false;
      }

      if (!activePart) return false;

      if (id !== activePart.id) {
        onWrongAttempt?.(id, activePart.id);
        return false;
      }

      return true;
    },
    [activePart, onStartRequired, onWrongAttempt, started]
  );

  return (
    <>
      <color attach="background" args={["#05080D"]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-3, 2, -2]} intensity={0.7} />
      <Environment preset="city" />

      <PCCase />
      <PlacementGuideBoard placements={placements} activePart={activePart} />

      {PARTS.filter((part) => part.id !== "mb").map((part) => (
        <PartDraggable
          key={part.id}
          part={part}
          active={activePart?.id === part.id}
          isPlaced={placements[getPlacementKey(part.id)]}
          guardPartClick={guardPartClick}
          onPlaced={() => onPlaced?.(part.id)}
        />
      ))}

      <MotherboardDraggable
        part={PARTS.find((part) => part.id === "mb")}
        active={activePart?.id === "mb"}
        isPlaced={placements.mbPlaced}
        guardPartClick={guardPartClick}
        onPlaced={() => onPlaced?.("mb")}
      />

      <SceneInstructionPanel activePart={activePart} placements={placements} />

      <ContactShadows
        position={[BOARD_CENTER_X, BOARD_Y + 0.1, BOARD_CENTER_Z]}
        opacity={0.38}
        scale={42}
        blur={2.8}
        far={30}
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={18}
        maxDistance={90}
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

function PCCase() {
  const { scene } = useGLTF(CASE_URL);
  const caseClone = useMemo(() => cloneScene(scene), [scene]);

  return (
    <group scale={CASE_SCALE} position={CASE_POSITION} rotation={CASE_ROTATION.toArray()}>
      <primitive object={caseClone} />
    </group>
  );
}

function PlacementGuideBoard({ placements, activePart }) {
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

      {PARTS.map((part, index) => (
        <CheckerTarget
          key={part.id}
          part={part}
          index={index}
          active={activePart?.id === part.id}
          placed={placements[getPlacementKey(part.id)]}
        />
      ))}
    </group>
  );
}

function CheckerTarget({ part, index, active, placed }) {
  const pulseRef = useRef();
  const fillRef = useRef();

  const x = part.id === "mb" ? part.floorPosition.x + MB_RING_OFFSET.x : part.floorPosition.x;
  const z = part.id === "mb" ? part.floorPosition.z + MB_RING_OFFSET.z : part.floorPosition.z;
  const size = part.id === "mb" ? CELL_SIZE * 1.35 : CELL_SIZE * 0.92;

  useFrame(({ clock }) => {
    if (!active) return;

    const t = (Math.sin(clock.getElapsedTime() * 2.5) + 1) / 2;

    if (pulseRef.current) {
      pulseRef.current.scale.setScalar(1 + t * 0.12);
      pulseRef.current.material.opacity = 0.48 + t * 0.42;
    }

    if (fillRef.current) {
      fillRef.current.material.opacity = 0.16 + t * 0.18;
    }
  });

  return (
    <group position={[x, BOARD_Y + 0.04 + index * 0.003, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={fillRef}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          color={part.color}
          transparent
          opacity={placed ? 0.34 : active ? 0.22 : 0.09}
          depthTest={false}
        />
      </mesh>

      <mesh ref={pulseRef} position={[0, 0, 0.015]}>
        <ringGeometry args={[size * 0.24, size * 0.42, 48]} />
        <meshBasicMaterial
          color={part.color}
          transparent
          opacity={active ? 0.9 : placed ? 0.55 : 0.25}
          depthTest={false}
        />
      </mesh>

      <Html center position={[0, -0.05, 0.02]} style={{ pointerEvents: "none" }}>
        <div
          style={{
            padding: "3px 7px",
            borderRadius: 999,
            background: placed
              ? "rgba(10,14,22,.72)"
              : active
              ? "rgba(10,14,22,.86)"
              : "rgba(10,14,22,.46)",
            border: `1px solid ${part.color}99`,
            color: "rgba(244,248,255,.95)",
            fontSize: 10,
            fontFamily: "monospace",
            whiteSpace: "nowrap",
            transform: "translateY(-18px)",
          }}
        >
          {part.label}
        </div>
      </Html>
    </group>
  );
}

function SceneInstructionPanel({ activePart, placements }) {
  const complete = PARTS.every((part) => placements[getPlacementKey(part.id)]);
  const activeText = complete ? "Disassembly complete" : `Remove ${activePart?.label || "next part"}`;

  return (
    <Html fullscreen style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 18,
          left: 18,
          padding: "10px 14px",
          minWidth: 300,
          borderRadius: 16,
          background: "rgba(10,14,22,.72)",
          border: "1px solid rgba(255,255,255,.14)",
          backdropFilter: "blur(8px)",
          color: "rgba(234,240,255,.95)",
          fontSize: 11,
          fontFamily: "monospace",
          boxShadow: "0 10px 30px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 6 }}>Full PC Disassembly</div>
        <div style={{ marginBottom: 8 }}>{activeText}</div>

        <div style={{ display: "grid", gap: 4 }}>
          {PARTS.map((part, index) => {
            const placed = placements[getPlacementKey(part.id)];
            const active = activePart?.id === part.id;

            return (
              <StepDot
                key={part.id}
                color={part.color}
                label={`${index + 1}. ${part.label}`}
                state={placed ? "done" : active ? "active" : "locked"}
                glow={active}
                muted={!placed && !active}
              />
            );
          })}
        </div>
      </div>
    </Html>
  );
}

function StepDot({ color, label, state, glow = false, muted = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: muted ? 0.45 : 1 }}>
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: 999,
          background: color,
          display: "inline-block",
          boxShadow: glow ? `0 0 14px ${color}` : "none",
        }}
      />
      <span>{label}</span>
      <span style={{ marginLeft: "auto" }}>{state}</span>
    </div>
  );
}

function SideStatus({ part, active, detached, dragging, snapped, pos }) {
  const text = !active && !snapped
    ? "Locked until previous part is removed"
    : !detached
    ? "Click component to detach"
    : snapped
    ? "Placed on checkerboard"
    : dragging
    ? "Dragging to colored target"
    : "Click to grab / release";

  return (
    <Html fullscreen style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 24,
          bottom: 24,
          padding: "12px 16px",
          minWidth: 240,
          borderRadius: 16,
          background: "rgba(10,14,22,.78)",
          border: `1px solid ${part.color}66`,
          backdropFilter: "blur(8px)",
          color: "rgba(234,240,255,.95)",
          fontSize: 12,
          fontFamily: "monospace",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>{part.label}</div>
        <div style={{ marginBottom: 8 }}>{text}</div>
        <div>x: {pos.x.toFixed(2)}</div>
        <div>y: {pos.y.toFixed(2)}</div>
        <div>z: {pos.z.toFixed(2)}</div>
      </div>
    </Html>
  );
}

function PartDraggable({ part, active, isPlaced = false, guardPartClick, onPlaced }) {
  const { scene } = useGLTF(part.url);
  const { gl, camera } = useThree();
  const partRef = useRef();

  const [dragging, setDragging] = useState(false);
  const [detached, setDetached] = useState(isPlaced);
  const [snapped, setSnapped] = useState(isPlaced);
  const [pos, setPos] = useState({
    x: part.installedPosition.x,
    y: part.installedPosition.y,
    z: part.installedPosition.z,
  });

  const mouse = useRef(new THREE.Vector2());
  const dragOffset = useRef(new THREE.Vector3());
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -part.floorPosition.y),
    [part.floorPosition.y]
  );

  const installedQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(part.installedRotation),
    [part.installedRotation]
  );
  const floorQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(part.floorRotation),
    [part.floorRotation]
  );
  const modelClone = useMemo(() => cloneScene(scene), [scene]);

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

  const moveToInstalled = useCallback(() => {
    if (!partRef.current) return;
    partRef.current.position.copy(part.installedPosition);
    partRef.current.quaternion.copy(installedQuat);
  }, [installedQuat, part.installedPosition]);

  const moveToFloor = useCallback(() => {
    if (!partRef.current) return;
    partRef.current.position.copy(part.floorPosition);
    partRef.current.quaternion.copy(floorQuat);
  }, [floorQuat, part.floorPosition]);

  useEffect(() => {
    if (!partRef.current) return;
    partRef.current.scale.setScalar(ASSEMBLY_SCALE);

    if (isPlaced) {
      moveToFloor();
      setDetached(true);
      setSnapped(true);
      setDragging(false);
    } else {
      moveToInstalled();
      setDetached(false);
      setSnapped(false);
      setDragging(false);
    }
  }, [isPlaced, moveToFloor, moveToInstalled]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (event.button !== 0 || !partRef.current || snapped) return;

      updateMouse(event);
      const hitPart = isPointerOverPart();

      if (!hitPart && !dragging) return;
      if (!guardPartClick?.(part.id)) return;
      if (!active) return;

      if (!detached) {
        setDetached(true);
        partRef.current.position.y = part.floorPosition.y;
        partRef.current.quaternion.copy(floorQuat);
        return;
      }

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
          partRef.current.position.x - part.floorPosition.x,
          partRef.current.position.z - part.floorPosition.z
        ).length();

        if (dist < SNAP_DISTANCE * 1.25) {
          moveToFloor();
          setSnapped(true);
          onPlaced?.();
        }
      }
    };

    gl.domElement.addEventListener("pointerdown", handlePointerDown);
    return () => gl.domElement.removeEventListener("pointerdown", handlePointerDown);
  }, [
    active,
    camera,
    detached,
    dragPlane,
    dragging,
    floorQuat,
    gl,
    guardPartClick,
    hitPoint,
    isPointerOverPart,
    moveToFloor,
    onPlaced,
    part.floorPosition,
    part.id,
    raycaster,
    snapped,
    updateMouse,
  ]);

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

    if (!detached && !snapped) {
      partRef.current.position.lerp(part.installedPosition, 0.2);
      partRef.current.quaternion.slerp(installedQuat, 0.2);
    } else if (snapped) {
      partRef.current.position.lerp(part.floorPosition, 0.28);
      partRef.current.quaternion.slerp(floorQuat, 0.28);
    } else {
      partRef.current.quaternion.slerp(floorQuat, 0.2);

      if (dragging && active) {
        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          const target = new THREE.Vector3(
            hitPoint.x + dragOffset.current.x,
            part.floorPosition.y,
            hitPoint.z + dragOffset.current.z
          );
          partRef.current.position.lerp(target, 0.35);
        }
      }

      partRef.current.position.y = part.floorPosition.y;

      const dist = new THREE.Vector2(
        partRef.current.position.x - part.floorPosition.x,
        partRef.current.position.z - part.floorPosition.z
      ).length();

      if (active && dist < MAGNET_DISTANCE) {
        const pull = MAGNET_STRENGTH + (1 - dist / MAGNET_DISTANCE) * 0.22;
        partRef.current.position.lerp(part.floorPosition, pull);
        partRef.current.quaternion.slerp(floorQuat, pull);

        if (dist < SNAP_DISTANCE) {
          moveToFloor();
          setSnapped(true);
          setDragging(false);
          document.body.style.cursor = "default";
          onPlaced?.();
        }
      }
    }

    const worldPos = new THREE.Vector3();
    partRef.current.getWorldPosition(worldPos);
    setPos({ x: worldPos.x, y: worldPos.y, z: worldPos.z });
  });

  return (
    <group>
      <group ref={partRef}>
        <primitive object={modelClone} />
      </group>

      {active && (
        <SideStatus
          part={part}
          active={active}
          detached={detached}
          dragging={dragging}
          snapped={snapped}
          pos={pos}
        />
      )}
    </group>
  );
}

function MotherboardDraggable({ part, active, isPlaced = false, guardPartClick, onPlaced }) {
  const { scene } = useGLTF(part.url);
  const { gl, camera } = useThree();
  const mbRef = useRef();

  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [detached, setDetached] = useState(isPlaced);
  const [snapped, setSnapped] = useState(isPlaced);
  const [animatingExtract, setAnimatingExtract] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [nearTarget, setNearTarget] = useState(false);
  const [pos, setPos] = useState({
    x: part.installedPosition.x,
    y: part.installedPosition.y,
    z: part.installedPosition.z,
  });

  const mouse = useRef(new THREE.Vector2());
  const dragOffset = useRef(new THREE.Vector3());
  const extractProgress = useRef(0);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -MB_HOVER_Y), []);

  const installedQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(part.installedRotation),
    [part.installedRotation]
  );
  const floorQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(part.floorRotation),
    [part.floorRotation]
  );
  const mbClone = useMemo(() => cloneScene(scene, true), [scene]);

  const updateMouse = useCallback(
    (event) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    },
    [gl]
  );

  const isPointerOverMotherboard = useCallback(() => {
    if (!mbRef.current) return false;
    raycaster.setFromCamera(mouse.current, camera);
    return raycaster.intersectObject(mbRef.current, true).length > 0;
  }, [camera, raycaster]);

  const getDistanceToTarget = useCallback(() => {
    if (!mbRef.current) return Infinity;
    return new THREE.Vector2(
      mbRef.current.position.x - part.floorPosition.x,
      mbRef.current.position.z - part.floorPosition.z
    ).length();
  }, [part.floorPosition]);

  const placeInstalled = useCallback(() => {
    if (!mbRef.current) return;
    mbRef.current.visible = true;
    mbRef.current.position.copy(part.installedPosition);
    mbRef.current.quaternion.copy(installedQuat);
    setObjectOpacity(mbRef.current, 1);
  }, [installedQuat, part.installedPosition]);

  const placeHoverReady = useCallback(() => {
    if (!mbRef.current) return;
    mbRef.current.visible = true;
    mbRef.current.position.copy(MB_DETACHED_READY_POSITION);
    mbRef.current.quaternion.copy(floorQuat);
    setObjectOpacity(mbRef.current, 1);
  }, [floorQuat]);

  const placeOnBoard = useCallback(() => {
    if (!mbRef.current) return;
    mbRef.current.visible = true;
    mbRef.current.position.copy(part.floorPosition);
    mbRef.current.quaternion.copy(floorQuat);
    setObjectOpacity(mbRef.current, 1);
  }, [floorQuat, part.floorPosition]);

  const startSmoothExtract = useCallback(() => {
    if (!mbRef.current) return;

    extractProgress.current = 0;
    setAnimationProgress(0);
    setDetached(true);
    setDragging(false);
    setSnapped(false);
    setAnimatingExtract(true);
    setHovered(false);
    setNearTarget(false);
    document.body.style.cursor = "default";
  }, []);

  useEffect(() => {
    if (!mbRef.current) return;
    mbRef.current.scale.setScalar(ASSEMBLY_SCALE);

    if (isPlaced) {
      placeOnBoard();
      setDetached(true);
      setSnapped(true);
      setAnimatingExtract(false);
      setAnimationProgress(1);
      setNearTarget(false);
    } else {
      placeInstalled();
      setDetached(false);
      setSnapped(false);
      setAnimatingExtract(false);
      setAnimationProgress(0);
      setNearTarget(false);
    }
  }, [isPlaced, placeInstalled, placeOnBoard]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (event.button !== 0 || !mbRef.current || animatingExtract || snapped) return;

      updateMouse(event);
      const hitMotherboard = isPointerOverMotherboard();

      if (!hitMotherboard && !dragging && !nearTarget) return;
      if (!guardPartClick?.("mb")) return;
      if (!active) return;

      if (!detached && !snapped) {
        startSmoothExtract();
        return;
      }

      if (!dragging) {
        if (nearTarget) {
          const dist = getDistanceToTarget();
          if (dist < SNAP_DISTANCE * 1.25) {
            placeOnBoard();
            setSnapped(true);
            setHovered(false);
            setNearTarget(false);
            document.body.style.cursor = "default";
            onPlaced?.();
            return;
          }
        }

        raycaster.setFromCamera(mouse.current, camera);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.set(
            mbRef.current.position.x - hitPoint.x,
            0,
            mbRef.current.position.z - hitPoint.z
          );
        }

        setDragging(true);
        document.body.style.cursor = "grabbing";
      } else {
        setDragging(false);
        const dist = getDistanceToTarget();

        if (dist < SNAP_DISTANCE * 1.25) {
          placeOnBoard();
          setSnapped(true);
          setHovered(false);
          setNearTarget(false);
          document.body.style.cursor = "default";
          onPlaced?.();
        } else {
          document.body.style.cursor = "grab";
        }
      }
    };

    gl.domElement.addEventListener("pointerdown", handlePointerDown);
    return () => gl.domElement.removeEventListener("pointerdown", handlePointerDown);
  }, [
    active,
    animatingExtract,
    camera,
    detached,
    dragPlane,
    dragging,
    getDistanceToTarget,
    gl,
    guardPartClick,
    hitPoint,
    isPointerOverMotherboard,
    nearTarget,
    onPlaced,
    placeOnBoard,
    raycaster,
    snapped,
    startSmoothExtract,
    updateMouse,
  ]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      updateMouse(event);

      if (!mbRef.current || animatingExtract || snapped) {
        setHovered(false);
        document.body.style.cursor = dragging ? "grabbing" : "default";
        return;
      }

      const hitMotherboard = isPointerOverMotherboard();
      setHovered(hitMotherboard || dragging);

      if (!active) {
        document.body.style.cursor = hitMotherboard ? "not-allowed" : "default";
      } else if (dragging) {
        document.body.style.cursor = "grabbing";
      } else if (hitMotherboard) {
        document.body.style.cursor = detached ? "grab" : "pointer";
      } else if (nearTarget) {
        document.body.style.cursor = "pointer";
      } else {
        document.body.style.cursor = "default";
      }
    };

    const preventContextMenu = (event) => event.preventDefault();
    gl.domElement.addEventListener("pointermove", handlePointerMove);
    gl.domElement.addEventListener("contextmenu", preventContextMenu);

    return () => {
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
      gl.domElement.removeEventListener("contextmenu", preventContextMenu);
      document.body.style.cursor = "default";
    };
  }, [active, animatingExtract, detached, dragging, gl, isPointerOverMotherboard, nearTarget, snapped, updateMouse]);

  useFrame((_, delta) => {
    if (!mbRef.current) return;

    if (animatingExtract) {
      extractProgress.current = Math.min(extractProgress.current + delta * MB_EXTRACT_SPEED, 1);
      const rawT = extractProgress.current;

      if (rawT < 0.32) {
        const t = easeInOutCubic(rawT / 0.32);
        mbRef.current.visible = true;
        mbRef.current.position.lerpVectors(part.installedPosition, MB_PULL_OUT_POSITION, t);
        mbRef.current.quaternion.copy(installedQuat);
        setObjectOpacity(mbRef.current, 1);
      } else if (rawT < 0.5) {
        const t = easeOutQuart((rawT - 0.32) / 0.18);
        mbRef.current.position.copy(MB_PULL_OUT_POSITION);
        mbRef.current.quaternion.copy(installedQuat);
        setObjectOpacity(mbRef.current, 1 - t);
      } else if (rawT < 0.58) {
        mbRef.current.visible = false;
        mbRef.current.position.copy(MB_DETACHED_READY_POSITION);
        mbRef.current.quaternion.copy(floorQuat);
        setObjectOpacity(mbRef.current, 0);
      } else {
        const t = easeOutQuart((rawT - 0.58) / 0.42);
        mbRef.current.visible = true;
        mbRef.current.position.copy(MB_DETACHED_READY_POSITION);
        mbRef.current.quaternion.copy(floorQuat);
        setObjectOpacity(mbRef.current, t);
      }

      setAnimationProgress(rawT);

      if (rawT >= 1) {
        placeHoverReady();
        setAnimatingExtract(false);
        setSnapped(false);
        setDragging(false);
        setHovered(false);
        setNearTarget(false);
        setAnimationProgress(1);
      }
    } else if (!detached && !snapped) {
      mbRef.current.position.lerp(part.installedPosition, 0.2);
      mbRef.current.quaternion.slerp(installedQuat, 0.2);
      setObjectOpacity(mbRef.current, 1);
    } else if (snapped) {
      mbRef.current.position.lerp(part.floorPosition, 0.28);
      mbRef.current.quaternion.slerp(floorQuat, 0.35);
      setObjectOpacity(mbRef.current, 1);
    } else {
      const dist = getDistanceToTarget();
      const magnetT = THREE.MathUtils.clamp(1 - dist / MAGNET_DISTANCE, 0, 1);
      setNearTarget(active && dist < MAGNET_DISTANCE);

      mbRef.current.quaternion.slerp(floorQuat, 0.08 + magnetT * 0.22);
      setObjectOpacity(mbRef.current, 1);

      if (dragging && active) {
        raycaster.setFromCamera(mouse.current, camera);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          const target = new THREE.Vector3(
            hitPoint.x + dragOffset.current.x,
            MB_HOVER_Y,
            hitPoint.z + dragOffset.current.z
          );
          mbRef.current.position.lerp(target, 0.35);
        }
      }

      if (active && dragging && dist < MAGNET_DISTANCE) {
        const pull = MAGNET_STRENGTH + magnetT * 0.18;
        const snapTarget = new THREE.Vector3(part.floorPosition.x, MB_HOVER_Y, part.floorPosition.z);
        mbRef.current.position.lerp(snapTarget, pull);
        mbRef.current.quaternion.slerp(floorQuat, 0.18 + magnetT * 0.18);

        if (dist < SNAP_DISTANCE) {
          placeOnBoard();
          setSnapped(true);
          setDragging(false);
          document.body.style.cursor = "default";
          onPlaced?.();
        }
      }
    }

    const worldPos = new THREE.Vector3();
    mbRef.current.getWorldPosition(worldPos);
    setPos({ x: worldPos.x, y: worldPos.y, z: worldPos.z });
  });

  const statusText = animatingExtract
    ? "Extracting motherboard"
    : !active && !snapped
    ? "Locked until other parts are removed"
    : !detached && hovered
    ? "Click to remove"
    : !detached
    ? "Hover and click motherboard"
    : snapped
    ? "Placed on checkerboard"
    : dragging && nearTarget
    ? "Release near target"
    : dragging
    ? "Guide to cyan target"
    : nearTarget
    ? "Click to place"
    : hovered
    ? "Click to grab"
    : "Drag motherboard";

  return (
    <group>
      <group ref={mbRef}>
        <primitive object={mbClone} />
      </group>

      {active && (
        <Html
          position={[
            part.floorPosition.x + MB_RING_OFFSET.x,
            part.floorPosition.y + 1.25,
            part.floorPosition.z + MB_RING_OFFSET.z,
          ]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(10,14,22,.76)",
              border: `1px solid ${part.color}99`,
              color: "rgba(234,240,255,.92)",
              fontFamily: "monospace",
              fontSize: 11,
              whiteSpace: "nowrap",
              boxShadow: "0 8px 22px rgba(0,0,0,.32)",
            }}
          >
            {statusText}
          </div>
        </Html>
      )}

      {active && (
        <Html fullscreen style={{ pointerEvents: "none" }}>
          <div
            style={{
              position: "absolute",
              left: 24,
              bottom: 24,
              padding: "12px 16px",
              minWidth: 250,
              borderRadius: 16,
              background: "rgba(10,14,22,.78)",
              border: `1px solid ${part.color}66`,
              backdropFilter: "blur(8px)",
              color: "rgba(234,240,255,.95)",
              fontSize: 12,
              fontFamily: "monospace",
              textAlign: "center",
              boxShadow: "0 10px 30px rgba(0,0,0,.35)",
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: 4 }}>{part.label}</div>
            <div style={{ marginBottom: 8 }}>{statusText}</div>

            {animatingExtract && (
              <div
                style={{
                  height: 5,
                  width: "100%",
                  overflow: "hidden",
                  borderRadius: 999,
                  marginBottom: 10,
                  background: "rgba(255,255,255,.12)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round(animationProgress * 100)}%`,
                    background: part.color,
                    transition: "width .12s linear",
                  }}
                />
              </div>
            )}

            <div>x: {pos.x.toFixed(2)}</div>
            <div>y: {pos.y.toFixed(2)}</div>
            <div>z: {pos.z.toFixed(2)}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

/* ───────────────────────────────────────────────────────────── */
/* PAGE */
/* ───────────────────────────────────────────────────────────── */

export default function FullDisassemblyPracticalTest({ onBack }) {
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
  const [placements, setPlacements] = useState(() => emptyPlacements());
  const [warning, setWarning] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [mistakes, setMistakes] = useState(0);

  const requiredQuizProgress = profile?.quizProgress?.[TEST_SETTINGS.requiredQuizKey];
  const quizFinished = !!requiredQuizProgress?.completed;
  const isLocked = !quizFinished;

  const activePart = useMemo(() => getCurrentPart(placements), [placements]);
  const completedCount = PARTS.filter((part) => placements[getPlacementKey(part.id)]).length;
  const totalSteps = PARTS.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);
  const canFinish = completedCount === totalSteps;
  const currentStepLabel = activePart ? `Remove ${activePart.label}` : "Full Disassembly Complete";

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

        if (snap.exists()) {
          setProfile(snap.data());
        } else {
          setProfile(null);
        }
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
    setSuccessMessage("Practical test started. Follow the Module 3 full disassembly order.");
    clearTemporaryMessages();
  };

  const handleStartRequired = useCallback(() => {
    setWarning("Click Start before selecting or dragging a part.");
    setSuccessMessage("");
    clearTemporaryMessages();
  }, []);

  const handleWrongAttempt = useCallback((clickedId, expectedId) => {
    const clickedLabel = getStepLabel(clickedId);
    const expectedLabel = getStepLabel(expectedId);

    setMistakes((value) => value + 1);
    setWarning(`Wrong part. Remove ${expectedLabel} next, not ${clickedLabel}.`);
    setSuccessMessage("");
    clearTemporaryMessages();
  }, []);

  const handlePlaced = useCallback((id) => {
    setPlacements((previous) => {
      const next = {
        ...previous,
        [getPlacementKey(id)]: true,
      };

      const nextPart = getCurrentPart(next);

      if (!nextPart) {
        setSuccessMessage("Full disassembly complete. Submit your practical test.");
        setConfirmSubmit(true);
      } else {
        setSuccessMessage(`${getStepLabel(id)} removed. Next: Remove ${nextPart.label}.`);
      }

      setWarning("");
      clearTemporaryMessages();
      return next;
    });
  }, []);

  const handleComplete = useCallback(() => {
    setSuccessMessage("Full disassembly complete. Submit your practical test.");
    setConfirmSubmit(true);
    clearTemporaryMessages();
  }, []);

  const savePracticalProgress = async ({ autoSubmitted = false }) => {
    if (!firebaseUser) return;

    const completed = PARTS.every((part) => placements[getPlacementKey(part.id)]);
    const percent = Math.round((completedCount / totalSteps) * 100);
    const userRef = doc(db, "users", firebaseUser.uid);

    await setDoc(
      userRef,
      {
        practicalProgress: {
          [TEST_SETTINGS.progressKey]: {
            completed,
            passed: completed,
            percent,
            mistakes,
            completedSteps: placements,
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
      setWarning("Finish all disassembly steps before submitting.");
      setSuccessMessage("");
      clearTemporaryMessages();
      return;
    }

    setSubmitSaving(true);
    setConfirmSubmit(false);
    setSaveError("");

    try {
      await savePracticalProgress({ autoSubmitted: auto });
    } catch (err) {
      setSaveError(err.message || "Practical test was submitted, but saving failed.");
    } finally {
      setStarted(false);
      setFinished(true);
      setSubmitSaving(false);

      if (auto) alert("Time is up! Your practical test has been submitted automatically.");
    }
  };

  const resetTest = () => {
    setStarted(false);
    setFinished(false);
    setConfirmSubmit(false);
    setSubmitSaving(false);
    setSaveError("");
    setSecondsLeft(TEST_SETTINGS.durationMin * 60);
    setPlacements(emptyPlacements());
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
            {accessError ? accessError : "Finish Module 3 Quiz first before taking the Full Disassembly Practical Test."}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-7 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
          >
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
              <StageHeader
                currentStepLabel={currentStepLabel}
                completedCount={completedCount}
                totalSteps={totalSteps}
                warning={warning}
                successMessage={successMessage}
                saveError={saveError}
              />

              <div className="min-h-0 overflow-hidden rounded-[24px] border border-[#5F9598]/20 bg-[#061E29]">
                <Canvas shadows style={{ width: "100%", height: "100%" }} camera={{ position: CAMERA_POSITION, fov: 50 }}>
                  <Suspense fallback={null}>
                    <Scene
                      started={started}
                      placements={placements}
                      activePart={activePart}
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

          <RightRail
            motionPreset={motionPreset}
            activePart={activePart}
            placements={placements}
            started={started}
            finished={finished}
            progressPercent={progressPercent}
            mistakes={mistakes}
          />
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

function TopControlBar({
  onBack,
  time,
  status,
  completedCount,
  totalSteps,
  progressPercent,
  mistakes,
  started,
  finished,
  submitSaving,
  canFinish,
  confirmSubmit,
  onStart,
  onSubmitPrompt,
  onSubmit,
  onCancelSubmit,
  onReset,
  onExit,
}) {
  return (
    <GlassPanel className="shrink-0 overflow-hidden">
      <div className="grid min-h-[74px] items-center gap-3 px-4 py-2.5 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
        <button type="button" onClick={onBack} className="w-fit rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-[#00ffb4]/30 hover:bg-[#00ffb4]/10">
          ← Back
        </button>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label="Disassembly Practical" />
            <MetricPill label={`${completedCount}/${totalSteps} steps`} />
            <MetricPill label={`${progressPercent}% progress`} />
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
              <div className="text-[12px] text-white/60">All required disassembly steps are complete.</div>
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

function StageHeader({ currentStepLabel, completedCount, totalSteps, warning, successMessage, saveError }) {
  return (
    <div className="shrink-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#b7fff0]/70">
            Step {Math.min(completedCount + 1, totalSteps)} of {totalSteps}
          </div>
          <h2 className="mt-1 text-[20px] font-black leading-tight tracking-tight text-white lg:text-[25px]">{currentStepLabel}</h2>
          <div className="mt-1 text-[13px] text-white/45">Follow the exact Module 3 full disassembly sequence.</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-right">
          <div className="text-[10px] text-white/45">Expected Step</div>
          <div className="mt-0.5 text-sm font-bold text-[#b7fff0]">{currentStepLabel}</div>
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

function RightRail({ motionPreset, activePart, placements, started, finished, progressPercent, mistakes }) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3 overflow-hidden">
      <GlassPanel className="min-h-0 overflow-hidden p-3">
        <div className="text-lg font-black tracking-tight text-white">Required Order</div>
        <div className="mt-1 text-[11px] text-white/50">This follows your Module 3 FullDisassembly scene.</div>

        <div className="mt-3 space-y-2">
          {PARTS.map((part, index) => {
            const done = !!placements[getPlacementKey(part.id)];
            const active = activePart?.id === part.id && !done;
            const locked = !done && !active;

            return (
              <motion.div
                key={part.id}
                {...motionPreset}
                className={[
                  "rounded-2xl border p-3 transition",
                  done
                    ? "border-[#00ffb4]/30 bg-[#00ffb4]/12"
                    : active
                    ? "border-[#5F9598]/40 bg-[#5F9598]/18 shadow-[0_12px_35px_rgba(95,149,152,0.12)]"
                    : "border-white/10 bg-white/[0.035] opacity-65",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={[
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-black",
                      done
                        ? "border-[#00ffb4]/30 bg-[#00ffb4] text-[#061E29]"
                        : active
                        ? "border-[#5F9598]/45 bg-[#5F9598]/25 text-white"
                        : "border-white/10 bg-black/20 text-white/45",
                    ].join(" ")}
                  >
                    {done ? "✓" : index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-white/85">Remove {part.label}</div>
                    <div className="mt-0.5 truncate text-[11px] text-white/45">
                      {done ? "Completed" : active ? "Current required step" : locked ? "Locked until previous step is done" : "Pending"}
                    </div>
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
          <SummaryItem label="Mistakes" value={`${mistakes}`} />
          <SummaryItem label="Status" value={finished ? "Done" : started ? "Running" : "Paused"} />
          <SummaryItem label="Score" value={progressPercent === 100 ? "100%" : "—"} />
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
