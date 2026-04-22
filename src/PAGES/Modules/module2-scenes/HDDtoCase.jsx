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
const CPU_URL = "/models/CPU(BLENDER).glb";
const MB_URL = "/models/MB(BLENDER).glb";
const RAM_URL = "/models/RAM(BLENDER).glb";
const SSD_URL = "/models/SSD(BLENDER).glb";
const HDD_URL = "/models/HDD(BLENDER).glb";
const CASE_URL = "/models/PC CASE(BLENDER).glb";

/** PC Case */
const CASE_POSITION = new THREE.Vector3(0, -15, 0);
const CASE_ROTATION = new THREE.Euler(0, 0, 0);

/** ================= MOTHERBOARD ASSEMBLY (SEATED) ================= */
const MB_SEATED_POSITION = new THREE.Vector3(-0.6, -0.6, 2.99);
const MB_ROTATION = new THREE.Euler(Math.PI * 2, 0, -Math.PI / 2);

/** ================= HDD SYSTEM ================= */
const HDD_LOCK_X = 4.16;
const HDD_LOCK_Y = -14.32;
const HDD_SEATED_POSITION = new THREE.Vector3(4.16, -14.32, -0.49);
const HDD_START_POSITION = new THREE.Vector3(4.16, -14.32, 15);
const HDD_ROTATION = new THREE.Euler(0, 0, 0);

/** Interaction */
const SNAP_DISTANCE = 0.12;
const MAGNET_DISTANCE = 1.2;
const MAGNET_STRENGTH = 2;

/** Scale */
const CASE_SCALE = 1;
const ASSEMBLY_SCALE = 1;
const HDD_SCALE = 1;

/* ================= SCENE ================= */

function Scene() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 10, 20);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  return (
    <>
      <color attach="background" args={["#070A0F"]} />

      <ambientLight intensity={0.45} />
      <directionalLight
        position={[4, 8, 4]}
        intensity={1.35}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-3, 1.5, -2]} intensity={0.65} />

      <Environment preset="city" />

      <PCCase />
      <MotherboardAssemblySeated />
      <HddDraggable />

      <ContactShadows
        position={[0, -0.02, 0]}
        opacity={0.35}
        scale={12}
        blur={2.8}
        far={6}
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={15}
        maxDistance={60}
        target={[0, 0, 0]}
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

/* ================= PC CASE ================= */

