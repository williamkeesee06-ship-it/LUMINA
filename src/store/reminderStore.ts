/**
 *  useReminderStore — Lumina's reminder strip / to-do queue.
 *
 *  PR #12: manual-only policy. The ONLY supported insertion paths are
 *    - Lumina tool calls (source: "lumina")  — Billy tells Lumina to add it
 *    - Direct user UI actions (source: "user") — manual add buttons
 *  All proactive / auto-import sources are removed or gated off. See
 *  src/lib/situationalAwareness.ts for the legacy heuristics (now no-op
 *  unless VITE_ENABLE_SITUATIONAL_AUTOIMPORT is explicitly set).
 *
 *  Persistence: localStorage is the hot path; the optional /api/memory
 *  endpoint (with ?kind=reminders) provides Firestore cross-device sync.
 */
import { create } from "zustand";

export type ReminderType =
  | "user"
  | "lumina_suggestion"
  | "draft_pending"
  | "unread_email"
  | "new_jobs"
  | "galaxy_move";

/**
 *  Provenance of a reminder. Used by PR #12 cleanup migration to drop any
 *  item that wasn't authored by Lumina or the user. Items missing this
 *  field were created before PR #12 and are treated as "system-legacy"
 *  (i.e. removed by the cleanup pass).
 */
export type ReminderSource = "lumina" | "user" | "system-legacy";

export interface ReminderItem {
  id: string;
  type: ReminderType;
  text: string;
  createdAt: number;
  completedAt?: number;
  dismissedAt?: number;
  /** Provenance — see ReminderSource. Required for items added in PR #12+. */
  source?: ReminderSource;
  /** Optional Smartsheet job id this reminder ties to (for context). */
  sourceJobId?: string;
  /**
   *  Optional dedupe key used to avoid resurfacing the same item.
   *  For user reminders this is derived from text+type if not supplied.
   */
  dedupeKey?: string;
}

/**
 *  Dismissed-suggestion ledger entry. Keeps the dedupe key + timestamp so
 *  situational awareness can throttle (don't resurface within 24h).
 */
interface DismissedEntry {
  dedupeKey: string;
  ts: number;
}

interface ReminderState {
  items: ReminderItem[];
  /** Tombstone ledger for situational suggestions the operator dismissed. */
  dismissed: DismissedEntry[];
  hydrated: boolean;

  addReminder: (input: {
    text: string;
    type?: ReminderType;
    source: ReminderSource;
    sourceJobId?: string;
    dedupeKey?: string;
  }) => ReminderItem | null;
  completeReminder: (id: string) => void;
  dismissReminder: (id: string) => void;
  clearCompleted: () => void;
  /** Replace the local mirror with a remote snapshot (called after hydrate). */
  hydrateFromRemote: (snapshot: { items: ReminderItem[]; dismissed: DismissedEntry[] }) => void;
  /** Returns the items the UI should show — excludes completed (post-fade)
   *  and dismissed. */
  visibleItems: () => ReminderItem[];
}

const LOCAL_KEY = "lumina:reminders:v1";
const REMINDER_MAX = 200;

function cryptoRandomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* noop */
  }
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function operatorId(): string {
  try {
    const k = "lumina:operator:id";
    let id = localStorage.getItem(k);
    if (!id) {
      id = cryptoRandomId();
      localStorage.setItem(k, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

function loadLocal(): { items: ReminderItem[]; dismissed: DismissedEntry[] } | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      items?: ReminderItem[];
      dismissed?: DismissedEntry[];
    };
    return {
      items: Array.isArray(parsed.items) ? parsed.items.slice(-REMINDER_MAX) : [],
      dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [],
    };
  } catch {
    return null;
  }
}

function saveLocal(snapshot: { items: ReminderItem[]; dismissed: DismissedEntry[] }): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota / disabled — silent */
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
function pushRemote(snapshot: { items: ReminderItem[]; dismissed: DismissedEntry[] }): void {
  // Coalesce rapid writes into a trailing remote push.
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    fetch(`/api/memory?op=${encodeURIComponent(operatorId())}&kind=reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record: snapshot }),
    }).catch(() => {
      /* offline / no backend — localStorage is authoritative */
    });
  }, 800);
}

export const useReminderStore = create<ReminderState>((set, get) => ({
  items: [],
  dismissed: [],
  hydrated: false,

  addReminder: ({ text, type = "user", source, sourceJobId, dedupeKey }) => {
    const cleaned = text.trim();
    if (!cleaned) return null;
    // PR #12: hard-refuse anything that isn't Lumina- or user-authored.
    // The store is the choke point — even if a future caller forgets to
    // gate itself, nothing auto-import can land here.
    if (source !== "lumina" && source !== "user") return null;
    // Dedupe by key (or by text+type if no key) on the live queue.
    const key = dedupeKey ?? `${type}:${cleaned.toLowerCase()}`;
    const exists = get().items.find(
      (i) => !i.completedAt && !i.dismissedAt && (i.dedupeKey ?? `${i.type}:${i.text.toLowerCase()}`) === key,
    );
    if (exists) return exists;

    const item: ReminderItem = {
      id: cryptoRandomId(),
      type,
      text: cleaned,
      createdAt: Date.now(),
      source,
      sourceJobId,
      dedupeKey: key,
    };
    set((s) => {
      const next = { items: [...s.items, item].slice(-REMINDER_MAX), dismissed: s.dismissed };
      saveLocal(next);
      pushRemote(next);
      return next;
    });
    return item;
  },

  completeReminder: (id) =>
    set((s) => {
      const next = {
        items: s.items.map((i) =>
          i.id === id && !i.completedAt ? { ...i, completedAt: Date.now() } : i,
        ),
        dismissed: s.dismissed,
      };
      saveLocal(next);
      pushRemote(next);
      return next;
    }),

  dismissReminder: (id) =>
    set((s) => {
      const target = s.items.find((i) => i.id === id);
      const now = Date.now();
      const items = s.items.map((i) =>
        i.id === id ? { ...i, dismissedAt: now } : i,
      );
      // Only tombstone suggestions — user reminders are intentional and
      // dismiss should not be sticky.
      const dismissed =
        target && target.type === "lumina_suggestion" && target.dedupeKey
          ? [
              ...s.dismissed.filter((d) => d.dedupeKey !== target.dedupeKey),
              { dedupeKey: target.dedupeKey, ts: now },
            ]
          : s.dismissed;
      const next = { items, dismissed };
      saveLocal(next);
      pushRemote(next);
      return next;
    }),

  clearCompleted: () =>
    set((s) => {
      const next = {
        items: s.items.filter((i) => !i.completedAt),
        dismissed: s.dismissed,
      };
      saveLocal(next);
      pushRemote(next);
      return next;
    }),

  hydrateFromRemote: ({ items, dismissed }) =>
    set((s) => {
      // Merge by id, taking the newer record (highest of completedAt /
      // dismissedAt / createdAt).
      const byId = new Map<string, ReminderItem>();
      for (const arr of [s.items, items]) {
        for (const it of arr) {
          const prev = byId.get(it.id);
          const score = (x: ReminderItem) =>
            Math.max(x.createdAt, x.completedAt ?? 0, x.dismissedAt ?? 0);
          if (!prev || score(it) > score(prev)) byId.set(it.id, it);
        }
      }
      const dismissByKey = new Map<string, DismissedEntry>();
      for (const arr of [s.dismissed, dismissed]) {
        for (const d of arr) {
          const prev = dismissByKey.get(d.dedupeKey);
          if (!prev || d.ts > prev.ts) dismissByKey.set(d.dedupeKey, d);
        }
      }
      const next = {
        items: Array.from(byId.values()),
        dismissed: Array.from(dismissByKey.values()),
      };
      saveLocal(next);
      return next;
    }),

  visibleItems: () => {
    const now = Date.now();
    return get()
      .items.filter((i) => !i.dismissedAt && !i.completedAt)
      .filter((i) => now - i.createdAt < 30 * 24 * 60 * 60 * 1000) // 30d safety window
      .sort((a, b) => b.createdAt - a.createdAt);
  },
}));

/**
 *  PR #12 one-shot cleanup: wipe every reminder whose `source` is not
 *  "lumina" or "user". Items written before PR #12 don't have a `source`
 *  field at all — those are treated as "system-legacy" and removed.
 *
 *  Why: the operator explicitly does not want anything auto-imported into
 *  the notification center. Existing auto-imported items (situational
 *  suggestions, the old traffic-control heuristic, anything else without
 *  provenance) are blown away on first load after this PR ships. Runs
 *  exactly once per browser via NOTIF_AUTOIMPORT_CLEANUP_KEY.
 */
const NOTIF_AUTOIMPORT_CLEANUP_KEY = "notif_autoimport_cleanup_v1";

function isLuminaOrUser(item: ReminderItem): boolean {
  return item.source === "lumina" || item.source === "user";
}

function runAutoImportCleanup(snapshot: {
  items: ReminderItem[];
  dismissed: DismissedEntry[];
}): { items: ReminderItem[]; dismissed: DismissedEntry[] } {
  try {
    if (localStorage.getItem(NOTIF_AUTOIMPORT_CLEANUP_KEY) === "done") return snapshot;
  } catch {
    return snapshot;
  }
  const filteredItems = snapshot.items.filter(isLuminaOrUser);
  // Clear the dismissed tombstone ledger entirely — it only held keys
  // for situational suggestions, which are no longer produced.
  const next = { items: filteredItems, dismissed: [] };
  try {
    localStorage.setItem(NOTIF_AUTOIMPORT_CLEANUP_KEY, "done");
  } catch {
    /* quota / disabled — best effort */
  }
  if (
    filteredItems.length !== snapshot.items.length ||
    snapshot.dismissed.length > 0
  ) {
    saveLocal(next);
  }
  return next;
}

// Boot: prime from localStorage synchronously. Remote pull (best-effort)
// runs once on first call.
let primed = false;
let remoteFetched = false;
export function primeReminderStore(): void {
  if (primed) return;
  primed = true;
  const local = loadLocal();
  if (local) {
    const cleaned = runAutoImportCleanup(local);
    useReminderStore.setState({
      items: cleaned.items,
      dismissed: cleaned.dismissed,
      hydrated: true,
    });
  } else {
    useReminderStore.setState({ hydrated: true });
  }
  if (remoteFetched) return;
  remoteFetched = true;
  fetch(`/api/memory?op=${encodeURIComponent(operatorId())}&kind=reminders`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { record?: { items?: ReminderItem[]; dismissed?: DismissedEntry[] } | null } | null) => {
      const record = data?.record;
      if (!record) return;
      // Remote may still hold legacy auto-imported items from older
      // clients. Filter them out at the boundary so they never enter
      // the local store.
      const items = (Array.isArray(record.items) ? record.items : []).filter(
        isLuminaOrUser,
      );
      const dismissed = Array.isArray(record.dismissed) ? record.dismissed : [];
      useReminderStore.getState().hydrateFromRemote({ items, dismissed });
    })
    .catch(() => {
      /* offline / no backend */
    });
}
