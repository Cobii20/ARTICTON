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

/** STATIC PART POSITIONS */
const MB_POSITION = new THREE.Vector3(-0.6, -0.6, 2.99);
const MB_ROTATION = new THREE.Euler(0, 0, -Math.PI / 2);

const CPU_POSITION = new THREE.Vector3(-1.25, -4.95, -2.66);
const CPU_ROTATION = new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2);

const SSD_POSITION = new THREE.Vector3(-2.75, -0.66, -6.24);
const SSD_ROTATION = new THREE.Euler(0, 0, -Math.PI / 2);

const PSU_SEATED_POSITION = new THREE.Vector3(4.27, -15.66, 6.22);
const PSU_ROTATION = new THREE.Euler(0, Math.PI, 0);

/** RAM — static, flat on the floor board */
const RAM_SEATED_POSITION = new THREE.Vector3(13.73, -24.61, 9.06);
const RAM_SEATED_ROTATION = new THREE.Euler(Math.PI / 2, 0, 0);

/** HDD installed position inside the case */
const HDD_INSTALLED_POSITION = new THREE.Vector3(4.16, -14.32, -0.49);
const HDD_INSTALLED_ROTATION = new THREE.Euler(0, 0, 0);
const HDD_FLAT_ROTATION = new THREE.Euler(0, 0, 0);

/** Y locked during drag and when seated */
const LOCKED_DRAG_Y = -16.06;

/** HDD floor/snap target */
const HDD_FLOOR_POSITION = new THREE.Vector3(15.50, LOCKED_DRAG_Y, 10.96);

/** GUIDE BOARD */
const BOARD_Y = -14.95;
const BOARD_CENTER_X = 24;
const BOARD_CENTER_Z = 6.5;
const BOARD_SIZE = 22;
const GRID_DIVISIONS = 11;
const CELL_SIZE = BOARD_SIZE / GRID_DIVISIONS;

/** HDD ring anchor */
const HDD_RING_POSITION = new THREE.Vector3(
  HDD_FLOOR_POSITION.x,
  BOARD_Y + 0.02,
  HDD_FLOOR_POSITION.z
);

/** ================= SCENE ================= */

