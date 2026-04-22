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

/** Motherboard */
const MB_POSITION = new THREE.Vector3(-0.5, 0, 0);
const MB_ROTATION = new THREE.Euler(0, -Math.PI / 2, 0);

/** CPU (pre-seated) */
const CPU_POSITION = new THREE.Vector3(5.15, -0.65, 4.35);
const CPU_ROTATION = new THREE.Euler(0, 0, 0);

/** RAM (pre-seated) */
const RAM_SEATED_POSITION = new THREE.Vector3(-1.30, -3.84, -0.01);
const RAM_ROTATION = new THREE.Euler(0, -Math.PI / 2, 0);

/** ================= SSD SYSTEM ================= */

// Tweak these values to position the SSD slot on your motherboard
const SSD_SEATED_POSITION = new THREE.Vector3(8.73, -2.15, 0.06);
const SSD_START_POSITION = new THREE.Vector3(-8, -2.15, -2.0);
const SSD_ROTATION = new THREE.Euler(0, -Math.PI / 2, 0);

/** Interaction */
const SNAP_DISTANCE = 0.15;
const MAGNET_DISTANCE = 1.0;
const MAGNET_STRENGTH = 0.20;

/** Scale */
const CPU_SCALE = 1;
const MB_SCALE = 1;
const RAM_SCALE = 1;
const SSD_SCALE = 1;

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
      <RamStatic />
      <SsdDraggable />

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

/* ================= CPU STATIC (PRE-SEATED) ================= */

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

/* ================= RAM STATIC (PRE-SEATED) ================= */

