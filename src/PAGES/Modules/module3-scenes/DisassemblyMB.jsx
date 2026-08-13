import React, { Suspense, useMemo, useRef, useState, useEffect, useCallback } from "react";
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
const CASE_URL = "/models/PC%20CASE(BLENDER).glb";
const MB_URL   = "/models/MB(BLENDER).glb";
const CPU_URL  = "/models/CPU(BLENDER).glb";
const RAM_URL  = "/models/RAM(BLENDER).glb";
const SSD_URL  = "/models/SSD(BLENDER).glb";
const HDD_URL  = "/models/HDD(BLENDER).glb";
const PSU_URL  = "/models/PSU(BLENDER).glb";

/** BASE SETTINGS */
const CASE_POSITION  = new THREE.Vector3(0, -15, 0);
const CASE_ROTATION  = new THREE.Euler(0, 0, 0);
const CASE_SCALE     = 1;
const ASSEMBLY_SCALE = 1;

/** CAMERA */
const CAMERA_POSITION = [70, 14, -20];
const CONTROL_TARGET  = [20, -12, 2];

/** SNAP / MAGNET */
const SNAP_DISTANCE   = 0.75;
const MAGNET_DISTANCE = 3.2;
const MAGNET_STRENGTH = 0.18;

/** MOTHERBOARD — installed position inside case */
const MB_SEATED_POSITION = new THREE.Vector3(-0.6, -0.6, 2.99);
const MB_SEATED_ROTATION = new THREE.Euler(0, 0, -Math.PI / 2);

/** MOTHERBOARD — final seated position on checkerboard */
const MB_FLOOR_POSITION = new THREE.Vector3(33.54, -14.87, 11.32);

/**
 * Hover height while detached/dragging.
 * This keeps the motherboard above PSU/CPU/checkerboard while the user moves it.
 */
const MB_HOVER_Y = -6.25;

/**
 * Small safe pull-out point before fade.
 * It only moves a little out of the case, so it does not clip.
 */
const MB_PULL_OUT_POSITION = new THREE.Vector3(4.2, -0.6, 3.8);

/**
 * After extraction, the motherboard appears here, flat and hovering.
 * User must drag from here into the ring.
 */
const MB_DETACHED_READY_POSITION = new THREE.Vector3(25.8, MB_HOVER_Y, 3.8);

/** Motherboard flat rotation on/above checkerboard */
const MB_FLOOR_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);

/**
 * Motherboard visual center offset.
 * Used for target marker only.
 */
const MB_RING_OFFSET = new THREE.Vector3(-4.2, 0, -1.8);

/** CPU — static seated position on checkerboard */
const CPU_CHECKERBOARD_POSITION = new THREE.Vector3(17.49, -15.80, 0.30);
const CPU_CHECKERBOARD_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);

/** STATIC PART POSITIONS */
const RAM_SEATED_POSITION = new THREE.Vector3(13.73, -24.61, 9.06);
const RAM_SEATED_ROTATION = new THREE.Euler(Math.PI / 2, 0, 0);

const HDD_SEATED_POSITION = new THREE.Vector3(15.50, -16.06, 10.96);
const HDD_SEATED_ROTATION = new THREE.Euler(0, 0, 0);

const SSD_SEATED_POSITION = new THREE.Vector3(12.94, -17.21, 7.36);
const SSD_SEATED_ROTATION = new THREE.Euler(0, 0, 0);

/** PSU — static default floor position */
const PSU_FLOOR_POSITION = new THREE.Vector3(19.38, -15.81, 11.75);
const PSU_ROTATION = new THREE.Euler(0, Math.PI, 0);

/** GUIDE BOARD */
const BOARD_Y        = -14.95;
const BOARD_CENTER_X = 24;
const BOARD_CENTER_Z = 6.5;
const BOARD_SIZE     = 22;
const GRID_DIVISIONS = 11;

/**
 * Smooth non-clipping extraction timing.
 * This avoids physical travel through the case/components.
 */
const MB_EXTRACT_SPEED = 0.9;

/** Target marker position */
const MB_RING_POSITION = new THREE.Vector3(
  MB_FLOOR_POSITION.x + MB_RING_OFFSET.x,
  BOARD_Y + 0.03,
  MB_FLOOR_POSITION.z + MB_RING_OFFSET.z
);

/** ================= HELPERS ================= */

