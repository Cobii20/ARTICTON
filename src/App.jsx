import { useState } from "react";

// pages
import ArtictonLandingPage from "./PAGES/LandingPage";
import Dashboard from "./PAGES/Dashboard";
import Module1Page from "./PAGES/Module1Page";
import PracticalTestPage from "./PAGES/PracticalTestPage";
import AdminPage from "./PAGES/Adminpage";

export default function App() {
  const [page, setPage] = useState("landing");
  const [userProfile, setUserProfile] = useState(null);
  const [activeTestId, setActiveTestId] = useState(null);

  const handleLogin = (profile) => {
    setUserProfile(profile || null);

    if (profile?.role === "admin") {
      setPage("admin");
    } else {
      setPage("dashboard");
    }
  };

  const handleLogout = () => {
    setUserProfile(null);
    setPage("landing");
  };

  if (page === "landing") {
    return <ArtictonLandingPage onLogin={handleLogin} />;
  }

  if (page === "module-1") {
    return <Module1Page onBack={() => setPage("dashboard")} />;
  }

  if (page === "practical-test") {
    return (
      <PracticalTestPage
        testId={activeTestId || "pc-assembly"}
        onBack={() => setPage("dashboard")}
      />
    );
  }

  if (page === "admin") {
    return (
      <AdminPage
        adminUser={userProfile}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <Dashboard
      onLogout={handleLogout}
      onOpenModule={(id) => {
        if (id === "module-1") setPage("module-1");
      }}
      onOpenTest={(testId) => {
        setActiveTestId(testId);
        setPage("practical-test");
      }}
    />
  );
}