function Scene({ placementApi }) {
  const { camera } = useThree();
  const snapped = placementApi?.placements?.hddPlaced ?? false;

  useEffect(() => {
    camera.position.set(...CAMERA_POSITION);
    camera.lookAt(...CONTROL_TARGET);
  }, [camera]);

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
      <MotherboardAssemblySeated />
      <PlacementGuideBoard snapped={snapped} />

      <HDDDraggable
        isPlaced={snapped}
        onPlaced={() => placementApi?.setPlaced?.("hddPlaced")}
        onResetPlaced={() => placementApi?.resetPlaced?.("hddPlaced")}
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

/** ================= PULSING RING ================= */

function PulsingRing() {
  const outerRef = useRef();
  const innerFillRef = useRef();

  useFrame(({ clock }) => {
    const t = (Math.sin(clock.getElapsedTime() * 2.5) + 1) / 2;
    if (outerRef.current)     outerRef.current.material.opacity     = 0.4 + t * 0.55;
    if (innerFillRef.current) innerFillRef.current.material.opacity = 0.12 + t * 0.22;
  });

  return (
    <group
      position={[HDD_RING_POSITION.x, HDD_RING_POSITION.y, HDD_RING_POSITION.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <mesh ref={innerFillRef}>
        <planeGeometry args={[CELL_SIZE * 0.92, CELL_SIZE * 0.92]} />
        <meshBasicMaterial color="#00ffb4" transparent opacity={0.15} />
      </mesh>
      <mesh ref={outerRef} position={[0, 0, 0.01]}>
        <ringGeometry args={[0.45, 0.82, 48]} />
        <meshBasicMaterial color="#00ffb4" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <ringGeometry args={[0.18, 0.38, 48]} />
        <meshBasicMaterial color="#00ffb4" transparent opacity={0.5} />
      </mesh>
    </group>
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

      {!snapped && <PulsingRing />}
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
    <group scale={CASE_SCALE} position={CASE_POSITION} rotation={CASE_ROTATION.toArray()}>
      <primitive object={caseClone} />
    </group>
  );
}

/** ================= STATIC ASSEMBLY (MB + CPU + SSD + RAM + PSU) ================= */

function MotherboardAssemblySeated() {
  const mbGltf  = useGLTF(MB_URL);
  const cpuGltf = useGLTF(CPU_URL);
  const ssdGltf = useGLTF(SSD_URL);
  const ramGltf = useGLTF(RAM_URL);
  const psuGltf = useGLTF(PSU_URL);

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

    const ram = ramGltf.scene.clone(true);
    ram.position.copy(RAM_SEATED_POSITION);
    ram.rotation.copy(RAM_SEATED_ROTATION);
    group.add(ram);

    const psu = psuGltf.scene.clone(true);
    psu.position.copy(PSU_SEATED_POSITION);
    psu.rotation.copy(PSU_ROTATION);
    group.add(psu);

    group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    return group;
  }, [mbGltf.scene, cpuGltf.scene, ssdGltf.scene, ramGltf.scene, psuGltf.scene]);

  return <primitive object={seatedGroup} />;
}

/** ================= SIDE STATUS ================= */

function SideStatus({ detached, dragging, snapped, pos }) {
  const text = !detached
    ? "Click to detach"
    : snapped
    ? "Placed on floor"
    : dragging
    ? "Dragging to target"
    : "Click to grab";

  return (
    <Html fullscreen style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 24,
          bottom: 24,
          padding: "12px 16px",
          minWidth: 220,
          borderRadius: 16,
          background: "rgba(10,14,22,.78)",
          border: "1px solid rgba(0,255,180,.22)",
          backdropFilter: "blur(8px)",
          color: "rgba(234,240,255,.95)",
          fontSize: 12,
          fontFamily: "monospace",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>HDD</div>
        <div style={{ marginBottom: 8 }}>{text}</div>
        <div>x: {pos.x.toFixed(2)}</div>
        <div>y: {pos.y.toFixed(2)}</div>
        <div>z: {pos.z.toFixed(2)}</div>
      </div>
    </Html>
  );
}

/** ================= HDD DRAGGABLE ================= */

function HDDDraggable({ isPlaced = false, onPlaced, onResetPlaced }) {
  const { scene } = useGLTF(HDD_URL);
  const { gl, camera } = useThree();

  const hddRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [detached, setDetached] = useState(isPlaced);
  const [snapped, setSnapped] = useState(isPlaced);
  const [pos, setPos] = useState({
    x: HDD_INSTALLED_POSITION.x,
    y: HDD_INSTALLED_POSITION.y,
    z: HDD_INSTALLED_POSITION.z,
  });

  const dragOffset = useRef(new THREE.Vector3());
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useRef(new THREE.Vector2());
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(() => new THREE.Plane(), []);

  const installedQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(HDD_INSTALLED_ROTATION),
    []
  );
  const flatQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(HDD_FLAT_ROTATION),
    []
  );

  const hddClone = useMemo(() => {
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
    if (!hddRef.current) return;
    hddRef.current.scale.setScalar(ASSEMBLY_SCALE);

    if (isPlaced) {
      hddRef.current.position.copy(HDD_FLOOR_POSITION);
      hddRef.current.position.y = LOCKED_DRAG_Y;
      hddRef.current.quaternion.copy(flatQuat);
      setDetached(true);
      setSnapped(true);
    } else {
      hddRef.current.position.copy(HDD_INSTALLED_POSITION);
      hddRef.current.quaternion.copy(installedQuat);
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
      if (!hddRef.current) return;

      updateMouse(e);

      if (!detached && !snapped) {
        setDetached(true);
        hddRef.current.position.y = LOCKED_DRAG_Y;
        hddRef.current.quaternion.copy(flatQuat);
        return;
      }

      if (snapped) return;

      if (!dragging) {
        const normal = new THREE.Vector3();
        camera.getWorldDirection(normal);
        dragPlane.setFromNormalAndCoplanarPoint(normal, hddRef.current.position);

        raycaster.setFromCamera(mouse.current, camera);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.copy(hddRef.current.position).sub(hitPoint);
        }

        setDragging(true);
        document.body.style.cursor = "grabbing";
      } else {
        setDragging(false);
        document.body.style.cursor = "default";

        const dist = hddRef.current.position.distanceTo(HDD_FLOOR_POSITION);
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
    if (!hddRef.current) return;

    if (!detached && !snapped) {
      hddRef.current.position.lerp(HDD_INSTALLED_POSITION, 0.2);
      hddRef.current.quaternion.slerp(installedQuat, 0.2);
    } else if (snapped) {
      hddRef.current.position.lerp(HDD_FLOOR_POSITION, 0.28);
      hddRef.current.position.y = LOCKED_DRAG_Y;
      hddRef.current.quaternion.slerp(flatQuat, 0.28);
    } else {
      if (dragging) {
        raycaster.setFromCamera(mouse.current, camera);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          const target = hitPoint.clone().add(dragOffset.current);
          target.y = LOCKED_DRAG_Y;
          hddRef.current.position.lerp(target, 0.35);
        }
      }

      hddRef.current.position.y = LOCKED_DRAG_Y;

      const dist = hddRef.current.position.distanceTo(HDD_FLOOR_POSITION);

      if (dist < MAGNET_DISTANCE) {
        const t = 1 - dist / MAGNET_DISTANCE;
        const pull = MAGNET_STRENGTH + t * 0.22;

        hddRef.current.position.lerp(HDD_FLOOR_POSITION, pull);
        hddRef.current.position.y = LOCKED_DRAG_Y;
        hddRef.current.quaternion.slerp(flatQuat, pull);

        if (dist < SNAP_DISTANCE) {
          setSnapped(true);
          setDragging(false);
          document.body.style.cursor = "default";
          onPlaced?.();
        }
      } else {
        hddRef.current.quaternion.slerp(flatQuat, 0.2);
      }
    }

    const worldPos = new THREE.Vector3();
    hddRef.current.getWorldPosition(worldPos);
    setPos({ x: worldPos.x, y: worldPos.y, z: worldPos.z });
  });

  return (
    <group>
      <group ref={hddRef}>
        <primitive object={hddClone} />
      </group>

      <SideStatus
        detached={detached}
        dragging={dragging}
        snapped={snapped}
        pos={pos}
      />

      {snapped && (
        <ResetHDDButton
          onReset={() => {
            if (!hddRef.current) return;
            hddRef.current.position.copy(HDD_INSTALLED_POSITION);
            hddRef.current.quaternion.copy(installedQuat);
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

/** ================= RESET BUTTON ================= */

function ResetHDDButton({ onReset }) {
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
        Reset HDD
      </button>
    </Html>
  );
}

/** ================= EXPORT ================= */

export default function DisassemblyHDD({ placementApi }) {
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

// Preload models
useGLTF.preload(CASE_URL);
useGLTF.preload(MB_URL);
useGLTF.preload(CPU_URL);
useGLTF.preload(RAM_URL);
useGLTF.preload(SSD_URL);
useGLTF.preload(HDD_URL);
useGLTF.preload(PSU_URL);