function clamp01(v) {
  return THREE.MathUtils.clamp(v, 0, 1);
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

function setObjectOpacity(root, opacity) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;

    const materials = Array.isArray(o.material) ? o.material : [o.material];

    materials.forEach((mat) => {
      mat.transparent = opacity < 1;
      mat.opacity = opacity;
      mat.depthWrite = opacity >= 0.98;
      mat.needsUpdate = true;
    });
  });
}

function prepareTransparentMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;

    if (Array.isArray(o.material)) {
      o.material = o.material.map((mat) => mat.clone());
    } else {
      o.material = o.material.clone();
    }

    const materials = Array.isArray(o.material) ? o.material : [o.material];

    materials.forEach((mat) => {
      mat.transparent = true;
      mat.opacity = 1;
      mat.depthWrite = true;
      mat.needsUpdate = true;
    });
  });
}

/** ================= SCENE ================= */

function Scene({ placementApi, onComplete }) {
  const { camera } = useThree();
  const snapped = placementApi?.placements?.mbPlaced ?? false;
  const completedRef = useRef(false);

  useEffect(() => {
    if (!snapped) {
      completedRef.current = false;
      return;
    }

    if (completedRef.current) return;

    completedRef.current = true;
    onComplete?.();
  }, [snapped, onComplete]);

  useEffect(() => {
    camera.position.set(...CAMERA_POSITION);
    camera.lookAt(...CONTROL_TARGET);
  }, [camera]);

  return (
    <>
      <color attach="background" args={[typeof document !== "undefined" && document.documentElement.classList.contains("articton-light") ? "#f8f9ff" : "#05080D"]} />

      <ambientLight intensity={0.5} />

      <directionalLight
        position={[6, 10, 6]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      <pointLight position={[-3, 2, -2]} intensity={0.7} />

      <Environment preset="city" />

      <PCCase />
      <StaticAssembly />
      <PlacementGuideBoard snapped={snapped} />

      <MotherboardDraggable
        isPlaced={snapped}
        onPlaced={() => placementApi?.setPlaced?.("mbPlaced")}
        onResetPlaced={() => placementApi?.resetPlaced?.("mbPlaced")}
      />

      <ContactShadows
        position={[BOARD_CENTER_X, BOARD_Y + 0.1, BOARD_CENTER_Z]}
        opacity={0.38}
        scale={42}
        blur={2.8}
        far={30}
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={18}
        maxDistance={90}
        target={CONTROL_TARGET}
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

/** ================= TARGET MARKER ================= */

function TargetMarker() {
  const ringRef = useRef();
  const fillRef = useRef();

  useFrame(({ clock }) => {
    const t = (Math.sin(clock.getElapsedTime() * 2.5) + 1) / 2;

    if (ringRef.current) {
      ringRef.current.scale.setScalar(1 + t * 0.12);
    }

    if (fillRef.current) {
      fillRef.current.material.opacity = 0.08 + t * 0.08;
    }
  });

  return (
    <group
      position={[MB_RING_POSITION.x, MB_RING_POSITION.y, MB_RING_POSITION.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <mesh ref={fillRef} position={[0, 0, 0.005]}>
        <circleGeometry args={[1.15, 64]} />
        <meshBasicMaterial
          color="#FFD41C"
          transparent
          opacity={0.12}
          depthTest={false}
        />
      </mesh>

      <mesh ref={ringRef} position={[0, 0, 0.01]}>
        <ringGeometry args={[0.55, 0.85, 64]} />
        <meshBasicMaterial color="#FFD41C" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

/** ================= GUIDE BOARD ================= */

function PlacementGuideBoard({ snapped }) {
  return (
    <group>
      <mesh
        position={[BOARD_CENTER_X, BOARD_Y, BOARD_CENTER_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshStandardMaterial color="#ffffff" roughness={0.58} metalness={0.02} />
      </mesh>

      <gridHelper
        args={[BOARD_SIZE, GRID_DIVISIONS, "#000000", "#000000"]}
        position={[BOARD_CENTER_X, BOARD_Y + 0.02, BOARD_CENTER_Z]}
      />

      {!snapped && <TargetMarker />}
    </group>
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

/** ================= STATIC ASSEMBLY ================= */
/** Motherboard is excluded because it is the draggable disassembly part. */

function StaticAssembly() {
  const cpuGltf = useGLTF(CPU_URL);
  const ramGltf = useGLTF(RAM_URL);
  const hddGltf = useGLTF(HDD_URL);
  const ssdGltf = useGLTF(SSD_URL);
  const psuGltf = useGLTF(PSU_URL);

  const seatedGroup = useMemo(() => {
    const group = new THREE.Group();

    const cpu = cpuGltf.scene.clone(true);
    cpu.position.copy(CPU_CHECKERBOARD_POSITION);
    cpu.rotation.copy(CPU_CHECKERBOARD_ROTATION);
    group.add(cpu);

    const ram = ramGltf.scene.clone(true);
    ram.position.copy(RAM_SEATED_POSITION);
    ram.rotation.copy(RAM_SEATED_ROTATION);
    group.add(ram);

    const hdd = hddGltf.scene.clone(true);
    hdd.position.copy(HDD_SEATED_POSITION);
    hdd.rotation.copy(HDD_SEATED_ROTATION);
    group.add(hdd);

    const ssd = ssdGltf.scene.clone(true);
    ssd.position.copy(SSD_SEATED_POSITION);
    ssd.rotation.copy(SSD_SEATED_ROTATION);
    group.add(ssd);

    const psu = psuGltf.scene.clone(true);
    psu.position.copy(PSU_FLOOR_POSITION);
    psu.rotation.copy(PSU_ROTATION);
    group.add(psu);

    group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    return group;
  }, [
    cpuGltf.scene,
    ramGltf.scene,
    hddGltf.scene,
    ssdGltf.scene,
    psuGltf.scene,
  ]);

  return <primitive object={seatedGroup} />;
}

/** ================= MOTHERBOARD DRAGGABLE ================= */

function MotherboardDraggable({ isPlaced = false, onPlaced, onResetPlaced }) {
  const { scene } = useGLTF(MB_URL);
  const { gl, camera } = useThree();

  const mbRef = useRef();

  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [detached, setDetached] = useState(isPlaced);
  const [snapped, setSnapped] = useState(isPlaced);
  const [animatingExtract, setAnimatingExtract] = useState(false);
  const [nearTarget, setNearTarget] = useState(false);

  const mouse = useRef(new THREE.Vector2());
  const dragOffset = useRef(new THREE.Vector3());

  const extractProgress = useRef(0);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hitPoint  = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -MB_HOVER_Y),
    []
  );

  const installedQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(MB_SEATED_ROTATION),
    []
  );

  const floorQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(MB_FLOOR_ROTATION),
    []
  );

  const mbClone = useMemo(() => {
    const clone = scene.clone(true);

    prepareTransparentMaterials(clone);

    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    return clone;
  }, [scene]);

  const isPointerOverMotherboard = useCallback(() => {
    if (!mbRef.current) return false;

    raycaster.setFromCamera(mouse.current, camera);
    return raycaster.intersectObject(mbRef.current, true).length > 0;
  }, [camera, raycaster]);

  const getDistanceToTarget = useCallback(() => {
    if (!mbRef.current) return Infinity;

    return new THREE.Vector2(
      mbRef.current.position.x - MB_FLOOR_POSITION.x,
      mbRef.current.position.z - MB_FLOOR_POSITION.z
    ).length();
  }, []);

  const placeMotherboardInstalled = useCallback(() => {
    if (!mbRef.current) return;

    mbRef.current.visible = true;
    mbRef.current.position.copy(MB_SEATED_POSITION);
    mbRef.current.quaternion.copy(installedQuat);
    setObjectOpacity(mbRef.current, 1);
  }, [installedQuat]);

  const placeMotherboardHoverReady = useCallback(() => {
    if (!mbRef.current) return;

    mbRef.current.visible = true;
    mbRef.current.position.copy(MB_DETACHED_READY_POSITION);
    mbRef.current.quaternion.copy(floorQuat);
    setObjectOpacity(mbRef.current, 1);
  }, [floorQuat]);

  const placeMotherboardOnBoard = useCallback(() => {
    if (!mbRef.current) return;

    mbRef.current.visible = true;
    mbRef.current.position.copy(MB_FLOOR_POSITION);
    mbRef.current.quaternion.copy(floorQuat);
    setObjectOpacity(mbRef.current, 1);
  }, [floorQuat]);

  const startSmoothExtract = useCallback(() => {
    if (!mbRef.current) return;

    extractProgress.current = 0;

    setDetached(true);
    setDragging(false);
    setSnapped(false);
    setAnimatingExtract(true);
    setHovered(false);
    setNearTarget(false);

    document.body.style.cursor = "default";
  }, []);

  const updateMouse = useCallback(
    (e) => {
      const rect = gl.domElement.getBoundingClientRect();

      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    },
    [gl]
  );

  useEffect(() => {
    if (!mbRef.current) return;

    mbRef.current.scale.setScalar(ASSEMBLY_SCALE);

    if (isPlaced) {
      placeMotherboardOnBoard();
      setDetached(true);
      setSnapped(true);
      setAnimatingExtract(false);
      setNearTarget(false);
    } else {
      placeMotherboardInstalled();
      setDetached(false);
      setSnapped(false);
      setAnimatingExtract(false);
        setNearTarget(false);
    }
  }, [isPlaced, placeMotherboardInstalled, placeMotherboardOnBoard]);

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (e.button !== 0 || !mbRef.current) return;

      updateMouse(e);

      if (animatingExtract) return;

      const hitMotherboard = isPointerOverMotherboard();

      if (!detached && !snapped) {
        if (hitMotherboard) {
          startSmoothExtract();
        }
        return;
      }

      if (snapped) return;

      if (!dragging) {
        if (!hitMotherboard && !nearTarget) return;

        const dist = getDistanceToTarget();

        if (dist < SNAP_DISTANCE * 1.25) {
          placeMotherboardOnBoard();
          setSnapped(true);
          setHovered(false);
          setNearTarget(false);
          document.body.style.cursor = "default";
          onPlaced?.();
          return;
        }

        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.set(
            mbRef.current.position.x - hitPoint.x,
            0,
            mbRef.current.position.z - hitPoint.z
          );
        }

        setDragging(true);
        document.body.style.cursor = "grabbing";
      } else {
        setDragging(false);

        const dist = getDistanceToTarget();

        if (dist < SNAP_DISTANCE * 1.25) {
          placeMotherboardOnBoard();
          setSnapped(true);
          setHovered(false);
          setNearTarget(false);
          document.body.style.cursor = "default";
          onPlaced?.();
        } else {
          document.body.style.cursor = "grab";
        }
      }
    };

    gl.domElement.addEventListener("pointerdown", handlePointerDown);

    return () => {
      gl.domElement.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [
    animatingExtract,
    camera,
    detached,
    dragPlane,
    dragging,
    getDistanceToTarget,
    gl,
    hitPoint,
    isPointerOverMotherboard,
    nearTarget,
    onPlaced,
    placeMotherboardOnBoard,
    raycaster,
    snapped,
    startSmoothExtract,
    updateMouse,
  ]);

  useEffect(() => {
    const handlePointerMove = (e) => {
      updateMouse(e);

      if (!mbRef.current || animatingExtract || snapped) {
        setHovered(false);
        document.body.style.cursor = dragging ? "grabbing" : "default";
        return;
      }

      const hitMotherboard = isPointerOverMotherboard();
      setHovered(hitMotherboard || dragging);

      if (dragging) {
        document.body.style.cursor = "grabbing";
      } else if (hitMotherboard) {
        document.body.style.cursor = detached ? "grab" : "pointer";
      } else if (nearTarget) {
        document.body.style.cursor = "pointer";
      } else {
        document.body.style.cursor = "default";
      }
    };

    const preventContextMenu = (e) => e.preventDefault();

    gl.domElement.addEventListener("pointermove", handlePointerMove);
    gl.domElement.addEventListener("contextmenu", preventContextMenu);

    return () => {
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
      gl.domElement.removeEventListener("contextmenu", preventContextMenu);
      document.body.style.cursor = "default";
    };
  }, [
    animatingExtract,
    detached,
    dragging,
    gl,
    isPointerOverMotherboard,
    nearTarget,
    snapped,
    updateMouse,
  ]);

  useFrame((_, delta) => {
    if (!mbRef.current) return;

    if (animatingExtract) {
      extractProgress.current = Math.min(
        extractProgress.current + delta * MB_EXTRACT_SPEED,
        1
      );

      const rawT = extractProgress.current;

      /**
       * Phase 1: tiny safe physical pull-out.
       * No clipping because it only moves slightly from the installed position.
       */
      if (rawT < 0.32) {
        const t = easeInOutCubic(rawT / 0.32);

        mbRef.current.visible = true;
        mbRef.current.position.lerpVectors(
          MB_SEATED_POSITION,
          MB_PULL_OUT_POSITION,
          t
        );
        mbRef.current.quaternion.slerpQuaternions(
          installedQuat,
          installedQuat,
          t
        );
        setObjectOpacity(mbRef.current, 1);
      }

      /**
       * Phase 2: fade out before any clipping can happen.
       */
      else if (rawT < 0.50) {
        const t = easeOutQuart((rawT - 0.32) / 0.18);

        mbRef.current.position.copy(MB_PULL_OUT_POSITION);
        mbRef.current.quaternion.copy(installedQuat);
        setObjectOpacity(mbRef.current, 1 - t);
      }

      /**
       * Phase 3: invisible reposition to safe hover position.
       */
      else if (rawT < 0.58) {
        mbRef.current.visible = false;
        mbRef.current.position.copy(MB_DETACHED_READY_POSITION);
        mbRef.current.quaternion.copy(floorQuat);
        setObjectOpacity(mbRef.current, 0);
      }

      /**
       * Phase 4: fade back in flat and safely above the components.
       */
      else {
        const t = easeOutQuart((rawT - 0.58) / 0.42);

        mbRef.current.visible = true;
        mbRef.current.position.copy(MB_DETACHED_READY_POSITION);
        mbRef.current.quaternion.copy(floorQuat);
        setObjectOpacity(mbRef.current, t);
      }

      if (rawT >= 1) {
        placeMotherboardHoverReady();

        setAnimatingExtract(false);
        setSnapped(false);
        setDragging(false);
        setHovered(false);
        setNearTarget(false);
      }
    } else if (!detached && !snapped) {
      mbRef.current.position.lerp(MB_SEATED_POSITION, 0.2);
      mbRef.current.quaternion.slerp(installedQuat, 0.2);
      setObjectOpacity(mbRef.current, 1);
    } else if (snapped) {
      mbRef.current.position.lerp(MB_FLOOR_POSITION, 0.28);
      mbRef.current.quaternion.slerp(floorQuat, 0.35);
      setObjectOpacity(mbRef.current, 1);
    } else {
      const dist = getDistanceToTarget();
      const magnetT = THREE.MathUtils.clamp(1 - dist / MAGNET_DISTANCE, 0, 1);

      setNearTarget(dist < MAGNET_DISTANCE);

      mbRef.current.quaternion.slerp(floorQuat, 0.08 + magnetT * 0.22);
      setObjectOpacity(mbRef.current, 1);

      if (dragging) {
        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          const target = new THREE.Vector3(
            hitPoint.x + dragOffset.current.x,
            MB_HOVER_Y,
            hitPoint.z + dragOffset.current.z
          );

          mbRef.current.position.lerp(target, 0.35);
        }
      }

      if (dist < MAGNET_DISTANCE && dragging) {
        const pull = MAGNET_STRENGTH + magnetT * 0.18;

        const snapTarget = new THREE.Vector3(
          MB_FLOOR_POSITION.x,
          MB_HOVER_Y,
          MB_FLOOR_POSITION.z
        );

        mbRef.current.position.lerp(snapTarget, pull);
        mbRef.current.quaternion.slerp(floorQuat, 0.18 + magnetT * 0.18);
      }
    }
  });

  return (
    <group>
      <group ref={mbRef}>
        <primitive object={mbClone} />
      </group>

      {snapped && (
        <ResetMotherboardButton
          onReset={() => {
            placeMotherboardInstalled();

            setDetached(false);
            setSnapped(false);
            setDragging(false);
            setAnimatingExtract(false);
            setHovered(false);
            setNearTarget(false);
        
            document.body.style.cursor = "default";
            onResetPlaced?.();
          }}
        />
      )}
    </group>
  );
}

/** ================= RESET BUTTON ================= */

function ResetMotherboardButton({ onReset }) {
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
        Reset Motherboard
      </button>
    </Html>
  );
}

/** ================= EXPORT ================= */

export default function DisassemblyMotherboard({ placementApi, onComplete }) {
  return (
    <Canvas
      shadows
      style={{ width: "100%", height: "100%" }}
      camera={{ position: CAMERA_POSITION, fov: 50 }}
    >
      <Suspense fallback={null}>
        <Scene
          placementApi={placementApi}
          onComplete={onComplete}
        />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(CASE_URL);
useGLTF.preload(MB_URL);
useGLTF.preload(CPU_URL);
useGLTF.preload(RAM_URL);
useGLTF.preload(SSD_URL);
useGLTF.preload(HDD_URL);
useGLTF.preload(PSU_URL);
