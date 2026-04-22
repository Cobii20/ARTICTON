import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  OrbitControls,
  ContactShadows,
  Html,
  useGLTF,
} from "@react-three/drei";

/** ================= MODEL URLS ================= */
const CPU_URL = "/models/CPU(BLENDER).glb";
const MB_URL = "/models/MB(BLENDER).glb";
const RAM_URL = "/models/RAM(BLENDER).glb";
const SSD_URL = "/models/SSD(BLENDER).glb";
const HDD_URL = "/models/HDD(BLENDER).glb";
const PSU_URL = "/models/PSU(BLENDER).glb";
const CASE_URL = "/models/PC CASE(BLENDER).glb";

/** ================= SETTINGS ================= */
const SNAP_DISTANCE = 0.12;
const MAGNET_DISTANCE = 1.25;
const MAGNET_STRENGTH = 1.8;

const CASE_POSITION = new THREE.Vector3(0, -15, 0);
const CASE_ROTATION = new THREE.Euler(0, 0, 0);

const MB_SEATED_POSITION = new THREE.Vector3(-0.6, -0.6, 2.99);
const MB_ROTATION = new THREE.Euler(0, 0, -Math.PI / 2);

/** motherboard parts seated positions */
const CPU_SEATED_POSITION = new THREE.Vector3(-1.25, -4.95, -2.66);
const CPU_ROTATION = new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2);

const RAM_SEATED_POSITION = new THREE.Vector3(-6.44, -0.59, 3.79);
const RAM_ROTATION = new THREE.Euler(0, 0, -Math.PI / 2);

const SSD_SEATED_POSITION = new THREE.Vector3(-2.75, -0.66, -6.24);
const SSD_ROTATION = new THREE.Euler(0, 0, -Math.PI / 2);

/** motherboard build starting positions */
const CPU_START_POSITION = new THREE.Vector3(3, -4.95, -2.66);
const RAM_START_POSITION = new THREE.Vector3(3, -0.59, 3.79);
const SSD_START_POSITION = new THREE.Vector3(3, -0.66, -6.24);

/** motherboard assembly to case */
const MB_ASSEMBLY_START_POSITION = new THREE.Vector3(-0.6, -12, 24);

/** HDD */
const HDD_LOCK_X = 4.16;
const HDD_LOCK_Y = -14.32;
const HDD_SEATED_POSITION = new THREE.Vector3(4.16, -14.32, -0.49);
const HDD_START_POSITION = new THREE.Vector3(4.16, -14.32, 15);
const HDD_ROTATION = new THREE.Euler(0, 0, 0);

/** PSU */
const PSU_LOCK_X = 4.27;
const PSU_LOCK_Y = -15.66;
const PSU_SEATED_POSITION = new THREE.Vector3(4.27, -15.66, 6.22);
const PSU_START_POSITION = new THREE.Vector3(4.27, -15.66, 15);
const PSU_ROTATION = new THREE.Euler(0, Math.PI, 0);

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

function quatFromEuler(euler) {
  return new THREE.Quaternion().setFromEuler(euler);
}

function getLocalTransform(worldPosition, worldRotation) {
  const root = new THREE.Group();
  root.position.copy(MB_SEATED_POSITION);
  root.quaternion.copy(quatFromEuler(MB_ROTATION));

  const child = new THREE.Object3D();
  child.position.copy(worldPosition);
  child.quaternion.copy(quatFromEuler(worldRotation));
  root.add(child);

  root.updateMatrixWorld(true);
  child.updateMatrixWorld(true);

  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const localMatrix = new THREE.Matrix4().multiplyMatrices(inv, child.matrixWorld);

  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  localMatrix.decompose(pos, quat, scale);

  return { position: pos, quaternion: quat };
}

const CPU_LOCAL = getLocalTransform(CPU_SEATED_POSITION, CPU_ROTATION);
const RAM_LOCAL = getLocalTransform(RAM_SEATED_POSITION, RAM_ROTATION);
const SSD_LOCAL = getLocalTransform(SSD_SEATED_POSITION, SSD_ROTATION);

