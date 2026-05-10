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

/** RAM — already seated/placed, static in this scene */
const RAM_SEATED_POSITION = new THREE.Vector3(13.73, -24.61, 9.06);
const RAM_SEATED_ROTATION = new THREE.Euler(Math.PI / 2, 0, 0);

/** HDD — already seated/placed, static in this scene */
const HDD_SEATED_POSITION = new THREE.Vector3(15.50, -16.06, 10.96);
const HDD_SEATED_ROTATION = new THREE.Euler(0, 0, 0);

/** SSD — already seated/placed, static in this scene */
const SSD_SEATED_POSITION = new THREE.Vector3(12.94, -17.21, 7.36);
const SSD_SEATED_ROTATION = new THREE.Euler(0, 0, 0);

/** PSU — already seated/placed, static in this scene */
const PSU_SEATED_POSITION = new THREE.Vector3(19.38, -15.81, 11.75);
const PSU_SEATED_ROTATION = new THREE.Euler(0, Math.PI, 0);

/** CPU installed start position inside the case */
const CPU_INSTALLED_POSITION = new THREE.Vector3(-1.25, -4.95, -2.66);
const CPU_INSTALLED_ROTATION = new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2);

/** CPU flat rotation after detached */
const CPU_FLAT_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);

/** CPU seated position on the checkerboard */
const CPU_LOCKED_Y = -15.8;
const CPU_FLOOR_POSITION = new THREE.Vector3(17.49, CPU_LOCKED_Y, 0.3);

/** GUIDE BOARD */
const BOARD_Y = -14.95;
const BOARD_CENTER_X = 24;
const BOARD_CENTER_Z = 6.5;
const BOARD_SIZE = 22;
const GRID_DIVISIONS = 11;
const CELL_SIZE = BOARD_SIZE / GRID_DIVISIONS;

/** CPU ring anchor */
const CPU_RING_POSITION = new THREE.Vector3(
  CPU_FLOOR_POSITION.x,
  BOARD_Y + 0.03,
  CPU_FLOOR_POSITION.z
);

/** ================= SCENE ================= */

function Scene({ placementApi, onComplete }) {
  const { camera } = useThree();
  const snapped = placementApi?.placements?.cpuPlaced ?? false;
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

      <CPUDraggable
        isPlaced={snapped}
        onPlaced={() => placementApi?.setPlaced?.("cpuPlaced")}
        onResetPlaced={() => placementApi?.resetPlaced?.("cpuPlaced")}
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

    if (outerRef.current) {
      outerRef.current.material.opacity = 0.4 + t * 0.55;
    }

    if (innerFillRef.current) {
      innerFillRef.current.material.opacity = 0.12 + t * 0.22;
    }
  });

  return (
    <group
      position={[CPU_RING_POSITION.x, CPU_RING_POSITION.y, CPU_RING_POSITION.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <mesh ref={innerFillRef}>
        <planeGeometry args={[CELL_SIZE * 0.72, CELL_SIZE * 0.72]} />
        <meshBasicMaterial color="#b56dff" transparent opacity={0.15} />
      </mesh>

      <mesh ref={outerRef} position={[0, 0, 0.01]}>
        <ringGeometry args={[0.35, 0.68, 48]} />
        <meshBasicMaterial color="#b56dff" transparent opacity={0.9} />
      </mesh>

      <mesh position={[0, 0, 0.02]}>
        <ringGeometry args={[0.14, 0.30, 48]} />
        <meshBasicMaterial color="#b56dff" transparent opacity={0.5} />
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
    <group
      scale={CASE_SCALE}
      position={CASE_POSITION}
      rotation={CASE_ROTATION.toArray()}
    >
      <primitive object={caseClone} />
    </group>
  );
}

/** ================= STATIC ASSEMBLY ================= */

function MotherboardAssemblySeated() {
  const mbGltf = useGLTF(MB_URL);
  const ramGltf = useGLTF(RAM_URL);
  const hddGltf = useGLTF(HDD_URL);
  const ssdGltf = useGLTF(SSD_URL);
  const psuGltf = useGLTF(PSU_URL);

  const seatedGroup = useMemo(() => {
    const group = new THREE.Group();

    const mb = mbGltf.scene.clone(true);
    mb.position.copy(MB_POSITION);
    mb.rotation.copy(MB_ROTATION);
    group.add(mb);

    const ram = ramGltf.scene.clone(true);
    ram.position.copy(RAM_SEATED_POSITION);
    ram.rotation.copy(RAM_SEATED_ROTATION);
    group.add(ram);

    const hdd = hddGltf.scene.clone(true);
    hdd.position.copy(HDD_SEATED_POSITION);
    hdd.rotation.copy(HDD_SEATED_ROTATION);
    group.add(hdd);

    const ssd = ssdGltf.scene.clone(true);
    ssd.position.copy(SSD_SEATED_POSITION);
    ssd.rotation.copy(SSD_SEATED_ROTATION);
    group.add(ssd);

    const psu = psuGltf.scene.clone(true);
    psu.position.copy(PSU_SEATED_POSITION);
    psu.rotation.copy(PSU_SEATED_ROTATION);
    group.add(psu);

    group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    return group;
  }, [
    mbGltf.scene,
    ramGltf.scene,
    hddGltf.scene,
    ssdGltf.scene,
    psuGltf.scene,
  ]);

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
          border: "1px solid rgba(181,109,255,.28)",
          backdropFilter: "blur(8px)",
          color: "rgba(234,240,255,.95)",
          fontSize: 12,
          fontFamily: "monospace",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>CPU</div>
        <div style={{ marginBottom: 8 }}>{text}</div>
        <div>x: {pos.x.toFixed(2)}</div>
        <div>y: {pos.y.toFixed(2)}</div>
        <div>z: {pos.z.toFixed(2)}</div>
      </div>
    </Html>
  );
}

