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
import Module2DisassemblyAMD from "./PAGES/Modules/Module2/Module2DisassmblyAMD";
import Module2DisassemblyINTEL from "./PAGES/Modules/Module2/Module2DisassmblyINTEL";

import Module3AssemblyAMD from "./PAGES/Modules/Module3/Module3AssemblyAMD";
import Module3AssemblyINTEL from "./PAGES/Modules/Module3/Module3AssemblyINTEL";
import FacultyPage from "./PAGES/FacultyPage";

export default function App() {
  const [page, setPage] = useState("landing");
  const [userProfile, setUserProfile] = useState(null);
  const [activeTestId, setActiveTestId] = useState(null);

  // ✅ new: remember which dashboard section should open
  const [dashboardSection, setDashboardSection] = useState("Dashboard");

  const handleLogin = (profile) => {
    setUserProfile(profile || null);

    if (profile?.role === "admin") {
      setPage("admin");
    } else if (profile?.role === "faculty") {
      setPage("faculty");
    } else {
      setDashboardSection("Dashboard");
      setPage("dashboard");
    }
  };

  const handleLogout = () => {
    setUserProfile(null);
    setActiveTestId(null);
    setDashboardSection("Dashboard");
    setPage("landing");
  };

  // ✅ central handler for module pages
const handleModuleBack = (target = "Dashboard") => {
  if (target === "logout") {
    handleLogout();
    return;
  }

  if (target === "Modules") {
    setDashboardSection("Modules");
    setPage("dashboard");
    return;
  }

  if (target === "Profile") {
    setDashboardSection("Profile");
    setPage("dashboard");
    return;
  }

  if (target === "Practice Tests") {
    setDashboardSection("Practice Tests");
    setPage("dashboard");
    return;
  }

  setDashboardSection("Dashboard");
  setPage("dashboard");
};

  if (page === "landing") {
    return <ArtictonLandingPage onLogin={handleLogin} />;
  }

  if (page === "module-1") {
    return (
      <Module1Page
        onBack={handleModuleBack}
        onLogout={handleLogout}
      />
    );
  }

  if (page === "module-2") {
    return (
      <Module2Page
        onBack={handleModuleBack}
        onLogout={handleLogout}
        onSelectPlatform={(platform) => setPage(`module-2-${platform}`)}
        onFinish={() => {
          setDashboardSection("Dashboard");
          setPage("dashboard");
        }}
      />
    );
  }
  if (page === "module-2-amd") {
  return (
    <Module2DisassemblyAMD
      onBack={handleModuleBack}
      onLogout={handleLogout}
    />
  );
}


if (page === "module-2-intel") {
  return (
    <Module2DisassemblyINTEL
      onBack={handleModuleBack}
      onLogout={handleLogout}
    />
  );
}

  if (page === "module-3") {
    return (
      <Module3Page
        onBack={handleModuleBack}
        onLogout={handleLogout}
      />
    );
  }
if (page === "module-3-amd") {
  return (
    <Module3AssemblyAMD
      onBack={handleModuleBack}
      onLogout={handleLogout}
    />
  );
}


if (page === "module-3-intel") {
  return (
    <Module3AssemblyINTEL
      onBack={handleModuleBack}
      onLogout={handleLogout}
    />
  );
}
  if (page === "module-4") {
    return (
      <Module4Page
        onBack={handleModuleBack}
        onLogout={handleLogout}
      />
    );
  }

  if (page === "practical-test") {
    return (
      <PracticalTestPage
        testId={activeTestId || "pc-assembly"}
        onBack={() => {
          setDashboardSection("Practice Tests");
          setPage("dashboard");
        }}
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

  if (page === "faculty") {
    return <FacultyPage onLogout={handleLogout} />;
  }

  return (
    <Dashboard
      initialSection={dashboardSection}
      onLogout={handleLogout}
      onOpenModule={(module) => {

  const id = typeof module === "object"
    ? module.id
    : module;

  if (id === "module-1") {
    setPage("module-1");
  }

  else if (id === "module-2") {
    setPage("module-2");
  }

  else if (id === "module-3") {
    setPage("module-3");
  }

  else if (id === "module-4") {
    setPage("module-4");
  }


  // NEW MODULE 2 PATHS
  else if (id === "module-2-amd") {
    setPage("module-2-amd");
  }

  else if (id === "module-2-intel") {
    setPage("module-2-intel");
  }


  // NEW MODULE 3 PATHS
  else if (id === "module-3-amd") {
    setPage("module-3-amd");
  }

  else if (id === "module-3-intel") {
    setPage("module-3-intel");
  }

}}
    />
  );
}