/** ================= UI ================= */
function GuidePanel({ step, installed, onReset }) {
  const titles = {
    cpu: "Install CPU",
    ram: "Install RAM",
    ssd: "Install SSD",
    motherboard: "Mount Motherboard",
    hdd: "Install HDD",
    psu: "Install PSU",
    done: "Build Complete",
  };

  const hints = {
    cpu: "Drag the CPU onto the motherboard.",
    ram: "Drag the RAM into its slot.",
    ssd: "Drag the SSD onto the motherboard.",
    motherboard:
      "Drag the full motherboard assembly. Hold W to move forward and S to move backward.",
    hdd: "Drag the HDD into the case bay.",
    psu: "Drag the PSU into the case.",
    done: "All major components are installed.",
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 20,
        width: 290,
        padding: 16,
        borderRadius: 24,
        background: "rgba(5,10,18,.78)",
        border: "1px solid rgba(140,255,230,.16)",
        backdropFilter: "blur(10px)",
        color: "#eef4ff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: ".22em", color: "#7ee7d8", marginBottom: 10 }}>
        PC BUILD GUIDE
      </div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{titles[step]}</div>
      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8, lineHeight: 1.4 }}>
        {hints[step]}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginTop: 16,
        }}
      >
        {[
          ["CPU", installed.cpu],
          ["RAM", installed.ram],
          ["SSD", installed.ssd],
          ["Motherboard", installed.motherboard],
          ["HDD", installed.hdd],
          ["PSU", installed.psu],
        ].map(([label, done]) => (
          <div
            key={label}
            style={{
              borderRadius: 16,
              padding: "10px 12px",
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.72 }}>{label}</div>
            <div style={{ fontSize: 13, color: done ? "#5de6a5" : "#f4cf58" }}>
              {done ? "Installed" : "Pending"}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onReset}
        style={{
          marginTop: 16,
          width: "100%",
          padding: "12px 14px",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.1)",
          background: "rgba(255,255,255,.08)",
          color: "#eef4ff",
          cursor: "pointer",
        }}
      >
        Reset Full Build
      </button>
    </div>
  );
}

function CameraController({ step }) {
  const { camera } = useThree();

  useEffect(() => {
    const presets = {
      cpu: { pos: [0, 6, 10], target: [0, 0, 0] },
      ram: { pos: [0, 6, 10], target: [0, 0, 0] },
      ssd: { pos: [0, 6, 12], target: [0, 0, 0] },
      motherboard: { pos: [0, 10, 24], target: [0, -10, 0] },
      hdd: { pos: [0, 10, 22], target: [0, -10, 0] },
      psu: { pos: [0, 10, 24], target: [0, -10, 0] },
      done: { pos: [0, 12, 28], target: [0, -8, 0] },
    };

    const preset = presets[step];
    camera.position.set(...preset.pos);
    camera.lookAt(...preset.target);
    camera.updateProjectionMatrix();
  }, [camera, step]);

  return null;
}

/** ================= STATIC SCENE PIECES ================= */
function PCCase() {
  const { scene } = useGLTF(CASE_URL);
  const clone = useMemo(() => cloneWithShadows(scene), [scene]);

  return (
    <group position={CASE_POSITION} rotation={CASE_ROTATION.toArray()}>
      <primitive object={clone} />
    </group>
  );
}

function MotherboardBase() {
  const { scene } = useGLTF(MB_URL);
  const clone = useMemo(() => cloneWithShadows(scene), [scene]);

  return (
    <group position={MB_SEATED_POSITION} rotation={MB_ROTATION.toArray()}>
      <primitive object={clone} />
    </group>
  );
}

function StaticModel({ url, position, rotation }) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => cloneWithShadows(scene), [scene]);

  return (
    <group position={position} rotation={rotation.toArray()}>
      <primitive object={clone} />
    </group>
  );
}