/** ================= CPU DRAGGABLE ================= */

function CPUDraggable({ isPlaced = false, onPlaced, onResetPlaced }) {
  const { scene } = useGLTF(CPU_URL);
  const { gl, camera } = useThree();

  const cpuRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [detached, setDetached] = useState(isPlaced);
  const [snapped, setSnapped] = useState(isPlaced);
  const [pos, setPos] = useState({
    x: CPU_INSTALLED_POSITION.x,
    y: CPU_INSTALLED_POSITION.y,
    z: CPU_INSTALLED_POSITION.z,
  });

  const dragOffset = useRef(new THREE.Vector3());
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useRef(new THREE.Vector2());
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(() => new THREE.Plane(), []);

  const installedQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(CPU_INSTALLED_ROTATION),
    []
  );

  const flatQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(CPU_FLAT_ROTATION),
    []
  );

  const cpuClone = useMemo(() => {
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
    if (!cpuRef.current) return;

    cpuRef.current.scale.setScalar(ASSEMBLY_SCALE);

    if (isPlaced) {
      cpuRef.current.position.copy(CPU_FLOOR_POSITION);
      cpuRef.current.position.y = CPU_LOCKED_Y;
      cpuRef.current.quaternion.copy(flatQuat);
      setDetached(true);
      setSnapped(true);
    } else {
      cpuRef.current.position.copy(CPU_INSTALLED_POSITION);
      cpuRef.current.quaternion.copy(installedQuat);
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
      if (!cpuRef.current) return;

      updateMouse(e);

      if (!detached && !snapped) {
        setDetached(true);
        cpuRef.current.position.y = CPU_LOCKED_Y;
        cpuRef.current.quaternion.copy(flatQuat);
        return;
      }

      if (snapped) return;

      if (!dragging) {
        const normal = new THREE.Vector3();

        camera.getWorldDirection(normal);
        dragPlane.setFromNormalAndCoplanarPoint(normal, cpuRef.current.position);

        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.copy(cpuRef.current.position).sub(hitPoint);
        }

        setDragging(true);
        document.body.style.cursor = "grabbing";
      } else {
        setDragging(false);
        document.body.style.cursor = "default";

        const dist = cpuRef.current.position.distanceTo(CPU_FLOOR_POSITION);

        if (dist < SNAP_DISTANCE * 1.25) {
          setSnapped(true);
          onPlaced?.();
        }
      }
    };

    gl.domElement.addEventListener("pointerdown", handleClick);

    return () => {
      gl.domElement.removeEventListener("pointerdown", handleClick);
    };
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

    return () => {
      gl.domElement.removeEventListener("pointermove", move);
    };
  }, [gl, updateMouse]);

  useEffect(() => {
    const preventContext = (e) => e.preventDefault();

    gl.domElement.addEventListener("contextmenu", preventContext);

    return () => {
      gl.domElement.removeEventListener("contextmenu", preventContext);
    };
  }, [gl]);

  useFrame(() => {
    if (!cpuRef.current) return;

    if (!detached && !snapped) {
      cpuRef.current.position.lerp(CPU_INSTALLED_POSITION, 0.2);
      cpuRef.current.quaternion.slerp(installedQuat, 0.2);
    } else if (snapped) {
      cpuRef.current.position.lerp(CPU_FLOOR_POSITION, 0.28);
      cpuRef.current.position.y = CPU_LOCKED_Y;
      cpuRef.current.quaternion.slerp(flatQuat, 0.28);
    } else {
      if (dragging) {
        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          const target = hitPoint.clone().add(dragOffset.current);

          target.y = CPU_LOCKED_Y;
          cpuRef.current.position.lerp(target, 0.35);
        }
      }

      cpuRef.current.position.y = CPU_LOCKED_Y;

      const dist = cpuRef.current.position.distanceTo(CPU_FLOOR_POSITION);

      if (dist < MAGNET_DISTANCE) {
        const t = 1 - dist / MAGNET_DISTANCE;
        const pull = MAGNET_STRENGTH + t * 0.22;

        cpuRef.current.position.lerp(CPU_FLOOR_POSITION, pull);
        cpuRef.current.position.y = CPU_LOCKED_Y;
        cpuRef.current.quaternion.slerp(flatQuat, pull);

        if (dist < SNAP_DISTANCE) {
          setSnapped(true);
          setDragging(false);
          document.body.style.cursor = "default";
          onPlaced?.();
        }
      } else {
        cpuRef.current.quaternion.slerp(flatQuat, 0.2);
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

      <SideStatus
        detached={detached}
        dragging={dragging}
        snapped={snapped}
        pos={pos}
      />

      {snapped && (
        <ResetCPUButton
          onReset={() => {
            if (!cpuRef.current) return;

            cpuRef.current.position.copy(CPU_INSTALLED_POSITION);
            cpuRef.current.quaternion.copy(installedQuat);

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

function ResetCPUButton({ onReset }) {
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
        Reset CPU
      </button>
    </Html>
  );
}

/** ================= EXPORT ================= */

export default function DisassemblyCPU({ placementApi, onComplete }) {
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