import { useEffect, useMemo, useRef, useState } from "react";
import { useUI, selectGalaxyCounts } from "@/store/uiStore";
import {
  sendToLumina,
  type LuminaMessage,
  listCalendarEvents,
  createCalendarEvent,
  type CalEvent,
  listGmail,
  readGmailThread,
  sendGmail,
} from "@/lib/api";
import { sfx } from "@/lib/audio";
import { GALAXIES, type Galaxy } from "@/types";
import {
  loadMemory,
  addTurn as memAddTurn,
  rememberFact,
  forgetFactById,
  updateFact,
  clearAllMemory,
  maybeAutoRemember,
  updateSettings as updateMemorySettings,
  subscribeMemory,
  type MemoryFact,
} from "@/lib/luminaMemory";
import {
  isSpeechSupported,
  createRecognizer,
  speak,
  cancelSpeak,
} from "@/lib/voice";
import { LuminaLiveSession, type LuminaLiveStatus, type LuminaLiveToolResult } from "@/lib/geminiLive";

interface ToolCall {
  name:
    | "flyToGalaxy"
    | "flyToJob"
    | "showRoute"
    | "resetToUniverse"
    | "lookupJob"
    | "listCalendar"
    | "createEvent"
    | "rememberFact"
    | "listNorthSkyEmails"
    | "readThread"
    | "summarizeThread"
    | "openMoonForJob"
    | "draftReply"
    | "sendReply";
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
  const openThread = useUI((s) => s.openThread);
  const setThreadSummary = useUI((s) => s.setThreadSummary);
  const threadSummaries = useUI((s) => s.threadSummaries);

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
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editingFactText, setEditingFactText] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  /**
   *  Memory inspector filter. "all" shows every fact; "email" shows only
   *  auto-saved memories whose text begins with "Thread re:" (the format
   *  written by EmailThreadView). Lets the operator audit what Lumina
   *  picked up from her North Sky inbox.
   */
  const [memFilter, setMemFilter] = useState<"all" | "email">("all");
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

  /**
   *  Top 3 unread North Sky threads, derived from the jobs slice. Surfaced
   *  to both chat and Live as a transient memory line so Lumina can answer
   *  "what's new in email" without first hitting the API. Refreshes any
   *  time jobs change (e.g. the watcher just attached a new moon).
   */
  const topUnreadEmailLines = useMemo(() => {
    const flat: { wo: string; threadId: string; subject: string; from: string; date: string }[] = [];
    for (const j of jobs) {
      for (const m of j.moons ?? []) {
        if (m.unread) {
          flat.push({
            wo: j.workOrder,
            threadId: m.threadId,
            subject: m.subject,
            from: m.from,
            date: m.date,
          });
        }
      }
    }
    flat.sort((a, b) => (b.date > a.date ? 1 : -1));
    return flat
      .slice(0, 3)
      .map((m) => `unread email · WO ${m.wo} · "${m.subject}" — ${m.from} (threadId ${m.threadId})`);
  }, [jobs]);

  // Record a turn AND let the auto-save heuristics scan it for commitments,
  // status changes, and explicit "remember that ___" patterns. Centralizing
  // this here so both chat and Live flows share identical extraction logic.
  const recordTurn = (role: "user" | "model", text: string): void => {
    memAddTurn(role, text);
    maybeAutoRemember(role, text);
  };

  // Live subscription — the Memory Inspector updates instantly when
  // auto-save heuristics fire or when Lumina commits a fact via tool call.
  // We also forward the latest memory snapshot to an active Live session
  // so voice mode stays in lockstep with chat — closes the loop on the
  // "Live forgets" complaint mid-conversation, not just at session start.
  useEffect(() => {
    return subscribeMemory((rec) => {
      setMemTick((t) => t + 1);
      if (liveSessionRef.current?.isActive()) {
        liveSessionRef.current.pushMemory({
          facts: [...rec.facts.map((f) => f.text), ...topUnreadEmailLines],
          summary: rec.summary,
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push refreshed top-unread email lines into a live Live session whenever
  // the jobs slice changes — keeps voice mode in lockstep with the watcher
  // without waiting for the next chat turn.
  useEffect(() => {
    if (liveSessionRef.current?.isActive()) {
      const mem = loadMemory();
      liveSessionRef.current.pushMemory({
        facts: [...mem.facts.map((f) => f.text), ...topUnreadEmailLines],
        summary: mem.summary,
      });
    }
  }, [topUnreadEmailLines]);

  useEffect(() => {
    if (isChatOpen) inputRef.current?.focus();
  }, [isChatOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, interim]);

  // Build the universe-wide Smartsheet context payload. Used both by chat
  // (per-message) and by Live (sent once at session start as clientContent).
  // Centralizing it ensures both surfaces have the SAME truth lockdown data.
  const buildLuminaContext = (userText?: string) => {
    let matchedJobs: typeof jobs = [];
    if (userText) {
      const woPatterns = [
        /\bP\.?\d{5,8}\b/gi,
        /\bWO[\s\-_]*\d{5,10}\b/gi,
        /\b\d{7,9}\b/g,
      ];
      const matchedTokens = new Set<string>();
      for (const re of woPatterns) {
        const found = userText.match(re) ?? [];
        for (const m of found) matchedTokens.add(m.replace(/[\s\-_]/g, "").toUpperCase());
      }
      const norm = (s: string) => s.replace(/[\s\-_.]/g, "").toUpperCase();
      matchedJobs = jobs.filter((j) => {
        const wo = norm(j.workOrder ?? "");
        for (const t of matchedTokens) {
          const tn = norm(t);
          if (wo === tn) return true;
          if (tn.startsWith("P") && wo === tn.slice(1)) return true;
          if (wo.startsWith("P") && wo.slice(1) === tn) return true;
          if (tn.length >= 5 && wo.endsWith(tn)) return true;
        }
        return false;
      });
    }

    const universeIndex = jobs.map((j) => ({
      wo: j.workOrder,
      g: j.status,
      c: j.city ?? null,
      s: j.rawSecondaryStatus ?? null,
      sd: j.scheduleDate ?? null,
    }));

    return {
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
      universeIndex,
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
  };

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
        recordTurn("model", msg);
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
      recordTurn("model", detail);
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
        rememberFact(fact, "explicit");
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
      recordTurn("model", formatted);
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
      recordTurn("model", confirmation);
      if (lastSpokenInputRef.current || liveModeRef.current) {
        speak(confirmation, { onEnd: () => maybeRelisten() });
      }
      sfx.confirm();
      return;
    }
    if (call.name === "listNorthSkyEmails") {
      if (!googleToken) {
        setMessages((m) => [
          ...m,
          {
            role: "system",
            text: "Email needs Google connect. Double-click the orb to sign in.",
            failed: true,
          },
        ]);
        return;
      }
      const filter = call.args.filter ? String(call.args.filter) : undefined;
      const unreadOnly = Boolean(call.args.unreadOnly);
      const limit = Math.min(Number(call.args.limit ?? 10) || 10, 25);
      // The server forces the North Sky label scope — no `label` field here.
      const res = await listGmail(googleToken, {
        query: filter,
        unreadOnly,
        limit,
      });
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { role: "system", text: `Gmail: ${res.message}`, failed: true },
        ]);
        return;
      }
      if (res.messages.length === 0) {
        const empty = "North Sky inbox is quiet — no new threads.";
        setMessages((m) => [...m, { role: "model", text: empty }]);
        recordTurn("model", empty);
        return;
      }
      const lines = res.messages.slice(0, 8).map(
        (m) => `• ${m.unread ? "● " : ""}${m.subject} — ${m.from}`,
      );
      const block = `North Sky — ${res.messages.length} thread${res.messages.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      setMessages((m) => [...m, { role: "model", text: block }]);
      recordTurn("model", block);
      return;
    }
    if (call.name === "readThread" || call.name === "summarizeThread") {
      if (!googleToken) {
        setMessages((m) => [
          ...m,
          { role: "system", text: "Email needs Google connect.", failed: true },
        ]);
        return;
      }
      const threadId = String(call.args.threadId ?? "");
      if (!threadId) return;
      const res = await readGmailThread(googleToken, threadId);
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { role: "system", text: `Gmail: ${res.message}`, failed: true },
        ]);
        return;
      }
      const last = res.messages[res.messages.length - 1];
      if (!last) return;
      if (call.name === "summarizeThread") {
        const text = `${last.subject} — last: ${last.from} ${last.date}. ${(last.plainBody || last.snippet || "").slice(0, 220)}`;
        setThreadSummary(threadId, text);
        setMessages((m) => [...m, { role: "model", text }]);
        recordTurn("model", text);
      } else {
        const detail = `${last.from} · ${last.date}\n${last.subject}\n\n${(last.plainBody || last.snippet || "").slice(0, 800)}`;
        setMessages((m) => [...m, { role: "model", text: detail }]);
        recordTurn("model", detail);
      }
      return;
    }
    if (call.name === "openMoonForJob") {
      const wo = String(call.args.wo ?? "");
      const norm = (s: string) => s.replace(/[\s\-_.]/g, "").toUpperCase();
      const target = norm(wo);
      const j = jobs.find((x) => norm(x.workOrder ?? "") === target);
      if (!j) {
        const msg = `No work order matching ${wo} in the universe.`;
        setMessages((m) => [...m, { role: "model", text: msg }]);
        recordTurn("model", msg);
        return;
      }
      selectJob(j.id);
      const newest = (j.moons ?? [])
        .slice()
        .sort((a, b) => (b.date > a.date ? 1 : -1))[0];
      if (newest) {
        openThread(newest.threadId, j.id);
      } else {
        const msg = `${j.workOrder}: no email threads attached yet.`;
        setMessages((m) => [...m, { role: "model", text: msg }]);
        recordTurn("model", msg);
      }
      return;
    }
    if (call.name === "draftReply") {
      // Show the draft in the thread composer-ready text — surfaced as a
      // chat message so the operator can copy/paste or open the thread.
      const draft = String(call.args.intent ?? "");
      const threadId = String(call.args.threadId ?? "");
      const text = `Draft (${threadId}):\n${draft}`;
      setMessages((m) => [...m, { role: "model", text }]);
      recordTurn("model", text);
      return;
    }
    if (call.name === "sendReply") {
      const confirm = Boolean(call.args.confirm);
      if (!confirm) {
        const msg = "Refusing to send — no confirmation. State the draft and ask me first.";
        setMessages((m) => [...m, { role: "system", text: msg, failed: true }]);
        sfx.error();
        return;
      }
      if (!googleToken) {
        setMessages((m) => [
          ...m,
          { role: "system", text: "Send needs Google connect.", failed: true },
        ]);
        return;
      }
      const threadId = String(call.args.threadId ?? "");
      const body = String(call.args.body ?? "");
      if (!threadId || !body) return;
      // Pull the last message in the thread so we can build a proper Reply.
      const thread = await readGmailThread(googleToken, threadId);
      if (!thread.ok) {
        setMessages((m) => [
          ...m,
          { role: "system", text: `Gmail: ${thread.message}`, failed: true },
        ]);
        return;
      }
      const last = thread.messages[thread.messages.length - 1];
      if (!last) return;
      const toAddr = last.from.match(/<([^>]+)>/)?.[1] ?? last.from;
      const res = await sendGmail(googleToken, {
        threadId,
        to: [toAddr],
        subject: last.subject.startsWith("Re:") ? last.subject : `Re: ${last.subject}`,
        body,
        inReplyTo: last.messageId,
        references: last.references
          ? last.references.split(/\s+/).concat([last.messageId]).filter(Boolean)
          : [last.messageId].filter(Boolean),
      });
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { role: "system", text: `Send failed: ${res.message}`, failed: true },
        ]);
        sfx.error();
        return;
      }
      const ack = "Reply sent.";
      setMessages((m) => [...m, { role: "model", text: ack }]);
      recordTurn("model", ack);
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
    recordTurn("user", text);
    setBusy(true);
    setOrbMode("thinking");

    const history: LuminaMessage[] = [...messages, userMsg]
      .filter((m): m is DisplayMessage & { role: "user" | "model" } =>
        m.role === "user" || m.role === "model",
      )
      .map((m) => ({ role: m.role, text: m.text }));

    // Build context with FULL job awareness — universeIndex + matchedJobs.
    const context = buildLuminaContext(text);

    const mem = loadMemory();
    const result = await sendToLumina(history, context, {
      // Persistent facts + top 3 unread North Sky threads. The transient
      // email lines are merged in at request time, never written to durable
      // memory — they refresh on every poll cycle.
      facts: [...mem.facts.map((f) => f.text), ...topUnreadEmailLines],
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
    if (replyText) recordTurn("model", replyText);

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
          recordTurn("user", text.trim());
          setLiveCaption("");
          // When Billy says a WO out loud, push a fresh context with that WO
          // matched so Lumina has the full Smartsheet record on the next turn.
          const fresh = buildLuminaContext(text.trim());
          liveSessionRef.current?.pushContext(fresh);
        }
      },
      onModelTranscript: (text, isFinal) => {
        if (isFinal && text.trim()) {
          setMessages((m) => [...m, { role: "model", text: text.trim() }]);
          recordTurn("model", text.trim());
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
      // Initial Smartsheet truth payload — sent right after setupComplete so
      // Lumina has universe context before Billy speaks. Same shape as chat.
      getInitialContext: () => buildLuminaContext(),
      // Initial MEMORY payload — facts + summary from prior sessions.
      // Without this Live mode was amnesiac and fabricated identifiers from
      // training-data priors. Now Live and chat share identical memory state.
      getInitialMemory: () => {
        const mem = loadMemory();
        return {
          facts: [...mem.facts.map((f) => f.text), ...topUnreadEmailLines],
          summary: mem.summary,
        };
      },
      // Native Gemini Live function calling — dispatch to the same handlers
      // that power chat-side tools so the two surfaces behave identically.
      onToolCall: async (call): Promise<LuminaLiveToolResult> => {
        try {
          if (call.name === "flyToJob") {
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
              return { ok: false, message: `Work order ${wo} not in universe.` };
            }
            selectJob(j.id);
            sfx.confirm();
            return {
              ok: true,
              message: `Flew to ${j.workOrder} in ${j.status}.`,
              data: {
                workOrder: j.workOrder,
                galaxy: j.status,
                secondaryStatus: j.rawSecondaryStatus ?? null,
                address: j.fullAddress ?? null,
                scheduleDate: j.scheduleDate ?? null,
                notes: j.notes ?? null,
              },
            };
          }
          if (call.name === "flyToGalaxy") {
            const g = String(call.args.galaxy ?? "") as Galaxy;
            if ((GALAXIES as readonly string[]).includes(g)) {
              enterGalaxy(g);
              sfx.confirm();
              return { ok: true, message: `Entered ${g} galaxy.` };
            }
            return { ok: false, message: `Unknown galaxy: ${g}` };
          }
          if (call.name === "lookupJob") {
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
              return { ok: false, message: `Work order ${wo} not in universe.` };
            }
            return {
              ok: true,
              data: {
                workOrder: j.workOrder,
                galaxy: j.status,
                secondaryStatus: j.rawSecondaryStatus ?? null,
                jobStatus: j.jobStatus ?? null,
                address: j.fullAddress ?? null,
                city: j.city ?? null,
                workType: j.workType ?? null,
                crew: j.crew ?? null,
                permitNumber: j.permitNumber ?? null,
                scheduleDate: j.scheduleDate ?? null,
                endDate: j.endDate ?? null,
                dueDate: j.dueDate ?? null,
                bidValue: j.bidValue ?? null,
                notes: j.notes ?? null,
                splicingNotes: j.splicingNotes ?? null,
              },
            };
          }
          if (call.name === "showRoute") {
            const wos = (call.args.workOrders as string[]) ?? [];
            const ids = jobs.filter((j) => wos.includes(j.workOrder)).map((j) => j.id);
            setRouteJobIds(ids);
            setMapOpen(true);
            sfx.confirm();
            return { ok: true, message: `Plotted ${ids.length} stops.` };
          }
          if (call.name === "resetToUniverse") {
            resetToUniverse();
            sfx.confirm();
            return { ok: true, message: "Returned to universe view." };
          }
          if (call.name === "rememberFact") {
            const fact = String(call.args.fact ?? "");
            if (!fact.trim()) {
              return { ok: false, message: "Fact text is empty." };
            }
            const { factId } = rememberFact(fact, "explicit");
            sfx.confirm();
            return {
              ok: true,
              message: `Memory committed.`,
              data: { factId: factId ?? null },
            };
          }
          if (call.name === "listNorthSkyEmails") {
            if (!googleToken) {
              return { ok: false, message: "Not signed in to Google." };
            }
            const filter = call.args.filter ? String(call.args.filter) : undefined;
            const unreadOnly = Boolean(call.args.unreadOnly);
            const limit = Math.min(Number(call.args.limit ?? 10) || 10, 25);
            // Server forces North Sky scope — `label` is not exposed.
            const res = await listGmail(googleToken, {
              query: filter,
              unreadOnly,
              limit,
            });
            if (!res.ok) return { ok: false, message: res.message };
            return {
              ok: true,
              data: {
                count: res.messages.length,
                messages: res.messages.slice(0, limit).map((m) => ({
                  id: m.id,
                  threadId: m.threadId,
                  subject: m.subject,
                  from: m.from,
                  snippet: m.snippet,
                  date: m.date,
                  unread: m.unread,
                })),
              },
            };
          }
          if (call.name === "readThread") {
            if (!googleToken) return { ok: false, message: "Not signed in to Google." };
            const threadId = String(call.args.threadId ?? "");
            if (!threadId) return { ok: false, message: "Missing threadId." };
            const res = await readGmailThread(googleToken, threadId);
            if (!res.ok) return { ok: false, message: res.message };
            return {
              ok: true,
              data: {
                threadId: res.threadId,
                messages: res.messages.map((m) => ({
                  from: m.from,
                  date: m.date,
                  subject: m.subject,
                  body: (m.plainBody || m.snippet || "").slice(0, 2000),
                })),
              },
            };
          }
          if (call.name === "summarizeThread") {
            if (!googleToken) return { ok: false, message: "Not signed in to Google." };
            const threadId = String(call.args.threadId ?? "");
            const cached = threadSummaries[threadId];
            if (cached) return { ok: true, data: { summary: cached } };
            const res = await readGmailThread(googleToken, threadId);
            if (!res.ok) return { ok: false, message: res.message };
            const last = res.messages[res.messages.length - 1];
            if (!last) return { ok: false, message: "Empty thread." };
            const summary = `${last.subject} — last: ${last.from} ${last.date}. ${(last.plainBody || last.snippet || "").slice(0, 220)}`;
            setThreadSummary(threadId, summary);
            return { ok: true, data: { summary } };
          }
          if (call.name === "openMoonForJob") {
            const wo = String(call.args.wo ?? "");
            const norm = (s: string) => s.replace(/[\s\-_.]/g, "").toUpperCase();
            const target = norm(wo);
            const j = jobs.find((x) => norm(x.workOrder ?? "") === target);
            if (!j) return { ok: false, message: `Work order ${wo} not in universe.` };
            selectJob(j.id);
            const newest = (j.moons ?? [])
              .slice()
              .sort((a, b) => (b.date > a.date ? 1 : -1))[0];
            if (newest) {
              openThread(newest.threadId, j.id);
              return {
                ok: true,
                message: `Opened newest moon on ${j.workOrder}.`,
                data: { threadId: newest.threadId },
              };
            }
            return { ok: true, message: `${j.workOrder} has no moons.`, data: { threadId: null } };
          }
          if (call.name === "draftReply") {
            // Live mode keeps drafts in-conversation — return text for the
            // model to speak, no UI side-effect.
            const intent = String(call.args.intent ?? "");
            return { ok: true, data: { draft: intent } };
          }
          if (call.name === "sendReply") {
            const confirm = Boolean(call.args.confirm);
            if (!confirm) {
              return {
                ok: false,
                message: "Refusing to send — confirm flag is false. State the draft and get a yes first.",
              };
            }
            if (!googleToken) return { ok: false, message: "Not signed in to Google." };
            const threadId = String(call.args.threadId ?? "");
            const body = String(call.args.body ?? "");
            if (!threadId || !body) return { ok: false, message: "Missing threadId or body." };
            const thread = await readGmailThread(googleToken, threadId);
            if (!thread.ok) return { ok: false, message: thread.message };
            const last = thread.messages[thread.messages.length - 1];
            if (!last) return { ok: false, message: "Empty thread." };
            const toAddr = last.from.match(/<([^>]+)>/)?.[1] ?? last.from;
            const res = await sendGmail(googleToken, {
              threadId,
              to: [toAddr],
              subject: last.subject.startsWith("Re:") ? last.subject : `Re: ${last.subject}`,
              body,
              inReplyTo: last.messageId,
              references: last.references
                ? last.references.split(/\s+/).concat([last.messageId]).filter(Boolean)
                : [last.messageId].filter(Boolean),
            });
            if (!res.ok) return { ok: false, message: res.message };
            return { ok: true, message: "Reply sent.", data: { messageId: res.messageId } };
          }
          return { ok: false, message: `Unknown tool: ${call.name}` };
        } catch (err) {
          return { ok: false, message: (err as Error).message };
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

        {/* Memory Inspector — facts list with source / timestamp / edit / delete,
            plus a Settings sub-panel for retention, auto-save, sync, and the
            "forget all" emergency button. Persistence happens immediately and
            propagates to remote sync if configured. */}
        {showMemory && (
          <div
            className="px-4 py-3 text-[11px] font-mono"
            style={{
              background: "#000",
              borderBottom: `1px solid ${NEON_GREEN}22`,
              maxHeight: 260,
              overflowY: "auto",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="uppercase tracking-tactical text-white/50">
                memory · {memory.facts.length} facts
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMemFilter((f) => (f === "all" ? "email" : "all"))}
                  className={`uppercase ${memFilter === "email" ? "text-white" : "text-white/40 hover:text-white/80"}`}
                  title="Filter to email-derived memories"
                >
                  {memFilter === "email" ? "email" : "all"}
                </button>
                <button
                  onClick={() => setShowSettings((v) => !v)}
                  className={`uppercase ${showSettings ? "text-white" : "text-white/40 hover:text-white/80"}`}
                >
                  settings
                </button>
                {memory.facts.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm("Forget every memory? This can't be undone.")) {
                        clearAllMemory();
                        setMemTick((t) => t + 1);
                      }
                    }}
                    className="text-white/40 hover:text-red-300 uppercase"
                  >
                    forget all
                  </button>
                )}
              </div>
            </div>

            {showSettings ? (
              <MemorySettingsPanel
                settings={memory.settings}
                onChange={(patch) => {
                  updateMemorySettings(patch);
                  setMemTick((t) => t + 1);
                }}
                neon={NEON_GREEN_BRIGHT}
              />
            ) : memory.facts.length === 0 ? (
              <div className="text-white/30 italic">
                No persistent facts yet. Tell Lumina to remember something, or just talk —
                auto-save will pick up commitments and status changes.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {[...memory.facts]
                  .filter((f) =>
                    memFilter === "email" ? /^Thread re:/i.test(f.text) : true,
                  )
                  .sort((a, b) => b.ts - a.ts)
                  .map((f: MemoryFact) => {
                    const isEditing = editingFactId === f.id;
                    return (
                      <li
                        key={f.id}
                        className="group rounded-sm px-2 py-1.5"
                        style={{
                          background: "rgba(57,255,122,0.04)",
                          border: `1px solid ${NEON_GREEN}22`,
                          color: NEON_GREEN_BRIGHT,
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          {isEditing ? (
                            <textarea
                              value={editingFactText}
                              onChange={(e) => setEditingFactText(e.target.value)}
                              autoFocus
                              rows={2}
                              className="flex-1 bg-black text-white px-2 py-1 text-[11px] outline-none resize-none"
                              style={{ border: `1px solid ${NEON_GREEN}88` }}
                            />
                          ) : (
                            <span className="leading-snug flex-1">{f.text}</span>
                          )}
                          <div className="flex items-center gap-1 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => {
                                    updateFact(f.id, editingFactText);
                                    setEditingFactId(null);
                                    setEditingFactText("");
                                  }}
                                  className="px-1 text-white/80 hover:text-white"
                                  aria-label="Save"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingFactId(null);
                                    setEditingFactText("");
                                  }}
                                  className="px-1 text-white/40 hover:text-white/80"
                                  aria-label="Cancel"
                                >
                                  ✗
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingFactId(f.id);
                                    setEditingFactText(f.text);
                                  }}
                                  className="px-1 text-white/40 hover:text-white/80"
                                  aria-label="Edit"
                                >
                                  ✎
                                </button>
                                <button
                                  onClick={() => {
                                    forgetFactById(f.id);
                                    setMemTick((t) => t + 1);
                                  }}
                                  className="px-1 text-white/40 hover:text-red-300"
                                  aria-label="Forget"
                                >
                                  ×
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[9px] uppercase tracking-tactical text-white/35">
                          <span
                            className="px-1 rounded-sm"
                            style={{
                              color: f.source === "auto" ? "#5BF3FF" : f.source === "explicit" ? NEON_GREEN_BRIGHT : "#FFB36B",
                              border: `1px solid ${f.source === "auto" ? "#5BF3FF55" : f.source === "explicit" ? NEON_GREEN + "55" : "#FFB36B55"}`,
                            }}
                          >
                            {f.source}
                          </span>
                          <span>{formatRelativeTime(f.ts)}</span>
                        </div>
                      </li>
                    );
                  })}
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

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 *  Memory Settings sub-panel. Operator can tune retention, toggle auto-save
 *  heuristics, and turn remote sync on/off. Writes go through
 *  updateMemorySettings so they propagate to localStorage + remote.
 */
function MemorySettingsPanel({
  settings,
  onChange,
  neon,
}: {
  settings: import("@/lib/luminaMemory").MemorySettings;
  onChange: (patch: Partial<import("@/lib/luminaMemory").MemorySettings>) => void;
  neon: string;
}) {
  return (
    <div className="space-y-2.5 text-[11px]">
      <div className="flex items-center justify-between">
        <label className="text-white/60 uppercase tracking-tactical">
          retention (days, 0 = forever)
        </label>
        <input
          type="number"
          min={0}
          max={3650}
          value={settings.retentionDays}
          onChange={(e) => onChange({ retentionDays: Math.max(0, Number(e.target.value || 0)) })}
          className="w-16 bg-black text-white px-2 py-0.5 outline-none text-right"
          style={{ border: `1px solid ${neon}66` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-white/60 uppercase tracking-tactical">
          auto-save commitments
        </label>
        <button
          onClick={() => onChange({ autoSave: !settings.autoSave })}
          className="px-2 py-0.5 uppercase tracking-tactical"
          style={{
            color: settings.autoSave ? "#000" : neon,
            background: settings.autoSave ? neon : "transparent",
            border: `1px solid ${neon}66`,
          }}
        >
          {settings.autoSave ? "on" : "off"}
        </button>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-white/60 uppercase tracking-tactical">
          remote sync (cross-device)
        </label>
        <button
          onClick={() => onChange({ remoteSync: !settings.remoteSync })}
          className="px-2 py-0.5 uppercase tracking-tactical"
          style={{
            color: settings.remoteSync ? "#000" : neon,
            background: settings.remoteSync ? neon : "transparent",
            border: `1px solid ${neon}66`,
          }}
        >
          {settings.remoteSync ? "on" : "off"}
        </button>
      </div>
      <div className="text-white/35 leading-snug pt-1 border-t border-white/10">
        Memory persists in this browser. Cross-device sync requires the server
        to have FIRESTORE_PROJECT_ID + FIRESTORE_API_KEY configured.
      </div>
    </div>
  );
}
