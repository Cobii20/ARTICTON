import { useState } from "react";

export default function ModuleImage({ src, title, className = "" }) {
  const [failedSource, setFailedSource] = useState(null);
  if (!src || failedSource === src) {
    return <div className="absolute inset-0 flex items-center justify-center p-5 text-center text-sm" style={{ color: "var(--articton-text-muted)" }}>{title || "Module"} preview unavailable</div>;
  }
  return <img src={src} alt={title || "Module preview"} className={`absolute inset-0 h-full w-full object-contain ${className}`} onError={() => setFailedSource(src)} />;
}
