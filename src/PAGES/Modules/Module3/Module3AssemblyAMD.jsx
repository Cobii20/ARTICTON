import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import Settings from "../../../Components/Settings";
import ProcedureAssistantBubble from "../../../Components/ProcedureAssistantBubble";
import { auth, db, functions } from "../../../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { AchievementToast, unlockAchievement } from "../../../utils/achievements.jsx";
import { formatTutorReply } from "../../../utils/tutorReply.js";
import { getUserSettings } from "../../../utils/userSettings";

/* ------------------------------------------------------------------ */
/* Module 3 validated assembly configuration (AMD platform)           */
/* ------------------------------------------------------------------ */

/*
 * Guided teaching order:
 * CPU → first RAM module → second RAM module → SSD → motherboard →
 * PSU → HDD → GPU.
 *
 * CPU, memory, and the M.2 SSD are installed while the motherboard is
 * safely supported on the table. The populated motherboard is installed
 * in the case before the PSU, matching the requested teaching sequence.
 * Either RAM module may be selected first; the other RAM module becomes
 * the next required step automatically.
 */
const steps = [
  { key: "cpu", name: "Install CPU on Motherboard", partKeys: ["cpu"] },
  {
    key: "ramFirst",
    name: "Install First RAM Module",
    partKeys: ["ram1", "ram2"],
    requiredCount: 1,
    unordered: true,
  },
  {
    key: "ramSecond",
    name: "Install Second RAM Module",
    partKeys: ["ram1", "ram2"],
    requiredCount: 2,
    unordered: true,
  },
  { key: "ssd", name: "Install SSD on Motherboard", partKeys: ["ssd"] },
  {
    key: "motherboard",
    name: "Install Populated Motherboard in Case",
    partKeys: ["motherboard"],
  },
  { key: "psu", name: "Install PSU in Case", partKeys: ["psu"] },
  { key: "hdd", name: "Install HDD in Case", partKeys: ["hdd"] },
  { key: "gpu", name: "Install GPU in Case", partKeys: ["gpu"] },
  { key: "final", name: "Full Assembly", partKeys: [] },
];

const PART_MODELS = [
  { key: "table", path: "/models/AMDtable.glb" },
  { key: "case", path: "/models/NEWcaseAMD.glb" },
  { key: "motherboard", path: "/models/NEWmotherboardAMD.glb" },
  { key: "cpu", path: "/models/NEWcpuAMD.glb" },
  { key: "ram1", path: "/models/NEWramAMD.glb" },
  { key: "ram2", path: "/models/NEWram2AMD.glb" },
  { key: "ssd", path: "/models/NEWssdAMD.glb" },
  { key: "hdd", path: "/models/NEWhddAMD.glb" },
  { key: "psu", path: "/models/NEWpsuAMD.glb" },
  { key: "gpu", path: "/models/NEWgpuAMD.glb" },
];

const GUIDED_STEPS = steps.filter((item) => item.key !== "final");
const ASSEMBLY_SEQUENCE = [
  ...new Set(GUIDED_STEPS.flatMap((item) => item.partKeys)),
];
const MOVABLE_COMPONENT_KEYS = new Set(ASSEMBLY_SEQUENCE);
const MOTHERBOARD_CHILD_KEYS = new Set(["cpu", "ram1", "ram2", "ssd"]);

const COMPONENT_LABELS = {
  cpu: "CPU (Central Processing Unit)",
  ram1: "RAM (Random Access Memory) 1",
  ram2: "RAM (Random Access Memory) 2",
  ssd: "SSD (Solid State Drive)",
  motherboard: "Motherboard",
  psu: "PSU (Power Supply Unit)",
  hdd: "HDD (Hard Disk Drive)",
  gpu: "GPU (Graphics Processing Unit)",
};

const STEP_INSTRUCTION_GUIDES = Object.freeze({
  cpu: {
    title: "Prepare to Install the CPU",
    summary: "The CPU is installed first while the motherboard is fully supported on the table. Correct orientation matters more than pressure—the processor should seat without force.",
    procedure: [
      "Place the motherboard flat on the table and raise the CPU-socket retention arm fully.",
      "Match the processor's corner triangle and keyed orientation with the socket; lower it vertically into place without sliding.",
      "Confirm the CPU sits completely flat under its own weight, then lower and lock the retention arm.",
      "Keep thermal paste off the contacts; cooler installation and fan connection are verified before normal operation."
    ],
    safety: "AMD processors and sockets may use exposed pins depending on generation. Never press, twist, or use the retention arm to force a misaligned CPU.",
    verify: "The CPU is level, fully inside the keyed socket, and the retention mechanism closes normally without unusual resistance.",
    avoid: "Pressing the CPU into the socket, touching pins or contacts, or closing the arm while the processor is not flat.",
    simulation: "Drag the CPU into the motherboard's invisible field and release before contact. The animation lowers it vertically and applies the corrected socket seating depth."
  },
  ramFirst: {
    title: "Prepare to Install the First RAM Module",
    summary: "Install either available RAM module first. The notch in the module must match the keyed DIMM slot before downward pressure is applied.",
    procedure: [
      "Open the DIMM retaining latch or latches completely and identify the highlighted first memory slot.",
      "Hold the RAM by its top corners, align the off-center notch with the slot key, and keep the module perfectly vertical.",
      "Press evenly at both ends until the module bottoms out and the retention latch or latches click into place.",
      "Visually compare both ends to confirm the module is level and equally deep in the slot."
    ],
    safety: "Use the module edges only and support the motherboard beneath the slot. Do not touch the gold contacts.",
    verify: "The notch is aligned, both ends are fully seated, and the retention latch or latches are closed.",
    avoid: "Reversing the module, pressing one end at a time, or continuing when the notch does not match.",
    simulation: "Either RAM module is accepted first. Enter the motherboard field and let the animated vertical seating motion finish the insertion."
  },
  ramSecond: {
    title: "Prepare to Install the Second RAM Module",
    summary: "Complete the memory pair using the remaining module and the highlighted paired slot. Matching placement supports the intended dual-channel configuration.",
    procedure: [
      "Open the retention latch or latches on the remaining highlighted DIMM slot.",
      "Check the keyed notch again; do not assume the second module is already oriented correctly.",
      "Lower the module vertically and press both ends evenly until the latches close.",
      "Compare both RAM modules: they should be parallel, level, and fully seated at the same depth."
    ],
    safety: "Keep pressure centered over the slot and support the board. Stop immediately if the module rocks or meets uneven resistance.",
    verify: "Both RAM modules are locked, parallel, and flush in their intended slots.",
    avoid: "Installing the second module in an arbitrary slot or mistaking partial latch movement for full seating.",
    simulation: "Install the RAM module that remains. The next component stays locked until both memory modules are seated."
  },
  ssd: {
    title: "Prepare to Install the M.2 SSD",
    summary: "The M.2 SSD is installed on the table before the motherboard enters the case. Its edge connector enters at an angle, then the free end is secured flat.",
    procedure: [
      "Confirm the correct M.2 socket and standoff position for the drive length.",
      "Hold the SSD by its edges and insert the gold connector at roughly a 20–30° angle until it is fully engaged.",
      "Lower the free end gently onto the standoff and secure it with the screw or tool-less latch.",
      "Tighten only until secure; the SSD must remain flat without bowing."
    ],
    safety: "Keep fingers off the gold contacts and controller components. Use the correct short M.2 screw and avoid overtightening.",
    verify: "The connector is fully inserted, the drive lies flat, and the retaining point holds it without bending.",
    avoid: "Pushing the drive straight down into the socket, using the wrong standoff, or overtightening the tiny screw.",
    simulation: "Move the SSD into the motherboard field. The magnetic route aligns the insertion angle, lowers it, and seats it without passing through the board."
  },
  motherboard: {
    title: "Prepare to Install the Populated Motherboard",
    summary: "Install the motherboard with the CPU, both RAM modules, and SSD already mounted. The case remains flat and open-side-up so the board can be lowered safely.",
    procedure: [
      "Verify the case has only the required standoffs and that the rear I/O opening or shield is ready; remove any extra standoff that could short the board.",
      "Support the board at two strong edges, align the rear I/O ports first, and keep mounted components clear of the case walls.",
      "Lower the board vertically onto the standoffs and confirm every screw hole aligns before inserting hardware.",
      "Start all motherboard screws by hand, then tighten gradually in a cross pattern without overtightening."
    ],
    safety: "Never rest the board on an unmatched standoff. Do not carry it by the CPU cooler, RAM, socket, or connectors.",
    verify: "Rear I/O is aligned, every mounting hole sits over a standoff, the board is level, and no cable is trapped beneath it.",
    avoid: "Forcing the rear ports into place, using an extra standoff, or tightening one screw fully before the others are started.",
    simulation: "Bring the populated motherboard into the case field. It will lift clear, travel above the chassis, lower vertically, and seat without clipping through case walls."
  },
  psu: {
    title: "Prepare to Install the PSU",
    summary: "Install the power supply after the populated motherboard. Correct fan orientation and controlled cable routing support cooling and later connections.",
    procedure: [
      "Identify the case's ventilated PSU intake and orient the PSU fan toward that vent unless the case design specifies otherwise.",
      "Support the PSU with both hands, slide it straight into its bay, and align the rear mounting holes.",
      "Install the rear screws in a cross pattern while continuing to support the unit.",
      "Route the 24-pin, CPU EPS, PCIe, and SATA power leads through the intended cable-management openings without connecting them under tension."
    ],
    safety: "The PSU is heavy. Keep fingers clear of pinch points and never open the PSU enclosure.",
    verify: "The fan faces a usable vent, the unit sits flush, all rear screws are secure, and cables have a clear route.",
    avoid: "Blocking the PSU intake, trapping cables under the unit, or allowing the PSU to hang from one screw.",
    simulation: "Move the PSU into the case field. The safe-path animation lifts, clears the chassis edge, lowers into the bay, and preserves the correct orientation."
  },
  hdd: {
    title: "Prepare to Install the HDD",
    summary: "Secure the hard drive mechanically before attaching cables. Its connectors should face the cable-routing side so SATA plugs are not bent or stressed.",
    procedure: [
      "Place the HDD in its tray or cage with the connector side oriented toward the cable-management area.",
      "Align the mounting holes, rails, or tool-less pins and secure the drive evenly on both sides.",
      "Connect SATA data and SATA power by their keyed shapes; each plug should enter straight without force.",
      "Leave a gentle cable bend and confirm the connectors are not carrying the drive's weight."
    ],
    safety: "Support the HDD throughout installation and protect its circuit board from tools, impacts, and static discharge.",
    verify: "The drive cannot slide or rattle, both connectors are fully seated, and cable bends are relaxed.",
    avoid: "Forcing a reversed SATA plug, leaving the drive unsecured, or sharply bending a cable at the connector.",
    simulation: "Guide the HDD into the case field. The animation carries it over obstructions and lowers it into the drive bay."
  },
  gpu: {
    title: "Prepare to Install the GPU",
    summary: "The graphics card is installed last so it does not block motherboard, PSU, or storage access. The slot, rear bracket, and power connections must all be secured.",
    procedure: [
      "Remove the correct rear expansion-slot covers and open the PCIe x16 retention latch.",
      "Hold the GPU by its edges or backplate, align the gold connector with the slot, and align the metal bracket with the case opening.",
      "Press straight and evenly until the card is fully seated and the slot latch clicks closed.",
      "Secure the bracket screws, then connect every required PCIe power plug until each latch engages."
    ],
    safety: "Support the GPU's weight during insertion. Keep fingers away from contacts and fans, and never use the bracket screws to pull the card into the slot.",
    verify: "The slot latch is closed, the bracket sits flush, screws are secure, and all required power connectors are latched.",
    avoid: "Tilting the GPU into the slot, missing the rear bracket opening, or forgetting supplemental power.",
    simulation: "Enter the case magnetic field and release early. The GPU follows a collision-safe lift-over-lower route before the completed case animates upright."
  },
  final: {
    title: "Final Unguided Assembly Challenge",
    summary: "Repeat the full build without target highlights. The magnetic assistance and order restrictions remain, but component identification and safety checks are now your responsibility.",
    procedure: [
      "Install the CPU, then install both RAM modules—either module may be first—followed by the M.2 SSD.",
      "Install the populated motherboard into the flat, open-side-up case before adding the PSU.",
      "Install the PSU, then the HDD, and install the GPU last.",
      "After each component, verify orientation, retention, clearance, and cable or screw requirements before continuing."
    ],
    safety: "A correct sequence does not replace inspection. Stop whenever alignment, connector state, or clearance is uncertain.",
    verify: "CPU, both RAM modules, SSD, motherboard, PSU, HDD, and GPU are fully seated; the completed chassis then transitions upright.",
    avoid: "Relying on force, skipping a retention check, or installing case components before the populated motherboard.",
    simulation: "Complete CPU → both RAM modules (either first) → SSD → motherboard → PSU → HDD → GPU. No target highlights are shown."
  }
});

/* Module 2 table seats become the loose starting positions for assembly. */
const TABLE_STARTS = Object.freeze({
  cpu: { position: [-24.32, -27.331, 85.547], snapDistance: 0.75, magnetDistance: 4.5 },
  ram1: { position: [-53.836, -27.553, 80.307], snapDistance: 0.85, magnetDistance: 5 },
  ram2: { position: [-55.587, -27.596, 75.629], snapDistance: 0.85, magnetDistance: 5 },
  ssd: { position: [-28.53, -13.076, 98.981], snapDistance: 1, magnetDistance: 6 },
  motherboard: { position: [-41.07, -21.537, 54.246], snapDistance: 2, magnetDistance: 11 },
  psu: { position: [-28.697, -2.967, 75.561], snapDistance: 1.6, magnetDistance: 9, preserveTableRotation: true },
  hdd: { position: [-38.289, -9.671, 90.063], snapDistance: 1.25, magnetDistance: 7 },
  gpu: { position: [-41.711, -17.422, 88.557], snapDistance: 1.5, magnetDistance: 9 },
});

const DEFAULT_SNAP_DISTANCE = 1;
const DEFAULT_MAGNET_DISTANCE = 7;
const MAGNETIC_SNAP_MIN_DURATION_MS = 620;
const MAGNETIC_SNAP_MAX_DURATION_MS = 1800;
const MAGNETIC_FIELD_CAPTURE_THRESHOLD = 0.12;
const MAGNETIC_FIELD_AUTO_CAPTURE_THRESHOLD = 0.46;
const MAGNETIC_FIELD_MIN_POINTER_TRAVEL_PX = 12;
const MAGNETIC_FIELD_MIN_PULL = 0.08;
const MAGNETIC_FIELD_MAX_PULL = 0.72;
const MAGNETIC_ROUTE_CAPTURE_RATIO = 0.42;
const HOST_FIELD_PADDING_RATIO = 0.3;
const HOST_FIELD_FEATHER_RATIO = 0.58;
const DRAG_FOLLOW_SPEED = 22;
const ROTATION_FOLLOW_SPEED = 10;
const TELEMETRY_FRAME_INTERVAL = 3;
const TELEMETRY_IDLE_FRAME_INTERVAL = 16;
const CAMERA_FOCUS_DURATION_MS = 760;
const CASE_GROUND_CLEARANCE = 0.025;
const CASE_COMPONENT_CLEARANCE_MIN = 0.75;
const BOARD_COMPONENT_CLEARANCE_MIN = 0.28;
const FINAL_SEAT_CLEARANCE = 0.1;
const CPU_SEAT_DEPTH_RATIO = 0.34;
const CASE_STAND_TRANSITION_DURATION_MS = 2100;
const CASE_STAND_CARD_DELAY_MS = CASE_STAND_TRANSITION_DURATION_MS + 300;
const ASSEMBLY_UX_VERSION = "Guided Safe-Path Magnet v5 + Upright Finish";

