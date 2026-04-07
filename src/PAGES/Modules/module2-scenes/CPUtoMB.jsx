import React, { useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF, ContactShadows, Html } from "@react-three/drei";

/** Model URLs - your files should be in public/models/ */
const CPU_URL = "/models/CPU(BLENDER).glb";
const MB_URL = "/models/MB(BLENDER).glb";

/** Motherboard transform in world space */
const MB_POSITION = new THREE.Vector3(-0.5, 0, 0);
const MB_ROTATION = new THREE.Euler(0, -Math.PI / 2, 0);

/**
 * SOCKET / MAGNET POSITION
 * Tweak this until the red marker sits exactly at the center of the socket.
 */
const SOCKET_WORLD_POSITION = new THREE.Vector3(5.15, 0.20, 4.35);

/**
 * Final seated offset.
 * Raise/lower the CPU here until it sits perfectly on the socket.
 */
const CPU_SEATED_OFFSET = new THREE.Vector3(0, Math.PI / -3.75, 0);
const SOCKET_SEATED_POSITION = SOCKET_WORLD_POSITION.clone().add(CPU_SEATED_OFFSET);

/**
 * CPU orientation when fully seated.
 * Set this so the CPU becomes perfectly flat on the motherboard socket.
 */
const CPU_SEATED_ROTATION = new THREE.Euler(0, 0, 0);

/** How close CPU must be to fully snap into place */
const SNAP_DISTANCE = 0.12;

/** Magnet zone */
const MAGNET_DISTANCE = 1.0;

/** Magnetic pull strength */
const MAGNET_STRENGTH = 0.20;

/** Start rotation only */
const START_ROTATION = new THREE.Euler(0, 0, 0);

/** Scale adjustments for your models */
const CPU_SCALE = 1;
const MB_SCALE = 1;

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
      <SocketWorldMarker visible={true} />
      <CpuDraggable />

      <ContactShadows position={[0, -0.02, 0]} opacity={0.35} scale={8} blur={2.8} far={4} />

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={15}
        maxDistance={40}
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI / 2}
        mouseButtons={{
        LEFT: null, // disable left click
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
         }}
      />
    </>
  );
}

function Motherboard() {
  const { scene } = useGLTF(MB_URL);

  useMemo(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
          o.material.metalness = Math.min(1, (o.material.metalness ?? 0.2) + 0.15);
          o.material.roughness = Math.min(1, (o.material.roughness ?? 0.8) + 0.05);
        }
      }
    });
  }, [scene]);

  return (
    <group scale={MB_SCALE} position={MB_POSITION} rotation={MB_ROTATION.toArray()}>
      <primitive object={scene} />
    </group>
  );
}

function SocketWorldMarker({ visible = true }) {
  if (!visible) return null;

  return (
    <group position={SOCKET_WORLD_POSITION}>
      <mesh>
        <sphereGeometry args={[0.06, 20, 20]} />
        <meshStandardMaterial color="red" emissive="red" emissiveIntensity={3} />
      </mesh>

     
    </group>
  );
}

