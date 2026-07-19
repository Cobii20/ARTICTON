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
const MB_URL = "/models/MB(BLENDER).glb";
const CPU_URL = "/models/CPU(BLENDER).glb";
const RAM_URL = "/models/RAM(BLENDER).glb";
const SSD_URL = "/models/SSD(BLENDER).glb";

/** CAMERA */
const CAMERA_POSITION = [45, 18, 18];
const CONTROL_TARGET = [24, -14, 7];

/** SNAP / MAGNET */
const SNAP_DISTANCE = 0.75;
const MAGNET_DISTANCE = 3.2;
const MAGNET_STRENGTH = 0.22;

/** WORK AREA */
const BOARD_Y = -14.95;
const BOARD_CENTER_X = 24;
const BOARD_CENTER_Z = 6.5;
const BOARD_SIZE = 22;
const GRID_DIVISIONS = 11;

/** MOTHERBOARD POSITION ON WORKBENCH */
const MB_POSITION = new THREE.Vector3(33.54, -14.87, 11.32);
const MB_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const MB_SCALE = 1;

/**
 * ALREADY-INSTALLED CPU POSITION
 * Same seated position from CPUtoMB.jsx.
 */
const CPU_SEATED_POSITION = new THREE.Vector3(27.91, -15.49, 6.98);
const CPU_ROTATION = new THREE.Euler(0, Math.PI, 0);

/**
 * ALREADY-INSTALLED RAM POSITION
 * Same seated position from RAMtoMB.jsx.
 */
const RAM_SEATED_POSITION = new THREE.Vector3(34.35, -20.74, 11.32);
const RAM_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);

/**
 * SSD START POSITION
 * This is where the SSD begins before being dragged.
 */
const SSD_START_POSITION = new THREE.Vector3(18.2, -17.03, 1.2);

/**
 * SSD DRAG Y LOCK
 * Provided from your scene.
 */
const SSD_DRAG_Y_LOCK = -17.03;

/**
 * SSD FINAL SEATED POSITION
 * Provided from your scene.
 */
const SSD_SEATED_POSITION = new THREE.Vector3(24.39, -17.03, 11.26);

/**
 * SSD HIGHLIGHT POSITION
 * This controls only the yellow highlight.
 * It is centered on the final seated SSD position.
 */
const SSD_HIGHLIGHT_POSITION = new THREE.Vector3(24.39, -16.98, 11.26);

/**
 * SSD ROTATION
 * Change both values together while testing.
 */
const SSD_START_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
const SSD_TARGET_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);

const SSD_COLOR = "#ffcc00";

