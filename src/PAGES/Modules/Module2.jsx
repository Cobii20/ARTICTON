

import CPUtoMBScene from "./module2-scenes/CPUtoMB";
import RAMtoMBScene from "./module2-scenes/RAMtoMB";
import SSDtoMBScene from "./module2-scenes/SSDtoMB";
import MBtoCaseScene from "./module2-scenes/MBtoCase";
import HDDtoCaseScene from "./module2-scenes/HDDtoCase";
import PSUtoCaseScene from "./module2-scenes/PSUtoCase";
import FullAssemblyScene from "./module2-scenes/FullAssembly";
import React, { useState } from "react";

export default function Module2Assembly({ onFinish }) {


  const [step, setStep] = useState(0);

  
  return (
    <div style={styles.page}>
      
      {/* HEADER */}
      <div style={styles.header}>
        <h1>Module 2: Assembly</h1>
        <p>Drag components to assemble the computer</p>
      </div>

      {/* SCENE */}
      <div style={styles.sceneWrapper}>
        {step === 0 && <CPUtoMBScene />}
        {step === 1 && <RAMtoMBScene />}
        {step === 2 && <SSDtoMBScene />}
        {step === 3 && <MBtoCaseScene/>}
        {step === 4 && <HDDtoCaseScene/>}
        {step === 5 && <PSUtoCaseScene />}
        {step === 6 && <FullAssemblyScene />}
      </div>

      <div style={styles.footer}>
  {/* PREVIOUS BUTTON */}
  {step > 0 && (
    <button
      style={styles.buttonSecondary}
      onClick={() => setStep((prev) => prev - 1)}
    >
      Previous
    </button>
  )}

      {step < 6 ? (
        <button
          style={styles.button}
          onClick={() => setStep((prev) => prev + 1)}
        >
          Next
        </button>
      ) : (
        <button
          style={styles.buttonFinish}
          onClick={onFinish}
        >
          Finish
        </button>
      )}
    </div>

    </div>
  );
}

const styles = {
  page: {
    width: "100%",
    height: "100vh",
    background: "#0b0f14",
    display: "flex",
    flexDirection: "column",
  },

  header: {
    padding: "16px",
    color: "white",
  },

  sceneWrapper: {
    height: "80%",
  },

button: {
  padding: "12px 24px",
  fontSize: "16px",
  background: "#00bcd4",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
},

footer: {
  padding: "16px",
  display: "flex",
  justifyContent: "center",
  gap: "12px", // 👈 space between buttons
},

buttonSecondary: {
  padding: "12px 24px",
  fontSize: "16px",
  background: "#2a2f36",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
},

buttonFinish: {
  padding: "12px 24px",
  fontSize: "16px",
  background: "#4caf50", // 👈 green finish button
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
},
};
