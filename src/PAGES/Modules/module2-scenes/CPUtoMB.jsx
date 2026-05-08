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
const MB_URL = "/models/MB(BLENDER).glb";
const CPU_URL = "/models/CPU(BLENDER).glb";

/** CAMERA */
const CAMERA_POSITION = [45, 18, 18];
const CONTROL_TARGET = [24, -14, 7];

/** SNAP / MAGNET */
const SNAP_DISTANCE = 0.75;
const MAGNET_DISTANCE = 3.2;
const MAGNET_STRENGTH = 0.22;

/** WORK AREA */
const BOARD_Y = -14.95;
const BOARD_CENTER_X = 24;
const BOARD_CENTER_Z = 6.5;
const BOARD_SIZE = 22;
const GRID_DIVISIONS = 11;

/** MOTHERBOARD POSITION ON WORKBENCH */
const MB_POSITION = new THREE.Vector3(33.54, -14.87, 11.32);
const MB_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const MB_SCALE = 1;

/**
 * CPU START POSITION
 * This is where the CPU begins before being dragged.
 */
const CPU_START_POSITION = new THREE.Vector3(18.2, -15.49, 1.2);

/**
 * CPU DRAG Y LOCK
 * This keeps the CPU at the correct seated height while dragging.
 */
const CPU_DRAG_Y_LOCK = -15.49;

/**
 * CPU FINAL SEATED POSITION
 * Provided from your scene.
 */
const CPU_SEATED_POSITION = new THREE.Vector3(27.91, -15.49, 6.98);

/**
 * PURPLE HIGHLIGHT POSITION
 * This is centered under the seated CPU.
 * If it is still slightly off, adjust only X and Z here.
 */
const CPU_HIGHLIGHT_POSITION = new THREE.Vector3(27.91, -15.44, 6.98);

/**
 * CPU ROTATION
 * Keep adjusting the Y value here only if the CPU direction is still wrong.
 */
const CPU_START_ROTATION = new THREE.Euler(0, Math.PI, 0);
const CPU_TARGET_ROTATION = new THREE.Euler(0, Math.PI, 0);

const CPU_COLOR = "#b56dff";

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

function Scene() {
  const { camera } = useThree();
  const [cpuPlaced, setCpuPlaced] = useState(false);

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
      <Motherboard />
      <CpuTarget placed={cpuPlaced} />
      <CPUDraggable placed={cpuPlaced} onPlaced={() => setCpuPlaced(true)} />

      <InstructionPanel placed={cpuPlaced} />

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
        minDistance={14}
        maxDistance={75}
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

function Motherboard() {
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

function CpuTarget({ placed }) {
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
      fillRef.current.material.opacity = 0.16 + t * 0.16;
    }
  });

  return (
    <group
      position={[
        CPU_HIGHLIGHT_POSITION.x,
        CPU_HIGHLIGHT_POSITION.y,
        CPU_HIGHLIGHT_POSITION.z,
      ]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <mesh ref={fillRef}>
        <planeGeometry args={[1.75, 1.75]} />
        <meshBasicMaterial
          color={CPU_COLOR}
          transparent
          opacity={placed ? 0.16 : 0.24}
          depthTest={false}
        />
      </mesh>

      {!placed && (
        <mesh ref={ringRef} position={[0, 0, 0.015]}>
          <ringGeometry args={[0.42, 0.78, 48]} />
          <meshBasicMaterial
            color={CPU_COLOR}
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
              border: `1px solid ${CPU_COLOR}aa`,
              color: "rgba(244,248,255,.95)",
              fontSize: 10,
              fontFamily: "monospace",
              whiteSpace: "nowrap",
              transform: "translateY(-18px)",
            }}
          >
            Target: CPU socket
          </div>
        </Html>
      )}
    </group>
  );
}

