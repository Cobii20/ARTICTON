import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import WorkspaceZoomNotice from "./Components/WorkspaceZoomNotice.jsx";

import { applyThemeSettings } from "./utils/userSettings";

applyThemeSettings();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <WorkspaceZoomNotice />
  </StrictMode>
);
