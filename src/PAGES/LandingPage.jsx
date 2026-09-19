import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleCheck,
  Cpu,
  Moon,
  Sun,
} from "lucide-react";
import { auth, db } from "../firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { getUserSettings, saveUserSetting, subscribeUserSettings } from "../utils/userSettings";

export default function ArtictonLandingPage({ onLogin }) {
  const [activeSection, setActiveSection] = useState("home");
  const [isLightPage, setIsLightPage] = useState(() => !getUserSettings().darkMode);

  useEffect(() => {
    return subscribeUserSettings((settings) => {
      setIsLightPage(!(settings.darkMode ?? false));
    });
  }, []);

  const handleThemeToggle = () => {
    saveUserSetting("darkMode", isLightPage);
  };

  useEffect(() => {
  // Allow vertical scrolling on every landing-page section.
  // Hide only accidental horizontal overflow.
  document.body.style.overflowX = "hidden";
  document.body.style.overflowY = "auto";

  return () => {
    document.body.style.overflowX = "";
    document.body.style.overflowY = "";
  };
}, []);

  const handleSuccessLogin = (profile) => {
    onLogin?.(profile);
  };

  return (
    <div
      className={[
        "articton-landing articton-landing-page min-h-screen font-[Outfit] antialiased",
        isLightPage
          ? "articton-landing--light bg-[#f8fafb] text-[#0f1a22]"
          : "articton-landing--dark bg-[#0a0e17] text-[#e8ecf4]",
      ].join(" ")}
    >
      <Navbar
        isHome={activeSection === "home"}
        onHome={() => setActiveSection("home")}
        onAbout={() => setActiveSection("about")}
        onOpenLogin={() => setActiveSection("login")}
        onSignup={() => setActiveSection("signup")}
        isLightPage={isLightPage}
        onToggleTheme={handleThemeToggle}
      />

      {activeSection === "home" ? (
        <>
          <HeroShowcaseFull
            onLogin={() => setActiveSection("login")}
            onSignup={() => setActiveSection("signup")}
          />
          <Footer dark={!isLightPage} />
        </>
      ) : activeSection === "about" ? (
        <>
          <AboutPage onJoin={() => setActiveSection("signup")} />
          <Footer dark={!isLightPage} />
        </>
      ) : activeSection === "signup" ? (
        <>
          <SignupPage
            onBack={() => setActiveSection("home")}
            onSwitchToLogin={() => setActiveSection("login")}
            onAfterSignup={() => setActiveSection("login")}
          />
          <Footer dark={!isLightPage} />
        </>
      ) : (
        <>
          <LoginPage
            onBack={() => setActiveSection("home")}
            onSwitchToSignup={() => setActiveSection("signup")}
            onSuccessLogin={handleSuccessLogin}
          />
          <Footer dark={!isLightPage} />
        </>
      )}
    </div>
  );
}

