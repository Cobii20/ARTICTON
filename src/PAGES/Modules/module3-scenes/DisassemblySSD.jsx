import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF, ContactShadows, Html } from "@react-three/drei";

const CASE_URL = "/models/PC CASE(BLENDER).glb";
const MB_URL = "/models/MB(BLENDER).glb";
const CPU_URL = "/models/CPU(BLENDER).glb";
const SSD_URL = "/models/SSD(BLENDER).glb";

const CASE_POSITION = new THREE.Vector3(0, -15, 0);
const MB_POSITION = new THREE.Vector3(-0.6, -0.6, 2.99);
const MB_ROTATION = new THREE.Euler(0, 0, -Math.PI / 2);

const CPU_POSITION = new THREE.Vector3(-1.25, -4.95, -2.66);
const CPU_ROTATION = new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2);

const SSD_INSTALLED_POS = new THREE.Vector3(-2.75, -0.66, -6.24);
const SSD_INSTALLED_ROT = new THREE.Euler(0, 0, -Math.PI / 2);

const SSD_FLOOR_POS = new THREE.Vector3(6.7, -13.75, -1.2);
const SSD_FLOOR_ROT = new THREE.Euler(Math.PI / 2, 0, 0);

function cloneWithShadows(scene) {
  const clone = scene.clone(true);
  clone.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return clone;
}

function animatePart(ref, pos, rot, alpha = 0.12) {
  if (!ref.current) return;
  ref.current.position.lerp(pos, alpha);
  const q = new THREE.Quaternion().setFromEuler(rot);
  ref.current.quaternion.slerp(q, alpha);
}

function StepPanel({ detached, onToggle }) {
  return (
    <Html position={[-10, 8.5, 0]} style={{ pointerEvents: "auto" }}>
      <div style={{ minWidth: 240, padding: 12, borderRadius: 14, background: "rgba(10,14,22,.80)", border: "1px solid rgba(0,255,180,.18)", color: "#eef4ff", fontFamily: "monospace" }}>
        <div style={{ fontWeight: "bold", marginBottom: 8 }}>Module 3 — Disassembly</div>
        <div style={{ marginBottom: 8 }}>DisassemblySSD.jsx</div>
        <div style={{ marginBottom: 10 }}>Remove the SSD and place it on the floor display area.</div>
        <button onClick={onToggle} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.16)", background: detached ? "#00ffb4" : "rgba(255,255,255,.06)", color: detached ? "#081018" : "#eef4ff", fontWeight: "bold", cursor: "pointer" }}>
          {detached ? "Reinstall SSD" : "Detach SSD"}
        </button>
      </div>
    </Html>
  );
}

function Scene() {
  const { camera } = useThree();
  const { scene: caseScene } = useGLTF(CASE_URL);
  const { scene: mbScene } = useGLTF(MB_URL);
  const { scene: cpuScene } = useGLTF(CPU_URL);
  const { scene: ssdScene } = useGLTF(SSD_URL);

  const [detached, setDetached] = useState(false);
  const ssdRef = useRef();

  const caseClone = useMemo(() => cloneWithShadows(caseScene), [caseScene]);
  const mbClone = useMemo(() => cloneWithShadows(mbScene), [mbScene]);
  const cpuClone = useMemo(() => cloneWithShadows(cpuScene), [cpuScene]);
  const ssdClone = useMemo(() => cloneWithShadows(ssdScene), [ssdScene]);

  useEffect(() => {
    camera.position.set(2, 8, 28);
    camera.lookAt(4, -10, 1);
  }, [camera]);

  useEffect(() => {
    if (!ssdRef.current) return;
    ssdRef.current.position.copy(SSD_INSTALLED_POS);
    ssdRef.current.rotation.copy(SSD_INSTALLED_ROT);
  }, []);

  useFrame(() => {
    animatePart(
      ssdRef,
      detached ? SSD_FLOOR_POS : SSD_INSTALLED_POS,
      detached ? SSD_FLOOR_ROT : SSD_INSTALLED_ROT
    );
  });

  return (
    <>
      <color attach="background" args={["#7b7b7b"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 10, 6]} intensity={1.2} castShadow />
      <Environment preset="city" />

      <group position={CASE_POSITION}><primitive object={caseClone} /></group>
      <group position={MB_POSITION} rotation={MB_ROTATION.toArray()}><primitive object={mbClone} /></group>
      <group position={CPU_POSITION} rotation={CPU_ROTATION.toArray()}><primitive object={cpuClone} /></group>

      <group ref={ssdRef}>
        <primitive object={ssdClone} />
        <Html position={[0, 1.2, 0]} center>
          <div style={{ padding: "5px 8px", borderRadius: 10, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 11 }}>
            {detached ? "SSD on floor" : "SSD installed"}
          </div>
        </Html>
      </group>

      <StepPanel detached={detached} onToggle={() => setDetached((v) => !v)} />

      <ContactShadows position={[5, -14.95, 1]} opacity={0.35} scale={30} blur={2.5} far={20} />
      <OrbitControls makeDefault enablePan={false} minDistance={18} maxDistance={40} target={[5, -11, 1]} />
    </>
  );
}

export default function DisassemblySSD() {
  return (
    <Canvas shadows camera={{ position: [2, 8, 28], fov: 45 }} style={{ width: "100%", height: "100%" }}>
      <Scene />
    </Canvas>
  );
}

useGLTF.preload(CASE_URL);
useGLTF.preload(MB_URL);
useGLTF.preload(CPU_URL);
useGLTF.preload(SSD_URL);