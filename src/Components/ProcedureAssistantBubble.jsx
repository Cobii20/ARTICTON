import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Square, Volume2, VolumeX } from "lucide-react";
import { getComponentProcedureNote } from "../utils/procedureNotes";

export default function ProcedureAssistantBubble({
  mode,
  platform,
  currentStep,
  activeComponent,
  open = false,
  messages = [],
  input = "",
  loading = false,
  onToggle,
  onInputChange,
  onSend,
}) {
  const note = getComponentProcedureNote(mode, activeComponent || currentStep);
  const [autoRead, setAutoRead] = useState(false);
  const [speakingKey, setSpeakingKey] = useState(null);
  const lastAutoReadIndexRef = useRef(-1);

  const speechSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window;

  const title = mode === "assembly" ? "Assembly AI" : "Disassembly AI";
  const subtitle = `${platform} step-aware assistant`;
  const latestAssistantIndex = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === "assistant") return index;
    }

    return -1;
  }, [messages]);

  const speakText = useCallback((text, key) => {
    if (!speechSupported || !text) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(
      String(text).replace(/\s+/g, " ").trim()
    );
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((voice) => /en(-|_)us/i.test(voice.lang)) ||
      voices.find((voice) => /^en/i.test(voice.lang));

    utterance.voice = preferredVoice || null;
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = () => setSpeakingKey(null);
    utterance.onerror = () => setSpeakingKey(null);

    setSpeakingKey(key);
    window.speechSynthesis.speak(utterance);
  }, [speechSupported]);

  const stopSpeech = useCallback(() => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setSpeakingKey(null);
  }, [speechSupported]);

  useEffect(() => {
    if (
      !open ||
      !autoRead ||
      !speechSupported ||
      latestAssistantIndex < 0 ||
      latestAssistantIndex === lastAutoReadIndexRef.current
    ) {
      return;
    }

    const latestMessage = messages[latestAssistantIndex];
    lastAutoReadIndexRef.current = latestAssistantIndex;
    speakText(latestMessage.content, `message-${latestAssistantIndex}`);
  }, [autoRead, latestAssistantIndex, messages, open, speakText, speechSupported]);

  useEffect(() => {
    if (!open) stopSpeech();
  }, [open, stopSpeech]);

  useEffect(() => () => stopSpeech(), [stopSpeech]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSend?.();
  };

  if (!note) return null;

  if (open) {
    return (
      <div className="articton-ai-panel absolute right-5 top-5 z-[500] flex h-[min(560px,calc(100%-2.5rem))] w-[min(380px,calc(100%-2.5rem))] flex-col overflow-hidden rounded-[24px] border border-[#1a2438] bg-[#0b1220]/95 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-[#1a2438] px-4 py-3">
          <div>
            <div className="text-sm font-bold text-white">{title}</div>
            <div className="text-[11px] text-[#7a8ba8]">{subtitle}</div>
          </div>
          <div className="flex items-center gap-2">
            {speechSupported ? (
              <>
                <button
                  type="button"
                  title={autoRead ? "Turn off voice-over" : "Auto-read AI replies"}
                  onClick={() => setAutoRead((value) => !value)}
                  className={`grid h-8 w-8 place-items-center rounded-lg border transition ${
                    autoRead
                      ? "border-[#FFD41C]/40 bg-[#FFD41C]/12 text-[#FFD41C]"
                      : "border-white/10 bg-white/5 text-[#7a8ba8] hover:text-white"
                  }`}
                >
                  {autoRead ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                {speakingKey ? (
                  <button
                    type="button"
                    title="Stop voice-over"
                    onClick={stopSpeech}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-[#7a8ba8] transition hover:text-white"
                  >
                    <Square size={15} />
                  </button>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              onClick={onToggle}
              className="rounded-lg px-2 py-1 text-sm text-[#7a8ba8] transition hover:bg-white/5 hover:text-white"
            >
              X
            </button>
          </div>
        </div>

        <div className="border-b border-[#1a2438] bg-[#07111d]/70 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#FFD41C]" />
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#FFD41C]">
              Current Procedure
            </div>
          </div>
          <div className="text-sm font-bold text-white">{note.title}</div>
          <p className="mt-2 text-xs leading-5 text-[#c8d4e6]">{note.text}</p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((message, index) => {
            const messageKey = `message-${index}`;
            const canSpeak = speechSupported && message.role === "assistant";
            const isSpeaking = speakingKey === messageKey;

            return (
            <div
              key={index}
              className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                message.role === "assistant"
                  ? "bg-[#FFD41C]/10 text-[#dffef5]"
                  : "bg-white/5 text-white"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7a8ba8]">
                  {message.role === "assistant" ? "AI" : "You"}
                </div>
                {canSpeak ? (
                  <button
                    type="button"
                    title={isSpeaking ? "Stop voice-over" : "Read this reply"}
                    onClick={() =>
                      isSpeaking ? stopSpeech() : speakText(message.content, messageKey)
                    }
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-[#9fb0c9] transition hover:border-[#FFD41C]/35 hover:text-[#FFD41C]"
                  >
                    {isSpeaking ? <Square size={13} /> : <Volume2 size={14} />}
                  </button>
                ) : null}
              </div>
              <div className="whitespace-pre-line">{message.content}</div>
            </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-[#1a2438] p-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(event) => onInputChange?.(event.target.value)}
              placeholder="Ask about this step..."
              className="min-w-0 flex-1 rounded-xl border border-[#1a2438] bg-[#111827] px-4 py-3 text-sm text-white outline-none transition focus:border-[#FFD41C]/35"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#FFD41C] px-4 py-3 text-sm font-bold text-[#0a0e17] transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className="articton-ai-panel articton-ai-panel-closed absolute right-5 top-5 z-[500] w-[min(390px,calc(100%-2.5rem))] rounded-[22px] border border-[#FFD41C]/25 bg-[#07111d]/92 p-4 text-left shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-xl transition hover:scale-[1.01] hover:border-[#FFD41C]/45"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[#FFD41C]" />
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#FFD41C]">
            AI Procedure Guide
          </div>
          <div className="text-[11px] text-[#7a8ba8]">
            {platform} {mode} - {currentStep}
          </div>
        </div>
      </div>
      <div className="text-sm font-bold text-white">{note.title}</div>
      <p className="mt-2 text-xs leading-5 text-[#c8d4e6]">{note.text}</p>
      <div className="mt-3 inline-flex rounded-full border border-[#FFD41C]/25 bg-[#FFD41C]/10 px-3 py-1.5 text-[11px] font-bold text-[#b7fff0]">
        Ask a question
      </div>
    </button>
  );
}