function Navbar({ isHome, onHome, onAbout, onOpenLogin, onSignup, isLightPage, onToggleTheme }) {
  return (
   <motion.nav
      initial={{ y: -18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="articton-landing-nav articton-glass-nav fixed top-0 z-50 flex w-full items-center justify-between border-b border-white/10 bg-[#0a0e17]/80 px-6 py-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl md:px-10 lg:px-16"
    >
      <button className="flex items-center gap-3" onClick={onHome}>
        <img
          src="/PNG/Articton.png"
          alt="Articton Logo"
          className="h-10 w-10 scale-300 object-contain mr-2"
        />
        <h1 className="articton-nav-label-optional text-2xl font-bold tracking-wide text-white">Articton</h1>
      </button>

        <div className="articton-nav-links flex items-center gap-6 text-sm md:gap-8">
        <button type="button" onClick={onHome} className="articton-nav-link">Home</button>
        <button type="button" onClick={onAbout} className="articton-nav-link">About</button>
        <button type="button" onClick={onOpenLogin} className="articton-nav-link">Login</button>
        <button
          onClick={onSignup}
          className="articton-signup-button rounded-full border border-[#FFD41C]/25 bg-[#FFD41C]/8 px-4 py-2 text-[#FFD41C] transition hover:bg-[#FFD41C]/14"
        >
          Signup
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isLightPage ? "Switch to dark mode" : "Switch to light mode"}
          title={isLightPage ? "Use dark mode" : "Use light mode"}
          className="articton-theme-toggle flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:border-[#FFD41C]/35 hover:bg-[#FFD41C]/10 hover:text-[#FFD41C]"
        >
          {isLightPage ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </div>
    </motion.nav>
  );
}

function HeroShowcaseFull({ onLogin, onSignup }) {
  return (
    <main className="articton-home">
      <section className="articton-landing-hero articton-home-screen relative overflow-hidden px-5 pb-4 pt-24 sm:px-8 lg:pt-24">
        <AnimatedGridBackground />
        <AmbientGlowLines />
        <div className="articton-scan-wave" aria-hidden="true" />
        <div className="articton-hero-orb articton-hero-orb--left" />
        <div className="articton-hero-orb articton-hero-orb--right" />

        <div className="relative z-10 mx-auto max-w-7xl text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="articton-kicker">
            <span className="h-2 w-2 rounded-full bg-[#FFD41C] shadow-[0_0_12px_#FFD41C]" />
            Interactive computer hardware learning
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="articton-hero-title mx-auto mt-4 max-w-5xl text-4xl font-black leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-6xl"
          >
            Learn PC Hardware by <span>Actually Working With It.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.65 }}
            className="articton-hero-copy mx-auto mt-4 max-w-3xl text-sm leading-6 sm:text-base"
          >
            Explore computer components, follow guided assembly and disassembly procedures,
            and build practical skills through structured, interactive learning.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button onClick={onLogin} className="articton-primary-cta group inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFD41C] px-7 py-3.5 font-bold text-[#10152f] shadow-[0_12px_32px_rgba(255,212,28,0.2)] transition hover:-translate-y-0.5">
              Start Learning <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </button>
            <button onClick={onSignup} className="articton-secondary-cta inline-flex items-center justify-center gap-2 rounded-xl border px-7 py-3.5 font-bold transition hover:-translate-y-0.5">
              Create Account <ChevronRight className="h-4 w-4" />
            </button>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }} className="articton-proof-row mx-auto mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-x-7 gap-y-2">
            <ProofItem text="Guided procedures" />
            <ProofItem text="AMD & Intel paths" />
            <ProofItem text="Progress tracking" />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.75 }} className="mt-6">
            <LearningWorkspace />
          </motion.div>
        </div>
      </section>
    </main>
  );
}

function ProofItem({ text }) {
  return <span className="inline-flex items-center gap-2 text-sm"><CircleCheck className="h-4 w-4 text-[#FFD41C]" />{text}</span>;
}

