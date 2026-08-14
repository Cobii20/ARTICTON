const assemblyBase = {
  ramFirst: {
    title: "Prepare to Install the First RAM Module",
    summary:
      "Random Access Memory (RAM), also called a DIMM memory module, temporarily stores data so it can be accessed quickly while the computer is powered on.",
    procedure: [
      "Find the motherboard memory holder or DIMM slot where the first RAM module belongs.",
      "Open the retaining latch or latches and line up the module with the keyed memory slot.",
      "Hold the RAM by its edges and press it straight down until the latch or latches close.",
      "Check that the RAM sits level because the memory holder accepts only the correct module position.",
    ],
    safety:
      "Use the module edges only. Do not touch the gold contacts because the module must make a clean connection in the motherboard slot.",
    verify:
      "The DIMM is fully seated in the memory holder, the notch matches the slot, and the retention latch or latches are closed.",
    avoid:
      "Forcing a reversed module, touching the contacts, or leaving one end partly raised in the memory slot.",
    simulation:
      "Either RAM module is accepted first. Enter the motherboard field and let the animated vertical seating motion finish the insertion.",
  },
  ramSecond: {
    title: "Prepare to Install the Second RAM Module",
    summary:
      "RAM is temporary system memory. Completing the second DIMM gives the computer another memory module for active programs and data.",
    procedure: [
      "Use the remaining RAM module and the highlighted memory holder on the motherboard.",
      "Open the slot latch or latches, then compare the off-center notch with the slot key.",
      "Press both ends evenly until the module locks into the DIMM slot.",
      "Compare both RAM modules and confirm they are parallel and seated to the same depth.",
    ],
    safety:
      "Keep pressure centered over the slot and support the motherboard beneath the memory holder.",
    verify:
      "Both RAM modules are locked, level, and fully seated in the motherboard memory slots.",
    avoid:
      "Choosing a random slot, assuming the notch is aligned, or mistaking partial latch movement for full seating.",
    simulation:
      "Install the RAM module that remains. The next component stays locked until both memory modules are seated.",
  },
  ssd: {
    title: "Prepare to Install the SSD",
    summary:
      "Solid state storage has no moving parts. SSDs store files and programs with solid state memory and are faster and more durable than hard disks.",
    procedure: [
      "Locate the SSD connector or M.2 socket on the motherboard.",
      "Hold the SSD by its edges and align the connector with the storage socket.",
      "Seat the connector fully, then lower or secure the free end according to the socket design.",
      "Confirm the SSD is flat and retained without bending.",
    ],
    safety:
      "Do not touch the connector edge or memory chips. Use the correct retaining point so the SSD is not bent.",
    verify:
      "The SSD connector is fully inserted, the drive is secure, and it stays flat on the motherboard.",
    avoid:
      "Pushing storage in at the wrong angle, using the wrong retaining point, or overtightening small hardware.",
    simulation:
      "Move the SSD into the motherboard field. The magnetic route aligns the insertion angle, lowers it, and seats it without passing through the board.",
  },
  motherboard: {
    title: "Prepare to Install the Motherboard",
    summary:
      "The motherboard, also called the system board, is the main printed circuit board. It contains sockets and slots that accept other computer parts.",
    procedure: [
      "Check that the case standoffs match the motherboard mounting holes.",
      "Hold the motherboard by strong edges and align the rear ports with the case opening.",
      "Lower the board onto the standoffs without dragging mounted parts across the case.",
      "Start the screws by hand, then tighten them evenly until the system board is secure.",
    ],
    safety:
      "Do not rest the board on an extra standoff or carry it by sockets, slots, RAM, or connectors.",
    verify:
      "The system board is level, all mounting holes sit over standoffs, and the rear port area aligns with the case.",
    avoid:
      "Forcing rear ports into place, leaving an extra standoff under the board, or tightening one screw before the others start.",
    simulation:
      "Bring the populated motherboard into the case field. It will lift clear, travel above the chassis, lower vertically, and seat without clipping through case walls.",
  },
  psu: {
    title: "Prepare to Install the PSU",
    summary:
      "The Power Supply Unit (PSU) supplies power to the personal computer by converting AC current to regulated DC current and reducing voltage spikes.",
    procedure: [
      "Find the PSU bay and orient the unit so its fan can use a case vent.",
      "Support the PSU with both hands and slide it straight into the bay.",
      "Align the rear screw holes and secure the PSU evenly.",
      "Route motherboard, CPU, GPU, and drive power leads without placing them under tension.",
    ],
    safety:
      "The PSU is heavy and should never be opened. Keep fingers clear of pinch points while seating it.",
    verify:
      "The PSU sits flush, its fan has airflow, rear screws are secure, and power cables have clear routes.",
    avoid:
      "Blocking the intake, trapping cables under the PSU, or letting the unit hang from one screw.",
    simulation:
      "Move the PSU into the case field. The safe-path animation lifts, clears the chassis edge, lowers into the bay, and preserves the correct orientation.",
  },
  hdd: {
    title: "Prepare to Install the HDD",
    summary:
      "A Hard Disk Drive (HDD) is a main storage device that stores computer data permanently using spinning platters and magnetic read/write heads.",
    procedure: [
      "Place the HDD in its drive bay or tray with the connector side facing the cable route.",
      "Secure the drive through its mounting holes, rails, or tray points.",
      "Connect SATA data to the motherboard and SATA power to the PSU using the keyed plug shapes.",
      "Leave a gentle cable bend so the connectors are not stressed.",
    ],
    safety:
      "Support the HDD during installation and avoid impact because the drive contains precise internal moving parts.",
    verify:
      "The drive is mounted firmly, SATA data and power are fully seated, and the cable bends are relaxed.",
    avoid:
      "Forcing a reversed SATA plug, leaving the drive loose, or sharply bending cables at the connectors.",
    simulation:
      "Guide the HDD into the case field. The animation carries it over obstructions and lowers it into the drive bay.",
  },
  gpu: {
    title: "Prepare to Install the GPU",
    summary:
      "The video card, also called a graphics card or display adapter, generates and displays output images for a computer monitor.",
    procedure: [
      "Open the correct rear expansion slot and the PCIe slot retention latch.",
      "Hold the video card by its edges and align its connector with the motherboard expansion slot.",
      "Press straight down until the card is fully seated and the slot latch closes.",
      "Secure the bracket and connect any required PCIe power lead from the PSU.",
    ],
    safety:
      "Support the graphics card while inserting it. Keep fingers away from contacts and fans.",
    verify:
      "The card is seated in the PCIe slot, the bracket is flush, screws are secure, and required power is latched.",
    avoid:
      "Tilting the card, missing the rear bracket opening, or forgetting supplemental power.",
    simulation:
      "Enter the case magnetic field and release early. The GPU follows a collision-safe lift-over-lower route before the completed case animates upright.",
  },
};

