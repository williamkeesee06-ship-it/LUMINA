import { useEffect, useMemo, useRef, useState } from "react";
import { useUI } from "@/store/uiStore";
import {
  readGmailThread,
  sendGmail,
  type GmailThreadMessage,
} from "@/lib/api";
import { sfx } from "@/lib/audio";
import { rememberFact } from "@/lib/luminaMemory";

/**
 *  EmailThreadView — in-cockpit Gmail thread viewer.
 *
 *  Slides in from the right when `store.openThreadId` is set. Loads the
 *  full thread via /api/gmail-thread, renders sanitized HTML or plain
 *  text fallback, and supports inline reply with send-confirmation.
 *
 *  The viewer collapses quoted history blocks (lines starting with ">"
 *  and any "On ... wrote:" pattern) so the active message reads first,
 *  not the 9-deep reply chain.
 */

const NEON_GREEN = "#39FF7A";
const NEON_GREEN_BRIGHT = "#7CFFA8";
const NEON_BLUE = "#3D7BFF";
const NEON_BLUE_BRIGHT = "#6DA3FF";

export function EmailThreadView() {
  const openThreadId = useUI((s) => s.openThreadId);
  const openThreadJobId = useUI((s) => s.openThreadJobId);
  const closeThread = useUI((s) => s.closeThread);
  const markMoonRead = useUI((s) => s.markMoonRead);
  const setThreadSummary = useUI((s) => s.setThreadSummary);
  const googleToken = useUI((s) => s.googleToken);
  const jobs = useUI((s) => s.jobs);

  const [messages, setMessages] = useState<GmailThreadMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentMessageId, setSentMessageId] = useState<string | null>(null);
  // Track whether we already auto-summarized this thread (one summary save
  // per thread per open; same thread re-opened reuses cached summary).
  const summarizedRef = useRef<string | null>(null);

  const parentJob = useMemo(
    () => jobs.find((j) => j.id === openThreadJobId) ?? null,
    [jobs, openThreadJobId],
  );

  useEffect(() => {
    setMessages([]);
    setError(null);
    setComposerOpen(false);
    setComposerText("");
    setConfirming(false);
    setSentMessageId(null);
    summarizedRef.current = null;
    if (!openThreadId) return;
    if (!googleToken) {
      setError("Not signed in to Google. Tap the orb to re-authorize.");
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      const result = await readGmailThread(googleToken, openThreadId);
      if (!alive) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessages(result.messages);
      markMoonRead(openThreadId);
      // Save an auto-summary into Lumina's persistent memory the first time
      // a thread is opened in this session. Cheap heuristic — last message
      // sender + subject + WO + snippet. Real Gemini summarization happens
      // via the `summarizeThread` tool when Lumina is asked.
      if (result.messages.length > 0 && summarizedRef.current !== openThreadId) {
        summarizedRef.current = openThreadId;
        const last = result.messages[result.messages.length - 1];
        const subj = last.subject || "(no subject)";
        const who = parseFromName(last.from);
        const when = last.date || "recent";
        const wo = parentJob?.workOrder ?? null;
        const tldr = (last.plainBody || last.snippet || "").slice(0, 160);
        const text = `Thread re: ${subj}${wo ? ` (WO ${wo})` : ""} — last: ${who} ${when}. TL;DR: ${tldr}`;
        setThreadSummary(openThreadId, text);
        rememberFact(text, "auto");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openThreadId, googleToken]);

  const subject = messages[0]?.subject || "(no subject)";
  const participants = useMemo(() => {
    const set = new Set<string>();
    for (const m of messages) {
      if (m.from) set.add(parseFromAddress(m.from));
      for (const e of (m.to ?? "").split(/[,;]+/)) {
        const t = e.trim();
        if (t) set.add(parseFromAddress(t));
      }
    }
    return Array.from(set);
  }, [messages]);

  const ordered = useMemo(() => {
    const copy = [...messages];
    copy.sort(
      (a, b) =>
        Number(b.internalDate || 0) - Number(a.internalDate || 0),
    );
    return order === "newest" ? copy : copy.reverse();
  }, [messages, order]);

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  // Compose a Reply target from the most recent message. To = original From,
  // Cc carries forward existing Cc set minus the user.
  const replyTarget = useMemo(() => {
    if (!lastMessage) return null;
    const from = parseFromAddress(lastMessage.from);
    const ccList = (lastMessage.cc ?? "")
      .split(/[,;]+/)
      .map((s) => parseFromAddress(s.trim()))
      .filter(Boolean);
    return {
      to: [from],
      cc: ccList,
      subject: lastMessage.subject.startsWith("Re:")
        ? lastMessage.subject
        : `Re: ${lastMessage.subject}`,
      inReplyTo: lastMessage.messageId,
      references: lastMessage.references
        ? lastMessage.references.split(/\s+/).concat([lastMessage.messageId]).filter(Boolean)
        : [lastMessage.messageId].filter(Boolean),
      threadId: openThreadId,
    };
  }, [lastMessage, openThreadId]);

  if (!openThreadId) return null;

  const handleSend = async () => {
    if (!googleToken || !replyTarget || !composerText.trim()) return;
    setSending(true);
    const result = await sendGmail(googleToken, {
      threadId: replyTarget.threadId ?? undefined,
      to: replyTarget.to,
      cc: replyTarget.cc.length > 0 ? replyTarget.cc : undefined,
      subject: replyTarget.subject,
      body: composerText,
      inReplyTo: replyTarget.inReplyTo,
      references: replyTarget.references,
    });
    setSending(false);
    setConfirming(false);
    if (!result.ok) {
      setError(`Send failed: ${result.message}`);
      sfx.error();
      return;
    }
    setSentMessageId(result.messageId);
    setComposerOpen(false);
    setComposerText("");
    sfx.confirm();
  };

  return (
    <div
      className="pointer-events-auto fixed right-0 top-0 bottom-0 z-50 w-[520px] max-w-[44vw] overflow-hidden"
      style={{
        background: "#000",
        borderLeft: `1px solid ${NEON_GREEN}55`,
        boxShadow: `-12px 0 36px #000d, 0 0 60px ${NEON_GREEN}22`,
      }}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 px-4 py-3"
          style={{ borderBottom: `1px solid ${NEON_GREEN}33` }}
        >
          <div className="min-w-0 flex-1">
            <div
              className="font-display tracking-tactical text-[10px] uppercase mb-1"
              style={{ color: NEON_GREEN_BRIGHT, textShadow: `0 0 6px ${NEON_GREEN}88` }}
            >
              moon · email thread
              {parentJob ? ` · ${parentJob.workOrder}` : ""}
            </div>
            <div
              className="text-sm font-display text-white truncate"
              style={{ textShadow: "0 0 4px rgba(255,255,255,0.4)" }}
              title={subject}
            >
              {subject}
            </div>
            <div className="font-mono text-[10px] text-white/45 mt-1 truncate">
              {participants.slice(0, 4).join(" · ")}
              {participants.length > 4 ? ` +${participants.length - 4}` : ""}
              <span className="mx-2 text-white/25">·</span>
              {messages.length} message{messages.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                sfx.select();
                closeThread();
              }}
              aria-label="Close thread"
              className="text-white/50 hover:text-white text-lg leading-none px-1"
            >
              ×
            </button>
            <a
              href={`https://mail.google.com/mail/u/0/#inbox/${openThreadId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[9px] uppercase tracking-tactical px-2 py-0.5"
              style={{
                color: NEON_BLUE_BRIGHT,
                border: `1px solid ${NEON_BLUE}66`,
              }}
              title="Open in Gmail (fallback)"
            >
              open in gmail
            </a>
            <button
              type="button"
              onClick={() => setOrder((o) => (o === "newest" ? "oldest" : "newest"))}
              className="font-mono text-[9px] uppercase tracking-tactical px-2 py-0.5"
              style={{
                color: "#ffffff88",
                border: "1px solid #ffffff22",
              }}
            >
              {order === "newest" ? "newest first" : "oldest first"}
            </button>
          </div>
        </div>

        {/* Body — message list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loading && (
            <div className="text-xs font-mono text-white/50">Loading thread…</div>
          )}
          {error && (
            <div
              className="text-xs font-mono px-2 py-1.5 rounded-sm"
              style={{
                color: "#FF6B6B",
                border: "1px solid #FF6B6B55",
                background: "#FF6B6B11",
              }}
            >
              {error}
            </div>
          )}
          {sentMessageId && (
            <div
              className="text-xs font-mono px-2 py-1.5 rounded-sm"
              style={{
                color: NEON_GREEN_BRIGHT,
                border: `1px solid ${NEON_GREEN}66`,
                background: `${NEON_GREEN}11`,
              }}
            >
              Reply sent.
            </div>
          )}
          {ordered.map((m) => (
            <MessageBlock key={m.id} msg={m} />
          ))}
        </div>

        {/* Composer */}
        {composerOpen && replyTarget && (
          <div
            className="px-4 py-3"
            style={{ borderTop: `1px solid ${NEON_GREEN}33`, background: "#04060a" }}
          >
            <div className="font-mono text-[10px] uppercase text-white/50 mb-1">
              reply → {replyTarget.to.join(", ")}
              {replyTarget.cc.length > 0 ? `  cc: ${replyTarget.cc.join(", ")}` : ""}
            </div>
            <textarea
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              rows={6}
              placeholder="Write the reply…"
              className="w-full rounded-sm px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none font-body outline-none"
              style={{
                background: "#000",
                border: `1px solid ${NEON_BLUE}55`,
                boxShadow: `inset 0 0 12px ${NEON_BLUE}22`,
              }}
            />
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setComposerOpen(false);
                  setComposerText("");
                  setConfirming(false);
                }}
                className="font-mono text-[10px] uppercase text-white/50 px-2 py-1"
                style={{ border: "1px solid #ffffff22" }}
              >
                cancel
              </button>
              {!confirming ? (
                <button
                  type="button"
                  disabled={!composerText.trim() || sending}
                  onClick={() => setConfirming(true)}
                  className="font-display text-[11px] uppercase tracking-tactical px-3 py-1.5 rounded-sm disabled:opacity-30"
                  style={{
                    color: NEON_GREEN_BRIGHT,
                    border: `1px solid ${NEON_GREEN}88`,
                    background: "transparent",
                    textShadow: `0 0 6px ${NEON_GREEN}aa`,
                  }}
                >
                  send
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase text-white/70">
                    send to {replyTarget.to.join(", ")}?
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={sending}
                    className="font-mono text-[10px] uppercase text-white/60 px-2 py-1"
                    style={{ border: "1px solid #ffffff22" }}
                  >
                    cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending}
                    className="font-display text-[11px] uppercase tracking-tactical px-3 py-1.5 rounded-sm disabled:opacity-50"
                    style={{
                      color: "#000",
                      background: NEON_GREEN,
                      boxShadow: `0 0 14px ${NEON_GREEN}cc`,
                    }}
                  >
                    {sending ? "transmitting…" : "confirm send"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer — reply controls */}
        {!composerOpen && replyTarget && (
          <div
            className="px-4 py-2 flex items-center justify-between"
            style={{ borderTop: `1px solid ${NEON_GREEN}26`, background: "#04060a" }}
          >
            <div className="font-mono text-[10px] uppercase text-white/45">
              {participants.length} participant{participants.length === 1 ? "" : "s"}
            </div>
            <button
              type="button"
              onClick={() => {
                setComposerOpen(true);
                setComposerText("");
              }}
              className="font-display text-[11px] uppercase tracking-tactical px-3 py-1.5 rounded-sm"
              style={{
                color: NEON_GREEN_BRIGHT,
                border: `1px solid ${NEON_GREEN}88`,
                background: "transparent",
              }}
            >
              reply
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBlock({ msg }: { msg: GmailThreadMessage }) {
  const [expandedQuote, setExpandedQuote] = useState(false);
  const fromName = parseFromName(msg.from);
  const initials = (fromName || msg.from || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Pick plain text if available; trim trailing quoted history.
  const { active, quoted } = useMemo(() => splitQuoted(msg.plainBody || ""), [msg.plainBody]);
  const hasHtml = Boolean(msg.htmlBody);
  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{
        background: "#04060a",
        border: "1px solid #ffffff14",
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: "#0a0d14" }}>
        <div
          className="grid place-items-center w-7 h-7 rounded-full text-[10px] font-display"
          style={{
            background: "#000",
            border: `1px solid ${NEON_GREEN}66`,
            color: NEON_GREEN_BRIGHT,
            boxShadow: `0 0 8px ${NEON_GREEN}44`,
          }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-white truncate">{fromName || msg.from}</div>
          <div className="font-mono text-[10px] text-white/40 truncate">{msg.date}</div>
        </div>
        {msg.unread && (
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: NEON_GREEN, boxShadow: `0 0 8px ${NEON_GREEN}` }}
          />
        )}
      </div>
      <div className="px-3 py-2 text-sm text-white/90 leading-relaxed font-body">
        {hasHtml ? (
          <div
            className="email-body"
            dangerouslySetInnerHTML={{ __html: msg.htmlBody }}
          />
        ) : (
          <>
            <div className="whitespace-pre-wrap">{active || msg.snippet}</div>
            {quoted && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setExpandedQuote((v) => !v)}
                  className="font-mono text-[10px] uppercase text-white/40 hover:text-white/70"
                >
                  {expandedQuote ? "hide quoted" : "…show quoted history"}
                </button>
                {expandedQuote && (
                  <div
                    className="whitespace-pre-wrap mt-2 text-white/45 text-[12px] pl-3"
                    style={{ borderLeft: "2px solid #ffffff22" }}
                  >
                    {quoted}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function parseFromAddress(raw: string): string {
  if (!raw) return "";
  const m = raw.match(/<([^>]+)>/);
  if (m) return m[1].trim();
  return raw.trim();
}

function parseFromName(raw: string): string {
  if (!raw) return "";
  const m = raw.match(/^\s*"?([^"<]+?)"?\s*</);
  if (m) return m[1].trim();
  return parseFromAddress(raw);
}

/**
 *  Split a plain-text email body into the active reply portion and any
 *  trailing quoted history (the "On ... wrote:" wall). Heuristic — looks
 *  for the first run of "> " lines or the canonical "On … wrote:" line
 *  and treats everything after as quoted.
 */
function splitQuoted(body: string): { active: string; quoted: string } {
  if (!body) return { active: "", quoted: "" };
  const lines = body.split(/\r?\n/);
  let cut = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^On .{5,80}? wrote:$/.test(l.trim())) {
      cut = i;
      break;
    }
    if (/^>/.test(l.trim())) {
      cut = i;
      break;
    }
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(l.trim())) {
      cut = i;
      break;
    }
  }
  if (cut < 0) return { active: body.trim(), quoted: "" };
  const active = lines.slice(0, cut).join("\n").trim();
  const quoted = lines.slice(cut).join("\n").trim();
  return { active, quoted };
}