function SeatedMotherboardAssembly() {
  const mb = useGLTF(MB_URL);
  const cpu = useGLTF(CPU_URL);
  const ram = useGLTF(RAM_URL);
  const ssd = useGLTF(SSD_URL);

  const assembly = useMemo(() => {
    const root = new THREE.Group();

    root.add(cloneWithShadows(mb.scene));

    const cpuClone = cloneWithShadows(cpu.scene);
    cpuClone.position.copy(CPU_LOCAL.position);
    cpuClone.quaternion.copy(CPU_LOCAL.quaternion);
    root.add(cpuClone);

    const ramClone = cloneWithShadows(ram.scene);
    ramClone.position.copy(RAM_LOCAL.position);
    ramClone.quaternion.copy(RAM_LOCAL.quaternion);
    root.add(ramClone);

    const ssdClone = cloneWithShadows(ssd.scene);
    ssdClone.position.copy(SSD_LOCAL.position);
    ssdClone.quaternion.copy(SSD_LOCAL.quaternion);
    root.add(ssdClone);

    return root;
  }, [mb.scene, cpu.scene, ram.scene, ssd.scene]);

  return (
    <group position={MB_SEATED_POSITION} rotation={MB_ROTATION.toArray()}>
      <primitive object={assembly} />
    </group>
  );
}

/** ================= GENERIC DRAG TO TARGET ================= */
function DragToTarget({
  url,
  active,
  installed,
  onInstalled,
  startPosition,
  seatedPosition,
  startRotation,
  seatedRotation,
  label,
  subtitle,
  htmlPosition = [0, 2, 0],
  lockX,
  lockY,
}) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => cloneWithShadows(scene), [scene]);
  const ref = useRef();
  const { camera, gl } = useThree();

  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, z: 0 });
  const [distance, setDistance] = useState(null);

  const dragOffset = useRef(new THREE.Vector3());
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(() => new THREE.Plane(), []);
  const startQuat = useMemo(() => quatFromEuler(startRotation), [startRotation]);
  const seatedQuat = useMemo(() => quatFromEuler(seatedRotation), [seatedRotation]);

  useEffect(() => {
    if (!ref.current) return;

    if (installed) {
      ref.current.position.copy(seatedPosition);
      ref.current.quaternion.copy(seatedQuat);
    } else {
      ref.current.position.copy(startPosition);
      ref.current.quaternion.copy(startQuat);
    }

    if (typeof lockX === "number") ref.current.position.x = lockX;
    if (typeof lockY === "number") ref.current.position.y = lockY;
  }, [installed, seatedPosition, seatedQuat, startPosition, startQuat, lockX, lockY]);

  useEffect(() => {
    const move = (e) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    gl.domElement.addEventListener("pointermove", move);
    return () => gl.domElement.removeEventListener("pointermove", move);
  }, [gl, mouse]);

  useEffect(() => {
    const prevent = (e) => e.preventDefault();
    gl.domElement.addEventListener("contextmenu", prevent);
    return () => gl.domElement.removeEventListener("contextmenu", prevent);
  }, [gl]);

  useEffect(() => {
    const onDown = (e) => {
      if (!active || installed || e.button !== 0 || !ref.current) return;

      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (!dragging) {
        const normal = new THREE.Vector3();
        camera.getWorldDirection(normal);
        dragPlane.setFromNormalAndCoplanarPoint(normal, ref.current.position);

        raycaster.setFromCamera(mouse, camera);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.copy(ref.current.position).sub(hitPoint);
        }

        setDragging(true);
        document.body.style.cursor = "grabbing";
      } else {
        setDragging(false);
        document.body.style.cursor = "default";
      }
    };

    gl.domElement.addEventListener("pointerdown", onDown);
    return () => gl.domElement.removeEventListener("pointerdown", onDown);
  }, [active, installed, dragging, gl, camera, mouse, raycaster, hitPoint, dragPlane]);

  useFrame(() => {
    if (!ref.current) return;

    if (installed) {
      ref.current.position.lerp(seatedPosition, 0.22);
      ref.current.quaternion.slerp(seatedQuat, 0.22);
      if (typeof lockX === "number") ref.current.position.x = lockX;
      if (typeof lockY === "number") ref.current.position.y = lockY;
      setDistance(null);
    } else if (active) {
      if (dragging) {
        raycaster.setFromCamera(mouse, camera);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          const target = hitPoint.clone().add(dragOffset.current);
          if (typeof lockX === "number") target.x = lockX;
          if (typeof lockY === "number") target.y = lockY;
          ref.current.position.lerp(target, 0.28);
        }
      }

      if (typeof lockX === "number") ref.current.position.x = lockX;
      if (typeof lockY === "number") ref.current.position.y = lockY;

      const dist = ref.current.position.distanceTo(seatedPosition);
      setDistance(dragging ? dist : null);

      if (dist < MAGNET_DISTANCE) {
        const t = 1 - dist / MAGNET_DISTANCE;
        const pull = MAGNET_STRENGTH * (t * t + 0.2);
        ref.current.position.lerp(seatedPosition, pull);

        if (typeof lockX === "number") ref.current.position.x = lockX;
        if (typeof lockY === "number") ref.current.position.y = lockY;

        if (dist < SNAP_DISTANCE) {
          setDragging(false);
          document.body.style.cursor = "default";
          onInstalled();
        }
      }
    }

    const world = new THREE.Vector3();
    ref.current.getWorldPosition(world);
    setPos({ x: world.x, y: world.y, z: world.z });
  });

  if (installed || !active) return null;

  return (
    <group ref={ref}>
      <primitive object={clone} />
      <Html position={htmlPosition} center>
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
            minWidth: 160,
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>{subtitle}</div>
          <div>{dragging ? `Dragging ${label}` : "Click to Grab"}</div>
          <div style={{ marginTop: 6 }}>────────</div>
          <div>x: {pos.x.toFixed(2)}</div>
          <div>y: {pos.y.toFixed(2)}</div>
          <div>z: {pos.z.toFixed(2)}</div>
          {distance !== null && <div style={{ marginTop: 4 }}>d: {distance.toFixed(2)}</div>}
        </div>
      </Html>
    </group>
  );
}