function LearningWorkspace() {
  return (
    <div className="articton-workspace mx-auto max-w-6xl overflow-hidden rounded-2xl text-left shadow-2xl">
      <div className="articton-workspace-top flex flex-wrap items-center gap-3 px-4 py-3 text-[11px] font-bold uppercase tracking-wider">
        <div className="flex gap-1.5"><span /><span /><span /></div>
        <p className="mr-auto">Articton learning workspace</p>
        <span className="articton-live-pill">Live module</span><span>AMD / Intel</span><span className="text-[#FFD41C]">68% complete</span>
      </div>
      <div className="articton-workspace-tabs flex gap-2 overflow-x-auto px-4 py-2 text-xs">
        <b>Module 3 · Assembly</b><span>Component map</span><span>Procedure guide</span><span>Assessment</span>
      </div>
      <div className="articton-workspace-body grid gap-3 p-3 lg:grid-cols-[0.78fr_1.65fr_0.9fr]">
        <div className="articton-workspace-panel space-y-3 p-4">
          <PanelLabel>Current module</PanelLabel><h3>Install the motherboard</h3><p>Prepare the case, align the rear I/O, and secure the board safely.</p>
          <div className="articton-progress"><span style={{ width: "68%" }} /></div>
          <div className="grid grid-cols-2 gap-2"><MiniStat label="Step" value="06 / 09" /><MiniStat label="Track" value="Assembly" /></div>
          <div className="articton-checklist"><p><CheckCircle2 /> Prepare standoffs</p><p><CheckCircle2 /> Align I/O shield</p><p className="is-current"><span /> Secure motherboard</p></div>
        </div>
        <HardwareDiagram />
        <div className="articton-workspace-panel p-4">
          <div className="flex items-center justify-between"><PanelLabel>Procedure guide</PanelLabel><span className="articton-ready">Ready</span></div>
          <div className="articton-guide-step"><span>Step 06</span><h3>Secure the board</h3><p>Tighten screws in a cross pattern. Stop when the board is secure—do not overtighten.</p></div>
          <div className="articton-safety"><b>Safety reminder</b><p>Keep the case grounded and handle the board by its edges.</p></div>
          <button type="button" className="articton-ai-button"><Bot className="h-4 w-4" /> Ask AI Guide</button>
        </div>
      </div>
      <div className="articton-workspace-footer flex flex-wrap items-center gap-2 px-4 py-3 text-xs"><span>Labels: On</span><span>Notes</span><span>Quick quiz</span><button type="button">Continue <ArrowRight className="h-3.5 w-3.5" /></button></div>
    </div>
  );
}

function HardwareDiagram() {
  return (
    <div className="articton-hardware-map articton-workspace-panel relative min-h-[260px] overflow-hidden p-4 sm:min-h-[300px]">
      <div className="flex items-center justify-between"><PanelLabel>Hardware map</PanelLabel><span className="text-[10px] font-bold uppercase tracking-widest text-[#FFD41C]">Guided view</span></div>
      <div className="articton-board absolute inset-x-[12%] bottom-[12%] top-[18%] rounded-xl">
        <div className="articton-io-shield"><i /><i /><i /></div>
        <div className="articton-vrm articton-vrm--top" />
        <div className="articton-vrm articton-vrm--left" />
        <div className="articton-cpu-socket"><Cpu className="h-8 w-8" /><span>CPU</span></div>
        <div className="articton-ram-slots"><i /><i /><i /><i /></div>
        <div className="articton-pcie"><i /><i /><i /></div>
        <div className="articton-audio"><i /><i /><i /><i /><i /></div>
        <span className="articton-map-label map-label--one">DDR slots</span><span className="articton-map-label map-label--two">PCIe x16</span><span className="articton-map-label map-label--three">Power</span>
      </div>
    </div>
  );
}

function PanelLabel({ children }) { return <p className="articton-panel-label">{children}</p>; }
function MiniStat({ label, value }) { return <div className="articton-mini-stat"><span>{label}</span><b>{value}</b></div>; }

function AmbientGlowLines() {
  return (
    <>
      <div className="articton-landing-scan absolute left-[15%] top-[10%] h-[60%] w-[2px] animate-pulse bg-[linear-gradient(180deg,transparent,#FFD41C,transparent)] opacity-40" />
      <div className="articton-landing-scan absolute right-[20%] top-[5%] h-[60%] w-[2px] animate-pulse bg-[linear-gradient(180deg,transparent,#FFD41C,transparent)] opacity-30" />
      <div className="articton-landing-scan absolute left-[60%] top-[15%] h-[60%] w-[2px] animate-pulse bg-[linear-gradient(180deg,transparent,#FFD41C,transparent)] opacity-30" />
    </>
  );
}

function AnimatedGridBackground() {
  return (
    <div className="articton-landing-grid absolute inset-0 opacity-100">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,212,28,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,212,28,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,14,23,0)_0%,rgba(10,14,23,0.15)_70%,rgba(10,14,23,0.8)_100%)]" />
    </div>
  );
}

