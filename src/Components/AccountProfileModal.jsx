import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../firebase";
import {
  createProfileImageDataUrl,
  getProfileInitial,
  getProfileName,
  validateProfileImage,
} from "../utils/profileImages";

const MotionDiv = motion.div;

export default function AccountProfileModal({ isOpen, onClose, profile, onProfileUpdated }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [previewImage, setPreviewImage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const currentProfile = {
    ...profile,
    uid: profile?.uid || auth.currentUser?.uid,
    email: profile?.email || auth.currentUser?.email,
  };

  useEffect(() => {
    if (!isOpen) return;

    setFirstName(currentProfile.firstName || "");
    setLastName(currentProfile.lastName || "");
    setMiddleInitial(currentProfile.middleInitial || "");
    setPreviewImage(currentProfile.avatarUrl || "");
    setSelectedFile(null);
    setError("");
  }, [
    isOpen,
    currentProfile.firstName,
    currentProfile.lastName,
    currentProfile.middleInitial,
    currentProfile.avatarUrl,
  ]);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateProfileImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setSelectedFile(file);
    setPreviewImage(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    const uid = currentProfile.uid;

    if (!uid) {
      setError("No logged-in user found.");
      return;
    }

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanMiddleInitial = middleInitial.trim().toUpperCase();

    if (!cleanFirstName || !cleanLastName) {
      setError("First name and last name are required.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      let avatarUrl = currentProfile.avatarUrl || "";

      if (selectedFile) {
        const fallbackAvatarUrl = await createProfileImageDataUrl(selectedFile);
        const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const imageRef = ref(storage, `profile-photos/${uid}/${Date.now()}-${safeFileName}`);

        try {
          await uploadBytes(imageRef, selectedFile, { contentType: selectedFile.type });
          avatarUrl = await getDownloadURL(imageRef);
        } catch (uploadError) {
          console.warn("Profile photo storage upload failed; saving compressed image to Firestore instead.", uploadError);
          avatarUrl = fallbackAvatarUrl;
        }
      }

      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setError("Your profile document does not exist yet.");
        return;
      }

      const existingProfile = userSnap.data();
      const nextProfile = {
        firstName: cleanFirstName,
        lastName: cleanLastName,
        middleInitial: cleanMiddleInitial,
        avatarUrl,
        updatedAt: serverTimestamp(),
      };

      await setDoc(userRef, nextProfile, { merge: true });

      onProfileUpdated?.({
        ...existingProfile,
        ...currentProfile,
        ...nextProfile,
        updatedAt: new Date().toISOString(),
      });

      setPreviewImage(avatarUrl);
      setSelectedFile(null);
      onClose?.();
    } catch (saveError) {
      console.error("Error updating profile:", saveError);
      setError(saveError?.code === "permission-denied"
        ? "You do not have permission to update this profile."
        : "Could not save your profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <MotionDiv className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <MotionDiv initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.97 }} transition={{ duration: 0.18 }} className="w-full max-w-lg overflow-hidden rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_30px_100px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between border-b border-[#1a2438] px-6 py-5">
              <div>
                <div className="text-lg font-bold text-white">Profile</div>
                <div className="text-xs text-[#7a8ba8]">{currentProfile.email}</div>
              </div>

              <button type="button" onClick={onClose} disabled={isSaving} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1a2438] bg-white/[0.03] text-white/70 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60">
                X
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-5">
                <AccountAvatar image={previewImage} fallback={getProfileInitial(currentProfile)} large />
                <div>
                  <div className="text-base font-bold text-white">{getProfileName(currentProfile)}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#FFD41C]">{currentProfile.role || "Account"}</div>
                  <label className="mt-4 inline-flex cursor-pointer rounded-xl border border-[#FFD41C]/30 bg-[#FFD41C]/12 px-4 py-2.5 text-sm font-semibold text-[#FFD41C] transition hover:bg-[#FFD41C]/18">
                    Upload picture
                    <input type="file" accept="image/*" onChange={handleImageChange} disabled={isSaving} className="hidden" />
                  </label>
                  <div className="mt-2 text-xs text-[#7a8ba8]">JPG, PNG, or WebP up to 5MB.</div>
                </div>
              </div>

              {error ? (
                <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
                  {error}
                </div>
              ) : null}

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <ProfileField label="First Name" value={firstName} onChange={setFirstName} placeholder="First name" />
                <ProfileField label="Last Name" value={lastName} onChange={setLastName} placeholder="Last name" />
                <ProfileField label="MI" value={middleInitial} onChange={(value) => setMiddleInitial(value.toUpperCase())} placeholder="M" maxLength={1} centered />
              </div>

              <div className="mt-4">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7a8ba8]">Email</label>
                <input value={currentProfile.email || ""} readOnly className="mt-2 w-full cursor-not-allowed rounded-2xl border border-[#1a2438] bg-white/[0.02] px-4 py-3 text-sm text-[#7a8ba8] outline-none" />
              </div>

              <div className="mt-7 flex justify-end gap-3">
                <button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl border border-[#1a2438] bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-[#dbe6f5] transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60">
                  Cancel
                </button>
                <button type="button" onClick={handleSave} disabled={isSaving} className="rounded-xl bg-[#FFD41C] px-5 py-2.5 text-sm font-bold text-[#0a0e17] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100">
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </MotionDiv>
        </MotionDiv>
      ) : null}
    </AnimatePresence>
  );
}

function ProfileField({ label, value, onChange, placeholder, maxLength, centered = false }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7a8ba8]">{label}</label>
      <input value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} className={["mt-2 w-full rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-[#FFD41C]/40 focus:ring-2 focus:ring-[#FFD41C]/15", centered ? "text-center" : ""].join(" ")} placeholder={placeholder} />
    </div>
  );
}

function AccountAvatar({ image, fallback, large = false }) {
  return (
    <div className={`${large ? "h-20 w-20 text-2xl" : "h-10 w-10 text-sm"} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#FFD41C]/25 bg-[#FFD41C]/10 font-bold text-[#FFD41C]`}>
      {image ? <img src={image} alt="Profile" className="h-full w-full object-cover" /> : fallback}
    </div>
  );
}