/** ================= MOTHERBOARD ASSEMBLY TO CASE ================= */
function MotherboardAssemblyDraggable({ active, installed, onInstalled }) {
  const mb = useGLTF(MB_URL);
  const cpu = useGLTF(CPU_URL);
  const ram = useGLTF(RAM_URL);
  const ssd = useGLTF(SSD_URL);

  const ref = useRef();
  const { camera, gl } = useThree();

  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, z: 0 });
  const [distance, setDistance] = useState(null);

  const dragOffset = useRef(new THREE.Vector3());
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(() => new THREE.Plane(), []);
  const keys = useRef({ w: false, s: false });
  const zControl = useRef(MB_ASSEMBLY_START_POSITION.z);

  const startQuat = useMemo(() => quatFromEuler(MB_ROTATION), []);
  const seatedQuat = useMemo(() => quatFromEuler(MB_ROTATION), []);

  const assembly = useMemo(() => {
    const root = new THREE.Group();

    root.add(cloneWithShadows(mb.scene));

    const cpuClone = cloneWithShadows(cpu.scene);
    cpuClone.position.copy(CPU_LOCAL.position);
    cpuClone.quaternion.copy(CPU_LOCAL.quaternion);
    root.add(cpuClone);

    const ramClone = cloneWithShadows(ram.scene);
    ramClone.position.copy(RAM_LOCAL.position);
    ramClone.quaternion.copy(RAM_LOCAL.quaternion);
    root.add(ramClone);

    const ssdClone = cloneWithShadows(ssd.scene);
    ssdClone.position.copy(SSD_LOCAL.position);
    ssdClone.quaternion.copy(SSD_LOCAL.quaternion);
    root.add(ssdClone);

    return root;
  }, [mb.scene, cpu.scene, ram.scene, ssd.scene]);

  useEffect(() => {
    if (!ref.current) return;

    if (installed) {
      ref.current.position.copy(MB_SEATED_POSITION);
      ref.current.quaternion.copy(seatedQuat);
    } else {
      ref.current.position.copy(MB_ASSEMBLY_START_POSITION);
      ref.current.quaternion.copy(startQuat);
      ref.current.position.y = -12;
      zControl.current = MB_ASSEMBLY_START_POSITION.z;
    }
  }, [installed, seatedQuat, startQuat]);

  useEffect(() => {
    const move = (e) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    gl.domElement.addEventListener("pointermove", move);
    return () => gl.domElement.removeEventListener("pointermove", move);
  }, [gl, mouse]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!active || installed) return;
      if (e.key === "w" || e.key === "W") keys.current.w = true;
      if (e.key === "s" || e.key === "S") keys.current.s = true;
    };

    const onKeyUp = (e) => {
      if (e.key === "w" || e.key === "W") keys.current.w = false;
      if (e.key === "s" || e.key === "S") keys.current.s = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [active, installed]);

  useEffect(() => {
    const prevent = (e) => e.preventDefault();
    gl.domElement.addEventListener("contextmenu", prevent);
    return () => gl.domElement.removeEventListener("contextmenu", prevent);
  }, [gl]);

  useEffect(() => {
    const onDown = (e) => {
      if (!active || installed || e.button !== 0 || !ref.current) return;

      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (!dragging) {
        const normal = new THREE.Vector3();
        camera.getWorldDirection(normal);
        dragPlane.setFromNormalAndCoplanarPoint(normal, ref.current.position);

        raycaster.setFromCamera(mouse, camera);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          dragOffset.current.copy(ref.current.position).sub(hitPoint);
        }

        setDragging(true);
        document.body.style.cursor = "grabbing";
      } else {
        setDragging(false);
        document.body.style.cursor = "default";
      }
    };

    gl.domElement.addEventListener("pointerdown", onDown);
    return () => gl.domElement.removeEventListener("pointerdown", onDown);
  }, [active, installed, dragging, gl, camera, mouse, raycaster, hitPoint, dragPlane]);

  useFrame(() => {
    if (!ref.current) return;

    if (!installed && active) {
      if (keys.current.w) zControl.current -= 0.16;
      if (keys.current.s) zControl.current += 0.16;
      zControl.current = THREE.MathUtils.clamp(zControl.current, MB_SEATED_POSITION.z - 1, 26);
    }

    if (installed) {
      ref.current.position.lerp(MB_SEATED_POSITION, 0.22);
      ref.current.quaternion.slerp(seatedQuat, 0.22);
      setDistance(null);
    } else if (active) {
      if (dragging) {
        raycaster.setFromCamera(mouse, camera);
        if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
          const target = hitPoint.clone().add(dragOffset.current);
          target.x = -0.6;
          target.y = -12;
          target.z = zControl.current;
          ref.current.position.lerp(target, 0.28);
        }
      }

      ref.current.position.x = -0.6;
      ref.current.position.y = -12;
      ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, zControl.current, 0.25);

      const dist = ref.current.position.distanceTo(MB_SEATED_POSITION);
      setDistance(dragging ? dist : null);

      if (dist < MAGNET_DISTANCE) {
        const t = 1 - dist / MAGNET_DISTANCE;
        const pull = MAGNET_STRENGTH * (t * t + 0.2);
        ref.current.position.lerp(MB_SEATED_POSITION, pull);
        ref.current.position.x = -0.6;
        ref.current.position.y = -12;
        zControl.current = ref.current.position.z;

        if (dist < SNAP_DISTANCE) {
          setDragging(false);
          document.body.style.cursor = "default";
          onInstalled();
        }
      }
    }

    const world = new THREE.Vector3();
    ref.current.getWorldPosition(world);
    setPos({ x: world.x, y: world.y, z: world.z });
  });

  if (installed || !active) return null;

  return (
    <group ref={ref}>
      <primitive object={assembly} />
      <Html position={[0, 2.2, 0]} center>
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
            minWidth: 180,
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: 4 }}>Motherboard Assembly</div>
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>
            Drag with mouse, hold W/S to move in and out
          </div>
          <div>{dragging ? "Dragging Assembly" : "Click to Grab"}</div>
          <div style={{ marginTop: 6 }}>────────</div>
          <div>x: {pos.x.toFixed(2)}</div>
          <div>y: {pos.y.toFixed(2)}</div>
          <div>z: {pos.z.toFixed(2)}</div>
          {distance !== null && <div style={{ marginTop: 4 }}>d: {distance.toFixed(2)}</div>}
        </div>
      </Html>
    </group>
  );
}

