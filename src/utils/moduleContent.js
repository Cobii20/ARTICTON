import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase";

export const MODULE_MEDIA_TYPES = ["none", "asset", "image", "gif", "video", "embed"];

export const EDITABLE_MODULES = [
  {
    id: "module_1",
    title: "Introduction to PC Parts",
    description: "Learn about essential computer components",
    index: 1,
  },
  {
    id: "module_2",
    title: "Disassembly",
    description: "Take apart and understand components",
    index: 2,
  },
  {
    id: "module_3",
    title: "Assembly",
    description: "Build your own PC from scratch",
    index: 3,
  },
  {
    id: "module_4",
    title: "Software & Networking",
    description: "Operating systems and network basics",
    index: 4,
  },
];

const STARTER_ROWS = {
  module_1: [
    ["Learning Outcomes", "At the end of the PDF chapter, students are expected to know what a computer system is, differentiate its components, enumerate RAM types, recognize common storage drives, list optical media, and understand ports and cables."],
    ["What Is a Computer?", "A computer is an electronic machine that manipulates information or data. It can input, process, retrieve, and store data, turning raw facts into organized and useful information."],
    ["Characteristics of a Computer", "The PDF describes a computer as a machine that needs human intervention, is electronic, can operate automatically after instruction, manipulates data, and has memory for storing and retrieving information."],
    ["Types of Computers", "Computer types in the PDF include personal computers, minicomputers, mainframe computers, supercomputers, and workstations. Personal computers include notebooks, desktops, laptops, handhelds, palmtops, and PDAs."],
    ["Computer System", "A computer system consists of hardware, software, an operating system, and application programs."],
    ["Major Hardware Components", "The PDF lists major hardware components as the motherboard, Central Processing Unit (CPU), Random Access Memory (RAM), power supply, video card, and hard drives or floppy drives."],
    ["Motherboard", "The motherboard, also called the system board, is the main printed circuit board. It contains sockets or slots that accept additional boards and lets major computer parts connect and communicate."],
    ["Motherboard Parts", "Important motherboard areas include the CPU holder, memory holder, power supply controller, northbridge and southbridge chipsets, CMOS or BIOS chip, CMOS battery, IDE and SATA controllers, expansion slots, front-panel pins, and back-panel ports."],
    ["Central Processing Unit", "The CPU is the brain of the computer. It carries out program instructions by performing arithmetic, logical, control, and input/output operations. New CPUs are installed directly into a CPU socket on the motherboard."],
    ["CPU Fan and Heatsink", "The CPU fan and heatsink reduce heat from the processor so the computer does not shut down automatically."],
    ["RAM and Memory Types", "Random Access Memory, or a DIMM memory module, allows stored data to be accessed randomly and stores data temporarily. The PDF also distinguishes RAM from ROM and lists SRAM, DRAM, ROM, PROM, EPROM, and EEPROM."],
    ["Types of RAM", "The PDF identifies RAM examples and generations including FPM, EDO, SDRAM, RDRAM, DDR, DDR2, DDR3, and DDR4. RAM module details can include manufacturer, type, density, speed or frequency, and latency."],
    ["Hard Disk Drive", "A Hard Disk Drive, or hard drive, is a main storage device used to store computer data permanently. It uses spinning platters, magnetic coating, and read/write heads."],
    ["Solid State Storage", "Solid state storage devices have no moving parts and are more reliable and power-efficient than hard disks. SSDs use solid state memory and are faster, more durable, more expensive, and often lower in capacity than HDDs."],
    ["Optical Disc Drive", "An optical disc drive reads or writes data on a disc. Optical media in the PDF include CD, DVD, and Blu-ray discs, with read-only, write-once, and rewritable formats."],
    ["Power Supply Unit", "The Power Supply Unit, or PSU, supplies power to the personal computer by converting AC current to DC current and regulating voltage to reduce spikes and surges."],
    ["Video, Network, and Sound Cards", "A video card, also called a graphics card or display adapter, generates and displays output images. A Network Interface Card connects computers to a network. A sound card handles audio input and output signals."],
    ["Ports and Cables", "Ports are connecting sockets on the outside of the system unit. The PDF lists VGA, DVI, USB, FireWire, Ethernet, serial, parallel, network, S/PDIF, HDMI, and MIDI ports, plus legacy ports for older devices."],
    ["Storage Cables", "EIDE data cables connect EIDE hard drives to the motherboard. SATA data cables connect SATA hard drives to the motherboard."],
  ],
  module_2: [
    ["Disassembly Goal", "Disassembly practice focuses on identifying and safely removing the major hardware parts named in the PDF: motherboard, CPU, RAM, PSU, video card, hard drive, and storage devices."],
    ["Motherboard First Facts", "The motherboard is the system board and main printed circuit board. During disassembly, protect its sockets, slots, front-panel pins, controllers, and back-panel ports."],
    ["CPU and Cooling", "The CPU is installed in a motherboard socket and the fan and heatsink reduce heat from the processor. Remove cooling carefully before handling the CPU socket area."],
    ["RAM Modules", "RAM is temporary memory installed in the motherboard memory holder or DIMM slot. During removal, release the memory holder and handle the module by its edges."],
    ["Storage Drives", "The hard drive stores data permanently, while solid state drives use solid state memory without moving parts. Disconnect storage through the correct data and power connections before removing drives."],
    ["PSU Awareness", "The PSU supplies power by converting AC current to regulated DC current. Before removing it, trace and disconnect all power leads that feed the motherboard, drives, and expansion cards."],
    ["Expansion Cards", "Video, network, and sound cards are expansion cards. The video card displays output images, the NIC connects to a network, and the sound card handles audio signals."],
    ["Ports and Cables", "Use the PDF port and cable names while identifying connections: SATA, EIDE, USB, Ethernet, audio, display, serial, parallel, and front-panel wiring."],
  ],
  module_3: [
    ["Assembly Goal", "Assembly practice builds the major hardware set from the PDF: motherboard, CPU, RAM, PSU, video card, hard drive, and solid state storage."],
    ["Install the Motherboard", "The motherboard is the system board. It contains sockets and slots for the CPU, RAM, power connections, storage controllers, expansion cards, and back-panel ports."],
    ["Install the CPU", "The CPU is the brain of the computer and is inserted directly into the CPU socket on the motherboard. Use the socket type and orientation markers to seat it correctly."],
    ["Install CPU Cooling", "The CPU fan and heatsink help reduce processor heat so the computer does not shut down automatically."],
    ["Install RAM", "RAM, also called a DIMM memory module, stores data temporarily. Seat the module in the motherboard memory holder and confirm the keyed slot is aligned."],
    ["Install Storage", "Install permanent storage devices such as HDDs and SSDs. HDDs use magnetic platters, while SSDs use solid state memory with no moving parts."],
    ["Connect Storage Cables", "Use SATA data cables to connect SATA hard drives to the motherboard. EIDE cables are used for older EIDE hard drives and optical drives."],
    ["Install the PSU", "The PSU supplies computer power by converting AC current to DC current and regulating voltage to reduce spikes and surges."],
    ["Install Expansion Cards", "Install the video card for monitor output and recognize that network and sound cards are also expansion cards for communication and audio functions."],
    ["Check Ports and Cables", "Before testing, identify outside ports such as VGA, DVI, USB, Ethernet, HDMI, audio, serial, and parallel connections, then confirm internal cables are seated."],
  ],
  module_4: [
    ["1. Operating System Setup", "After hardware assembly, the operating system makes the computer usable. Setup includes choosing the boot device, installing Windows or Linux, creating a user account, setting region, and checking partitions."],
    ["Video Guide: First Setup and Network Check", "Use this card for a tutorial about OS installation, driver checks, Wi-Fi or Ethernet setup, and a basic network test."],
    ["2. Drivers and Device Manager", "Drivers let the OS communicate with hardware. Check chipset, graphics, audio, LAN/Wi-Fi, Bluetooth, and storage drivers. Device Manager can show missing drivers."],
    ["3. Updates and Essential Apps", "Run system updates before installing many apps. Updates patch security issues, improve compatibility, and may install hardware drivers."],
    ["4. File Management and Backups", "Use clear folder names, separate school files from installers and downloads, and keep important files backed up on another drive or trusted cloud storage."],
    ["5. Networking Devices", "A modem connects to the internet provider, a router directs traffic, a switch adds wired ports, and an access point provides Wi-Fi coverage."],
    ["6. IP Addressing Basics", "Each device needs an IP address. DHCP assigns addresses automatically, static IPs are manual, subnet masks define local networks, gateways point to routers, and DNS resolves names."],
    ["7. Wi-Fi and Ethernet Setup", "Ethernet is usually faster and more stable. Wi-Fi needs the correct SSID, password, signal strength, and security type. If connected but offline, check IP, router, and DNS settings."],
    ["8. Security Checklist", "Use strong passwords, enable automatic updates, keep antivirus active, avoid suspicious downloads, lock the device when unattended, and limit administrator access."],
    ["9. Basic Troubleshooting Flow", "Check the simplest layer first: power, cables, restart, device recognition, driver status, IP address, gateway, DNS, then the app or website."],
  ],
};

