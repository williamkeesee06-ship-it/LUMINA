import { useEffect, useMemo, useRef, useState } from "react";
import { useUI, selectGalaxyCounts } from "@/store/uiStore";
import {
  sendToLumina,
  type LuminaMessage,
  listCalendarEvents,
  createCalendarEvent,
  type CalEvent,
} from "@/lib/api";
import { sfx } from "@/lib/audio";
import { GALAXIES, type Galaxy } from "@/types";
import {
  loadMemory,
  addTurn as memAddTurn,
  rememberFact,
  forgetFact,
  clearAllMemory,
} from "@/lib/luminaMemory";
import {
  isSpeechSupported,
  createRecognizer,
  speak,
  cancelSpeak,
} from "@/lib/voice";
import { LuminaLiveSession, type LuminaLiveStatus } from "@/lib/geminiLive";

interface ToolCall {
  name:
    | "flyToGalaxy"
    | "flyToJob"
    | "showRoute"
    | "resetToUniverse"
    | "lookupJob"
    | "listCalendar"
    | "createEvent"
    | "rememberFact";
  args: Record<string, unknown>;
}

interface DisplayMessage {
  role: "user" | "model" | "system";
  text: string;
  toolCall?: ToolCall;
  failed?: boolean;
  spokenInput?: boolean; // true when the user dictated this
}

const TOOL_REGEX = /<<TOOL>>([\s\S]*?)<<END>>/;

function parseToolCall(text: string): { clean: string; toolCall: ToolCall | null } {
  const match = text.match(TOOL_REGEX);
  if (!match) return { clean: text.trim(), toolCall: null };
  try {
    const parsed = JSON.parse(match[1]) as ToolCall;
    return { clean: text.replace(TOOL_REGEX, "").trim(), toolCall: parsed };
  } catch {
    return { clean: text.replace(TOOL_REGEX, "").trim(), toolCall: null };
  }
}

interface LuminaPanelProps {
  /** Distance from the bottom of the viewport in px. Default 24 (legacy). */
  anchorBottom?: number;
  /** Distance from the left of the viewport in px. If provided, panel docks to the left edge of the screen (used by LuminaDock). */
  anchorLeft?: number;
}

