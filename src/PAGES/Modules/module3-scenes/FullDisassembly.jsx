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
const CASE_URL = "/models/PC CASE(BLENDER).glb";
const MB_URL = "/models/MB(BLENDER).glb";
const CPU_URL = "/models/CPU(BLENDER).glb";
const RAM_URL = "/models/RAM(BLENDER).glb";
const SSD_URL = "/models/SSD(BLENDER).glb";
const HDD_URL = "/models/HDD(BLENDER).glb";
const PSU_URL = "/models/PSU(BLENDER).glb";

/** BASE SETTINGS */
const CASE_POSITION = new THREE.Vector3(0, -15, 0);
const CASE_ROTATION = new THREE.Euler(0, 0, 0);
const CASE_SCALE = 1;
const ASSEMBLY_SCALE = 1;

/** CAMERA */
const CAMERA_POSITION = [70, 14, -20];
const CONTROL_TARGET = [20, -12, 2];

/** SNAP / MAGNET */
const SNAP_DISTANCE = 0.75;
const MAGNET_DISTANCE = 3.2;
const MAGNET_STRENGTH = 0.22;

/** CHECKERBOARD */
const BOARD_Y = -14.95;
const BOARD_CENTER_X = 24;
const BOARD_CENTER_Z = 6.5;
const BOARD_SIZE = 22;
const GRID_DIVISIONS = 11;
const CELL_SIZE = BOARD_SIZE / GRID_DIVISIONS;

/** MOTHERBOARD EXTRACTION */
const MB_HOVER_Y = -6.25;
const MB_EXTRACT_SPEED = 0.9;
const MB_PULL_OUT_POSITION = new THREE.Vector3(4.2, -0.6, 3.8);
const MB_DETACHED_READY_POSITION = new THREE.Vector3(25.8, MB_HOVER_Y, 3.8);
const MB_RING_OFFSET = new THREE.Vector3(-4.2, 0, -1.8);

/** FULL DISASSEMBLY ORDER */
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
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

function getPlacementKey(id) {
  return `${id}Placed`;
}

function Scene({ placementApi }) {
  const { camera } = useThree();
  const [placements, setPlacements] = useState(() => ({
    ramPlaced: false,
    hddPlaced: false,
    ssdPlaced: false,
    psuPlaced: false,
    cpuPlaced: false,
    mbPlaced: false,
    ...(placementApi?.placements || {}),
  }));

  useEffect(() => {
    camera.position.set(...CAMERA_POSITION);
    camera.lookAt(...CONTROL_TARGET);
  }, [camera]);

  useEffect(() => {
    if (!placementApi?.placements) return;
    setPlacements((prev) => ({ ...prev, ...placementApi.placements }));
  }, [placementApi?.placements]);

  const activePart = useMemo(() => {
    return PARTS.find((part) => !placements[getPlacementKey(part.id)]) || null;
  }, [placements]);

  const setPlaced = useCallback(
    (id) => {
      const key = getPlacementKey(id);
      setPlacements((prev) => ({ ...prev, [key]: true }));
      placementApi?.setPlaced?.(key);
    },
    [placementApi]
  );

  const resetFrom = useCallback(
    (id) => {
      const startIndex = PARTS.findIndex((part) => part.id === id);
      setPlacements((prev) => {
        const next = { ...prev };
        PARTS.slice(startIndex).forEach((part) => {
          const key = getPlacementKey(part.id);
          next[key] = false;
          placementApi?.resetPlaced?.(key);
        });
        return next;
      });
    },
    [placementApi]
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
          onPlaced={() => setPlaced(part.id)}
          onReset={() => resetFrom(part.id)}
        />
      ))}

      <MotherboardDraggable
        part={PARTS.find((part) => part.id === "mb")}
        active={activePart?.id === "mb"}
        isPlaced={placements.mbPlaced}
        onPlaced={() => setPlaced("mb")}
        onReset={() => resetFrom("mb")}
      />

      <InstructionPanel activePart={activePart} placements={placements} />

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