const intelCpuAssembly = {
  title: "Prepare to Install the CPU",
  summary:
    "The Central Processing Unit (CPU) is the brain of the computer. It is inserted into the CPU socket on the motherboard using its markers and notches for correct orientation.",
  procedure: [
    "Place the motherboard flat and open the CPU socket retention mechanism.",
    "Match the processor marker and notches with the socket, then lower the CPU vertically by its edges.",
    "Confirm the CPU sits flat in the socket before closing and locking the retention mechanism.",
    "Remember that the CPU fan and heatsink reduce processor heat so the computer does not shut down automatically.",
  ],
  safety:
    "Intel socket pins are in the motherboard socket. Do not touch them or drag the CPU across them.",
  verify:
    "The CPU is flat in the keyed socket and the retention mechanism closes without unusual resistance.",
  avoid:
    "Pressing the CPU down, touching socket pins or contact pads, or closing the load plate over a misaligned processor.",
  simulation:
    "Drag the CPU into the motherboard's invisible field and release before contact. The animation lowers it vertically and applies the corrected socket seating depth.",
};

const amdCpuAssembly = {
  ...intelCpuAssembly,
  safety:
    "CPU sockets come in pin-grid array and land-grid array types. On pin-grid CPUs, do not touch or bend the underside pins.",
  avoid:
    "Pressing the CPU into the socket, touching pins or contacts, or closing the arm while the processor is not flat.",
};

