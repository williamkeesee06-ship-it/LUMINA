/**
 *  ReminderStrip (PR #6) — bottom-left notification strip next to LUMINA orb.
 *
 *  Behavior:
 *    - Auto-rotates through queue every ~5s; hover pauses.
 *    - Click to expand into a checkbox to-do panel (modal-style overlay).
 *    - Each item has a checkbox (complete) and × (dismiss).
 *    - ESC / outside-click collapses.
 *    - Lives at z-30 so the chat panel (z-40) sits on top when open.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useUI } from "@/store/uiStore";
import { useReminderStore, type ReminderItem, primeReminderStore } from "@/store/reminderStore";

const ACCENT = "#00E5FF"; // --accent-blue from PR #5
const ACCENT_DIM = "rgba(0,229,255,0.55)";
const ROTATE_INTERVAL_MS = 5000;

interface Props {
  /** Px from the left edge (just right of the LUMINA orb). */
  anchorLeft: number;
  /** Px from the bottom edge (aligns with orb bottom). */
  anchorBottom: number;
}

export function ReminderStrip({ anchorLeft, anchorBottom }: Props) {
  const visibleSelector = useReminderStore((s) => s.items);
  const dismissedSelector = useReminderStore((s) => s.dismissed);
  const completeReminder = useReminderStore((s) => s.completeReminder);
  const dismissReminder = useReminderStore((s) => s.dismissReminder);

  const unreadCount = useUI((s) => s.unreadCount);
  const isChatOpen = useUI((s) => s.isChatOpen);

  // Boot the store once.
  useEffect(() => {
    primeReminderStore();
  }, []);

  // Build the live queue: user/lumina items + a synthetic "unread emails"
  // entry when unreadCount > 0. The synthetic entry isn't stored — it's
  // composed on render so it tracks live counts.
  const queue = useMemo<ReminderItem[]>(() => {
    void dismissedSelector; // referenced so the selector subscribes
    const real = visibleSelector
      .filter((i) => !i.completedAt && !i.dismissedAt)
      .sort((a, b) => b.createdAt - a.createdAt);
    const out: ReminderItem[] = [];
    if (unreadCount > 0) {
      out.push({
        id: "__unread_emails__",
        type: "unread_email",
        text: `${unreadCount} unread email${unreadCount === 1 ? "" : "s"}`,
        createdAt: Date.now(),
      });
    }
    out.push(...real);
    return out;
  }, [visibleSelector, dismissedSelector, unreadCount]);

  const [cursor, setCursor] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Auto-rotate when not hovered, not expanded, and we have multiple items.
  useEffect(() => {
    if (hovered || expanded) return;
    if (queue.length <= 1) return;
    const id = window.setInterval(() => {
      setCursor((c) => (c + 1) % Math.max(1, queue.length));
    }, ROTATE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [hovered, expanded, queue.length]);

  // Reset cursor if the queue shrinks past it.
  useEffect(() => {
    if (cursor >= queue.length) setCursor(0);
  }, [cursor, queue.length]);

  // ESC closes the expanded panel.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  // Strip width: flex from anchorLeft up to a max, capped before bottom HUD
  // telemetry rail kicks in. Stay visually narrow on small viewports.
  // PR #6 places this in the empty horizontal band beside the LUMINA orb.
  const stripStyle: React.CSSProperties = {
    position: "fixed",
    left: anchorLeft,
    bottom: anchorBottom,
    width: `min(540px, calc(50vw - ${anchorLeft + 40}px))`,
    minWidth: 240,
    zIndex: 30, // chat panel is z-40 → it covers the strip when open
    pointerEvents: "auto",
  };

  const current = queue[cursor];

  return (
    <>
      <div
        style={stripStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-hidden={isChatOpen ? undefined : undefined}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-left"
          style={{
            background: "#04060a",
            border: `1px solid ${ACCENT}55`,
            boxShadow: `0 0 14px ${ACCENT}22, 0 0 38px ${ACCENT}11`,
            padding: "10px 14px",
            height: 44,
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderRadius: 2,
            color: ACCENT,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12.5,
            letterSpacing: "0.04em",
            textShadow: `0 0 6px ${ACCENT}66`,
          }}
          title={queue.length === 0 ? "All clear" : `${queue.length} item${queue.length === 1 ? "" : "s"} — click to expand`}
        >
          {/* Pulse dot */}
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: queue.length > 0 ? ACCENT : ACCENT_DIM,
              boxShadow: queue.length > 0 ? `0 0 8px ${ACCENT}, 0 0 16px ${ACCENT}88` : "none",
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {current ? current.text : "ALL CLEAR"}
          </span>
          {queue.length > 1 && (
            <span
              style={{
                fontSize: 10,
                color: ACCENT_DIM,
                letterSpacing: "0.12em",
                flexShrink: 0,
              }}
            >
              [{cursor + 1}/{queue.length}]
            </span>
          )}
        </button>
      </div>

      {expanded && (
        <ExpandedPanel
          queue={queue}
          anchorLeft={anchorLeft}
          anchorBottom={anchorBottom + 56}
          onComplete={(id) => {
            if (id === "__unread_emails__") return;
            completeReminder(id);
          }}
          onDismiss={(id) => {
            if (id === "__unread_emails__") return;
            dismissReminder(id);
          }}
          onClose={() => setExpanded(false)}
        />
      )}
    </>
  );
}

function ExpandedPanel({
  queue,
  anchorLeft,
  anchorBottom,
  onComplete,
  onDismiss,
  onClose,
}: {
  queue: ReminderItem[];
  anchorLeft: number;
  anchorBottom: number;
  onComplete: (id: string) => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Outside click → close.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        left: anchorLeft,
        bottom: anchorBottom,
        width: `min(540px, calc(50vw - ${anchorLeft + 40}px))`,
        minWidth: 280,
        maxHeight: "60vh",
        zIndex: 30, // chat panel still wins at z-40
        background: "#04060a",
        border: `1px solid ${ACCENT}77`,
        boxShadow: `0 0 22px ${ACCENT}33, 0 0 64px ${ACCENT}1a`,
        borderRadius: 2,
        display: "flex",
        flexDirection: "column",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          borderBottom: `1px solid ${ACCENT}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: ACCENT,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 10,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
        }}
      >
        <span>REMINDERS · {queue.length}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            color: ACCENT_DIM,
            fontSize: 14,
            lineHeight: 1,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>

      <div style={{ overflowY: "auto", padding: "6px 0" }}>
        {queue.length === 0 && (
          <div
            style={{
              padding: "16px 14px",
              color: ACCENT_DIM,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12,
              fontStyle: "italic",
            }}
          >
            All clear.
          </div>
        )}
        {queue.map((item) => (
          <ReminderRow
            key={item.id}
            item={item}
            onComplete={() => onComplete(item.id)}
            onDismiss={() => onDismiss(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ReminderRow({
  item,
  onComplete,
  onDismiss,
}: {
  item: ReminderItem;
  onComplete: () => void;
  onDismiss: () => void;
}) {
  const [fading, setFading] = useState(false);

  function handleCheck() {
    if (fading) return;
    setFading(true);
    setTimeout(onComplete, 900);
  }

  const isSuggestion = item.type === "lumina_suggestion";
  const isSynthetic = item.id === "__unread_emails__";

  return (
    <div
      style={{
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: `1px solid ${ACCENT}11`,
        opacity: fading ? 0 : 1,
        transition: "opacity 800ms ease",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 12.5,
        color: ACCENT,
        textShadow: `0 0 4px ${ACCENT}55`,
      }}
    >
      <button
        type="button"
        onClick={handleCheck}
        aria-label={isSynthetic ? "Acknowledge" : "Complete"}
        disabled={isSynthetic}
        title={isSynthetic ? "Open inbox to clear" : "Mark complete"}
        style={{
          width: 16,
          height: 16,
          flexShrink: 0,
          border: `1.5px solid ${ACCENT}`,
          background: fading ? ACCENT : "transparent",
          borderRadius: 2,
          cursor: isSynthetic ? "not-allowed" : "pointer",
          opacity: isSynthetic ? 0.35 : 1,
          display: "grid",
          placeItems: "center",
        }}
      >
        {fading && (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M1.5 5 L4 7.5 L8.5 2.5" stroke="#04060a" strokeWidth="2" fill="none" />
          </svg>
        )}
      </button>
      <span
        style={{
          flex: 1,
          textDecoration: fading ? "line-through" : "none",
          color: isSuggestion ? "#FFB347" : ACCENT,
          textShadow: isSuggestion ? "0 0 6px rgba(255,179,71,0.55)" : `0 0 4px ${ACCENT}55`,
        }}
      >
        {isSuggestion && <span style={{ opacity: 0.7, marginRight: 6 }}>· LUMINA ·</span>}
        {item.text}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        title="Dismiss"
        style={{
          background: "transparent",
          border: "none",
          color: ACCENT_DIM,
          fontSize: 14,
          lineHeight: 1,
          cursor: "pointer",
          padding: "0 4px",
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
