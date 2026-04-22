import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Bounds, Grid } from "@react-three/drei";
import { Cpu, GraduationCap, MousePointerClick, Rotate3d } from "lucide-react";
import { auth, db, functions } from "../firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

export default function ArtictonLandingPage({ onLogin }) {
  const [activeSection, setActiveSection] = useState("home");

  const isLightPage = false;

  useEffect(() => {
    const shouldLockScroll =
      activeSection === "signup" || activeSection === "login";

    document.body.style.overflow = shouldLockScroll ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeSection]);

  const handleSuccessLogin = (profile) => {
    onLogin?.(profile);
  };

  return (
    <div
      className={[
        "min-h-screen font-[Outfit] antialiased",
        isLightPage ? "bg-[#f8fafb] text-[#0f1a22]" : "bg-[#0a0e17] text-[#e8ecf4]",
      ].join(" ")}
    >
      <Navbar
        isHome={activeSection === "home"}
        onHome={() => setActiveSection("home")}
        onAbout={() => setActiveSection("about")}
        onOpenLogin={() => setActiveSection("login")}
        onSignup={() => setActiveSection("signup")}
      />

      {activeSection === "home" ? (
        <>
          <HeroShowcaseFull
            onLogin={() => setActiveSection("login")}
            onSignup={() => setActiveSection("signup")}
            
          />
         
          <Footer dark />
        </>
      ) : activeSection === "about" ? (
        <>
          <AboutPage onJoin={() => setActiveSection("signup")} />
          <Footer dark />
        </>
      ) : activeSection === "signup" ? (
        <>
          <SignupPage
            onBack={() => setActiveSection("home")}
            onSwitchToLogin={() => setActiveSection("login")}
            onAfterSignup={() => setActiveSection("login")}
          />
          <Footer dark />
        </>
      ) : (
        <>
          <LoginPage
            onBack={() => setActiveSection("home")}
            onSwitchToSignup={() => setActiveSection("signup")}
            onSuccessLogin={handleSuccessLogin}
          />
          <Footer dark />
        </>
      )}
    </div>
  );
}

