import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

function Model({ path, position = [0, 0, 0], scale = 1, rotation = [0, 0, 0] }) {
  const { scene } = useGLTF(path);
  return <primitive object={scene} position={position} scale={scale} rotation={rotation} />;
}

export default function FullAssemblyScene() {
  return (
    <Canvas
      style={{ width: "100%", height: "100%" }}
      camera={{ position: [0, 2, 5], fov: 50 }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      <OrbitControls />

      {/* Motherboard as the root */}
      <group position={[0, 0, 0]}>
        <Model path="/models/MB(BLENDER).glb" />

        {/* CPU positioned relative to motherboard */}
        <Model
          path="/models/CPU(BLENDER).glb"
          position={[0, 0.03, 0]}  // slightly above socket
          scale={1}
        />
      </group>

      {/* Other parts */}
      <Model path="/models/SSD(BLENDER).glb" position={[-1.5, 0, 0]} />
      <Model path="/models/RAM(BLENDER).glb" position={[0.5, 0.5, 0]} />
    </Canvas>
  );
}
