import React, { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

/* ===========================
   ROOT PAGE
=========================== */
export default function ArtictonLandingPage() {
  return (
    <div className="min-h-screen bg-[#061E29] text-[#F3F4F4] font-sans antialiased">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <SecondaryFeaturesSection />
      <CTASection />
      <Footer />
    </div>
  );
}

/* ===========================
   NAVBAR
=========================== */
function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-0 z-50 w-full flex items-center justify-between px-12 py-5 bg-[#061E29]/80 backdrop-blur-lg border-b border-[#5F9598]/20"
      >
        <h1 className="text-2xl font-bold tracking-wide">Articton</h1>

        <div className="flex gap-8 text-sm text-[#F3F4F4]/80">
          <span className="cursor-pointer hover:text-white">Home</span>
          <span className="cursor-pointer hover:text-white">About</span>
          <span
            onClick={() => setOpen(true)}
            className="cursor-pointer hover:text-white"
          >
            Login
          </span>
          <span className="cursor-pointer hover:text-white">Signup</span>
        </div>
      </motion.nav>

      {open && <LoginModal onClose={() => setOpen(false)} />}
    </>
  );
}

/* ===========================
   HERO SECTION
=========================== */
function HeroSection() {
  return (
    <section className="relative px-12 pt-40 pb-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-[#061E29] via-[#061E29] to-[#1D546D]/30" />

      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        {/* LEFT */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <span className="inline-block mb-6 px-4 py-2 rounded-full bg-[#5F9598]/10 text-[#5F9598] text-xs tracking-widest">
            3D INTERACTIVE LEARNING PLATFORM
          </span>

          <h2 className="text-5xl lg:text-6xl font-extrabold leading-tight mb-8">
            Build, Disassemble, and Understand Computers in 3D
          </h2>

          <p className="text-[#F3F4F4]/70 max-w-xl mb-12 leading-relaxed">
            Articton delivers immersive 3D computer hardware simulations designed
            for students, educators, and future IT professionals.
          </p>

          <div className="flex gap-5">
            <button className="px-10 py-4 rounded-2xl bg-[#5F9598] text-[#061E29] font-semibold hover:bg-[#4b7f82] transition shadow-xl">
              Start Learning
            </button>
            <button className="px-10 py-4 rounded-2xl border border-[#5F9598]/60 text-[#5F9598] hover:bg-[#5F9598]/10 transition">
              View Features
            </button>
          </div>
        </motion.div>

        {/* RIGHT – 3D */}
        <div className="h-[420px] rounded-[32px] border border-[#5F9598]/25 shadow-2xl overflow-hidden">
          <Canvas
            camera={{ position: [2.5, 2, 2.5], fov: 45 }}
            style={{ background: "#061E29" }}
          >
            {/* LIGHTING */}
            <ambientLight intensity={1.5} />
            <directionalLight position={[5, 5, 5]} intensity={2} />
            <directionalLight position={[-5, -5, -5]} intensity={1} />

            {/* MODEL */}
            <Suspense fallback={<CanvasFallback />}>
              <HardwareModel />
            </Suspense>

            {/* CONTROLS */}
            <OrbitControls
              makeDefault
              enableDamping
              dampingFactor={0.1}
              rotateSpeed={0.6}
              zoomSpeed={0.6}
            />
          </Canvas>
        </div>
      </div>
    </section>
  );
}

/* ===========================
   FEATURES
=========================== */
function FeaturesSection() {
  return (
    <section className="px-12 py-28">
      <SectionHeader
        title="Designed for Deep Hardware Understanding"
        subtitle="Articton focuses on conceptual clarity, spatial reasoning, and procedural accuracy."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <FeatureCard
          title="Interactive 3D Models"
          description="Inspect and manipulate realistic hardware components."
        />
        <FeatureCard
          title="Guided Procedures"
          description="Step-by-step disassembly and assembly workflows."
        />
        <FeatureCard
          title="Component Explanations"
          description="Clear labels and contextual technical descriptions."
        />
      </div>
    </section>
  );
}

/* ===========================
   HOW IT WORKS
=========================== */
function HowItWorksSection() {
  return (
    <section className="px-12 py-28 bg-gradient-to-b from-[#1D546D]/30 to-transparent">
      <SectionHeader title="How Articton Works" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-10 max-w-6xl mx-auto">
        <StepCard step="01" title="Select Hardware" description="Choose a system or component." />
        <StepCard step="02" title="Explore in 3D" description="Interact using real-time visualization." />
        <StepCard step="03" title="Assemble & Disassemble" description="Follow correct technical sequences." />
        <StepCard step="04" title="Assess Knowledge" description="Reinforce learning through checks." />
      </div>
    </section>
  );
}

/* ===========================
   SECONDARY FEATURES
=========================== */
function SecondaryFeaturesSection() {
  return (
    <section className="px-12 py-24">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <FeatureCard title="Self-Paced Learning" description="Learn anytime on web or mobile." />
        <FeatureCard title="Assessments & Quizzes" description="Instant feedback and progress tracking." />
      </div>
    </section>
  );
}

/* ===========================
   CTA
=========================== */
function CTASection() {
  return (
    <section className="px-12 py-28 text-center">
      <h3 className="text-4xl font-bold mb-6">
        Experience Hardware Beyond Textbooks
      </h3>
      <p className="text-[#5F9598] mb-10 max-w-2xl mx-auto">
        Bridge theory and practice with immersive 3D interaction.
      </p>
      <button className="px-12 py-4 rounded-2xl bg-[#5F9598] text-[#061E29] font-bold hover:bg-[#4b7f82] transition shadow-xl">
        Join Articton
      </button>
    </section>
  );
}

/* ===========================
   FOOTER
=========================== */
function Footer() {
  return (
    <footer className="px-12 py-10 text-center text-sm text-[#F3F4F4]/60 border-t border-[#5F9598]/20">
      © 2026 Articton — 3D Computer Hardware Learning Platform
    </footer>
  );
}

/* ===========================
   LOGIN MODAL
=========================== */
function LoginModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#061E29] rounded-3xl p-10 w-full max-w-md border border-[#5F9598]/30 shadow-2xl"
      >
        <h3 className="text-2xl font-bold mb-6 text-center">Sign In</h3>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-3 rounded-xl bg-[#1D546D]/30 border border-[#5F9598]/30 text-white outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl bg-[#1D546D]/30 border border-[#5F9598]/30 text-white outline-none"
          />
          <button className="w-full py-3 rounded-xl bg-[#5F9598] text-[#061E29] font-bold hover:bg-[#4b7f82]">
            Login
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full text-sm text-[#F3F4F4]/60 hover:text-white"
        >
          Close
        </button>
      </motion.div>
    </div>
  );
}

/* ===========================
   SHARED
=========================== */
function SectionHeader({ title, subtitle }) {
  return (
    <div className="text-center mb-20">
      <h3 className="text-3xl font-bold mb-4">{title}</h3>
      {subtitle && (
        <p className="text-[#F3F4F4]/60 max-w-3xl mx-auto">{subtitle}</p>
      )}
    </div>
  );
}

function StepCard({ step, title, description }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative bg-[#061E29]/80 border border-[#5F9598]/25 rounded-3xl p-8 shadow-xl"
    >
      <span className="absolute -top-4 left-6 px-4 py-1 rounded-full bg-[#5F9598] text-[#061E29] text-sm font-bold">
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
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -6 }}
      className="bg-[#061E29]/80 border border-[#5F9598]/25 rounded-3xl p-8 shadow-xl"
    >
      <h4 className="text-xl font-semibold mb-4">{title}</h4>
      <p className="text-[#F3F4F4]/70 text-sm">{description}</p>
    </motion.div>
  );
}

/* ===========================
   3D MODEL
=========================== */
function HardwareModel() {
  const { scene } = useGLTF("/models/pc.glb");
  return <primitive object={scene} scale={1.2} />;
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