function Navbar({ isHome, onHome, onAbout, onOpenLogin, onSignup }) {
  return (
    <motion.nav
      initial={{ y: -18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={[
        "fixed top-0 z-50 w-full flex items-center justify-between px-6 md:px-10 lg:px-16 py-5 border-b backdrop-blur-xl",
        isHome
          ? "bg-[#0a0e17]/80 border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
          : "bg-[#071E29]/92 border-white/10 shadow-[0_10px_30px_rgba(7,30,41,0.22)]",
      ].join(" ")}
    >
      <button className="flex items-center gap-3" onClick={onHome}>
        <img
          src="/PNG/Articton.png"
          alt="Articton Logo"
          className="h-10 w-10 scale-500 object-contain"
        />
        <h1 className="text-2xl font-bold tracking-wide text-white">Articton</h1>
      </button>

      <div className="flex gap-6 md:gap-8 text-sm text-white/80 items-center">
        <button onClick={onHome} className="hover:text-white transition">Home</button>
        <button onClick={onAbout} className="hover:text-white transition">About</button>
        <button onClick={onOpenLogin} className="hover:text-white transition">Login</button>
        <button
          onClick={onSignup}
          className="rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/8 px-4 py-2 text-[#00ffb4] hover:bg-[#00ffb4]/14 transition"
        >
          Signup
        </button>
      </div>
    </motion.nav>
  );
}

function HeroShowcaseFull({ onLogin, onSignup }) {
  const controlsRef = useRef(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const defaultCamera = useMemo(
    () => ({
      position: [1.6, 1.0, 2.0],
      fov: 32,
    }),
    []
  );

  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      setMouse({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.object.position.set(...defaultCamera.position);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
    controlsRef.current.saveState();
  }, [defaultCamera]);


  
  return (
  <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0a0e17] px-6 pt-28 pb-16">
    <style>{`
      @keyframes greenWaveFlow {
        0% {
          transform: translateY(-160%);
          opacity: 0;
        }
        15% {
          opacity: 0.12;
        }
        45% {
          opacity: 0.22;
        }
        85% {
          opacity: 0.12;
        }
        100% {
          transform: translateY(110vh);
          opacity: 0;
        }
      }
    `}</style>

    <AnimatedGridBackground />
    <AmbientGlowLines />

    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[0].map((delay, i) => (
        <div
          key={i}
          className="absolute left-0 w-full"
          style={{
            top: "-80px",
            height: "200px",
            background:
              "linear-gradient(180deg, transparent 0%, rgba(0,255,180,0.10) 45%, rgba(0,255,180,0.16) 50%, rgba(0,255,180,0.10) 55%, transparent 100%)",
            animation: "greenWaveFlow 5.5s linear infinite",
            animationDelay: `${delay}s`,
            filter: "blur(10px)",
          }}
        />
      ))}
    </div>
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(0,255,180,0.08),transparent)]" />
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/6 px-4 py-1.5"
          >
            <span className="h-2 w-2 rounded-full bg-[#00ffb4]" />
            <span className="text-xs font-medium uppercase tracking-[0.25em] text-[#00ffb4]">
              Interactive 3D Experience
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl font-black leading-[1.02] tracking-tight text-[#e8ecf4] sm:text-6xl lg:text-7xl"
          >
            Learn PC Hardware.
            <br />
            <span className="text-[#00ffb4]">Build Confidence in 3D.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12 }}
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#7a8ba8] lg:mx-0 sm:text-xl"
          >
            Rotate, inspect, and understand each PC component in an immersive 3D
            workspace designed for guided learning and hands-on exploration.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.24 }}
            className="mt-10 flex flex-col justify-center gap-4 sm:flex-row lg:justify-start"
          >
            <button
              onClick={onLogin}
              className="group relative overflow-hidden rounded-xl bg-[#00ffb4] px-8 py-4 text-lg font-semibold tracking-wide text-[#0a0e17] transition hover:scale-[1.02]"
            >
              <span className="absolute inset-0 -translate-x-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)] transition duration-500 group-hover:translate-x-full" />
              <span className="relative">Start Learning →</span>
            </button>
            <button
              onClick={onSignup}
              className="rounded-xl border border-white/12 px-8 py-4 text-lg font-semibold text-[#7a8ba8] transition hover:bg-white/5 hover:text-white"
            >
              Create Account
            </button>
          </motion.div>

        
        </div>

       <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.18 }}
            className="relative flex justify-center lg:justify-end lg:pl-10 xl:pl-28"
          >
          <div className="absolute right-[-90px] top-1/2 h-[700px] w-[620px] -translate-y-1/2 rounded-[120px] bg-[radial-gradient(circle_at_center,rgba(0,255,180,0.18),transparent_70%)] blur-3xl" />
          <div className="relative h-[460px] w-full max-w-[760px] sm:h-[540px] lg:h-[640px] xl:h-[700px]">
            
            <div className="absolute inset-0 z-10">
              <Canvas
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: true }}
                camera={{ position: [0.95, 0.72, 1.2] }}
                style={{ background: "transparent" }}
              >
                <Suspense fallback={<CanvasFallback />}>
                  <ModelOnlyScene mouse={mouse} />
                </Suspense>
                <OrbitControls
                  ref={controlsRef}
                  makeDefault
                  enableDamping
                  dampingFactor={0.08}
                  rotateSpeed={0.75}
                enableZoom={false}
                  enableRotate={false}
                  enablePan={false}
                  minDistance={0.2}
                  maxDistance={20}
                />
              </Canvas>
            </div>
            
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function AmbientGlowLines() {
  return (
    <>
      <div className="absolute left-[15%] top-[10%] h-[60%] w-[2px] animate-pulse bg-[linear-gradient(180deg,transparent,#00ffb4,transparent)] opacity-40" />
      <div className="absolute right-[20%] top-[5%] h-[60%] w-[2px] animate-pulse bg-[linear-gradient(180deg,transparent,#00b4ff,transparent)] opacity-30" />
      <div className="absolute left-[60%] top-[15%] h-[60%] w-[2px] animate-pulse bg-[linear-gradient(180deg,transparent,#00ffb4,transparent)] opacity-30" />
    </>
  );
}

