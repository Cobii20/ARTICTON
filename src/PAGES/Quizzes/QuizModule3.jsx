import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { motion, useReducedMotion } from "framer-motion";
import { auth, db } from "../../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

/* ───────────────────────────────────────────────────────────── */
/* QUIZ SETTINGS */
/* ───────────────────────────────────────────────────────────── */

const QUIZ_SETTINGS = {
  id: "quiz-module-3",
  quizKey: "module3",
  requiredModuleKey: "module3",
  title: "Module 3 Quiz",
  desc: "PC Disassembly • Sequence and Component Removal",
  durationMin: 20,
  passingPercent: 60,
  practiceUnlockPercent: 60,
  instructions: [
    "Finish Module 3 first before taking this quiz.",
    "Score 60% or higher to unlock the practice test.",
    "This quiz includes disassembly sequence, safe removal concepts, and 3D identification questions.",
    "For 3D questions, inspect the model and choose the correct component.",
    "The quiz auto-submits when time runs out.",
  ],
};

/* ───────────────────────────────────────────────────────────── */
/* MODEL URLS */
/* ───────────────────────────────────────────────────────────── */

const MODEL_URLS = {
  case: "/models/PC CASE(BLENDER).glb",
  motherboard: "/models/MB(BLENDER).glb",
  cpu: "/models/CPU(BLENDER).glb",
  ram: "/models/RAM(BLENDER).glb",
  ssd: "/models/SSD(BLENDER).glb",
  hdd: "/models/HDD(BLENDER).glb",
  psu: "/models/PSU(BLENDER).glb",
};

/* ───────────────────────────────────────────────────────────── */
/* PREPARED MODULE 3 QUESTIONS */
/* ───────────────────────────────────────────────────────────── */

const MODULE3_QUESTIONS = [
  {
    type: "choice",
    q: "What is the correct first step in the Module 3 PC disassembly sequence?",
    options: [
      "Remove the RAM",
      "Remove the motherboard",
      "Remove the PSU",
      "Remove the CPU",
    ],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "After removing the RAM, which component is removed next in Module 3?",
    options: ["HDD", "CPU", "Motherboard", "PSU"],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "Which is the correct Module 3 disassembly sequence?",
    options: [
      "RAM → HDD → SSD → PSU → CPU → Motherboard → Full Disassembly",
      "CPU → RAM → SSD → Motherboard → HDD → PSU → Full Disassembly",
      "Motherboard → CPU → RAM → HDD → PSU → SSD → Full Disassembly",
      "PSU → HDD → RAM → CPU → SSD → Motherboard → Full Disassembly",
    ],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "What should you do before removing internal PC components?",
    options: [
      "Power off the PC and handle components carefully",
      "Keep the PC running to test the parts",
      "Pull all cables as fast as possible",
      "Touch the gold contacts directly",
    ],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "What is removed from the motherboard DIMM slot during RAM disassembly?",
    options: ["RAM module", "PSU cable", "HDD tray", "Case panel"],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "Which part is commonly used for long-term storage and is removed in the HDD step?",
    options: ["Hard Disk Drive", "CPU", "RAM", "Motherboard"],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "Why should storage drives be removed carefully?",
    options: [
      "To avoid damaging connectors and stored data devices",
      "To make the CPU faster",
      "To increase RAM size",
      "To turn the case into a power supply",
    ],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "After the HDD is removed, which component is removed next in Module 3?",
    options: ["SSD", "Motherboard", "CPU", "RAM"],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "What is the purpose of the SSD in a computer?",
    options: [
      "Fast data storage",
      "Supplying power to the PC",
      "Holding the CPU cooler only",
      "Displaying graphics on the monitor",
    ],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "After SSD removal, what comes next in the Module 3 sequence?",
    options: ["PSU removal", "RAM installation", "Full assembly", "CPU installation"],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "What does PSU stand for?",
    options: ["Power Supply Unit", "Processor Storage Unit", "Primary System Utility", "Panel Support Unit"],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "Why should the PSU be handled carefully during disassembly?",
    options: [
      "It supplies power and may have attached cables that must be managed safely",
      "It stores the operating system only",
      "It is the computer's temporary memory",
      "It is the same part as the RAM",
    ],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "After removing the PSU, which component is removed next?",
    options: ["CPU", "HDD", "RAM", "Case"],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "Why should CPU removal be done gently?",
    options: [
      "The CPU and socket pins/contacts can be damaged easily",
      "The CPU is made to be bent during removal",
      "The CPU is a power cable",
      "The CPU is the PC case cover",
    ],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "After CPU removal, what is the next required disassembly step?",
    options: ["Remove the motherboard", "Install the RAM", "Install the SSD", "Start full assembly"],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "What is the motherboard's role in the PC?",
    options: [
      "It connects and supports major components like CPU, RAM, and storage",
      "It only stores photos and files",
      "It supplies all electricity by itself",
      "It replaces the PC case",
    ],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "What does the Full Disassembly scene confirm?",
    options: [
      "All required parts have been removed correctly",
      "Only the RAM was installed",
      "The PC was fully assembled",
      "The PSU was skipped",
    ],
    answerIndex: 0,
  },
  {
    type: "choice",
    q: "If a user skips one required disassembly scene, what should happen before showing completion?",
    options: [
      "Completion should not be validated until all required scenes are finished",
      "The skipped scene should count as finished automatically",
      "The quiz should open without module completion",
      "The motherboard should disappear first",
    ],
    answerIndex: 0,
  },
];