const disassemblyBase = {
  gpu: {
    title: "Prepare to Remove the GPU",
    summary:
      "The video card, also called a graphics card or display adapter, is the expansion card that generates images for the monitor.",
    procedure: [
      "Shut down the computer, turn off the PSU, unplug AC power, and discharge remaining power.",
      "Disconnect any PCIe power plug by its connector body.",
      "Remove the rear bracket screw and release the motherboard expansion-slot latch.",
      "Hold the video card by its edges and lift it out without twisting the slot.",
    ],
    safety:
      "Support the card's weight before releasing the slot latch. Keep fingers away from contacts and fans.",
    verify:
      "No power cable or screw remains attached, the slot latch is open, and the edge connector clears the slot.",
    avoid:
      "Pulling before the retention latch is released or rocking the card sideways in the expansion slot.",
    simulation:
      "Drag the GPU into the open table workspace. Once it enters the broad invisible field, release it and let the animated magnetic route complete the seating.",
  },
  motherboard: {
    title: "Prepare to Remove the Motherboard",
    summary:
      "The motherboard is the computer's main printed circuit board. It holds sockets, slots, controllers, power connections, and expansion areas.",
    procedure: [
      "Disconnect power, SATA, fan, front-panel, USB, audio, and other cables from the system board.",
      "Remove each motherboard mounting screw while supporting the board.",
      "Grip two strong board edges and lift the motherboard level from the standoffs.",
      "Move the rear port area clear of the case before carrying the board to the table.",
    ],
    safety:
      "Do not flex the board or use the CPU holder, RAM slots, ports, or connectors as handles.",
    verify:
      "The board lifts without snagging, every screw and cable is free, and mounted parts remain secure.",
    avoid:
      "Leaving one hidden screw attached or resting the soldered underside on metal.",
    simulation:
      "Move the whole populated motherboard toward the table. The mounted CPU, SSD, and RAM travel with it and become clickable only after the board is seated.",
  },
  ssd: {
    title: "Prepare to Remove the SSD",
    summary:
      "Solid state drives use solid state memory instead of moving parts, making them faster and more durable than hard disks.",
    procedure: [
      "Locate the SSD retaining screw or latch and support the free end before release.",
      "Let the drive rise only as much as the socket allows.",
      "Hold the side edges and pull the connector straight out along the slot direction.",
      "Store any tiny retaining hardware in a labeled area.",
    ],
    safety:
      "Handle the SSD by its edges and avoid touching the connector, memory chips, or controller area.",
    verify:
      "The retaining point is released and the SSD connector leaves the socket without scraping.",
    avoid:
      "Prying the SSD while it is still secured or pulling it vertically against the connector.",
    simulation:
      "Drag the SSD away from the seated motherboard and into the table field; the magnetic animation will align it with its storage position.",
  },
  ram: {
    title: "Prepare to Remove Both RAM Modules",
    summary:
      "RAM is temporary memory installed in the motherboard memory holder or DIMM slots. Either module may be removed first in this stage.",
    procedure: [
      "Open the retaining latch or latches for the selected memory module.",
      "Grip the RAM at the top corners and lift evenly from the DIMM slot.",
      "Place the module on an antistatic surface, then repeat for the remaining RAM module.",
      "Keep the two memory modules together and note their original slots.",
    ],
    safety:
      "Use only the top and side edges. Do not touch gold contacts or press on surface-mounted chips.",
    verify:
      "Each latch is fully open and each RAM module clears the slot evenly with no bending.",
    avoid:
      "Pulling one end first, using excessive force, or forgetting that both modules must be removed before continuing.",
    simulation:
      "Select either RAM stick first. After it seats on the table, remove the other; the next stage unlocks only when both are complete.",
  },
  hdd: {
    title: "Prepare to Remove the HDD",
    summary:
      "A hard disk drive stores data permanently on spinning platters. SATA data connects it to the motherboard and SATA power connects it to the PSU.",
    procedure: [
      "Disconnect SATA data and SATA power by their molded plugs, not by the wires.",
      "Support the drive while removing screws, tabs, rails, or tray locks.",
      "Slide the HDD straight out of its bay without hitting the case.",
      "Place the drive flat on a stable antistatic area.",
    ],
    safety:
      "Do not drop, shake, or sharply impact a hard drive. Keep tools away from its circuit board.",
    verify:
      "Both cables are disconnected, all mounts are released, and the drive slides freely while supported.",
    avoid:
      "Using SATA connectors as handles or allowing the drive's weight to hang from a cable.",
    simulation:
      "Carry the HDD into the table magnetic field and release it before the highlighted seat; the animation handles the final approach.",
  },
  psu: {
    title: "Prepare to Remove the PSU",
    summary:
      "The PSU supplies power to the computer by converting AC current into regulated DC current for the motherboard, drives, and expansion cards.",
    procedure: [
      "Trace and disconnect every PSU lead, including motherboard, CPU, GPU, SATA, and peripheral power.",
      "Support the PSU from inside the case before removing the rear screws.",
      "Slide the unit out of its bay while keeping cables clear of fans and brackets.",
      "Set the PSU down securely without opening its enclosure.",
    ],
    safety:
      "Never open a PSU enclosure. Rated PSUs are more reliable and may include safer voltage protection than generic units.",
    verify:
      "No power lead remains connected, all rear screws are removed, and the PSU exits the bay without snagging.",
    avoid:
      "Removing screws before supporting the PSU or attempting to service internal PSU components.",
    simulation:
      "Move the PSU into the table field. Its animated route preserves the installed rotation and lowers it smoothly into the final seat.",
  },
};

