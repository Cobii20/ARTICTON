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
const CASE_URL = "/models/PC CASE(BLENDER).glb";

/** PC Case */
const CASE_POSITION = new THREE.Vector3(0, -15, 0);
const CASE_ROTATION = new THREE.Euler(0, 0, 0);

/** ================= MOTHERBOARD ASSEMBLY SYSTEM ================= */

// Keep the seated same
const MB_SEATED_POSITION = new THREE.Vector3(-0.6, -0.6, 2.99);
const MB_START_POSITION = new THREE.Vector3(-0.1, -0.6, 30);
const MB_ROTATION = new THREE.Euler(Math.PI * 2, 0, -Math.PI / 2);

/** Interaction */
const SNAP_DISTANCE = 0.12; // tighter snap
const MAGNET_DISTANCE = 1.2; // slightly larger field
const MAGNET_STRENGTH = 2; // stronger pull

/** Scale */
const CASE_SCALE = 1;
const ASSEMBLY_SCALE = 1;

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
      <MotherboardAssemblyDraggable />

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
      position={CASE_POSITION}
      rotation={CASE_ROTATION.toArray()}
    >
      <primitive object={clonedScene} />
    </group>
  );
}

/* ================= MOTHERBOARD ASSEMBLY ================= */

function MotherboardAssemblyDraggable() {
  const mbGltf = useGLTF(MB_URL);
  const cpuGltf = useGLTF(CPU_URL);
  const ramGltf = useGLTF(RAM_URL);
  const ssdGltf = useGLTF(SSD_URL);

  const assemblyRef = useRef();
  const { camera, gl } = useThree();

  const [dragging, setDragging] = useState(false);
  const [snapped, setSnapped] = useState(false);
  const [assemblyPosition, setAssemblyPosition] = useState({ x: 0, y: 0, z: 0 });
  const [distance, setDistance] = useState(null);

  const dragOffset = useRef(new THREE.Vector3());
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const hitPoint = useRef(new THREE.Vector3());
  const dragPlane = useRef(new THREE.Plane());

  const startQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(MB_ROTATION),
    []
  );
  const seatedQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(MB_ROTATION),
    []
  );

  /** Create merged group with correct relative positions */
  const assembledGroup = useMemo(() => {
    const group = new THREE.Group();
    group.name = "MotherboardAssembly";

    // Motherboard
    const mbClone = mbGltf.scene.clone(true);
    mbClone.name = "Motherboard";
    group.add(mbClone);

    // CPU (aligned properly)
    const cpuClone = cpuGltf.scene.clone(true);
    cpuClone.name = "CPU";
    cpuClone.position.set(4.33, -0.6, -5.63);
    cpuClone.rotation.set(0, Math.PI / 2, 0);
    group.add(cpuClone);

    // RAM
    const ramClone = ramGltf.scene.clone(true);
    ramClone.name = "RAM";
    ramClone.position.set(-0.02, -5.86, 0.8);
    ramClone.rotation.set(0, 0, 0);
    group.add(ramClone);

    // SSD
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

  useEffect(() => {
    if (!assemblyRef.current) return;
    assemblyRef.current.position.copy(MB_START_POSITION);
    assemblyRef.current.quaternion.copy(startQuat);
    assemblyRef.current.scale.setScalar(ASSEMBLY_SCALE);
  }, [startQuat]);

  const updateMouse = useCallback(
    (ev) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    },
    [gl]
  );

  /** Toggle drag */
  useEffect(() => {
    const handleTap = (e) => {
      if (snapped) return;
      if (e.button !== 0) return;

      updateMouse(e);

      if (!dragging) {
        const planeNormal = new THREE.Vector3();
        camera.getWorldDirection(planeNormal);
        dragPlane.current.setFromNormalAndCoplanarPoint(
          planeNormal,
          assemblyRef.current.position
        );

        raycaster.current.setFromCamera(mouse.current, camera);
        if (
          raycaster.current.ray.intersectPlane(
            dragPlane.current,
            hitPoint.current
          )
        ) {
          dragOffset.current.copy(assemblyRef.current.position).sub(hitPoint.current);
        }
        setDragging(true);
        document.body.style.cursor = "grabbing";
      } else {
        setDragging(false);
        document.body.style.cursor = "default";
        const dist = assemblyRef.current.position.distanceTo(MB_SEATED_POSITION);
        if (dist < SNAP_DISTANCE * 2) setSnapped(true);
      }
    };

    gl.domElement.addEventListener("pointerdown", handleTap);
    return () => gl.domElement.removeEventListener("pointerdown", handleTap);
  }, [dragging, snapped, gl, camera, updateMouse]);

  /** update mouse */
  useEffect(() => {
    const move = (e) => updateMouse(e);
    gl.domElement.addEventListener("pointermove", move);
    return () => gl.domElement.removeEventListener("pointermove", move);
  }, [gl, updateMouse]);

  /** prevent right-click */
  useEffect(() => {
    const preventContextMenu = (e) => e.preventDefault();
    gl.domElement.addEventListener("contextmenu", preventContextMenu);
    return () => gl.domElement.removeEventListener("contextmenu", preventContextMenu);
  }, [gl]);

  /** Animation and snapping logic */
  useFrame(() => {
    if (!assemblyRef.current) return;

    const worldPos = new THREE.Vector3();
    assemblyRef.current.getWorldPosition(worldPos);
    setAssemblyPosition({ x: worldPos.x, y: worldPos.y, z: worldPos.z });

    if (snapped) {
      assemblyRef.current.position.lerp(MB_SEATED_POSITION, 0.25);
      assemblyRef.current.quaternion.slerp(seatedQuat, 0.25);
      assemblyRef.current.position.x = -0.6; // keep locked even after snap
      return;
    }

    if (dragging) {
      raycaster.current.setFromCamera(mouse.current, camera);
      if (
        raycaster.current.ray.intersectPlane(
          dragPlane.current,
          hitPoint.current
        )
      ) {
        const target = hitPoint.current.clone().add(dragOffset.current);

        // 🔒 Constrain X position to -0.6
        target.x = -0.6;

        assemblyRef.current.position.lerp(target, 0.3);
      }
    }

    const dist = assemblyRef.current.position.distanceTo(MB_SEATED_POSITION);
    setDistance(dragging ? dist : null);

    if (!snapped && dist < MAGNET_DISTANCE) {
      const t = 1 - dist / MAGNET_DISTANCE;
      const pull = MAGNET_STRENGTH * (t * t + 0.2); // smooth magnetic curve
      assemblyRef.current.position.lerp(MB_SEATED_POSITION, pull);
      assemblyRef.current.position.x = -0.6; // keep X locked during magnet snap
      if (dist < SNAP_DISTANCE) {
        setSnapped(true);
        setDragging(false);
        document.body.style.cursor = "default";
      }
    }
  });

  return (
    <group>
      <group ref={assemblyRef}>
        <primitive object={assembledGroup} />

        <Html position={[0, 2, 0]} center>
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
              Motherboard Assembly
            </div>
            <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>
              (CPU + RAM + SSD attached)
            </div>
            <div>
              {snapped
                ? "Installed in Case"
                : dragging
                ? "Dragging Assembly"
                : "Click to Grab"}
            </div>
            <div style={{ marginTop: 6 }}>────────</div>
            <div>x: {assemblyPosition.x.toFixed(2)}</div>
            <div>y: {assemblyPosition.y.toFixed(2)}</div>
            <div>z: {assemblyPosition.z.toFixed(2)}</div>
            {distance && <div style={{ marginTop: 4 }}>d: {distance.toFixed(2)}</div>}
          </div>
        </Html>
      </group>

      {snapped && (
        <ResetAssemblyButton
          assemblyRef={assemblyRef}
          startPos={MB_START_POSITION}
          startQuat={startQuat}
          onReset={() => setSnapped(false)}
        />
      )}
    </group>
  );
}

/* ================= RESET BUTTON ================= */

function ResetAssemblyButton({ assemblyRef, startPos, startQuat, onReset }) {
  const { gl } = useThree();

  return (
    <Html position={[-2, 2, 0]} style={{ pointerEvents: "auto" }}>
      <button
        onClick={() => {
          if (!assemblyRef.current) return;
          assemblyRef.current.position.copy(startPos);
          assemblyRef.current.quaternion.copy(startQuat);
          assemblyRef.current.position.x = -0.6; // keep locked after reset
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
        Reset Assembly
      </button>
    </Html>
  );
}

/* ================= EXPORT ================= */

export default function MBtoCaseScene() {
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
useGLTF.preload(CASE_URL);