import { getModuleVisit, recordModuleVisit } from "./utils/moduleVisits";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";

// Main pages
const ArtictonLandingPage = lazy(() => import("./PAGES/LandingPage"));
const Dashboard = lazy(() => import("./PAGES/Dashboard"));
const AdminPage = lazy(() => import("./PAGES/Adminpage"));
const FacultyPage = lazy(() => import("./PAGES/FacultyPage"));
const Module1Page = lazy(() => import("./PAGES/Modules/Module1"));
const Module2Page = lazy(() => import("./PAGES/Modules/Module2"));
const Module3Page = lazy(() => import("./PAGES/Modules/Module3"));
const Module2DisassemblyAMD = lazy(() => import("./PAGES/Modules/Module2/Module2DisassmblyAMD"));
const Module2DisassemblyINTEL = lazy(() => import("./PAGES/Modules/Module2/Module2DisassmblyINTEL"));
const Module3AssemblyAMD = lazy(() => import("./PAGES/Modules/Module3/Module3AssemblyAMD"));
const Module3AssemblyINTEL = lazy(() => import("./PAGES/Modules/Module3/Module3AssemblyINTEL"));
const AMDFullAssemblyPracticalTest = lazy(() => import("./PAGES/PracticalTests/AMD/AMDFullAssemblyPracticalTest.jsx"));
const AMDFullDisassemblyPracticalTest = lazy(() => import("./PAGES/PracticalTests/AMD/AMDFullDisassemblyPracticalTest.jsx"));
const INTELFullAssemblyPracticalTest = lazy(() => import("./PAGES/PracticalTests/INTEL/INTELFullAssemblyPracticalTest.jsx"));
const INTELFullDisassemblyPracticalTest = lazy(() => import("./PAGES/PracticalTests/INTEL/INTELFullDisassemblyPracticalTest.jsx"));
import {
  applyThemeSettings,
  getUserSettings,
  subscribeEditProfileRequests,
  subscribeUserSettings,
} from "./utils/userSettings";

export default function App() {
  const [resumeVisit, setResumeVisit] = useState(null);
  const [page, setPage] = useState("landing");
  const [userProfile, setUserProfile] = useState(null);
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
    } else if (role === "faculty" || role === "staff") {
      setPage("faculty");
    } else {
      setDashboardSection("Dashboard");
      setPage("dashboard");
    }
  };

  const resetApplicationState = useCallback(() => {
    setUserProfile(null);
    setProfileEditRequestId(0);
    setDashboardSection("Dashboard");
    setPage("landing");
  }, []);

  const handleLogout = async () => {
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

  useEffect(() => {
    if (page === "module-2" || page === "module-3") {
      recordModuleVisit(auth.currentUser?.uid, { route: page, activity: "Platform selection" });
    }
  }, [page]);

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

  const returnToPracticeTests = () => {
    setDashboardSection("Practice Tests");
    setPage("dashboard");
  };

  let content;

  if (page === "landing") {
    content = <ArtictonLandingPage onLogin={handleLogin} />;
  }

  else if (page === "module-1") {
    content = (
      <Module1Page
        resumeVisit={resumeVisit}
        onBack={handleModuleBack}
        onLogout={handleLogout}
      />
    );
  }

  else if (page === "module-2") {
    content = (
      <Module2Page
        onBack={handleModuleBack}
        onLogout={handleLogout}
        onSelectPlatform={(platform) => setPage(`module-2-${platform}`)}
        onFinish={returnToDashboard}
      />
    );
  }

  else if (page === "module-2-amd") {
    content = (
      <Module2DisassemblyAMD
        onFinish={returnToDashboard}
        onBack={handleModuleBack}
        onLogout={handleLogout}
        onSwitchPlatform={() => setPage("module-2-intel")}
      />
    );
  }

  else if (page === "module-2-intel") {
    content = (
      <Module2DisassemblyINTEL
        onFinish={returnToDashboard}
        onBack={handleModuleBack}
        onLogout={handleLogout}
        onSwitchPlatform={() => setPage("module-2-amd")}
      />
    );
  }

  else if (page === "module-3") {
    content = (
      <Module3Page
        onBack={handleModuleBack}
        onLogout={handleLogout}
        onSelectPlatform={(platform) => setPage(`module-3-${platform}`)}
      />
    );
  }

  else if (page === "module-3-amd") {
    content = (
      <Module3AssemblyAMD
        onFinish={returnToDashboard}
        onBack={handleModuleBack}
        onLogout={handleLogout}
        onSwitchPlatform={() => setPage("module-3-intel")}
      />
    );
  }

  else if (page === "module-3-intel") {
    content = (
      <Module3AssemblyINTEL
        onFinish={returnToDashboard}
        onBack={handleModuleBack}
        onLogout={handleLogout}
        onSwitchPlatform={() => setPage("module-3-amd")}
      />
    );
  }

 

  else if (page === "admin") {
    content = (
      <AdminPage
        adminUser={userProfile}
        onLogout={handleLogout}
      />
    );
  }

  else if (page === "faculty") {
    content = <FacultyPage questionEditorOnly={String(userProfile?.role || "").trim().toLowerCase() === "staff"} onLogout={handleLogout} />;
  }

  else if (page === "amd-full-assembly-practical") {
    content = <AMDFullAssemblyPracticalTest onBack={returnToPracticeTests} />;
  }

  else if (page === "amd-full-disassembly-practical") {
    content = <AMDFullDisassemblyPracticalTest onBack={returnToPracticeTests} />;
  }

  else if (page === "intel-full-assembly-practical") {
    content = <INTELFullAssemblyPracticalTest onBack={returnToPracticeTests} />;
  }

  else if (page === "intel-full-disassembly-practical") {
    content = <INTELFullDisassemblyPracticalTest onBack={returnToPracticeTests} />;
  }
  else if (!content) content = (
    <Dashboard
      initialSection={dashboardSection}
      profileEditRequestId={profileEditRequestId}
      onProfileEditRequestHandled={() => setProfileEditRequestId(0)}
      onLogout={handleLogout}
      onOpenPractical={(practicalId) => setPage(practicalId)}
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

        setResumeVisit(typeof module === "object" && module.resume ? getModuleVisit(auth.currentUser?.uid, id) : null);
        const nextPage = pageByModuleId[id];
        if (nextPage) setPage(nextPage);
      }}
    />
  );

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0a0e17] text-white">Loading…</div>}>
      {content}
    </Suspense>
  );
}