function CPUDraggable({ placed, onPlaced }) {
  const { scene } = useGLTF(CPU_URL);
  const { gl, camera } = useThree();

  const cpuRef = useRef();
  const mouse = useRef(new THREE.Vector2());
  const dragOffset = useRef(new THREE.Vector3());

  const [dragging, setDragging] = useState(false);
  const [snapped, setSnapped] = useState(placed);
  const [pos, setPos] = useState({
    x: CPU_START_POSITION.x,
    y: CPU_START_POSITION.y,
    z: CPU_START_POSITION.z,
  });

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);

  const dragPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -CPU_DRAG_Y_LOCK),
    []
  );

  const startQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(CPU_START_ROTATION),
    []
  );

  const targetQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(CPU_TARGET_ROTATION),
    []
  );

  const cpuClone = useMemo(() => cloneScene(scene, true), [scene]);

  const updateMouse = useCallback(
    (e) => {
      const rect = gl.domElement.getBoundingClientRect();

      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    },
    [gl]
  );

  const isPointerOverCPU = useCallback(() => {
    if (!cpuRef.current) return false;

    raycaster.setFromCamera(mouse.current, camera);
    return raycaster.intersectObject(cpuRef.current, true).length > 0;
  }, [camera, raycaster]);

  const moveToStart = useCallback(() => {
    if (!cpuRef.current) return;

    cpuRef.current.position.copy(CPU_START_POSITION);
    cpuRef.current.quaternion.copy(startQuat);
    setObjectOpacity(cpuRef.current, 1);
  }, [startQuat]);

  const moveToSeatedPosition = useCallback(() => {
    if (!cpuRef.current) return;

    cpuRef.current.position.copy(CPU_SEATED_POSITION);
    cpuRef.current.quaternion.copy(targetQuat);
    setObjectOpacity(cpuRef.current, 1);
  }, [targetQuat]);

  useEffect(() => {
    if (!cpuRef.current) return;

    cpuRef.current.scale.setScalar(1);

    if (placed) {
      moveToSeatedPosition();
      setSnapped(true);
      setDragging(false);
    } else {
      moveToStart();
      setSnapped(false);
      setDragging(false);
    }
  }, [placed, moveToStart, moveToSeatedPosition]);

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (e.button !== 0 || !cpuRef.current || snapped) return;

      updateMouse(e);

      const hitCPU = isPointerOverCPU();

      if (!hitCPU && !dragging) return;

      if (!dragging) {
        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.set(
            cpuRef.current.position.x - hitPoint.x,
            0,
            cpuRef.current.position.z - hitPoint.z
          );
        }

        setDragging(true);
        document.body.style.cursor = "grabbing";
      } else {
        setDragging(false);
        document.body.style.cursor = "default";

        const dist = new THREE.Vector2(
          cpuRef.current.position.x - CPU_SEATED_POSITION.x,
          cpuRef.current.position.z - CPU_SEATED_POSITION.z
        ).length();

        if (dist < SNAP_DISTANCE * 1.25) {
          moveToSeatedPosition();
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
    camera,
    dragPlane,
    dragging,
    gl,
    hitPoint,
    isPointerOverCPU,
    moveToSeatedPosition,
    onPlaced,
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
    if (!cpuRef.current) return;

    if (snapped) {
      cpuRef.current.position.lerp(CPU_SEATED_POSITION, 0.28);
      cpuRef.current.quaternion.slerp(targetQuat, 0.28);
    } else {
      cpuRef.current.quaternion.slerp(targetQuat, 0.08);

      if (dragging) {
        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          const targetDragPosition = new THREE.Vector3(
            hitPoint.x + dragOffset.current.x,
            CPU_DRAG_Y_LOCK,
            hitPoint.z + dragOffset.current.z
          );

          cpuRef.current.position.lerp(targetDragPosition, 0.35);
        }
      }

      cpuRef.current.position.y = CPU_DRAG_Y_LOCK;

      const dist = new THREE.Vector2(
        cpuRef.current.position.x - CPU_SEATED_POSITION.x,
        cpuRef.current.position.z - CPU_SEATED_POSITION.z
      ).length();

      if (dist < MAGNET_DISTANCE) {
        const pull = MAGNET_STRENGTH + (1 - dist / MAGNET_DISTANCE) * 0.22;

        const snapTarget = new THREE.Vector3(
          CPU_SEATED_POSITION.x,
          CPU_DRAG_Y_LOCK,
          CPU_SEATED_POSITION.z
        );

        cpuRef.current.position.lerp(snapTarget, pull);
        cpuRef.current.quaternion.slerp(targetQuat, pull);

        if (dist < SNAP_DISTANCE) {
          moveToSeatedPosition();
          setSnapped(true);
          setDragging(false);
          document.body.style.cursor = "default";
          onPlaced?.();
        }
      }
    }

    const worldPos = new THREE.Vector3();
    cpuRef.current.getWorldPosition(worldPos);

    setPos({
      x: worldPos.x,
      y: worldPos.y,
      z: worldPos.z,
    });
  });

  return (
    <group>
      <group ref={cpuRef}>
        <primitive object={cpuClone} />
      </group>

      {!snapped && (
        <Html fullscreen style={{ pointerEvents: "none", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              left: 24,
              bottom: 24,
              padding: "12px 16px",
              minWidth: 260,
              borderRadius: 16,
              background: "rgba(10,14,22,.78)",
              border: `1px solid ${CPU_COLOR}66`,
              backdropFilter: "blur(8px)",
              color: "rgba(234,240,255,.95)",
              fontSize: 12,
              fontFamily: "monospace",
              textAlign: "center",
              boxShadow: "0 10px 30px rgba(0,0,0,.35)",
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: 4 }}>CPU</div>
            <div style={{ marginBottom: 8 }}>
              {dragging ? "Dragging to CPU socket" : "Click CPU to grab"}
            </div>
            <div>x: {pos.x.toFixed(2)}</div>
            <div>y: {pos.y.toFixed(2)}</div>
            <div>z: {pos.z.toFixed(2)}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function InstructionPanel({ placed }) {
  return (
    <Html fullscreen style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 22,
          left: 24,
          padding: "12px 16px",
          minWidth: 300,
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
          Step 1: CPU to Motherboard
        </div>

        <div style={{ marginBottom: 10 }}>
          {placed
            ? "CPU seated on motherboard."
            : "Drag the CPU onto the CPU socket on the motherboard."}
        </div>

        <div style={{ display: "grid", gap: 5 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              opacity: 1,
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: CPU_COLOR,
                display: "inline-block",
                boxShadow: placed ? "none" : `0 0 14px ${CPU_COLOR}`,
              }}
            />
            <span>1. CPU</span>
            <span style={{ marginLeft: "auto" }}>
              {placed ? "done" : "active"}
            </span>
          </div>
        </div>
      </div>
    </Html>
  );
}

export default function CPUtoMB() {
  return (
    <Canvas
      shadows
      style={{ width: "100%", height: "100%" }}
      camera={{ position: CAMERA_POSITION, fov: 50 }}
    >
      <Scene />
    </Canvas>
  );
}

useGLTF.preload(MB_URL);
useGLTF.preload(CPU_URL);