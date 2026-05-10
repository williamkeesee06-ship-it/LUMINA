/**
 * Persistent memory for Lumina.
 *
 *  TL;DR: the AI assistant remembers across sessions. Three pieces:
 *    - facts[]: durable, structured memory entries the model commits via
 *      the `rememberFact` tool or auto-extraction heuristics. Each entry
 *      carries text + source ("auto" | "explicit" | "user") + timestamp,
 *      so the operator can see what she "knows" and where it came from.
 *    - history[]: rolling raw conversation, capped at MAX_HISTORY turns.
 *      The last few turns are replayed into the chat on reload.
 *    - summary: a short paragraph describing the running state of Billy's
 *      situation. Updated lazily.
 *    - settings: per-user tunables (retention window, auto-save, etc.)
 *
 *  Persistence: localStorage is the source of truth and the hot path
 *  (synchronous, survives reload/deploy on the same device). Optionally,
 *  if the server-side `/api/memory` endpoint is configured (Firestore
 *  REST under the hood), every write also fires-and-forgets a sync so
 *  memory follows the user across devices. Reads fall back to local
 *  cache instantly if the network is slow or unavailable.
 */
import { hydrateMemoryFromRemote, pushMemoryToRemote } from "./memorySync";

export type MemorySource = "auto" | "explicit" | "user";

export interface MemoryFact {
  id: string;
  text: string;
  source: MemorySource;
  ts: number;
}

export interface MemoryTurn {
  role: "user" | "model";
  text: string;
  ts: number;
}

export interface MemorySettings {
  /** Retention window in days. 0 = forever. Default 90. */
  retentionDays: number;
  /** Whether the model auto-extracts facts from conversation. */
  autoSave: boolean;
  /** Whether memory tries to sync to the remote store. */
  remoteSync: boolean;
}

export interface MemoryRecord {
  version: number;
  facts: MemoryFact[];
  summary: string;
  history: MemoryTurn[];
  settings: MemorySettings;
}

const KEY = "lumina:memory:v2";
const LEGACY_KEY = "lumina:memory:v1";
const MAX_HISTORY = 60;
const MAX_FACTS = 120;
const SCHEMA_VERSION = 2;

const DEFAULT_SETTINGS: MemorySettings = {
  retentionDays: 90,
  autoSave: true,
  remoteSync: true,
};

const emptyRecord = (): MemoryRecord => ({
  version: SCHEMA_VERSION,
  facts: [],
  summary: "",
  history: [],
  settings: { ...DEFAULT_SETTINGS },
});

// In-memory mirror — single source of truth at runtime. localStorage is the
// persistence layer; we read once at module init and keep this in sync on
// every write. This eliminates the JSON.parse storm we had on each render.
let inMemory: MemoryRecord = emptyRecord();
let hydrated = false;
const listeners = new Set<(rec: MemoryRecord) => void>();

function notify(): void {
  for (const fn of listeners) {
    try {
      fn(inMemory);
    } catch {
      /* listener crash should not break memory writes */
    }
  }
}

function safeLocalRead(): MemoryRecord | null {
  try {
    const raw =
      localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY) ?? null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MemoryRecord> & {
      facts?: unknown;
      history?: unknown;
    };
    return normalize(parsed);
  } catch {
    return null;
  }
}

function safeLocalWrite(rec: MemoryRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* quota or disabled — silent */
  }
}

function normalize(raw: Partial<MemoryRecord> & { facts?: unknown }): MemoryRecord {
  const out = emptyRecord();

  // facts can be old shape (string[]) or new shape (MemoryFact[])
  if (Array.isArray(raw.facts)) {
    for (const f of raw.facts as unknown[]) {
      if (typeof f === "string") {
        out.facts.push({
          id: cryptoRandomId(),
          text: f,
          source: "explicit",
          ts: Date.now(),
        });
      } else if (f && typeof f === "object" && "text" in f) {
        const obj = f as Partial<MemoryFact>;
        if (typeof obj.text === "string" && obj.text.trim()) {
          out.facts.push({
            id: typeof obj.id === "string" ? obj.id : cryptoRandomId(),
            text: obj.text,
            source:
              obj.source === "auto" || obj.source === "explicit" || obj.source === "user"
                ? obj.source
                : "explicit",
            ts: typeof obj.ts === "number" ? obj.ts : Date.now(),
          });
        }
      }
    }
  }

  if (typeof raw.summary === "string") out.summary = raw.summary;

  if (Array.isArray(raw.history)) {
    for (const h of raw.history as unknown[]) {
      if (h && typeof h === "object" && "text" in h && "role" in h) {
        const obj = h as Partial<MemoryTurn>;
        if (
          (obj.role === "user" || obj.role === "model") &&
          typeof obj.text === "string"
        ) {
          out.history.push({
            role: obj.role,
            text: obj.text,
            ts: typeof obj.ts === "number" ? obj.ts : Date.now(),
          });
        }
      }
    }
  }

  if (raw.settings && typeof raw.settings === "object") {
    const s = raw.settings as Partial<MemorySettings>;
    out.settings = {
      retentionDays:
        typeof s.retentionDays === "number" ? s.retentionDays : DEFAULT_SETTINGS.retentionDays,
      autoSave: typeof s.autoSave === "boolean" ? s.autoSave : DEFAULT_SETTINGS.autoSave,
      remoteSync:
        typeof s.remoteSync === "boolean" ? s.remoteSync : DEFAULT_SETTINGS.remoteSync,
    };
  }

  // Cap & trim
  out.facts = out.facts.slice(-MAX_FACTS);
  out.history = out.history.slice(-MAX_HISTORY);

  // Apply retention window — drop anything older than retentionDays.
  if (out.settings.retentionDays > 0) {
    const cutoff = Date.now() - out.settings.retentionDays * 86_400_000;
    out.facts = out.facts.filter((f) => f.ts >= cutoff);
    out.history = out.history.filter((h) => h.ts >= cutoff);
  }

  return out;
}