function PCCase() {
  const { scene } = useGLTF(CASE_URL);

  const clonedScene = useMemo(() => {
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
      position={[CASE_POSITION.x, CASE_POSITION.y, CASE_POSITION.z]}
      rotation={[CASE_ROTATION.x, CASE_ROTATION.y, CASE_ROTATION.z]}
    >
      <primitive object={clonedScene} />
    </group>
  );
}

/* ================= MOTHERBOARD ASSEMBLY (SEATED) ================= */

function MotherboardAssemblySeated() {
  const mbGltf = useGLTF(MB_URL);
  const cpuGltf = useGLTF(CPU_URL);
  const ramGltf = useGLTF(RAM_URL);
  const ssdGltf = useGLTF(SSD_URL);

  const assembledGroup = useMemo(() => {
    const group = new THREE.Group();
    group.name = "MotherboardAssembly_Seated";

    const mbClone = mbGltf.scene.clone(true);
    mbClone.name = "Motherboard";
    group.add(mbClone);

    const cpuClone = cpuGltf.scene.clone(true);
    cpuClone.name = "CPU";
    cpuClone.position.set(4.33, -0.6, -5.63);
    cpuClone.rotation.set(0, Math.PI / 2, 0);
    group.add(cpuClone);

    const ramClone = ramGltf.scene.clone(true);
    ramClone.name = "RAM";
    ramClone.position.set(-0.02, -5.86, 0.8);
    ramClone.rotation.set(0, 0, 0);
    group.add(ramClone);

    const ssdClone = ssdGltf.scene.clone(true);
    ssdClone.name = "SSD";
    ssdClone.position.set(Math.PI / 64, -2.15, -9);
    ssdClone.rotation.set(0, 0, 0);
    group.add(ssdClone);

    group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    return group;
  }, [mbGltf.scene, cpuGltf.scene, ramGltf.scene, ssdGltf.scene]);

  return (
    <group
      scale={ASSEMBLY_SCALE}
      position={[MB_SEATED_POSITION.x, MB_SEATED_POSITION.y, MB_SEATED_POSITION.z]}
      rotation={[MB_ROTATION.x, MB_ROTATION.y, MB_ROTATION.z]}
    >
      <primitive object={assembledGroup} />
    </group>
  );
}

/* ================= HDD DRAGGABLE ================= */

function HddDraggable() {
  const { scene } = useGLTF(HDD_URL);
  const hddRef = useRef();
  const { camera, gl } = useThree();

  const [dragging, setDragging] = useState(false);
  const [snapped, setSnapped] = useState(false);
  const [hddPosition, setHddPosition] = useState({ x: 0, y: 0, z: 0 });
  const [distance, setDistance] = useState(null);

  const dragOffset = useRef(new THREE.Vector3());
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useRef(new THREE.Vector2());
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(() => new THREE.Plane(), []);

  const startQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(HDD_ROTATION),
    []
  );
  const seatedQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(HDD_ROTATION),
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
    hddRef.current.position.copy(HDD_START_POSITION);
    hddRef.current.quaternion.copy(startQuat);
    hddRef.current.scale.setScalar(HDD_SCALE);
  }, [startQuat]);

  const updateMouse = useCallback((ev) => {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  }, [gl]);

  useEffect(() => {
    const handleTap = (e) => {
      if (snapped) return;
      if (e.button !== 0) return;

      updateMouse(e);

      if (!dragging) {
        const planeNormal = new THREE.Vector3();
        camera.getWorldDirection(planeNormal);
        dragPlane.setFromNormalAndCoplanarPoint(
          planeNormal,
          hddRef.current.position
        );

        raycaster.setFromCamera(mouse.current, camera);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.copy(hddRef.current.position).sub(hitPoint);
        }

        setDragging(true);
        document.body.style.cursor = "grabbing";
      } else {
        setDragging(false);
        document.body.style.cursor = "default";

        const dist = hddRef.current.position.distanceTo(HDD_SEATED_POSITION);
        if (dist < SNAP_DISTANCE * 2) setSnapped(true);
      }
    };

    gl.domElement.addEventListener("pointerdown", handleTap);
    return () => gl.domElement.removeEventListener("pointerdown", handleTap);
  }, [dragging, snapped, gl, camera, dragPlane, raycaster, hitPoint, updateMouse]);

  useEffect(() => {
    const move = (e) => updateMouse(e);
    gl.domElement.addEventListener("pointermove", move);
    return () => gl.domElement.removeEventListener("pointermove", move);
  }, [gl, updateMouse]);

  useEffect(() => {
    const preventContextMenu = (e) => e.preventDefault();
    gl.domElement.addEventListener("contextmenu", preventContextMenu);
    return () =>
      gl.domElement.removeEventListener("contextmenu", preventContextMenu);
  }, [gl]);

  useFrame(() => {
    if (!hddRef.current) return;

    if (snapped) {
      hddRef.current.position.lerp(HDD_SEATED_POSITION, 0.25);
      hddRef.current.quaternion.slerp(seatedQuat, 0.25);
      hddRef.current.position.x = HDD_LOCK_X;
      hddRef.current.position.y = HDD_LOCK_Y;
      setDistance(null);
    } else {
      if (dragging) {
        raycaster.setFromCamera(mouse, camera);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          const target = hitPoint.clone().add(dragOffset.current);
          target.x = HDD_LOCK_X;
          target.y = HDD_LOCK_Y;
          hddRef.current.position.lerp(target, 0.3);
        }
      }

      hddRef.current.position.x = HDD_LOCK_X;
      hddRef.current.position.y = HDD_LOCK_Y;

      const dist = hddRef.current.position.distanceTo(HDD_SEATED_POSITION);
      setDistance(dragging ? dist : null);

      if (!snapped && dist < MAGNET_DISTANCE) {
        const t = 1 - dist / MAGNET_DISTANCE;
        const pull = MAGNET_STRENGTH * (t * t + 0.2);
        hddRef.current.position.lerp(HDD_SEATED_POSITION, pull);
        hddRef.current.position.x = HDD_LOCK_X;
        hddRef.current.position.y = HDD_LOCK_Y;

        if (dist < SNAP_DISTANCE) {
          setSnapped(true);
          setDragging(false);
          document.body.style.cursor = "default";
        }
      }
    }

    const worldPos = new THREE.Vector3();
    hddRef.current.getWorldPosition(worldPos);
    setHddPosition({ x: worldPos.x, y: worldPos.y, z: worldPos.z });
  });

  return (
    <group>
      <group ref={hddRef}>
        <primitive object={hddClone} />

        <Html position={[-10, 2.4, 0]} center>
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              background: "rgba(10,14,22,.72)",
              border: "1px solid rgba(140,255,230,.22)",
              backdropFilter: "blur(8px)",
              color: "rgba(234,240,255,.95)",
              fontSize: 12,
              fontFamily: "monospace",
              textAlign: "center",
              minWidth: 160,
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: 4 }}>
              Hard Disk Drive (HDD)
            </div>
            <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>
              Click to drag into the case
            </div>
            <div>
              {snapped
                ? "Installed in Case"
                : dragging
                ? "Dragging HDD"
                : "Click to Grab"}
            </div>
            <div style={{ marginTop: 6 }}>────────</div>
            <div>x: {hddPosition.x.toFixed(2)}</div>
            <div>y: {hddPosition.y.toFixed(2)}</div>
            <div>z: {hddPosition.z.toFixed(2)}</div>
            {distance !== null && (
              <div style={{ marginTop: 4 }}>d: {distance.toFixed(2)}</div>
            )}
          </div>
        </Html>
      </group>

      {snapped && (
        <ResetHddButton
          hddRef={hddRef}
          startPos={HDD_START_POSITION}
          startQuat={startQuat}
          onReset={() => setSnapped(false)}
        />
      )}
    </group>
  );
}

/* ================= RESET BUTTON ================= */

function ResetHddButton({ hddRef, startPos, startQuat, onReset }) {
  const { gl } = useThree();

  return (
    <Html position={[-2, 2, 0]} style={{ pointerEvents: "auto" }}>
      <button
        onClick={() => {
          if (!hddRef.current) return;
          hddRef.current.position.copy(startPos);
          hddRef.current.quaternion.copy(startQuat);
          hddRef.current.position.x = HDD_LOCK_X;
          hddRef.current.position.y = HDD_LOCK_Y;
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

/* ================= EXPORT ================= */

export default function HDDtoCaseScene() {
  return (
    <Canvas
      style={{ width: "100%", height: "100%" }}
      camera={{ position: [0, 10, 20], fov: 50 }}
    >
      <Scene />
    </Canvas>
  );
}

// Preload models
useGLTF.preload(CPU_URL);
useGLTF.preload(MB_URL);
useGLTF.preload(RAM_URL);
useGLTF.preload(SSD_URL);
useGLTF.preload(HDD_URL);
useGLTF.preload(CASE_URL);