export function getProfileInitial(profile = {}) {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return (name || profile.displayName || profile.email || "U").charAt(0).toUpperCase();
}

export function getProfileName(profile = {}) {
  const name = [
    profile.firstName,
    profile.middleInitial ? `${profile.middleInitial}.` : "",
    profile.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || profile.displayName || profile.email || "User";
}

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read selected image."));
    };
    image.src = objectUrl;
  });
}

export async function createProfileImageDataUrl(file, maxSize = 420, quality = 0.82) {
  const image = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}

export function validateProfileImage(file) {
  if (!file) return "";
  if (!file.type.startsWith("image/")) return "Please choose an image file.";
  if (file.size > 5 * 1024 * 1024) return "Profile photos must be 5MB or smaller.";
  return "";
}
