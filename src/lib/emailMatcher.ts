/**
 * Email → Work Order matcher.
 *
 * Mirrors the WO regex set used elsewhere in the app (LuminaPanel context
 * builder). Extracts WO-like tokens from any text and matches them to
 * Smartsheet jobs with confidence scores so the watcher can decide whether
 * to spawn a moon. A single email can match multiple WOs and therefore
 * attach as moons to multiple planets — this is correct, not a bug.
 */
import type { Job } from "@/types";

/** Patterns mirrored from LuminaPanel.tsx — single source of truth. */
const WO_PATTERNS: RegExp[] = [
  /\bP\.?\d{5,8}\b/gi,
  /\bWO[\s\-_]*\d{5,10}\b/gi,
  /\b\d{7,9}\b/g,
];

/** Lift a text blob into a deduped uppercase token set, stripped of separators. */
export function extractWOs(text: string): string[] {
  if (!text) return [];
  const tokens = new Set<string>();
  for (const re of WO_PATTERNS) {
    re.lastIndex = 0;
    const found = text.match(re);
    if (!found) continue;
    for (const m of found) tokens.add(normalizeToken(m));
  }
  return Array.from(tokens);
}

function normalizeToken(raw: string): string {
  return raw.replace(/[\s\-_.]/g, "").toUpperCase();
}

/** Shape consumed by matchEmailToJobs — same fields gmail-list returns. */
export interface GmailMessageMeta {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to?: string;
  cc?: string;
  date: string;
  snippet: string;
  unread: boolean;
  /** Optional full plain body — supplied by readThread when available. */
  plainBody?: string;
  internalDate?: string;
}

export interface JobMatch {
  jobId: string;
  workOrder: string;
  /** The WO token that matched (uppercased, separator-stripped). */
  wo: string;
  confidence: number;
}

/**
 *  Match one Gmail message against the universe.
 *  Confidence rules per the brief:
 *    - WO/P-prefix exact → 0.95
 *    - bare 7–9 digit number exactly matching an existing job WO → 0.8
 *    - partial / fuzzy → discard (< 0.7 is dropped, never returned)
 */
export function matchEmailToJobs(
  message: GmailMessageMeta,
  jobs: Job[],
): JobMatch[] {
  if (!message || jobs.length === 0) return [];

  const haystack = [
    message.subject ?? "",
    message.snippet ?? "",
    message.plainBody ?? "",
  ]
    .join("\n")
    .trim();
  if (!haystack) return [];

  // Pull every WO-like token from the haystack, AND remember whether each
  // token had an explicit prefix (WO / P) in the source — that's how we
  // assign the 0.95 vs 0.8 confidence later.
  const prefixed = new Set<string>();
  const all = new Set<string>();

  // Explicit prefix patterns
  const prefixedRe = [
    /\bP\.?\d{5,8}\b/gi,
    /\bWO[\s\-_]*\d{5,10}\b/gi,
  ];
  for (const re of prefixedRe) {
    re.lastIndex = 0;
    const found = haystack.match(re);
    if (!found) continue;
    for (const m of found) {
      const tok = normalizeToken(m);
      prefixed.add(tok);
      all.add(tok);
    }
  }
  // Bare digit run
  const bareRe = /\b\d{7,9}\b/g;
  bareRe.lastIndex = 0;
  const bare = haystack.match(bareRe);
  if (bare) for (const m of bare) all.add(normalizeToken(m));

  if (all.size === 0) return [];

  const matches: JobMatch[] = [];
  const seenJobIds = new Set<string>(); // dedupe per email — one moon per planet

  for (const job of jobs) {
    const jw = normalizeToken(job.workOrder ?? "");
    if (!jw) continue;
    for (const tok of all) {
      let confidence = 0;
      if (prefixed.has(tok)) {
        // Explicit WO/P prefix — high confidence on any reasonable match.
        if (jw === tok || jw === tok.replace(/^P/, "") || tok === jw.replace(/^P/, "")) {
          confidence = 0.95;
        } else if (tok.length >= 5 && jw.endsWith(tok)) {
          confidence = 0.9;
        }
      } else {
        // Bare digits — only count exact matches to an existing job WO.
        // Anything else is too noisy (phone numbers, zip codes, ids).
        if (jw === tok) {
          confidence = 0.8;
        }
      }
      if (confidence >= 0.7 && !seenJobIds.has(job.id)) {
        matches.push({
          jobId: job.id,
          workOrder: job.workOrder,
          wo: tok,
          confidence,
        });
        seenJobIds.add(job.id);
        break; // first matching token per job is enough
      }
    }
  }
  return matches;
}

/**
 *  Build a Moon object from a Gmail message — the shape Zustand's
 *  attachMoons action wants. Keeping this here so the watcher doesn't have
 *  to know about the type internals.
 */
export function messageToMoon(message: GmailMessageMeta): {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  unread: boolean;
} {
  return {
    id: message.id,
    threadId: message.threadId,
    subject: message.subject || "(no subject)",
    from: message.from,
    snippet: message.snippet ?? "",
    date: message.date,
    unread: Boolean(message.unread),
  };
}

/**
 *  Local seen-set for dedupe within a session. The watcher also persists a
 *  seen marker to Firestore (when memory remote sync is on) so reloads
 *  don't re-spawn moons. Exported for the watcher.
 */
export class SeenMessages {
  private set = new Set<string>();
  has(id: string): boolean {
    return this.set.has(id);
  }
  mark(id: string): void {
    this.set.add(id);
  }
  size(): number {
    return this.set.size;
  }
}