const STARTER_ASSETS = {
  "module_1|Motherboard and Expansion": "assets/images/module1/motherboard-28.png",
  "module_1|CPU and Cooling": "assets/images/module1/cpu-48.png",
  "module_1|Memory: RAM and ROM": "assets/images/module1/ram-60.png",
  "module_1|Storage and Media": "assets/images/module1/ssd-73.png",
  "module_1|Ports and Cables": "assets/images/module1/ports-76.png",
  "module_1|Power Supply Quality": "assets/images/module1/power-75.png",
  "module_2|Disassembly Workflow": "assets/images/module2/module2_disassembly_infographic.png",
  "module_3|Assembly Workflow": "assets/images/module3/module3_assembly_infographic.png",
};

function normalizeCard(card, fallbackSortOrder = 0) {
  const mediaType = MODULE_MEDIA_TYPES.includes(card.mediaType) ? card.mediaType : "none";
  const sortOrder = Number(card.sortOrder);

  return {
    id: String(card.id || `${Date.now()}_${fallbackSortOrder}`),
    title: String(card.title || "").trim(),
    details: String(card.details || "").trim(),
    mediaType,
    mediaUrl: String(card.mediaUrl || "").trim(),
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : fallbackSortOrder,
  };
}

function normalizeCardsForSave(cards) {
  return cards.map((card, index) => ({
    ...normalizeCard(card, index),
    sortOrder: index,
  }));
}

