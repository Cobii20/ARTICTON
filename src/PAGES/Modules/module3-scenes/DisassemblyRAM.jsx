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
const PSU_URL = "/models/PSU(BLENDER).glb"; // ← added

/** BASE SETTINGS */
const CASE_POSITION = new THREE.Vector3(0, -15, 0);
const CASE_ROTATION = new THREE.Euler(0, 0, 0);
const CASE_SCALE = 1;
const ASSEMBLY_SCALE = 1;

/** YOUR CAMERA */
const CAMERA_POSITION = [70, 14, -20];
const CONTROL_TARGET = [20, -12, 2];

/** SNAP / MAGNET */
const SNAP_DISTANCE = 0.75;
const MAGNET_DISTANCE = 3.2;
const MAGNET_STRENGTH = 0.22;

/** STATIC PART POSITIONS */
const MB_POSITION = new THREE.Vector3(-0.6, -0.6, 2.99);
const MB_ROTATION = new THREE.Euler(0, 0, -Math.PI / 2);

const CPU_POSITION = new THREE.Vector3(-1.25, -4.95, -2.66);
const CPU_ROTATION = new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2);

const SSD_POSITION = new THREE.Vector3(-2.75, -0.66, -6.24);
const SSD_ROTATION = new THREE.Euler(0, 0, -Math.PI / 2);

/** HDD seated position (from file 1) */
const HDD_SEATED_POSITION = new THREE.Vector3(4.16, -14.32, -0.49);
const HDD_ROTATION = new THREE.Euler(0, 0, 0);

/** PSU seated position (from PSU file) */
const PSU_SEATED_POSITION = new THREE.Vector3(4.27, -15.66, 6.22); // ← added
const PSU_ROTATION = new THREE.Euler(0, Math.PI, 0);               // ← added

const RAM_INSTALLED_POSITION = new THREE.Vector3(-6.44, -0.59, 3.79);
const RAM_INSTALLED_ROTATION = new THREE.Euler(0, 0, -Math.PI / 2);

const RAM_FLAT_ROTATION = new THREE.Euler(Math.PI / 2, 0, 0);

/** CHECKERBOARD POSITION */
const BOARD_CENTER_X = 24;
const BOARD_CENTER_Z = 6.5;
const BOARD_Y = -14.95;
const BOARD_SIZE = 22;
const GRID_DIVISIONS = 11;
const CELL_SIZE = BOARD_SIZE / GRID_DIVISIONS;

/** RAM seated position */
const RAM_TARGET_X = 13.73;
const RAM_TARGET_Y = -24.61;
const RAM_TARGET_Z = 9.06;

const RAM_FLOOR_POSITION = new THREE.Vector3(
  RAM_TARGET_X,
  RAM_TARGET_Y,
  RAM_TARGET_Z
);

const LOCKED_DRAG_Y = RAM_TARGET_Y;

const RING_POSITION = new THREE.Vector3(15.85, -14.9, 15.46);

const RAM_LABEL_POSITION = new THREE.Vector3(
  BOARD_CENTER_X,
  BOARD_Y + 0.18,
  BOARD_CENTER_Z
);

/** ================= SCENE ================= */

