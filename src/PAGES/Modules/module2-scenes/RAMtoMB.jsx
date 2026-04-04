import React, { useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF, ContactShadows, Html } from "@react-three/drei";

/** MODEL URLS */
const CPU_URL = "/models/CPU(BLENDER).glb";
const MB_URL = "/models/MB(BLENDER).glb";
const RAM_URL = "/models/RAM(BLENDER).glb";

/** Motherboard transform */
const MB_POSITION = new THREE.Vector3(-0.5, 0, 0);
const MB_ROTATION = new THREE.Euler(0, -Math.PI / 2, 0);

/** CPU already seated */
const CPU_POSITION = new THREE.Vector3(5.09, 0.12, 4.03);
const CPU_ROTATION = new THREE.Euler(0, 0, 0);

/** RAM SLOT POSITION (YOU MAY TWEAK THIS) */
const RAM_SLOT_POSITION = new THREE.Vector3(6.2, 0.25, 4.1);
const RAM_SEATED_OFFSET = new THREE.Vector3(0, 0, 0);
const RAM_SEATED_POSITION = RAM_SLOT_POSITION.clone().add(RAM_SEATED_OFFSET);
const RAM_SEATED_ROTATION = new THREE.Euler(0, 0, 0);

/** Interaction tuning */
const SNAP_DISTANCE = 0.15;
const MAGNET_DISTANCE = 1.2;
const MAGNET_STRENGTH = 0.12;

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
  }, [camera]);

  return (
    <>
      <color attach="background" args={["#070A0F"]} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 2]} intensity={1.3} castShadow />
      <pointLight position={[-3, 2, -2]} intensity={0.6} />

      <Environment preset="city" />

      <Motherboard />
      <CpuStatic />
      <RamDraggable />

      <ContactShadows position={[0, -0.02, 0]} opacity={0.35} scale={8} blur={2.8} />

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={15}
        maxDistance={40}
        target={[0, 0, 0]}
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
    <group scale={MB_SCALE} position={MB_POSITION} rotation={MB_ROTATION.toArray()}>
      <primitive object={scene} />
    </group>
  );
}

/* ================= STATIC CPU ================= */

function CpuStatic() {
  const { scene } = useGLTF(CPU_URL);

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
      position={CPU_POSITION}
      rotation={CPU_ROTATION.toArray()}
      scale={CPU_SCALE}
    >
      <primitive object={scene} />
    </group>
  );
}

/* ================= RAM DRAG SYSTEM ================= */

function RamDraggable() {
  const { scene } = useGLTF(RAM_URL);
  const ramRef = useRef();
  const { camera, gl } = useThree();

  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [snapped, setSnapped] = useState(false);

  const startPos = useMemo(() => new THREE.Vector3(-12, 0.2, 0), []);
  const dragOffset = useRef(new THREE.Vector3());

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(() => new THREE.Plane(), []);

  const startQuat = useMemo(() => new THREE.Quaternion(), []);
  const seatedQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(RAM_SEATED_ROTATION),
    []
  );

  useEffect(() => {
    if (!ramRef.current) return;
    ramRef.current.position.copy(startPos);
    ramRef.current.quaternion.copy(startQuat);
    ramRef.current.scale.setScalar(RAM_SCALE);
  }, [startPos, startQuat]);

  const updateMouse = (ev) => {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const onPointerDown = (e) => {
    e.stopPropagation();
    if (snapped) return;

    updateMouse(e);

    const planeNormal = new THREE.Vector3();
    camera.getWorldDirection(planeNormal);
    dragPlane.setFromNormalAndCoplanarPoint(planeNormal, ramRef.current.position);

    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
      dragOffset.current.copy(ramRef.current.position).sub(hitPoint);
    }

    setDragging(true);
    document.body.style.cursor = "grabbing";
  };

  const onPointerUp = () => {
    setDragging(false);
    document.body.style.cursor = "default";

    const dist = ramRef.current.position.distanceTo(RAM_SLOT_POSITION);
    if (dist < SNAP_DISTANCE) setSnapped(true);
  };

  useFrame(() => {
    if (!ramRef.current) return;

    if (snapped) {
      ramRef.current.position.lerp(RAM_SEATED_POSITION, 0.2);
      ramRef.current.quaternion.slerp(seatedQuat, 0.2);
      return;
    }

    if (!dragging) return;

    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
      const target = hitPoint.clone().add(dragOffset.current);
      ramRef.current.position.lerp(target, 0.3);
    }

    const dist = ramRef.current.position.distanceTo(RAM_SLOT_POSITION);

    if (dist < MAGNET_DISTANCE) {
      const t = 1 - dist / MAGNET_DISTANCE;
      ramRef.current.position.lerp(
        RAM_SLOT_POSITION,
        MAGNET_STRENGTH + t * 0.2
      );

      if (dist < SNAP_DISTANCE) {
        setSnapped(true);
        setDragging(false);
      }
    }
  });

  useEffect(() => {
    const move = (e) => updateMouse(e);
    gl.domElement.addEventListener("pointermove", move);
    return () => gl.domElement.removeEventListener("pointermove", move);
  }, [gl]);

  return (
    <group>
      <group
        ref={ramRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <primitive object={scene} />

        <Html position={[0, 0.2, 0]} center>
          <div style={{ fontSize: 12, color: "white" }}>
            {snapped ? "RAM Installed" : "Drag RAM"}
          </div>
        </Html>
      </group>
    </group>
  );
}

/* ================= EXPORT ================= */

export default function RAMtoMBScene() {
  return (
    <Canvas style={{ width: "100%", height: "100%" }}>
      <Scene />
    </Canvas>
  );
}

/* PRELOAD */
useGLTF.preload(CPU_URL);
useGLTF.preload(MB_URL);
useGLTF.preload(RAM_URL);