/* ───────────────────────────────────────────────────────────── */
/* 3D MODEL QUESTIONS */
/* ───────────────────────────────────────────────────────────── */

const MODEL_QUESTIONS = [
  {
    type: "model",
    q: "What component is shown in this 3D model?",
    modelSrc: MODEL_URLS.ram,
    options: ["RAM", "CPU", "PSU", "HDD"],
    answerIndex: 0,
  },
  {
    type: "model",
    q: "What component is shown in this 3D model?",
    modelSrc: MODEL_URLS.hdd,
    options: ["SSD", "HDD", "RAM", "Case"],
    answerIndex: 1,
  },
  {
    type: "model",
    q: "What component is shown in this 3D model?",
    modelSrc: MODEL_URLS.ssd,
    options: ["Motherboard", "CPU", "SSD", "PSU"],
    answerIndex: 2,
  },
  {
    type: "model",
    q: "What component is shown in this 3D model?",
    modelSrc: MODEL_URLS.psu,
    options: ["Power Supply Unit", "RAM", "HDD", "CPU"],
    answerIndex: 0,
  },
  {
    type: "model",
    q: "What component is shown in this 3D model?",
    modelSrc: MODEL_URLS.cpu,
    options: ["HDD", "SSD", "CPU", "Case"],
    answerIndex: 2,
  },
  {
    type: "model",
    q: "What component is shown in this 3D model?",
    modelSrc: MODEL_URLS.motherboard,
    options: ["PSU", "Motherboard", "RAM", "HDD"],
    answerIndex: 1,
  },
  {
    type: "model",
    q: "What component is shown in this 3D model?",
    modelSrc: MODEL_URLS.case,
    options: ["PC Case", "SSD", "CPU", "RAM"],
    answerIndex: 0,
  },
];

function buildQuizQuestions() {
  const mixed = [];
  let modelIndex = 0;

  MODULE3_QUESTIONS.forEach((question, index) => {
    mixed.push(question);

    if (index % 3 === 0 && MODEL_QUESTIONS[modelIndex]) {
      mixed.push(MODEL_QUESTIONS[modelIndex]);
      modelIndex += 1;
    }
  });

  while (modelIndex < MODEL_QUESTIONS.length) {
    mixed.push(MODEL_QUESTIONS[modelIndex]);
    modelIndex += 1;
  }

  return mixed;
}

/* ───────────────────────────────────────────────────────────── */
/* 3D VIEWER */
/* ───────────────────────────────────────────────────────────── */

function GLBModel({ url }) {
  const { scene } = useGLTF(url);

  const clone = useMemo(() => {
    const nextClone = scene.clone(true);

    nextClone.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    return nextClone;
  }, [scene]);

  return <primitive object={clone} />;
}

