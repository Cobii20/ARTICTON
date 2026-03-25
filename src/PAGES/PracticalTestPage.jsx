// src/PAGES/PracticalTestPage.jsx
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { motion, useReducedMotion } from "framer-motion";

/* ───────────────────────────────────────────────────────────── */
/* 3D Question Viewer (uses your existing setup) */
/* ───────────────────────────────────────────────────────────── */
function GLBModel({ url, scale = 1, rotation = [0, 0, 0], position = [0, 0, 0] }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={scale} rotation={rotation} position={position} />;
}

function ModelQuestionViewer({ modelSrc }) {
  return (
    <div className="mt-5 rounded-[26px] border border-white/10 bg-white/5 overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-white/10">
        <div className="text-sm font-semibold">3D Viewer</div>
        <div className="text-[11px] text-white/50">Drag to rotate • Scroll to zoom</div>
      </div>

      <div className="p-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
          <div className="h-[360px] w-full">
            <Canvas camera={{ position: [0, 1.1, 3.2], fov: 45 }} dpr={[1, 1.8]}>
              <color attach="background" args={["#071f29"]} />
              <ambientLight intensity={0.75} />
              <directionalLight position={[6, 8, 6]} intensity={1.25} />
              <directionalLight position={[-6, -2, -6]} intensity={0.4} />

              <Suspense fallback={null}>
                <Bounds fit clip observe margin={1.15}>
                  <GLBModel url={modelSrc} scale={1} rotation={[0, 0, 0]} position={[0, 0, 0]} />
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
          If the model doesn’t load, confirm the file is inside{" "}
          <span className="text-white/70">public/models</span> and referenced like{" "}
          <span className="text-white/70">/models/cpu.glb</span>.
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── */
/* Practical Test Page */
/* ───────────────────────────────────────────────────────────── */
export default function PracticalTestPage({ testId = "pc-assembly", onBack }) {
  const reduce = useReducedMotion();

  const test = useMemo(() => {
    const tests = [
      {
        id: "pc-assembly",
        title: "PC Assembly Practical Test",
        desc: "30 minutes • Beginner",
        durationMin: 30,
        badge: "Ready",
        instructions: [
          "Answer all questions before submitting.",
          "You can jump between questions anytime.",
          "The test auto-submits when time runs out.",
        ],
        questions: [
          // ✅ 3D QUESTION (NO pc.glb)
          {
            type: "model",
            q: "What part is this? (3D)",
            modelSrc: "/models/cpu.glb", // ✅ not pc.glb
            options: ["CPU", "RAM", "Power Supply (PSU)", "Motherboard"],
            answerIndex: 0,
          },

          {
            q: "Which component stores long-term data?",
            options: ["RAM", "SSD/HDD", "CPU", "GPU"],
            answerIndex: 1,
          },
          {
            q: "What part supplies power to the PC?",
            options: ["Motherboard", "Power Supply (PSU)", "RAM", "CPU Cooler"],
            answerIndex: 1,
          },
          {
            q: "Which component is considered the 'brain' of the computer?",
            options: ["CPU", "GPU", "SSD", "PSU"],
            answerIndex: 0,
          },
          {
            q: "Where do you install the RAM modules?",
            options: ["PCIe slots", "DIMM slots", "SATA ports", "M.2 slots"],
            answerIndex: 1,
          },
          {
            q: "What is the correct purpose of thermal paste?",
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
            options: ["24-pin ATX", "8-pin EPS (CPU power)", "SATA power", "PCIe 6-pin"],
            answerIndex: 1,
          },
          {
            q: "What does a GPU primarily handle?",
            options: ["Network traffic", "Graphics/rendering", "File storage", "Cooling control"],
            answerIndex: 1,
          },
          {
            q: "Which is best practice when handling PC components?",
            options: [
              "Touch gold contacts to check quality",
              "Work on carpet for comfort",
              "Ground yourself to prevent static discharge",
              "Keep components stacked tightly",
            ],
            answerIndex: 2,
          },
          {
            q: "A motherboard standoff is used to:",
            options: [
              "Hold the CPU cooler",
              "Prevent motherboard shorting against the case",
              "Increase airflow",
              "Connect PSU cables",
            ],
            answerIndex: 1,
          },
          {
            q: "Before turning on a newly built PC, you should:",
            options: [
              "Remove all fans for airflow",
              "Check power connections and seating of components",
              "Disconnect the CPU power cable",
              "Pour compressed air inside",
            ],
            answerIndex: 1,
          },
        ],
      },
      {
        id: "networking-basics",
        title: "Networking Basics Practical Test",
        desc: "20 minutes • Intermediate",
        durationMin: 20,
        badge: "Locked",
        instructions: ["Answer carefully.", "Some questions may look similar.", "Time auto-submits."],
        questions: [
          {
            q: "Which device routes traffic between different networks?",
            options: ["Switch", "Router", "NIC", "RAM"],
            answerIndex: 1,
          },
          {
            q: "What does IP stand for?",
            options: ["Internet Protocol", "Internal Program", "Integrated Packet", "Input Port"],
            answerIndex: 0,
          },
          {
            q: "Which layer does a switch primarily operate on (traditional)?",
            options: ["Layer 1", "Layer 2", "Layer 3", "Layer 7"],
            answerIndex: 1,
          },
          {
            q: "What is the purpose of DNS?",
            options: [
              "Encrypt network traffic",
              "Convert domain names to IP addresses",
              "Provide Wi-Fi signal",
              "Route packets between subnets",
            ],
            answerIndex: 1,
          },
          {
            q: "Which is a private IPv4 address range?",
            options: ["8.8.8.8", "172.16.0.0 – 172.31.255.255", "1.1.1.1", "200.200.200.200"],
            answerIndex: 1,
          },
          {
            q: "What does DHCP do?",
            options: [
              "Assigns IP addresses automatically",
              "Encrypts traffic",
              "Resolves domain names",
              "Blocks unwanted ports",
            ],
            answerIndex: 0,
          },
          {
            q: "Which port is typically used for HTTPS?",
            options: ["21", "53", "80", "443"],
            answerIndex: 3,
          },
          {
            q: "A strong Wi-Fi signal but no internet often indicates:",
            options: [
              "Router has no ISP connection",
              "The NIC is broken",
              "The keyboard is unplugged",
              "The monitor is off",
            ],
            answerIndex: 0,
          },
        ],
      },
    ];

    return tests.find((t) => t.id === testId) || tests[0];
  }, [testId]);

  // ─────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────
  const total = test.questions.length;

  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(test.durationMin * 60);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [qIndex]: optionIndex }

  // Reset on test change
  useEffect(() => {
    setStarted(false);
    setFinished(false);
    setConfirmSubmit(false);
    setSecondsLeft(test.durationMin * 60);
    setActiveIndex(0);
    setAnswers({});
  }, [test.id, test.durationMin]);

  // Timer
  useEffect(() => {
    if (!started || finished) return;
    if (secondsLeft <= 0) {
      handleSubmit(true);
      return;
    }
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, finished, secondsLeft]);

  const answeredCount = Object.keys(answers).length;

  const score = useMemo(() => {
    let s = 0;
    test.questions.forEach((qq, i) => {
      if (answers[i] === qq.answerIndex) s += 1;
    });
    return s;
  }, [answers, test.questions]);

  const percent = useMemo(() => {
    if (total === 0) return 0;
    return Math.round((answeredCount / total) * 100);
  }, [answeredCount, total]);

  const fmt = (s) => {
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const handleStart = () => {
    setStarted(true);
    setConfirmSubmit(false);
  };

  const handleSubmit = (auto = false) => {
    setConfirmSubmit(false);
    setFinished(true);
    setStarted(false);

    if (auto) {
      // eslint-disable-next-line no-alert
      alert("Time is up! Your test has been submitted automatically.");
    }
  };

  const restart = () => {
    setStarted(false);
    setFinished(false);
    setConfirmSubmit(false);
    setSecondsLeft(test.durationMin * 60);
    setActiveIndex(0);
    setAnswers({});
  };

  // ✅ Auto-next after selecting an answer
  const AUTO_NEXT_DELAY_MS = 220;

  const selectAnswer = (idx) => {
    if (!started || finished) return;

    // save answer
    setAnswers((p) => ({ ...p, [activeIndex]: idx }));

    // auto-next
    setTimeout(() => {
      setActiveIndex((i) => {
        if (i >= total - 1) {
          setConfirmSubmit(true); // show submit prompt at the end
          return i;
        }
        return i + 1;
      });
    }, AUTO_NEXT_DELAY_MS);
  };

  const motionPreset = useMemo(() => {
    if (reduce) return { whileHover: {}, whileTap: {}, transition: { duration: 0.15 } };
    return {
      whileHover: { y: -4, scale: 1.01 },
      whileTap: { scale: 0.99 },
      transition: { type: "spring", stiffness: 260, damping: 22 },
    };
  }, [reduce]);

  const current = test.questions[activeIndex];

  return (
    <div className="min-h-screen w-full bg-[#061E29] text-[#F3F4F4] font-sans antialiased">
      {/* Ambient */}
      <div className="pointer-events-none fixed -top-44 -left-44 h-[720px] w-[720px] rounded-full bg-[#5F9598]/18 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-56 -right-52 h-[820px] w-[820px] rounded-full bg-[#1D546D]/26 blur-3xl" />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#061E29] via-[#061E29] to-[#0B2A3A]" />

      <div className="relative p-6 lg:p-10 max-w-7xl mx-auto">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-semibold"
          >
            ← Back
          </button>

          <div className="flex items-center gap-3">
            <span
              className={[
                "text-[11px] px-3 py-1.5 rounded-full border",
                test.badge === "Ready"
                  ? "bg-[#5F9598]/18 border-[#5F9598]/28 text-white/80"
                  : "bg-white/5 border-white/10 text-white/55",
              ].join(" ")}
            >
              {test.badge}
            </span>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center min-w-[160px]">
              <div className="text-[12px] text-white/55">Time left</div>
              <div className="mt-1 text-2xl font-extrabold tracking-tight">{fmt(secondsLeft)}</div>
              <div className="mt-1 text-[11px] text-white/45">{finished ? "Submitted" : started ? "Running" : "Paused"}</div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="mt-7 rounded-[30px] border border-white/10 bg-black/18 backdrop-blur-xl shadow-[0_34px_110px_rgba(0,0,0,0.46)] overflow-hidden">
          <div className="p-7 lg:p-9">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="text-sm text-white/60">Practical Test</div>
                <div className="mt-1 text-[30px] lg:text-[36px] font-extrabold tracking-tight">{test.title}</div>
                <div className="mt-2 text-white/55 text-sm">{test.desc}</div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Pill label={`${answeredCount}/${total} answered`} />
                  <Pill label={`${percent}% progress`} />
                  <Pill label={`Score: ${finished ? `${score}/${total}` : "—"}`} subtle />
                </div>
              </div>

              <div className="w-full lg:w-[360px]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-sm font-semibold">Instructions</div>
                  <ul className="mt-3 space-y-2 text-white/65 text-sm list-disc pl-5">
                    {test.instructions.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>

                  <div className="mt-5 flex gap-3">
                    {!finished ? (
                      !started ? (
                        <button
                          type="button"
                          onClick={handleStart}
                          className="flex-1 px-5 py-3 rounded-2xl bg-[#5F9598]/22 border border-[#5F9598]/25 hover:bg-[#5F9598]/30 transition text-sm font-semibold"
                        >
                          Start Test
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmSubmit(true)}
                          className="flex-1 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-semibold"
                        >
                          Submit
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={restart}
                        className="flex-1 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-semibold"
                      >
                        Retake
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onBack}
                      className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-semibold"
                    >
                      Exit
                    </button>
                  </div>

                  {confirmSubmit && !finished ? (
                    <div className="mt-4 rounded-2xl border border-[#5F9598]/25 bg-[#5F9598]/10 p-4">
                      <div className="text-sm font-semibold">Submit now?</div>
                      <div className="mt-1 text-[12px] text-white/60">
                        You answered {answeredCount} out of {total} questions.
                      </div>
                      <div className="mt-3 flex gap-3">
                        <button
                          type="button"
                          onClick={() => handleSubmit(false)}
                          className="px-4 py-2.5 rounded-xl bg-[#5F9598]/22 border border-[#5F9598]/25 hover:bg-[#5F9598]/30 transition text-sm font-semibold"
                        >
                          Yes, submit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmSubmit(false)}
                          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-[#5F9598] transition-[width] duration-[500ms] ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          {/* Question Card */}
          <div className="rounded-[30px] border border-white/10 bg-black/18 backdrop-blur-xl shadow-[0_34px_110px_rgba(0,0,0,0.30)] overflow-hidden">
            <div className="p-7 lg:p-9">
              {!current ? (
                <div className="text-white/60">No questions available.</div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[12px] text-white/55">
                        Question {activeIndex + 1} of {total}
                      </div>
                      <div className="mt-2 text-[20px] lg:text-[22px] font-extrabold tracking-tight">
                        {current.q}
                      </div>
                      <div className="mt-2 text-[12px] text-white/45">
                        Select one answer — it will auto-advance.
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-white/55">Status</div>
                      <div className="mt-1">
                        {answers[activeIndex] !== undefined ? (
                          <span className="text-[11px] px-3 py-1.5 rounded-full bg-[#5F9598]/18 border border-[#5F9598]/28 text-white/80">
                            Answered
                          </span>
                        ) : (
                          <span className="text-[11px] px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/55">
                            Unanswered
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ✅ 3D block only for model questions */}
                  {current.type === "model" ? <ModelQuestionViewer modelSrc={current.modelSrc} /> : null}

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {current.options.map((opt, idx) => {
                      const chosen = answers[activeIndex] === idx;
                      const showCorrect = finished && idx === current.answerIndex;
                      const showWrong = finished && chosen && idx !== current.answerIndex;

                      return (
                        <motion.button
                          key={`${activeIndex}-${opt}`}
                          type="button"
                          {...motionPreset}
                          disabled={!started && !finished}
                          onClick={() => selectAnswer(idx)}
                          className={[
                            "text-left w-full rounded-[22px] border p-5 transition focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35 relative overflow-hidden",
                            !started && !finished ? "opacity-55 cursor-not-allowed" : "",
                            chosen
                              ? "bg-[#5F9598]/14 border-[#5F9598]/28"
                              : "bg-white/5 border-white/10 hover:bg-white/10",
                            showCorrect ? "ring-2 ring-[#5F9598]/55" : "",
                            showWrong ? "ring-2 ring-red-400/50" : "",
                          ].join(" ")}
                        >
                          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.06),transparent_38%)]" />
                          <div className="relative flex items-start gap-3">
                            <div
                              className={[
                                "mt-0.5 h-6 w-6 rounded-full border flex items-center justify-center text-[12px] font-bold",
                                chosen
                                  ? "bg-[#5F9598]/18 border-[#5F9598]/28 text-white/80"
                                  : "bg-black/20 border-white/10 text-white/60",
                              ].join(" ")}
                              aria-hidden="true"
                            >
                              {String.fromCharCode(65 + idx)}
                            </div>

                            <div className="flex-1">
                              <div className="font-semibold">{opt}</div>

                              {finished && showCorrect ? (
                                <div className="mt-2 text-[12px] text-white/55">Correct answer</div>
                              ) : null}

                              {finished && showWrong ? (
                                <div className="mt-2 text-[12px] text-red-200/70">Your choice</div>
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

          {/* Right Panel */}
          <div className="rounded-[30px] border border-white/10 bg-black/18 backdrop-blur-xl shadow-[0_34px_110px_rgba(0,0,0,0.30)] overflow-hidden">
            <div className="p-7">
              <div className="text-lg font-bold tracking-tight">Question Navigator</div>
              <div className="mt-2 text-[12px] text-white/55">
                Jump to any question. Answered questions are highlighted.
              </div>

              <div className="mt-5 grid grid-cols-5 gap-2">
                {Array.from({ length: total }).map((_, i) => {
                  const isActive = i === activeIndex;
                  const isAnswered = answers[i] !== undefined;

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveIndex(i)}
                      className={[
                        "h-10 rounded-xl border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#5F9598]/35",
                        isActive
                          ? "bg-[#5F9598]/18 border-[#5F9598]/28"
                          : isAnswered
                          ? "bg-white/10 border-white/15 hover:bg-white/15"
                          : "bg-white/5 border-white/10 hover:bg-white/10",
                      ].join(" ")}
                      aria-label={`Go to question ${i + 1}`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold">Summary</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <SummaryItem label="Answered" value={`${answeredCount}/${total}`} />
                  <SummaryItem label="Remaining" value={`${Math.max(0, total - answeredCount)}`} />
                  <SummaryItem label="Progress" value={`${percent}%`} />
                  <SummaryItem label="Time left" value={fmt(secondsLeft)} />
                </div>

                {finished ? (
                  <div className="mt-4 rounded-2xl border border-[#5F9598]/25 bg-[#5F9598]/10 p-4">
                    <div className="text-sm font-semibold">Results</div>
                    <div className="mt-1 text-[12px] text-white/60">
                      Score: <span className="text-white/85 font-semibold">{score}</span> / {total}
                    </div>
                    <div className="mt-3">
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-[#5F9598]"
                          style={{ width: `${Math.round((score / total) * 100)}%` }}
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
                3D assets must be in <span className="text-white/70">public/models</span> (example:{" "}
                <span className="text-white/70">/models/ram.glb</span>). Do not use{" "}
                <span className="text-white/70">pc.glb</span>.
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
        "text-[11px] px-3 py-1.5 rounded-full border",
        subtle ? "bg-white/5 border-white/10 text-white/55" : "bg-[#5F9598]/14 border-[#5F9598]/24 text-white/75",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-[11px] text-white/55">{label}</div>
      <div className="mt-1 text-base font-extrabold tracking-tight">{value}</div>
    </div>
  );
}

/* Optional preload (NO pc.glb) */
useGLTF.preload("/models/cpu.glb");
useGLTF.preload("/models/ram.glb");
useGLTF.preload("/models/psu.glb");
useGLTF.preload("/models/motherboard.glb");
useGLTF.preload("/models/hdd.glb");
useGLTF.preload("/models/case.glb");
