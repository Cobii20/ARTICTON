import React, { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import {
  Environment,
  Html,
  OrbitControls,
  useGLTF,
  useProgress,
} from "@react-three/drei";

const MODEL_URLS = [
  "/models/NEWcaseAMD.glb",
  "/models/NEWmotherboardAMD.glb",
  "/models/NEWcpuAMD.glb",
  "/models/NEWramAMD.glb",
  "/models/NEWram2AMD.glb",
  "/models/NEWssdAMD.glb",
  "/models/NEWhddAMD.glb",
  "/models/NEWpsuAMD.glb",
  "/models/NEWgpuAMD.glb",
];

function cloneScene(scene) {
  const clone = scene.clone(true);
  clone.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return clone;
}

function LoadingFallback() {
  const { progress, active } = useProgress();
  const percent = Number.isFinite(progress) ? Math.round(progress) : 0;

  return (
    <>
      <color attach="background" args={[typeof document !== "undefined" && document.documentElement.classList.contains("articton-light") ? "#f8f9ff" : "#05080D"]} />
      <ambientLight intensity={0.6} />
      <Html center style={{ pointerEvents: "none" }}>
        <div
          style={{
            minWidth: 220,
            border: "1px solid rgba(255,212,28,.25)",
            borderRadius: 16,
            background: "rgba(10,14,22,.88)",
            boxShadow: "0 18px 55px rgba(0,0,0,.35)",
            color: "rgba(234,240,255,.95)",
            fontFamily: "system-ui, sans-serif",
            padding: "14px 16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800 }}>
            Loading default 3D models
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "rgba(159,176,202,.9)" }}>
            {active ? `${percent}%` : "Preparing scene"}
          </div>
        </div>
      </Html>
    </>
  );
}

class DefaultModelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Module 3 default model viewer failed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            alignItems: "center",
            background: "#05080D",
            color: "rgba(234,240,255,.95)",
            display: "flex",
            fontFamily: "system-ui, sans-serif",
            height: "100%",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
            width: "100%",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>
              Module 3 scene could not load.
            </div>
            <div style={{ color: "rgba(159,176,202,.9)", fontSize: 13, marginTop: 8 }}>
              Please check that the AMD GLB model files are available in public/models.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function DefaultModel({ url }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => cloneScene(scene), [scene]);

  return <primitive object={model} />;
}

function DefaultScene() {
  return (
    <>
      <color attach="background" args={[typeof document !== "undefined" && document.documentElement.classList.contains("articton-light") ? "#f8f9ff" : "#05080D"]} />
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-3, 2, -2]} intensity={0.7} />
      <Environment preset="city" />

      {MODEL_URLS.map((url) => (
        <DefaultModel key={url} url={url} />
      ))}

      <OrbitControls
        makeDefault
        enablePan
        minDistance={1}
        maxDistance={150}
        target={[0, 0, 0]}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />
    </>
  );
}

export default function DefaultModule3ModelViewer({ onComplete }) {
  useEffect(() => {
    onComplete?.();
  }, [onComplete]);

  return (
    <DefaultModelErrorBoundary>
      <Canvas
        shadows
        style={{ width: "100%", height: "100%" }}
        camera={{ position: [70, 14, -20], fov: 50 }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <DefaultScene />
        </Suspense>
      </Canvas>
    </DefaultModelErrorBoundary>
  );
}

MODEL_URLS.forEach((url) => useGLTF.preload(url));