function cryptoRandomId(): string {
  // crypto.randomUUID isn't in older Safari; fall back to a timestamp+rand.
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* noop */
  }
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function persist(): void {
  safeLocalWrite(inMemory);
  notify();
  // Best-effort remote sync — never blocks the caller.
  if (inMemory.settings.remoteSync) {
    pushMemoryToRemote(inMemory).catch(() => {
      /* offline / 4xx — local is still authoritative */
    });
  }
}

/**
 *  Synchronous read of current in-memory state. Cheap; safe to call on
 *  every render.
 */
export function loadMemory(): MemoryRecord {
  if (!hydrated) {
    // Lazy hydrate from localStorage. Remote hydration happens via
    // hydrateMemory() called explicitly at app boot.
    const local = safeLocalRead();
    if (local) inMemory = local;
    hydrated = true;
  }
  return inMemory;
}

/**
 *  Subscribe to memory mutations. Returns an unsubscribe function. Used
 *  by the Memory Inspector to live-update without polling.
 */
export function subscribeMemory(fn: (rec: MemoryRecord) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 *  Explicit boot-time hydration. Reads localStorage first (instant), then
 *  attempts a remote merge. Resolves once both are reconciled. Safe to
 *  call multiple times; only the first call hits the network.
 */
let hydratePromise: Promise<MemoryRecord> | null = null;
export function hydrateMemory(): Promise<MemoryRecord> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    // Force-prime in-memory from local first.
    const local = safeLocalRead();
    if (local) inMemory = local;
    hydrated = true;
    notify();
    // Attempt remote pull — if it succeeds, merge facts (union by id/text).
    try {
      const remote = await hydrateMemoryFromRemote();
      if (remote) {
        inMemory = mergeRecords(inMemory, normalize(remote));
        safeLocalWrite(inMemory);
        notify();
      }
    } catch {
      /* no remote configured / offline — local stays authoritative */
    }
    return inMemory;
  })();
  return hydratePromise;
}

function mergeRecords(a: MemoryRecord, b: MemoryRecord): MemoryRecord {
  // Union facts by lowercased text (cheap dedupe), keeping the newest ts.
  const byKey = new Map<string, MemoryFact>();
  for (const f of [...a.facts, ...b.facts]) {
    const k = f.text.trim().toLowerCase();
    const prev = byKey.get(k);
    if (!prev || f.ts > prev.ts) byKey.set(k, f);
  }
  const facts = Array.from(byKey.values())
    .sort((x, y) => x.ts - y.ts)
    .slice(-MAX_FACTS);

  // History: take the longer one; prefer local (it's likely fresher).
  const history = a.history.length >= b.history.length ? a.history : b.history;

  // Settings: local wins (user-touched on this device).
  const settings = a.settings;

  return {
    version: SCHEMA_VERSION,
    facts,
    summary: a.summary || b.summary,
    history,
    settings,
  };
}

export function saveMemory(rec: MemoryRecord): void {
  inMemory = normalize(rec);
  persist();
}

export function addTurn(role: "user" | "model", text: string): MemoryRecord {
  loadMemory();
  inMemory.history.push({ role, text, ts: Date.now() });
  if (inMemory.history.length > MAX_HISTORY) {
    inMemory.history.splice(0, inMemory.history.length - MAX_HISTORY);
  }
  persist();
  return inMemory;
}

/**
 *  Commit a fact. Deduped by case-insensitive trimmed text — if the same
 *  string is already present, the existing entry's timestamp is refreshed
 *  but no duplicate is created. Returns the (possibly existing) fact id.
 */
export function rememberFact(
  text: string,
  source: MemorySource = "explicit",
): { rec: MemoryRecord; factId: string | null } {
  loadMemory();
  const cleaned = text.trim();
  if (!cleaned) return { rec: inMemory, factId: null };

  const key = cleaned.toLowerCase();
  const existing = inMemory.facts.find((f) => f.text.trim().toLowerCase() === key);
  if (existing) {
    existing.ts = Date.now();
    persist();
    return { rec: inMemory, factId: existing.id };
  }

  const fact: MemoryFact = {
    id: cryptoRandomId(),
    text: cleaned,
    source,
    ts: Date.now(),
  };
  inMemory.facts.push(fact);
  if (inMemory.facts.length > MAX_FACTS) {
    inMemory.facts.splice(0, inMemory.facts.length - MAX_FACTS);
  }
  persist();
  return { rec: inMemory, factId: fact.id };
}

