import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { ExternalLink, Inbox, Search } from "lucide-react";
import { db } from "../firebase";

const statusStyles = {
  open: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  in_progress: "border-blue-400/25 bg-blue-400/10 text-blue-200",
  resolved: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
};

function formatDate(value) {
  const date = value?.toDate?.() || (value?.seconds ? new Date(value.seconds * 1000) : null);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "Date unavailable";
}

function statusLabel(status) {
  if (status === "in_progress") return "In progress";
  return status === "resolved" ? "Resolved" : "Open";
}

export default function AdminSupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");

  useEffect(() => onSnapshot(
    collection(db, "supportTickets"),
    (snapshot) => {
      setTickets(snapshot.docs.map((ticket) => ({ id: ticket.id, ...ticket.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setLoading(false);
      setError("");
    },
    (snapshotError) => {
      console.error("Unable to load support tickets:", snapshotError);
      setError("Support tickets could not be loaded. Check the deployed Firestore rules and try again.");
      setLoading(false);
    },
  ), []);

  const filteredTickets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const status = ticket.status || "open";
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesSearch = !term || [ticket.name, ticket.email, ticket.subject, ticket.message]
        .some((value) => String(value || "").toLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, tickets]);

  const counts = useMemo(() => ({
    all: tickets.length,
    open: tickets.filter((ticket) => (ticket.status || "open") === "open").length,
    in_progress: tickets.filter((ticket) => ticket.status === "in_progress").length,
    resolved: tickets.filter((ticket) => ticket.status === "resolved").length,
  }), [tickets]);

  const updateStatus = async (ticketId, status) => {
    setSavingId(ticketId);
    setError("");
    try {
      await updateDoc(doc(db, "supportTickets", ticketId), { status });
    } catch (updateError) {
      console.error("Unable to update support ticket:", updateError);
      setError("The ticket status could not be updated.");
    } finally {
      setSavingId("");
    }
  };

  return <section className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[['all', 'All tickets'], ['open', 'Open'], ['in_progress', 'In progress'], ['resolved', 'Resolved']].map(([status, label]) => (
        <button key={status} type="button" onClick={() => setStatusFilter(status)} className={[
          "rounded-[24px] border p-5 text-left transition",
          statusFilter === status ? "border-[#FFD41C]/45 bg-[#FFD41C]/10" : "border-[#1a2438] bg-[#0d1220] hover:bg-white/[0.04]",
        ].join(" ")}>
          <span className="text-sm text-[#9fb0c9]">{label}</span>
          <strong className="mt-2 block text-3xl text-white">{counts[status]}</strong>
        </button>
      ))}
    </div>

    <div className="rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8ba8]" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by student, email, subject, or message" className="w-full rounded-2xl border border-[#1a2438] bg-[#0b1220] py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-[#FFD41C]/50" />
      </label>
    </div>

    {error && <p role="alert" className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
    {loading ? <p className="text-[#9fb0c9]">Loading support tickets...</p> : filteredTickets.length === 0 ? (
      <div className="rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-10 text-center text-[#9fb0c9]">
        <Inbox className="mx-auto mb-4 h-9 w-9 text-[#FFD41C]" />
        No support tickets match this view.
      </div>
    ) : <div className="space-y-4">{filteredTickets.map((ticket) => {
      const status = ticket.status || "open";
      return <article key={ticket.id} className="rounded-[28px] border border-[#1a2438] bg-[#0d1220] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="break-words text-xl font-bold text-white">{ticket.subject || "No subject"}</h2>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status] || statusStyles.open}`}>{statusLabel(status)}</span>
            </div>
            <p className="mt-2 break-words text-sm text-[#9fb0c9]">{ticket.name || "Unknown student"} · {ticket.email || "No email"}</p>
            <p className="mt-1 text-xs text-[#7a8ba8]">Submitted {formatDate(ticket.createdAt)}</p>
          </div>
          <select aria-label={`Status for ${ticket.subject || "support ticket"}`} value={status} disabled={savingId === ticket.id} onChange={(event) => updateStatus(ticket.id, event.target.value)} className="rounded-xl border border-[#1a2438] bg-[#0b1220] px-4 py-2 text-sm text-white disabled:opacity-50">
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <p className="mt-5 whitespace-pre-wrap break-words rounded-2xl border border-[#1a2438] bg-white/[0.025] p-4 text-sm leading-7 text-[#dbe6f5]">{ticket.message || "No message provided."}</p>
        {ticket.screenshotURL && <a href={ticket.screenshotURL} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#FFD41C]/30 bg-[#FFD41C]/10 px-4 py-2 text-sm font-semibold text-[#FFD41C]">View attached screenshot <ExternalLink className="h-4 w-4" /></a>}
      </article>;
    })}</div>}
  </section>;
}
