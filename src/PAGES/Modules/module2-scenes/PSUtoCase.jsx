import React, { useMemo, useRef, useState, useEffect } from "react";
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
const PSU_URL = "/models/PSU(BLENDER).glb";
const CPU_URL = "/models/CPU(BLENDER).glb";
const MB_URL = "/models/MB(BLENDER).glb";
const RAM_URL = "/models/RAM(BLENDER).glb";
const SSD_URL = "/models/SSD(BLENDER).glb";
const CASE_URL = "/models/PC CASE(BLENDER).glb";

/** BASE SETTINGS */
const CASE_POSITION = new THREE.Vector3(0, -15, 0);
const CASE_ROTATION = new THREE.Euler(0, 0, 0);

const SNAP_DISTANCE = 0.12;
const MAGNET_DISTANCE = 1.4;
const MAGNET_STRENGTH = 1.8;

const CASE_SCALE = 1;
const ASSEMBLY_SCALE = 1;

/** PSU CONFIG */
const PSU_LOCK_X = 4.27;
const PSU_LOCK_Y = -15.66;
const PSU_SEATED_POSITION = new THREE.Vector3(4.27, -15.66, 6.22);
const PSU_START_POSITION = new THREE.Vector3(4.27, -15.66, 15);
const PSU_ROTATION = new THREE.Euler(0, Math.PI, 0);

/** ================= SCENE ================= */

function Scene() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 10, 25);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <>
      <color attach="background" args={["#05080D"]} />
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
      <PSUDraggable />

      <ContactShadows
        position={[0, -0.02, 0]}
        opacity={0.35}
        scale={13}
        blur={2.8}
        far={6}
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={15}
        maxDistance={40}
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

/** ================= MOTHERBOARD ASSEMBLY (SEATED) ================= */

function MotherboardAssemblySeated() {
  const mbGltf = useGLTF(MB_URL);
  const cpuGltf = useGLTF(CPU_URL);
  const ramGltf = useGLTF(RAM_URL);
  const ssdGltf = useGLTF(SSD_URL);

  const seatedGroup = useMemo(() => {
    const group = new THREE.Group();
    group.name = "MotherboardAssembly_Seated";

    // Motherboard
    const mb = mbGltf.scene.clone(true);
    mb.position.set(-0.6, -0.6, 2.99);
    mb.rotation.set(0, 0, -Math.PI / 2);
    group.add(mb);

    // CPU
    const cpu = cpuGltf.scene.clone(true);
    cpu.position.set(-1.25, -4.95, -2.66);
    cpu.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
    group.add(cpu);

    // RAM
    const ram = ramGltf.scene.clone(true);
    ram.position.set(-6.44, -0.59, 3.79);
    ram.rotation.set(0, 0, -Math.PI / 2);
    group.add(ram);

    // SSD
    const ssd = ssdGltf.scene.clone(true);
    ssd.position.set(-2.75, -0.66, -6.24);
    ssd.rotation.set(0, 0, -Math.PI / 2);
    group.add(ssd);

    group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    return group;
  }, [mbGltf.scene, cpuGltf.scene, ramGltf.scene, ssdGltf.scene]);

  return <primitive object={seatedGroup} />;
}

/** ================= PSU DRAGGABLE ================= */