function StatItem({ value, label }) {
  return (
    <div>
      <div className="font-mono text-3xl font-bold text-[#e8ecf4]">{value}</div>
      <div className="mt-1 text-sm text-[#4a5b78]">{label}</div>
    </div>
  );
}



function AboutPage({ onJoin }) {
  return (
    <section className="articton-landing-about relative min-h-screen overflow-hidden bg-[#0a0e17] pt-28">
      <AnimatedGridBackground />
      <AmbientGlowLines />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_50%_at_50%_20%,rgba(255,212,28,0.08),transparent)]" />

      <div className="relative z-10 px-6 py-12 text-center md:px-10 lg:px-16">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#FFD41C]/25 bg-[#FFD41C]/6 px-4 py-1.5">
          <span className="h-2 w-2 rounded-full bg-[#FFD41C]" />
          <span className="text-xs font-medium uppercase tracking-[0.25em] text-[#FFD41C]">
            About Articton
          </span>
        </div>

        <h2 className="mb-4 text-4xl font-bold text-[#e8ecf4] md:text-5xl">
          Learn Hardware the
          <span className="block text-[#FFD41C]">Immersive Way</span>
        </h2>

        <p className="mx-auto max-w-3xl text-base text-[#7a8ba8] md:text-lg">
          Articton helps students understand computer hardware through immersive
          3D interaction, guided procedures, and hands-on exploration.
        </p>
      </div>

      <div className="relative z-10">
        <TrustSectionDark />
        <FeaturesSectionDark />
        <ShowcaseSectionDark />
        <HowItWorksSectionDark />
        <SecondaryFeaturesSectionDark />
        <CTASectionDark onJoin={onJoin} />
      </div>
    </section>
  );
}

