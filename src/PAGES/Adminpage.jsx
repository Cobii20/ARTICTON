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

      setEditingId(null);
      setEditFirstName("");
      setEditLastName("");
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

  return (
    <div className="min-h-screen bg-[#0B2E5A] text-white flex">
      <aside className="w-[250px] bg-[#03234A] p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="h-10 w-10 rounded-xl bg-[#1E4D7A] flex items-center justify-center">
              <div className="h-5 w-5 rounded-full border-2 border-white" />
            </div>
            <span className="text-xl font-semibold">Articton</span>
          </div>

          <div className="space-y-3">
            <button className="w-full text-left px-4 py-3 rounded-xl bg-[#2E78A6] transition">
              Account Management
            </button>

            <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-[#1E4D7A] transition">
              Module Management
            </button>

            <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-[#1E4D7A] transition">
              Analytics
            </button>
          </div>
        </div>

        <div>
          <div className="border-t border-white/10 pt-6 mb-6">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#1E4D7A] transition">
              <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-sm">
                ⚙
              </div>
              <span>Settings</span>
            </button>
          </div>

          <div className="bg-[#2E78A6] rounded-2xl p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20" />
            <div>
              <div className="font-semibold">{adminName}</div>
              <div className="text-xs text-white/70">{adminEmail}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-8">
        <h1 className="text-4xl font-bold mb-10">Account Management</h1>

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
                      <div>{account.name}</div>
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

        <div className="flex justify-end mt-10">
          <button
            onClick={onLogout}
            className="px-6 py-2 rounded-full bg-[#7FA7C3] text-white hover:bg-[#98b7ce] transition"
          >
            Logout
          </button>
        </div>
      </main>
    </div>
  );
}