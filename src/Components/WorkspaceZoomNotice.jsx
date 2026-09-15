import { useState } from "react";
import { createPortal } from "react-dom";
import { useCompactWorkspace } from "../hooks/useCompactWorkspace";

export default function WorkspaceZoomNotice() {
  // Browser zoom is not reliably distinguishable from display scaling or a
  // small window. Respond to usable viewport space, not devicePixelRatio.
  const limitedSpace = useCompactWorkspace("(max-width: 1000px), (max-height: 650px)");
  return limitedSpace ? <ZoomNotice /> : null;
}

function ZoomNotice() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return createPortal(
    <aside className="articton-zoom-notice" aria-label="3D workspace viewing tip">
      <div role="status">
        <strong>3D model missing or cut off?</strong>
        <p>For the best view, reset browser zoom to <strong>100%</strong> using <kbd>Ctrl + 0</kbd> (Mac: <kbd>⌘ + 0</kbd>) and maximize your window. On a phone, try landscape orientation.</p>
      </div>
      <button type="button" aria-label="Dismiss zoom tip" onClick={() => setDismissed(true)}>×</button>
    </aside>,
    document.body,
  );
}
