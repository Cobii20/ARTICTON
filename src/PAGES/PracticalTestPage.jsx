// src/PAGES/PracticalTestPage.jsx
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { motion, useReducedMotion } from "framer-motion";
import { auth, db } from "../firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

/* ───────────────────────────────────────────────────────────── */
/* TEST DATA */
/* ───────────────────────────────────────────────────────────── */

const TESTS = [
  {
    id: "module1-quiz",
    quizKey: "module1",
    requiredModuleKey: "module1",
    kind: "quiz",
    title: "Module 1 Quiz",
    desc: "PC Hardware Basics • Beginner",
    durationMin: 20,
    badge: "Quiz",
    passingPercent: 60,
    practiceUnlockPercent: 60,
    instructions: [
      "Finish Module 1 first before taking this quiz.",
      "Score 60% or higher to unlock the practice test.",
      "Answer all questions before submitting.",
      "The quiz auto-submits when time runs out.",
    ],
    questions: [
      {
        type: "model",
        q: "What part is this? (3D)",
        modelSrc: "/models/cpu.glb",
        options: ["CPU", "RAM", "Power Supply (PSU)", "Motherboard"],
        answerIndex: 0,
      },
      {
        q: "Which component is considered the brain of the computer?",
        options: ["CPU", "GPU", "SSD", "PSU"],
        answerIndex: 0,
      },
      {
        q: "Which component temporarily stores data while programs are running?",
        options: ["RAM", "HDD", "PSU", "Case"],
        answerIndex: 0,
      },
      {
        q: "Which part connects most computer components together?",
        options: ["Motherboard", "Monitor", "Keyboard", "Mouse"],
        answerIndex: 0,
      },
      {
        q: "Which component stores long-term data?",
        options: ["RAM", "SSD/HDD", "CPU", "GPU"],
        answerIndex: 1,
      },
      {
        q: "What part supplies power to the PC?",
        options: ["Motherboard", "Power Supply Unit", "RAM", "CPU Cooler"],
        answerIndex: 1,
      },
      {
        q: "What does GPU primarily handle?",
        options: ["Graphics and rendering", "Power supply", "File storage", "Network routing"],
        answerIndex: 0,
      },
      {
        q: "Which component holds all parts physically together?",
        options: ["PC Case", "RAM", "CPU", "SSD"],
        answerIndex: 0,
      },
    ],
  },
  {
    id: "module2-quiz",
    quizKey: "module2",
    requiredModuleKey: "module2",
    kind: "quiz",
    title: "Module 2 Quiz",
    desc: "PC Assembly • Guided Build",
    durationMin: 25,
    badge: "Quiz",
    passingPercent: 60,
    practiceUnlockPercent: 60,
    instructions: [
      "Finish Module 2 first before taking this quiz.",
      "Score 60% or higher to unlock the practice test.",
      "Answer all questions before submitting.",
      "The quiz auto-submits when time runs out.",
    ],
    questions: [
      {
        q: "What should usually be installed onto the motherboard before placing the motherboard into the case?",
        options: ["CPU, RAM, and SSD", "Monitor", "Keyboard", "Mouse"],
        answerIndex: 0,
      },
      {
        q: "Where do you install RAM modules?",
        options: ["PCIe slots", "DIMM slots", "SATA ports", "Front panel header"],
        answerIndex: 1,
      },
      {
        q: "What is the purpose of thermal paste?",
        options: [
          "Increase RAM speed",
          "Improve heat transfer between CPU and cooler",
          "Prevent dust build-up",
          "Power the motherboard",
        ],
        answerIndex: 1,
      },
      {
        q: "Which connector powers most modern CPUs?",
        options: ["24-pin ATX", "8-pin EPS CPU power", "SATA data", "USB header"],
        answerIndex: 1,
      },
      {
        q: "Why are motherboard standoffs used?",
        options: [
          "To prevent the motherboard from shorting against the case",
          "To increase RAM capacity",
          "To make the GPU faster",
          "To cool the SSD",
        ],
        answerIndex: 0,
      },
      {
        q: "Before powering on a newly built PC, you should:",
        options: [
          "Remove all fans",
          "Check cable connections and component seating",
          "Disconnect CPU power",
          "Touch the motherboard while powered",
        ],
        answerIndex: 1,
      },
      {
        q: "Which cable usually connects storage drives like SATA HDDs?",
        options: ["SATA cable", "HDMI cable", "VGA cable", "Audio jack"],
        answerIndex: 0,
      },
      {
        q: "Which part should be handled carefully to avoid bent pins or contact damage?",
        options: ["CPU", "Case panel", "Power button", "Fan grill"],
        answerIndex: 0,
      },
    ],
  },
  {
    id: "module3-quiz",
    quizKey: "module3",
    requiredModuleKey: "module3",
    kind: "quiz",
    title: "Module 3 Quiz",
    desc: "PC Disassembly • Safe Removal",
    durationMin: 25,
    badge: "Quiz",
    passingPercent: 60,
    practiceUnlockPercent: 60,
    instructions: [
      "Finish Module 3 first before taking this quiz.",
      "Score 60% or higher to unlock the practice test.",
      "Answer all questions before submitting.",
      "The quiz auto-submits when time runs out.",
    ],
    questions: [
      {
        q: "Before disassembling a PC, what should you do first?",
        options: [
          "Turn off and unplug the system",
          "Remove the CPU immediately",
          "Pour water on the case",
          "Shake the case",
        ],
        answerIndex: 0,
      },
      {
        q: "Why should you ground yourself before handling components?",
        options: [
          "To prevent static discharge damage",
          "To increase internet speed",
          "To clean the PC automatically",
          "To unlock BIOS",
        ],
        answerIndex: 0,
      },
      {
        q: "Which component should be removed carefully from DIMM slots?",
        options: ["RAM", "PSU", "Case fan", "Monitor"],
        answerIndex: 0,
      },
      {
        q: "When removing a motherboard, why should screws be removed carefully?",
        options: [
          "To avoid board damage and stripped screws",
          "To increase CPU speed",
          "To charge the PSU",
          "To reset the BIOS clock",
        ],
        answerIndex: 0,
      },
      {
        q: "What should you do with removed screws during disassembly?",
        options: [
          "Organize and keep them safely",
          "Throw them away",
          "Leave them inside the PSU",
          "Mix them with cables",
        ],
        answerIndex: 0,
      },
      {
        q: "Which component can still hold electrical charge after power is disconnected?",
        options: ["Power Supply Unit", "Mouse", "Keyboard", "Monitor stand"],
        answerIndex: 0,
      },
      {
        q: "What is the safest way to remove a connector?",
        options: [
          "Pull from the connector body",
          "Pull hard from the cable wires",
          "Cut the cable",
          "Twist the motherboard",
        ],
        answerIndex: 0,
      },
      {
        q: "Why should components be placed on a clean, non-conductive surface?",
        options: [
          "To prevent scratches and electrical damage",
          "To make them heavier",
          "To increase RGB lighting",
          "To reset drivers",
        ],
        answerIndex: 0,
      },
    ],
  },
  {
    id: "module4-quiz",
    quizKey: "module4",
    requiredModuleKey: "module4",
    kind: "quiz",
    title: "Module 4 Quiz",
    desc: "Troubleshooting and Safety • Assessment",
    durationMin: 25,
    badge: "Quiz",
    passingPercent: 60,
    practiceUnlockPercent: 60,
    instructions: [
      "Finish Module 4 first before taking this quiz.",
      "Score 60% or higher to unlock the practice test.",
      "Answer all questions before submitting.",
      "The quiz auto-submits when time runs out.",
    ],
    questions: [
      {
        q: "If a newly assembled PC does not power on, what should you check first?",
        options: [
          "Power cable, PSU switch, and front panel connector",
          "Monitor brightness only",
          "Mouse sensitivity",
          "Wallpaper settings",
        ],
        answerIndex: 0,
      },
      {
        q: "If the PC powers on but there is no display, what should you check?",
        options: [
          "Monitor cable, GPU seating, and RAM seating",
          "Keyboard color",
          "Speaker volume",
          "Mouse pad",
        ],
        answerIndex: 0,
      },
      {
        q: "A repeated beep code during startup usually indicates:",
        options: [
          "Hardware or POST error",
          "Successful shutdown",
          "Internet speed issue",
          "Case paint problem",
        ],
        answerIndex: 0,
      },
      {
        q: "Which action is safest when troubleshooting inside a PC?",
        options: [
          "Turn off and unplug before touching parts",
          "Keep it powered while removing parts",
          "Touch every chip directly",
          "Use wet hands",
        ],
        answerIndex: 0,
      },
      {
        q: "If RAM is not seated properly, the PC may:",
        options: [
          "Fail to boot or show no display",
          "Print documents faster",
          "Charge the monitor",
          "Increase storage space",
        ],
        answerIndex: 0,
      },
      {
        q: "What should you do before replacing a suspected faulty part?",
        options: [
          "Verify connections and test systematically",
          "Replace every part immediately",
          "Ignore warning signs",
          "Delete all files",
        ],
        answerIndex: 0,
      },
      {
        q: "Which tool is useful for checking PSU output or electrical issues?",
        options: ["Multimeter", "Paint brush", "Scissors", "Ruler only"],
        answerIndex: 0,
      },
      {
        q: "What is a good troubleshooting approach?",
        options: [
          "Change one thing at a time and test",
          "Change everything at once",
          "Guess randomly",
          "Skip checking cables",
        ],
        answerIndex: 0,
      },
    ],
  },
];