export function LuminaPanel({
  anchorBottom,
  anchorLeft,
}: LuminaPanelProps = {}) {
  const isChatOpen = useUI((s) => s.isChatOpen);
  const setChatOpen = useUI((s) => s.setChatOpen);
  const hudOrientation = useUI((s) => s.hudOrientation);
  const setOrbMode = useUI((s) => s.setOrbMode);
  const enterGalaxy = useUI((s) => s.enterGalaxy);
  const selectJob = useUI((s) => s.selectJob);
  const resetToUniverse = useUI((s) => s.resetToUniverse);
  const setRouteJobIds = useUI((s) => s.setRouteJobIds);
  const setMapOpen = useUI((s) => s.setMapOpen);
  const jobs = useUI((s) => s.jobs);
  const counts = useUI(selectGalaxyCounts);
  const focusedGalaxy = useUI((s) => s.focusedGalaxy);
  const selectedJobNumber = useUI((s) => s.selectedJobNumber);
  const viewMode = useUI((s) => s.viewMode);
  const googleToken = useUI((s) => s.googleToken);

  // Initial greeting + persisted history replay
  const [messages, setMessages] = useState<DisplayMessage[]>(() => {
    const mem = loadMemory();
    const replay: DisplayMessage[] = mem.history.slice(-12).map((h) => ({
      role: h.role,
      text: h.text,
    }));
    if (replay.length > 0) return replay;
    return [
      {
        role: "model",
        text: "Lumina online. What's on your mind, Billy?",
      },
    ];
  });

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [showMemory, setShowMemory] = useState(false);
  const [memTick, setMemTick] = useState(0); // re-render facts list
  const [liveMode, setLiveMode] = useState(false);
  const liveModeRef = useRef(false);
  const lastSpokenInputRef = useRef(false);
  const [liveStatus, setLiveStatus] = useState<LuminaLiveStatus>("idle");
  const [liveCaption, setLiveCaption] = useState<string>("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognizerRef = useRef<ReturnType<typeof createRecognizer>>(null);
  const liveSessionRef = useRef<LuminaLiveSession | null>(null);

  const memory = useMemo(() => loadMemory(), [memTick, isChatOpen]);

  useEffect(() => {
    if (isChatOpen) inputRef.current?.focus();
  }, [isChatOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, interim]);

  const executeTool = async (call: ToolCall) => {
    if (call.name === "resetToUniverse") {
      resetToUniverse();
      sfx.confirm();
      return;
    }
    if (call.name === "lookupJob") {
      // Look up the full record for any work order Billy mentioned and surface
      // it directly in the chat as a Lumina-formatted detail block. This
      // ensures she NEVER fabricates — she pulls real data on demand.
      const wo = String(call.args.workOrder ?? "");
      const norm = (s: string) => s.replace(/[\s\-_.]/g, "").toUpperCase();
      const target = norm(wo);
      const j = jobs.find((x) => {
        const w = norm(x.workOrder ?? "");
        if (w === target) return true;
        if (target.startsWith("P") && w === target.slice(1)) return true;
        if (w.startsWith("P") && w.slice(1) === target) return true;
        if (target.length >= 5 && w.endsWith(target)) return true;
        return false;
      });
      if (!j) {
        const msg = `No work order matching \`${wo}\` exists in the universe. Confirm the number with me.`;
        setMessages((m) => [...m, { role: "model", text: msg }]);
        memAddTurn("model", msg);
        if (lastSpokenInputRef.current || liveModeRef.current) {
          speak(msg, { onEnd: () => maybeRelisten() });
        }
        sfx.error();
        return;
      }
      const lines: string[] = [];
      lines.push(`**${j.workOrder}** — ${j.status}`);
      if (j.rawSecondaryStatus) lines.push(`Status: ${j.rawSecondaryStatus}`);
      if (j.fullAddress) lines.push(`Address: ${j.fullAddress}`);
      if (j.workType) lines.push(`Work type: ${j.workType}`);
      if (j.crew) lines.push(`Crew: ${j.crew}`);
      if (j.scheduleDate) lines.push(`Scheduled: ${j.scheduleDate}`);
      if (j.endDate) lines.push(`End: ${j.endDate}`);
      if (j.dueDate) lines.push(`Due: ${j.dueDate}`);
      if (j.permitNumber) lines.push(`Permit: ${j.permitNumber}`);
      if (j.bidValue) lines.push(`Bid: ${j.bidValue}`);
      if (j.notes) lines.push(`NSC Project Notes: ${j.notes}`);
      if (j.splicingNotes) lines.push(`Splicing Notes: ${j.splicingNotes}`);
      const detail = lines.join("\n");
      setMessages((m) => [...m, { role: "model", text: detail }]);
      memAddTurn("model", detail);
      // If voice/live, speak a tighter summary instead of the full block.
      if (lastSpokenInputRef.current || liveModeRef.current) {
        const spoken = `${j.workOrder} is in ${j.status}${
          j.rawSecondaryStatus ? `, ${j.rawSecondaryStatus}` : ""
        }${j.scheduleDate ? `, scheduled ${j.scheduleDate}` : ""}.`;
        speak(spoken, { onEnd: () => maybeRelisten() });
      }
      sfx.confirm();
      return;
    }
    if (call.name === "flyToGalaxy") {
      const g = String(call.args.galaxy ?? "") as Galaxy;
      if ((GALAXIES as readonly string[]).includes(g)) {
        enterGalaxy(g);
        sfx.confirm();
      }
      return;
    }
    if (call.name === "flyToJob") {
      const wo = String(call.args.workOrder ?? "");
      const j = jobs.find((x) => x.workOrder === wo);
      if (j) {
        selectJob(j.id);
        sfx.confirm();
      }
      return;
    }
    if (call.name === "showRoute") {
      const wos = (call.args.workOrders as string[]) ?? [];
      const ids = jobs.filter((j) => wos.includes(j.workOrder)).map((j) => j.id);
      setRouteJobIds(ids);
      setMapOpen(true);
      sfx.confirm();
      return;
    }
    if (call.name === "rememberFact") {
      const fact = String(call.args.fact ?? "");
      if (fact) {
        rememberFact(fact);
        setMemTick((t) => t + 1);
        sfx.confirm();
      }
      return;
    }
    if (call.name === "listCalendar") {
      if (!googleToken) {
        setMessages((m) => [
          ...m,
          {
            role: "system",
            text: "Calendar access needs Google connect. Tap CONNECT in the HUD first.",
            failed: true,
          },
        ]);
        return;
      }
      const days = Number(call.args.days ?? 14);
      const events = await listCalendarEvents(googleToken, days);
      const formatted = formatEvents(events);
      setMessages((m) => [...m, { role: "model", text: formatted }]);
      memAddTurn("model", formatted);
      if (lastSpokenInputRef.current || liveModeRef.current) {
        speak(formatted, { onEnd: () => maybeRelisten() });
      }
      sfx.confirm();
      return;
    }
    if (call.name === "createEvent") {
      if (!googleToken) {
        setMessages((m) => [
          ...m,
          {
            role: "system",
            text: "Calendar access needs Google connect. Tap CONNECT in the HUD first.",
            failed: true,
          },
        ]);
        return;
      }
      const summary = String(call.args.summary ?? "");
      const startISO = String(call.args.startISO ?? "");
      const endISO = String(call.args.endISO ?? "");
      const description = call.args.description ? String(call.args.description) : undefined;
      const location = call.args.location ? String(call.args.location) : undefined;
      if (!summary || !startISO || !endISO) {
        setMessages((m) => [
          ...m,
          { role: "system", text: "Event needs summary + start + end.", failed: true },
        ]);
        return;
      }
      const result = await createCalendarEvent(googleToken, {
        summary,
        startISO,
        endISO,
        description,
        location,
      });
      if (!result.ok) {
        setMessages((m) => [
          ...m,
          { role: "system", text: result.message ?? "Could not schedule.", failed: true },
        ]);
        sfx.error();
        return;
      }
      const confirmation = `Booked: ${summary} — ${formatTime(startISO)}.`;
      setMessages((m) => [...m, { role: "model", text: confirmation }]);
      memAddTurn("model", confirmation);
      if (lastSpokenInputRef.current || liveModeRef.current) {
        speak(confirmation, { onEnd: () => maybeRelisten() });
      }
      sfx.confirm();
    }
  };

  async function send(spoken = false) {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setInterim("");
    lastSpokenInputRef.current = spoken;

    const userMsg: DisplayMessage = { role: "user", text, spokenInput: spoken };
    setMessages((m) => [...m, userMsg]);
    memAddTurn("user", text);
    setBusy(true);
    setOrbMode("thinking");

    const history: LuminaMessage[] = [...messages, userMsg]
      .filter((m): m is DisplayMessage & { role: "user" | "model" } =>
        m.role === "user" || m.role === "model",
      )
      .map((m) => ({ role: m.role, text: m.text }));

    // ---- Build context with FULL job awareness ----
    // Detect any work-order references in Billy's message and pull their full
    // records. Patterns: "P.018509", "WO 23017359", "23017359", "WO-12345".
    const woPatterns = [
      /\bP\.?\d{5,8}\b/gi,                    // P.018509 / P018509
      /\bWO[\s\-_]*\d{5,10}\b/gi,              // WO 23017359 / WO-23017359
      /\b\d{7,9}\b/g,                          // bare 7–9 digit work order
    ];
    const matchedTokens = new Set<string>();
    for (const re of woPatterns) {
      const found = text.match(re) ?? [];
      for (const m of found) matchedTokens.add(m.replace(/[\s\-_]/g, "").toUpperCase());
    }
    // Match against the loaded job set. Use loose comparison so "WO 23017359"
    // matches a stored workOrder of "23017359" or "WO-23017359".
    const norm = (s: string) => s.replace(/[\s\-_.]/g, "").toUpperCase();
    const matchedJobs = jobs.filter((j) => {
      const wo = norm(j.workOrder ?? "");
      for (const t of matchedTokens) {
        const tn = norm(t);
        if (wo === tn) return true;
        // P.018509 vs stored "018509" — strip the P prefix
        if (tn.startsWith("P") && wo === tn.slice(1)) return true;
        if (wo.startsWith("P") && wo.slice(1) === tn) return true;
        // partial: stored work order ends with the queried digits
        if (tn.length >= 5 && wo.endsWith(tn)) return true;
      }
      return false;
    });

    // Compact universe index — every job in a tight one-line shape so Lumina
    // can answer existence / galaxy / city questions without round-trips.
    const universeIndex = jobs.map((j) => ({
      wo: j.workOrder,
      g: j.status,
      c: j.city ?? null,
      s: j.rawSecondaryStatus ?? null,
      sd: j.scheduleDate ?? null,
    }));

    const context = {
      operator: "Billy Keesee",
      role: "Construction Supervisor",
      company: "North Sky Communications",
      now: new Date().toISOString(),
      timezone: "America/Los_Angeles",
      viewMode,
      focusedGalaxy,
      selectedJobNumber,
      googleConnected: Boolean(googleToken),
      galaxyCounts: counts,
      totalJobs: jobs.length,
      // Full job index of the entire universe (~50 bytes/job). Lumina can use
      // this to confirm whether any work order exists and which galaxy it's in.
      universeIndex,
      // FULL records for any work orders Billy referenced in this message.
      // This is the ground-truth data she should cite from — never fabricate.
      matchedJobs: matchedJobs.map((j) => ({
        workOrder: j.workOrder,
        galaxy: j.status,
        secondaryStatus: j.rawSecondaryStatus,
        jobStatus: j.jobStatus,
        address: j.fullAddress,
        city: j.city,
        zip: j.zip,
        workType: j.workType,
        base: j.base,
        crew: j.crew,
        permitNumber: j.permitNumber,
        scheduleDate: j.scheduleDate,
        endDate: j.endDate,
        dueDate: j.dueDate,
        receivedDate: j.receivedDate,
        bidValue: j.bidValue,
        notes: j.notes,
        splicingNotes: j.splicingNotes,
      })),
      sample: focusedGalaxy
        ? jobs
            .filter((j) => j.status === focusedGalaxy)
            .slice(0, 12)
            .map((j) => ({
              workOrder: j.workOrder,
              address: j.fullAddress,
              status: j.rawSecondaryStatus,
              scheduleDate: j.scheduleDate,
            }))
        : null,
    };

    const mem = loadMemory();
    const result = await sendToLumina(history, context, {
      facts: mem.facts,
      summary: mem.summary,
    });
    if (!result.ok) {
      setMessages((m) => [...m, { role: "system", text: result.message, failed: true }]);
      setOrbMode("idle");
      sfx.error();
      setBusy(false);
      return;
    }
    const { clean, toolCall } = parseToolCall(result.text);
    const replyText = clean || (toolCall ? "Engaging." : "");
    setMessages((m) => [
      ...m,
      { role: "model", text: replyText, toolCall: toolCall ?? undefined },
    ]);
    if (replyText) memAddTurn("model", replyText);

    // Speak when input was voice OR live mode is on
    if (replyText && (spoken || liveModeRef.current)) {
      speak(replyText, { onEnd: () => maybeRelisten() });
    }

    if (toolCall) {
      setOrbMode("navigating");
      await executeTool(toolCall);
      setMemTick((t) => t + 1);
      setTimeout(() => setOrbMode("idle"), 1200);
    } else {
      setOrbMode("idle");
    }
    setBusy(false);
  }

  // ---- Voice input ----
  function startListening(opts: { sendOnEnd?: boolean } = {}) {
    if (!isSpeechSupported()) {
      setMessages((m) => [
        ...m,
        {
          role: "system",
          text: "Voice input isn't supported in this browser. Try Chrome or Edge.",
          failed: true,
        },
      ]);
      return;
    }
    if (recognizerRef.current) {
      try {
        recognizerRef.current.abort();
      } catch {
        /* noop */
      }
    }
    const r = createRecognizer({ interim: true, continuous: false });
    if (!r) return;
    let finalText = "";
    r.onstart = () => {
      setListening(true);
      sfx.select();
    };
    r.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      setInterim(interimText);
      if (finalText) setInput(finalText);
    };
    r.onerror = () => {
      setListening(false);
      setInterim("");
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
      if (opts.sendOnEnd && finalText.trim()) {
        // give state a tick to apply, then send as spoken
        setInput(finalText.trim());
        setTimeout(() => send(true), 50);
      }
    };
    recognizerRef.current = r;
    try {
      r.start();
    } catch {
      setListening(false);
    }
  }

  function stopListening() {
    if (recognizerRef.current) {
      try {
        recognizerRef.current.stop();
      } catch {
        /* noop */
      }
    }
  }

  function maybeRelisten() {
    if (liveModeRef.current) {
      // brief pause so TTS doesn't bleed into mic
      setTimeout(() => {
        if (liveModeRef.current) startListening({ sendOnEnd: true });
      }, 350);
    }
  }

  async function toggleLiveMode() {
    const next = !liveMode;

    // Turning OFF — tear down session
    if (!next) {
      liveModeRef.current = false;
      setLiveMode(false);
      setLiveStatus("idle");
      setLiveCaption("");
      const sess = liveSessionRef.current;
      liveSessionRef.current = null;
      sess?.stop();
      sfx.select();
      return;
    }

    // Turning ON — boot Gemini Live
    liveModeRef.current = true;
    setLiveMode(true);
    sfx.confirm();

    // Cancel any in-flight Web Speech mic / TTS
    cancelSpeak();
    stopListening();

    setMessages((m) => [
      ...m,
      { role: "system", text: "Live mode booting — give mic permission if asked." },
    ]);

    const session = new LuminaLiveSession({
      onStatus: (s) => setLiveStatus(s),
      onUserTranscript: (text, isFinal) => {
        setLiveCaption(text);
        if (isFinal && text.trim()) {
          setMessages((m) => [...m, { role: "user", text: text.trim(), spokenInput: true }]);
          memAddTurn("user", text.trim());
          setLiveCaption("");
        }
      },
      onModelTranscript: (text, isFinal) => {
        if (isFinal && text.trim()) {
          setMessages((m) => [...m, { role: "model", text: text.trim() }]);
          memAddTurn("model", text.trim());
        }
      },
      onError: (msg) => {
        setMessages((m) => [...m, { role: "system", text: `Live: ${msg}`, failed: true }]);
        sfx.error();
      },
      onClose: () => {
        if (liveModeRef.current) {
          // Unexpected drop — flip the toggle off
          liveModeRef.current = false;
          setLiveMode(false);
          setLiveStatus("closed");
        }
      },
    });
    liveSessionRef.current = session;
    try {
      await session.start();
    } catch {
      // start() already reported via onError
      liveModeRef.current = false;
      setLiveMode(false);
      liveSessionRef.current = null;
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      liveSessionRef.current?.stop();
      liveSessionRef.current = null;
    };
  }, []);

  if (!isChatOpen) return null;

  // Default placement (legacy callers): right-docked, avoids vertical HUD.
  // New LuminaDock passes anchorLeft + anchorBottom and we dock to the left
  // edge of the screen instead.
  const useLeftAnchor = typeof anchorLeft === "number";
  const rightOffset = hudOrientation === "vertical" ? 244 : 24;
  const bottomOffset = anchorBottom ?? (hudOrientation === "vertical" ? 24 : 128);

  // Neon palette
  const NEON_BLUE = "#3D7BFF";
  const NEON_BLUE_BRIGHT = "#6DA3FF";
  const NEON_GREEN = "#39FF7A";
  const NEON_GREEN_BRIGHT = "#7CFFA8";

  return (
    <div
      className="pointer-events-auto fixed z-40 w-[380px] max-w-[40vw]"
      style={
        useLeftAnchor
          ? { left: anchorLeft, bottom: bottomOffset }
          : { right: rightOffset, bottom: bottomOffset }
      }
    >
      <div
        className="relative overflow-hidden rounded-[2px]"
        style={{
          background: "#000",
          border: `1px solid ${NEON_GREEN}55`,
          boxShadow: `0 0 32px ${NEON_GREEN}22, 0 0 80px #00000099`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: `1px solid ${NEON_GREEN}26` }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: NEON_GREEN, boxShadow: `0 0 10px ${NEON_GREEN}` }}
            />
            <span
              className="font-display tracking-tactical text-xs uppercase"
              style={{ color: NEON_GREEN_BRIGHT, textShadow: `0 0 8px ${NEON_GREEN}aa` }}
            >
              LUMINA
            </span>
            <span className="font-mono text-[10px] text-white/45 truncate">
              north sky communications
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Live mode toggle */}
            <button
              type="button"
              onClick={toggleLiveMode}
              title={liveMode ? `Gemini Live · ${liveStatus} — click to stop` : "Gemini Live voice mode"}
              className="font-display text-[10px] uppercase tracking-tactical px-2 py-1 rounded-sm transition-colors"
              style={{
                color: liveMode ? "#000" : NEON_GREEN_BRIGHT,
                background: liveMode ? NEON_GREEN : "transparent",
                border: `1px solid ${liveMode ? NEON_GREEN : NEON_GREEN + "55"}`,
                boxShadow: liveMode ? `0 0 18px ${NEON_GREEN}cc` : "none",
              }}
            >
              {liveMode ? `● ${liveStatusLabel(liveStatus)}` : "live"}
            </button>
            {/* Memory drawer toggle */}
            <button
              type="button"
              onClick={() => setShowMemory((v) => !v)}
              title="Memory"
              className="font-mono text-[10px] uppercase px-2 py-1 rounded-sm transition-colors"
              style={{
                color: showMemory ? NEON_GREEN_BRIGHT : "#ffffff66",
                border: `1px solid ${showMemory ? NEON_GREEN + "88" : "#ffffff22"}`,
              }}
            >
              mem
            </button>
            <button
              type="button"
              onClick={() => {
                cancelSpeak();
                stopListening();
                liveSessionRef.current?.stop();
                liveSessionRef.current = null;
                liveModeRef.current = false;
                setLiveMode(false);
                setLiveStatus("idle");
                setLiveCaption("");
                sfx.select();
                setChatOpen(false);
              }}
              className="text-white/50 hover:text-white text-lg leading-none px-1"
              aria-label="Close LUMINA"
            >
              ×
            </button>
          </div>
        </div>

        {/* Memory drawer */}
        {showMemory && (
          <div
            className="px-4 py-3 text-[11px] font-mono"
            style={{
              background: "#000",
              borderBottom: `1px solid ${NEON_GREEN}22`,
              maxHeight: 180,
              overflowY: "auto",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="uppercase tracking-tactical text-white/50">
                memory · {memory.facts.length} facts
              </span>
              {memory.facts.length > 0 && (
                <button
                  onClick={() => {
                    clearAllMemory();
                    setMemTick((t) => t + 1);
                  }}
                  className="text-white/40 hover:text-red-300 uppercase"
                >
                  clear
                </button>
              )}
            </div>
            {memory.facts.length === 0 ? (
              <div className="text-white/30 italic">
                No persistent facts yet. Tell Lumina to remember something.
              </div>
            ) : (
              <ul className="space-y-1">
                {memory.facts.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-2 group"
                    style={{ color: NEON_GREEN_BRIGHT }}
                  >
                    <span className="leading-snug">{f}</span>
                    <button
                      onClick={() => {
                        forgetFact(i);
                        setMemTick((t) => t + 1);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-white/80 px-1"
                      aria-label="Forget"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          className="overflow-y-auto px-4 py-4 space-y-3"
          style={{ maxHeight: "48vh", background: "#000" }}
        >
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            const isSystem = m.role === "system";
            const ringColor = isUser ? NEON_BLUE : NEON_GREEN;
            const ringBright = isUser ? NEON_BLUE_BRIGHT : NEON_GREEN_BRIGHT;
            return (
              <div
                key={i}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[88%] px-3 py-2 rounded-[2px] text-sm leading-relaxed"
                  style={
                    isSystem
                      ? {
                          background: "#000",
                          color: "#FF6B6B",
                          border: "1px solid #FF6B6B55",
                          boxShadow: "0 0 14px #FF6B6B33",
                          fontFamily: "var(--font-mono, ui-monospace)",
                          fontSize: 12,
                        }
                      : {
                          background: "#000",
                          color: "#fff",
                          border: `1px solid ${ringColor}`,
                          boxShadow: `0 0 18px ${ringColor}55, inset 0 0 0 1px ${ringColor}22`,
                        }
                  }
                >
                  {!isUser && !isSystem && (
                    <div
                      className="font-display tracking-wider text-[10px] uppercase mb-1"
                      style={{ color: ringBright, textShadow: `0 0 6px ${ringColor}aa` }}
                    >
                      Lumina
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  {m.toolCall && (
                    <div
                      className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm font-mono text-[10px] uppercase tracking-tactical"
                      style={{
                        color: ringBright,
                        border: `1px solid ${ringColor}99`,
                        background: `${ringColor}15`,
                      }}
                    >
                      <span
                        className="w-1 h-1 rounded-full"
                        style={{ background: ringBright }}
                      />
                      {m.toolCall.name}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {liveMode && liveCaption && (
            <div className="flex justify-end">
              <div
                className="max-w-[88%] px-3 py-2 rounded-[2px] text-sm italic"
                style={{
                  background: "#000",
                  color: "#fff8",
                  border: `1px dashed ${NEON_BLUE}88`,
                }}
              >
                {liveCaption}
              </div>
            </div>
          )}
          {interim && (
            <div className="flex justify-end">
              <div
                className="max-w-[88%] px-3 py-2 rounded-[2px] text-sm italic"
                style={{
                  background: "#000",
                  color: "#fff8",
                  border: `1px dashed ${NEON_BLUE}88`,
                }}
              >
                {interim}
              </div>
            </div>
          )}
          {busy && (
            <div className="flex items-center gap-2 text-xs font-mono px-3" style={{ color: NEON_GREEN_BRIGHT }}>
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: NEON_GREEN, boxShadow: `0 0 8px ${NEON_GREEN}` }}
              />
              Thinking…
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3" style={{ borderTop: `1px solid ${NEON_GREEN}26`, background: "#000" }}>
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(false);
                }
              }}
              placeholder={
                liveMode
                  ? `Gemini Live — ${liveStatusLabel(liveStatus)}. Just talk.`
                  : 'Talk to Lumina or type — "fly to needs fielding", "what\'s on my calendar this week"'
              }
              rows={2}
              disabled={listening || liveMode}
              className="w-full rounded-sm px-3 py-2 pr-12 text-sm text-white placeholder:text-white/30 resize-none font-body outline-none"
              style={{
                background: "#000",
                border: `1px solid ${NEON_BLUE}55`,
                boxShadow: `inset 0 0 12px ${NEON_BLUE}22`,
              }}
            />
            {/* Mic button — inside input, neon blue */}
            <button
              type="button"
              onClick={() => (listening ? stopListening() : startListening({ sendOnEnd: false }))}
              title={listening ? "Stop listening" : "Speak to Lumina"}
              aria-label="Microphone"
              className="absolute bottom-2 right-2 grid place-items-center rounded-full transition-all"
              style={{
                width: 32,
                height: 32,
                background: listening ? NEON_BLUE : "#000",
                border: `1px solid ${NEON_BLUE_BRIGHT}`,
                boxShadow: listening
                  ? `0 0 16px ${NEON_BLUE}, 0 0 32px ${NEON_BLUE}66`
                  : `0 0 8px ${NEON_BLUE}66`,
                color: listening ? "#000" : NEON_BLUE_BRIGHT,
              }}
            >
              <MicGlyph />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="font-mono text-[10px] text-white/35">
              ↵ transmit · ⇧↵ newline · 🎙 dictate · live = hands-free
            </div>
            <button
              type="button"
              onClick={() => send(false)}
              disabled={busy || !input.trim()}
              className="font-display text-[11px] uppercase tracking-tactical px-3 py-1.5 rounded-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                color: NEON_GREEN_BRIGHT,
                border: `1px solid ${NEON_GREEN}88`,
                background: "transparent",
                textShadow: `0 0 6px ${NEON_GREEN}aa`,
              }}
            >
              transmit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function liveStatusLabel(s: LuminaLiveStatus): string {
  switch (s) {
    case "connecting":
      return "connecting";
    case "listening":
      return "listening";
    case "speaking":
      return "speaking";
    case "thinking":
      return "thinking";
    case "error":
      return "error";
    case "closed":
      return "closed";
    default:
      return "live";
  }
}

function MicGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}

function formatEvents(events: CalEvent[]): string {
  if (events.length === 0) return "Calendar's clear.";
  const lines = events.slice(0, 10).map((ev) => {
    const when = formatTime(ev.start);
    const where = ev.location ? ` · ${ev.location}` : "";
    return `• ${when} — ${ev.summary}${where}`;
  });
  return `Upcoming:\n${lines.join("\n")}`;
}

function formatTime(iso: string): string {
  if (!iso) return "?";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