function CpuDraggable() {
  const { scene } = useGLTF(CPU_URL);
  const cpuRef = useRef();
  const { camera, gl } = useThree();


  // Interaction states
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [snapped, setSnapped] = useState(false);
  const [rotating, setRotating] = useState(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const startPos = useMemo(() => new THREE.Vector3(-15, 0.18, 0.25), []);
  const dragOffset = useRef(new THREE.Vector3());

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);

  const dragPlane = useMemo(() => new THREE.Plane(), []);

  const startQuat = useMemo(() => new THREE.Quaternion().setFromEuler(START_ROTATION), []);
  const seatedQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(CPU_SEATED_ROTATION),
    []
  );

  const [cpuPosition, setCpuPosition] = useState({ x: 0, y: 0, z: 0 });

  useMemo(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
          o.material.metalness = Math.max(o.material.metalness ?? 0.1, 0.2);
          o.material.roughness = Math.min(o.material.roughness ?? 0.7, 0.8);
        }
      }
    });
  }, [scene]);

  useEffect(() => {
    if (!cpuRef.current) return;
    cpuRef.current.position.copy(startPos);
    cpuRef.current.quaternion.copy(startQuat);
    cpuRef.current.scale.setScalar(CPU_SCALE);
  }, [startPos, startQuat]);

  const updateMouse = (ev) => {
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    mouse.set(x, y);
  };

  const onPointerOver = (e) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = snapped ? "not-allowed" : "grab";
  };

  const onPointerOut = (e) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = "default";
  };

 const onPointerDown = (e) => {
  e.stopPropagation();

  // ONLY LEFT CLICK
  if (e.button !== 0) return;
  if (snapped || !cpuRef.current) return;

  if (e.button === 2) {
  // RIGHT CLICK = ROTATE
  setRotating(true);
  lastMouse.current = { x: e.clientX, y: e.clientY };
  document.body.style.cursor = "grabbing";
  return;
}
  updateMouse(e);

  const planeNormal = new THREE.Vector3();
  camera.getWorldDirection(planeNormal);
  dragPlane.setFromNormalAndCoplanarPoint(planeNormal, cpuRef.current.position);

  raycaster.setFromCamera(mouse, camera);
  if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
    dragOffset.current.copy(cpuRef.current.position).sub(hitPoint);
  } else {
    dragOffset.current.set(0, 0, 0);
  }

  setDragging(true);
  document.body.style.cursor = "grabbing";
};

 const onPointerUp = (e) => {
  e.stopPropagation();

  // ONLY LEFT CLICK RELEASE
  if (e.button !== 0) return;

  setDragging(false);
  document.body.style.cursor = hovered ? "grab" : "default";

  if (!cpuRef.current) return;

  const dist = cpuRef.current.position.distanceTo(SOCKET_WORLD_POSITION);
  if (dist < SNAP_DISTANCE || dist < MAGNET_DISTANCE * 0.35) {
    setSnapped(true);
  }
  if (e.button === 2) {
  setRotating(false);
  document.body.style.cursor = "default";
  return;
}
};

  useFrame(() => {
    if (!cpuRef.current) return;

    if (snapped) {
      cpuRef.current.position.lerp(SOCKET_SEATED_POSITION, 0.18);
      cpuRef.current.quaternion.slerp(seatedQuat, 0.18);
      return;
    }

    if (!dragging) return;

    const planeNormal = new THREE.Vector3();
    camera.getWorldDirection(planeNormal);
    dragPlane.setFromNormalAndCoplanarPoint(planeNormal, cpuRef.current.position);

    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
      const target = hitPoint.clone().add(dragOffset.current);

      target.x = THREE.MathUtils.clamp(target.x, -3.5, 15.5);
      target.y = THREE.MathUtils.clamp(target.y, -0.6, 3.8);
      target.z = THREE.MathUtils.clamp(target.z, -3.6, 15.8);

      cpuRef.current.position.lerp(target, 0.35);
    }

    const dist = cpuRef.current.position.distanceTo(SOCKET_WORLD_POSITION);

    if (dist < MAGNET_DISTANCE) {
      const t = 1 - dist / MAGNET_DISTANCE;
      const pullStrength = MAGNET_STRENGTH + t * 0.18;

      cpuRef.current.position.lerp(SOCKET_WORLD_POSITION, pullStrength);

      if (dist < SNAP_DISTANCE * 1.2) {
        setSnapped(true);
        setDragging(false);
        document.body.style.cursor = hovered ? "grab" : "default";
      }
    }
  });

  useEffect(() => {
    const el = gl.domElement;

    const onMove = (ev) => updateMouse(ev);

    el.addEventListener("pointermove", onMove, { passive: true });
    return () => el.removeEventListener("pointermove", onMove);
  }, [gl]);

  const [distance, setDistance] = useState(null);

  useEffect(() => {
  const preventContextMenu = (e) => e.preventDefault();
  gl.domElement.addEventListener("contextmenu", preventContextMenu);

  return () => {
    gl.domElement.removeEventListener("contextmenu", preventContextMenu);
  };
}, [gl]);

  useFrame(() => {
  if (!cpuRef.current) return;

  // ✅ ROTATION (RIGHT CLICK HOLD)
  if (rotating && !snapped) {
    const dx = mouse.x;
    const dy = mouse.y;

    cpuRef.current.rotation.y += dx * 0.05;
    cpuRef.current.rotation.x += dy * 0.05;
  }

  // ✅ UPDATE POSITION DISPLAY
  setCpuPosition({
    x: cpuRef.current.position.x,
    y: cpuRef.current.position.y,
    z: cpuRef.current.position.z,
  });

  // ✅ DISTANCE CHECK
  if (dragging && !snapped) {
    setDistance(cpuRef.current.position.distanceTo(SOCKET_WORLD_POSITION));
  } else {
    setDistance(null);
  }
});
  
  

  return (
    <group>
      <group
        ref={cpuRef}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <primitive object={scene} />
        <mesh visible={hovered && !snapped} position={[0, 0, -0.01]}>
          <ringGeometry args={[0.06, 0.085, 40]} />
          <meshBasicMaterial color="#7cffe1" transparent opacity={0.35} />
        </mesh>

        <Html
          position={[0, 0.14, 0]}
          center
          style={{
            pointerEvents: "none",
            transform: "translate3d(0,0,0)",
            opacity: snapped ? 0.9 : hovered ? 0.98 : 0.78,
            transition: "opacity 200ms ease",
            fontFamily: "ui-sans-serif, system-ui",
          }}
        >
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              background: "rgba(10,14,22,.72)",
              border: "1px solid rgba(140,255,230,.22)",
              backdropFilter: "blur(8px)",
              color: "rgba(234,240,255,.95)",
              fontSize: 12,
              letterSpacing: ".02em",
              whiteSpace: "nowrap",
              lineHeight: 1.45,
              textAlign: "left",
              minWidth: 130,
            }}
          >
            <div>{snapped ? "CPU seated" : dragging ? "Move CPU in 3D" : "Drag CPU"}</div>
            <div
              style={{
                marginTop: 6,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
            >
              x: {cpuPosition.x.toFixed(2)}
            </div>
            <div
              style={{
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
            >
              y: {cpuPosition.y.toFixed(2)}
            </div>
            <div
              style={{
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
            >
              z: {cpuPosition.z.toFixed(2)}
            </div>
            {distance != null ? (
              <div style={{ marginTop: 6, opacity: 0.8 }}>d={distance.toFixed(2)}</div>
            ) : null}
          </div>
        </Html>
      </group>

      {snapped ? (
        <ResetCpuButton
          cpuRef={cpuRef}
          startPos={startPos}
          startQuat={startQuat}
          onReset={() => setSnapped(false)}
        />
      ) : null}
    </group>
  );
}

function ResetCpuButton({ cpuRef, startPos, startQuat, onReset }) {
  const { gl } = useThree();

  return (
    <Html position={[-0.78, 0.45, 0]} style={{ pointerEvents: "auto" }}>
      <button
        onClick={() => {
          if (!cpuRef.current) return;
          cpuRef.current.position.copy(startPos);
          cpuRef.current.quaternion.copy(startQuat);
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
        Reset CPU
      </button>
    </Html>
  );
}

export default function CPUtoMB() {
  return (
  
    <Canvas
      style={{ width: "100%", height: "100%" }}
      camera={{ position: [0, 6, 2], fov: 50 }}
    >
      <Scene />
    </Canvas>

  );
}

const styles = {
  shell: {
    
    width: "100%",
    height: "100%",

    display: "grid",
    gridTemplateRows: "auto 1fr",
    background:
      "radial-gradient(1200px 700px at 70% 10%, rgba(124,255,225,.10), transparent 60%), radial-gradient(900px 600px at 20% 30%, rgba(120,150,255,.08), transparent 55%), #070A0F",
    color: "#f1f1f1",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },

  topbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "10px 16px",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    background: "linear-gradient(to bottom, rgba(10,14,22,.65), rgba(10,14,22,.35))",
    backdropFilter: "blur(10px)",
    zIndex: 2,
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "rgba(124,255,225,.9)",
    boxShadow: "0 0 0 6px rgba(124,255,225,.08)",
  },

  title: {
    fontWeight: 700,
    letterSpacing: ".02em",
  },

  subtitle: {
    fontSize: 12,
    opacity: 0.75,
    marginTop: 2,
  },

  main: {
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "1fr",
    width: "100%",
    height: "100%",
  },

  leftSection: {
    minWidth: 0,
    minHeight: 0,
    display: "grid",
    gridTemplateRows: "minmax(0, 1fr) auto",
    padding: 14,
    gap: 12,
  },

  videoFrame: {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: 0,
    borderRadius: 18,
    overflow: "hidden",
    background: "#000",
    border: "1px solid rgba(255,255,255,.06)",
    boxShadow: "0 18px 50px rgba(0,0,0,.35)",
  },

  canvas: {
    width: "100%",
    height: "100%",
    display: "block",
  },

  videoMeta: {
    padding: "0 4px 4px",
    textAlign: "center",
  },

  videoTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#f8f8f8",
  },

  videoSubMeta: {
    marginTop: 6,
    fontSize: 12.5,
    color: "rgba(255,255,255,.68)",
    lineHeight: 1.5,
  },

  rightSection: {
    minHeight: 0,
    borderLeft: "1px solid rgba(255,255,255,.08)",
    background: "linear-gradient(to bottom, rgba(10,14,22,.35), rgba(10,14,22,.55))",
    backdropFilter: "blur(10px)",
    display: "grid",
    gridTemplateRows: "auto 1fr",
  },

  hintBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    padding: "12px 14px",
    borderBottom: "1px solid rgba(255,255,255,.06)",
  },

  hintText: {
    fontSize: 12,
    opacity: 0.8,
  },

  kbd: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 11,
    padding: "5px 9px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(10,14,22,.55)",
    color: "#f1f1f1",
  },

  panel: {
    padding: 14,
    overflowY: "auto",
  },

  panelBlock: {
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(6,8,12,.35)",
    boxShadow: "0 18px 45px rgba(0,0,0,.35)",
    marginBottom: 12,
  },

  panelH: {
    fontWeight: 700,
    letterSpacing: ".02em",
    marginBottom: 8,
    textAlign: "center",
  },

  panelP: {
    fontSize: 12.5,
    lineHeight: 1.7,
    opacity: 0.85,
    textAlign: "center",
  },

  path: {
    marginTop: 8,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    padding: "8px 10px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(10,14,22,.55)",
    wordBreak: "break-all",
  },

  codeLine: {
    marginTop: 6,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    opacity: 0.9,
  },
};

// Preload models for better UX
useGLTF.preload(CPU_URL);
useGLTF.preload(MB_URL);