/* ───────────────────────────────────────────────────────────── */
/* 3D Question Viewer */
/* ───────────────────────────────────────────────────────────── */

function GLBModel({
  url,
  scale = 1,
  rotation = [0, 0, 0],
  position = [0, 0, 0],
}) {
  const { scene } = useGLTF(url);

  return (
    <primitive
      object={scene}
      scale={scale}
      rotation={rotation}
      position={position}
    />
  );
}

function ModelQuestionViewer({ modelSrc }) {
  return (
    <div className="mt-5 overflow-hidden rounded-[26px] border border-white/10 bg-white/5">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="text-sm font-semibold">3D Viewer</div>

        <div className="text-[11px] text-white/50">
          Drag to rotate • Scroll to zoom
        </div>
      </div>

      <div className="p-4">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          <div className="h-[360px] w-full">
            <Canvas
              camera={{ position: [0, 1.1, 3.2], fov: 45 }}
              dpr={[1, 1.8]}
            >
              <color attach="background" args={["#071f29"]} />
              <ambientLight intensity={0.75} />
              <directionalLight position={[6, 8, 6]} intensity={1.25} />
              <directionalLight position={[-6, -2, -6]} intensity={0.4} />

              <Suspense fallback={null}>
                <Bounds fit clip observe margin={1.15}>
                  <GLBModel
                    url={modelSrc}
                    scale={1}
                    rotation={[0, 0, 0]}
                    position={[0, 0, 0]}
                  />
                </Bounds>

                <Environment preset="city" />
              </Suspense>

              <OrbitControls
                makeDefault
                enablePan={false}
                enableZoom
                minDistance={1.2}
                maxDistance={8}
                autoRotate
                autoRotateSpeed={0.9}
                enableDamping
                dampingFactor={0.08}
              />
            </Canvas>
          </div>
        </div>

        <div className="mt-3 text-[12px] text-white/45">
          If the model does not load, confirm the file is inside{" "}
          <span className="text-white/70">public/models</span> and referenced
          like <span className="text-white/70">/models/cpu.glb</span>.
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── */
/* Practical Test / Quiz Page */
/* ───────────────────────────────────────────────────────────── */

export default function PracticalTestPage({
  testId = "module1-quiz",
  onBack,
}) {
  const reduce = useReducedMotion();

  const test = useMemo(() => {
    return TESTS.find((t) => t.id === testId) || TESTS[0];
  }, [testId]);

  const total = test.questions.length;

  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [profileProgress, setProfileProgress] = useState(null);

  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitSaving, setSubmitSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [secondsLeft, setSecondsLeft] = useState(test.durationMin * 60);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState({});

  const moduleCompleted =
    !!profileProgress?.moduleProgress?.[test.requiredModuleKey]?.completed;

  const isLocked = test.kind === "quiz" && !moduleCompleted;

  useEffect(() => {
    let active = true;

    const loadAccess = async () => {
      setAccessLoading(true);
      setAccessError("");

      try {
        const user = auth.currentUser;

        if (!user) {
          if (!active) return;

          setProfileProgress(null);
          setAccessLoading(false);
          return;
        }

        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (!active) return;

        setProfileProgress(snap.exists() ? snap.data() : null);
        setAccessLoading(false);
      } catch (err) {
        if (!active) return;

        setAccessError(err.message || "Unable to check test access.");
        setAccessLoading(false);
      }
    };

    loadAccess();

    return () => {
      active = false;
    };
  }, [test.id]);

  useEffect(() => {
    setStarted(false);
    setFinished(false);
    setConfirmSubmit(false);
    setSubmitSaving(false);
    setSaveError("");
    setSecondsLeft(test.durationMin * 60);
    setActiveIndex(0);
    setAnswers({});
  }, [test.id, test.durationMin]);

  useEffect(() => {
    if (!started || finished) return;

    if (secondsLeft <= 0) {
      handleSubmit(true);
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, finished, secondsLeft]);

  const answeredCount = Object.keys(answers).length;

  const calculateScore = (answerMap = answers) => {
    let result = 0;

    test.questions.forEach((question, index) => {
      if (answerMap[index] === question.answerIndex) {
        result += 1;
      }
    });

    return result;
  };

  const score = useMemo(() => {
    return calculateScore(answers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, test.questions]);

  const answerPercent = useMemo(() => {
    if (total === 0) return 0;

    return Math.round((answeredCount / total) * 100);
  }, [answeredCount, total]);

  const scorePercent = useMemo(() => {
    if (total === 0) return 0;

    return Math.round((score / total) * 100);
  }, [score, total]);

  const passed = finished && scorePercent >= test.passingPercent;
  const practiceUnlocked = finished && scorePercent >= test.practiceUnlockPercent;

  const fmt = (s) => {
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");

    return `${mm}:${ss}`;
  };

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const handleStart = () => {
    if (isLocked) return;

    setStarted(true);
    setConfirmSubmit(false);
    setSaveError("");
  };

  const saveQuizProgress = async ({
    finalScore,
    finalPercent,
    finalPassed,
    autoSubmitted,
  }) => {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("No logged-in user. Quiz progress was not saved.");
    }

    const userRef = doc(db, "users", user.uid);

    const alreadyUnlocked =
      !!profileProgress?.practiceTestAccess?.[test.quizKey]?.unlocked;

    const newlyUnlocked = finalPercent >= test.practiceUnlockPercent;
    const unlocked = alreadyUnlocked || newlyUnlocked;

    const quizPayload = {
      completed: true,
      finished: true,
      passed: finalPassed,
      score: finalScore,
      total,
      percent: finalPercent,
      passingPercent: test.passingPercent,
      practiceUnlockPercent: test.practiceUnlockPercent,
      autoSubmitted,
      updatedAt: serverTimestamp(),
    };

    const practiceAccessPayload = {
      unlocked,
      requiredPercent: test.practiceUnlockPercent,
      latestScore: finalScore,
      latestTotal: total,
      latestPercent: finalPercent,
      sourceQuizId: test.id,
      updatedAt: serverTimestamp(),
    };

    if (newlyUnlocked && !alreadyUnlocked) {
      practiceAccessPayload.unlockedAt = serverTimestamp();
    }

    await setDoc(
      userRef,
      {
        quizProgress: {
          [test.quizKey]: quizPayload,
        },
        practiceTestAccess: {
          [test.quizKey]: practiceAccessPayload,
        },
      },
      { merge: true }
    );

    const localUpdatedAt = new Date().toISOString();

    setProfileProgress((previous) => ({
      ...(previous || {}),
      quizProgress: {
        ...(previous?.quizProgress || {}),
        [test.quizKey]: {
          ...quizPayload,
          updatedAt: localUpdatedAt,
        },
      },
      practiceTestAccess: {
        ...(previous?.practiceTestAccess || {}),
        [test.quizKey]: {
          ...(previous?.practiceTestAccess?.[test.quizKey] || {}),
          ...practiceAccessPayload,
          updatedAt: localUpdatedAt,
          unlockedAt:
            newlyUnlocked && !alreadyUnlocked
              ? localUpdatedAt
              : previous?.practiceTestAccess?.[test.quizKey]?.unlockedAt,
        },
      },
    }));

    try {
      localStorage.setItem("articton-last-progress-update", String(Date.now()));

      window.dispatchEvent(
        new CustomEvent("articton-progress-updated", {
          detail: {
            type: "practice-unlock",
            module: test.quizKey,
            completed: true,
            unlocked,
            percent: finalPercent,
          },
        })
      );
    } catch {
      // Optional dashboard refresh signal only.
    }

    return {
      quizPayload,
      practiceAccessPayload,
    };
  };

  const handleSubmit = async (auto = false) => {
    if (finished || submitSaving) return;

    setConfirmSubmit(false);
    setSubmitSaving(true);
    setSaveError("");

    const finalScore = calculateScore(answers);
    const finalPercent =
      total === 0 ? 0 : Math.round((finalScore / total) * 100);
    const finalPassed = finalPercent >= test.passingPercent;

    try {
      await saveQuizProgress({
        finalScore,
        finalPercent,
        finalPassed,
        autoSubmitted: auto,
      });

      setFinished(true);
      setStarted(false);

      if (auto) {
        // eslint-disable-next-line no-alert
        alert("Time is up! Your quiz has been submitted automatically.");
      }
    } catch (err) {
      setSaveError(
        err.message ||
          "Quiz was not saved. Please check Firebase rules or your internet connection, then submit again."
      );
    } finally {
      setSubmitSaving(false);
    }
  };

  const restart = () => {
    if (isLocked) return;

    setStarted(false);
    setFinished(false);
    setConfirmSubmit(false);
    setSubmitSaving(false);
    setSaveError("");
    setSecondsLeft(test.durationMin * 60);
    setActiveIndex(0);
    setAnswers({});
  };

  const AUTO_NEXT_DELAY_MS = 220;

  const selectAnswer = (idx) => {
    if (!started || finished || isLocked || submitSaving) return;

    setAnswers((prev) => ({
      ...prev,
      [activeIndex]: idx,
    }));

    setTimeout(() => {
      setActiveIndex((currentIndex) => {
        if (currentIndex >= total - 1) {
          setConfirmSubmit(true);
          return currentIndex;
        }

        return clamp(currentIndex + 1, 0, total - 1);
      });
    }, AUTO_NEXT_DELAY_MS);
  };

  const motionPreset = useMemo(() => {
    if (reduce) {
      return {
        whileHover: {},
        whileTap: {},
        transition: { duration: 0.15 },
      };
    }

    return {
      whileHover: { y: -4, scale: 1.01 },
      whileTap: { scale: 0.99 },
      transition: { type: "spring", stiffness: 260, damping: 22 },
    };
  }, [reduce]);

  const current = test.questions[activeIndex];

  if (accessLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#061E29] text-[#F3F4F4]">
        <div className="rounded-[28px] border border-white/10 bg-white/5 px-8 py-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="text-lg font-bold">Checking access...</div>
          <div className="mt-2 text-sm text-white/50">
            Please wait while your module progress is loaded.
          </div>
        </div>
      </div>
    );
  }

  if (accessError || isLocked) {
    return (
      <div className="min-h-screen w-full bg-[#061E29] px-6 py-10 text-[#F3F4F4]">
        <div className="pointer-events-none fixed -top-44 -left-44 h-[720px] w-[720px] rounded-full bg-[#5F9598]/18 blur-3xl" />
        <div className="pointer-events-none fixed -bottom-56 -right-52 h-[820px] w-[820px] rounded-full bg-[#1D546D]/26 blur-3xl" />
        <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#061E29] via-[#061E29] to-[#0B2A3A]" />

        <div className="relative mx-auto flex min-h-[80vh] max-w-3xl items-center justify-center">
          <div className="w-full rounded-[34px] border border-white/10 bg-black/20 p-8 text-center shadow-[0_34px_110px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-red-400/25 bg-red-500/10 text-2xl">
              🔒
            </div>

            <div className="text-[12px] font-bold uppercase tracking-[0.28em] text-red-200/80">
              Locked Quiz
            </div>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
              {test.title}
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/60">
              {accessError
                ? accessError
                : `Finish ${test.requiredModuleKey.replace("module", "Module ")} first before taking this quiz.`}
            </p>

            <button
              type="button"
              onClick={onBack}
              className="mt-7 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#061E29] font-sans text-[#F3F4F4] antialiased">
      <div className="pointer-events-none fixed -top-44 -left-44 h-[720px] w-[720px] rounded-full bg-[#5F9598]/18 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-56 -right-52 h-[820px] w-[820px] rounded-full bg-[#1D546D]/26 blur-3xl" />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#061E29] via-[#061E29] to-[#0B2A3A]" />

      <div className="relative mx-auto max-w-7xl p-6 lg:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10"
          >
            ← Back
          </button>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#5F9598]/28 bg-[#5F9598]/18 px-3 py-1.5 text-[11px] text-white/80">
              {test.badge}
            </span>

            <div className="min-w-[160px] rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center">
              <div className="text-[12px] text-white/55">Time left</div>

              <div className="mt-1 text-2xl font-extrabold tracking-tight">
                {fmt(secondsLeft)}
              </div>

              <div className="mt-1 text-[11px] text-white/45">
                {finished ? "Submitted" : started ? "Running" : "Paused"}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-7 overflow-hidden rounded-[30px] border border-white/10 bg-black/18 shadow-[0_34px_110px_rgba(0,0,0,0.46)] backdrop-blur-xl">
          <div className="p-7 lg:p-9">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="text-sm text-white/60">
                  Module Quiz
                </div>

                <div className="mt-1 text-[30px] font-extrabold tracking-tight lg:text-[36px]">
                  {test.title}
                </div>

                <div className="mt-2 text-sm text-white/55">
                  {test.desc}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Pill label={`${answeredCount}/${total} answered`} />
                  <Pill label={`${answerPercent}% progress`} />
                  <Pill
                    label={`Score: ${finished ? `${score}/${total}` : "—"}`}
                    subtle
                  />
                  <Pill
                    label={`Passing: ${test.passingPercent}%`}
                    subtle
                  />
                </div>
              </div>

              <div className="w-full lg:w-[360px]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-sm font-semibold">
                    Instructions
                  </div>

                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/65">
                    {test.instructions.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>

                  <div className="mt-5 flex gap-3">
                    {!finished ? (
                      !started ? (
                        <button
                          type="button"
                          onClick={handleStart}
                          className="flex-1 rounded-2xl border border-[#5F9598]/25 bg-[#5F9598]/22 px-5 py-3 text-sm font-semibold transition hover:bg-[#5F9598]/30"
                        >
                          Start Quiz
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmSubmit(true)}
                          disabled={submitSaving}
                          className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-60"
                        >
                          {submitSaving ? "Submitting..." : "Submit"}
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={restart}
                        className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold transition hover:bg-white/10"
                      >
                        Retake
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onBack}
                      className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold transition hover:bg-white/10"
                    >
                      Exit
                    </button>
                  </div>

                  {confirmSubmit && !finished ? (
                    <div className="mt-4 rounded-2xl border border-[#5F9598]/25 bg-[#5F9598]/10 p-4">
                      <div className="text-sm font-semibold">
                        Submit now?
                      </div>

                      <div className="mt-1 text-[12px] text-white/60">
                        You answered {answeredCount} out of {total} questions.
                      </div>

                      <div className="mt-3 flex gap-3">
                        <button
                          type="button"
                          onClick={() => handleSubmit(false)}
                          disabled={submitSaving}
                          className="rounded-xl border border-[#5F9598]/25 bg-[#5F9598]/22 px-4 py-2.5 text-sm font-semibold transition hover:bg-[#5F9598]/30 disabled:opacity-60"
                        >
                          {submitSaving ? "Submitting..." : "Yes, submit"}
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmSubmit(false)}
                          disabled={submitSaving}
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {saveError ? (
                    <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-[12px] text-red-100">
                      {saveError}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-[#5F9598] transition-[width] duration-[500ms] ease-out"
                style={{ width: `${answerPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
          <div className="overflow-hidden rounded-[30px] border border-white/10 bg-black/18 shadow-[0_34px_110px_rgba(0,0,0,0.30)] backdrop-blur-xl">
            <div className="p-7 lg:p-9">
              {!current ? (
                <div className="text-white/60">
                  No questions available.
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[12px] text-white/55">
                        Question {activeIndex + 1} of {total}
                      </div>

                      <div className="mt-2 text-[20px] font-extrabold tracking-tight lg:text-[22px]">
                        {current.q}
                      </div>

                      <div className="mt-2 text-[12px] text-white/45">
                        Select one answer. It will auto-advance.
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-white/55">
                        Status
                      </div>

                      <div className="mt-1">
                        {answers[activeIndex] !== undefined ? (
                          <span className="rounded-full border border-[#5F9598]/28 bg-[#5F9598]/18 px-3 py-1.5 text-[11px] text-white/80">
                            Answered
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/55">
                            Unanswered
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {current.type === "model" ? (
                    <ModelQuestionViewer modelSrc={current.modelSrc} />
                  ) : null}

                  <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {current.options.map((option, index) => {
                      const chosen = answers[activeIndex] === index;
                      const showCorrect =
                        finished && index === current.answerIndex;
                      const showWrong =
                        finished && chosen && index !== current.answerIndex;

                      return (
                        <motion.button
                          key={`${activeIndex}-${option}`}
                          type="button"
                          {...motionPreset}
                          disabled={!started && !finished}
                          onClick={() => selectAnswer(index)}
                          className={[
                            "relative w-full overflow-hidden rounded-[22px] border p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35",
                            !started && !finished
                              ? "cursor-not-allowed opacity-55"
                              : "",
                            chosen
                              ? "border-[#5F9598]/28 bg-[#5F9598]/14"
                              : "border-white/10 bg-white/5 hover:bg-white/10",
                            showCorrect ? "ring-2 ring-[#5F9598]/55" : "",
                            showWrong ? "ring-2 ring-red-400/50" : "",
                          ].join(" ")}
                        >
                          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.06),transparent_38%)]" />

                          <div className="relative flex items-start gap-3">
                            <div
                              className={[
                                "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-[12px] font-bold",
                                chosen
                                  ? "border-[#5F9598]/28 bg-[#5F9598]/18 text-white/80"
                                  : "border-white/10 bg-black/20 text-white/60",
                              ].join(" ")}
                              aria-hidden="true"
                            >
                              {String.fromCharCode(65 + index)}
                            </div>

                            <div className="flex-1">
                              <div className="font-semibold">
                                {option}
                              </div>

                              {finished && showCorrect ? (
                                <div className="mt-2 text-[12px] text-white/55">
                                  Correct answer
                                </div>
                              ) : null}

                              {finished && showWrong ? (
                                <div className="mt-2 text-[12px] text-red-200/70">
                                  Your choice
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-[30px] border border-white/10 bg-black/18 shadow-[0_34px_110px_rgba(0,0,0,0.30)] backdrop-blur-xl">
            <div className="p-7">
              <div className="text-lg font-bold tracking-tight">
                Question Navigator
              </div>

              <div className="mt-2 text-[12px] text-white/55">
                Jump to any question. Answered questions are highlighted.
              </div>

              <div className="mt-5 grid grid-cols-5 gap-2">
                {Array.from({ length: total }).map((_, index) => {
                  const isActive = index === activeIndex;
                  const isAnswered = answers[index] !== undefined;

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      className={[
                        "h-10 rounded-xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35",
                        isActive
                          ? "border-[#5F9598]/28 bg-[#5F9598]/18"
                          : isAnswered
                          ? "border-white/15 bg-white/10 hover:bg-white/15"
                          : "border-white/10 bg-white/5 hover:bg-white/10",
                      ].join(" ")}
                      aria-label={`Go to question ${index + 1}`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold">
                  Summary
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <SummaryItem
                    label="Answered"
                    value={`${answeredCount}/${total}`}
                  />
                  <SummaryItem
                    label="Remaining"
                    value={`${Math.max(0, total - answeredCount)}`}
                  />
                  <SummaryItem
                    label="Progress"
                    value={`${answerPercent}%`}
                  />
                  <SummaryItem
                    label="Time left"
                    value={fmt(secondsLeft)}
                  />
                </div>

                {finished ? (
                  <div className="mt-4 rounded-2xl border border-[#5F9598]/25 bg-[#5F9598]/10 p-4">
                    <div className="text-sm font-semibold">
                      Results
                    </div>

                    <div className="mt-1 text-[12px] text-white/60">
                      Score:{" "}
                      <span className="font-semibold text-white/85">
                        {score}
                      </span>{" "}
                      / {total}
                    </div>

                    <div className="mt-1 text-[12px] text-white/60">
                      Percent:{" "}
                      <span className="font-semibold text-white/85">
                        {scorePercent}%
                      </span>
                    </div>

                    <div className="mt-1 text-[12px] text-white/60">
                      Result:{" "}
                      <span
                        className={[
                          "font-semibold",
                          passed ? "text-[#b7fff0]" : "text-red-200",
                        ].join(" ")}
                      >
                        {passed ? "Passed" : "Needs Retake"}
                      </span>
                    </div>

                    <div className="mt-1 text-[12px] text-white/60">
                      Practice Test:{" "}
                      <span
                        className={[
                          "font-semibold",
                          practiceUnlocked ? "text-[#b7fff0]" : "text-red-200",
                        ].join(" ")}
                      >
                        {practiceUnlocked
                          ? "Unlocked"
                          : `Locked until ${test.practiceUnlockPercent}%`}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-[#5F9598]"
                          style={{ width: `${scorePercent}%` }}
                        />
                      </div>

                      <div className="mt-2 text-[11px] text-white/45">
                        Review questions to see correct answers highlighted.
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 text-[11.5px] text-white/45">
                3D assets must be in{" "}
                <span className="text-white/70">public/models</span>.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── */
/* Small UI bits */
/* ───────────────────────────────────────────────────────────── */

function Pill({ label, subtle = false }) {
  return (
    <span
      className={[
        "rounded-full border px-3 py-1.5 text-[11px]",
        subtle
          ? "border-white/10 bg-white/5 text-white/55"
          : "border-[#5F9598]/24 bg-[#5F9598]/14 text-white/75",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-[11px] text-white/55">
        {label}
      </div>

      <div className="mt-1 text-base font-extrabold tracking-tight">
        {value}
      </div>
    </div>
  );
}

/* Optional preload */
useGLTF.preload("/models/cpu.glb");
useGLTF.preload("/models/ram.glb");
useGLTF.preload("/models/psu.glb");
useGLTF.preload("/models/motherboard.glb");
useGLTF.preload("/models/hdd.glb");
useGLTF.preload("/models/case.glb");