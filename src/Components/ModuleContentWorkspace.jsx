import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Plus,
  RefreshCw,
  Send,
  ChevronDown,
  Trash2,
  X,
} from "lucide-react";
import {
  EDITABLE_MODULES,
  MODULE_MEDIA_TYPES,
  approveModuleChangeRequest,
  loadEditableCards,
  loadModuleChangeRequests,
  rejectModuleChangeRequest,
  submitModuleChangeRequest,
} from "../utils/moduleContent";

const panelClass =
  "rounded-[28px] border border-[#1a2438] bg-[#0d1220] shadow-[0_25px_80px_rgba(0,0,0,0.25)]";

function makeEmptyCard(index) {
  return {
    id: `${Date.now()}_${index}`,
    title: "",
    details: "",
    mediaType: "none",
    mediaUrl: "",
    sortOrder: index,
  };
}

function formatDate(value) {
  if (!value) return "Just now";
  const date =
    typeof value.toDate === "function"
      ? value.toDate()
      : typeof value.seconds === "number"
      ? new Date(value.seconds * 1000)
      : new Date(value);

  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function youtubeEmbedUrl(value) {
  const source = String(value || "").trim();
  if (!source) return "";

  const iframeSrc = source.match(/src=["']([^"']+)["']/i)?.[1] || source;
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/,
  ];
  const videoId = patterns.map((pattern) => iframeSrc.match(pattern)?.[1]).find(Boolean);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
}