/** ================= MAIN FLOW ================= */
function BuildFlowScene() {
  const [installed, setInstalled] = useState({
    cpu: false,
    ram: false,
    ssd: false,
    motherboard: false,
    hdd: false,
    psu: false,
  });

  const step = !installed.cpu
    ? "cpu"
    : !installed.ram
    ? "ram"
    : !installed.ssd
    ? "ssd"
    : !installed.motherboard
    ? "motherboard"
    : !installed.hdd
    ? "hdd"
    : !installed.psu
    ? "psu"
    : "done";

  const resetAll = () => {
    setInstalled({
      cpu: false,
      ram: false,
      ssd: false,
      motherboard: false,
      hdd: false,
      psu: false,
    });
    document.body.style.cursor = "default";
  };

  return (
    <>
      <GuidePanel step={step} installed={installed} onReset={resetAll} />

      <Canvas
        shadows
        style={{ width: "100%", height: "100%" }}
        camera={{ position: [0, 10, 24], fov: 50 }}
      >
        <CameraController step={step} />

        <color attach="background" args={["#05080D"]} />
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[4, 8, 4]}
          intensity={1.35}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <pointLight position={[-3, 1.5, -2]} intensity={0.65} />
        <Environment preset="city" />

        {(step === "cpu" || step === "ram" || step === "ssd") && <MotherboardBase />}

        {installed.cpu && !installed.motherboard && step !== "motherboard" && (
          <StaticModel url={CPU_URL} position={CPU_SEATED_POSITION} rotation={CPU_ROTATION} />
        )}
        {installed.ram && !installed.motherboard && step !== "motherboard" && (
          <StaticModel url={RAM_URL} position={RAM_SEATED_POSITION} rotation={RAM_ROTATION} />
        )}
        {installed.ssd && !installed.motherboard && step !== "motherboard" && (
          <StaticModel url={SSD_URL} position={SSD_SEATED_POSITION} rotation={SSD_ROTATION} />
        )}

        {(step === "motherboard" ||
          installed.motherboard ||
          step === "hdd" ||
          step === "psu" ||
          step === "done") && <PCCase />}

        {(installed.motherboard || step === "hdd" || step === "psu" || step === "done") && (
          <SeatedMotherboardAssembly />
        )}

        {(installed.hdd || step === "psu" || step === "done") && (
          <StaticModel url={HDD_URL} position={HDD_SEATED_POSITION} rotation={HDD_ROTATION} />
        )}

        {(installed.psu || step === "done") && (
          <StaticModel url={PSU_URL} position={PSU_SEATED_POSITION} rotation={PSU_ROTATION} />
        )}

        <DragToTarget
          url={CPU_URL}
          active={step === "cpu"}
          installed={installed.cpu}
          onInstalled={() => setInstalled((p) => ({ ...p, cpu: true }))}
          startPosition={CPU_START_POSITION}
          seatedPosition={CPU_SEATED_POSITION}
          startRotation={CPU_ROTATION}
          seatedRotation={CPU_ROTATION}
          label="CPU"
          subtitle="Install onto motherboard"
          htmlPosition={[0, 1.8, 0]}
        />

        <DragToTarget
          url={RAM_URL}
          active={step === "ram"}
          installed={installed.ram}
          onInstalled={() => setInstalled((p) => ({ ...p, ram: true }))}
          startPosition={RAM_START_POSITION}
          seatedPosition={RAM_SEATED_POSITION}
          startRotation={RAM_ROTATION}
          seatedRotation={RAM_ROTATION}
          label="RAM"
          subtitle="Install onto motherboard"
          htmlPosition={[0, 1.8, 0]}
        />

        <DragToTarget
          url={SSD_URL}
          active={step === "ssd"}
          installed={installed.ssd}
          onInstalled={() => setInstalled((p) => ({ ...p, ssd: true }))}
          startPosition={SSD_START_POSITION}
          seatedPosition={SSD_SEATED_POSITION}
          startRotation={SSD_ROTATION}
          seatedRotation={SSD_ROTATION}
          label="SSD"
          subtitle="Install onto motherboard"
          htmlPosition={[0, 1.8, 0]}
        />

        <MotherboardAssemblyDraggable
          active={step === "motherboard"}
          installed={installed.motherboard}
          onInstalled={() => setInstalled((p) => ({ ...p, motherboard: true }))}
        />

        <DragToTarget
          url={HDD_URL}
          active={step === "hdd"}
          installed={installed.hdd}
          onInstalled={() => setInstalled((p) => ({ ...p, hdd: true }))}
          startPosition={HDD_START_POSITION}
          seatedPosition={HDD_SEATED_POSITION}
          startRotation={HDD_ROTATION}
          seatedRotation={HDD_ROTATION}
          label="HDD"
          subtitle="Install into case"
          htmlPosition={[-10, 2.4, 0]}
          lockX={HDD_LOCK_X}
          lockY={HDD_LOCK_Y}
        />

        <DragToTarget
          url={PSU_URL}
          active={step === "psu"}
          installed={installed.psu}
          onInstalled={() => setInstalled((p) => ({ ...p, psu: true }))}
          startPosition={PSU_START_POSITION}
          seatedPosition={PSU_SEATED_POSITION}
          startRotation={PSU_ROTATION}
          seatedRotation={PSU_ROTATION}
          label="PSU"
          subtitle="Install into case"
          htmlPosition={[0, 2, 0]}
          lockX={PSU_LOCK_X}
          lockY={PSU_LOCK_Y}
        />

        {step === "done" && (
          <Html center position={[0, 6, 0]}>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 18,
                background: "rgba(8,12,20,.68)",
                border: "1px solid rgba(120,255,220,.18)",
                color: "rgba(240,245,255,.96)",
                backdropFilter: "blur(8px)",
                fontFamily: "Inter, system-ui, sans-serif",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>Computer Build Complete</div>
              <div style={{ fontSize: 13, opacity: 0.82, marginTop: 4 }}>
                You can orbit around the finished PC.
              </div>
            </div>
          </Html>
        )}

        <ContactShadows
          position={[0, -0.02, 0]}
          opacity={0.35}
          scale={14}
          blur={2.8}
          far={6}
        />

        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={12}
          maxDistance={40}
          target={[0, -8, 0]}
          maxPolarAngle={Math.PI / 2}
          mouseButtons={{
            LEFT: null,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
        />
      </Canvas>
    </>
  );
}

/** ================= EXPORT ================= */
export default function FullComputerAssemblyScene() {
  return (
    <div style={{ width: "100%", height: "100vh", position: "relative", background: "#05080D" }}>
      <BuildFlowScene />
    </div>
  );
}

/** ================= PRELOAD ================= */
useGLTF.preload(CPU_URL);
useGLTF.preload(MB_URL);
useGLTF.preload(RAM_URL);
useGLTF.preload(SSD_URL);
useGLTF.preload(HDD_URL);
useGLTF.preload(PSU_URL);
useGLTF.preload(CASE_URL);
