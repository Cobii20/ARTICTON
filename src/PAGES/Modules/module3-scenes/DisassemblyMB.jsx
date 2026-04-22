import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF, ContactShadows, Html } from "@react-three/drei";

const CASE_URL = "/models/PC CASE(BLENDER).glb";
const MB_URL = "/models/MB(BLENDER).glb";

const CASE_POSITION = new THREE.Vector3(0, -15, 0);

const MB_INSTALLED_POS = new THREE.Vector3(-0.6, -0.6, 2.99);
const MB_INSTALLED_ROT = new THREE.Euler(0, 0, -Math.PI / 2);

// large clean placement to the far right like the reference layout
const MB_FLOOR_POS = new THREE.Vector3(12.2, -13.25, 1.8);
const MB_FLOOR_ROT = new THREE.Euler(Math.PI / 2, 0.15, 0);

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
        <div style={{ marginBottom: 8 }}>DisassemblyMB.jsx</div>
        <div style={{ marginBottom: 10 }}>Remove the motherboard and lay it down neatly on the far-right floor area.</div>
        <button onClick={onToggle} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.16)", background: detached ? "#00ffb4" : "rgba(255,255,255,.06)", color: detached ? "#081018" : "#eef4ff", fontWeight: "bold", cursor: "pointer" }}>
          {detached ? "Reinstall Motherboard" : "Detach Motherboard"}
        </button>
      </div>
    </Html>
  );
}

function Scene() {
  const { camera } = useThree();
  const { scene: caseScene } = useGLTF(CASE_URL);
  const { scene: mbScene } = useGLTF(MB_URL);

  const [detached, setDetached] = useState(false);
  const mbRef = useRef();

  const caseClone = useMemo(() => cloneWithShadows(caseScene), [caseScene]);
  const mbClone = useMemo(() => cloneWithShadows(mbScene), [mbScene]);

  useEffect(() => {
    camera.position.set(2, 8, 28);
    camera.lookAt(4, -10, 1);
  }, [camera]);

  useEffect(() => {
    if (!mbRef.current) return;
    mbRef.current.position.copy(MB_INSTALLED_POS);
    mbRef.current.rotation.copy(MB_INSTALLED_ROT);
  }, []);

  useFrame(() => {
    animatePart(
      mbRef,
      detached ? MB_FLOOR_POS : MB_INSTALLED_POS,
      detached ? MB_FLOOR_ROT : MB_INSTALLED_ROT
    );
  });

  return (
    <>
      <color attach="background" args={["#7b7b7b"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 10, 6]} intensity={1.2} castShadow />
      <Environment preset="city" />

      <group position={CASE_POSITION}><primitive object={caseClone} /></group>

      <group ref={mbRef}>
        <primitive object={mbClone} />
        <Html position={[0, 3, 0]} center>
          <div style={{ padding: "5px 8px", borderRadius: 10, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 11 }}>
            {detached ? "Motherboard on floor" : "Motherboard installed"}
          </div>
        </Html>
      </group>

      <StepPanel detached={detached} onToggle={() => setDetached((v) => !v)} />

      <ContactShadows position={[5, -14.95, 1]} opacity={0.35} scale={30} blur={2.5} far={20} />
      <OrbitControls makeDefault enablePan={false} minDistance={18} maxDistance={40} target={[5, -11, 1]} />
    </>
  );
}

export default function DisassemblyMB() {
  return (
    <Canvas shadows camera={{ position: [2, 8, 28], fov: 45 }} style={{ width: "100%", height: "100%" }}>
      <Scene />
    </Canvas>
  );
}

useGLTF.preload(CASE_URL);
useGLTF.preload(MB_URL);