function Scene({ placementApi, onComplete }) {
  const { camera } = useThree();
  const snapped = placementApi?.placements?.ramPlaced ?? false;
  const completedRef = useRef(false);

  useEffect(() => {
    if (!snapped) {
      completedRef.current = false;
      return;
    }

    if (completedRef.current) return;

    completedRef.current = true;
    onComplete?.();
  }, [snapped, onComplete]);

  useEffect(() => {
    camera.position.set(...CAMERA_POSITION);
    camera.lookAt(...CONTROL_TARGET);
  }, [camera]);

  return (
    <>
      <color attach="background" args={[typeof document !== "undefined" && document.documentElement.classList.contains("articton-light") ? "#f8f9ff" : "#05080D"]} />
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
      <MotherboardAssemblySeated />
      <PlacementGuideBoard snapped={snapped} />

      <RAMDraggable
        isPlaced={snapped}
        onPlaced={() => placementApi?.setPlaced?.("ramPlaced")}
        onResetPlaced={() => placementApi?.resetPlaced?.("ramPlaced")}
      />

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

/** ================= GUIDE BOARD ================= */

function PlacementGuideBoard({ snapped }) {
  return (
    <group>
      <mesh
        position={[BOARD_CENTER_X, BOARD_Y, BOARD_CENTER_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshStandardMaterial color="#ffffff" roughness={0.58} metalness={0.02} />
      </mesh>

      <gridHelper
        args={[BOARD_SIZE, GRID_DIVISIONS, "#000000", "#000000"]}
        position={[BOARD_CENTER_X, BOARD_Y + 0.02, BOARD_CENTER_Z]}
      />

      {!snapped && (
        <mesh
          position={[RING_POSITION.x, RING_POSITION.y, RING_POSITION.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[CELL_SIZE * 0.92, CELL_SIZE * 0.92]} />
          <meshBasicMaterial color="#FFD41C" transparent opacity={0.18} />
        </mesh>
      )}

      {!snapped && (
        <mesh
          position={[RING_POSITION.x, RING_POSITION.y + 0.02, RING_POSITION.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.45, 0.82, 48]} />
          <meshBasicMaterial color="#FFD41C" transparent opacity={0.9} />
        </mesh>
      )}

      {!snapped && (
        <Html
          position={[RAM_LABEL_POSITION.x, RAM_LABEL_POSITION.y, RAM_LABEL_POSITION.z]}
          center
        >
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(10,14,22,.72)",
              border: "1px solid rgba(140,255,230,.30)",
              color: "#eef4ff",
              fontSize: 11,
              fontFamily: "monospace",
              whiteSpace: "nowrap",
              boxShadow: "0 8px 20px rgba(0,0,0,.25)",
            }}
          >
            Place RAM here
          </div>
        </Html>
      )}
    </group>
  );
}

/** ================= PC CASE ================= */

function PCCase() {
  const { scene } = useGLTF(CASE_URL);

  const caseClone = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return (
    <group
      scale={CASE_SCALE}
      position={CASE_POSITION}
      rotation={CASE_ROTATION.toArray()}
    >
      <primitive object={caseClone} />
    </group>
  );
}

/** ================= STATIC ASSEMBLY (MB + CPU + SSD + HDD + PSU) ================= */

function MotherboardAssemblySeated() {
  const mbGltf  = useGLTF(MB_URL);
  const cpuGltf = useGLTF(CPU_URL);
  const ssdGltf = useGLTF(SSD_URL);
  const hddGltf = useGLTF(HDD_URL);
  const psuGltf = useGLTF(PSU_URL); // ← added

  const seatedGroup = useMemo(() => {
    const group = new THREE.Group();

    const mb = mbGltf.scene.clone(true);
    mb.position.copy(MB_POSITION);
    mb.rotation.copy(MB_ROTATION);
    group.add(mb);

    const cpu = cpuGltf.scene.clone(true);
    cpu.position.copy(CPU_POSITION);
    cpu.rotation.copy(CPU_ROTATION);
    group.add(cpu);

    const ssd = ssdGltf.scene.clone(true);
    ssd.position.copy(SSD_POSITION);
    ssd.rotation.copy(SSD_ROTATION);
    group.add(ssd);

    // HDD seated in case
    const hdd = hddGltf.scene.clone(true);
    hdd.position.copy(HDD_SEATED_POSITION);
    hdd.rotation.copy(HDD_ROTATION);
    group.add(hdd);

    // PSU seated in case ─────────────────────────────────────────
    const psu = psuGltf.scene.clone(true);
    psu.position.copy(PSU_SEATED_POSITION);
    psu.rotation.copy(PSU_ROTATION);
    group.add(psu);
    // ────────────────────────────────────────────────────────────

    group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    return group;
  }, [mbGltf.scene, cpuGltf.scene, ssdGltf.scene, hddGltf.scene, psuGltf.scene]); // ← psuGltf.scene added

  return <primitive object={seatedGroup} />;
}

/** ================= RAM DRAGGABLE ================= */

function RAMDraggable({ isPlaced = false, onPlaced, onResetPlaced }) {
  const { scene } = useGLTF(RAM_URL);
  const { gl, camera } = useThree();

  const ramRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [detached, setDetached] = useState(isPlaced);
  const [snapped, setSnapped] = useState(isPlaced);

  const dragOffset = useRef(new THREE.Vector3());
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useRef(new THREE.Vector2());
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(() => new THREE.Plane(), []);

  const installedQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(RAM_INSTALLED_ROTATION),
    []
  );
  const flatQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(RAM_FLAT_ROTATION),
    []
  );

  const ramClone = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  useEffect(() => {
    if (!ramRef.current) return;

    ramRef.current.scale.setScalar(ASSEMBLY_SCALE);

    if (isPlaced) {
      ramRef.current.position.copy(RAM_FLOOR_POSITION);
      ramRef.current.position.y = LOCKED_DRAG_Y;
      ramRef.current.quaternion.copy(flatQuat);
      setDetached(true);
      setSnapped(true);
    } else {
      ramRef.current.position.copy(RAM_INSTALLED_POSITION);
      ramRef.current.quaternion.copy(installedQuat);
      setDetached(false);
      setSnapped(false);
    }
  }, [isPlaced, installedQuat, flatQuat]);

  const updateMouse = useCallback(
    (e) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    },
    [gl]
  );

  useEffect(() => {
    const handleClick = (e) => {
      if (e.button !== 0) return;
      if (!ramRef.current) return;

      updateMouse(e);

      if (!detached && !snapped) {
        setDetached(true);
        ramRef.current.position.y = LOCKED_DRAG_Y;
        ramRef.current.quaternion.copy(flatQuat);
        return;
      }

      if (snapped) return;

      if (!dragging) {
        const normal = new THREE.Vector3();
        camera.getWorldDirection(normal);
        dragPlane.setFromNormalAndCoplanarPoint(normal, ramRef.current.position);

        raycaster.setFromCamera(mouse.current, camera);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.copy(ramRef.current.position).sub(hitPoint);
        }

        setDragging(true);
        document.body.style.cursor = "grabbing";
      } else {
        setDragging(false);
        document.body.style.cursor = "default";

        const dist = ramRef.current.position.distanceTo(RAM_FLOOR_POSITION);
        if (dist < SNAP_DISTANCE * 1.25) {
          setSnapped(true);
          onPlaced?.();
        }
      }
    };

    gl.domElement.addEventListener("pointerdown", handleClick);
    return () => gl.domElement.removeEventListener("pointerdown", handleClick);
  }, [
    detached,
    dragging,
    snapped,
    gl,
    camera,
    dragPlane,
    raycaster,
    hitPoint,
    updateMouse,
    onPlaced,
    flatQuat,
  ]);

  useEffect(() => {
    const move = (e) => updateMouse(e);
    gl.domElement.addEventListener("pointermove", move);
    return () => gl.domElement.removeEventListener("pointermove", move);
  }, [gl, updateMouse]);

  useEffect(() => {
    const preventContext = (e) => e.preventDefault();
    gl.domElement.addEventListener("contextmenu", preventContext);
    return () => gl.domElement.removeEventListener("contextmenu", preventContext);
  }, [gl]);

  useFrame(() => {
    if (!ramRef.current) return;

    if (!detached && !snapped) {
      ramRef.current.position.lerp(RAM_INSTALLED_POSITION, 0.2);
      ramRef.current.quaternion.slerp(installedQuat, 0.2);
    } else if (snapped) {
      ramRef.current.position.lerp(RAM_FLOOR_POSITION, 0.28);
      ramRef.current.position.y = LOCKED_DRAG_Y;
      ramRef.current.quaternion.slerp(flatQuat, 0.28);
    } else {
      if (dragging) {
        raycaster.setFromCamera(mouse.current, camera);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          const target = hitPoint.clone().add(dragOffset.current);
          target.y = LOCKED_DRAG_Y;
          ramRef.current.position.lerp(target, 0.35);
        }
      }

      ramRef.current.position.y = LOCKED_DRAG_Y;

      const dist = ramRef.current.position.distanceTo(RAM_FLOOR_POSITION);

      if (dist < MAGNET_DISTANCE) {
        const t = 1 - dist / MAGNET_DISTANCE;
        const pull = MAGNET_STRENGTH + t * 0.22;

        ramRef.current.position.lerp(RAM_FLOOR_POSITION, pull);
        ramRef.current.position.y = LOCKED_DRAG_Y;
        ramRef.current.quaternion.slerp(flatQuat, pull);

        if (dist < SNAP_DISTANCE) {
          setSnapped(true);
          setDragging(false);
          document.body.style.cursor = "default";
          onPlaced?.();
        }
      } else {
        ramRef.current.quaternion.slerp(flatQuat, 0.2);
      }
    }
  });

  return (
    <group>
      <group ref={ramRef}>
        <primitive object={ramClone} />
      </group>

      {snapped && (
        <ResetRAMButton
          onReset={() => {
            if (!ramRef.current) return;
            ramRef.current.position.copy(RAM_INSTALLED_POSITION);
            ramRef.current.quaternion.copy(installedQuat);
            setDetached(false);
            setSnapped(false);
            setDragging(false);
            onResetPlaced?.();
          }}
        />
      )}
    </group>
  );
}

function ResetRAMButton({ onReset }) {
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
          border: "1px solid rgba(255,255,255,.14)",
          background: "rgba(10,14,22,.6)",
          color: "rgba(234,240,255,.9)",
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
        Reset RAM
      </button>
    </Html>
  );
}

export default function DisassemblyRAM({ placementApi, onComplete }) {
  return (
    <Canvas
      shadows
      style={{ width: "100%", height: "100%" }}
      camera={{ position: CAMERA_POSITION, fov: 50 }}
    >
      <Scene
        placementApi={placementApi}
        onComplete={onComplete}
      />
    </Canvas>
  );
}

// Preload models
useGLTF.preload(CASE_URL);
useGLTF.preload(MB_URL);
useGLTF.preload(CPU_URL);
useGLTF.preload(RAM_URL);
useGLTF.preload(SSD_URL);
useGLTF.preload(HDD_URL);
useGLTF.preload(PSU_URL);