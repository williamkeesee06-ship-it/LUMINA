/**
 * Persistent memory for Lumina.
 *
 * Stored in localStorage so it survives page reloads. Two layers:
 *  - facts[]: durable bullet points Lumina committed to memory via the
 *    rememberFact tool call ("waiting on email approval for WO 23017359").
 *  - history[]: rolling raw conversation, capped at MAX_HISTORY turns. The
 *    last N turns are sent verbatim to Gemini; older turns are summarized
 *    locally by Lumina via a follow-up call (best-effort).
 *  - summary: a short paragraph describing the running state of Billy's
 *    ongoing situation. Updated lazily.
 */

const KEY = "lumina:memory:v1";
const MAX_HISTORY = 40;
const MAX_FACTS = 60;

export interface MemoryRecord {
  facts: string[];
  summary: string;
  history: { role: "user" | "model"; text: string; ts: number }[];
}

const empty: MemoryRecord = { facts: [], summary: "", history: [] };

export function loadMemory(): MemoryRecord {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...empty };
    const parsed = JSON.parse(raw) as Partial<MemoryRecord>;
    return {
      facts: Array.isArray(parsed.facts) ? parsed.facts.slice(0, MAX_FACTS) : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      history: Array.isArray(parsed.history)
        ? parsed.history.slice(-MAX_HISTORY)
        : [],
    };
  } catch {
    return { ...empty };
  }
}

export function saveMemory(rec: MemoryRecord): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        facts: rec.facts.slice(0, MAX_FACTS),
        summary: rec.summary,
        history: rec.history.slice(-MAX_HISTORY),
      }),
    );
  } catch {
    /* quota or disabled — silent */
  }
}

export function addTurn(role: "user" | "model", text: string): MemoryRecord {
  const rec = loadMemory();
  rec.history.push({ role, text, ts: Date.now() });
  if (rec.history.length > MAX_HISTORY) {
    rec.history.splice(0, rec.history.length - MAX_HISTORY);
  }
  saveMemory(rec);
  return rec;
}

export function rememberFact(fact: string): MemoryRecord {
  const rec = loadMemory();
  const cleaned = fact.trim();
  if (!cleaned) return rec;
  // De-dupe (case-insensitive)
  if (!rec.facts.some((f) => f.toLowerCase() === cleaned.toLowerCase())) {
    rec.facts.push(cleaned);
  }
  if (rec.facts.length > MAX_FACTS) {
    rec.facts.splice(0, rec.facts.length - MAX_FACTS);
  }
  saveMemory(rec);
  return rec;
}

export function forgetFact(index: number): MemoryRecord {
  const rec = loadMemory();
  if (index >= 0 && index < rec.facts.length) {
    rec.facts.splice(index, 1);
    saveMemory(rec);
  }
  return rec;
}

export function clearAllMemory(): MemoryRecord {
  saveMemory({ ...empty });
  return { ...empty };
}

export function setSummary(summary: string): MemoryRecord {
  const rec = loadMemory();
  rec.summary = summary;
  saveMemory(rec);
  return rec;
}