function ModelQuestionViewer({ modelSrc }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[24px] border border-[#5F9598]/25 bg-[#092532]/80 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <div>
          <div className="text-[13px] font-black text-white">3D Component Viewer</div>
          <div className="mt-0.5 text-[11px] text-white/45">Drag to rotate. Scroll to zoom.</div>
        </div>

        <div className="rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#b7fff0]">
          3D
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#061E29]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(0,255,180,0.14),transparent_48%)]" />
        <Canvas camera={{ position: [0, 1.1, 3.2], fov: 45 }} dpr={[1, 1.8]}>
          <color attach="background" args={["#061E29"]} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[6, 8, 6]} intensity={1.35} />
          <directionalLight position={[-6, -2, -6]} intensity={0.45} />

          <Suspense fallback={null}>
            <Bounds fit clip observe margin={0.72}>
              <GLBModel url={modelSrc} />
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
            autoRotateSpeed={0.85}
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>
      </div>
    </div>
  );
}

function DisassemblySequenceVisual() {
  const steps = ["RAM", "HDD", "SSD", "PSU", "CPU", "MB", "Full"];

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden rounded-[22px] border border-white/10 bg-[#092532]/70 p-5 shadow-[inset_0_0_80px_rgba(0,255,180,0.04)]">
      <div className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#b7fff0]/70">Disassembly Flow</div>
      <div className="mt-5 grid grid-cols-7 gap-2">
        {steps.map((step, index) => (
          <div key={step} className="relative">
            <div className="flex h-16 items-center justify-center rounded-2xl border border-[#00ffb4]/20 bg-[#00ffb4]/8 text-sm font-black text-white">
              {step}
            </div>
            {index < steps.length - 1 ? (
              <div className="absolute right-[-10px] top-1/2 z-10 -translate-y-1/2 text-[#00ffb4]/75">→</div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-5 text-sm leading-6 text-white/50">
        Use the sequence as a guide, then select the best answer below.
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── */
/* QUIZ PAGE */
/* ───────────────────────────────────────────────────────────── */

export default function QuizModule3({ onBack, onQuizComplete }) {
  const reduce = useReducedMotion();

  const questions = useMemo(() => buildQuizQuestions(), []);
  const total = questions.length;

  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState("");

  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitSaving, setSubmitSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [startWarning, setStartWarning] = useState("");

  const [secondsLeft, setSecondsLeft] = useState(QUIZ_SETTINGS.durationMin * 60);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState({});

  const moduleProgress = profile?.moduleProgress?.[QUIZ_SETTINGS.requiredModuleKey];
  const moduleCompleted =
    !!moduleProgress?.completed ||
    (moduleProgress?.percent || 0) >= 100 ||
    Object.values(moduleProgress?.completedSteps || {}).filter(Boolean).length >= 7;

  const isLocked = !moduleCompleted;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setAccessLoading(true);
      setAccessError("");

      if (!currentUser) {
        setFirebaseUser(null);
        setProfile(null);
        setAccessLoading(false);
        return;
      }

      setFirebaseUser(currentUser);

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          setProfile(snap.data());
        } else {
          setProfile({});
        }
      } catch (err) {
        setAccessError(err.message || "Unable to check quiz access.");
      } finally {
        setAccessLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!started || finished) return;

    if (secondsLeft <= 0) {
      handleSubmit(true);
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((current) => current - 1);
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, finished, secondsLeft]);

  const answeredCount = Object.keys(answers).length;

  const calculateScore = (answerMap = answers) => {
    let result = 0;

    questions.forEach((question, index) => {
      if (answerMap[index] === question.answerIndex) result += 1;
    });

    return result;
  };

  const score = useMemo(() => calculateScore(answers), [answers, questions]);

  const answerPercent = useMemo(() => {
    if (total === 0) return 0;
    return Math.round((answeredCount / total) * 100);
  }, [answeredCount, total]);

  const scorePercent = useMemo(() => {
    if (total === 0) return 0;
    return Math.round((score / total) * 100);
  }, [score, total]);

  const passed = finished && scorePercent >= QUIZ_SETTINGS.passingPercent;

  const formatTime = (seconds) => {
    const minutesText = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secondsText = String(seconds % 60).padStart(2, "0");
    return `${minutesText}:${secondsText}`;
  };

  const clamp = (number, min, max) => Math.max(min, Math.min(max, number));

  const handleStart = () => {
    if (isLocked) return;

    setStarted(true);
    setConfirmSubmit(false);
    setSaveError("");
    setStartWarning("");
  };

  const saveQuizProgress = async ({
    finalScore,
    finalPercent,
    finalPassed,
    autoSubmitted,
  }) => {
    const currentUser = firebaseUser || auth.currentUser;

    if (!currentUser) {
      throw new Error("No logged-in user. Quiz progress was not saved.");
    }

    const userRef = doc(db, "users", currentUser.uid);

    const alreadyUnlocked =
      !!profile?.practiceTestAccess?.[QUIZ_SETTINGS.quizKey]?.unlocked;

    const newlyUnlocked =
      finalPercent >= QUIZ_SETTINGS.practiceUnlockPercent;

    const practiceUnlocked = alreadyUnlocked || newlyUnlocked;

    const quizPayload = {
      completed: true,
      finished: true,
      passed: finalPassed,
      score: finalScore,
      total,
      percent: finalPercent,
      passingPercent: QUIZ_SETTINGS.passingPercent,
      practiceUnlockPercent: QUIZ_SETTINGS.practiceUnlockPercent,
      autoSubmitted,
      updatedAt: serverTimestamp(),
    };

    const practiceAccessPayload = {
      unlocked: practiceUnlocked,
      requiredPercent: QUIZ_SETTINGS.practiceUnlockPercent,
      latestScore: finalScore,
      latestTotal: total,
      latestPercent: finalPercent,
      sourceQuizId: QUIZ_SETTINGS.id,
      updatedAt: serverTimestamp(),
    };

    if (newlyUnlocked && !alreadyUnlocked) {
      practiceAccessPayload.unlockedAt = serverTimestamp();
    }

    await setDoc(
      userRef,
      {
        quizProgress: {
          [QUIZ_SETTINGS.quizKey]: quizPayload,
        },
        practiceTestAccess: {
          [QUIZ_SETTINGS.quizKey]: practiceAccessPayload,
        },
      },
      { merge: true }
    );

    const localUpdatedAt = new Date().toISOString();

    setProfile((previous) => ({
      ...(previous || {}),
      quizProgress: {
        ...(previous?.quizProgress || {}),
        [QUIZ_SETTINGS.quizKey]: {
          ...quizPayload,
          updatedAt: localUpdatedAt,
        },
      },
      practiceTestAccess: {
        ...(previous?.practiceTestAccess || {}),
        [QUIZ_SETTINGS.quizKey]: {
          ...(previous?.practiceTestAccess?.[QUIZ_SETTINGS.quizKey] || {}),
          ...practiceAccessPayload,
          updatedAt: localUpdatedAt,
          unlockedAt:
            newlyUnlocked && !alreadyUnlocked
              ? localUpdatedAt
              : previous?.practiceTestAccess?.[QUIZ_SETTINGS.quizKey]?.unlockedAt,
        },
      },
    }));

    try {
      localStorage.setItem("articton-last-progress-update", String(Date.now()));

      window.dispatchEvent(
        new CustomEvent("articton-progress-updated", {
          detail: {
            type: "practice-unlock",
            module: QUIZ_SETTINGS.quizKey,
            completed: true,
            unlocked: practiceUnlocked,
            percent: finalPercent,
          },
        })
      );
    } catch {
      // Optional dashboard refresh signal only.
    }

    onQuizComplete?.(QUIZ_SETTINGS.quizKey, {
      ...quizPayload,
      updatedAt: localUpdatedAt,
      practiceUnlocked,
    });

    return {
      quizPayload,
      practiceAccessPayload,
    };
  };

  const handleSubmit = async (auto = false, answerOverride = answers) => {
    if (finished || submitSaving) return;

    setConfirmSubmit(false);
    setSubmitSaving(true);
    setSaveError("");

    const finalScore = calculateScore(answerOverride);
    const finalPercent = total === 0 ? 0 : Math.round((finalScore / total) * 100);
    const finalPassed = finalPercent >= QUIZ_SETTINGS.passingPercent;

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
        alert("Time is up! Your quiz has been submitted automatically.");
      }
    } catch (err) {
      console.error(`${QUIZ_SETTINGS.title} save error:`, err);
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
    setStartWarning("");
    setSecondsLeft(QUIZ_SETTINGS.durationMin * 60);
    setActiveIndex(0);
    setAnswers({});
  };

  const selectAnswer = (index) => {
    if (isLocked || finished || submitSaving) return;

    if (!started) {
      setStartWarning("Click Start to start the quiz before answering.");

      window.clearTimeout(selectAnswer.warningTimer);
      selectAnswer.warningTimer = window.setTimeout(() => {
        setStartWarning("");
      }, 2200);

      return;
    }

    setStartWarning("");

    const nextAnswers = {
      ...answers,
      [activeIndex]: index,
    };

    setAnswers(nextAnswers);

    setTimeout(() => {
      if (activeIndex >= total - 1) {
        handleSubmit(false, nextAnswers);
        return;
      }

      setActiveIndex((currentIndex) => clamp(currentIndex + 1, 0, total - 1));
    }, 220);
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
      whileHover: { y: -3, scale: 1.005 },
      whileTap: { scale: 0.99 },
      transition: { type: "spring", stiffness: 260, damping: 22 },
    };
  }, [reduce]);

  const current = questions[activeIndex];

  if (accessLoading) {
    return (
      <FullscreenShell>
        <CenteredPanel>
          <div className="mx-auto mb-5 h-12 w-12 animate-pulse rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10" />
          <div className="text-xl font-black text-white">Checking access...</div>
          <div className="mt-2 text-sm text-white/50">Please wait while your module progress is loaded.</div>
        </CenteredPanel>
      </FullscreenShell>
    );
  }

  if (accessError || isLocked) {
    return (
      <FullscreenShell>
        <CenteredPanel>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-red-400/25 bg-red-500/10 text-2xl">
            🔒
          </div>
          <div className="text-[12px] font-bold uppercase tracking-[0.28em] text-red-200/80">Locked Quiz</div>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white">{QUIZ_SETTINGS.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/60">
            {accessError ? accessError : "Finish Module 3 first before taking this quiz."}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-7 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
          >
            ← Back
          </button>
        </CenteredPanel>
      </FullscreenShell>
    );
  }

  return (
    <FullscreenShell>
      <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
        <TopControlBar
          onBack={onBack}
          time={formatTime(secondsLeft)}
          status={finished ? "Submitted" : started ? "Running" : "Paused"}
          answeredCount={answeredCount}
          total={total}
          answerPercent={answerPercent}
          score={score}
          finished={finished}
          started={started}
          submitSaving={submitSaving}
          confirmSubmit={confirmSubmit}
          saveError={saveError}
          onStart={handleStart}
          onSubmitPrompt={() => setConfirmSubmit(true)}
          onSubmit={() => handleSubmit(false)}
          onCancelSubmit={() => setConfirmSubmit(false)}
          onRetake={restart}
          onExit={onBack}
        />

        <div className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_310px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <QuizStage current={current} activeIndex={activeIndex} total={total} answered={answers[activeIndex] !== undefined}>
            <div className="flex h-full min-h-0 overflow-hidden">
              {current?.type === "model" ? (
                <ModelQuestionViewer modelSrc={current.modelSrc} />
              ) : (
                <DisassemblySequenceVisual />
              )}
            </div>

            <AnswerGrid
              current={current}
              activeIndex={activeIndex}
              answers={answers}
              finished={finished}
              started={started}
              startWarning={startWarning}
              motionPreset={motionPreset}
              onSelect={selectAnswer}
            />
          </QuizStage>

          <RightRail
            questions={questions}
            answers={answers}
            activeIndex={activeIndex}
            setActiveIndex={setActiveIndex}
            total={total}
            answeredCount={answeredCount}
            answerPercent={answerPercent}
            time={formatTime(secondsLeft)}
            finished={finished}
            score={score}
            scorePercent={scorePercent}
            passed={passed}
          />
        </div>
      </div>
    </FullscreenShell>
  );
}

/* ───────────────────────────────────────────────────────────── */
/* LAYOUT COMPONENTS */
/* ───────────────────────────────────────────────────────────── */

function FullscreenShell({ children }) {
  return (
    <div className="relative h-[calc(100dvh-270px)] max-h-[calc(100dvh-270px)] min-h-0 w-full overflow-hidden rounded-[24px] bg-[#061E29] p-3 font-sans text-[#F3F4F4] antialiased">
      <div className="pointer-events-none absolute -left-48 -top-48 h-[520px] w-[520px] rounded-full bg-[#5F9598]/18 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-52 -right-44 h-[620px] w-[620px] rounded-full bg-[#1D546D]/26 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,#061E29_0%,#061E29_42%,#0B2A3A_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:58px_58px] opacity-35" />
      <div className="relative h-full min-h-0 w-full overflow-hidden">{children}</div>
    </div>
  );
}

function GlassPanel({ className = "", children }) {
  return (
    <div className={["rounded-[28px] border border-white/10 bg-black/18 shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl", className].join(" ")}>
      {children}
    </div>
  );
}

function CenteredPanel({ children }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center">
      <GlassPanel className="w-full max-w-3xl p-9 text-center">{children}</GlassPanel>
    </div>
  );
}

