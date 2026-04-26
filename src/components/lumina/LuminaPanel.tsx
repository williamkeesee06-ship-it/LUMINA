import { useEffect, useRef, useState } from "react";
import { useUI, selectGalaxyCounts } from "@/store/uiStore";
import { sendToLumina, type LuminaMessage } from "@/lib/api";
import { sfx } from "@/lib/audio";
import { GALAXIES, type Galaxy } from "@/types";

interface ToolCall {
  name: "flyToGalaxy" | "flyToJob" | "showRoute" | "resetToUniverse";
  args: Record<string, unknown>;
}

interface DisplayMessage {
  role: "user" | "model" | "system";
  text: string;
  toolCall?: ToolCall;
  failed?: boolean;
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

export function LuminaPanel() {
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

  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      role: "model",
      text: "LUMINA online. Operator, give me a target.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isChatOpen) inputRef.current?.focus();
  }, [isChatOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const executeTool = (call: ToolCall) => {
    if (call.name === "resetToUniverse") {
      resetToUniverse();
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
    }
  };

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const userMsg: DisplayMessage = { role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);
    setOrbMode("thinking");

    // Build history for Gemini (only user/model entries)
    const history: LuminaMessage[] = [...messages, userMsg]
      .filter((m): m is DisplayMessage & { role: "user" | "model" } =>
        m.role === "user" || m.role === "model",
      )
      .map((m) => ({ role: m.role, text: m.text }));

    const context = {
      operator: "Billy Keesee",
      viewMode,
      focusedGalaxy,
      selectedJobNumber,
      googleConnected: Boolean(googleToken),
      galaxyCounts: counts,
      totalJobs: jobs.length,
      sample: focusedGalaxy
        ? jobs
            .filter((j) => j.status === focusedGalaxy)
            .slice(0, 8)
            .map((j) => ({
              workOrder: j.workOrder,
              address: j.fullAddress,
              status: j.rawSecondaryStatus,
            }))
        : null,
    };

    const result = await sendToLumina(history, context);
    if (!result.ok) {
      setMessages((m) => [...m, { role: "system", text: result.message, failed: true }]);
      setOrbMode("idle");
      sfx.error();
      setBusy(false);
      return;
    }
    const { clean, toolCall } = parseToolCall(result.text);
    setMessages((m) => [
      ...m,
      { role: "model", text: clean || (toolCall ? "Engaging." : ""), toolCall: toolCall ?? undefined },
    ]);
    if (toolCall) {
      setOrbMode("navigating");
      executeTool(toolCall);
      setTimeout(() => setOrbMode("idle"), 1200);
    } else {
      setOrbMode("idle");
    }
    setBusy(false);
  }

  if (!isChatOpen) return null;

  // Avoid colliding with right-docked vertical HUD.
  const rightOffset = hudOrientation === "vertical" ? 244 : 24;
  const bottomOffset = hudOrientation === "vertical" ? 24 : 128;

  return (
    <div
      className="pointer-events-auto fixed z-40 w-[420px] max-w-[44vw]"
      style={{ right: rightOffset, bottom: bottomOffset }}
    >
      <div className="metallic-plate clip-corner relative overflow-hidden">
        <span className="reticle opacity-30" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-glow/15">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-magenta-signal shadow-[0_0_10px_#FF3D9A]" />
            <span className="font-display tracking-tactical text-xs uppercase text-magenta-signal">
              LUMINA
            </span>
            <span className="font-mono text-[10px] text-white/40">tactical intelligence</span>
          </div>
          <button
            type="button"
            onClick={() => {
              sfx.select();
              setChatOpen(false);
            }}
            className="text-cyan-glow/60 hover:text-cyan-glow"
            aria-label="Close LUMINA"
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="max-h-[44vh] overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] px-3 py-2 rounded-sm bg-cyan-glow/10 border border-cyan-glow/30 text-sm text-white"
                    : m.role === "system"
                      ? "max-w-[90%] px-3 py-2 rounded-sm border border-red-alert/40 bg-red-alert/5 text-xs font-mono text-red-alert"
                      : "max-w-[90%] px-3 py-2 rounded-sm bg-magenta-signal/8 border border-magenta-signal/25 text-sm text-white"
                }
              >
                {m.role === "model" && (
                  <div className="font-display tracking-wider text-[10px] uppercase text-magenta-signal/80 mb-1">
                    LUMINA
                  </div>
                )}
                <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                {m.toolCall && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-magenta-signal/15 border border-magenta-signal/40 font-mono text-[10px] text-magenta-signal uppercase tracking-tactical">
                    <span className="w-1 h-1 rounded-full bg-magenta-signal" />
                    {m.toolCall.name}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs font-mono text-magenta-signal/70 px-3">
              <span className="w-1.5 h-1.5 rounded-full bg-magenta-signal animate-pulse" />
              Computing…
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-cyan-glow/15">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder='Try: "fly to needs fielding" — or "show me 23017359"'
            rows={2}
            className="w-full bg-black/40 border border-cyan-glow/20 rounded-sm px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none neon-focus font-body"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="font-mono text-[10px] text-white/30">
              ↵ to transmit · ⇧↵ for newline
            </div>
            <button
              type="button"
              onClick={send}
              disabled={busy || !input.trim()}
              className="font-display text-[11px] uppercase tracking-tactical px-3 py-1.5 border border-magenta-signal/50 text-magenta-signal rounded-sm hover:bg-magenta-signal/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              transmit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