function AnimatedGridBackground() {
  return (
    <div className="absolute inset-0 opacity-100">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,180,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,180,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
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
    <section className="relative min-h-screen overflow-hidden bg-[#0a0e17] pt-28">
      <AnimatedGridBackground />
      <AmbientGlowLines />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_50%_at_50%_20%,rgba(0,255,180,0.08),transparent)]" />

      <div className="relative z-10 px-6 py-12 text-center md:px-10 lg:px-16">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/6 px-4 py-1.5">
          <span className="h-2 w-2 rounded-full bg-[#00ffb4]" />
          <span className="text-xs font-medium uppercase tracking-[0.25em] text-[#00ffb4]">
            About Articton
          </span>
        </div>

        <h2 className="mb-4 text-4xl font-bold text-[#e8ecf4] md:text-5xl">
          Learn Hardware the
          <span className="block text-[#00ffb4]">Immersive Way</span>
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
        createdAt: new Date().toISOString(),
      });

      setLoading(false);
      onAfterSignup?.();
    } catch (error) {
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
    <section className="relative min-h-screen overflow-hidden bg-[#0a0e17] pt-32 pb-12">
      <AnimatedGridBackground />
      <AmbientGlowLines />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_55%_45%_at_50%_18%,rgba(0,255,180,0.08),transparent)]" />

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
            className="rounded-lg border border-[#00ffb4]/25 bg-[#00ffb4]/8 px-4 py-2 text-sm text-[#00ffb4] transition hover:bg-[#00ffb4]/14"
          >
            Login
          </button>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220]/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,180,0.06),transparent_40%)]" />
          <div className="relative">
            <div className="mb-8 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/6 px-4 py-1.5">
                <span className="h-2 w-2 rounded-full bg-[#00ffb4]" />
                <span className="text-xs font-medium uppercase tracking-[0.25em] text-[#00ffb4]">
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
                    className="h-4 w-4 accent-[#00ffb4]"
                  />
                  <span className="text-sm text-[#7a8ba8]">
                    I agree to the terms and conditions
                  </span>
                </label>

                <button
                  disabled={loading}
                  className="rounded-xl bg-[#00ffb4] px-8 py-3 font-semibold text-[#0a0e17] transition hover:scale-[1.02] disabled:opacity-60"
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
  const DEV_BYPASS_LOGIN = import.meta.env.VITE_DEV_BYPASS_LOGIN === "true";

  const [step, setStep] = useState("login");
  const [otp, setOtp] = useState("");
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

      await signInWithEmailAndPassword(auth, email.trim(), pass);

      const sendEmailOtp = httpsCallable(functions, "sendEmailOtp");
      const cleanEmail = email.trim();

      if (!cleanEmail) {
        setLoading(false);
        return setErr("Email is empty before sending OTP");
      }

      await sendEmailOtp({ email: cleanEmail });

      setStep("otp");
      setLoading(false);
    } catch (error) {
      setLoading(false);

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        setErr("Invalid email or password.");
      } else {
        setErr(error.message);
      }
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    const verifyEmailOtp = httpsCallable(functions, "verifyEmailOtp");

    try {
      await verifyEmailOtp({ email: email.trim(), otp });
    } catch (error) {
      return setErr(error.message || "Invalid OTP");
    }

    try {
      setLoading(true);

      const user = auth.currentUser;
      const d = await getDoc(doc(db, "users", user.uid));

      let profile = null;
      if (d.exists()) profile = d.data();
      else profile = { uid: user.uid, email: user.email };

      setLoading(false);
      onSuccessLogin?.(profile);
    } catch (error) {
      setLoading(false);
      setErr(error.message);
    }
  };

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0e17] px-4 pt-24 pb-12 md:px-6">
      <AnimatedGridBackground />
      <AmbientGlowLines />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_55%_45%_at_50%_18%,rgba(0,255,180,0.08),transparent)]" />

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
            className="rounded-lg border border-[#00ffb4]/25 bg-[#00ffb4]/8 px-4 py-2 text-sm text-[#00ffb4] transition hover:bg-[#00ffb4]/14"
          >
            Signup
          </button>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220]/95 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,180,0.06),transparent_40%)]" />

          <div className="relative px-6 py-10 md:px-8">
            <div className="mb-6">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#00ffb4]/25 bg-[#00ffb4]/6 px-4 py-1.5">
                <span className="h-2 w-2 rounded-full bg-[#00ffb4]" />
                <span className="text-xs font-medium uppercase tracking-[0.25em] text-[#00ffb4]">
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

            {step === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
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

                <button
                  disabled={loading}
                  className="w-full rounded-xl bg-[#00ffb4] px-6 py-3 font-semibold text-[#0a0e17] transition hover:scale-[1.01] disabled:opacity-60"
                >
                  {loading ? "Checking..." : "Continue"}
                </button>

                {DEV_BYPASS_LOGIN && (
                  <button
                    type="button"
                    onClick={handleDevBypass}
                    className="w-full rounded-xl border border-[#00ffb4]/25 bg-[#00ffb4]/8 px-6 py-3 font-semibold text-[#00ffb4] transition hover:bg-[#00ffb4]/14"
                  >
                    Continue as Dev
                  </button>
                )}
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#9fb0c9]">
                    Enter OTP
                  </label>
                  <InputBlockLight
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="6-digit code"
                  />
                </div>

                <button
                  disabled={loading}
                  className="w-full rounded-xl bg-[#00ffb4] px-6 py-3 font-semibold text-[#0a0e17] transition hover:scale-[1.01] disabled:opacity-60"
                >
                  {loading ? "Verifying..." : "Verify OTP"}
                </button>
              </form>
            )}
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
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-sm text-[#e8ecf4] outline-none transition placeholder:text-[#7a8ba8]/45 focus:border-[#00ffb4]/30 focus:ring-2 focus:ring-[#00ffb4]/30"
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
      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#e8ecf4] outline-none transition focus:border-[#00ffb4]/30 focus:ring-2 focus:ring-[#00ffb4]/30"
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
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#e8ecf4] outline-none transition hover:bg-white/10"
      >
        <span className={value ? "text-[#e8ecf4]" : "text-[#7a8ba8]/45"}>
          {value || placeholder}
        </span>
        <span className="text-[#7a8ba8]/70">▾</span>
      </button>

      {open && (
        <div className="absolute z-[80] mt-2 w-full overflow-hidden rounded-2xl border border-[#1a2438] bg-[#0d1220] shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
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
                    ? "bg-[#00ffb4]/10 font-medium text-[#00ffb4]"
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

function ModelOnlyScene({ mouse }) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[6, 7, 5]} intensity={2.25} />
      <directionalLight position={[-6, 3.5, -4]} intensity={0.9} />
      <directionalLight position={[0, 4, -8]} intensity={0.8} />
      <Bounds fit clip margin={1.2}>
        <MouseFollowModel mouse={mouse} />
      </Bounds>
    </>
  );
}