const LEGACY_STORAGE_KEYS = [
  "module3CompletedStepsAMD",
  "module3AssembledPartsAMD",
];

function getCompletedPartCount(stepConfig, completedParts) {
  if (!stepConfig?.partKeys?.length) return 0;
  return stepConfig.partKeys.filter((key) => completedParts.includes(key)).length;
}

function isProcedureStepComplete(stepConfig, completedParts) {
  if (!stepConfig?.partKeys?.length) return false;
  const requiredCount = stepConfig.requiredCount ?? stepConfig.partKeys.length;
  return getCompletedPartCount(stepConfig, completedParts) >= requiredCount;
}

function getRemainingParts(stepConfig, completedParts) {
  if (!stepConfig?.partKeys?.length) return [];
  if (isProcedureStepComplete(stepConfig, completedParts)) return [];
  return stepConfig.partKeys.filter((key) => !completedParts.includes(key));
}

function getActiveProcedureStage(completedParts) {
  return (
    GUIDED_STEPS.find(
      (stepConfig) => !isProcedureStepComplete(stepConfig, completedParts)
    ) || null
  );
}

function formatAllowedPartLabel(partKeys) {
  if (!partKeys?.length) return "the current component";
  if (partKeys.length === 1) return COMPONENT_LABELS[partKeys[0]];
  if (partKeys.every((key) => key.startsWith("ram"))) return "either RAM module";
  return partKeys.map((key) => COMPONENT_LABELS[key]).join(" or ");
}

function playCompletionSound(enabled, isFinal = false) {
  if (!enabled || typeof window === "undefined") return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const context = new AudioContextClass();
    const notes = isFinal
      ? [
          { frequency: 523.25, delay: 0, duration: 0.12 },
          { frequency: 659.25, delay: 0.11, duration: 0.14 },
          { frequency: 783.99, delay: 0.24, duration: 0.2 },
        ]
      : [
          { frequency: 659.25, delay: 0, duration: 0.1 },
          { frequency: 880, delay: 0.09, duration: 0.16 },
        ];

    const masterGain = context.createGain();
    masterGain.gain.setValueAtTime(0.0001, context.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.015);
    masterGain.connect(context.destination);

    notes.forEach(({ frequency, delay, duration }) => {
      const oscillator = context.createOscillator();
      const noteGain = context.createGain();
      const startAt = context.currentTime + delay;
      const endAt = startAt + duration;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startAt);
      noteGain.gain.setValueAtTime(0.0001, startAt);
      noteGain.gain.exponentialRampToValueAtTime(0.75, startAt + 0.012);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, endAt);
      oscillator.connect(noteGain);
      noteGain.connect(masterGain);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.02);
    });

    const totalDuration = isFinal ? 650 : 420;
    window.setTimeout(() => {
      context.close().catch(() => {});
    }, totalDuration);
  } catch (error) {
    console.warn("Completion sound could not be played:", error);
  }
}

function getCompletionDate() {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
  } catch {
    return new Date().toLocaleDateString();
  }
}


const PART_BY_KEY = Object.freeze(
  Object.fromEntries(PART_MODELS.map((part) => [part.key, part]))
);

function cloneSceneForDisplay(
  scene,
  { disableRaycast = false, enableShadows = true } = {}
) {
  const clone = scene.clone(true);
  clone.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = enableShadows;
    object.receiveShadow = enableShadows;
    if (disableRaycast) object.raycast = () => null;
  });
  return clone;
}

function getModelBounds(scene) {
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  return {
    center: bounds.getCenter(new THREE.Vector3()),
    size: bounds.getSize(new THREE.Vector3()),
    box: bounds.clone(),
  };
}

function getAutomaticLayFlatQuaternion(modelSize) {
  const dimensions = [modelSize.x, modelSize.y, modelSize.z];
  const thinnestAxis = dimensions.indexOf(Math.min(...dimensions));
  const euler = new THREE.Euler(0, 0, 0);

  if (thinnestAxis === 0) {
    euler.set(0, 0, Math.PI / 2);
  } else if (thinnestAxis === 2) {
    euler.set(-Math.PI / 2, 0, 0);
  }

  return new THREE.Quaternion().setFromEuler(euler);
}

function getCaseLayFlatCandidates(modelSize) {
  const dimensions = [modelSize.x, modelSize.y, modelSize.z];
  const thinnestAxis = dimensions.indexOf(Math.min(...dimensions));

  if (thinnestAxis === 0) {
    return [
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2)),
    ];
  }

  if (thinnestAxis === 2) {
    return [
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
    ];
  }

  return [new THREE.Quaternion()];
}