export default function ModuleContentWorkspace({ mode = "faculty", user }) {
  const [selectedModuleId, setSelectedModuleId] = useState(EDITABLE_MODULES[0].id);
  const [cards, setCards] = useState([]);
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState("");
  const [loadingCards, setLoadingCards] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const cardsEndRef = useRef(null);

  const notify = useCallback((type, text) => {
    setToast({ id: Date.now(), type, text });
  }, []);

  const selectedModule = useMemo(
    () => EDITABLE_MODULES.find((module) => module.id === selectedModuleId) || EDITABLE_MODULES[0],
    [selectedModuleId]
  );

  const loadCards = useCallback(async () => {
    try {
      setLoadingCards(true);
      setError("");
      const editableCards = await loadEditableCards(selectedModule.id);
      setCards(editableCards);
    } catch (err) {
      console.error("Error loading module cards:", err);
      setError("Unable to load approved module content.");
    } finally {
      setLoadingCards(false);
    }
  }, [selectedModule.id]);

  const loadRequests = useCallback(async () => {
    try {
      setLoadingRequests(true);
      if (mode !== "admin" && !user?.uid) {
        setRequests([]);
        return;
      }

      const nextRequests = await loadModuleChangeRequests(
        mode === "admin"
          ? { status: "pending" }
          : user?.uid
          ? { requestedBy: user.uid }
          : {}
      );
      setRequests(nextRequests);
    } catch (err) {
      console.error("Error loading module requests:", err);
      setError("Unable to load module change requests.");
    } finally {
      setLoadingRequests(false);
    }
  }, [mode, user?.uid]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!toast) return undefined;

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 3600);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const updateCard = (index, field, value) => {
    setCards((prev) =>
      prev.map((card, cardIndex) =>
        cardIndex === index
          ? {
              ...card,
              [field]: value,
              mediaUrl:
                field === "mediaUrl"
                  ? value
                  : field === "mediaType" && value === "none"
                  ? card.mediaUrl
                  : card.mediaUrl,
            }
          : card
      )
    );
  };

  const moveCard = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= cards.length) return;

    setCards((prev) => {
      const next = [...prev];
      const [card] = next.splice(index, 1);
      next.splice(target, 0, card);
      return next.map((item, sortOrder) => ({ ...item, sortOrder }));
    });
  };

  const addCard = () => {
    setCards((prev) => [...prev, makeEmptyCard(prev.length)]);
    window.requestAnimationFrame(() => {
      cardsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  };

  const removeCard = (index) => {
    setCards((prev) =>
      prev.filter((_, cardIndex) => cardIndex !== index).map((card, sortOrder) => ({
        ...card,
        sortOrder,
      }))
    );
  };

  const submitRequest = async () => {
    const invalid = cards.some((card) => !card.title.trim() && !card.details.trim());
    if (invalid) {
      const text = "Each card needs a title or details before submitting.";
      setError(text);
      notify("error", text);
      return;
    }

    try {
      setBusy("submit");
      setError("");
      await submitModuleChangeRequest({ module: selectedModule, summary, cards });
      setSummary("");
      const text = "Sent to admin for approval.";
      setMessage(text);
      notify("success", text);
      await loadRequests();
    } catch (err) {
      console.error("Error submitting module request:", err);
      const text = err.message || "Unable to submit request.";
      setError(text);
      notify("error", text);
    } finally {
      setBusy("");
    }
  };

  const reviewRequest = async (request, action) => {
    const actionLabel = action === "approve" ? "approve" : "reject";
    const confirmed = window.confirm(`Are you sure you want to ${actionLabel} this module change?`);
    if (!confirmed) return;

    try {
      setBusy(`${action}:${request.id}`);
      setError("");
      if (action === "approve") {
        await approveModuleChangeRequest(request);
        const text = "Module content approved and published for mobile.";
        setMessage(text);
        notify("success", text);
      } else {
        await rejectModuleChangeRequest(request);
        const text = "Module change request rejected.";
        setMessage(text);
        notify("success", text);
      }
      await Promise.all([loadRequests(), loadCards()]);
    } catch (err) {
      console.error("Error reviewing module request:", err);
      const text = err.message || "Unable to update request.";
      setError(text);
      notify("error", text);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-5">
      <div className={`${panelClass} p-5`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00ffb4]/70">
              Mobile Module Content
            </div>
            <h2 className="mt-2 text-2xl font-black text-white">
              {mode === "admin" ? "Approval queue" : "Submit content updates"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#9fb0c9]">
              Edits use the same Firestore collections as the Flutter app. Student progress and scores stay in their existing user score documents.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <select
                value={selectedModuleId}
                onChange={(event) => setSelectedModuleId(event.target.value)}
                className="w-full appearance-none rounded-2xl border border-[#1a2438] bg-[#0b1220] px-4 py-3 pr-11 text-sm text-white outline-none focus:border-[#00ffb4]/40"
              >
                {EDITABLE_MODULES.map((module) => (
                  <option key={module.id} value={module.id} className="bg-[#0b1220] text-white">
                    {module.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8ba8]" />
            </div>
            <button
              type="button"
              onClick={() => Promise.all([loadCards(), loadRequests()])}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#00ffb4]/30 bg-[#00ffb4]/10 px-4 py-3 text-sm font-semibold text-[#00ffb4] transition hover:bg-[#00ffb4]/16"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-[#00ffb4]/20 bg-[#00ffb4]/10 px-4 py-3 text-sm text-[#b7fff0]">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </div>

      {mode === "faculty" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className={`${panelClass} p-5`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedModule.title}</h3>
                <p className="mt-1 text-sm text-[#7a8ba8]">{selectedModule.description}</p>
              </div>
              <button
                type="button"
                onClick={addCard}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#00ffb4] px-4 py-3 text-sm font-bold text-[#0a0e17]"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>

            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Change summary for admin"
              className="mt-5 min-h-24 w-full rounded-2xl border border-[#1a2438] bg-[#0b1220] px-4 py-3 text-sm text-white outline-none focus:border-[#00ffb4]/40 focus:ring-2 focus:ring-[#00ffb4]/15"
            />

            <div className="mt-5 space-y-4">
              {loadingCards ? (
                <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-6 text-center text-[#9fb0c9]">
                  Loading module cards...
                </div>
              ) : cards.length ? (
                cards.map((card, index) => (
                  <EditableCard
                    key={card.id}
                    card={card}
                    index={index}
                    canMoveUp={index > 0}
                    canMoveDown={index < cards.length - 1}
                    onChange={updateCard}
                    onMove={moveCard}
                    onRemove={removeCard}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-6 text-center text-[#9fb0c9]">
                  No cards yet. Add the first content card.
                </div>
              )}
              <div ref={cardsEndRef} />
            </div>

            <button
              type="button"
              onClick={submitRequest}
              disabled={busy === "submit" || loadingCards}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00ffb4] px-5 py-4 text-sm font-black text-[#0a0e17] transition hover:scale-[1.005] disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {busy === "submit" ? "Submitting..." : "Submit for Admin Approval"}
            </button>
          </div>

          <RequestList
            title="My requests"
            requests={requests}
            loading={loadingRequests}
            mode="faculty"
          />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
          <RequestList
            title="Pending requests"
            requests={requests}
            loading={loadingRequests}
            mode="admin"
            busy={busy}
            onReview={reviewRequest}
          />
          <ApprovedPreview module={selectedModule} cards={cards} loading={loadingCards} />
        </div>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function Toast({ toast, onClose }) {
  if (!toast) return null;

  const isSuccess = toast.type === "success";

  return (
    <div className="fixed bottom-6 right-6 z-[1000] max-w-sm rounded-2xl border border-[#1a2438] bg-[#0b1220] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
      <div className="flex items-start gap-3">
        <span
          className={[
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
            isSuccess
              ? "border-[#00ffb4]/25 bg-[#00ffb4]/10 text-[#00ffb4]"
              : "border-red-400/25 bg-red-500/10 text-red-200",
          ].join(" ")}
        >
          {isSuccess ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white">
            {isSuccess ? "Success" : "Notice"}
          </div>
          <div className="mt-1 text-sm leading-5 text-[#c8d4e6]">{toast.text}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-[#7a8ba8] transition hover:bg-white/5 hover:text-white"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EditableCard({ card, index, canMoveUp, canMoveDown, onChange, onMove, onRemove }) {
  return (
    <div className="rounded-2xl border border-[#1a2438] bg-[#0b1220] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="rounded-full border border-[#00ffb4]/20 bg-[#00ffb4]/10 px-3 py-1 text-xs font-bold text-[#00ffb4]">
          Card {index + 1}
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={!canMoveUp} onClick={() => onMove(index, -1)} className="rounded-xl border border-[#1a2438] px-3 py-2 text-sm text-[#c8d4e6] disabled:opacity-40">
            Up
          </button>
          <button type="button" disabled={!canMoveDown} onClick={() => onMove(index, 1)} className="rounded-xl border border-[#1a2438] px-3 py-2 text-sm text-[#c8d4e6] disabled:opacity-40">
            Down
          </button>
          <button type="button" onClick={() => onRemove(index)} className="inline-flex items-center rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <input
        value={card.title}
        onChange={(event) => onChange(index, "title", event.target.value)}
        placeholder="Card title"
        className="w-full rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-[#00ffb4]/40"
      />

      <textarea
        value={card.details}
        onChange={(event) => onChange(index, "details", event.target.value)}
        placeholder="Details"
        className="mt-3 min-h-28 w-full rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white outline-none focus:border-[#00ffb4]/40"
      />

      <div className="relative mt-3">
        <select
          value={card.mediaType}
          onChange={(event) => onChange(index, "mediaType", event.target.value)}
          className="w-full appearance-none rounded-2xl border border-[#1a2438] bg-[#0b1220] px-4 py-3 pr-11 text-sm text-white outline-none focus:border-[#00ffb4]/40"
        >
          {MODULE_MEDIA_TYPES.map((type) => (
            <option key={type} value={type} className="bg-[#0b1220] text-white">
              {type}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8ba8]" />
      </div>

      <input
        value={card.mediaUrl}
        onChange={(event) => onChange(index, "mediaUrl", event.target.value)}
        placeholder="Image, GIF, video, or embed URL"
        className="mt-3 w-full rounded-2xl border border-[#1a2438] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-[#00ffb4]/40"
      />
    </div>
  );
}

function RequestList({ title, requests, loading, mode, busy = "", onReview }) {
  return (
    <div className={`${panelClass} p-5`}>
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-[#00ffb4]" />
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>

      <div className="mt-5 space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-6 text-center text-[#9fb0c9]">
            Loading requests...
          </div>
        ) : requests.length ? (
          requests.map((request) => (
            <div key={request.id} className="rounded-2xl border border-[#1a2438] bg-[#0b1220] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-white">{request.moduleTitle}</div>
                  <div className="mt-1 text-xs text-[#7a8ba8]">
                    {request.requestedByEmail || request.requestedBy || "Unknown"} · {formatDate(request.createdAt)}
                  </div>
                </div>
                <span className="rounded-full border border-[#00ffb4]/20 bg-[#00ffb4]/10 px-3 py-1 text-xs font-bold uppercase text-[#00ffb4]">
                  {request.status}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-[#c8d4e6]">{request.summary || "Module content update"}</p>

              <div className="mt-4 space-y-2">
                {request.cards.map((card) => (
                  <CardPreview key={card.id} card={card} compact />
                ))}
              </div>

              {mode === "admin" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => onReview?.(request, "reject")}
                    disabled={busy === `reject:${request.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200 disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                    {busy === `reject:${request.id}` ? "Rejecting..." : "Reject"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onReview?.(request, "approve")}
                    disabled={busy === `approve:${request.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00ffb4] px-4 py-3 text-sm font-black text-[#0a0e17] disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    {busy === `approve:${request.id}` ? "Approving..." : "Approve"}
                  </button>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-6 text-center text-[#9fb0c9]">
            No module requests found.
          </div>
        )}
      </div>
    </div>
  );
}

function ApprovedPreview({ module, cards, loading }) {
  return (
    <div className={`${panelClass} p-5`}>
      <div className="flex items-center gap-3">
        <ImageIcon className="h-5 w-5 text-[#00ffb4]" />
        <h3 className="text-lg font-bold text-white">Published preview</h3>
      </div>
      <p className="mt-2 text-sm text-[#7a8ba8]">{module.title}</p>
      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-6 text-center text-[#9fb0c9]">
            Loading approved content...
          </div>
        ) : cards.length ? (
          cards.map((card) => <CardPreview key={card.id} card={card} />)
        ) : (
          <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-6 text-center text-[#9fb0c9]">
            No approved cards yet.
          </div>
        )}
      </div>
    </div>
  );
}

function CardPreview({ card, compact = false }) {
  const embedUrl = card.mediaType === "video" || card.mediaType === "embed" ? youtubeEmbedUrl(card.mediaUrl) : "";

  return (
    <div className="rounded-2xl border border-[#1a2438] bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-white">{card.title || "Untitled card"}</div>
          {!compact && card.details ? (
            <div className="mt-2 text-sm leading-6 text-[#c8d4e6]">{card.details}</div>
          ) : null}
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase text-[#9fb0c9]">
          {card.mediaType}
        </span>
      </div>

      {card.mediaUrl ? (
        <div className="mt-3">
          {card.mediaType === "image" || card.mediaType === "gif" ? (
            <img src={card.mediaUrl} alt="" className="max-h-56 w-full rounded-xl object-cover" />
          ) : embedUrl && !compact ? (
            <iframe
              src={embedUrl}
              title={card.title || "YouTube preview"}
              className="aspect-video w-full rounded-xl border border-[#1a2438]"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <a
              href={card.mediaUrl.startsWith("http") ? card.mediaUrl : undefined}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[#00ffb4]/20 bg-[#00ffb4]/10 px-3 py-2 text-xs text-[#b7fff0]"
            >
              {card.mediaType === "asset" ? <LinkIcon className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
              <span className="truncate">{card.mediaUrl}</span>
            </a>
          )}
        </div>
      ) : null}
    </div>
  );
}
