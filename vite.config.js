import { defineConfig, loadEnv } from "vite";
import process from "node:process";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (mode === "spark") {
    const projectId = String(env.VITE_FIREBASE_PROJECT_ID || "").trim();
    if (!projectId || projectId === "articton-57fd8" || projectId === "demo-articton") {
      throw new Error("Spark builds require VITE_FIREBASE_PROJECT_ID for a separate verified Spark project; the existing ARTICTON project is rejected.");
    }
    if (env.VITE_FIREBASE_DEPLOYMENT_MODE !== "spark") {
      throw new Error("Spark builds require VITE_FIREBASE_DEPLOYMENT_MODE=spark.");
    }
  }
  return {
    plugins: [react(), tailwindcss()],
    build: {
      target: "es2020",
      cssCodeSplit: true,
      sourcemap: false,
      // The on-demand Three.js controls chunk is ~966 kB; the initial entry is
      // much smaller and does not preload this chunk.
      chunkSizeWarningLimit: 1000,
    },
  };
});
