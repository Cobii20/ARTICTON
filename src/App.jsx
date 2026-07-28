import { useEffect, useState } from "react";

// Main pages
import ArtictonLandingPage from "./PAGES/LandingPage";
import Dashboard from "./PAGES/Dashboard";
import PracticalTestPage from "./PAGES/PracticalTestPage";
import AdminPage from "./PAGES/Adminpage";

// Module pages
import Module1Page from "./PAGES/Modules/Module1";
import Module2Page from "./PAGES/Modules/Module2";
import Module3Page from "./PAGES/Modules/Module3";


// Module 2 platform pages
import Module2DisassemblyAMD from "./PAGES/Modules/Module2/Module2DisassmblyAMD";
import Module2DisassemblyINTEL from "./PAGES/Modules/Module2/Module2DisassmblyINTEL";

// Module 3 platform pages
import Module3AssemblyAMD from "./PAGES/Modules/Module3/Module3AssemblyAMD";
import Module3AssemblyINTEL from "./PAGES/Modules/Module3/Module3AssemblyINTEL";
import FacultyPage from "./PAGES/FacultyPage";
import {
  applyThemeSettings,
  getUserSettings,
  subscribeEditProfileRequests,
  subscribeUserSettings,
} from "./utils/userSettings";

export default function App() {
  const [page, setPage] = useState("landing");
  const [userProfile, setUserProfile] = useState(null);
  const [activeTestId, setActiveTestId] = useState(null);
  const [dashboardSection, setDashboardSection] = useState("Dashboard");
  const [profileEditRequestId, setProfileEditRequestId] = useState(0);

  useEffect(() => {
    applyThemeSettings(getUserSettings());

    const unsubscribeSettings = subscribeUserSettings(applyThemeSettings);
    const unsubscribeProfileRequests = subscribeEditProfileRequests(() => {
      setDashboardSection("Profile");
      setProfileEditRequestId((requestId) => requestId + 1);
      setPage("dashboard");
    });

    return () => {
      unsubscribeSettings();
      unsubscribeProfileRequests();
    };
  }, []);

  const handleLogin = (profile) => {
    setUserProfile(profile || null);
    const role = String(profile?.role || "").trim().toLowerCase();

    if (role === "admin") {
      setPage("admin");
    } else if (role === "faculty") {
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

  const handleModuleBack = (target = "Dashboard") => {
    if (target === "logout") {
      handleLogout();
      return;
    }

    if (
      target === "Modules" ||
      target === "Profile" ||
      target === "Edit Profile" ||
      target === "Practice Tests"
    ) {
      setDashboardSection(target === "Edit Profile" ? "Profile" : target);
      if (target === "Edit Profile") {
        setProfileEditRequestId((requestId) => requestId + 1);
      }
      setPage("dashboard");
      return;
    }

    setDashboardSection("Dashboard");
    setPage("dashboard");
  };

  const returnToDashboard = () => {
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
        onFinish={returnToDashboard}
      />
    );
  }

  if (page === "module-2-amd") {
    return (
      <Module2DisassemblyAMD
        onFinish={returnToDashboard}
        onBack={handleModuleBack}
        onLogout={handleLogout}
        onSwitchPlatform={() => setPage("module-2-intel")}
      />
    );
  }

  if (page === "module-2-intel") {
    return (
      <Module2DisassemblyINTEL
        onFinish={returnToDashboard}
        onBack={handleModuleBack}
        onLogout={handleLogout}
        onSwitchPlatform={() => setPage("module-2-amd")}
      />
    );
  }

  if (page === "module-3") {
    return (
      <Module3Page
        onBack={handleModuleBack}
        onLogout={handleLogout}
        onSelectPlatform={(platform) => setPage(`module-3-${platform}`)}
      />
    );
  }

  if (page === "module-3-amd") {
    return (
      <Module3AssemblyAMD
        onFinish={returnToDashboard}
        onBack={handleModuleBack}
        onLogout={handleLogout}
        onSwitchPlatform={() => setPage("module-3-intel")}
      />
    );
  }

  if (page === "module-3-intel") {
    return (
      <Module3AssemblyINTEL
        onFinish={returnToDashboard}
        onBack={handleModuleBack}
        onLogout={handleLogout}
        onSwitchPlatform={() => setPage("module-3-amd")}
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
      profileEditRequestId={profileEditRequestId}
      onLogout={handleLogout}
      onOpenModule={(module) => {
        const id = typeof module === "object" ? module.id : module;

        const pageByModuleId = {
          "module-1": "module-1",
          "module-2": "module-2",
          "module-2-amd": "module-2-amd",
          "module-2-intel": "module-2-intel",
          "module-3": "module-3",
          "module-3-amd": "module-3-amd",
          "module-3-intel": "module-3-intel",
          "module-4": "module-4",
        };

        const nextPage = pageByModuleId[id];
        if (nextPage) setPage(nextPage);
      }}
    />
  );
}