export function updateFact(id: string, text: string): MemoryRecord {
  loadMemory();
  const f = inMemory.facts.find((x) => x.id === id);
  if (f && text.trim()) {
    f.text = text.trim();
    f.ts = Date.now();
    persist();
  }
  return inMemory;
}

export function forgetFactById(id: string): MemoryRecord {
  loadMemory();
  const idx = inMemory.facts.findIndex((f) => f.id === id);
  if (idx >= 0) {
    inMemory.facts.splice(idx, 1);
    persist();
  }
  return inMemory;
}

/** Back-compat alias used by the existing UI — forget by array index. */
export function forgetFact(index: number): MemoryRecord {
  loadMemory();
  if (index >= 0 && index < inMemory.facts.length) {
    inMemory.facts.splice(index, 1);
    persist();
  }
  return inMemory;
}

export function clearAllMemory(): MemoryRecord {
  // Preserve settings — "forget all" wipes facts/history/summary, not the
  // operator's preferences.
  const settings = inMemory.settings;
  inMemory = { ...emptyRecord(), settings };
  persist();
  return inMemory;
}

export function setSummary(summary: string): MemoryRecord {
  loadMemory();
  inMemory.summary = summary;
  persist();
  return inMemory;
}

export function updateSettings(patch: Partial<MemorySettings>): MemoryRecord {
  loadMemory();
  inMemory.settings = { ...inMemory.settings, ...patch };
  persist();
  return inMemory;
}

/* ------------------------------------------------------------------ */
/*  Auto-save heuristics                                                */
/* ------------------------------------------------------------------ */

/**
 *  Lightweight pattern-based extractor that turns operator utterances and
 *  Lumina's tactical replies into durable facts without a model round-trip.
 *  Conservative on purpose — false positives pollute memory faster than
 *  missing a few signals hurts. The model can still emit `rememberFact`
 *  explicitly via tool call for anything subtle.
 *
 *  Triggers:
 *    - "remember that ___", "note that ___", "for the record ___"
 *    - "waiting on ___ for WO ___"
 *    - "WO ___ is on hold / pending / scheduled for ___"
 *    - explicit commitments: "I told ___ I'd ___"
 *
 *  Returns the saved fact ids (empty if no signal).
 */
export function maybeAutoRemember(role: "user" | "model", text: string): string[] {
  loadMemory();
  if (!inMemory.settings.autoSave) return [];
  if (!text || text.length < 8) return [];
  const trimmed = text.trim();

  const candidates: string[] = [];
  const push = (s: string) => {
    const clean = s.trim().replace(/^[,.;:\s-]+|[,.;:\s-]+$/g, "");
    if (clean.length >= 6 && clean.length <= 240) candidates.push(clean);
  };

  // Explicit "remember ___" patterns (operator side mostly)
  const explicit = [
    /\b(?:remember|note|for the record|don'?t forget)(?: that)?\s+(.{6,200}?)(?:\.|$)/i,
    /\bmake (?:a )?note(?: that)?\s+(.{6,200}?)(?:\.|$)/i,
  ];
  for (const re of explicit) {
    const m = trimmed.match(re);
    if (m && m[1]) push(m[1]);
  }

  // Commitment / waiting patterns (both roles)
  const commitments = [
    /\bwaiting on\s+(.{6,160}?)(?:\.|$)/i,
    /\bneed(?:s)? to\s+(.{6,160}?)(?:\.|$)/i,
    /\b(?:WO\s*\d{5,10}|P?\d{6,9})\s+is\s+(?:on hold|pending|scheduled|in review|complete)(?:\s+(?:for|until|by)\s+.{3,120})?/i,
    /\b(?:I|we|crew)\s+told\s+(.{4,160}?)(?:\.|$)/i,
    /\bapproved\s+(?:by|for)\s+(.{4,160}?)(?:\.|$)/i,
  ];
  for (const re of commitments) {
    const m = trimmed.match(re);
    if (m) push(m[0]); // store the whole phrase so context is preserved
  }

  // Dedupe candidates locally before committing
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const c of candidates) {
    const k = c.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    const tagged = role === "user" ? c : `Lumina noted: ${c}`;
    const { factId } = rememberFact(tagged, "auto");
    if (factId) ids.push(factId);
  }
  return ids;
}

/* ------------------------------------------------------------------ */
/*  Helpers for the prompt block                                       */
/* ------------------------------------------------------------------ */

/** Plain string[] of facts for the wire payload to the model. */
export function getFactsAsStrings(): string[] {
  loadMemory();
  return inMemory.facts.map((f) => f.text);
}

export function getMemoryForPrompt(): { facts: string[]; summary: string } {
  const rec = loadMemory();
  return { facts: rec.facts.map((f) => f.text), summary: rec.summary };
}
