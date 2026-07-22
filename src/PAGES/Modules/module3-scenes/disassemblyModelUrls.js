import React, { createContext, useContext } from "react";

export const DEFAULT_DISASSEMBLY_MODEL_URLS = {
  case: "/models/PC CASE(BLENDER).glb",
  motherboard: "/models/MB(BLENDER).glb",
  cpu: "/models/CPU(BLENDER).glb",
  ram: "/models/RAM(BLENDER).glb",
  ram2: "/models/RAM(BLENDER).glb",
  ssd: "/models/SSD(BLENDER).glb",
  hdd: "/models/HDD(BLENDER).glb",
  psu: "/models/PSU(BLENDER).glb",
  gpu: "/models/Gpu(Base).glb",
};

const DisassemblyModelUrlsContext = createContext(DEFAULT_DISASSEMBLY_MODEL_URLS);

export function DisassemblyModelUrlsProvider({ modelUrls, children }) {
  return (
    <DisassemblyModelUrlsContext.Provider
      value={{ ...DEFAULT_DISASSEMBLY_MODEL_URLS, ...modelUrls }}
    >
      {children}
    </DisassemblyModelUrlsContext.Provider>
  );
}

export function useDisassemblyModelUrl(key, fallback) {
  const modelUrls = useContext(DisassemblyModelUrlsContext);
  return modelUrls?.[key] || fallback || DEFAULT_DISASSEMBLY_MODEL_URLS[key];
}
