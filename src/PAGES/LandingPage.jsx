import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Bounds } from "@react-three/drei";
import { auth, db } from "../firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase.js";






/* ===========================
   ROOT PAGE (UPDATED)
   - Auto-rotate toggle fixed
   - Signup + Login are FULL PAGES (no modal)
   - Signup/Login are NOT scrollable (locks body scroll)
   - ✅ Custom dropdown (palette-matched)
   - ✅ Date picker (no future dates)
=========================== */
export default function ArtictonLandingPage({ onLogin }) {
  
  const [activeSection, setActiveSection] = useState("home"); // "home" | "signup" | "login"

  const goHome = () => setActiveSection("home");
  const goSignup = () => setActiveSection("signup");
  const goLogin = () => setActiveSection("login");

  // ✅ Lock scroll on signup/login pages
  useEffect(() => {
    if (activeSection === "home") {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeSection]);

  const handleSuccessLogin = (profile) => {
    // propagate the fetched profile from LoginPage up to App
    onLogin?.(profile);
  };

  return (
    <div className="min-h-screen bg-[#061E29] text-[#F3F4F4] font-sans antialiased">
      <Navbar
  onHome={goHome}
  onOpenLogin={goLogin}
  onSignup={goSignup}
/>

      {activeSection === "home" ? (
        <>
          <HeroShowcaseFull onLogin={goLogin} onSignup={goSignup} />
          <TrustSection />
          <FeaturesSection />
          <ShowcaseSection />
          <HowItWorksSection />
          <SecondaryFeaturesSection />
          <CTASection onJoin={goSignup} />
          <Footer />
        </>
      ) : activeSection === "signup" ? (
        <>
          <SignupPage
            onBack={goHome}
            onSwitchToLogin={goLogin}
            onAfterSignup={() => goLogin()}
          />
          <Footer />
        </>
      ) : (
        <>
          <LoginPage
            onBack={goHome}
            onSwitchToSignup={goSignup}
            onSuccessLogin={handleSuccessLogin}
          />
          <Footer />
        </>
      )}
    </div>
  );
}

/* ===========================
   NAVBAR
=========================== */
function Navbar({ onHome, onOpenLogin, onSignup,  }) {
  return (
    <motion.nav
      initial={{ y: -18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 z-50 w-full flex items-center justify-between px-6 md:px-10 lg:px-16 py-5 bg-[#061E29]/75 backdrop-blur-xl border-b border-[#5F9598]/20"
    >
      <div className="flex items-center gap-3 cursor-pointer" onClick={onHome}>
  <img
    src="/PNG/Articton.png"
    alt="Articton Logo"
    className="h-10 w-10 scale-500 object-contain"
  />
  <h1 className="text-2xl font-bold tracking-wide">Articton</h1>
</div>


      <div className="flex gap-6 md:gap-8 text-sm text-[#F3F4F4]/80 items-center">
  <span onClick={onHome} className="cursor-pointer hover:text-white">
    Home
  </span>
  <span className="cursor-pointer hover:text-white">About</span>
  <span onClick={onOpenLogin} className="cursor-pointer hover:text-white">
    Login
  </span>
  <span onClick={onSignup} className="cursor-pointer hover:text-white">
    Signup
  </span>

</div>
    </motion.nav>
  );
}

/* ===========================
   HERO SHOWCASE (UPDATED ROTATION)
=========================== */
function HeroShowcaseFull({ onLogin, onSignup }) {
  const controlsRef = useRef(null);
  const [autoRotate, setAutoRotate] = useState(true);

  const defaultCamera = useMemo(
    () => ({
      position: [1.6, 1.0, 2.0],
      fov: 32,
    }),
    []
  );

  const handleResetView = () => {
    if (!controlsRef.current) return;
    controlsRef.current.object.position.set(...defaultCamera.position);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  }, []);

  return (
    <section className="relative min-h-screen pt-28 overflow-hidden flex items-center">
      <div className="absolute inset-0 bg-gradient-to-b from-[#061E29] via-[#061E29] to-[#0B2A3A]" />
      <div className="absolute -top-56 -left-56 h-[760px] w-[760px] rounded-full bg-[#5F9598]/12 blur-3xl" />
      <div className="absolute -bottom-80 -right-56 h-[800px] w-[800px] rounded-full bg-[#1D546D]/22 blur-3xl" />

      <div className="relative w-full px-6 md:px-10 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75 }}
          >
            <span className="inline-flex items-center gap-2 mb-6 px-5 py-2.5 rounded-full bg-[#5F9598]/10 text-[#5F9598] text-xs tracking-widest border border-[#5F9598]/20">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5F9598]" />
              3D HARDWARE LEARNING
            </span>

            <h2 className="text-5xl sm:text-6xl xl:text-7xl font-extrabold leading-[1.05] mb-6">
              Learn PC Hardware Like It’s{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5F9598] to-[#8ad1d4]">
                In Your Hands
              </span>
            </h2>

            <p className="text-[#F3F4F4]/70 text-base sm:text-lg xl:text-xl max-w-2xl mb-10 leading-relaxed">
              Rotate, zoom, and inspect a realistic system in 3D — then follow
              guided steps that build confidence.
            </p>

            <div className="flex flex-wrap gap-4 sm:gap-5 items-center">
              <button
                onClick={onLogin}
                className="px-10 sm:px-12 py-4 rounded-2xl bg-[#5F9598] text-[#061E29] font-semibold hover:bg-[#4b7f82] transition shadow-xl shadow-[#5F9598]/10"
              >
                Start Learning
              </button>
              <button
                onClick={onSignup}
                className="px-10 sm:px-12 py-4 rounded-2xl border border-[#5F9598]/60 text-[#5F9598] hover:bg-[#5F9598]/10 transition"
              >
                Create Account
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.06 }}
            className="relative"
          >
            <div className="relative w-full h-[520px] sm:h-[640px] lg:h-[760px] rounded-[44px] border border-[#5F9598]/25 overflow-hidden shadow-[0_70px_180px_rgba(0,0,0,0.70)]">
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-[#061E29] via-[#0B2A3A] to-[#1D546D]/42" />
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_65%_45%,rgba(95,149,152,0.26),transparent_58%)]" />
              <div className="absolute inset-0 pointer-events-none rounded-[44px] ring-1 ring-white/5" />

              <Canvas
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: true }}
                camera={{
                  position: defaultCamera.position,
                  fov: defaultCamera.fov,
                  near: 0.01,
                  far: 2000,
                }}
                style={{ background: "transparent" }}
              >
                <Suspense fallback={<CanvasFallback />}>
                  <ModelOnlyScene autoRotate={autoRotate} />
                </Suspense>

                <OrbitControls
                  ref={controlsRef}
                  makeDefault
                  enableDamping
                  dampingFactor={0.08}
                  rotateSpeed={0.75}
                  zoomSpeed={0.95}
                  enablePan={false}
                  minDistance={0.2}
                  maxDistance={20}
                />
              </Canvas>

              <div className="absolute top-6 left-6 flex items-center gap-2">
                <button
                  onClick={() => setAutoRotate((v) => !v)}
                  className="text-xs px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                >
                  Auto-rotate: {autoRotate ? "On" : "Off"}
                </button>

                <button
                  onClick={handleResetView}
                  className="text-xs px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                >
                  Reset view
                </button>
              </div>

              <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-[#F3F4F4]/60">
                Drag to rotate • Scroll to zoom
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ===========================
   SIGNUP PAGE (UPDATED)
   ✅ Custom dropdown (palette matched)
   ✅ Date picker (max=today, no future)
=========================== */
function SignupPage({ onBack, onSwitchToLogin, onAfterSignup }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");

  const [gender, setGender] = useState("");
  const [birthday, setBirthday] = useState(""); // ✅ YYYY-MM-DD


  const [program, setProgram] = useState("");

  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const validateEmail = (val) => /\S+@\S+\.\S+/.test(val);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [agree, setAgree] = useState(false);

 

  



  const genderOptions = ["Male", "Female", "Prefer not to say"];
  const programOptions = [
    "BS Computer Science",
    "BS IT-MWA ",
    
  ];

  const todayStr = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
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
    <section className="pt-28 px-6 md:px-10 lg:px-16">
      <div className="h-[calc(100vh-7rem)] flex items-center justify-center overflow-hidden">
        <div className="w-full max-w-6xl">
          <div className="flex items-center justify-between gap-4 mb-5">
            <button
              onClick={onBack}
              className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm text-[#F3F4F4]/85"
            >
              ← Back
            </button>

            <button
              onClick={onSwitchToLogin}
              className="px-5 py-3 rounded-2xl bg-[#5F9598] text-[#061E29] font-semibold hover:bg-[#4b7f82] transition text-sm"
            >
              Login
            </button>
          </div>

          <div className="relative h-[calc(100vh-12rem)] overflow-hidden rounded-[36px] border border-[#5F9598]/25 bg-[#0B2A3A]/55 backdrop-blur-xl shadow-[0_60px_160px_rgba(0,0,0,0.65)]">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_35%_35%,rgba(95,149,152,0.22),transparent_55%)]" />
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_75%_65%,rgba(29,84,109,0.28),transparent_60%)]" />

            <div className="relative px-6 md:px-12 py-8 h-full flex flex-col justify-center">
              <h2 className="text-center text-3xl md:text-5xl font-extrabold mb-6">
                Create Account as Student
              </h2>

              {err && (
                <div className="mb-4 rounded-2xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-[#F3F4F4] max-w-3xl mx-auto">
                  {err}
                </div>
              )}

              <form onSubmit={handleSignup} className="max-w-5xl mx-auto">
                {/* Name */}
                <div className="mb-5">
                  <p className="text-xs tracking-widest text-[#F3F4F4]/65 mb-2">
                    Student&apos;s Name
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InputLite
                      placeholder="Last Name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                    <InputLite
                      placeholder="First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                    <InputLite
                      placeholder="Middle Name"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Gender | Birthday (Date Picker) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
                  <div>
                    <p className="text-xs tracking-widest text-[#F3F4F4]/65 mb-2">
                      Gender
                    </p>
                    <Dropdown
                      value={gender}
                      placeholder="Select Gender"
                      options={genderOptions}
                      onChange={setGender}
                    />
                  </div>

                  <div className="hidden md:block" />

                  <div>
                    <p className="text-xs tracking-widest text-[#F3F4F4]/65 mb-2">
                      Birthday
                    </p>
                    <DatePickerLite
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      max={todayStr} // ✅ blocks future dates
                    />
                  </div>
                </div>

                {/* Dept | program | Contact | Email */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
                 

                  <div>
                    <p className="text-xs tracking-widest text-[#F3F4F4]/65 mb-2">
                      program
                    </p>
                    <Dropdown
                      value={program}
                      placeholder="Select program"
                      options={programOptions}
                      onChange={setProgram}
                    />
                  </div>

                  <div>
                    <p className="text-xs tracking-widest text-[#F3F4F4]/65 mb-2">
                      Contact Number
                    </p>
                    <InputLite
                      placeholder="Enter Contact No."
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                    />
                  </div>

                  <div>
                    <p className="text-xs tracking-widest text-[#F3F4F4]/65 mb-2">
                      Email
                    </p>
                    <InputLite
                      placeholder="Email Address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                    />
                  </div>
                </div>

                {/* Password | Confirm | Terms + Button */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                  <div>
                    <p className="text-xs tracking-widest text-[#F3F4F4]/65 mb-2">
                      Password
                    </p>
                    <InputLite
                      placeholder="Input Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                    />
                  </div>

                  <div>
                    <p className="text-xs tracking-widest text-[#F3F4F4]/65 mb-2">
                      Confirm Password
                    </p>
                    <InputLite
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      type="password"
                    />
                  </div>

                  <div className="md:col-span-2 flex flex-col md:flex-row items-center justify-between gap-4">
                    <label className="flex items-center gap-3 text-sm text-[#F3F4F4]/80">
                      <input
                        type="checkbox"
                        checked={agree}
                        onChange={(e) => setAgree(e.target.checked)}
                        className="h-4 w-4 accent-[#5F9598]"
                      />
                      I agree to the terms and conditions
                    </label>

                    <button
                      disabled={loading}
                      className="px-12 py-3 rounded-2xl bg-[#5F9598] text-[#061E29] font-extrabold hover:bg-[#4b7f82] transition shadow-xl shadow-[#5F9598]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {loading ? "Signing up..." : "Sign Up"}
                    </button>
                  </div>
                </div>
              </form>

              <div className="mt-4 text-xs text-[#F3F4F4]/55 text-center">
                Mock signup stores your data locally in this browser only.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===========================
   LOGIN PAGE (FULL PAGE)
=========================== */
function LoginPage({ onBack, onSwitchToSignup, onSuccessLogin }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");


  const [step, setStep] = useState("login"); // login | otp
const [otp, setOtp] = useState("");
const [generatedOtp, setGeneratedOtp] = useState("");

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

 

   const handleLogin = async (e) => {
  e.preventDefault();
  setErr("");

  if (!email.trim() || !pass.trim()) {
    return setErr("Please enter your email and password.");
  }
  console.log("📧 RAW EMAIL:", email);
  console.log("📧 TRIMMED EMAIL:", email.trim());
  console.log("📧 TYPE:", typeof email);

  try {
    setLoading(true);

    const userCredential = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      pass
    );

    const user = userCredential.user;

    const sendEmailOtp = httpsCallable(functions, "sendEmailOtp");

const cleanEmail = email.trim();

if (!cleanEmail) {
  setErr("Email is empty before sending OTP");
  return;
}

await sendEmailOtp({
  email: cleanEmail,
});

setStep("otp");
    setLoading(false);

  } catch (error) {
  console.error("LOGIN ERROR:", error); // 👈 ADD THIS
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
  console.error("OTP ERROR:", error); 
  return setErr(error.message || "Invalid OTP");
}


  try {
    setLoading(true);

    const user = auth.currentUser;

    let profile = null;
    const d = await getDoc(doc(db, "users", user.uid));
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
    <section className="pt-28 px-6 md:px-10 lg:px-16">
      <div className="h-[calc(100vh-7rem)] flex items-center justify-center overflow-hidden">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between gap-4 mb-5">
            <button
              onClick={onBack}
              className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm text-[#F3F4F4]/85"
            >
              ← Back
            </button>

            <button
              onClick={onSwitchToSignup}
              className="px-5 py-3 rounded-2xl border border-[#5F9598]/60 text-[#5F9598] hover:bg-[#5F9598]/10 transition text-sm"
            >
              Signup
            </button>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-[#5F9598]/25 bg-[#0B2A3A]/75 backdrop-blur-xl shadow-2xl">
            <div className="p-7 border-b border-white/10">
              <h3 className="text-2xl font-bold">Welcome back</h3>
              <p className="text-sm text-[#F3F4F4]/60 mt-1">
                Log in to continue learning in 3D.
              </p>
            </div>

            <div className="p-7">
              {err && (
                <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-[#F3F4F4]/90">
                  {err}
                </div>
              )}

              {step === "login" ? (
  <form onSubmit={handleLogin} className="space-y-4">
    <InputBlock
      label="Email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder="you@example.com"
      type="email"
    />
    <InputBlock
      label="Password"
      value={pass}
      onChange={(e) => setPass(e.target.value)}
      placeholder="••••••••"
      type="password"
    />

    <button
      disabled={loading}
      className="w-full mt-2 px-6 py-3.5 rounded-2xl bg-[#5F9598] text-[#061E29] font-bold"
    >
      {loading ? "Checking..." : "Continue"}
    </button>
  </form>
) : (
  <form onSubmit={handleVerifyOtp} className="space-y-4">
    <InputBlock
      label="Enter OTP"
      value={otp}
      onChange={(e) => setOtp(e.target.value)}
      placeholder="6-digit code"
    />

    <button
      disabled={loading}
      className="w-full mt-2 px-6 py-3.5 rounded-2xl bg-[#5F9598] text-[#061E29] font-bold"
    >
      {loading ? "Verifying..." : "Verify OTP"}
    </button>
  </form>
)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===========================
   INPUTS (base)
=========================== */
function InputLite({ value, onChange, placeholder, type = "text" }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="relative">
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={isPassword && show ? "text" : type}
        className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-[#F3F4F4] 
                   placeholder:text-[#F3F4F4]/35 outline-none focus:ring-2 focus:ring-[#5F9598]/50 
                   focus:border-[#5F9598]/30 transition text-sm pr-10"
      />

      {isPassword && (
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white focus:outline-none 
                     flex items-center justify-center h-6 w-6"
        >
          {show ? (
            // 👁 Visible eye
            <svg
             xmlns="[w3.org](http://www.w3.org/2000/svg)"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.458 12C3.732 7.943 7.523 5 
                   12 5c4.478 0 8.268 2.943 9.542 7
                   -1.274 4.057-5.064 7-9.542 7
                   -4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          ) : (
            // 🙈 Crossed Out eye
            <svg
              xmlns="[w3.org](http://www.w3.org/2000/svg)"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.98 8.223A10.477 10.477 0 001.934 12
                  C3.226 16.114 7.244 19 12 19
                  c1.474 0 2.87-.254 4.138-.717M21.166 15.803
                  A10.45 10.45 0 0022.066 12
                  C20.774 7.886 16.756 5 12 5
                  a9.967 9.967 0 00-2.652.353"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3l18 18"
              />
            </svg>

          )}
        </button>
      )}
    </div>
  );
}



function InputBlock({ label, value, onChange, placeholder, type = "text" }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <label className="block">
      <span className="text-[11px] tracking-widest text-[#F3F4F4]/55">
        {label}
      </span>

      {/* wrap input and button together */}
      <div className="relative mt-2">
        <input
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          type={isPassword && show ? "text" : type}
          className="w-full px-4 py-3 pr-10 rounded-2xl bg-white/5 border border-white/10
                     text-[#F3F4F4] placeholder:text-[#F3F4F4]/35 outline-none
                     focus:ring-2 focus:ring-[#5F9598]/50 focus:border-[#5F9598]/30
                     transition text-sm"
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2
                       flex items-center justify-center
                       text-white/70 hover:text-white focus:outline-none
                       h-6 w-6"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? (
              // 👁 visible eye
              <svg
                xmlns="[w3.org](http://www.w3.org/2000/svg)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.458 12C3.732 7.943 7.523 5
                     12 5c4.478 0 8.268 2.943 9.542 7
                     -1.274 4.057-5.064 7-9.542 7
                     -4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            ) : (
              // 🙈 crossed eye
              <svg
                xmlns="[w3.org](http://www.w3.org/2000/svg)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.98 8.223A10.477 10.477 0 001.934 12
                    C3.226 16.114 7.244 19 12 19
                    c1.474 0 2.87-.254 4.138-.717M21.166 15.803
                    A10.45 10.45 0 0022.066 12
                    C20.774 7.886 16.756 5 12 5
                    a9.967 9.967 0 00-2.652.353"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 3l18 18"
                />
              </svg>

            )}
          </button>
        )}
      </div>
    </label>
  );
}



/* ===========================
   ✅ DATE PICKER (No future dates)
   - Uses native input[type=date]
   - max={today} blocks future selection
=========================== */
function DatePickerLite({ value, onChange, max }) {
  return (
    <input
      type="date"
      value={value}
      onChange={onChange}
      max={max}
      className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-[#F3F4F4] outline-none focus:ring-2 focus:ring-[#5F9598]/50 focus:border-[#5F9598]/30 transition text-sm"
    />
  );
}

/* ===========================
   ✅ CUSTOM DROPDOWN (Palette-matched)
   - Avoids ugly native <select> white dropdown
   - Fully styled with your theme
=========================== */
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
        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-[#F3F4F4] outline-none hover:bg-white/10 transition text-sm"
      >
        <span className={value ? "text-[#F3F4F4]" : "text-[#F3F4F4]/45"}>
          {value || placeholder}
        </span>
        <span className="text-[#F3F4F4]/70">▾</span>
      </button>

      {open && (
        <div className="absolute z-[80] mt-2 w-full rounded-2xl border border-[#5F9598]/25 bg-[#061E29]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="py-2 max-h-60 overflow-auto">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={[
                  "w-full text-left px-4 py-2.5 text-sm transition",
                  opt === value
                    ? "bg-[#5F9598]/20 text-[#F3F4F4]"
                    : "text-[#F3F4F4]/85 hover:bg-white/5",
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

/* ===========================
   3D SCENE
=========================== */
function ModelOnlyScene({ autoRotate }) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[6, 7, 5]} intensity={2.25} />
      <directionalLight position={[-6, 3.5, -4]} intensity={0.9} />
      <directionalLight position={[0, 4, -8]} intensity={0.8} />

      <Bounds fit clip margin={1.2}>
        <AutoRotateGroup enabled={autoRotate} speed={0.35}>
          <group position={[0, -0.05, 0]} rotation={[0.05, -0.55, 0]}>
            <HardwareModel />
          </group>
        </AutoRotateGroup>
      </Bounds>
    </>
  );
}

function AutoRotateGroup({ children, enabled, speed = 0.35 }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (!ref.current || !enabled) return;
    ref.current.rotation.y += delta * speed;
  });
  return <group ref={ref}>{children}</group>;
}

/* ===========================
   SECTIONS (placeholders)
=========================== */
function TrustSection() {
  return (
    <section className="px-6 md:px-10 lg:px-16 pt-12 pb-6">
      <div className="rounded-[28px] border border-[#5F9598]/20 bg-white/5 backdrop-blur-xl shadow-lg overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3">
          <TrustPill label="Learning Mode" value="Guided + Free Explore" />
          <TrustPill label="Content Style" value="Accurate + Visual" />
          <TrustPill label="Goal" value="Confidence in Hardware" />
        </div>
      </div>
    </section>
  );
}
function TrustPill({ label, value }) {
  return (
    <div className="p-7 md:p-8 border-b md:border-b-0 md:border-r last:md:border-r-0 border-white/10">
      <p className="text-[11px] tracking-widest text-[#F3F4F4]/55 mb-2">
        {label}
      </p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
function FeaturesSection() {
  return (
    <section className="px-6 md:px-10 lg:px-16 py-20">
      <SectionHeader title="Designed for Deep Hardware Understanding" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <FeatureCard title="Interactive 3D Models" description="Inspect and learn." />
        <FeatureCard title="Guided Procedures" description="Step-by-step workflows." />
        <FeatureCard title="Component Explanations" description="Understand every part." />
      </div>
    </section>
  );
}
function ShowcaseSection() {
  return (
    <section className="px-6 md:px-10 lg:px-16 py-24 bg-gradient-to-b from-[#1D546D]/25 to-transparent">
      <SectionHeader title="A Learning Experience" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <FeatureCard title="Preview → Practice" description="Learn by doing." />
        <FeatureCard title="See the System Logic" description="Connections make sense." />
        <FeatureCard title="Learn the Sequence" description="Correct assembly order." />
      </div>
    </section>
  );
}
function HowItWorksSection() {
  return (
    <section className="px-6 md:px-10 lg:px-16 py-24">
      <SectionHeader title="How Articton Works" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
        <StepCard step="01" title="Select Hardware" description="Choose a system." />
        <StepCard step="02" title="Explore in 3D" description="Rotate and zoom." />
        <StepCard step="03" title="Assemble" description="Follow sequences." />
        <StepCard step="04" title="Assess" description="Check your knowledge." />
      </div>
    </section>
  );
}
function SecondaryFeaturesSection() {
  return (
    <section className="px-6 md:px-10 lg:px-16 py-20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <FeatureCard title="Self-Paced Learning" description="Anytime, anywhere." />
        <FeatureCard title="Quizzes" description="Instant feedback." />
      </div>
    </section>
  );
}
function CTASection({ onJoin }) {
  return (
    <section className="px-6 md:px-10 lg:px-16 py-24 text-center">
      <h3 className="text-4xl md:text-5xl font-bold mb-6">
        Experience Hardware Beyond Textbooks
      </h3>
      <p className="text-[#5F9598] mb-10 text-base md:text-lg">
        Bridge theory and practice with immersive 3D interaction.
      </p>
      <button
        onClick={onJoin}
        className="px-12 py-4 rounded-2xl bg-[#5F9598] text-[#061E29] font-bold hover:bg-[#4b7f82] transition shadow-xl shadow-[#5F9598]/10"
      >
        Join Articton
      </button>
    </section>
  );
}
function Footer() {
  return (
    <footer className="px-6 md:px-10 lg:px-16 py-10 text-center text-sm text-[#F3F4F4]/60 border-t border-[#5F9598]/20">
      © 2026 Articton — 3D Computer Hardware Learning Platform
    </footer>
  );
}
function SectionHeader({ title }) {
  return (
    <div className="text-center mb-14">
      <h3 className="text-3xl md:text-4xl font-bold mb-4">{title}</h3>
    </div>
  );
}
function StepCard({ step, title, description }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative bg-[#061E29]/70 border border-[#5F9598]/20 rounded-3xl p-8 shadow-xl backdrop-blur-xl"
    >
      <span className="absolute -top-4 left-6 px-4 py-1 rounded-full bg-[#5F9598] text-[#061E29] text-sm font-bold shadow">
        {step}
      </span>
      <h4 className="text-xl font-semibold mt-4 mb-3">{title}</h4>
      <p className="text-[#F3F4F4]/70 text-sm">{description}</p>
    </motion.div>
  );
}
function FeatureCard({ title, description }) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      className="bg-[#061E29]/70 border border-[#5F9598]/20 rounded-3xl p-8 shadow-xl backdrop-blur-xl h-full"
    >
      <h4 className="text-xl font-semibold mb-3">{title}</h4>
      <p className="text-[#F3F4F4]/70 text-sm leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}

/* ===========================
   3D MODEL
=========================== */
function HardwareModel() {
  const { scene } = useGLTF("/models/pc.glb");
  return <primitive object={scene} />;
}
useGLTF.preload("/models/pc.glb");

/* ===========================
   CANVAS FALLBACK
=========================== */
function CanvasFallback() {
  return (
    <mesh>
      <ambientLight intensity={1} />
    </mesh>
  );
}