export function starterCardsForModule(moduleId) {
  return (STARTER_ROWS[moduleId] || []).map(([title, details], index) => {
    const mediaUrl = STARTER_ASSETS[`${moduleId}|${title}`] || "";
    return normalizeCard(
      {
        id: `${moduleId}_starter_${index}`,
        title,
        details,
        mediaType: mediaUrl ? "asset" : "none",
        mediaUrl,
      },
      index
    );
  });
}

export async function loadApprovedCards(moduleId) {
  const snapshot = await getDocs(
    query(collection(db, "module_content_cards"), where("moduleId", "==", moduleId))
  );
  return snapshot.docs
    .map((cardDoc, index) => normalizeCard({ id: cardDoc.id, ...cardDoc.data() }, index))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function loadEditableCards(moduleId) {
  const approvedCards = await loadApprovedCards(moduleId);
  return approvedCards.length ? approvedCards : starterCardsForModule(moduleId);
}

export async function submitModuleChangeRequest({ module, summary, cards }) {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error("You must be signed in.");

  const normalizedCards = normalizeCardsForSave(cards).filter((card) => card.title || card.details);
  if (!normalizedCards.length) throw new Error("Add at least one content card.");

  await addDoc(collection(db, "module_change_requests"), {
    moduleId: module.id,
    moduleTitle: module.title,
    summary: summary.trim() || "Module content update",
    status: "pending",
    requestedBy: user.uid,
    requestedByEmail: user.email || "",
    createdAt: serverTimestamp(),
    cards: normalizedCards,
  });
}

export async function loadModuleChangeRequests({ status, requestedBy } = {}) {
  const filters = [];
  if (status) filters.push(where("status", "==", status));
  if (requestedBy) filters.push(where("requestedBy", "==", requestedBy));

  const snapshot = await getDocs(query(collection(db, "module_change_requests"), ...filters));
  return snapshot.docs
    .map((requestDoc) => {
      const data = requestDoc.data();
      const cards = Array.isArray(data.cards)
        ? data.cards
            .map((card, index) => normalizeCard(card, index))
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [];

      return {
        id: requestDoc.id,
        ...data,
        cards,
      };
    })
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
}

export async function approveModuleChangeRequest(changeRequest) {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error("You must be signed in.");

  const existing = await getDocs(
    query(
      collection(db, "module_content_cards"),
      where("moduleId", "==", changeRequest.moduleId)
    )
  );
  const batch = writeBatch(db);

  existing.docs.forEach((cardDoc) => batch.delete(cardDoc.ref));
  normalizeCardsForSave(changeRequest.cards).forEach((card) => {
    batch.set(doc(collection(db, "module_content_cards")), {
      ...card,
      moduleId: changeRequest.moduleId,
      moduleTitle: changeRequest.moduleTitle,
      sourceRequestId: changeRequest.id,
      approvedBy: user.uid,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  batch.update(doc(db, "module_change_requests", changeRequest.id), {
    status: "approved",
    reviewedBy: user.uid,
    reviewedAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function rejectModuleChangeRequest(changeRequest) {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error("You must be signed in.");

  await updateDoc(doc(db, "module_change_requests", changeRequest.id), {
    status: "rejected",
    reviewedBy: user.uid,
    reviewedAt: serverTimestamp(),
  });
}
