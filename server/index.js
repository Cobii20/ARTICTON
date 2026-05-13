import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("AI backend running");
});

app.post("/api/chat", async (req, res) => {
  try {
    
const { message, context } = req.body;

const TRAINING_DATA = {
  assembly: `
STEP 1 — CPU Installation
- Align the CPU triangle marker.
- Never force the CPU into the socket.
- Lower the retention arm carefully.

STEP 2 — RAM Installation
- Match the RAM notch orientation.
- Push evenly until clips snap.

STEP 3 — SSD Installation
- Insert SSD at 30-degree angle.
- Screw SSD into motherboard standoff.

STEP 4 — PSU Installation
- Align PSU with case mounting holes.
- Secure with screws.

STEP 5 — Motherboard Installation
- Align motherboard with standoffs.
- Tighten screws carefully.
`,

  disassembly: `
STEP 1 — RAM Disassembly
- Release RAM clips carefully
- Pull RAM evenly upward

STEP 2 — HDD Disassembly
- Disconnect SATA and power cables
- Unscrew HDD from drive cage

STEP 3 — SSD Disassembly
- Remove mounting screw first
- Pull SSD at slight angle

STEP 4 — PSU Disassembly
- Disconnect all power connectors
- Remove PSU mounting screws

STEP 5 — CPU Disassembly
- Unlock retention arm
- Carefully lift CPU vertically

STEP 6 — Motherboard Disassembly
- Disconnect all cables
- Unscrew motherboard from standoffs
`,
};

    console.log("Incoming message:", message);

    const prompt = `
You are the official AI tutor for the Articton PC Assembly Simulator.

You MUST ONLY teach using the provided training data.

Never invent assembly procedures outside the simulator workflow.

If the user asks unrelated questions,
redirect them back to the current lesson.

========================
TRAINING DATA
========================

${TRAINING_DATA}

========================
CURRENT STEP
========================

${context.currentStep}

========================
COMPLETED STEPS
========================

${JSON.stringify(
  context.completedSteps
)}

========================
CURRENT STEP COMPLETED
========================

${context.currentStepCompleted}

========================
STUDENT QUESTION
========================

${message}

Provide concise educational guidance.
`;

    const response = await fetch(
      "http://127.0.0.1:11434/api/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3",
          prompt,
          stream: false,
        }),
      }
    );

    const data = await response.json();

    console.log("OLLAMA RESPONSE:");
    console.log(data);

    res.json({
      reply: data.response,
    });
  } catch (err) {
    console.error("OLLAMA ERROR:");
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log(
    `AI backend running on port ${PORT}`
  );
});