function cloneScene(scene, transparent = false) {
  const clone = scene.clone(true);

  clone.traverse((o) => {
    if (!o.isMesh) return;

    o.castShadow = true;
    o.receiveShadow = true;

    if (transparent && o.material) {
      if (Array.isArray(o.material)) {
        o.material = o.material.map((mat) => mat.clone());
      } else {
        o.material = o.material.clone();
      }
    }
  });

  return clone;
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

function Scene({ onComplete }) {
  const { camera } = useThree();
  const [ssdPlaced, setSsdPlaced] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!ssdPlaced) {
      completedRef.current = false;
      return;
    }

    if (completedRef.current) return;

    completedRef.current = true;
    onComplete?.();
  }, [ssdPlaced, onComplete]);

  useEffect(() => {
    camera.position.set(...CAMERA_POSITION);
    camera.lookAt(...CONTROL_TARGET);
  }, [camera]);

  return (
    <>
      <color attach="background" args={["#05080D"]} />

      <ambientLight intensity={0.55} />

      <directionalLight
        position={[6, 10, 6]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      <pointLight position={[-3, 2, -2]} intensity={0.7} />

      <Environment preset="city" />

      <WorkBoard />
      <Motherboard />
      <InstalledCPU />
      <InstalledRAM />

      <SsdTarget placed={ssdPlaced} />
      <SSDDraggable
        placed={ssdPlaced}
        onPlaced={() => setSsdPlaced(true)}
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
        minDistance={14}
        maxDistance={75}
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

function WorkBoard() {
  return (
    <group>
      <mesh
        position={[BOARD_CENTER_X, BOARD_Y, BOARD_CENTER_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshStandardMaterial color="#f6f7fb" roughness={0.58} metalness={0.02} />
      </mesh>

      <gridHelper
        args={[BOARD_SIZE, GRID_DIVISIONS, "#050505", "#050505"]}
        position={[BOARD_CENTER_X, BOARD_Y + 0.02, BOARD_CENTER_Z]}
      />
    </group>
  );
}

function Motherboard() {
  const { scene } = useGLTF(MB_URL);
  const mbClone = useMemo(() => cloneScene(scene, true), [scene]);

  useEffect(() => {
    setObjectOpacity(mbClone, 1);
  }, [mbClone]);

  return (
    <group position={MB_POSITION} rotation={MB_ROTATION.toArray()} scale={MB_SCALE}>
      <primitive object={mbClone} />
    </group>
  );
}

function InstalledCPU() {
  const { scene } = useGLTF(CPU_URL);
  const cpuClone = useMemo(() => cloneScene(scene, true), [scene]);

  const cpuQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(CPU_ROTATION),
    []
  );

  useEffect(() => {
    setObjectOpacity(cpuClone, 1);
  }, [cpuClone]);

  return (
    <group position={CPU_SEATED_POSITION} quaternion={cpuQuat} scale={1}>
      <primitive object={cpuClone} />
    </group>
  );
}

function InstalledRAM() {
  const { scene } = useGLTF(RAM_URL);
  const ramClone = useMemo(() => cloneScene(scene, true), [scene]);

  const ramQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(RAM_ROTATION),
    []
  );

  useEffect(() => {
    setObjectOpacity(ramClone, 1);
  }, [ramClone]);

  return (
    <group position={RAM_SEATED_POSITION} quaternion={ramQuat} scale={1}>
      <primitive object={ramClone} />
    </group>
  );
}

function SsdTarget({ placed }) {
  const ringRef = useRef();
  const fillRef = useRef();

  useFrame(({ clock }) => {
    if (placed) return;

    const t = (Math.sin(clock.getElapsedTime() * 2.5) + 1) / 2;

    if (ringRef.current) {
      ringRef.current.scale.setScalar(1 + t * 0.12);
      ringRef.current.material.opacity = 0.5 + t * 0.35;
    }

    if (fillRef.current) {
      fillRef.current.material.opacity = 0.16 + t * 0.16;
    }
  });

  return (
    <group
      position={[
        SSD_HIGHLIGHT_POSITION.x,
        SSD_HIGHLIGHT_POSITION.y,
        SSD_HIGHLIGHT_POSITION.z,
      ]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <mesh ref={fillRef}>
        <planeGeometry args={[1.6, 2.35]} />
        <meshBasicMaterial
          color={SSD_COLOR}
          transparent
          opacity={placed ? 0.16 : 0.24}
          depthTest={false}
        />
      </mesh>

      {!placed && (
        <mesh ref={ringRef} position={[0, 0, 0.015]}>
          <ringGeometry args={[0.38, 0.72, 48]} />
          <meshBasicMaterial
            color={SSD_COLOR}
            transparent
            opacity={0.85}
            depthTest={false}
          />
        </mesh>
      )}

      {!placed && (
        <Html center position={[0, -0.05, 0.03]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              padding: "4px 8px",
              borderRadius: 999,
              background: "rgba(10,14,22,.86)",
              border: `1px solid ${SSD_COLOR}aa`,
              color: "rgba(244,248,255,.95)",
              fontSize: 10,
              fontFamily: "monospace",
              whiteSpace: "nowrap",
              transform: "translateY(-18px)",
            }}
          >
            Target: SSD slot
          </div>
        </Html>
      )}
    </group>
  );
}

function SSDDraggable({ placed, onPlaced }) {
  const { scene } = useGLTF(SSD_URL);
  const { gl, camera } = useThree();

  const ssdRef = useRef();
  const mouse = useRef(new THREE.Vector2());
  const dragOffset = useRef(new THREE.Vector3());

  const [dragging, setDragging] = useState(false);
  const [snapped, setSnapped] = useState(placed);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);

  const dragPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -SSD_DRAG_Y_LOCK),
    []
  );

  const startQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(SSD_START_ROTATION),
    []
  );

  const targetQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(SSD_TARGET_ROTATION),
    []
  );

  const ssdClone = useMemo(() => cloneScene(scene, true), [scene]);

  const updateMouse = useCallback(
    (e) => {
      const rect = gl.domElement.getBoundingClientRect();

      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    },
    [gl]
  );

  const isPointerOverSSD = useCallback(() => {
    if (!ssdRef.current) return false;

    raycaster.setFromCamera(mouse.current, camera);
    return raycaster.intersectObject(ssdRef.current, true).length > 0;
  }, [camera, raycaster]);

  const moveToStart = useCallback(() => {
    if (!ssdRef.current) return;

    ssdRef.current.position.copy(SSD_START_POSITION);
    ssdRef.current.quaternion.copy(startQuat);
    setObjectOpacity(ssdRef.current, 1);
  }, [startQuat]);

  const moveToSeatedPosition = useCallback(() => {
    if (!ssdRef.current) return;

    ssdRef.current.position.copy(SSD_SEATED_POSITION);
    ssdRef.current.quaternion.copy(targetQuat);
    setObjectOpacity(ssdRef.current, 1);
  }, [targetQuat]);

  useEffect(() => {
    if (!ssdRef.current) return;

    ssdRef.current.scale.setScalar(1);

    if (placed) {
      moveToSeatedPosition();
      setSnapped(true);
      setDragging(false);
    } else {
      moveToStart();
      setSnapped(false);
      setDragging(false);
    }
  }, [placed, moveToStart, moveToSeatedPosition]);

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (e.button !== 0 || !ssdRef.current || snapped) return;

      updateMouse(e);

      const hitSSD = isPointerOverSSD();

      if (!hitSSD && !dragging) return;

      if (!dragging) {
        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.set(
            ssdRef.current.position.x - hitPoint.x,
            0,
            ssdRef.current.position.z - hitPoint.z
          );
        }

        setDragging(true);
        document.body.style.cursor = "grabbing";
      } else {
        setDragging(false);
        document.body.style.cursor = "default";

        const dist = new THREE.Vector2(
          ssdRef.current.position.x - SSD_SEATED_POSITION.x,
          ssdRef.current.position.z - SSD_SEATED_POSITION.z
        ).length();

        if (dist < SNAP_DISTANCE * 1.25) {
          moveToSeatedPosition();
          setSnapped(true);
          onPlaced?.();
        }
      }
    };

    gl.domElement.addEventListener("pointerdown", handlePointerDown);

    return () => {
      gl.domElement.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [
    camera,
    dragPlane,
    dragging,
    gl,
    hitPoint,
    isPointerOverSSD,
    moveToSeatedPosition,
    onPlaced,
    raycaster,
    snapped,
    updateMouse,
  ]);

  useEffect(() => {
    const handlePointerMove = (e) => updateMouse(e);
    const preventContext = (e) => e.preventDefault();

    gl.domElement.addEventListener("pointermove", handlePointerMove);
    gl.domElement.addEventListener("contextmenu", preventContext);

    return () => {
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
      gl.domElement.removeEventListener("contextmenu", preventContext);
      document.body.style.cursor = "default";
    };
  }, [gl, updateMouse]);

  useFrame(() => {
    if (!ssdRef.current) return;

    if (snapped) {
      ssdRef.current.position.lerp(SSD_SEATED_POSITION, 0.28);
      ssdRef.current.quaternion.slerp(targetQuat, 0.28);
    } else {
      ssdRef.current.quaternion.slerp(targetQuat, 0.08);

      if (dragging) {
        raycaster.setFromCamera(mouse.current, camera);

        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          const targetDragPosition = new THREE.Vector3(
            hitPoint.x + dragOffset.current.x,
            SSD_DRAG_Y_LOCK,
            hitPoint.z + dragOffset.current.z
          );

          ssdRef.current.position.lerp(targetDragPosition, 0.35);
        }
      }

      ssdRef.current.position.y = SSD_DRAG_Y_LOCK;

      const dist = new THREE.Vector2(
        ssdRef.current.position.x - SSD_SEATED_POSITION.x,
        ssdRef.current.position.z - SSD_SEATED_POSITION.z
      ).length();

      if (dist < MAGNET_DISTANCE) {
        const pull = MAGNET_STRENGTH + (1 - dist / MAGNET_DISTANCE) * 0.22;

        const snapTarget = new THREE.Vector3(
          SSD_SEATED_POSITION.x,
          SSD_DRAG_Y_LOCK,
          SSD_SEATED_POSITION.z
        );

        ssdRef.current.position.lerp(snapTarget, pull);
        ssdRef.current.quaternion.slerp(targetQuat, pull);

        if (dist < SNAP_DISTANCE) {
          moveToSeatedPosition();
          setSnapped(true);
          setDragging(false);
          document.body.style.cursor = "default";
          onPlaced?.();
        }
      }
    }
  });

  return (
    <group>
      <group ref={ssdRef}>
        <primitive object={ssdClone} />
      </group>
    </group>
  );
}

export default function SSDtoMB({ onComplete }) {
  return (
    <Canvas
      shadows
      style={{ width: "100%", height: "100%" }}
      camera={{ position: CAMERA_POSITION, fov: 50 }}
    >
      <Scene
        onComplete={onComplete}
      />
    </Canvas>
  );
}

useGLTF.preload(MB_URL);
useGLTF.preload(CPU_URL);
useGLTF.preload(RAM_URL);
useGLTF.preload(SSD_URL);