function PSUDraggable() {
  const { gl, camera } = useThree();
  const { scene } = useGLTF(PSU_URL);
  const psuRef = useRef();

  const [dragging, setDragging] = useState(false);
  const [snapped, setSnapped] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, z: 0 });
  const [distance, setDistance] = useState(null);

  const dragOffset = useRef(new THREE.Vector3());
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useRef(new THREE.Vector2());
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(() => new THREE.Plane(), []);

  const startQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(PSU_ROTATION),
    []
  );
  const seatedQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(PSU_ROTATION),
    []
  );

  useEffect(() => {
    if (!psuRef.current) return;
    psuRef.current.position.copy(PSU_START_POSITION);
    psuRef.current.quaternion.copy(startQuat);
    psuRef.current.scale.setScalar(ASSEMBLY_SCALE);
  }, [startQuat]);

  const updateMouse = React.useCallback((ev) => {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  }, [gl]);

  useEffect(() => {
    const handleClick = (e) => {
      if (snapped) return;
      if (e.button !== 0) return;

      updateMouse(e);

      if (!dragging) {
        const normal = new THREE.Vector3();
        camera.getWorldDirection(normal);
        dragPlane.setFromNormalAndCoplanarPoint(normal, psuRef.current.position);

        raycaster.setFromCamera(mouse.current.current, camera);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.copy(psuRef.current.position).sub(hitPoint);
        }

        setDragging(true);
        document.body.style.cursor = "grabbing";
      } else {
        setDragging(false);
        document.body.style.cursor = "default";

        const dist = psuRef.current.position.distanceTo(PSU_SEATED_POSITION);
        if (dist < SNAP_DISTANCE * 2) setSnapped(true);
      }
    };

    gl.domElement.addEventListener("pointerdown", handleClick);
    return () => gl.domElement.removeEventListener("pointerdown", handleClick);
  }, [dragging, snapped, gl, camera, dragPlane, raycaster, hitPoint, updateMouse]);

  useEffect(() => {
    const move = (e) => updateMouse(e);
    gl.domElement.addEventListener("pointermove", move);
    return () => gl.domElement.removeEventListener("pointermove", move);
  }, [gl, updateMouse]);

  useEffect(() => {
    const preventContext = (e) => e.preventDefault();
    gl.domElement.addEventListener("contextmenu", preventContext);
    return () =>
      gl.domElement.removeEventListener("contextmenu", preventContext);
  }, [gl]);

  useFrame(() => {
    if (!psuRef.current) return;

    if (snapped) {
      setDistance(null);
      psuRef.current.position.lerp(PSU_SEATED_POSITION, 0.25);
      psuRef.current.quaternion.slerp(seatedQuat, 0.25);
      psuRef.current.position.x = PSU_LOCK_X;
      psuRef.current.position.y = PSU_LOCK_Y;
    } else {
      if (dragging) {
        raycaster.setFromCamera(mouse.current, camera);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          const target = hitPoint.clone().add(dragOffset.current);
          target.x = PSU_LOCK_X;
          target.y = PSU_LOCK_Y;
          psuRef.current.position.lerp(target, 0.3);
        }
      }

      // Keep PSU locked on X and Y at all times while moving.
      psuRef.current.position.x = PSU_LOCK_X;
      psuRef.current.position.y = PSU_LOCK_Y;

      const dist = psuRef.current.position.distanceTo(PSU_SEATED_POSITION);
      setDistance(dragging ? dist : null);

      if (dist < MAGNET_DISTANCE) {
        const t = 1 - dist / MAGNET_DISTANCE;
        const pull = MAGNET_STRENGTH * (t * t + 0.2);
        psuRef.current.position.lerp(PSU_SEATED_POSITION, pull);
        psuRef.current.position.x = PSU_LOCK_X;
        psuRef.current.position.y = PSU_LOCK_Y;

        if (dist < SNAP_DISTANCE) {
          setSnapped(true);
          setDragging(false);
          document.body.style.cursor = "default";
        }
      }
    }

    const worldPos = new THREE.Vector3();
    psuRef.current.getWorldPosition(worldPos);
    setPos({ x: worldPos.x, y: worldPos.y, z: worldPos.z });
  });

  return (
    <group>
      <group ref={psuRef}>
        <primitive object={scene.clone(true)} />

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
              Power Supply Unit (PSU)
            </div>
            <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>
              Click to drag into the case
            </div>
            <div>
              {snapped
                ? "Installed in Case"
                : dragging
                ? "Dragging PSU"
                : "Click to Grab"}
            </div>
            <div style={{ marginTop: 6 }}>────────</div>
            <div>x: {pos.x.toFixed(2)}</div>
            <div>y: {pos.y.toFixed(2)}</div>
            <div>z: {pos.z.toFixed(2)}</div>
            {distance && (
              <div style={{ marginTop: 4 }}>d: {distance.toFixed(2)}</div>
            )}
          </div>
        </Html>
      </group>

      {snapped && (
        <ResetPSUButton
          onReset={() => {
            if (!psuRef.current) return;
            psuRef.current.position.copy(PSU_START_POSITION);
            psuRef.current.quaternion.copy(startQuat);
            psuRef.current.position.x = PSU_LOCK_X;
            psuRef.current.position.y = PSU_LOCK_Y;
            setSnapped(false);
          }}
        />
      )}
    </group>
  );
}

/** ================= RESET BUTTON ================= */

function ResetPSUButton({ onReset }) {
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
        Reset PSU
      </button>
    </Html>
  );
}

/** ================= EXPORT ================= */

export default function PSUtoCaseScene() {
  return (
    <Canvas
      style={{ width: "100%", height: "100%" }}
      camera={{ position: [0, 10, 25], fov: 50 }}
    >
      <Scene />
    </Canvas>
  );
}

// Preload models
useGLTF.preload(PSU_URL);
useGLTF.preload(MB_URL);
useGLTF.preload(CPU_URL);
useGLTF.preload(RAM_URL);
useGLTF.preload(SSD_URL);
useGLTF.preload(CASE_URL);