function TopControlBar({
  onBack,
  time,
  status,
  answeredCount,
  total,
  answerPercent,
  score,
  finished,
  started,
  submitSaving,
  confirmSubmit,
  saveError,
  onStart,
  onSubmitPrompt,
  onSubmit,
  onCancelSubmit,
  onRetake,
  onExit,
}) {
  return (
    <GlassPanel className="shrink-0 overflow-hidden">
      <div className="grid min-h-[74px] items-center gap-3 px-4 py-2.5 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
        <button
          type="button"
          onClick={onBack}
          className="w-fit rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-[#00ffb4]/30 hover:bg-[#00ffb4]/10"
        >
          ← Back
        </button>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label="Disassembly Quiz" />
            <MetricPill label={`${answeredCount}/${total} answered`} />
            <MetricPill label={`${answerPercent}% progress`} />
            <MetricPill label={`Score: ${finished ? `${score}/${total}` : "—"}`} subtle />
          </div>

          <div className="mt-1.5 flex min-w-0 items-end gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-[22px] font-black leading-none tracking-tight text-white lg:text-[28px]">{QUIZ_SETTINGS.title}</h1>
              <div className="mt-1 truncate text-[12px] text-white/50">{QUIZ_SETTINGS.desc}</div>
            </div>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#5F9598,#00ffb4)] shadow-[0_0_24px_rgba(0,255,180,0.45)] transition-[width] duration-500"
              style={{ width: `${answerPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <TimerCard time={time} status={status} />

          {!finished ? (
            !started ? (
              <button type="button" onClick={onStart} className="rounded-2xl border border-[#5F9598]/35 bg-[#5F9598]/24 px-5 py-3 text-sm font-bold text-white transition hover:bg-[#5F9598]/32">
                Start
              </button>
            ) : (
              <button type="button" onClick={onSubmitPrompt} disabled={submitSaving} className="rounded-2xl border border-[#00ffb4]/25 bg-[#00ffb4]/12 px-5 py-3 text-sm font-bold text-[#b7fff0] transition hover:bg-[#00ffb4]/18 disabled:opacity-60">
                {submitSaving ? "Saving..." : "Submit"}
              </button>
            )
          ) : (
            <button type="button" onClick={onRetake} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/85 transition hover:bg-white/10">
              Retake
            </button>
          )}

          <button type="button" onClick={onExit} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/75 transition hover:bg-white/10">
            Exit
          </button>
        </div>
      </div>

      {confirmSubmit && !finished ? (
        <div className="border-t border-white/10 bg-[#00ffb4]/8 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-white">Submit now?</div>
              <div className="text-[12px] text-white/60">You answered {answeredCount} out of {total} questions.</div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={onSubmit} disabled={submitSaving} className="rounded-xl border border-[#00ffb4]/25 bg-[#00ffb4]/18 px-4 py-2 text-sm font-bold text-[#b7fff0] transition hover:bg-[#00ffb4]/24 disabled:opacity-60">
                {submitSaving ? "Saving..." : "Yes, submit"}
              </button>
              <button type="button" onClick={onCancelSubmit} disabled={submitSaving} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/75 transition hover:bg-white/10 disabled:opacity-60">
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {saveError ? <div className="border-t border-red-400/20 bg-red-500/10 px-5 py-3 text-[12px] text-red-100">{saveError}</div> : null}
    </GlassPanel>
  );
}

function QuizStage({ current, activeIndex, total, answered, children }) {
  return (
    <GlassPanel className="min-h-0 overflow-hidden">
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 p-4">
        <QuestionHeader current={current} activeIndex={activeIndex} total={total} answered={answered} />
        {children}
      </div>
    </GlassPanel>
  );
}

function QuestionHeader({ current, activeIndex, total, answered }) {
  return (
    <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-4xl">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#b7fff0]/70">Question {activeIndex + 1} of {total}</div>
        <h2 className="mt-1 text-[20px] font-black leading-tight tracking-tight text-white lg:text-[25px]">{current?.q}</h2>
        <div className="mt-1 text-[13px] text-white/45">
          {current?.type === "model" ? "Inspect the 3D model, then select the correct answer." : "Select one answer. It will auto-advance."}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-right">
        <div className="text-[10px] text-white/45">Status</div>
        <div className={answered ? "mt-0.5 text-sm font-bold text-[#b7fff0]" : "mt-0.5 text-sm font-bold text-white/55"}>{answered ? "Answered" : "Unanswered"}</div>
      </div>
    </div>
  );
}

function AnswerGrid({ current, activeIndex, answers, finished, started, startWarning, motionPreset, onSelect }) {
  if (!current) return null;

  return (
    <div className="shrink-0 space-y-3">
      {startWarning ? (
        <div className="rounded-2xl border border-yellow-400/25 bg-yellow-500/10 px-4 py-3 text-sm font-semibold text-yellow-100 shadow-[0_12px_35px_rgba(0,0,0,0.22)]">
          {startWarning}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {current.options.map((option, index) => {
          const chosen = answers[activeIndex] === index;
          const showCorrect = finished && index === current.answerIndex;
          const showWrong = finished && chosen && index !== current.answerIndex;

          return (
            <motion.button
              key={`${activeIndex}-${option}`}
              type="button"
              {...motionPreset}
              onClick={() => onSelect(index)}
              className={[
                "group relative min-h-[54px] w-full overflow-hidden rounded-[18px] border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/30",
                !started && !finished ? "cursor-pointer opacity-70" : "",
                chosen ? "border-[#00ffb4]/35 bg-[#00ffb4]/12 shadow-[0_18px_55px_rgba(0,255,180,0.08)]" : "border-white/10 bg-white/[0.045] hover:border-[#5F9598]/35 hover:bg-white/[0.075]",
                showCorrect ? "ring-2 ring-[#00ffb4]/60" : "",
                showWrong ? "ring-2 ring-red-400/50" : "",
              ].join(" ")}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.08),transparent_42%)]" />
              <div className="pointer-events-none absolute -right-16 -top-20 h-32 w-32 rounded-full bg-[#00ffb4]/0 blur-2xl transition group-hover:bg-[#00ffb4]/10" />

              <div className="relative flex items-center gap-3">
                <div
                  className={[
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-black transition",
                    chosen ? "border-[#00ffb4]/35 bg-[#00ffb4] text-[#061E29]" : "border-white/10 bg-black/20 text-white/60 group-hover:border-[#5F9598]/35 group-hover:text-white",
                  ].join(" ")}
                >
                  {String.fromCharCode(65 + index)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold leading-snug text-white/85">{option}</div>
                  {finished && showCorrect ? <div className="mt-1 text-[11px] font-semibold text-[#b7fff0]">Correct answer</div> : null}
                  {finished && showWrong ? <div className="mt-1 text-[11px] font-semibold text-red-200/80">Your choice</div> : null}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function RightRail({
  questions,
  answers,
  activeIndex,
  setActiveIndex,
  total,
  answeredCount,
  answerPercent,
  time,
  finished,
  score,
  scorePercent,
  passed,
}) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden">
      <NavigatorCard
        questions={questions}
        answers={answers}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
        total={total}
      />
      <SummaryCard
        answeredCount={answeredCount}
        total={total}
        answerPercent={answerPercent}
        time={time}
        finished={finished}
        score={score}
        scorePercent={scorePercent}
        passed={passed}
      />
    </div>
  );
}

function NavigatorCard({ questions, answers, activeIndex, setActiveIndex, total }) {
  return (
    <GlassPanel className="p-3">
      <div className="text-lg font-black tracking-tight text-white">Question Navigator</div>
      <div className="mt-1 text-[11px] text-white/50">Green dots mark 3D questions.</div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {Array.from({ length: total }).map((_, index) => {
          const isActive = index === activeIndex;
          const isAnswered = answers[index] !== undefined;
          const isModelQuestion = questions[index]?.type === "model";

          return (
            <button
              key={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={[
                "relative h-8 rounded-xl border text-xs font-black transition focus:outline-none focus:ring-2 focus:ring-[#00ffb4]/30",
                isActive
                  ? "border-[#00ffb4]/35 bg-[#00ffb4]/16 text-white shadow-[0_14px_35px_rgba(0,255,180,0.10)]"
                  : isAnswered
                  ? "border-[#5F9598]/28 bg-[#5F9598]/14 text-white/85 hover:bg-[#5F9598]/20"
                  : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10",
              ].join(" ")}
              aria-label={`Go to question ${index + 1}`}
            >
              {index + 1}
              {isModelQuestion ? <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border border-[#061E29] bg-[#00ffb4] shadow-[0_0_12px_rgba(0,255,180,0.8)]" /> : null}
            </button>
          );
        })}
      </div>
    </GlassPanel>
  );
}

function SummaryCard({
  answeredCount,
  total,
  answerPercent,
  time,
  finished,
  score,
  scorePercent,
  passed,
}) {
  return (
    <GlassPanel className="min-h-0 p-3">
      <div className="text-lg font-black tracking-tight text-white">Summary</div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <SummaryItem label="Answered" value={`${answeredCount}/${total}`} />
        <SummaryItem label="Remaining" value={`${Math.max(0, total - answeredCount)}`} />
        <SummaryItem label="Progress" value={`${answerPercent}%`} />
        <SummaryItem label="Time left" value={time} />
      </div>

      {finished ? (
        <div className="mt-4 rounded-[20px] border border-[#00ffb4]/25 bg-[#00ffb4]/10 p-4">
          <div className="text-sm font-black text-white">Results</div>
          <div className="mt-2 text-sm text-white/60">
            Score: <span className="font-bold text-white">{score}</span> / {total}
          </div>
          <div className="mt-1 text-sm text-white/60">
            Percent: <span className="font-bold text-white">{scorePercent}%</span>
          </div>
          <div className="mt-1 text-sm text-white/60">
            Result:{" "}
            <span className={passed ? "font-bold text-[#b7fff0]" : "font-bold text-red-200"}>
              {passed ? "Passed" : "Needs Retake"}
            </span>
          </div>
        </div>
      ) : null}
    </GlassPanel>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-white/[0.045] p-3">
      <div className="text-[10px] text-white/45">{label}</div>
      <div className="mt-1 text-sm font-black tracking-tight text-white">{value}</div>
    </div>
  );
}

function StatusPill({ label }) {
  return (
    <span className="rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#b7fff0]">
      {label}
    </span>
  );
}

function TimerCard({ time, status }) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-white/7 px-4 py-2 text-center shadow-[0_18px_55px_rgba(0,0,0,0.25)] backdrop-blur-xl">
      <div className="text-[10px] text-white/55">Time left</div>
      <div className="mt-0.5 text-[22px] font-black leading-none tracking-tight text-white">{time}</div>
      <div className="mt-1 text-[8px] uppercase tracking-[0.18em] text-white/35">{status}</div>
    </div>
  );
}

function MetricPill({ label, subtle = false }) {
  return (
    <span
      className={[
        "rounded-full border px-3 py-1.5 text-[10.5px] font-semibold",
        subtle ? "border-white/10 bg-white/5 text-white/55" : "border-[#5F9598]/30 bg-[#5F9598]/16 text-white/75",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

/* ───────────────────────────────────────────────────────────── */
/* PRELOAD MODELS */
/* ───────────────────────────────────────────────────────────── */

Object.values(MODEL_URLS).forEach((url) => {
  useGLTF.preload(url);
});