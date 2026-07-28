import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";

// Main pages
import ArtictonLandingPage from "./PAGES/LandingPage";
import Dashboard from "./PAGES/Dashboard";
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

export default function App() {
  const [page, setPage] = useState("landing");
  const [userProfile, setUserProfile] = useState(null);
  const [dashboardSection, setDashboardSection] = useState("Dashboard");

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

  const resetApplicationState = useCallback(() => {
    setUserProfile(null);
    setDashboardSection("Dashboard");
    setPage("landing");
  }, []);

  const handleLogout = async () => {
    try {
      if (auth.currentUser) {
        const endOtpSession = httpsCallable(functions, "endOtpSession");
        await endOtpSession({});
      }
    } catch (error) {
      console.warn("Could not delete OTP session:", error);
    }

    try {
      await signOut(auth);
    } catch (error) {
      console.error("Firebase sign-out failed:", error);
    } finally {
      resetApplicationState();
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        resetApplicationState();
      }
    });

    return unsubscribe;
  }, [resetApplicationState]);

  const handleModuleBack = (target = "Dashboard") => {
    if (target === "logout") {
      handleLogout();
      return;
    }

    if (
      target === "Modules" ||
      target === "Profile" ||
      target === "Practice Tests"
    ) {
      setDashboardSection(target);
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
