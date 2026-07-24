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
    ["What Is a Computer?", "A computer is an electronic device that accepts input, processes data, stores information, and produces output. It is made of hardware, software, users, data, and procedures working together."],
    ["Types of Computers", "Common computer types include desktop computers, laptops, servers, tablets, smartphones, and embedded systems. Each type is designed for different levels of portability, power, and purpose."],
    ["Computer System Basics", "A computer system combines input devices, processing components, storage devices, output devices, and communication tools. These parts work together to receive, process, save, and present information."],
    ["Major Hardware Components", "Important internal parts include the motherboard, CPU, RAM, storage drives, power supply, cooling devices, and expansion cards. External parts include the monitor, keyboard, mouse, printer, and speakers."],
    ["Motherboard and Expansion", "The motherboard connects the main computer parts. It contains sockets, slots, chipsets, ports, power connectors, and expansion areas for devices such as graphics, network, and sound cards."],
    ["CPU and Cooling", "The CPU performs instructions and acts as the main processing unit. A heatsink, fan, or liquid cooler keeps the CPU temperature safe during operation."],
    ["Memory: RAM and ROM", "RAM temporarily stores active programs and data while the computer is on. ROM or firmware stores startup instructions that help the computer boot and initialize hardware."],
    ["Storage and Media", "Storage devices keep files and programs even when power is off. Examples include HDDs, SSDs, optical discs, flash drives, and memory cards."],
    ["Ports and Cables", "Ports and cables connect devices and transfer data or power. Examples include USB, HDMI, Ethernet, audio ports, SATA, ATX power, and front-panel connectors."],
    ["Power Supply Quality", "A reliable power supply converts AC power to stable DC power for computer components. Good PSU quality protects parts from unstable voltage and supports safe operation."],
    ["Quick Review", "Identify the purpose of each major component, how devices connect to the motherboard, and why power, cooling, memory, and storage are all needed for a working computer."],
  ],
  module_2: [
    ["Disassembly Workflow", "Disassembly is the controlled process of opening a computer, documenting what is connected, and removing parts without damaging boards, ports, screws, or cables."],
    ["1. Prepare and Power Down", "Shut down the operating system, switch off the PSU, unplug AC power, and hold the power button for a few seconds to discharge remaining electricity. Work on a clean table with good lighting."],
    ["2. Document Before Removing", "Take photos before disconnecting anything. Label cable routes, front-panel header positions, SATA ports, fan headers, and power connectors so reassembly is easier."],
    ["3. Remove Parts in a Safe Order", "Remove external cables first, then the side panel, expansion cards, storage drives, RAM, CPU cooler, CPU, PSU, and motherboard. Release every screw, latch, clip, and cable first."],
    ["Connector Awareness", "Handle connectors by the plug, not the wires. Learn the shape and locking style of SATA, ATX power, CPU power, PCIe, fan, USB, audio, and front-panel connectors."],
    ["CPU, RAM, and Expansion Cards", "Release RAM slot tabs, lift cards after removing screws and latches, and remove the CPU cooler before unlocking the CPU socket. Hold parts by their edges."],
    ["Storage and Optical Drives", "Disconnect data and power cables before removing storage devices. Avoid dropping HDDs because internal moving parts can be damaged."],
    ["Organize Everything", "Group screws by location, use labeled containers, hold boards by their edges, avoid touching gold contacts, and keep removed parts away from dust, liquids, and static discharge."],
    ["Common Mistakes to Avoid", "Do not force stuck connectors, mix screw lengths, scrape the motherboard, stack bare circuit boards, remove a CPU carelessly, or forget to reconnect the cooler fan."],
  ],
  module_3: [
    ["Assembly Workflow", "Assembly follows a planned order: prepare the case, prepare the motherboard, mount parts securely, connect cables, then test before closing the system."],
    ["1. Prepare the Case", "Install motherboard standoffs only where the board has screw holes, align the rear I/O shield, plan airflow, and clear cable paths before mounting the board."],
    ["2. Install CPU, Cooler, and RAM", "Match CPU markers, lower the CPU gently, lock the socket, apply thermal paste if needed, mount the cooler evenly, connect the CPU fan, and install RAM in recommended slots."],
    ["3. Mount the Motherboard", "Lower the board into the case by the edges, align ports and standoffs, then tighten screws until secure without overtightening."],
    ["Cables and Headers", "Connect the 24-pin ATX cable, CPU power, SATA data and power, fans, front-panel pins, USB, and audio headers. Check the motherboard manual for small header labels."],
    ["Storage and Expansion Cards", "Mount drives firmly, connect SATA data and power, insert expansion cards into the correct PCIe slot, secure brackets, and connect required PCIe power cables."],
    ["Power Supply Check", "Use a PSU that matches the system requirements. Confirm every required power connector is fully seated before turning the computer on."],
    ["First Boot Check", "Before powering on, confirm RAM clips are locked, the CPU cooler fan is connected, GPU and storage are secure, and loose cables are away from fans."],
    ["Cable Management", "Route extra cables along case edges or behind the motherboard tray to improve airflow, keep fans clear, and make future troubleshooting easier."],
    ["If It Does Not Boot", "Check wall power, PSU switch, monitor input, front-panel power switch pins, 24-pin and CPU power cables, RAM seating, GPU seating, and display cable location."],
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
