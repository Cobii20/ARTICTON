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
const CPU_URL = "/models/CPU(BLENDER).glb";
const MB_URL = "/models/MB(BLENDER).glb";
const RAM_URL = "/models/RAM(BLENDER).glb";

/** Motherboard */
const MB_POSITION = new THREE.Vector3(-0.5, 0, 0);
const MB_ROTATION = new THREE.Euler(0, -Math.PI / 2, 0);

/** CPU */
const CPU_POSITION = new THREE.Vector3(5.15, -0.65, 4.35);

/** ================= RAM SYSTEM ================= */

// new seated position (from your screenshot)
const RAM_SEATED_POSITION = new THREE.Vector3(-1.30, -3.84, -0.01);

// starting position (further away)
const RAM_START_POSITION = new THREE.Vector3(-12, -3.84, 0);

const RAM_ROTATION = new THREE.Euler(0, -Math.PI / 2, 0);

/** Interaction (increased magnet strength) */
const SNAP_DISTANCE = 0.15;
const MAGNET_DISTANCE = 1; // stronger radius
const MAGNET_STRENGTH = 0.20; // stronger pull

/** Scale */
const CPU_SCALE = 1;
const MB_SCALE = 1;
const RAM_SCALE = 1;

/* ================= SCENE ================= */

function Scene() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 6, 0);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  return (
    <>
      <color attach="background" args={["#070A0F"]} />

      <ambientLight intensity={0.45} />
      <directionalLight
        position={[4, 6, 2]}
        intensity={1.35}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-3, 1.5, -2]} intensity={0.65} />

      <Environment preset="city" />

      <Motherboard />
      <CpuStatic />
      <RamDraggable />

      <ContactShadows
        position={[0, -0.02, 0]}
        opacity={0.35}
        scale={8}
        blur={2.8}
        far={4}
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

/* ================= MOTHERBOARD ================= */

function Motherboard() {
  const { scene } = useGLTF(MB_URL);

  useMemo(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }, [scene]);

  return (
    <group
      scale={MB_SCALE}
      position={MB_POSITION}
      rotation={MB_ROTATION.toArray()}
    >
      <primitive object={scene} />
    </group>
  );
}

/* ================= CPU STATIC ================= */

function CpuStatic() {
  const { scene } = useGLTF(CPU_URL);

  return (
    <group position={CPU_POSITION} scale={CPU_SCALE}>
      <primitive object={scene} />
    </group>
  );
}

/* ================= RAM DRAGGABLE ================= */

function RamDraggable() {
  const { scene } = useGLTF(RAM_URL);
  const ramRef = useRef();
  const { camera, gl } = useThree();

  const [dragging, setDragging] = useState(false);
  const [snapped, setSnapped] = useState(false);
  const [ramPosition, setRamPosition] = useState({ x: 0, y: 0, z: 0 });
  const [distance, setDistance] = useState(null);

  const dragOffset = useRef(new THREE.Vector3());
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(() => new THREE.Plane(), []);

  const startQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(RAM_ROTATION),
    []
  );
  const seatedQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(RAM_ROTATION),
    []
  );

  useEffect(() => {
    if (!ramRef.current) return;
    ramRef.current.position.copy(RAM_START_POSITION);
    ramRef.current.quaternion.copy(startQuat);
    ramRef.current.scale.setScalar(RAM_SCALE);
  }, [startQuat]);

  const updateMouse = (ev) => {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  };

  /** Tap anywhere toggle dragging **/
  useEffect(() => {
    const handleTap = (e) => {
      if (snapped) return;
      updateMouse(e);

      if (!dragging) {
        const planeNormal = new THREE.Vector3();
        camera.getWorldDirection(planeNormal);
        dragPlane.setFromNormalAndCoplanarPoint(
          planeNormal,
          ramRef.current.position
        );

        raycaster.setFromCamera(mouse, camera);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.copy(ramRef.current.position).sub(hitPoint);
        }
        setDragging(true);
      } else {
        setDragging(false);
        const dist = ramRef.current.position.distanceTo(RAM_SEATED_POSITION);
        if (dist < SNAP_DISTANCE * 2) setSnapped(true);
      }
    };

    gl.domElement.addEventListener("pointerdown", handleTap);
    return () => gl.domElement.removeEventListener("pointerdown", handleTap);
  }, [dragging, snapped, gl, camera, dragPlane, raycaster, hitPoint]);

  /** track pointer move */
  useEffect(() => {
    const move = (e) => updateMouse(e);
    gl.domElement.addEventListener("pointermove", move);
    return () => gl.domElement.removeEventListener("pointermove", move);
  }, [gl]);

  /** animation loop */
  useFrame(() => {
    if (!ramRef.current) return;

    const worldPos = new THREE.Vector3();
    ramRef.current.getWorldPosition(worldPos);
    setRamPosition({ x: worldPos.x, y: worldPos.y, z: worldPos.z });

    // fixed Y level
    const targetY = RAM_START_POSITION.y;
    ramRef.current.position.y = targetY;

    if (snapped) {
      ramRef.current.position.lerp(RAM_SEATED_POSITION, 0.2);
      ramRef.current.quaternion.slerp(seatedQuat, 0.2);
      return;
    }

    if (dragging) {
      raycaster.setFromCamera(mouse, camera);
      if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
        const target = hitPoint.clone().add(dragOffset.current);
        target.y = targetY; // keep it flat
        ramRef.current.position.lerp(target, 0.3);
      }
    }

    const dist = ramRef.current.position.distanceTo(RAM_SEATED_POSITION);
    setDistance(dragging ? dist : null);

    if (!snapped && dist < MAGNET_DISTANCE) {
      const t = 1 - dist / MAGNET_DISTANCE;
      const pull = MAGNET_STRENGTH + t * 0.25; // stronger ease-in
      ramRef.current.position.lerp(RAM_SEATED_POSITION, pull);
      if (dist < SNAP_DISTANCE * 1.2) {
        setSnapped(true);
        setDragging(false);
      }
    }
  });

  return (
    <group ref={ramRef}>
      <group position={[0, -2, 0]}>
        <primitive object={scene} />
      </group>
      <Html position={[0, 0.5, 0]} center>
        <div
          style={{
            padding: "8px",
            borderRadius: 10,
            background: "rgba(0,0,0,0.65)",
            color: "#00ffcc",
            fontSize: 12,
            fontFamily: "monospace",
            textAlign: "center",
          }}
        >
          <div>
            {snapped
              ? "RAM Installed"
              : dragging
              ? "Dragging"
              : "Tap Anywhere to Grab"}
          </div>
          <div>────────</div>
          <div>x: {ramPosition.x.toFixed(2)}</div>
          <div>y: {ramPosition.y.toFixed(2)}</div>
          <div>z: {ramPosition.z.toFixed(2)}</div>
          {distance && <div>d: {distance.toFixed(2)}</div>}
        </div>
      </Html>
    </group>
  );
}

/* ================= EXPORT ================= */

export default function RAMtoMBScene() {
  return (
    <Canvas
      style={{ width: "100%", height: "100%" }}
      camera={{ position: [0, 6, 2], fov: 50 }}
    >
      <Scene />
    </Canvas>
  );
}

useGLTF.preload(CPU_URL);
useGLTF.preload(MB_URL);
useGLTF.preload(RAM_URL);