function chooseOpenSideUpCaseQuaternion(modelSize, caseCenter, targetCenters) {
  const candidates = getCaseLayFlatCandidates(modelSize);
  if (candidates.length === 1 || !targetCenters.length) return candidates[0];

  /*
   * The authored AMD/Intel case meshes expose their removable side panel on
   * the opposite local normal from the component target origins. Choosing the
   * candidate that puts those target origins lowest therefore leaves the open
   * cavity facing upward. The previous max-score test selected the closed
   * underside and made the case appear face-down.
   */
  let bestCandidate = candidates[0];
  let bestScore = Infinity;

  candidates.forEach((candidate) => {
    const score = targetCenters.reduce((total, targetCenter) => {
      const rotatedOffset = targetCenter
        .clone()
        .sub(caseCenter)
        .applyQuaternion(candidate);
      return total + rotatedOffset.y;
    }, 0);

    if (score < bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  });

  return bestCandidate.clone();
}

function getCpuSeatCorrectionLocal(motherboardScene, cpuScene) {
  const motherboardBounds = getModelBounds(motherboardScene);
  const cpuBounds = getModelBounds(cpuScene);
  const motherboardDimensions = [
    motherboardBounds.size.x,
    motherboardBounds.size.y,
    motherboardBounds.size.z,
  ];
  const boardNormalAxis = motherboardDimensions.indexOf(
    Math.min(...motherboardDimensions)
  );

  const centerDelta =
    cpuBounds.center.getComponent(boardNormalAxis) -
    motherboardBounds.center.getComponent(boardNormalAxis);
  const outwardDirection = Math.sign(centerDelta) || 1;
  const cpuNormalThickness = Math.max(
    cpuBounds.size.getComponent(boardNormalAxis),
    Math.min(cpuBounds.size.x, cpuBounds.size.y, cpuBounds.size.z),
    0.001
  );

  // Move the CPU toward the motherboard plane by a controlled fraction of
  // its thickness. This removes the authored visual gap without burying the
  // package inside the socket and works at both AMD and Intel model scales.
  const seatDepth = cpuNormalThickness * CPU_SEAT_DEPTH_RATIO;
  const offset = new THREE.Vector3();
  offset.setComponent(boardNormalAxis, -outwardDirection * seatDepth);
  return offset;
}

function getGroundedRotationOffsetY(bounds, pivot, quaternion) {
  const rotatedBounds = new THREE.Box3();
  const { min, max } = bounds;

  for (const x of [min.x, max.x]) {
    for (const y of [min.y, max.y]) {
      for (const z of [min.z, max.z]) {
        const corner = new THREE.Vector3(x, y, z)
          .sub(pivot)
          .applyQuaternion(quaternion)
          .add(pivot);
        rotatedBounds.expandByPoint(corner);
      }
    }
  }

  return bounds.min.y - rotatedBounds.min.y + CASE_GROUND_CLEARANCE;
}

function StaticAuthoredModel({ part, disableRaycast = true }) {
  const { scene } = useGLTF(encodeURI(part.path));
  const clone = useMemo(
    () =>
      cloneSceneForDisplay(scene, {
        disableRaycast,
        enableShadows: !["cpu", "ram1", "ram2", "ssd"].includes(part.key),
      }),
    [disableRaycast, part.key, scene]
  );

  return <primitive object={clone} dispose={null} />;
}

/* ------------------------------------------------------------------ */
/* Reusable click-grab-move-click-release assembly interaction         */
/* ------------------------------------------------------------------ */

function InteractiveCenteredObject({
  partKey,
  label,
  modelCenter,
  modelSize,
  startConfig,
  targetFrameRef = null,
  magnetFieldRef = null,
  targetSeatOffsetLocal = null,
  isActive,
  isFullRun = false,
  showGuides = true,
  isCompleted,
  onPartCompleted,
  onLockedPartClick,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
  contentFrameRef = null,
  children,
}) {
  const { camera, gl } = useThree();
  const groupRef = useRef(null);
  const rotationRef = useRef(null);
  const tetherRef = useRef(null);
  const tetherMaterialRef = useRef(null);
  const captureRingRef = useRef(null);
  const captureRingMaterialRef = useRef(null);

  const phaseRef = useRef("ready");
  const [phase, setPhase] = useState("ready");
  const grabbingRef = useRef(false);
  const completionReportedRef = useRef(false);
  const frameCounterRef = useRef(0);
  const initialDistanceRef = useRef(1);
  const magnetStateRef = useRef("Move toward host field");
  const magnetNoticeRef = useRef(false);

  const snapStartedAtRef = useRef(0);
  const snapDurationRef = useRef(MAGNETIC_SNAP_MIN_DURATION_MS);
  const snapStartPositionRef = useRef(new THREE.Vector3());
  const snapStartQuaternionRef = useRef(new THREE.Quaternion());
  const snapLiftPositionRef = useRef(new THREE.Vector3());
  const snapHoverPositionRef = useRef(new THREE.Vector3());
  const snapPreSeatPositionRef = useRef(new THREE.Vector3());
  const routeGoalRef = useRef(new THREE.Vector3());
  const routeWorldPointRef = useRef(new THREE.Vector3());

  const pointerClientRef = useRef(new THREE.Vector2());
  const pointerStartRef = useRef(new THREE.Vector2());
  const dragStartCenterWorldRef = useRef(new THREE.Vector3());
  const dragRightWorldRef = useRef(new THREE.Vector3(1, 0, 0));
  const dragUpWorldRef = useRef(new THREE.Vector3(0, 0, 1));
  const worldUnitsPerPixelRef = useRef(0.02);
  const safeCarryYRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragCurrentYRef = useRef(0);

  const desiredCenterWorldRef = useRef(new THREE.Vector3());
  const desiredCenterLocalRef = useRef(new THREE.Vector3());
  const desiredGroupLocalRef = useRef(new THREE.Vector3());
  const assistedGoalRef = useRef(new THREE.Vector3());
  const desiredVisualCenterWorldRef = useRef(new THREE.Vector3());
  const currentCenterLocalRef = useRef(new THREE.Vector3());
  const targetCenterLocalRef = useRef(new THREE.Vector3());
  const currentCenterWorldRef = useRef(new THREE.Vector3());
  const targetCenterWorldRef = useRef(new THREE.Vector3());
  const cameraForwardRef = useRef(new THREE.Vector3());
  const cameraRightRef = useRef(new THREE.Vector3());
  const cameraUpRef = useRef(new THREE.Vector3());

  const targetPositionRef = useRef(new THREE.Vector3());
  const targetQuaternionRef = useRef(new THREE.Quaternion());
  const authoredCenterWorldRef = useRef(new THREE.Vector3());
  const authoredCenterLocalRef = useRef(new THREE.Vector3());
  const targetWorldQuaternionRef = useRef(new THREE.Quaternion());
  const parentWorldQuaternionRef = useRef(new THREE.Quaternion());
  const seatOffsetParentLocalRef = useRef(new THREE.Vector3());

  const hostBoundsRef = useRef(new THREE.Box3());
  const expandedHostBoundsRef = useRef(new THREE.Box3());
  const closestHostPointRef = useRef(new THREE.Vector3());
  const hostSizeRef = useRef(new THREE.Vector3());
  const lineStartRef = useRef(new THREE.Vector3());
  const lineEndRef = useRef(new THREE.Vector3());

  const isMovablePart = MOVABLE_COMPONENT_KEYS.has(partKey);
  const canInteract = isMovablePart && isActive && !isCompleted;
  const shouldShowGuides = showGuides && isActive;

  const installedQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const targetSeatOffsetVector = useMemo(() => {
    if (!targetSeatOffsetLocal) return new THREE.Vector3();
    if (targetSeatOffsetLocal.isVector3) return targetSeatOffsetLocal.clone();
    return new THREE.Vector3().fromArray(targetSeatOffsetLocal);
  }, [targetSeatOffsetLocal]);
  const tableQuaternion = useMemo(() => {
    if (startConfig?.preserveTableRotation) return installedQuaternion.clone();
    return getAutomaticLayFlatQuaternion(modelSize);
  }, [installedQuaternion, modelSize, startConfig]);

  const startPosition = startConfig?.position || [0, 0, 0];
  const snapDistance = startConfig?.snapDistance ?? DEFAULT_SNAP_DISTANCE;
  const magnetDistance = startConfig?.magnetDistance ?? DEFAULT_MAGNET_DISTANCE;
  const modelRadius = useMemo(
    () => Math.max(modelSize.length() * 0.5, 0.35),
    [modelSize]
  );
  const captureRingRadius = THREE.MathUtils.clamp(
    Math.max(snapDistance * 1.6, modelRadius * 0.25),
    0.55,
    4.5
  );

  const setPhaseSafely = useCallback((nextPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const updatePointer = useCallback((event) => {
    pointerClientRef.current.set(event.clientX, event.clientY);
  }, []);

  const computeInstallationTarget = useCallback(() => {
    const parent = groupRef.current?.parent || null;

    if (!targetFrameRef?.current) {
      targetPositionRef.current.set(0, 0, 0);
      targetQuaternionRef.current.identity();
      return {
        position: targetPositionRef.current,
        quaternion: targetQuaternionRef.current,
      };
    }

    targetFrameRef.current.updateWorldMatrix(true, false);
    authoredCenterWorldRef.current
      .copy(modelCenter)
      .applyMatrix4(targetFrameRef.current.matrixWorld);

    authoredCenterLocalRef.current.copy(authoredCenterWorldRef.current);
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(authoredCenterLocalRef.current);
    }

    targetPositionRef.current
      .copy(authoredCenterLocalRef.current)
      .sub(modelCenter);

    targetFrameRef.current.getWorldQuaternion(targetWorldQuaternionRef.current);
    seatOffsetParentLocalRef.current
      .copy(targetSeatOffsetVector)
      .applyQuaternion(targetWorldQuaternionRef.current);

    if (parent) {
      parent.getWorldQuaternion(parentWorldQuaternionRef.current);
      parentWorldQuaternionRef.current.invert();
      seatOffsetParentLocalRef.current.applyQuaternion(
        parentWorldQuaternionRef.current
      );
      targetPositionRef.current.add(seatOffsetParentLocalRef.current);
      targetQuaternionRef.current
        .copy(parentWorldQuaternionRef.current)
        .multiply(targetWorldQuaternionRef.current);
    } else {
      targetPositionRef.current.add(seatOffsetParentLocalRef.current);
      targetQuaternionRef.current.copy(targetWorldQuaternionRef.current);
    }

    return {
      position: targetPositionRef.current,
      quaternion: targetQuaternionRef.current,
    };
  }, [modelCenter, targetFrameRef, targetSeatOffsetVector]);

  const localGroupCenterToWorld = useCallback(
    (groupPosition, output) => {
      output.copy(groupPosition).add(modelCenter);
      const parent = groupRef.current?.parent;
      if (parent) {
        parent.updateWorldMatrix(true, false);
        parent.localToWorld(output);
      }
      return output;
    },
    [modelCenter]
  );

  const worldCenterToLocalGroupPosition = useCallback(
    (worldCenter, output) => {
      output.copy(worldCenter);
      const parent = groupRef.current?.parent;
      if (parent) {
        parent.updateWorldMatrix(true, false);
        parent.worldToLocal(output);
      }
      output.sub(modelCenter);
      return output;
    },
    [modelCenter]
  );

  const getVisualCenters = useCallback(
    (installationTarget) => {
      currentCenterLocalRef.current.copy(groupRef.current.position).add(modelCenter);
      targetCenterLocalRef.current.copy(installationTarget.position).add(modelCenter);
      currentCenterWorldRef.current.copy(currentCenterLocalRef.current);
      targetCenterWorldRef.current.copy(targetCenterLocalRef.current);

      const parent = groupRef.current.parent;
      if (parent) {
        parent.updateWorldMatrix(true, false);
        parent.localToWorld(currentCenterWorldRef.current);
        parent.localToWorld(targetCenterWorldRef.current);
      }

      return {
        currentLocal: currentCenterLocalRef.current,
        targetLocal: targetCenterLocalRef.current,
        currentWorld: currentCenterWorldRef.current,
        targetWorld: targetCenterWorldRef.current,
      };
    },
    [modelCenter]
  );

  const getHostFieldInfo = useCallback(
    (worldPosition, targetWorldPosition) => {
      const host = magnetFieldRef?.current;
      if (!host) {
        const distance = worldPosition.distanceTo(targetWorldPosition);
        const radius = Math.max(magnetDistance * 1.6, modelRadius * 2.2);
        return {
          inside: distance <= radius * 0.45,
          strength: THREE.MathUtils.clamp(1 - distance / radius, 0, 1),
          outsideDistance: distance,
        };
      }

      host.updateWorldMatrix(true, true);
      hostBoundsRef.current.setFromObject(host);
      if (hostBoundsRef.current.isEmpty()) {
        const distance = worldPosition.distanceTo(targetWorldPosition);
        const radius = Math.max(magnetDistance * 1.6, modelRadius * 2.2);
        return {
          inside: distance <= radius * 0.45,
          strength: THREE.MathUtils.clamp(1 - distance / radius, 0, 1),
          outsideDistance: distance,
        };
      }

      hostBoundsRef.current.getSize(hostSizeRef.current);
      const largestHostDimension = Math.max(
        hostSizeRef.current.x,
        hostSizeRef.current.y,
        hostSizeRef.current.z,
        1
      );
      const padding = Math.max(
        largestHostDimension * HOST_FIELD_PADDING_RATIO,
        magnetDistance * 0.35,
        modelRadius * 0.45
      );
      const feather = Math.max(
        largestHostDimension * HOST_FIELD_FEATHER_RATIO,
        magnetDistance,
        modelRadius * 1.5
      );

      expandedHostBoundsRef.current.copy(hostBoundsRef.current).expandByScalar(padding);
      expandedHostBoundsRef.current.clampPoint(
        worldPosition,
        closestHostPointRef.current
      );
      const outsideDistance = worldPosition.distanceTo(closestHostPointRef.current);
      const inside = expandedHostBoundsRef.current.containsPoint(worldPosition);
      const strength = inside
        ? 1
        : THREE.MathUtils.clamp(1 - outsideDistance / feather, 0, 1);

      return { inside, strength, outsideDistance };
    },
    [magnetDistance, magnetFieldRef, modelRadius]
  );

  const computeSafeApproachPlan = useCallback(
    (installationTarget, centers) => {
      const host = magnetFieldRef?.current;
      let hostTopWorldY = Math.max(
        centers.currentWorld.y,
        centers.targetWorld.y
      );

      if (host) {
        host.updateWorldMatrix(true, true);
        hostBoundsRef.current.setFromObject(host);
        if (!hostBoundsRef.current.isEmpty()) {
          hostTopWorldY = hostBoundsRef.current.max.y;
        }
      }

      const isBoardComponent = MOTHERBOARD_CHILD_KEYS.has(partKey);
      const clearance = isBoardComponent
        ? THREE.MathUtils.clamp(
            modelRadius * 0.12,
            BOARD_COMPONENT_CLEARANCE_MIN,
            1.35
          )
        : THREE.MathUtils.clamp(
            modelRadius * 0.16,
            CASE_COMPONENT_CLEARANCE_MIN,
            4.5
          );
      const safeCenterWorldY = Math.max(
        hostTopWorldY + clearance,
        centers.currentWorld.y,
        centers.targetWorld.y + clearance
      );
      const finalSeatLift = Math.max(
        FINAL_SEAT_CLEARANCE,
        Math.min(clearance * 0.22, 0.45)
      );

      routeWorldPointRef.current
        .copy(centers.currentWorld)
        .setY(safeCenterWorldY);
      worldCenterToLocalGroupPosition(
        routeWorldPointRef.current,
        snapLiftPositionRef.current
      );

      routeWorldPointRef.current
        .copy(centers.targetWorld)
        .setY(safeCenterWorldY);
      worldCenterToLocalGroupPosition(
        routeWorldPointRef.current,
        snapHoverPositionRef.current
      );

      routeWorldPointRef.current
        .copy(centers.targetWorld)
        .setY(centers.targetWorld.y + finalSeatLift);
      worldCenterToLocalGroupPosition(
        routeWorldPointRef.current,
        snapPreSeatPositionRef.current
      );

      return {
        target: installationTarget.position,
        lift: snapLiftPositionRef.current,
        hover: snapHoverPositionRef.current,
        preSeat: snapPreSeatPositionRef.current,
        safeCenterWorldY,
        clearance,
      };
    },
    [magnetFieldRef, modelRadius, partKey, worldCenterToLocalGroupPosition]
  );

  const publishTelemetry = useCallback(() => {
    if (!groupRef.current || !isMovablePart || !onTelemetry || !isActive) return;

    const installationTarget = computeInstallationTarget();
    const centers = getVisualCenters(installationTarget);
    const distance = centers.currentWorld.distanceTo(centers.targetWorld);
    const progress = THREE.MathUtils.clamp(
      1 - distance / Math.max(initialDistanceRef.current, 0.001),
      0,
      1
    );

    onTelemetry({
      key: partKey,
      label,
      phase: phaseRef.current,
      position: centers.currentWorld.toArray(),
      targetPosition: centers.targetWorld.toArray(),
      distance,
      captureDistance: Math.max(magnetDistance, initialDistanceRef.current * MAGNETIC_ROUTE_CAPTURE_RATIO),
      hardSnapDistance: snapDistance,
      progress,
      magnetState: magnetStateRef.current,
      yLocked: false,
    });
  }, [
    computeInstallationTarget,
    getVisualCenters,
    isActive,
    isMovablePart,
    label,
    magnetDistance,
    onTelemetry,
    partKey,
    snapDistance,
  ]);

  useEffect(() => {
    if (!groupRef.current || !rotationRef.current) return;

    const target = computeInstallationTarget();
    completionReportedRef.current = false;
    grabbingRef.current = false;
    magnetNoticeRef.current = false;

    if (isCompleted) {
      groupRef.current.position.copy(target.position);
      rotationRef.current.quaternion.copy(target.quaternion);
      magnetStateRef.current = "Installed";
      setPhaseSafely("installed");
    } else {
      groupRef.current.position.set(...startPosition);
      rotationRef.current.quaternion.copy(tableQuaternion);
      dragCurrentYRef.current = groupRef.current.position.y;
      magnetStateRef.current = "Move toward host field";
      setPhaseSafely("ready");
    }

    groupRef.current.updateMatrixWorld(true);
    initialDistanceRef.current = Math.max(
      groupRef.current.position.distanceTo(target.position),
      magnetDistance,
      1
    );

    requestAnimationFrame(() => publishTelemetry());
  }, [
    computeInstallationTarget,
    isCompleted,
    magnetDistance,
    publishTelemetry,
    setPhaseSafely,
    startPosition,
    tableQuaternion,
  ]);

  const reportCompletion = useCallback(() => {
    if (completionReportedRef.current || isCompleted) return;
    completionReportedRef.current = true;
    onPartCompleted(partKey);
  }, [isCompleted, onPartCompleted, partKey]);

  const finishInstall = useCallback(() => {
    if (!groupRef.current || !rotationRef.current) return;
    const target = computeInstallationTarget();
    groupRef.current.position.copy(target.position);
    rotationRef.current.quaternion.copy(target.quaternion);
    groupRef.current.updateMatrixWorld(true);
    grabbingRef.current = false;
    magnetStateRef.current = "Installed";
    magnetNoticeRef.current = false;
    onDragStateChange(false);
    document.body.style.cursor = "default";
    setPhaseSafely("installed");
    onInteractionMessage(
      `${label} was magnetically aligned, animated into its seat, and locked in place.`
    );
    publishTelemetry();
    reportCompletion();
  }, [
    computeInstallationTarget,
    label,
    onDragStateChange,
    onInteractionMessage,
    publishTelemetry,
    reportCompletion,
    setPhaseSafely,
  ]);

  const seatComponent = useCallback(() => {
    if (
      !groupRef.current ||
      !rotationRef.current ||
      phaseRef.current === "snapping" ||
      phaseRef.current === "installed"
    ) {
      return;
    }

    const target = computeInstallationTarget();
    const centers = getVisualCenters(target);
    const route = computeSafeApproachPlan(target, centers);

    snapStartPositionRef.current.copy(groupRef.current.position);
    snapStartQuaternionRef.current.copy(rotationRef.current.quaternion);

    const pathDistance =
      snapStartPositionRef.current.distanceTo(route.lift) +
      route.lift.distanceTo(route.hover) +
      route.hover.distanceTo(route.preSeat) +
      route.preSeat.distanceTo(target.position);

    snapStartedAtRef.current = performance.now();
    snapDurationRef.current = THREE.MathUtils.clamp(
      MAGNETIC_SNAP_MIN_DURATION_MS + pathDistance * 34,
      MAGNETIC_SNAP_MIN_DURATION_MS,
      MAGNETIC_SNAP_MAX_DURATION_MS
    );

    grabbingRef.current = false;
    magnetStateRef.current = "Safe-path magnetic capture";
    onDragStateChange(false);
    document.body.style.cursor = "default";
    setPhaseSafely("snapping");
    onInteractionMessage(
      `The invisible ${MOTHERBOARD_CHILD_KEYS.has(partKey) ? "motherboard" : "case"} field captured ${label}. It will lift, align above the opening, lower vertically, and seat without passing through the chassis.`
    );
  }, [
    computeInstallationTarget,
    computeSafeApproachPlan,
    getVisualCenters,
    label,
    onDragStateChange,
    onInteractionMessage,
    partKey,
    setPhaseSafely,
  ]);

  const beginGrab = useCallback(
    (event) => {
      if (!groupRef.current || !rotationRef.current) return;
      updatePointer(event);

      const target = computeInstallationTarget();
      const centers = getVisualCenters(target);
      pointerStartRef.current.copy(pointerClientRef.current);
      dragStartCenterWorldRef.current.copy(centers.currentWorld);
      dragStartYRef.current = groupRef.current.position.y;
      dragCurrentYRef.current = groupRef.current.position.y;
      initialDistanceRef.current = Math.max(
        groupRef.current.position.distanceTo(target.position),
        magnetDistance,
        1
      );
      const safeRoute = computeSafeApproachPlan(target, centers);
      safeCarryYRef.current = safeRoute.lift.y;

      cameraRightRef.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
      cameraUpRef.current.set(0, 1, 0).applyQuaternion(camera.quaternion);
      camera.getWorldDirection(cameraForwardRef.current);

      dragRightWorldRef.current
        .copy(cameraRightRef.current)
        .setY(0);
      if (dragRightWorldRef.current.lengthSq() < 0.0001) {
        dragRightWorldRef.current.set(1, 0, 0);
      } else {
        dragRightWorldRef.current.normalize();
      }

      dragUpWorldRef.current.copy(cameraUpRef.current).setY(0);
      if (dragUpWorldRef.current.lengthSq() < 0.0001) {
        dragUpWorldRef.current
          .copy(cameraForwardRef.current)
          .setY(0)
          .multiplyScalar(-1);
      }
      if (dragUpWorldRef.current.lengthSq() < 0.0001) {
        dragUpWorldRef.current.set(0, 0, 1);
      } else {
        dragUpWorldRef.current.normalize();
      }

      const distanceToCamera = Math.max(
        camera.position.distanceTo(centers.currentWorld),
        1
      );
      const visibleHeight =
        2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distanceToCamera;
      worldUnitsPerPixelRef.current = THREE.MathUtils.clamp(
        visibleHeight / Math.max(gl.domElement.clientHeight, 1),
        0.002,
        0.35
      );

      grabbingRef.current = true;
      magnetStateRef.current = "Carrying toward host field";
      magnetNoticeRef.current = false;
      setPhaseSafely("grabbed");
      onDragStateChange(true);
      document.body.style.cursor = "grabbing";
      onInteractionMessage(
        `${label} grabbed. Drag it toward the ${MOTHERBOARD_CHILD_KEYS.has(partKey) ? "motherboard" : "case"}; entering the invisible field will automatically start the seating animation.`
      );
      publishTelemetry();
    },
    [
      camera,
      computeInstallationTarget,
      computeSafeApproachPlan,
      getVisualCenters,
      gl,
      label,
      magnetDistance,
      modelRadius,
      onDragStateChange,
      onInteractionMessage,
      partKey,
      publishTelemetry,
      setPhaseSafely,
      updatePointer,
    ]
  );

  const releaseObject = useCallback(() => {
    if (!grabbingRef.current || !groupRef.current) return;
    grabbingRef.current = false;
    onDragStateChange(false);
    document.body.style.cursor = "default";

    const target = computeInstallationTarget();
    const centers = getVisualCenters(target);
    const field = getHostFieldInfo(centers.currentWorld, centers.targetWorld);
    const distance = groupRef.current.position.distanceTo(target.position);
    const routeCaptureDistance = Math.max(
      magnetDistance * 1.25,
      initialDistanceRef.current * MAGNETIC_ROUTE_CAPTURE_RATIO
    );

    if (
      field.inside ||
      field.strength >= MAGNETIC_FIELD_CAPTURE_THRESHOLD ||
      distance <= routeCaptureDistance
    ) {
      seatComponent();
      return;
    }

    magnetStateRef.current = "Released outside host field";
    setPhaseSafely("released");
    onInteractionMessage(
      `${label} was released outside the magnetic field. Drag it closer to the ${MOTHERBOARD_CHILD_KEYS.has(partKey) ? "motherboard" : "case"}; exact placement is not required.`
    );
    publishTelemetry();
  }, [
    computeInstallationTarget,
    getHostFieldInfo,
    getVisualCenters,
    label,
    magnetDistance,
    onDragStateChange,
    onInteractionMessage,
    partKey,
    publishTelemetry,
    seatComponent,
    setPhaseSafely,
  ]);

  useEffect(() => {
    const handlePointerMove = (event) => updatePointer(event);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [updatePointer]);

  useEffect(() => {
    if (phase !== "grabbed") return undefined;

    const handlePointerUp = (event) => {
      if (event.button !== 0) return;
      releaseObject();
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") releaseObject();
    };

    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [phase, releaseObject]);

  useEffect(() => {
    const cancelGrab = () => {
      if (!grabbingRef.current) return;
      grabbingRef.current = false;
      onDragStateChange(false);
      document.body.style.cursor = "default";
      setPhaseSafely("released");
    };
    window.addEventListener("pointercancel", cancelGrab);
    window.addEventListener("blur", cancelGrab);
    return () => {
      window.removeEventListener("pointercancel", cancelGrab);
      window.removeEventListener("blur", cancelGrab);
      document.body.style.cursor = "default";
    };
  }, [onDragStateChange, setPhaseSafely]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current || !rotationRef.current) return;
    const safeDelta = Math.min(delta, 0.05);
    const target = computeInstallationTarget();
    const centers = getVisualCenters(target);
    const distance = groupRef.current.position.distanceTo(target.position);
    const routeCaptureDistance = Math.max(
      magnetDistance * 1.25,
      initialDistanceRef.current * MAGNETIC_ROUTE_CAPTURE_RATIO
    );
    const proximity = THREE.MathUtils.clamp(
      1 - distance / Math.max(routeCaptureDistance, 0.001),
      0,
      1
    );

    if (shouldShowGuides && phaseRef.current !== "installed") {
      if (tetherRef.current) {
        lineStartRef.current.copy(centers.currentLocal);
        lineEndRef.current.copy(centers.targetLocal);
        tetherRef.current.geometry.setFromPoints([
          lineStartRef.current,
          lineEndRef.current,
        ]);
        tetherRef.current.visible = true;
      }
      if (tetherMaterialRef.current) {
        tetherMaterialRef.current.opacity = 0.2 + proximity * 0.7;
      }
      if (captureRingRef.current) {
        captureRingRef.current.visible = true;
        captureRingRef.current.position.copy(centers.targetLocal);
        captureRingRef.current.scale.setScalar(
          1 + Math.sin(clock.elapsedTime * 4.5) * 0.055
        );
      }
      if (captureRingMaterialRef.current) {
        captureRingMaterialRef.current.opacity = 0.12 + proximity * 0.3;
      }
    } else {
      if (tetherRef.current) tetherRef.current.visible = false;
      if (captureRingRef.current) captureRingRef.current.visible = false;
    }

    if (phaseRef.current === "snapping") {
      const rawProgress = THREE.MathUtils.clamp(
        (performance.now() - snapStartedAtRef.current) /
          Math.max(snapDurationRef.current, 1),
        0,
        1
      );

      if (rawProgress < 0.24) {
        const segmentProgress = THREE.MathUtils.smootherstep(
          rawProgress,
          0,
          0.24
        );
        groupRef.current.position.lerpVectors(
          snapStartPositionRef.current,
          snapLiftPositionRef.current,
          segmentProgress
        );
        magnetStateRef.current = `Lifting clear ${Math.round(segmentProgress * 100)}%`;
      } else if (rawProgress < 0.64) {
        const segmentProgress = THREE.MathUtils.smootherstep(
          rawProgress,
          0.24,
          0.64
        );
        groupRef.current.position.lerpVectors(
          snapLiftPositionRef.current,
          snapHoverPositionRef.current,
          segmentProgress
        );
        magnetStateRef.current = `Aligning above seat ${Math.round(segmentProgress * 100)}%`;
      } else if (rawProgress < 0.93) {
        const segmentProgress = THREE.MathUtils.smootherstep(
          rawProgress,
          0.64,
          0.93
        );
        groupRef.current.position.lerpVectors(
          snapHoverPositionRef.current,
          snapPreSeatPositionRef.current,
          segmentProgress
        );
        magnetStateRef.current = `Lowering vertically ${Math.round(segmentProgress * 100)}%`;
      } else {
        const segmentProgress = THREE.MathUtils.smootherstep(
          rawProgress,
          0.93,
          1
        );
        groupRef.current.position.lerpVectors(
          snapPreSeatPositionRef.current,
          target.position,
          segmentProgress
        );
        magnetStateRef.current = `Final seating ${Math.round(segmentProgress * 100)}%`;
      }

      const rotationProgress = THREE.MathUtils.smootherstep(
        rawProgress,
        0.18,
        0.9
      );
      rotationRef.current.quaternion.slerpQuaternions(
        snapStartQuaternionRef.current,
        target.quaternion,
        rotationProgress
      );

      if (rawProgress >= 1) finishInstall();
    } else if (grabbingRef.current) {
      const pointerDeltaX = pointerClientRef.current.x - pointerStartRef.current.x;
      const pointerDeltaY = pointerClientRef.current.y - pointerStartRef.current.y;
      const pointerTravel = Math.hypot(pointerDeltaX, pointerDeltaY);
      const dragScale = worldUnitsPerPixelRef.current;

      desiredCenterWorldRef.current
        .copy(dragStartCenterWorldRef.current)
        .addScaledVector(dragRightWorldRef.current, pointerDeltaX * dragScale)
        .addScaledVector(dragUpWorldRef.current, -pointerDeltaY * dragScale);

      desiredCenterLocalRef.current.copy(desiredCenterWorldRef.current);
      const parent = groupRef.current.parent;
      if (parent) parent.worldToLocal(desiredCenterLocalRef.current);
      desiredGroupLocalRef.current
        .copy(desiredCenterLocalRef.current)
        .sub(modelCenter);

      const desiredDistance = desiredGroupLocalRef.current.distanceTo(target.position);
      const liftProgress = THREE.MathUtils.clamp(pointerTravel / 72, 0, 1);
      const safeY = THREE.MathUtils.lerp(
        dragStartYRef.current,
        safeCarryYRef.current,
        THREE.MathUtils.smootherstep(liftProgress, 0, 1)
      );
      dragCurrentYRef.current = THREE.MathUtils.damp(
        dragCurrentYRef.current,
        safeY,
        10,
        safeDelta
      );
      desiredGroupLocalRef.current.y = dragCurrentYRef.current;
      assistedGoalRef.current.copy(desiredGroupLocalRef.current);

      localGroupCenterToWorld(
        desiredGroupLocalRef.current,
        desiredVisualCenterWorldRef.current
      );
      const field = getHostFieldInfo(
        desiredVisualCenterWorldRef.current,
        centers.targetWorld
      );
      const routeStrength = THREE.MathUtils.clamp(
        1 - desiredDistance / Math.max(routeCaptureDistance, 0.001),
        0,
        1
      );
      const activeFieldStrength = Math.max(field.strength, routeStrength);

      if (activeFieldStrength > 0) {
        const easedStrength = THREE.MathUtils.smootherstep(
          activeFieldStrength,
          0,
          1
        );
        const safeRoute = computeSafeApproachPlan(target, {
          currentWorld: desiredVisualCenterWorldRef.current,
          targetWorld: centers.targetWorld,
        });
        const currentCenterHeight = centers.currentWorld.y;
        const safelyLifted =
          currentCenterHeight >= safeRoute.safeCenterWorldY - safeRoute.clearance * 0.2;
        routeGoalRef.current.copy(safelyLifted ? safeRoute.hover : safeRoute.lift);
        assistedGoalRef.current.lerp(
          routeGoalRef.current,
          THREE.MathUtils.lerp(
            MAGNETIC_FIELD_MIN_PULL,
            MAGNETIC_FIELD_MAX_PULL,
            easedStrength
          )
        );
        rotationRef.current.quaternion.slerp(
          target.quaternion,
          1 - Math.exp(-(4 + easedStrength * 8) * safeDelta)
        );
        magnetStateRef.current = field.inside
          ? "Inside host magnetic field"
          : "Host field pulling";
        if (!magnetNoticeRef.current && activeFieldStrength > 0.15) {
          magnetNoticeRef.current = true;
          onInteractionMessage(
            `${label} entered the magnetic approach zone. The ${MOTHERBOARD_CHILD_KEYS.has(partKey) ? "motherboard" : "case"} is pulling it toward the exact seat.`
          );
        }
      } else {
        magnetStateRef.current = "Move toward host field";
        magnetNoticeRef.current = false;
        rotationRef.current.quaternion.slerp(
          tableQuaternion,
          1 - Math.exp(-ROTATION_FOLLOW_SPEED * safeDelta)
        );
      }

      groupRef.current.position.lerp(
        assistedGoalRef.current,
        1 - Math.exp(-DRAG_FOLLOW_SPEED * safeDelta)
      );

      const currentCenterWorld = localGroupCenterToWorld(
        groupRef.current.position,
        currentCenterWorldRef.current
      );
      const currentField = getHostFieldInfo(
        currentCenterWorld,
        centers.targetWorld
      );
      const currentDistance = groupRef.current.position.distanceTo(target.position);
      const easySnapDistance = Math.max(
        snapDistance * 2.2,
        magnetDistance * 0.28,
        modelRadius * 0.35
      );

      if (
        pointerTravel >= MAGNETIC_FIELD_MIN_POINTER_TRAVEL_PX &&
        (currentField.inside ||
          activeFieldStrength >= MAGNETIC_FIELD_AUTO_CAPTURE_THRESHOLD ||
          currentDistance <= easySnapDistance)
      ) {
        seatComponent();
        return;
      }
    } else if (phaseRef.current === "released") {
      const field = getHostFieldInfo(centers.currentWorld, centers.targetWorld);
      const routeStrength = THREE.MathUtils.clamp(
        1 - distance / Math.max(routeCaptureDistance, 0.001),
        0,
        1
      );
      const strength = Math.max(field.strength, routeStrength);
      if (strength > 0.02) {
        magnetStateRef.current = "Safe-path capture starting";
        seatComponent();
        return;
      }
    } else if (phaseRef.current === "installed") {
      // Installed parts become rigid children of their authored host frame.
      // Directly following the moving target prevents lag or separation while
      // the completed case rotates from flat to its upright presentation.
      groupRef.current.position.copy(target.position);
      rotationRef.current.quaternion.copy(target.quaternion);
    }

    frameCounterRef.current += 1;
    const interval = grabbingRef.current
      ? TELEMETRY_FRAME_INTERVAL
      : TELEMETRY_IDLE_FRAME_INTERVAL;
    if (isActive && frameCounterRef.current % interval === 0) {
      publishTelemetry();
    }
  });

  const handlePointerDown = useCallback(
    (event) => {
      if (!isMovablePart) return;
      event.stopPropagation();
      if (!canInteract) {
        if (isCompleted || phaseRef.current === "installed") {
          onInteractionMessage(`${label} is already installed and locked.`);
        } else {
          onLockedPartClick(partKey);
        }
        return;
      }
      if (phaseRef.current === "ready" || phaseRef.current === "released") {
        beginGrab(event);
      }
    },
    [
      beginGrab,
      canInteract,
      isCompleted,
      isMovablePart,
      label,
      onInteractionMessage,
      onLockedPartClick,
      partKey,
    ]
  );

  const handlePointerOver = useCallback(
    (event) => {
      if (!isMovablePart) return;
      event.stopPropagation();
      document.body.style.cursor = canInteract ? "grab" : "not-allowed";
    },
    [canInteract, isMovablePart]
  );

  const handlePointerOut = useCallback(() => {
    if (!grabbingRef.current) document.body.style.cursor = "default";
  }, []);

  return (
    <>
      <group
        ref={groupRef}
        position={startPosition}
        onPointerDown={handlePointerDown}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <group position={[modelCenter.x, modelCenter.y, modelCenter.z]}>
          <group ref={rotationRef} quaternion={tableQuaternion.toArray()}>
            <group
              ref={contentFrameRef}
              position={[-modelCenter.x, -modelCenter.y, -modelCenter.z]}
            >
              {children}
            </group>
          </group>
        </group>
      </group>

      <line ref={tetherRef} visible={false} renderOrder={1100}>
        <bufferGeometry />
        <lineBasicMaterial
          ref={tetherMaterialRef}
          color="#FFD41C"
          transparent
          opacity={0.45}
          depthTest={false}
          depthWrite={false}
        />
      </line>

      <mesh
        ref={captureRingRef}
        visible={false}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1099}
      >
        <ringGeometry args={[captureRingRadius * 0.72, captureRingRadius, 64]} />
        <meshBasicMaterial
          ref={captureRingMaterialRef}
          color="#FFD41C"
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

function AssemblyPart({
  part,
  targetFrameRef,
  magnetFieldRef,
  targetSeatOffsetLocal = null,
  isActive,
  isFullRun = false,
  showGuides = true,
  isCompleted,
  onPartCompleted,
  onLockedPartClick,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
}) {
  const { scene } = useGLTF(encodeURI(part.path));
  const clone = useMemo(
    () => cloneSceneForDisplay(scene, { enableShadows: part.key !== "cpu" }),
    [part.key, scene]
  );
  const bounds = useMemo(() => getModelBounds(clone), [clone]);

  return (
    <InteractiveCenteredObject
      partKey={part.key}
      label={COMPONENT_LABELS[part.key] || part.key}
      modelCenter={bounds.center}
      modelSize={bounds.size}
      startConfig={TABLE_STARTS[part.key]}
      targetFrameRef={targetFrameRef}
      magnetFieldRef={magnetFieldRef}
      targetSeatOffsetLocal={targetSeatOffsetLocal}
      isActive={isActive}
      isFullRun={isFullRun}
      showGuides={showGuides}
      isCompleted={isCompleted}
      onPartCompleted={onPartCompleted}
      onLockedPartClick={onLockedPartClick}
      onInteractionMessage={onInteractionMessage}
      onDragStateChange={onDragStateChange}
      onTelemetry={onTelemetry}
    >
      <primitive object={clone} dispose={null} />
    </InteractiveCenteredObject>
  );
}

/* ------------------------------------------------------------------ */
/* Pulsing installation highlight at the GLB-authored target           */
/* ------------------------------------------------------------------ */


function InstallationTargetGuide({ part, seatOffsetLocal = null }) {
  const { scene } = useGLTF(encodeURI(part.path));
  const pulseRef = useRef(null);
  const markerRef = useRef(null);

  const guideData = useMemo(() => {
    const fillScene = scene.clone(true);
    const wireScene = scene.clone(true);
    const fillMaterials = [];
    const wireMaterials = [];

    fillScene.traverse((object) => {
      if (!object.isMesh) return;
      object.raycast = () => null;
      object.renderOrder = 1000;
      const material = new THREE.MeshBasicMaterial({
        color: "#FFD41C",
        transparent: true,
        opacity: part.key === "cpu" ? 0.04 : 0.09,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      object.material = material;
      fillMaterials.push(material);
    });

    wireScene.traverse((object) => {
      if (!object.isMesh) return;
      object.raycast = () => null;
      object.renderOrder = 1001;
      const material = new THREE.MeshBasicMaterial({
        color: "#7dffdc",
        transparent: true,
        opacity: 0.76,
        wireframe: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      object.material = material;
      wireMaterials.push(material);
    });

    fillScene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(fillScene);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const callout = new THREE.Vector3(
      center.x + Math.max(size.x * 0.82, 0.95),
      center.y + Math.max(size.y * 1.25, 0.95),
      center.z + Math.max(size.z * 0.45, 0.55)
    );

    return {
      fillScene,
      wireScene,
      fillMaterials,
      wireMaterials,
      center,
      size,
      callout,
    };
  }, [part.key, scene]);

  useEffect(() => {
    return () => {
      [...guideData.fillMaterials, ...guideData.wireMaterials].forEach(
        (material) => material.dispose()
      );
    };
  }, [guideData]);

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.elapsedTime * 3.5) + 1) / 2;

    if (pulseRef.current) {
      pulseRef.current.scale.setScalar(0.985 + pulse * 0.03);
    }
    guideData.fillMaterials.forEach((material) => {
      material.opacity = (part.key === "cpu" ? 0.025 : 0.05) + pulse * 0.09;
    });
    guideData.wireMaterials.forEach((material) => {
      material.opacity = 0.5 + pulse * 0.34;
    });

    if (markerRef.current?.material) {
      markerRef.current.material.opacity = 0.35 + pulse * 0.55;
    }
  });

  const guideSeatOffset = useMemo(() => {
    if (!seatOffsetLocal) return new THREE.Vector3();
    if (seatOffsetLocal.isVector3) return seatOffsetLocal.clone();
    return new THREE.Vector3().fromArray(seatOffsetLocal);
  }, [seatOffsetLocal]);

  const markerRadius = THREE.MathUtils.clamp(
    Math.max(guideData.size.x, guideData.size.y, guideData.size.z) * 0.16,
    0.18,
    2.5
  );

  return (
    <group position={guideSeatOffset.toArray()}>
      <group ref={pulseRef}>
        <primitive object={guideData.fillScene} dispose={null} />
        <primitive object={guideData.wireScene} dispose={null} />
      </group>

      <mesh ref={markerRef} position={guideData.center.toArray()} renderOrder={1002}>
        <sphereGeometry args={[markerRadius, 24, 16]} />
        <meshBasicMaterial
          color="#FFD41C"
          transparent
          opacity={0.7}
          wireframe
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      <Html
        center
        position={guideData.callout.toArray()}
        transform
        sprite
        distanceFactor={11}
        occlude={false}
        style={{ pointerEvents: "none" }}
      >
        <div className="whitespace-nowrap rounded-xl border border-[#FFD41C]/40 bg-[#07111d]/95 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#73ffd4] shadow-[0_12px_35px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <span className="mr-2 inline-flex rounded-full border border-[#FFD41C]/35 bg-[#FFD41C]/12 px-2 py-0.5 text-[8px]">TARGET</span>
          Install {COMPONENT_LABELS[part.key]} here
        </div>
      </Html>
    </group>
  );
}

function CaseWorkspace({
  contentFrameRef,
  magneticFieldRef,
  activePartKeys,
  showGuides,
  standCase = false,
}) {
  const part = PART_BY_KEY.case;
  const { scene } = useGLTF(encodeURI(part.path));
  const { scene: motherboardTargetScene } = useGLTF(
    encodeURI(PART_BY_KEY.motherboard.path)
  );
  const { scene: psuTargetScene } = useGLTF(encodeURI(PART_BY_KEY.psu.path));
  const { scene: hddTargetScene } = useGLTF(encodeURI(PART_BY_KEY.hdd.path));
  const { scene: gpuTargetScene } = useGLTF(encodeURI(PART_BY_KEY.gpu.path));

  const groundedGroupRef = useRef(null);
  const caseRotationRef = useRef(null);
  const transitionStartedAtRef = useRef(0);
  const transitionFromQuaternionRef = useRef(new THREE.Quaternion());
  const transitionToQuaternionRef = useRef(new THREE.Quaternion());
  const transitioningRef = useRef(false);

  const caseClone = useMemo(
    () => cloneSceneForDisplay(scene, { disableRaycast: true }),
    [scene]
  );
  const bounds = useMemo(() => getModelBounds(caseClone), [caseClone]);
  const caseTargetCenters = useMemo(
    () =>
      [
        motherboardTargetScene,
        psuTargetScene,
        hddTargetScene,
        gpuTargetScene,
      ].map((targetScene) => getModelBounds(targetScene).center),
    [gpuTargetScene, hddTargetScene, motherboardTargetScene, psuTargetScene]
  );
  const layFlatQuaternion = useMemo(
    () =>
      chooseOpenSideUpCaseQuaternion(
        bounds.size,
        bounds.center,
        caseTargetCenters
      ),
    [bounds.center, bounds.size, caseTargetCenters]
  );
  const groundOffsetY = useMemo(
    () =>
      getGroundedRotationOffsetY(
        bounds.box,
        bounds.center,
        layFlatQuaternion
      ),
    [bounds.box, bounds.center, layFlatQuaternion]
  );
  const standingQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const inverseCenter = useMemo(
    () => bounds.center.clone().multiplyScalar(-1),
    [bounds.center]
  );
  const activeCasePartKey = activePartKeys.find(
    (key) => !MOTHERBOARD_CHILD_KEYS.has(key)
  );
  const activeCasePart = activeCasePartKey
    ? PART_BY_KEY[activeCasePartKey]
    : null;

  useEffect(() => {
    const rotationGroup = caseRotationRef.current;
    if (!rotationGroup) return;

    transitionFromQuaternionRef.current.copy(rotationGroup.quaternion);
    transitionToQuaternionRef.current.copy(
      standCase ? standingQuaternion : layFlatQuaternion
    );
    transitionStartedAtRef.current = performance.now();
    transitioningRef.current = true;
  }, [layFlatQuaternion, standCase, standingQuaternion]);

  useFrame(() => {
    const groundedGroup = groundedGroupRef.current;
    const rotationGroup = caseRotationRef.current;
    if (!groundedGroup || !rotationGroup) return;

    if (transitioningRef.current) {
      const rawProgress = THREE.MathUtils.clamp(
        (performance.now() - transitionStartedAtRef.current) /
          CASE_STAND_TRANSITION_DURATION_MS,
        0,
        1
      );
      const easedProgress = THREE.MathUtils.smootherstep(rawProgress, 0, 1);
      rotationGroup.quaternion.slerpQuaternions(
        transitionFromQuaternionRef.current,
        transitionToQuaternionRef.current,
        easedProgress
      );
      if (rawProgress >= 1) {
        rotationGroup.quaternion.copy(transitionToQuaternionRef.current);
        transitioningRef.current = false;
      }
    }

    // Recalculate contact height from the current quaternion every frame so
    // the chassis rolls smoothly into position without floating or clipping
    // through the tabletop during the flat-to-standing transition.
    groundedGroup.position.y = getGroundedRotationOffsetY(
      bounds.box,
      bounds.center,
      rotationGroup.quaternion
    );
  });

  return (
    <group ref={groundedGroupRef} position={[0, groundOffsetY, 0]}>
      <group position={bounds.center.toArray()}>
        <group ref={caseRotationRef} quaternion={layFlatQuaternion.toArray()}>
          <group ref={contentFrameRef} position={inverseCenter.toArray()}>
            <group ref={magneticFieldRef}>
              <primitive object={caseClone} dispose={null} />
            </group>
            {showGuides && activeCasePart ? (
              <InstallationTargetGuide
                key={`case-target-${activeCasePart.key}`}
                part={activeCasePart}
              />
            ) : null}
          </group>
        </group>
      </group>
    </group>
  );
}

function MotherboardUnit({
  contentFrameRef,
  magneticFieldRef,
  targetFrameRef,
  targetMagnetFieldRef,
  activePartKeys,
  isFullRun = false,
  showGuides = true,
  completedParts,
  cpuSeatOffsetLocal,
  onPartCompleted,
  onLockedPartClick,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
}) {
  const part = PART_BY_KEY.motherboard;
  const { scene } = useGLTF(encodeURI(part.path));
  const motherboardIsActive = activePartKeys.includes("motherboard");
  const activeChildKey = activePartKeys.find((key) =>
    MOTHERBOARD_CHILD_KEYS.has(key)
  );
  const activeChildPart = activeChildKey ? PART_BY_KEY[activeChildKey] : null;
  const motherboardClone = useMemo(
    () =>
      cloneSceneForDisplay(scene, {
        disableRaycast: !motherboardIsActive,
      }),
    [motherboardIsActive, scene]
  );
  const bounds = useMemo(
    () => getModelBounds(motherboardClone),
    [motherboardClone]
  );

  return (
    <InteractiveCenteredObject
      partKey="motherboard"
      label="Motherboard"
      modelCenter={bounds.center}
      modelSize={bounds.size}
      startConfig={TABLE_STARTS.motherboard}
      targetFrameRef={targetFrameRef}
      magnetFieldRef={targetMagnetFieldRef}
      isActive={motherboardIsActive}
      isFullRun={isFullRun}
      showGuides={showGuides}
      isCompleted={completedParts.includes("motherboard")}
      onPartCompleted={onPartCompleted}
      onLockedPartClick={onLockedPartClick}
      onInteractionMessage={onInteractionMessage}
      onDragStateChange={onDragStateChange}
      onTelemetry={onTelemetry}
      contentFrameRef={contentFrameRef}
    >
      <group ref={magneticFieldRef}>
        <primitive object={motherboardClone} dispose={null} />
      </group>

      {["cpu", "ram1", "ram2", "ssd"].map((key) =>
        completedParts.includes(key) ? (
          <group
            key={`installed-${key}`}
            position={
              key === "cpu" && cpuSeatOffsetLocal
                ? cpuSeatOffsetLocal.toArray()
                : [0, 0, 0]
            }
          >
            <StaticAuthoredModel
              part={PART_BY_KEY[key]}
              disableRaycast
            />
          </group>
        ) : null
      )}

      {showGuides && activeChildPart ? (
        <InstallationTargetGuide
          key={`motherboard-target-${activeChildPart.key}`}
          part={activeChildPart}
          seatOffsetLocal={
            activeChildPart.key === "cpu" ? cpuSeatOffsetLocal : null
          }
        />
      ) : null}
    </InteractiveCenteredObject>
  );
}

function Loader() {
  return (
    <Html center>
      <div className="rounded-xl border border-[#1a2438] bg-[#0b1220]/90 px-4 py-2 text-xs font-semibold text-[#FFD41C]">
        Loading assembly scene...
      </div>
    </Html>
  );
}

class ModelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("Failed to load one or more Module 3 models:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <Html center>
          <div className="max-w-[300px] rounded-xl border border-red-400/30 bg-[#0b1220]/95 px-4 py-3 text-center text-[11px] font-semibold leading-5 text-red-300">
            Could not load one of the assembly models.
            <br />
            Verify these files in /public/models:
            <br />
            <span className="break-all text-red-200">
              {this.props.parts.map((part) => part.path.split("/").pop()).join(", ")}
            </span>
          </div>
        </Html>
      );
    }

    return this.props.children;
  }
}

function AssemblyScene({
  rootRef,
  activePartKeys = [],
  isFullRun = false,
  showGuides = true,
  completedParts,
  onPartCompleted,
  onLockedPartClick,
  onInteractionMessage,
  onDragStateChange,
  onTelemetry,
}) {
  const caseContentRef = useRef(null);
  const caseMagneticFieldRef = useRef(null);
  const motherboardContentRef = useRef(null);
  const motherboardMagneticFieldRef = useRef(null);
  const { scene: motherboardCalibrationScene } = useGLTF(
    encodeURI(PART_BY_KEY.motherboard.path)
  );
  const { scene: cpuCalibrationScene } = useGLTF(
    encodeURI(PART_BY_KEY.cpu.path)
  );
  const cpuSeatOffsetLocal = useMemo(
    () =>
      getCpuSeatCorrectionLocal(
        motherboardCalibrationScene,
        cpuCalibrationScene
      ),
    [cpuCalibrationScene, motherboardCalibrationScene]
  );
  const standCompletedCase = useMemo(
    () =>
      ["motherboard", "psu", "hdd", "gpu"].every((key) =>
        completedParts.includes(key)
      ),
    [completedParts]
  );

  return (
    <group ref={rootRef}>
      <StaticAuthoredModel part={PART_BY_KEY.table} disableRaycast />

      <CaseWorkspace
        contentFrameRef={caseContentRef}
        magneticFieldRef={caseMagneticFieldRef}
        activePartKeys={activePartKeys}
        showGuides={showGuides}
        standCase={standCompletedCase}
      />

      <MotherboardUnit
        contentFrameRef={motherboardContentRef}
        magneticFieldRef={motherboardMagneticFieldRef}
        targetFrameRef={caseContentRef}
        targetMagnetFieldRef={caseMagneticFieldRef}
        activePartKeys={activePartKeys}
        isFullRun={isFullRun}
        showGuides={showGuides}
        completedParts={completedParts}
        cpuSeatOffsetLocal={cpuSeatOffsetLocal}
        onPartCompleted={onPartCompleted}
        onLockedPartClick={onLockedPartClick}
        onInteractionMessage={onInteractionMessage}
        onDragStateChange={onDragStateChange}
        onTelemetry={onTelemetry}
      />

      {ASSEMBLY_SEQUENCE.filter((key) => key !== "motherboard").map((key) => {
        const isMotherboardChild = MOTHERBOARD_CHILD_KEYS.has(key);
        if (isMotherboardChild && completedParts.includes(key)) return null;

        return (
          <AssemblyPart
            key={key}
            part={PART_BY_KEY[key]}
            targetFrameRef={
              isMotherboardChild ? motherboardContentRef : caseContentRef
            }
            magnetFieldRef={
              isMotherboardChild
                ? motherboardMagneticFieldRef
                : caseMagneticFieldRef
            }
            targetSeatOffsetLocal={key === "cpu" ? cpuSeatOffsetLocal : null}
            isActive={activePartKeys.includes(key)}
            isFullRun={isFullRun}
            showGuides={showGuides}
            isCompleted={completedParts.includes(key)}
            onPartCompleted={onPartCompleted}
            onLockedPartClick={onLockedPartClick}
            onInteractionMessage={onInteractionMessage}
            onDragStateChange={onDragStateChange}
            onTelemetry={onTelemetry}
          />
        );
      })}
    </group>
  );
}

function FullTableBirdEyeCamera({ sceneRootRef, controlsRef, overviewRequest }) {
  const { camera, size } = useThree();
  const initializedRef = useRef(false);
  const handledRequestRef = useRef(-1);

  useEffect(() => {
    const isInitial = !initializedRef.current;
    const isRequested = overviewRequest !== handledRequestRef.current;
    if (!isInitial && !isRequested) return undefined;

    let frameId = 0;
    let attempts = 0;

    const frameWholeWorkspace = () => {
      const root = sceneRootRef.current;
      const controls = controlsRef.current;
      if (!root || !controls) {
        attempts += 1;
        if (attempts < 60) frameId = requestAnimationFrame(frameWholeWorkspace);
        return;
      }

      root.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(root);
      if (box.isEmpty()) {
        attempts += 1;
        if (attempts < 60) frameId = requestAnimationFrame(frameWholeWorkspace);
        return;
      }

      const center = box.getCenter(new THREE.Vector3());
      const sceneSize = box.getSize(new THREE.Vector3());
      const aspect = Math.max(size.width / Math.max(size.height, 1), 0.5);
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
      const verticalDistance =
        (sceneSize.y * 0.72) / Math.max(Math.tan(verticalFov / 2), 0.2);
      const horizontalDistance =
        (sceneSize.x * 0.72) / Math.max(Math.tan(horizontalFov / 2), 0.2);
      const depthDistance = sceneSize.z * 0.9;
      const distance = Math.max(
        verticalDistance,
        horizontalDistance,
        depthDistance,
        12
      );

      // Elevated diagonal direction preserves a useful bird's-eye view while
      // keeping every loose component, the motherboard, case, and full table
      // inside the viewport on both wide and smaller screens.
      const direction = new THREE.Vector3(0.42, 1.28, 0.88).normalize();
      const target = center.clone();
      target.y += sceneSize.y * 0.02;

      camera.position.copy(target).addScaledVector(direction, distance * 1.52);
      camera.near = Math.max(0.01, distance / 600);
      camera.far = Math.max(1600, distance * 24);
      camera.updateProjectionMatrix();

      controls.target.copy(target);
      camera.lookAt(target);
      controls.update();
      initializedRef.current = true;
      handledRequestRef.current = overviewRequest;
    };

    frameId = requestAnimationFrame(frameWholeWorkspace);
    return () => cancelAnimationFrame(frameId);
  }, [camera, controlsRef, overviewRequest, sceneRootRef, size.height, size.width]);

  return null;
}



function ModelViewer({
  activePartKeys = [],
  isFullRun = false,
  showGuides = true,
  completedParts,
  onPartCompleted,
  onLockedPartClick,
  onInteractionMessage,
}) {
  const [isDraggingPart, setIsDraggingPart] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [overviewRequest, setOverviewRequest] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef(null);
  const controlsRef = useRef(null);
  const sceneRootRef = useRef(null);
  const activePartKeysKey = activePartKeys.join("|");

  useEffect(() => {
    // Changing stages must not zoom into one item. Keep the whole workspace
    // stable so every currently valid component remains visible.
    setTelemetry(null);
  }, [activePartKeysKey]);

  const refreshOverviewAfterResize = useCallback(() => {
    // Fullscreen changes the canvas dimensions. Wait for the browser to finish
    // laying out the fullscreen element before recalculating the overview.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setOverviewRequest((value) => value + 1);
      });
    });
  }, []);

  const syncFullscreenState = useCallback(() => {
    const fullscreenElement =
      document.fullscreenElement || document.webkitFullscreenElement || null;

    setIsFullscreen(fullscreenElement === viewerRef.current);
    refreshOverviewAfterResize();
  }, [refreshOverviewAfterResize]);

  useEffect(() => {
    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
    };
  }, [syncFullscreenState]);

  const toggleFullscreen = useCallback(async () => {
    if (isDraggingPart || !viewerRef.current) return;

    const fullscreenElement =
      document.fullscreenElement || document.webkitFullscreenElement || null;

    try {
      if (fullscreenElement === viewerRef.current) {
        const exitFullscreen =
          document.exitFullscreen || document.webkitExitFullscreen;

        if (exitFullscreen) {
          await Promise.resolve(exitFullscreen.call(document));
        }
        return;
      }

      // Exit another fullscreen element first, if one is active.
      if (fullscreenElement) {
        const exitFullscreen =
          document.exitFullscreen || document.webkitExitFullscreen;

        if (exitFullscreen) {
          await Promise.resolve(exitFullscreen.call(document));
        }
      }

      const requestFullscreen =
        viewerRef.current.requestFullscreen ||
        viewerRef.current.webkitRequestFullscreen;

      if (requestFullscreen) {
        await Promise.resolve(requestFullscreen.call(viewerRef.current));
      }
    } catch (error) {
      console.error("Unable to toggle fullscreen mode:", error);
    }
  }, [isDraggingPart]);

  return (
    <div
      ref={viewerRef}
      className={[
        "relative h-full w-full overflow-hidden bg-[#070c14]",
        isFullscreen ? "rounded-none" : "",
      ].join(" ")}
      style={isFullscreen ? { width: "100vw", height: "100vh" } : undefined}
    >
      <Canvas
        camera={{ position: [35, 72, 52], fov: 46, near: 0.01, far: 1400 }}
        dpr={[1, 1.45]}
        shadows
        performance={{ min: 0.55 }}
        className="h-full w-full"
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: false,
          stencil: false,
        }}
        style={{ touchAction: "none" }}
      >
        <color attach="background" args={[typeof document !== "undefined" && document.documentElement.classList.contains("articton-light") ? "#f8f9ff" : "#070c14"]} />
        <hemisphereLight args={["#ffffff", "#182338", 1.12]} />
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[6, 10, 7]}
          intensity={1.72}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-5, 4, 2]} intensity={0.65} />

        <ModelErrorBoundary parts={PART_MODELS}>
          <Suspense fallback={<Loader />}>
            <AssemblyScene
              rootRef={sceneRootRef}
              activePartKeys={activePartKeys}
              isFullRun={isFullRun}
              showGuides={showGuides}
              completedParts={completedParts}
              onPartCompleted={onPartCompleted}
              onLockedPartClick={onLockedPartClick}
              onInteractionMessage={onInteractionMessage}
              onDragStateChange={setIsDraggingPart}
              onTelemetry={setTelemetry}
            />
          </Suspense>
        </ModelErrorBoundary>

        <FullTableBirdEyeCamera
          sceneRootRef={sceneRootRef}
          controlsRef={controlsRef}
          overviewRequest={overviewRequest}
        />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!isDraggingPart}
          enablePan={false}
          enableZoom
          zoomSpeed={0.48}
          zoomToCursor
          enableDamping
          dampingFactor={0.12}
          minPolarAngle={0.08}
          maxPolarAngle={Math.PI * 0.46}
          minDistance={10}
          maxDistance={190}
          mouseButtons={{
            LEFT: null,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
        />
      </Canvas>

      <div className="absolute left-4 top-4 z-[80] flex max-w-[calc(100%-180px)] flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOverviewRequest((value) => value + 1)}
          disabled={isDraggingPart}
          className="rounded-xl border border-[#FFD41C]/30 bg-[#0b1220]/92 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7dffdc] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-[#FFD41C]/12 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Reset Camera View
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          disabled={isDraggingPart}
          aria-pressed={isFullscreen}
          className="rounded-xl border border-[#FFD41C]/30 bg-[#0b1220]/92 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7dffdc] shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-[#FFD41C]/12 disabled:cursor-not-allowed disabled:opacity-45"
          title={isFullscreen ? "Exit fullscreen view" : "Open the 3D workspace in fullscreen"}
        >
          {isFullscreen ? "Exit Full Screen" : "Full Screen"}
        </button>
      </div>

      {showGuides && telemetry ? (
        <div className="pointer-events-none absolute bottom-4 left-4 z-[80] w-[min(320px,calc(100%-32px))] rounded-2xl border border-[#FFD41C]/25 bg-[#0b1220]/94 px-4 py-3 text-[11px] leading-5 text-[#dbe6f5] shadow-[0_12px_35px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <div className="mb-1 flex items-center justify-between gap-4">
            <span className="font-bold text-[#FFD41C]">{telemetry.label}</span>
            <span className="rounded-full border border-[#FFD41C]/25 bg-[#FFD41C]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#7dffdc]">
              {telemetry.magnetState}
            </span>
          </div>
          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#FFD41C] transition-[width] duration-150"
              style={{ width: `${Math.round(telemetry.progress * 100)}%` }}
            />
          </div>
          <div className="flex justify-between gap-4 text-[#9fb0ca]">
            <span>Target distance: {telemetry.distance.toFixed(2)}</span>
            <span>{telemetry.yLocked ? "Y locked" : "Ready"}</span>
          </div>
          <div className="mt-1 text-[10px] text-[#7a8ba8]">
            The host field is invisible. Entering the motherboard or case field starts an animated position-and-rotation seat.
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header, background, and ordered sidebar                             */
/* ------------------------------------------------------------------ */

function HeaderDropdown({
  userName,
  userEmail = "",
  avatarUrl = "",
  onBack,
  onLogout,
  setIsSettingsOpen,
}) {
  const handleBack = () => {
    if (typeof onBack === "function") onBack("Modules");
  };

  return (
    <div className="relative flex flex-wrap items-center justify-end gap-3">
      <button
        type="button"
        onClick={handleBack}
        className="relative z-[70] rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-2.5 text-[13px] font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06]"
      >
        Go back to Dashboard
      </button>

      <details className="group relative z-50">
        <summary className="list-none cursor-pointer rounded-2xl border border-[#1a2438] bg-[#0d1220]/95 px-3 py-2.5 transition hover:bg-[#111b2f]">
          <div className="flex max-w-[230px] items-center justify-end gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#FFD41C]/25 bg-[#FFD41C]/10 text-sm font-bold text-[#FFD41C]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                (userName || "U").charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 leading-tight text-left">
              <div className="truncate text-sm font-semibold text-white">{userName}</div>
              <div className="text-[11px] text-[#7a8ba8]">Profile</div>
            </div>
            <div className="text-sm text-[#7a8ba8] transition group-open:rotate-180">
              ▾
            </div>
          </div>
        </summary>

        <div className="absolute right-0 top-full z-[220] mt-2 w-52 rounded-2xl border border-[#1a2438] bg-[#0d1220]/98 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="mb-1 border-b border-[#1a2438] px-4 py-2 text-[11px] leading-5 text-[#7a8ba8]">
            <div className="truncate font-semibold text-white">{userName}</div>
            <div className="truncate">{userEmail || "No email"}</div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full rounded-xl px-4 py-2 text-left text-sm text-[#dbe6f5] transition hover:bg-white/5"
          >
            Settings
          </button>
          <button
            onClick={() => typeof onBack === "function" && onBack("Profile")}
            className="w-full rounded-xl px-4 py-2 text-left text-sm text-[#dbe6f5] transition hover:bg-white/5"
          >
            Profile
          </button>
          <button
            onClick={onLogout}
            className="w-full rounded-xl px-4 py-2 text-left text-sm text-red-400 transition hover:bg-red-500/10"
          >
            Logout
          </button>
        </div>
      </details>
    </div>
  );
}

function ModuleBackground() {
  return (
    <>
      <div className="pointer-events-none absolute -left-44 -top-44 h-[720px] w-[720px] rounded-full bg-[#FFD41C]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 -right-52 h-[820px] w-[820px] rounded-full bg-[#FFD41C]/6 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a0e17] via-[#0a0e17] to-[#0d1220]" />
    </>
  );
}


function Sidebar({
  open,
  onToggle,
  currentStep,
  completedSteps,
  onSelect,
  canSelectStep,
  currentStepCompleted,
  onViewCertificate,
  onResetScene,
}) {
  const activeButtonRef = useRef(null);

  useEffect(() => {
    activeButtonRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [currentStep]);

  return (
    <div
      className={[
        "absolute left-0 top-0 z-[200] h-full transition-all duration-300",
        open ? "w-[clamp(220px,22vw,280px)]" : "w-[64px]",
      ].join(" ")}
    >
      <div className="flex h-full min-h-0 flex-col border-r border-[#1a2438] bg-[#0b1220]/92 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#1a2438] px-4 py-4">
          {open ? (
            <div>
              <div className="text-sm font-bold text-white">Assembly Steps</div>
              <div className="text-[11px] text-[#7a8ba8]">AMD Platform</div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onToggle}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1a2438] bg-white/[0.03] text-[#dbe6f5] transition hover:bg-white/[0.06]"
          >
            {open ? "←" : "→"}
          </button>
        </div>

        <div
          className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 pr-2 [scrollbar-color:rgba(255,212,28,0.35)_rgba(255,255,255,0.05)] [scrollbar-width:thin]"
          style={{ scrollbarGutter: "stable" }}
        >
          {steps.map((item, index) => {
            const done = !!completedSteps[item.key];
            const active = currentStep === index;
            const unlocked = canSelectStep(index);

            return (
              <button
                key={item.key}
                ref={active ? activeButtonRef : null}
                type="button"
                onClick={() => onSelect(index)}
                aria-disabled={!unlocked}
                className={[
                  "flex w-full scroll-m-3 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                  active
                    ? "border-[#FFD41C]/25 bg-[#FFD41C]/10"
                    : "border-[#1a2438] bg-white/[0.03]",
                  unlocked
                    ? "hover:bg-white/[0.06]"
                    : "cursor-not-allowed opacity-45",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition",
                    done
                      ? "bg-[#FFD41C] text-[#0a0e17]"
                      : active
                      ? "border border-[#FFD41C]/35 bg-[#FFD41C]/10 text-[#FFD41C]"
                      : "border border-[#1a2438] bg-[#0d1220] text-[#7a8ba8]",
                  ].join(" ")}
                >
                  {done ? "✓" : index + 1}
                </span>
                {open ? (
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-[#7a8ba8]">
                      {done
                        ? "Finished"
                        : active
                        ? "Current step"
                        : unlocked
                        ? "Available"
                        : "Locked"}
                    </div>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        {currentStep === steps.length - 1 && currentStepCompleted ? (
          <div className="shrink-0 border-t border-[#1a2438] p-3">
            <button
              type="button"
              onClick={onViewCertificate}
              className={[
                "flex items-center justify-center rounded-2xl bg-[#FFD41C] font-black text-[#0a0e17]",
                "shadow-[0_18px_50px_rgba(255,212,28,0.22)] transition hover:scale-[1.03]",
                open ? "w-full px-5 py-3 text-sm" : "h-10 w-10 text-sm",
              ].join(" ")}
              title="View Certificate"
            >
              {open ? "View Certificate ✓" : "✓"}
            </button>
          </div>
        ) : null}

        <div className="shrink-0 border-t border-[#1a2438] p-3">
          <button
            type="button"
            onClick={onResetScene}
            className={[
              "flex items-center justify-center rounded-2xl border border-[#1a2438] bg-white/[0.03] font-semibold text-[#dbe6f5]",
              "transition hover:bg-white/[0.07]",
              open ? "w-full px-5 py-3 text-sm" : "h-10 w-10 text-sm",
            ].join(" ")}
            title="Reset Scene"
          >
            {open ? "Reset Scene" : "↺"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModuleIntroCard({ platform, moduleType, onStart }) {
  return (
    <div className="absolute inset-0 z-[750] flex items-center justify-center bg-[#050912]/78 p-5 backdrop-blur-md">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[30px] border border-[#FFD41C]/30 bg-[#0b1220]/96 p-7 shadow-[0_40px_120px_rgba(0,0,0,0.7)] md:p-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,212,28,0.13),transparent_42%)]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD41C]/25 bg-[#FFD41C]/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#FFD41C]">
            Module 3 • {platform} Platform
          </div>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-white md:text-4xl">
            {moduleType} Guided Practice
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#9fb0ca]">
            Each task now begins with an instruction card covering the correct procedure, safety checks, expected result, and common mistakes. Follow CPU → first RAM → second RAM → SSD → populated motherboard → PSU → HDD → GPU. The case stays flat and open-side-up during installation, and magnetic capture uses a collision-safe lift-over-lower path before the completed chassis rotates upright.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD41C]">1. Identify</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">
                Read the step card first, then identify the highlighted component and its destination host: motherboard or flat case.
              </div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD41C]">2. Move</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">
                Perform the listed preparation and handling checks, then click-hold to lift and carry the component toward the host field.
              </div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD41C]">3. Complete</div>
              <div className="mt-2 text-xs leading-5 text-[#9fb0ca]">
                Verify the final seated position against the card’s checklist before continuing to the next instruction guide.
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-[#7a8ba8]">
              Left-drag moves • right-drag rotates • wheel zooms • Esc safely releases • R resets camera
            </div>
            <button
              type="button"
              onClick={onStart}
              className="rounded-2xl bg-[#FFD41C] px-7 py-3 text-sm font-black text-[#07111d] shadow-[0_16px_45px_rgba(255,212,28,0.25)] transition hover:scale-[1.03]"
            >
              Start Guided Practice →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function StepInstructionCard({
  platform,
  moduleType,
  stepNumber,
  totalSteps,
  stepName,
  guide,
  isFinalChallenge = false,
  onBegin,
}) {
  const action = moduleType === "Assembly" ? "installation" : "removal";
  const safeGuide = guide || {
    title: stepName,
    summary: `Review the required ${action} procedure before interacting with the simulation.`,
    procedure: ["Identify the active component and its connection points.", "Use the highlighted workspace and complete the step without forcing the part."],
    safety: "Handle the component by its edges and keep the work area controlled.",
    verify: "The component should move freely and finish in the highlighted seated position.",
    avoid: "Do not force, twist, or drag a component through surrounding hardware.",
    simulation: "Drag the active component toward its destination. The magnetic field will take over and animate the final movement.",
  };

  return (
    <div
      className="articton-instruction-overlay absolute inset-0 z-[780] flex items-center justify-center bg-[#050912]/82 p-4 backdrop-blur-md md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-instruction-title"
    >
      <div className="articton-instruction-card relative w-full max-w-4xl overflow-hidden rounded-[30px] border border-[#FFD41C]/35 bg-[#0b1220]/97 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.76),0_0_70px_rgba(255,212,28,0.10)] md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,212,28,0.16),transparent_42%)]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full border border-[#FFD41C]/15 bg-[#FFD41C]/5 blur-2xl" />

        <div className="articton-instruction-content relative">
          <div className="articton-instruction-topbar flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD41C]/30 bg-[#FFD41C]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#73ffd4]">
              {isFinalChallenge
                ? "Final Challenge • Before You Begin"
                : `Step ${stepNumber} of ${totalSteps} • Before You Begin`}
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9fb0ca]">
              {platform} Platform
            </div>
          </div>

          <div className="articton-instruction-hero mt-6 flex items-start gap-5">
            <div className="articton-instruction-step-icon flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#FFD41C]/40 bg-[#FFD41C]/12 text-2xl font-black text-[#FFD41C] shadow-[0_0_34px_rgba(255,212,28,0.18)]">
              {isFinalChallenge ? "★" : stepNumber}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#FFD41C]">
                Instruction Guide
              </div>
              <h2
                id="step-instruction-title"
                className="articton-instruction-title mt-2 text-2xl font-black leading-tight text-white md:text-4xl"
              >
                {safeGuide.title || stepName}
              </h2>
              <p className="articton-instruction-summary mt-3 max-w-3xl text-sm leading-7 text-[#aebdd3]">
                {safeGuide.summary}
              </p>
            </div>
          </div>

          <div className="articton-instruction-details mt-7 grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
            <section className="articton-instruction-procedure rounded-2xl border border-[#1a2438] bg-white/[0.035] p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFD41C]">
                Correct Procedure
              </div>
              <ol className="mt-4 space-y-3">
                {safeGuide.procedure.map((item, index) => (
                  <li key={`${stepName}-instruction-${index}`} className="flex gap-3 text-sm leading-6 text-[#d7e1ee]">
                    <span className="articton-instruction-number flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#FFD41C]/30 bg-[#FFD41C]/10 text-[10px] font-black text-[#FFD41C]">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </section>

            <div className="articton-instruction-side grid gap-3">
              <div className="articton-instruction-side-card rounded-2xl border border-[#ffd166]/25 bg-[#ffd166]/[0.06] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffd166]">Safety / Handling</div>
                <p className="mt-2 text-xs leading-6 text-[#d8dfeb]">{safeGuide.safety}</p>
              </div>
              <div className="articton-instruction-side-card rounded-2xl border border-[#FFD41C]/22 bg-[#FFD41C]/[0.06] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFD41C]">Correct Result</div>
                <p className="mt-2 text-xs leading-6 text-[#d8dfeb]">{safeGuide.verify}</p>
              </div>
              <div className="articton-instruction-side-card rounded-2xl border border-[#ff7b72]/22 bg-[#ff7b72]/[0.055] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff9a92]">Common Mistake to Avoid</div>
                <p className="mt-2 text-xs leading-6 text-[#d8dfeb]">{safeGuide.avoid}</p>
              </div>
            </div>
          </div>

          <div className="articton-instruction-simulation mt-5 rounded-2xl border border-[#FFD41C]/18 bg-[#FFD41C]/6 px-4 py-3 text-xs leading-6 text-[#c3d1e4]">
            <span className="font-black uppercase tracking-[0.14em] text-[#FFD41C]">In the simulation: </span>
            {safeGuide.simulation}
          </div>

          <div className="articton-instruction-footer mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="articton-instruction-footer-note text-xs text-[#7f91ad]">
              Read first • begin only when the component, release point, and safety check are clear
            </div>
            <button
              type="button"
              onClick={onBegin}
              className="articton-instruction-button rounded-2xl bg-[#FFD41C] px-7 py-3 text-sm font-black text-[#07111d] shadow-[0_16px_45px_rgba(255,212,28,0.20)] transition hover:scale-[1.02]"
            >
              {isFinalChallenge ? "Begin Final Challenge" : `Begin ${stepName}`} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FullAssemblyCompletionCard({ platform, onReview, onCertificate }) {
  return (
    <div
      className="absolute inset-0 z-[790] flex items-center justify-center bg-[#050912]/82 p-5 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="full-assembly-completion-title"
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[30px] border border-[#FFD41C]/35 bg-[#0b1220]/97 p-7 shadow-[0_40px_120px_rgba(0,0,0,0.76),0_0_70px_rgba(255,212,28,0.10)] md:p-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,212,28,0.16),transparent_42%)]" />
        <div className="articton-instruction-content relative">
          <div className="articton-instruction-topbar flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD41C]/30 bg-[#FFD41C]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#73ffd4]">
              Full Assembly Complete
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9fb0ca]">
              {platform} Platform
            </div>
          </div>

          <div className="articton-instruction-hero mt-6 flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#FFD41C]/40 bg-[#FFD41C]/12 text-3xl font-black text-[#FFD41C] shadow-[0_0_34px_rgba(255,212,28,0.18)]">✓</div>
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#FFD41C]">Validated Unguided Run</div>
              <h2 id="full-assembly-completion-title" className="articton-instruction-title mt-2 text-2xl font-black leading-tight text-white md:text-4xl">
                Your PC Is Fully Assembled
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#9fb0ca]">
                You completed CPU → both RAM modules → SSD → motherboard → PSU → HDD → GPU without target highlights. Every component used the collision-free lift-over-lower seating path, the required dependencies were enforced, and the completed case animated upright.
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.035] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFD41C]">Order</div>
              <div className="mt-2 text-sm font-bold text-white">Validated</div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.035] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFD41C]">Placement</div>
              <div className="mt-2 text-sm font-bold text-white">All parts seated</div>
            </div>
            <div className="rounded-2xl border border-[#1a2438] bg-white/[0.035] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFD41C]">Result</div>
              <div className="mt-2 text-sm font-bold text-white">Certificate unlocked</div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={onReview} className="rounded-2xl border border-[#1a2438] bg-white/[0.04] px-5 py-3 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.08]">
              Review Finished PC
            </button>
            <button type="button" onClick={onCertificate} className="rounded-2xl bg-[#FFD41C] px-6 py-3 text-sm font-black text-[#07111d] shadow-[0_16px_45px_rgba(255,212,28,0.18)] transition hover:scale-[1.02]">
              View Certificate →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompletionCertificate({
  platform,
  moduleNumber,
  moduleType,
  description,
  userName,
  onBack,
  onSwitchPlatform,
}) {
  const alternatePlatform = platform === "AMD" ? "INTEL" : "AMD";

  return (
    <div className="min-h-screen w-full overflow-hidden bg-[#0a0e17] font-sans text-[#e8ecf4] antialiased print:bg-white">
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-5 py-8">
        <ModuleBackground />
        <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-[34px] border border-[#FFD41C]/35 bg-[#0d1220]/94 p-7 text-center shadow-[0_40px_120px_rgba(0,0,0,0.65)] backdrop-blur-xl md:p-12 print:border-black print:bg-white print:text-black print:shadow-none">
          <div className="pointer-events-none absolute inset-4 rounded-[26px] border border-dashed border-[#FFD41C]/30 print:border-black/40" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,212,28,0.14),transparent_42%)] print:hidden" />

          <div className="relative">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#FFD41C]/40 bg-[#FFD41C]/10 text-4xl font-black text-[#FFD41C] shadow-[0_0_40px_rgba(255,212,28,0.18)] print:border-black print:bg-transparent print:text-black">
              ✓
            </div>
            <div className="mt-5 text-[11px] font-black uppercase tracking-[0.34em] text-[#FFD41C] print:text-black">
              Certificate of Completion
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-6xl print:text-black">
              Congratulations
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#9fb0ca] print:text-black/70">
              This certifies that <span className="font-bold text-white print:text-black">{userName || "the learner"}</span> successfully completed
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#dffef5] md:text-3xl print:text-black">
              Module {moduleNumber} — {platform} {moduleType}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#9fb0ca] print:text-black/70">
              {description}
            </p>

            <div className="mx-auto mt-7 grid max-w-2xl gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4 print:border-black/30 print:bg-transparent">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#7a8ba8] print:text-black/60">Platform</div>
                <div className="mt-1 text-lg font-black text-white print:text-black">{platform}</div>
              </div>
              <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4 print:border-black/30 print:bg-transparent">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#7a8ba8] print:text-black/60">Progress</div>
                <div className="mt-1 text-lg font-black text-white print:text-black">100%</div>
              </div>
              <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4 print:border-black/30 print:bg-transparent">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#7a8ba8] print:text-black/60">Completed</div>
                <div className="mt-1 text-sm font-black text-white print:text-black">{getCompletionDate()}</div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3 print:hidden">
              <button
                type="button"
                onClick={onBack}
                className="rounded-2xl bg-[#FFD41C] px-6 py-3 text-sm font-black text-[#07111d] transition hover:scale-[1.03]"
              >
                Back to Modules →
              </button>
              <button
                type="button"
                onClick={onSwitchPlatform}
                className="rounded-2xl border border-[#FFD41C]/35 bg-[#FFD41C]/10 px-6 py-3 text-sm font-black text-[#7dffdc] transition hover:bg-[#FFD41C]/18"
              >
                Try {alternatePlatform} Version
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-2xl border border-[#1a2438] bg-white/[0.04] px-6 py-3 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.08]"
              >
                Print Certificate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Module 3 component                                             */
/* ------------------------------------------------------------------ */

export default function Module3AssemblyAMD({
  onFinish,
  onBack,
  onLogout,
  onSwitchPlatform,
}) {
  const [step, setStep] = useState(0);
  const [completedParts, setCompletedParts] = useState([]);
  const [finalRoundCompletedParts, setFinalRoundCompletedParts] = useState([]);
  const [sceneRevision, setSceneRevision] = useState(0);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [showFinalCompletionCard, setShowFinalCompletionCard] = useState(false);
  const [instructionStepIndex, setInstructionStepIndex] = useState(null);
  const [validationMessage, setValidationMessage] = useState(
    "Begin with the CPU. Lift it from the table and move it toward the motherboard socket; the safe-path magnetic field will align and lower it vertically."
  );
  const [achievementToast, setAchievementToast] = useState(null);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I am your Module 3 PC Assembly assistant (AMD).",
    },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [settings, setSettings] = useState(getUserSettings);
  const guidedCompletionTimerRef = useRef(null);
  const finalCompletionTimerRef = useRef(null);

  const clearCompletionTimers = useCallback(() => {
    if (guidedCompletionTimerRef.current) {
      window.clearTimeout(guidedCompletionTimerRef.current);
      guidedCompletionTimerRef.current = null;
    }
    if (finalCompletionTimerRef.current) {
      window.clearTimeout(finalCompletionTimerRef.current);
      finalCompletionTimerRef.current = null;
    }
  }, []);

  const currentStep = steps[step];
  const isFinalRound = currentStep?.key === "final";
  const activeFinalStage = isFinalRound
    ? getActiveProcedureStage(finalRoundCompletedParts)
    : null;
  const activePartKeys = isFinalRound
    ? getRemainingParts(activeFinalStage, finalRoundCompletedParts)
    : getRemainingParts(currentStep, completedParts);
  const activePartKey = activePartKeys[0] || null;
  const activePartLabel = activePartKeys.length
    ? formatAllowedPartLabel(activePartKeys)
    : null;
  const finalRoundComplete =
    finalRoundCompletedParts.length === ASSEMBLY_SEQUENCE.length;
  const modelViewerCompletedParts = isFinalRound
    ? finalRoundCompletedParts
    : completedParts;

  const effectiveCompletedSteps = useMemo(
    () =>
      Object.fromEntries(
        steps.map((item) => [
          item.key,
          item.key === "final"
            ? finalRoundComplete
            : isProcedureStepComplete(item, completedParts),
        ])
      ),
    [completedParts, finalRoundComplete]
  );

  const currentStepCompleted = isFinalRound
    ? finalRoundComplete
    : isProcedureStepComplete(currentStep, completedParts);
  const canSelectStep = useCallback((index) => index <= step, [step]);

  const handleSettingChange = (key, value) => {
    setSettings((previous) => ({ ...previous, [key]: value }));
  };

  const resetScene = useCallback(() => {
    clearCompletionTimers();
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    setCompletedParts([]);
    setFinalRoundCompletedParts([]);
    setStep(0);
    setSceneRevision((value) => value + 1);
    setShowCertificate(false);
    setShowIntro(true);
    setShowFinalCompletionCard(false);
    setInstructionStepIndex(null);
    setValidationMessage(
      "Scene restarted. Follow CPU → either RAM module → the remaining RAM module → SSD → motherboard → PSU → HDD → GPU."
    );
  }, [clearCompletionTimers]);

  useEffect(() => {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  }, []);

  useEffect(() => clearCompletionTimers, [clearCompletionTimers]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setFirebaseUser(null);
        setProfile(null);
        return;
      }

      setFirebaseUser(currentUser);
      try {
        const userReference = doc(db, "users", currentUser.uid);
        const snapshot = await getDoc(userReference);
        if (snapshot.exists()) setProfile(snapshot.data());
      } catch (error) {
        console.error("Error fetching Module 3 (AMD) profile:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  const user = {
    name: profile
      ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "User"
      : "Loading...",
    email: firebaseUser?.email || "No email",
    avatarUrl: profile?.avatarUrl || "",
  };

  const saveFinalCompletion = useCallback(async () => {
    if (!firebaseUser) return;

    try {
      const completedSteps = Object.fromEntries(
        steps.map((item) => [item.key, true])
      );
      const userReference = doc(db, "users", firebaseUser.uid);

      await setDoc(
        userReference,
        {
          moduleProgress: {
            module3AMD: {
              currentStep: steps.length - 1,
              completed: true,
              percent: 100,
              completedSteps,
              updatedAt: serverTimestamp(),
            },
          },
        },
        { merge: true }
      );
      const achievement = await unlockAchievement(firebaseUser.uid, "module3", {
        platform: "AMD",
      });
      setAchievementToast(achievement);
      window.setTimeout(() => setAchievementToast(null), 4200);
    } catch (error) {
      console.error("Error saving final Module 3 (AMD) completion:", error);
    }
  }, [firebaseUser]);

  const handlePartCompleted = useCallback(
    (partKey) => {
      const isFinalRoundNow = steps[step]?.key === "final";
      const allowedPartKeys = isFinalRoundNow
        ? getRemainingParts(
            getActiveProcedureStage(finalRoundCompletedParts),
            finalRoundCompletedParts
          )
        : getRemainingParts(steps[step], completedParts);

      if (
        instructionStepIndex !== null ||
        !allowedPartKeys.includes(partKey) ||
        (isFinalRoundNow
          ? finalRoundCompletedParts.includes(partKey)
          : completedParts.includes(partKey))
      ) {
        return;
      }

      if (isFinalRoundNow) {
        const next = [...finalRoundCompletedParts, partKey];
        const practiceDone = ASSEMBLY_SEQUENCE.every((key) =>
          next.includes(key)
        );
        setFinalRoundCompletedParts(next);
        playCompletionSound(settings.sound, practiceDone);

        if (practiceDone) {
          setValidationMessage(
            "Full assembly complete. The chassis is now rotating smoothly from its grounded flat position to the upright finished position."
          );
          if (finalCompletionTimerRef.current) {
            window.clearTimeout(finalCompletionTimerRef.current);
          }
          finalCompletionTimerRef.current = window.setTimeout(() => {
            setShowFinalCompletionCard(true);
            finalCompletionTimerRef.current = null;
          }, CASE_STAND_CARD_DELAY_MS);
          void saveFinalCompletion();
        } else {
          const nextStage = getActiveProcedureStage(next);
          const nextAllowed = getRemainingParts(nextStage, next);
          const sameRamStage = nextStage?.partKeys.includes(partKey);
          setValidationMessage(
            sameRamStage
              ? `${COMPONENT_LABELS[partKey]} installed. Install the remaining RAM module next.`
              : `${COMPONENT_LABELS[partKey]} installed. Continue with ${formatAllowedPartLabel(nextAllowed)}.`
          );
        }
        return;
      }

      const nextCompletedParts = [...completedParts, partKey];
      const stageComplete = isProcedureStepComplete(
        steps[step],
        nextCompletedParts
      );
      setCompletedParts(nextCompletedParts);
      playCompletionSound(settings.sound, false);

      if (!stageComplete) {
        const remaining = getRemainingParts(steps[step], nextCompletedParts);
        setValidationMessage(
          `${COMPONENT_LABELS[partKey]} installed correctly. ${formatAllowedPartLabel(remaining)} remains available.`
        );
        return;
      }

      const guidedFinished = ASSEMBLY_SEQUENCE.every((key) =>
        nextCompletedParts.includes(key)
      );
      const completedLabel = COMPONENT_LABELS[partKey];

      if (guidedFinished) {
        setValidationMessage(
          `${completedLabel} installed. The completed guided chassis is rotating upright; the final challenge guide will open after the transition.`
        );
        if (guidedCompletionTimerRef.current) {
          window.clearTimeout(guidedCompletionTimerRef.current);
        }
        guidedCompletionTimerRef.current = window.setTimeout(() => {
          const finalStepIndex = steps.length - 1;
          setStep(finalStepIndex);
          setFinalRoundCompletedParts([]);
          setSceneRevision((value) => value + 1);
          setInstructionStepIndex(finalStepIndex);
          setValidationMessage(
            "Guided assembly complete. Review the final unguided challenge instructions before beginning."
          );
          guidedCompletionTimerRef.current = null;
        }, CASE_STAND_CARD_DELAY_MS);
        return;
      }

      const nextStepIndex = step + 1;
      setStep(nextStepIndex);
      setInstructionStepIndex(nextStepIndex);
      setValidationMessage(
        `${completedLabel} installed correctly. Read the next instruction card before starting ${steps[nextStepIndex].name}.`
      );
    },
    [
      completedParts,
      finalRoundCompletedParts,
      instructionStepIndex,
      saveFinalCompletion,
      settings.sound,
      step,
    ]
  );

  const handleBeginInstructionStep = useCallback(() => {
    if (instructionStepIndex === null) return;

    const instructionStep = steps[instructionStepIndex];
    setInstructionStepIndex(null);

    if (instructionStep?.key === "final") {
      setValidationMessage(
        "Final round active: install CPU → either RAM → remaining RAM → SSD → populated motherboard → PSU → HDD → GPU. Target highlights are disabled."
      );
      return;
    }

    const allowed = getRemainingParts(instructionStep, completedParts);
    setValidationMessage(
      `${instructionStep.name} started. Install ${formatAllowedPartLabel(allowed)} using the procedure and safety checks you just reviewed.`
    );
  }, [completedParts, instructionStepIndex]);

  const handleStartGuidedPractice = useCallback(() => {
    setShowIntro(false);
    setStep(0);
    setInstructionStepIndex(0);
    setValidationMessage(
      "Read the CPU installation card before interacting with the first component."
    );
  }, []);

  const handleLockedPartClick = useCallback(
    (partKey) => {
      const clickedLabel = COMPONENT_LABELS[partKey] || "This component";
      setValidationMessage(
        `${clickedLabel} is locked. Install ${activePartLabel || "the current component"} first.`
      );
    },
    [activePartLabel]
  );

  const handleSelectStep = useCallback(
    (index) => {
      if (index === step) return;
      if (index > step) {
        setValidationMessage(
          `That step is locked. Install ${activePartLabel || "the current stage"} first.`
        );
      } else {
        setValidationMessage(
          "Completed components remain installed. Continue from the current validated assembly stage."
        );
      }
    },
    [activePartLabel, step]
  );

  const askAI = async () => {
    if (!aiInput.trim()) return;

    const userMessage = { role: "user", content: aiInput };
    setAiMessages((previous) => [...previous, userMessage]);
    setAiLoading(true);

    try {
      const askModuleTutor = httpsCallable(functions, "askModuleTutor");
      const response = await askModuleTutor({
        message: aiInput,
        context: {
          mode: "assembly",
          moduleNumber: 3,
          platform: "amd",
          currentStep: currentStep?.name,
          activeComponent: activePartLabel,
          completedParts: modelViewerCompletedParts,
        },
      });

      setAiMessages((previous) => [
        ...previous,
        { role: "assistant", content: formatTutorReply(response.data) },
      ]);
    } catch (error) {
      console.error(error);
      setAiMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            error.message ||
            "The AI tutor could not answer right now, but the procedure guide still shows this step's notes.",
        },
      ]);
    }

    setAiInput("");
    setAiLoading(false);
  };

  const handleBackToDashboard = () => {
    let handled = false;
    if (typeof onFinish === "function") {
      onFinish("Dashboard");
      handled = true;
    }
    if (typeof onBack === "function") {
      onBack("Modules");
      handled = true;
    }
    if (!handled) window.location.href = "/dashboard";
  };

  if (showCertificate) {
    return (
      <CompletionCertificate
        platform="AMD"
        moduleNumber="3"
        moduleType="Assembly"
        description="You completed the validated assembly order: CPU, both RAM modules in either order, SSD, motherboard, PSU, HDD, and GPU — including a full unguided repeat pass with collision-free animated magnetic seating and an upright case transition."
        userName={user.name}
        onBack={handleBackToDashboard}
        onSwitchPlatform={() => {
          if (typeof onSwitchPlatform === "function") onSwitchPlatform();
          else if (typeof onBack === "function") onBack("Modules");
        }}
      />
    );
  }

  return (
      <div className="articton-app-shell articton-module-page fixed inset-0 h-screen w-screen overflow-hidden bg-[#0a0e17] font-sans text-[#e8ecf4] antialiased">
      <div className="relative h-full w-full overflow-hidden">
        <ModuleBackground />
        <AchievementToast achievement={achievementToast} onClose={() => setAchievementToast(null)} />

        {showIntro ? (
          <ModuleIntroCard
            platform="AMD"
            moduleType="Assembly"
            onStart={handleStartGuidedPractice}
          />
        ) : null}

        {instructionStepIndex !== null ? (
          <StepInstructionCard
            platform="AMD"
            moduleType="Assembly"
            stepNumber={Math.min(instructionStepIndex + 1, GUIDED_STEPS.length)}
            totalSteps={GUIDED_STEPS.length}
            stepName={steps[instructionStepIndex]?.name || "Assembly Step"}
            guide={STEP_INSTRUCTION_GUIDES[steps[instructionStepIndex]?.key]}
            isFinalChallenge={steps[instructionStepIndex]?.key === "final"}
            onBegin={handleBeginInstructionStep}
          />
        ) : null}

        {showFinalCompletionCard ? (
          <FullAssemblyCompletionCard
            platform="AMD"
            onReview={() => setShowFinalCompletionCard(false)}
            onCertificate={() => setShowCertificate(true)}
          />
        ) : null}

        <div className="relative flex h-full w-full flex-col overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,212,28,0.08),transparent_35%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_20%,rgba(255,212,28,0.05),transparent_30%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,212,28,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,212,28,0.025)_1px,transparent_1px)] bg-[size:54px_54px] opacity-55" />

          <div className="relative flex h-full w-full flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 text-[12px] text-[#7a8ba8] md:px-10">
              <div>
                Module 3 — <span className="text-[#dbe6f5]">Assembly (AMD)</span>
              </div>
              <div className="rounded-lg border border-[#1a2438] bg-white/[0.03] px-2 py-1 text-[11px]">
                Step {step + 1} of {steps.length}
              </div>
            </div>

            <div className="relative z-[120] mt-3 px-6 md:px-10">
              <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-[22px] border border-[#1a2438] bg-[#0b1220]/86 px-6 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.30)] backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <img
                    src="/PNG/Articton.png"
                    alt="Articton Logo"
                    className="ml-4 h-10 w-10 scale-300 object-contain"
                  />
                  <div>
                    <div className="text-base font-bold tracking-wide text-white">
                      Articton
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-[#FFD41C]">
                      AMD Assembly View
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  {validationMessage ? (
                    <div className="max-w-[540px] rounded-2xl border border-[#FFD41C]/20 bg-[#FFD41C]/8 px-4 py-2 text-xs font-semibold text-[#dffef5]">
                      {validationMessage}
                    </div>
                  ) : null}

                  <HeaderDropdown
                    userName={user.name}
                    userEmail={user.email}
                    avatarUrl={user.avatarUrl}
                    onBack={onBack}
                    onLogout={onLogout}
                    setIsSettingsOpen={setIsSettingsOpen}
                  />
                </div>
              </div>

              <Settings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={settings}
                onChange={handleSettingChange}
              />
            </div>

            <div className="px-6 pt-4 md:px-10">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#1a2438] bg-[#0b1220]/72 px-5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {isFinalRound ? "Full Assembly Run" : currentStep?.name}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[#7a8ba8]">
                    {isFinalRound
                      ? `Unguided pass • install ${activePartLabel || "complete"} • ${finalRoundCompletedParts.length}/${ASSEMBLY_SEQUENCE.length} done`
                      : activePartLabel
                      ? `Lift and move ${activePartLabel} toward the ${activePartKeys.every((key) => MOTHERBOARD_CHILD_KEYS.has(key)) ? "motherboard" : "grounded flat case"} • magnetic capture routes above the host, then lowers vertically`
                      : "Assembly complete • review the PC or open the certificate"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {steps.map((item, index) => (
                    <div
                      key={item.key}
                      className={`h-2.5 w-9 rounded-full transition ${
                        index === step
                          ? "bg-[#FFD41C]"
                          : index < step
                          ? "bg-[#FFD41C]/55"
                          : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 px-4 py-4 md:px-8 md:py-5">
              <div className="relative h-full overflow-hidden rounded-[24px] border border-[#1a2438] bg-[#0d1220]/78 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <Sidebar
                  open={sidebarOpen}
                  onToggle={() => setSidebarOpen((value) => !value)}
                  currentStep={step}
                  completedSteps={effectiveCompletedSteps}
                  onSelect={handleSelectStep}
                  canSelectStep={canSelectStep}
                  currentStepCompleted={currentStepCompleted}
                  onViewCertificate={() => setShowCertificate(true)}
                  onResetScene={resetScene}
                />

                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(255,255,255,0.08),transparent_40%)]" />
                <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.55)]" />

                <div
                  className="absolute bottom-3 right-3 top-3 z-[40] overflow-hidden rounded-[18px] border border-[#1a2438] bg-black/20 transition-all duration-300 md:bottom-4 md:right-4 md:top-4"
                  style={{ left: sidebarOpen ? "clamp(220px, 22vw, 280px)" : 64 }}
                >
                  <ModelViewer
                    key={sceneRevision}
                    activePartKeys={activePartKeys}
                    isFullRun={isFinalRound}
                    showGuides={!isFinalRound}
                    completedParts={modelViewerCompletedParts}
                    onPartCompleted={handlePartCompleted}
                    onLockedPartClick={handleLockedPartClick}
                    onInteractionMessage={setValidationMessage}
                  />

                  <ProcedureAssistantBubble
                    mode="assembly"
                    platform="AMD"
                    currentStep={currentStep?.name}
                    activeComponent={activePartLabel}
                    open={aiOpen}
                    messages={aiMessages}
                    input={aiInput}
                    loading={aiLoading}
                    onToggle={() => setAiOpen((value) => !value)}
                    onInputChange={setAiInput}
                    onSend={askAI}
                  />

                  <div className="hidden">
                    {!aiOpen ? (
                      <button
                        type="button"
                        onClick={() => setAiOpen(true)}
                        className="rounded-2xl border border-[#FFD41C]/25 bg-[#0b1220]/90 px-4 py-3 text-sm font-semibold text-[#FFD41C] shadow-[0_10px_40px_rgba(255,212,28,0.15)] backdrop-blur-xl transition hover:scale-[1.03]"
                      >
                        AI Assistant
                      </button>
                    ) : (
                      <div className="flex h-[500px] w-[360px] flex-col overflow-hidden rounded-[24px] border border-[#1a2438] bg-[#0b1220]/95 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                        <div className="flex items-center justify-between border-b border-[#1a2438] px-4 py-3">
                          <div>
                            <div className="text-sm font-bold text-white">
                              Assembly AI
                            </div>
                            <div className="text-[11px] text-[#7a8ba8]">
                              AMD step-aware assistant
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAiOpen(false)}
                            className="rounded-lg px-2 py-1 text-sm text-[#7a8ba8] transition hover:bg-white/5 hover:text-white"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="flex-1 space-y-3 overflow-y-auto p-4">
                          {aiMessages.map((message, index) => (
                            <div
                              key={index}
                              className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                                message.role === "assistant"
                                  ? "bg-[#FFD41C]/10 text-[#dffef5]"
                                  : "bg-white/5 text-white"
                              }`}
                            >
                              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7a8ba8]">
                                {message.role === "assistant" ? "AI" : "You"}
                              </div>
                              {message.content}
                            </div>
                          ))}
                        </div>

                        <div className="border-t border-[#1a2438] p-3">
                          <div className="flex gap-2">
                            <input
                              value={aiInput}
                              onChange={(event) => setAiInput(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                  event.preventDefault();
                                  void askAI();
                                }
                              }}
                              placeholder="Ask about this step..."
                              className="flex-1 rounded-xl border border-[#1a2438] bg-[#111827] px-4 py-3 text-sm text-white outline-none transition focus:border-[#FFD41C]/35"
                            />
                            <button
                              type="button"
                              onClick={askAI}
                              disabled={aiLoading}
                              className="rounded-xl bg-[#FFD41C] px-4 py-3 text-sm font-bold text-[#0a0e17] transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {aiLoading ? "..." : "Send"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 border-t border-[#1a2438] px-6 pb-6 pt-4">
              <div className="text-center text-xs text-[#7a8ba8]">
                Left-drag moves components • enter the invisible host field for animated seating • right-drag rotates • wheel zooms • Esc releases • R resets camera
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.45)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Preload the table, case, and every assembly component. */
PART_MODELS.forEach((part) => useGLTF.preload(encodeURI(part.path)));