function SignupPage({ onBack, onSwitchToLogin, onAfterSignup }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [gender, setGender] = useState("");
  const [birthday, setBirthday] = useState("");
  const [program, setProgram] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(false);

  const validateEmail = (val) => /\S+@\S+\.\S+/.test(val);
  const genderOptions = ["Male", "Female", "Prefer not to say"];
  const programOptions = ["BS Computer Science", "BS IT-MWA"];

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }, []);

  const handleSignup = async (e) => {
    e.preventDefault();
    setErr("");

    if (!lastName.trim() || !firstName.trim()) {
      return setErr("Please enter your first and last name.");
    }
    if (!gender) return setErr("Please select your gender.");
    if (!birthday) return setErr("Please select your birthday.");
    if (birthday > todayStr) return setErr("Birthday cannot be in the future.");
    if (!program) return setErr("Please select a program.");
    if (!contactNumber.trim()) {
      return setErr("Please enter your contact number.");
    }
    if (!validateEmail(email)) return setErr("Please enter a valid email.");
    if (!password || password.length < 6) {
      return setErr("Password must be at least 6 characters.");
    }
    if (password !== confirmPassword) {
      return setErr("Passwords do not match.");
    }
    if (!agree) {
      return setErr("You must agree to the terms and conditions.");
    }

    try {
      setLoading(true);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        role: "student",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName.trim(),
        gender,
        birthday,
        program,
        contactNumber: contactNumber.trim(),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      await signOut(auth);
      setLoading(false);
      alert("Registration successful. Please sign in to continue.");
      onAfterSignup?.();
    } catch (error) {
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error("Failed to clean up signup session:", signOutError);
      }

      setLoading(false);

      if (error.code === "auth/email-already-in-use") {
        setErr("That email is already registered.");
      } else if (error.code === "auth/invalid-email") {
        setErr("Invalid email address.");
      } else if (error.code === "auth/weak-password") {
        setErr("Password should be at least 6 characters.");
      } else {
        setErr(error.message);
      }
    }
  };

  return (
    <section className="articton-auth-section relative min-h-screen overflow-hidden bg-[#0a0e17] pt-32 pb-12">
      <AnimatedGridBackground />
      <AmbientGlowLines />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_55%_45%_at_50%_18%,rgba(255,212,28,0.08),transparent)]" />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 md:px-10 lg:px-16">
        <div className="mb-10 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-[#7a8ba8] transition hover:bg-white/10 hover:text-white"
          >
            ← Back
          </button>

          <button
            onClick={onSwitchToLogin}
            className="rounded-lg border border-[#FFD41C]/25 bg-[#FFD41C]/8 px-4 py-2 text-sm text-[#FFD41C] transition hover:bg-[#FFD41C]/14"
          >
            Login
          </button>
        </div>

        <div className="articton-auth-card relative overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220]/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,212,28,0.06),transparent_40%)]" />
          <div className="relative">
            <div className="mb-8 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#FFD41C]/25 bg-[#FFD41C]/6 px-4 py-1.5">
                <span className="h-2 w-2 rounded-full bg-[#FFD41C]" />
                <span className="text-xs font-medium uppercase tracking-[0.25em] text-[#FFD41C]">
                  Student Access
                </span>
              </div>

              <h2 className="mb-2 text-3xl font-bold text-[#e8ecf4] md:text-4xl">
                Create Your Account
              </h2>
              <p className="text-[#7a8ba8]">
                Start learning PC hardware with guided 3D interaction.
              </p>
            </div>

            {err && (
              <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {err}
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-6">
              <div>
                <label className="mb-3 block text-sm font-medium text-[#9fb0c9]">
                  Student&apos;s Name
                </label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <InputBlockLight
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                  <InputBlockLight
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                  <InputBlockLight
                    placeholder="Middle Name"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#9fb0c9]">
                    Gender
                  </label>
                  <Dropdown
                    value={gender}
                    placeholder="Select Gender"
                    options={genderOptions}
                    onChange={setGender}
                  />
                </div>

                <div className="hidden md:block" />

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#9fb0c9]">
                    Birthday
                  </label>
                  <DatePickerLite
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    max={todayStr}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#9fb0c9]">
                    Program
                  </label>
                  <Dropdown
                    value={program}
                    placeholder="Select Program"
                    options={programOptions}
                    onChange={setProgram}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#9fb0c9]">
                    Contact Number
                  </label>
                  <InputBlockLight
                    placeholder="Enter Contact No."
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#9fb0c9]">
                    Email
                  </label>
                  <InputBlockLight
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#9fb0c9]">
                    Password
                  </label>
                  <InputBlockLight
                    placeholder="Input Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#9fb0c9]">
                    Confirm Password
                  </label>
                  <InputBlockLight
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    type="password"
                  />
                </div>
              </div>

              <div className="flex flex-col items-center justify-between gap-4 pt-4 md:flex-row">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    className="h-4 w-4 accent-[#FFD41C]"
                  />
                  <span className="text-sm text-[#7a8ba8]">
                    I agree to the terms and conditions
                  </span>
                </label>

                <button
                  disabled={loading}
                  className="rounded-xl bg-[#FFD41C] px-8 py-3 font-semibold text-[#0a0e17] transition hover:scale-[1.02] disabled:opacity-60"
                >
                  {loading ? "Signing up..." : "Sign Up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function LoginPage({ onBack, onSwitchToSignup, onSuccessLogin }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const DEV_BYPASS_LOGIN = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_LOGIN === "true";

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const handleDevBypass = async () => {
    try {
      setLoading(true);
      setErr("");

      const profile = {
        uid: "dev-user",
        email: "dev@example.com",
        firstName: "Dev",
        lastName: "User",
        role: "student",
      };

      setLoading(false);
      onSuccessLogin?.(profile);
    } catch (error) {
      setLoading(false);
      setErr(error.message);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr("");

    if (!email.trim() || !pass.trim()) {
      return setErr("Please enter your email and password.");
    }

    try {
      setLoading(true);

      const cleanEmail = email.trim().toLowerCase();

      const { user } = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      const profileSnapshot = await getDoc(doc(db, "users", user.uid));
      if (!profileSnapshot.exists()) {
        throw new Error("Your account profile could not be found. Contact an administrator.");
      }
      onSuccessLogin?.({ ...profileSnapshot.data(), uid: user.uid, email: user.email });
    } catch (error) {
      console.error("Login failed:", error.code, error.message);

      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error("Failed to clean up login session:", signOutError);
      }

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password"
      ) {
        setErr("Invalid email or password.");
      } else if (error.code === "auth/user-not-found") {
        setErr("No account found with that email.");
      } else if (error.code === "auth/too-many-requests") {
        setErr("Too many failed login attempts. Please wait a moment before trying again.");
      } else if (error.code === "auth/user-disabled") {
        setErr("This Firebase Authentication account is disabled.");
      } else if (error.code === "permission-denied") {
        setErr("Your password was accepted, but your account profile could not be accessed. Please contact an administrator.");
      } else if (error.code === "auth/network-request-failed" || error.code === "unavailable") {
        setErr("Could not connect. Check your internet connection and try again.");
      } else {
        setErr(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="articton-auth-section relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0e17] px-4 pt-24 pb-12 md:px-6">
      <AnimatedGridBackground />
      <AmbientGlowLines />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_55%_45%_at_50%_18%,rgba(255,212,28,0.08),transparent)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-[#7a8ba8] transition hover:bg-white/10 hover:text-white"
          >
            ← Back
          </button>

          <button
            onClick={onSwitchToSignup}
            className="rounded-lg border border-[#FFD41C]/25 bg-[#FFD41C]/8 px-4 py-2 text-sm text-[#FFD41C] transition hover:bg-[#FFD41C]/14"
          >
            Signup
          </button>
        </div>

        <div className="articton-auth-card relative overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220]/95 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,212,28,0.06),transparent_40%)]" />

          <div className="relative px-6 py-10 md:px-8">
            <div className="mb-6">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#FFD41C]/25 bg-[#FFD41C]/6 px-4 py-1.5">
                <span className="h-2 w-2 rounded-full bg-[#FFD41C]" />
                <span className="text-xs font-medium uppercase tracking-[0.25em] text-[#FFD41C]">
                  Login
                </span>
              </div>

              <h2 className="mb-1 text-2xl font-bold text-[#e8ecf4]">
                Welcome back
              </h2>
              <p className="text-sm text-[#7a8ba8]">
                Log in to continue learning in 3D.
              </p>
            </div>

            {err && (
              <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {err}
              </div>
            )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#9fb0c9]">
                    Email
                  </label>
                  <InputBlockLight
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    type="email"
                  />
                </div>

               <div>
                <label className="mb-2 block text-sm font-medium text-[#9fb0c9]">
                  Password
                </label>

                <InputBlockLight
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                />
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#FFD41C] px-6 py-3 font-semibold text-[#0a0e17] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Checking..." : "Log In"}
                </button>
              </div>

                {DEV_BYPASS_LOGIN && (
                  <button
                    type="button"
                    onClick={handleDevBypass}
                    className="w-full rounded-xl border border-[#FFD41C]/25 bg-[#FFD41C]/8 px-6 py-3 font-semibold text-[#FFD41C] transition hover:bg-[#FFD41C]/14"
                  >
                    Continue as Dev
                  </button>
                )}
              </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function InputBlockLight({ label, value, onChange, placeholder, type = "text" }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <label className="block">
      {label ? (
        <span className="text-[11px] tracking-widest text-[#7a8ba8]/75">
          {label}
        </span>
      ) : null}

      <div className="relative mt-2">
        <input
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          type={isPassword && show ? "text" : type}
          className="articton-field w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-sm text-[#e8ecf4] outline-none transition placeholder:text-[#7a8ba8]/45 focus:border-[#FFD41C]/30 focus:ring-2 focus:ring-[#FFD41C]/30"
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-[#7a8ba8] hover:text-[#e8ecf4]"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? "◉" : "◎"}
          </button>
        )}
      </div>
    </label>
  );
}

function DatePickerLite({ value, onChange, max }) {
  return (
    <input
      type="date"
      value={value}
      onChange={onChange}
      max={max}
      className="articton-field w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#e8ecf4] outline-none transition focus:border-[#FFD41C]/30 focus:ring-2 focus:ring-[#FFD41C]/30"
    />
  );
}

function Dropdown({ value, onChange, options, placeholder = "Select" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="articton-field flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#e8ecf4] outline-none transition hover:bg-white/10"
      >
        <span className={value ? "text-[#e8ecf4]" : "text-[#7a8ba8]/45"}>
          {value || placeholder}
        </span>
        <span className="text-[#7a8ba8]/70">▾</span>
      </button>

      {open && (
        <div className="articton-dropdown-menu absolute z-[80] mt-2 w-full overflow-hidden rounded-2xl border border-[#1a2438] bg-[#0d1220] shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <div className="max-h-60 overflow-auto py-2">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={[
                  "w-full px-4 py-2.5 text-left text-sm transition",
                  opt === value
                    ? "bg-[#FFD41C]/10 font-medium text-[#FFD41C]"
                    : "text-[#e8ecf4] hover:bg-white/5",
                ].join(" ")}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TrustSectionDark() {
  return (
    <section className="px-6 pb-6 pt-12 md:px-10 lg:px-16">
      <div className="articton-content-card overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_16px_42px_rgba(0,0,0,0.28)]">
        <div className="grid grid-cols-1 md:grid-cols-3">
          <TrustPillDark label="Learning Mode" value="Guided + Free Explore" />
          <TrustPillDark label="Content Style" value="Accurate + Visual" />
          <TrustPillDark label="Goal" value="Confidence in Hardware" />
        </div>
      </div>
    </section>
  );
}

function TrustPillDark({ label, value }) {
  return (
    <div className="border-[#1a2438] p-7 md:border-r md:p-8 md:last:border-r-0">
      <p className="mb-2 text-[11px] tracking-widest text-[#FFD41C]">{label}</p>
      <p className="text-xl font-semibold text-[#e8ecf4]">{value}</p>
    </div>
  );
}

function FeaturesSectionDark() {
  return (
    <section className="px-6 py-20 md:px-10 lg:px-16">
      <SectionHeaderDark title="Designed for Deep Hardware Understanding" />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <FeatureCardDark title="Interactive 3D Models" description="Inspect and learn." />
        <FeatureCardDark title="Guided Procedures" description="Step-by-step workflows." />
        <FeatureCardDark title="Component Explanations" description="Understand every part." />
      </div>
    </section>
  );
}

function ShowcaseSectionDark() {
  return (
    <section className="px-6 py-24 md:px-10 lg:px-16">
      <SectionHeaderDark title="A Learning Experience" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <FeatureCardDark title="Preview → Practice" description="Learn by doing." />
        <FeatureCardDark title="See the System Logic" description="Connections make sense." />
        <FeatureCardDark title="Learn the Sequence" description="Correct assembly order." />
      </div>
    </section>
  );
}

function HowItWorksSectionDark() {
  return (
    <section className="px-6 py-24 md:px-10 lg:px-16">
      <SectionHeaderDark title="How Articton Works" />
      <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
        <StepCardDark step="01" title="Select Hardware" description="Choose a system." />
        <StepCardDark step="02" title="Explore in 3D" description="Rotate and zoom." />
        <StepCardDark step="03" title="Assemble" description="Follow sequences." />
        <StepCardDark step="04" title="Assess" description="Check your knowledge." />
      </div>
    </section>
  );
}

function SecondaryFeaturesSectionDark() {
  return (
    <section className="px-6 py-20 md:px-10 lg:px-16">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <FeatureCardDark title="Self-Paced Learning" description="Anytime, anywhere." />
        <FeatureCardDark title="Quizzes" description="Instant feedback." />
      </div>
    </section>
  );
}

function CTASectionDark({ onJoin }) {
  return (
    <section className="px-6 py-24 text-center md:px-10 lg:px-16">
      <h3 className="mb-6 text-4xl font-bold text-[#e8ecf4] md:text-5xl">
        Experience Hardware Beyond Textbooks
      </h3>
      <p className="mb-10 text-base text-[#7a8ba8] md:text-lg">
        Bridge theory and practice with immersive 3D interaction.
      </p>
      <button
        onClick={onJoin}
        className="rounded-2xl bg-[#FFD41C] px-12 py-4 font-bold text-[#0a0e17] transition hover:scale-[1.02]"
      >
        Join Articton
      </button>
    </section>
  );
}

function SectionHeaderDark({ title }) {
  return (
    <div className="mb-14 text-center">
      <h3 className="text-3xl font-bold text-[#e8ecf4] md:text-4xl">{title}</h3>
    </div>
  );
}

function StepCardDark({ step, title, description }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="articton-content-card relative rounded-3xl border border-[#1a2438] bg-[#0d1220] p-8 shadow-[0_14px_34px_rgba(0,0,0,0.28)]"
    >
      <span className="absolute -top-4 left-6 rounded-full bg-[#FFD41C] px-4 py-1 text-sm font-bold text-[#0a0e17] shadow">
        {step}
      </span>
      <h4 className="mb-3 mt-4 text-xl font-semibold text-[#e8ecf4]">{title}</h4>
      <p className="text-sm text-[#7a8ba8]">{description}</p>
    </motion.div>
  );
}

function FeatureCardDark({ title, description }) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      className="articton-content-card h-full rounded-3xl border border-[#1a2438] bg-[#0d1220] p-8 shadow-[0_14px_34px_rgba(0,0,0,0.28)]"
    >
      <h4 className="mb-3 text-xl font-semibold text-[#e8ecf4]">{title}</h4>
      <p className="text-sm leading-relaxed text-[#7a8ba8]">{description}</p>
    </motion.div>
  );
}

function Footer({ dark = false }) {
  return (
    <footer
      className={[
        "articton-landing-footer border-t px-6 py-10 md:px-10 lg:px-16",
        dark
          ? "border-[#1a2438] bg-[#080c14] text-[#4a5b78]"
          : "border-[#d7dfe3] bg-white text-[#4d5b64]",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <div className="flex items-center gap-2">
          {dark ? <Cpu className="h-5 w-5 text-[#FFD41C]" /> : null}
          <span className={dark ? "font-bold tracking-tight text-[#e8ecf4]" : ""}>
            © 2026 Articton — 3D Computer Hardware Learning Platform
          </span>
        </div>
        {dark ? <p className="text-sm text-[#4a5b78]">Built for curious minds. Learn hardware the hands-on way.</p> : null}
      </div>
    </footer>
  );
}

function SectionHeader({ title }) {
  return (
    <div className="mb-14 text-center">
      <h3 className="text-3xl font-bold text-[#132029] md:text-4xl">{title}</h3>
    </div>
  );
}

function StepCard({ step, title, description }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative rounded-3xl border border-[#d5dfe3] bg-white p-8 shadow-[0_14px_34px_rgba(15,26,34,0.10)]"
    >
      <span className="absolute -top-4 left-6 rounded-full bg-[#3f83f8] px-4 py-1 text-sm font-bold text-white shadow">
        {step}
      </span>
      <h4 className="mt-4 mb-3 text-xl font-semibold text-[#132029]">{title}</h4>
      <p className="text-sm text-[#4c5d66]">{description}</p>
    </motion.div>
  );
}

function FeatureCard({ title, description }) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      className="h-full rounded-3xl border border-[#d5dfe3] bg-white p-8 shadow-[0_14px_34px_rgba(15,26,34,0.10)]"
    >
      <h4 className="mb-3 text-xl font-semibold text-[#132029]">{title}</h4>
      <p className="text-sm leading-relaxed text-[#4c5d66]">{description}</p>
    </motion.div>
  );
}