function RamStatic() {
  const { scene } = useGLTF(RAM_URL);

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
      position={RAM_SEATED_POSITION}
      rotation={RAM_ROTATION.toArray()}
      scale={RAM_SCALE}
    >
      <group position={[0, -2, 0]}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

/* ================= SSD DRAGGABLE ================= */

function SsdDraggable() {
  const { scene } = useGLTF(SSD_URL);
  const ssdRef = useRef();
  const { camera, gl } = useThree();

  const [dragging, setDragging] = useState(false);
  const [snapped, setSnapped] = useState(false);
  const [ssdPosition, setSsdPosition] = useState({ x: 0, y: 0, z: 0 });
  const [distance, setDistance] = useState(null);

  const dragOffset = useRef(new THREE.Vector3());
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const hitPoint = useRef(new THREE.Vector3());
  const dragPlane = useRef(new THREE.Plane());

  const startQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(SSD_ROTATION),
    []
  );
  const seatedQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(SSD_ROTATION),
    []
  );

  useMemo(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }, [scene]);

  useEffect(() => {
    if (!ssdRef.current) return;
    ssdRef.current.position.copy(SSD_START_POSITION);
    ssdRef.current.quaternion.copy(startQuat);
    ssdRef.current.scale.setScalar(SSD_SCALE);
  }, [startQuat]);

  const updateMouse = useCallback(
    (ev) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    },
    [gl]
  );

  /** Tap anywhere toggle dragging **/
  useEffect(() => {
    const handleTap = (e) => {
      if (snapped) return;
      if (e.button !== 0) return; // left click only
      
      updateMouse(e);

      if (!dragging) {
        const planeNormal = new THREE.Vector3();
        camera.getWorldDirection(planeNormal);
        dragPlane.current.setFromNormalAndCoplanarPoint(
          planeNormal,
          ssdRef.current.position
        );

        raycaster.current.setFromCamera(mouse.current, camera);
        if (
          raycaster.current.ray.intersectPlane(
            dragPlane.current,
            hitPoint.current
          )
        ) {
          dragOffset.current.copy(ssdRef.current.position).sub(hitPoint.current);
        }
        setDragging(true);
        document.body.style.cursor = "grabbing";
      } else {
        setDragging(false);
        document.body.style.cursor = "default";
        const dist = ssdRef.current.position.distanceTo(SSD_SEATED_POSITION);
        if (dist < SNAP_DISTANCE * 2) setSnapped(true);
      }
    };

    gl.domElement.addEventListener("pointerdown", handleTap);
    return () => gl.domElement.removeEventListener("pointerdown", handleTap);
  }, [dragging, snapped, gl, camera, updateMouse]);

  /** track pointer move */
  useEffect(() => {
    const move = (e) => updateMouse(e);
    gl.domElement.addEventListener("pointermove", move);
    return () => gl.domElement.removeEventListener("pointermove", move);
  }, [gl, updateMouse]);

  /** prevent context menu */
  useEffect(() => {
    const preventContextMenu = (e) => e.preventDefault();
    gl.domElement.addEventListener("contextmenu", preventContextMenu);
    return () => gl.domElement.removeEventListener("contextmenu", preventContextMenu);
  }, [gl]);

  /** animation loop */
  useFrame(() => {
    if (!ssdRef.current) return;

    const worldPos = new THREE.Vector3();
    ssdRef.current.getWorldPosition(worldPos);
    setSsdPosition({ x: worldPos.x, y: worldPos.y, z: worldPos.z });

    // fixed Y level
    const targetY = SSD_START_POSITION.y;
    ssdRef.current.position.y = targetY;

    if (snapped) {
      ssdRef.current.position.lerp(SSD_SEATED_POSITION, 0.2);
      ssdRef.current.quaternion.slerp(seatedQuat, 0.2);
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
        target.y = targetY; // keep it flat
        ssdRef.current.position.lerp(target, 0.3);
      }
    }

    const dist = ssdRef.current.position.distanceTo(SSD_SEATED_POSITION);
    setDistance(dragging ? dist : null);

    if (!snapped && dist < MAGNET_DISTANCE) {
      const t = 1 - dist / MAGNET_DISTANCE;
      const pull = MAGNET_STRENGTH + t * 0.25;
      ssdRef.current.position.lerp(SSD_SEATED_POSITION, pull);
      if (dist < SNAP_DISTANCE * 1.2) {
        setSnapped(true);
        setDragging(false);
        document.body.style.cursor = "default";
      }
    }
  });

  return (
    <group>
      <group ref={ssdRef}>
        <primitive object={scene} />

        <Html position={[0, 0.5, 0]} center>
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
              minWidth: 130,
            }}
          >
            <div>
              {snapped
                ? "SSD Installed"
                : dragging
                ? "Dragging SSD"
                : "Click to Grab SSD"}
            </div>
            <div style={{ marginTop: 6 }}>────────</div>
            <div>x: {ssdPosition.x.toFixed(2)}</div>
            <div>y: {ssdPosition.y.toFixed(2)}</div>
            <div>z: {ssdPosition.z.toFixed(2)}</div>
            {distance && <div style={{ marginTop: 4 }}>d: {distance.toFixed(2)}</div>}
          </div>
        </Html>
      </group>

      {snapped && (
        <ResetSsdButton
          ssdRef={ssdRef}
          startPos={SSD_START_POSITION}
          startQuat={startQuat}
          onReset={() => setSnapped(false)}
        />
      )}
    </group>
  );
}

/* ================= RESET BUTTON ================= */

function ResetSsdButton({ ssdRef, startPos, startQuat, onReset }) {
  const { gl } = useThree();

  return (
    <Html position={[-0.78, 0.45, 0]} style={{ pointerEvents: "auto" }}>
      <button
        onClick={() => {
          if (!ssdRef.current) return;
          ssdRef.current.position.copy(startPos);
          ssdRef.current.quaternion.copy(startQuat);
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
        Reset SSD
      </button>
    </Html>
  );
}

/* ================= EXPORT ================= */

export default function SSDtoMBScene() {
  return (
    <Canvas
      style={{ width: "100%", height: "100%" }}
      camera={{ position: [0, 6, 2], fov: 50 }}
    >
      <Scene />
    </Canvas>
  );
}

// Preload all models
useGLTF.preload(CPU_URL);
useGLTF.preload(MB_URL);
useGLTF.preload(RAM_URL);
useGLTF.preload(SSD_URL);