function InstructionPanel({ activePart, placements }) {
  const complete = PARTS.every((part) => placements[getPlacementKey(part.id)]);
  const activeText = complete
    ? "Disassembly complete"
    : `Remove ${activePart?.label || "next part"}`;

  return (
    <Html fullscreen style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 22,
          left: 24,
          padding: "12px 16px",
          minWidth: 260,
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
        <div style={{ fontWeight: "bold", marginBottom: 8 }}>Full PC Disassembly</div>
        <div style={{ marginBottom: 10 }}>{activeText}</div>
        <div style={{ display: "grid", gap: 5 }}>
          {PARTS.map((part, index) => {
            const placed = placements[getPlacementKey(part.id)];
            const active = activePart?.id === part.id;
            return (
              <div
                key={part.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: placed || active ? 1 : 0.42,
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: part.color,
                    display: "inline-block",
                    boxShadow: active ? `0 0 14px ${part.color}` : "none",
                  }}
                />
                <span>{index + 1}. {part.label}</span>
                <span style={{ marginLeft: "auto" }}>
                  {placed ? "done" : active ? "active" : "locked"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Html>
  );
}

function SideStatus({ part, active, detached, dragging, snapped, pos }) {
  const text = !active && !snapped
    ? "Locked until previous part is placed"
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

function ResetButton({ label, color, onReset }) {
  const { gl } = useThree();

  return (
    <Html position={[-2, 2, 0]} style={{ pointerEvents: "auto" }}>
      <button
        onClick={() => {
          onReset();
          gl.domElement.blur?.();
        }}
        style={{
          appearance: "none",
          border: `1px solid ${color}66`,
          background: "rgba(10,14,22,.68)",
          color: "rgba(234,240,255,.95)",
          padding: "10px 12px",
          borderRadius: 14,
          fontSize: 12,
          letterSpacing: ".02em",
          cursor: "pointer",
          boxShadow: "0 10px 30px rgba(0,0,0,.35)",
        }}
        onMouseEnter={() => (document.body.style.cursor = "pointer")}
        onMouseLeave={() => (document.body.style.cursor = "default")}
      >
        Reset {label}
      </button>
    </Html>
  );
}

function PartDraggable({ part, active, isPlaced = false, onPlaced, onReset }) {
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
    const handlePointerDown = (e) => {
      if (e.button !== 0 || !partRef.current || !active || snapped) return;

      updateMouse(e);
      const hitPart = isPointerOverPart();

      if (!detached) {
        if (!hitPart) return;
        setDetached(true);
        partRef.current.position.y = part.floorPosition.y;
        partRef.current.quaternion.copy(floorQuat);
        return;
      }

      if (!dragging) {
        if (!hitPart) return;

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
    hitPoint,
    isPointerOverPart,
    moveToFloor,
    onPlaced,
    part.floorPosition,
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

      {snapped && <ResetButton label={part.label} color={part.color} onReset={onReset} />}
    </group>
  );
}

function MotherboardDraggable({ part, active, isPlaced = false, onPlaced, onReset }) {
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
  const dragPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -MB_HOVER_Y),
    []
  );

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
    (e) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
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
    const handlePointerDown = (e) => {
      if (e.button !== 0 || !mbRef.current || !active || animatingExtract) return;

      updateMouse(e);
      const hitMotherboard = isPointerOverMotherboard();

      if (!detached && !snapped) {
        if (hitMotherboard) startSmoothExtract();
        return;
      }

      if (snapped) return;

      if (!dragging) {
        if (!hitMotherboard && !nearTarget) return;

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
    const handlePointerMove = (e) => {
      updateMouse(e);

      if (!mbRef.current || !active || animatingExtract || snapped) {
        setHovered(false);
        document.body.style.cursor = dragging ? "grabbing" : "default";
        return;
      }

      const hitMotherboard = isPointerOverMotherboard();
      setHovered(hitMotherboard || dragging);

      if (dragging) document.body.style.cursor = "grabbing";
      else if (hitMotherboard) document.body.style.cursor = detached ? "grab" : "pointer";
      else if (nearTarget) document.body.style.cursor = "pointer";
      else document.body.style.cursor = "default";
    };

    const preventContextMenu = (e) => e.preventDefault();
    gl.domElement.addEventListener("pointermove", handlePointerMove);
    gl.domElement.addEventListener("contextmenu", preventContextMenu);
    return () => {
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
      gl.domElement.removeEventListener("contextmenu", preventContextMenu);
      document.body.style.cursor = "default";
    };
  }, [
    active,
    animatingExtract,
    detached,
    dragging,
    gl,
    isPointerOverMotherboard,
    nearTarget,
    snapped,
    updateMouse,
  ]);

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

      {snapped && <ResetButton label={part.label} color={part.color} onReset={onReset} />}
    </group>
  );
}

export default function FullDisassemblyPC({ placementApi }) {
  return (
    <Canvas
      shadows
      style={{ width: "100%", height: "100%" }}
      camera={{ position: CAMERA_POSITION, fov: 50 }}
    >
      <Scene placementApi={placementApi} />
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