const intelCpuDisassembly = {
  title: "Prepare to Remove the CPU",
  summary:
    "The CPU is the computer's central processing unit. The PDF identifies CPU sockets as pin-grid array or land-grid array, so socket handling depends on the platform.",
  procedure: [
    "Disconnect the CPU-fan lead because the fan and heatsink remove heat from the processor.",
    "Release the cooler, then open the CPU socket retention mechanism.",
    "Lift the processor straight up by its edges using the marker and notches as orientation references.",
    "Place the CPU in a protective tray and keep the open motherboard socket untouched.",
  ],
  safety:
    "Intel LGA pins are in the motherboard socket and bend easily. Keep fingers, tools, and loose screws away.",
  verify:
    "The cooler is free, the retention mechanism is open, and the CPU lifts vertically without friction.",
  avoid:
    "Touching socket pins or CPU contact pads, dragging the CPU across the socket, or forcing the load plate.",
  simulation:
    "Lift the CPU away from the socket and guide it toward the table field. The magnet will animate the final protected placement.",
};

const amdCpuDisassembly = {
  ...intelCpuDisassembly,
  safety:
    "On pin-grid CPUs, do not touch or bend the underside pins. Release bonded thermal paste before lifting the cooler.",
  avoid:
    "Forcing the retention arm, twisting the CPU in the socket, or resting pins on the work surface.",
};

