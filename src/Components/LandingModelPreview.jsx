import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bounds, OrbitControls, useGLTF } from "@react-three/drei";

function HardwareModel() {
  const { scene } = useGLTF("/models/pc.glb");
  return <primitive object={scene} />;
}

function MouseFollowModel({ mouse }) {
  const groupRef = useRef();

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.lookAt(mouse.x * 3, -mouse.y * 1.5, 2);
  });

  return (
    <group ref={groupRef} position={[0, -0.05, 0]}>
      <HardwareModel />
    </group>
  );
}

function ModelOnlyScene({ mouse }) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[6, 7, 5]} intensity={2.25} />
      <directionalLight position={[-6, 3.5, -4]} intensity={0.9} />
      <directionalLight position={[0, 4, -8]} intensity={0.8} />
      <Bounds fit clip margin={1.5}>
        <MouseFollowModel mouse={mouse} />
      </Bounds>
    </>
  );
}

export default function LandingModelPreview({ mouse, controlsRef }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0.95, 0.72, 1.2] }}
      style={{ background: "transparent" }}
    >
      <Suspense fallback={null}>
        <ModelOnlyScene mouse={mouse} />
      </Suspense>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.75}
        enableZoom={false}
        enableRotate={false}
        enablePan={false}
        minDistance={0.2}
        maxDistance={20}
      />
    </Canvas>
  );
}
