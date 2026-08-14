import { useEffect, useState } from "react";

export function useCompactWorkspace(query = "(max-width: 767px)") {
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia(query);
    const updateCompactState = () => setIsCompact(mediaQuery.matches);

    updateCompactState();
    mediaQuery.addEventListener?.("change", updateCompactState);

    return () => {
      mediaQuery.removeEventListener?.("change", updateCompactState);
    };
  }, [query]);

  return isCompact;
}
