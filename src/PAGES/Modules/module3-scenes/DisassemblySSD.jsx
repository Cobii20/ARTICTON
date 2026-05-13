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

const PSU_SEATED_POSITION = new THREE.Vector3(4.27, -15.66, 6.22);
const PSU_ROTATION = new THREE.Euler(0, Math.PI, 0);

/** RAM — stays in default position, not draggable */
const RAM_SEATED_POSITION = new THREE.Vector3(13.73, -24.61, 9.06);
const RAM_SEATED_ROTATION = new THREE.Euler(Math.PI / 2, 0, 0);

/** HDD — already seated/placed, static in this scene */
const HDD_SEATED_POSITION = new THREE.Vector3(15.50, -16.06, 10.96);
const HDD_SEATED_ROTATION = new THREE.Euler(0, 0, 0);

/** SSD installed start position inside the case */
const SSD_INSTALLED_POSITION = new THREE.Vector3(-2.75, -0.66, -6.24);
const SSD_INSTALLED_ROTATION = new THREE.Euler(0, 0, -Math.PI / 2);

/** SSD flat rotation after detached */
const SSD_FLAT_ROTATION = new THREE.Euler(0, 0, 0);

/** SSD seated position — Y locked to -17.21 */
const SSD_LOCKED_Y = -17.21;
const SSD_FLOOR_POSITION = new THREE.Vector3(12.94, SSD_LOCKED_Y, 7.36);

/** GUIDE BOARD */
const BOARD_Y = -14.95;
const BOARD_CENTER_X = 24;
const BOARD_CENTER_Z = 6.5;
const BOARD_SIZE = 22;
const GRID_DIVISIONS = 11;
const CELL_SIZE = BOARD_SIZE / GRID_DIVISIONS;

/** SSD ring anchor — same seated position, minimized */
const SSD_RING_POSITION = new THREE.Vector3(12.94, SSD_LOCKED_Y, 7.36);

/** ================= SCENE ================= */