function MouseFollowModel({ mouse }) {
  const groupRef = useRef();

  useFrame(() => {
    if (!groupRef.current) return;
    const targetX = mouse.x * 3;
    const targetY = -mouse.y * 1.5;
    const targetZ = 2;
    groupRef.current.lookAt(targetX, targetY, targetZ);
  });

  return (
    <group ref={groupRef} position={[0, -0.05, 0]}>
      <HardwareModel />
    </group>
  );
}

function HardwareModel() {
  const { scene } = useGLTF("/models/pc.glb");
  return <primitive object={scene} />;
}
useGLTF.preload("/models/pc.glb");

function CanvasFallback() {
  return (
    <mesh>
      <ambientLight intensity={1} />
    </mesh>
  );
}

function TrustSectionDark() {
  return (
    <section className="px-6 pb-6 pt-12 md:px-10 lg:px-16">
      <div className="overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_16px_42px_rgba(0,0,0,0.28)]">
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
      <p className="mb-2 text-[11px] tracking-widest text-[#00ffb4]">{label}</p>
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
        className="rounded-2xl bg-[#00ffb4] px-12 py-4 font-bold text-[#0a0e17] transition hover:scale-[1.02]"
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
      className="relative rounded-3xl border border-[#1a2438] bg-[#0d1220] p-8 shadow-[0_14px_34px_rgba(0,0,0,0.28)]"
    >
      <span className="absolute -top-4 left-6 rounded-full bg-[#00ffb4] px-4 py-1 text-sm font-bold text-[#0a0e17] shadow">
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
      className="h-full rounded-3xl border border-[#1a2438] bg-[#0d1220] p-8 shadow-[0_14px_34px_rgba(0,0,0,0.28)]"
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
        "border-t px-6 py-10 md:px-10 lg:px-16",
        dark
          ? "border-[#1a2438] bg-[#080c14] text-[#4a5b78]"
          : "border-[#d7dfe3] bg-white text-[#4d5b64]",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <div className="flex items-center gap-2">
          {dark ? <Cpu className="h-5 w-5 text-[#00ffb4]" /> : null}
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
