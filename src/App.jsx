import { useState } from "react";

// main pages
import ArtictonLandingPage from "./PAGES/LandingPage";
import Dashboard from "./PAGES/Dashboard";
import PracticalTestPage from "./PAGES/PracticalTestPage";
import AdminPage from "./PAGES/Adminpage";

// module pages
import Module1Page from "./PAGES/Modules/Module1";
import Module2Page from "./PAGES/Modules/Module2";
import Module3Page from "./PAGES/Modules/Module3";
import Module4Page from "./PAGES/Modules/Module4";



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
  if (page === "module-2") {
  return <Module2Page onBack={() => setPage("dashboard")} />;
}
if (page === "module-3") {
  return <Module3Page onBack={() => setPage("dashboard")} />;
}
if (page === "module-4") {
  return <Module4Page onBack={() => setPage("dashboard")} />;
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
        else if (id === "module-2") setPage("module-2");
        else if (id === "module-3") setPage("module-3");
        else if (id === "module-4") setPage("module-4");
      }}
      onOpenTest={(testId) => {
        setActiveTestId(testId);
        setPage("practical-test");
      }}
    />
  );
}