function Scene({ placementApi, onComplete }) {
  const { camera } = useThree();
  const snapped = placementApi?.placements?.ssdPlaced ?? false;
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

      <SSDDraggable
        isPlaced={snapped}
        onPlaced={() => placementApi?.setPlaced?.("ssdPlaced")}
        onResetPlaced={() => placementApi?.resetPlaced?.("ssdPlaced")}
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

/** ================= PULSING RING — MINIMIZED ================= */

function PulsingRing() {
  const outerRef = useRef();
  const innerFillRef = useRef();

  useFrame(({ clock }) => {
    const t = (Math.sin(clock.getElapsedTime() * 2.5) + 1) / 2;
    if (outerRef.current) outerRef.current.material.opacity = 0.4 + t * 0.55;
    if (innerFillRef.current) innerFillRef.current.material.opacity = 0.12 + t * 0.22;
  });

  return (
    <group
      position={[SSD_RING_POSITION.x, SSD_RING_POSITION.y, SSD_RING_POSITION.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <mesh ref={innerFillRef}>
        <planeGeometry args={[CELL_SIZE * 0.1, CELL_SIZE * 0.1]} />
        <meshBasicMaterial color="#00ffb4" transparent opacity={0.15} />
      </mesh>

      <mesh ref={outerRef} position={[0, 0, 0.01]}>
        <ringGeometry args={[0.045, 0.08, 48]} />
        <meshBasicMaterial color="#00ffb4" transparent opacity={0.9} />
      </mesh>

      <mesh position={[0, 0, 0.02]}>
        <ringGeometry args={[0.018, 0.04, 48]} />
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

/** ================= STATIC ASSEMBLY ================= */

function MotherboardAssemblySeated() {
  const mbGltf = useGLTF(MB_URL);
  const cpuGltf = useGLTF(CPU_URL);
  const ramGltf = useGLTF(RAM_URL);
  const hddGltf = useGLTF(HDD_URL);
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

    const ram = ramGltf.scene.clone(true);
    ram.position.copy(RAM_SEATED_POSITION);
    ram.rotation.copy(RAM_SEATED_ROTATION);
    group.add(ram);

    const hdd = hddGltf.scene.clone(true);
    hdd.position.copy(HDD_SEATED_POSITION);
    hdd.rotation.copy(HDD_SEATED_ROTATION);
    group.add(hdd);

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
  }, [mbGltf.scene, cpuGltf.scene, ramGltf.scene, hddGltf.scene, psuGltf.scene]);

  return <primitive object={seatedGroup} />;
}

/** ================= SSD DRAGGABLE ================= */

function SSDDraggable({ isPlaced = false, onPlaced, onResetPlaced }) {
  const { scene } = useGLTF(SSD_URL);
  const { gl, camera } = useThree();

  const ssdRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [detached, setDetached] = useState(isPlaced);
  const [snapped, setSnapped] = useState(isPlaced);

  const dragOffset = useRef(new THREE.Vector3());
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useRef(new THREE.Vector2());
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(() => new THREE.Plane(), []);

  const installedQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(SSD_INSTALLED_ROTATION),
    []
  );

  const flatQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(SSD_FLAT_ROTATION),
    []
  );

  const ssdClone = useMemo(() => {
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
    if (!ssdRef.current) return;

    ssdRef.current.scale.setScalar(ASSEMBLY_SCALE);

    if (isPlaced) {
      ssdRef.current.position.copy(SSD_FLOOR_POSITION);
      ssdRef.current.position.y = SSD_LOCKED_Y;
      ssdRef.current.quaternion.copy(flatQuat);
      setDetached(true);
      setSnapped(true);
    } else {
      ssdRef.current.position.copy(SSD_INSTALLED_POSITION);
      ssdRef.current.quaternion.copy(installedQuat);
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
      if (!ssdRef.current) return;

      updateMouse(e);

      if (!detached && !snapped) {
        setDetached(true);
        ssdRef.current.position.y = SSD_LOCKED_Y;
        ssdRef.current.quaternion.copy(flatQuat);
        return;
      }

      if (snapped) return;

      if (!dragging) {
        const normal = new THREE.Vector3();
        camera.getWorldDirection(normal);
        dragPlane.setFromNormalAndCoplanarPoint(normal, ssdRef.current.position);

        raycaster.setFromCamera(mouse.current, camera);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.copy(ssdRef.current.position).sub(hitPoint);
        }

        setDragging(true);
        document.body.style.cursor = "grabbing";
      } else {
        setDragging(false);
        document.body.style.cursor = "default";

        const dist = ssdRef.current.position.distanceTo(SSD_FLOOR_POSITION);
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
    if (!ssdRef.current) return;

    if (!detached && !snapped) {
      ssdRef.current.position.lerp(SSD_INSTALLED_POSITION, 0.2);
      ssdRef.current.quaternion.slerp(installedQuat, 0.2);
    } else if (snapped) {
      ssdRef.current.position.lerp(SSD_FLOOR_POSITION, 0.28);
      ssdRef.current.position.y = SSD_LOCKED_Y;
      ssdRef.current.quaternion.slerp(flatQuat, 0.28);
    } else {
      if (dragging) {
        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          const target = hitPoint.clone().add(dragOffset.current);
          target.y = SSD_LOCKED_Y;
          ssdRef.current.position.lerp(target, 0.35);
        }
      }

      ssdRef.current.position.y = SSD_LOCKED_Y;

      const dist = ssdRef.current.position.distanceTo(SSD_FLOOR_POSITION);

      if (dist < MAGNET_DISTANCE) {
        const t = 1 - dist / MAGNET_DISTANCE;
        const pull = MAGNET_STRENGTH + t * 0.22;

        ssdRef.current.position.lerp(SSD_FLOOR_POSITION, pull);
        ssdRef.current.position.y = SSD_LOCKED_Y;
        ssdRef.current.quaternion.slerp(flatQuat, pull);

        if (dist < SNAP_DISTANCE) {
          setSnapped(true);
          setDragging(false);
          document.body.style.cursor = "default";
          onPlaced?.();
        }
      } else {
        ssdRef.current.quaternion.slerp(flatQuat, 0.2);
      }
    }
  });

  return (
    <group>
      <group ref={ssdRef}>
        <primitive object={ssdClone} />
      </group>

      {snapped && (
        <ResetSSDButton
          onReset={() => {
            if (!ssdRef.current) return;

            ssdRef.current.position.copy(SSD_INSTALLED_POSITION);
            ssdRef.current.quaternion.copy(installedQuat);
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

function ResetSSDButton({ onReset }) {
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
        Reset SSD
      </button>
    </Html>
  );
}

/** ================= EXPORT ================= */

export default function DisassemblySSD({ placementApi, onComplete }) {
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

useGLTF.preload(CASE_URL);
useGLTF.preload(MB_URL);
useGLTF.preload(CPU_URL);
useGLTF.preload(RAM_URL);
useGLTF.preload(SSD_URL);
useGLTF.preload(HDD_URL);
useGLTF.preload(PSU_URL);