export const PDF_BASED_ASSEMBLY_GUIDES = Object.freeze({
  amd: Object.freeze({
    cpu: amdCpuAssembly,
    ...assemblyBase,
    final: {
      title: "Final Unguided Assembly Challenge",
      summary:
        "Build the computer from the PDF's major hardware components: motherboard, CPU, RAM, PSU, video card, and storage drives.",
      procedure: [
        "Install the CPU and remember the fan and heatsink are needed to reduce processor heat.",
        "Install both RAM modules in the motherboard memory holders, then install solid state storage.",
        "Install the motherboard, PSU, hard disk drive, and video card in the case.",
        "Before finishing, verify power, storage, expansion-card, and cooling connections.",
      ],
      safety:
        "A correct sequence does not replace inspection. Stop whenever alignment, connector state, or clearance is uncertain.",
      verify:
        "CPU, both RAM modules, SSD, motherboard, PSU, HDD, and GPU are fully seated; the completed chassis then transitions upright.",
      avoid:
        "Using force, skipping a socket or slot check, or forgetting that the PSU powers the computer's internal parts.",
      simulation:
        "Complete CPU -> both RAM modules (either first) -> SSD -> motherboard -> PSU -> HDD -> GPU. No target highlights are shown.",
    },
  }),
  intel: Object.freeze({
    cpu: intelCpuAssembly,
    ...assemblyBase,
    final: {
      title: "Final Unguided Assembly Challenge",
      summary:
        "Build the computer from the PDF's major hardware components: motherboard, CPU, RAM, PSU, video card, and storage drives.",
      procedure: [
        "Install the CPU and remember the fan and heatsink are needed to reduce processor heat.",
        "Install both RAM modules in the motherboard memory holders, then install solid state storage.",
        "Install the motherboard, PSU, hard disk drive, and video card in the case.",
        "Before finishing, verify power, storage, expansion-card, and cooling connections.",
      ],
      safety:
        "A correct sequence does not replace inspection. Stop whenever alignment, connector state, or clearance is uncertain.",
      verify:
        "CPU, both RAM modules, SSD, motherboard, PSU, HDD, and GPU are fully seated; the completed chassis then transitions upright.",
      avoid:
        "Using force, skipping a socket or slot check, or forgetting that the PSU powers the computer's internal parts.",
      simulation:
        "Complete CPU -> both RAM modules (either first) -> SSD -> motherboard -> PSU -> HDD -> GPU. No target highlights are shown.",
    },
  }),
});

export const PDF_BASED_DISASSEMBLY_GUIDES = Object.freeze({
  amd: Object.freeze({
    ...disassemblyBase,
    cpu: amdCpuDisassembly,
    final: {
      title: "Final Unguided Disassembly Challenge",
      summary:
        "Disassemble the major hardware components described in the PDF while protecting sockets, slots, storage, power connections, and expansion cards.",
      procedure: [
        "Remove the video card first, then move the motherboard assembly to the table.",
        "Remove solid state storage, both RAM modules, and the CPU from the motherboard.",
        "Finish with the hard disk drive and the power supply unit.",
        "Pause before every movement to verify cables, screws, latches, support, and a clear travel path.",
      ],
      safety:
        "No guide highlight means you must identify every connector and retention point yourself. Never use force to compensate for uncertainty.",
      verify:
        "All eight components are safely seated on the table and the validated order has been followed from start to finish.",
      avoid:
        "Guessing, skipping a latch or cable check, or servicing board-mounted parts before the motherboard is seated.",
      simulation:
        "Complete GPU -> motherboard -> SSD -> both RAM modules (either order) -> CPU -> HDD -> PSU. Magnetic seating remains active, but guide highlights are hidden.",
    },
  }),
  intel: Object.freeze({
    ...disassemblyBase,
    cpu: intelCpuDisassembly,
    final: {
      title: "Final Unguided Disassembly Challenge",
      summary:
        "Disassemble the major hardware components described in the PDF while protecting sockets, slots, storage, power connections, and expansion cards.",
      procedure: [
        "Remove the video card first, then move the motherboard assembly to the table.",
        "Remove solid state storage, both RAM modules, and the CPU from the motherboard.",
        "Finish with the hard disk drive and the power supply unit.",
        "Pause before every movement to verify cables, screws, latches, support, and a clear travel path.",
      ],
      safety:
        "No guide highlight means you must identify every connector and retention point yourself. Never use force to compensate for uncertainty.",
      verify:
        "All eight components are safely seated on the table and the validated order has been followed from start to finish.",
      avoid:
        "Guessing, skipping a latch or cable check, or servicing board-mounted parts before the motherboard is seated.",
      simulation:
        "Complete GPU -> motherboard -> SSD -> both RAM modules (either order) -> CPU -> HDD -> PSU. Magnetic seating remains active, but guide highlights are hidden.",
    },
  }),
});
