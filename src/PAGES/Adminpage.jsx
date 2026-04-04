import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

export default function AdminPage({ adminUser, onLogout }) {
  const [accounts, setAccounts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("accounts");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const adminName = useMemo(() => {
    if (!adminUser) return "Admin";
    const first = adminUser.firstName || "";
    const last = adminUser.lastName || "";
    return `${first} ${last}`.trim() || "Admin";
  }, [adminUser]);

  const adminEmail = adminUser?.email || "admin@email.com";

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const querySnapshot = await getDocs(collection(db, "users"));
      const users = querySnapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            uid: data.uid || docSnap.id,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            name:
              `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
              "No Name",
            email: data.email || "No email",
            progress: data.progress || 0,
            examScore: data.examScore || "0/50",
            role: data.role || "student",
          };
        })
        .filter((user) => user.role === "student");

      setAccounts(users);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (account) => {
    setEditingId(account.id);
    setEditFirstName(account.firstName || "");
    setEditLastName(account.lastName || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFirstName("");
    setEditLastName("");
  };

  const saveEdit = async (id) => {
    if (!editFirstName.trim() || !editLastName.trim()) {
      alert("First name and last name are required.");
      return;
    }

    try {
      setSavingId(id);
      await updateDoc(doc(db, "users", id), {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
      });

      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === id
            ? {
                ...acc,
                firstName: editFirstName.trim(),
                lastName: editLastName.trim(),
                name: `${editFirstName.trim()} ${editLastName.trim()}`,
              }
            : acc
        )
      );

      cancelEdit();
    } catch (err) {
      console.error("Error updating user:", err);
      alert("Failed to update user.");
    } finally {
      setSavingId(null);
    }
  };

  const removeUser = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to remove this student?"
    );
    if (!confirmed) return;

    try {
      setDeletingId(id);
      await deleteDoc(doc(db, "users", id));
      setAccounts((prev) => prev.filter((acc) => acc.id !== id));
    } catch (err) {
      console.error("Error deleting user:", err);
      alert("Failed to remove user.");
    } finally {
      setDeletingId(null);
    }
  };

  const analyticsData = {
    activeUsers: 6767,
    completionRate: 67.89,
    examScore: 85.12,
    completionTrend: [100, 94, 86, 78, 70, 62],
    userOverview: { name: "John Doe", email: "john.doe@gmail.com", progress: 100 },
  };

  return (
    <div className="min-h-screen bg-[#0B2E5A] text-white flex">
      {/* SIDEBAR */}
      <aside className="w-[250px] bg-[#03234A] p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="h-10 w-10 rounded-xl bg-[#1E4D7A] flex items-center justify-center">
              <div className="h-5 w-5 rounded-full border-2 border-white" />
            </div>
            <span className="text-xl font-semibold">Articton</span>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setActiveTab("accounts")}
              className={`w-full text-left px-4 py-3 rounded-xl transition ${
                activeTab === "accounts"
                  ? "bg-[#2E78A6]"
                  : "hover:bg-[#1E4D7A]"
              }`}
            >
              Account Management
            </button>

            <button
              onClick={() => setActiveTab("analytics")}
              className={`w-full text-left px-4 py-3 rounded-xl transition ${
                activeTab === "analytics"
                  ? "bg-[#2E78A6]"
                  : "hover:bg-[#1E4D7A]"
              }`}
            >
              Analytics
            </button>
          </div>
        </div>
        {/* Administrator Account Section */}
        <div className="mt-auto bg-[#2E78A6] rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-lg font-semibold">A</span>
          </div>
          <div>
            <div className="font-semibold">Administrator Account</div>
            <div className="text-xs text-white/70">{adminEmail}</div>
          </div>
        </div>

        
      </aside>

      {/* MAIN PANEL */}
      <main className="flex-1 relative p-8">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-4xl font-bold">
            {activeTab === "accounts" ? "Account Management" : "Analytics"}
          </h1>

          {/* Dropdown */}
          <div className="relative">
            <button
              className="flex items-center gap-3 bg-[#2E78A6]/70 px-4 py-2.5 rounded-full hover:bg-[#2E78A6] transition"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold uppercase">
                {adminName.charAt(0)}
              </div>
              <span className="font-medium">{adminName}</span>
              <svg
                xmlns="[w3.org](http://www.w3.org/2000/svg)"
                className={`h-4 w-4 transition ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#194066] border border-white/10 rounded-xl shadow-xl">
                <button
                  className="w-full text-left px-4 py-2 hover:bg-[#2E78A6] transition"
                  onClick={() => alert("Settings clicked")}
                >
                  Settings
                </button>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-[#2E78A6] transition"
                  onClick={onLogout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ACCOUNT MANAGEMENT */}
        {activeTab === "accounts" && (
          <>
            {loading && <p className="text-white/80">Loading students...</p>}
            {error && <p className="text-red-300 mb-4">{error}</p>}

            {!loading && !error && (
              <>
                <div className="grid grid-cols-[2fr_2fr_1.2fr_1.2fr_140px_120px] gap-4 px-5 mb-4 text-sm text-white/80">
                  <div>Name</div>
                  <div>E-mail</div>
                  <div>Module Progress</div>
                  <div>Exam Score</div>
                  <div>Update</div>
                  <div>Remove</div>
                </div>

                <div className="space-y-4">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="grid grid-cols-[2fr_2fr_1.2fr_1.2fr_140px_120px] gap-4 items-center bg-[#3A7EA4] rounded-2xl px-5 py-4 shadow-lg"
                    >
                      <div>
                        {editingId === account.id ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              value={editFirstName}
                              onChange={(e) => setEditFirstName(e.target.value)}
                              placeholder="First Name"
                              className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white outline-none"
                            />
                            <input
                              type="text"
                              value={editLastName}
                              onChange={(e) => setEditLastName(e.target.value)}
                              placeholder="Last Name"
                              className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white outline-none"
                            />
                          </div>
                        ) : (
                          account.name
                        )}
                      </div>

                      <div>{account.email}</div>
                      <div>{account.progress}%</div>
                      <div>{account.examScore}</div>

                      <div>
                        {editingId === account.id ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveEdit(account.id)}
                              disabled={savingId === account.id}
                              className="px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-60"
                            >
                              {savingId === account.id ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="px-3 py-2 rounded-lg bg-gray-500 hover:bg-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(account)}
                            className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                          >
                            Update
                          </button>
                        )}
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => removeUser(account.id)}
                          disabled={deletingId === account.id}
                          className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-60"
                        >
                          {deletingId === account.id ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ANALYTICS */}
        {activeTab === "analytics" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="p-6 rounded-xl bg-[#13304a]/50 backdrop-blur-lg border border-white/10">
                <p className="text-sm text-white/70">Active Users</p>
                <h2 className="text-2xl font-bold mt-2">
                  {analyticsData.activeUsers.toLocaleString()}
                </h2>
                <p className="text-green-400 text-sm mt-1">▲ +12%</p>
              </div>

              <div className="p-6 rounded-xl bg-[#13304a]/50 backdrop-blur-lg border border-white/10">
                <p className="text-sm text-white/70">AVG Completion Rate</p>
                <h2 className="text-2xl font-bold mt-2">
                  {analyticsData.completionRate}%
                </h2>
                <p className="text-green-400 text-sm mt-1">+0.6%</p>
              </div>

              <div className="p-6 rounded-xl bg-[#13304a]/50 backdrop-blur-lg border border-white/10">
                <p className="text-sm text-white/70">AVG Exam Score</p>
                <h2 className="text-2xl font-bold mt-2">
                  {analyticsData.examScore}%
                </h2>
                <p className="text-green-400 text-sm mt-1">+0.8%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-[#13304a]/50 backdrop-blur-lg border border-white/10">
                <h3 className="text-lg font-semibold mb-4">
                  Module Progression
                </h3>
                <div className="h-48 flex items-end gap-2">
                  {analyticsData.completionTrend.map((v, i) => (
                    <div
                      key={i}
                      className="bg-[#5F9598] flex-1 rounded-t-md transition-all duration-300"
                      style={{ height: `${v}%` }}
                      title={`${v}%`}
                    ></div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-white/60 mt-2">
                  <span>CPU</span>
                  <span>MB</span>
                  <span>GPU</span>
                  <span>RAM</span>
                  <span>PSU</span>
                  <span>BIOS</span>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-[#13304a]/50 backdrop-blur-lg border border-white/10">
                <h3 className="text-lg font-semibold mb-4">User Overview</h3>
                <div className="flex items-center justify-between bg-[#1b365d] rounded-xl p-4">
                  <div>
                    <p className="font-semibold">
                      {analyticsData.userOverview.name}
                    </p>
                    <p className="text-sm text-white/60">
                      {analyticsData.userOverview.email}
                    </p>
                  </div>
                  <div className="bg-[#5F9598]/30 px-4 py-2 rounded-lg font-semibold">
                    {analyticsData.userOverview.progress}%
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

       
      
      </main>
    </div>
  );
}
