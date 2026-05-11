/**
 *  Situational-awareness checks (PR #6).
 *
 *  Lumina watches the live job + email state and surfaces SUGGESTIONS on
 *  the reminder strip when she notices a gap. Suggest only — she does not
 *  auto-draft replies or take action. Clicking a suggestion (handled by
 *  the strip) opens the chat pre-prompted so Billy can decide what to do.
 *
 *  Throttle: each suggestion carries a deterministic `dedupeKey`. The
 *  reminder store tombstones a key for 24h once dismissed (see
 *  reminderStore.ts), so a check won't re-surface the same suggestion
 *  within that window.
 *
 *  Checks:
 *    1. Crew assigned + schedule date set + no "traffic control" mention
 *       in notes/checklist → "Need to order traffic control for ___?"
 *    2. Permit field empty + schedule date within 14 days →
 *       "___ scheduled but no permit logged — chase status?"
 *    3. Customer email thread waiting > 24h for a reply →
 *       "Customer waiting on reply for ___ — draft response?"
 */
import type { Job } from "@/types";
import { useReminderStore } from "@/store/reminderStore";

const NSC_DOMAIN = "@northskycomm.com";

function inDays(dateStr: string | undefined, withinDays: number): boolean {
  if (!dateStr) return false;
  const d = parseDate(dateStr);
  if (!d) return false;
  const ms = d.getTime() - Date.now();
  return ms >= 0 && ms <= withinDays * 86_400_000;
}

function parseDate(s: string): Date | null {
  // Accepts MM/DD/YY, MM/DD/YYYY, or YYYY-MM-DD.
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m1) {
    let yr = parseInt(m1[3], 10);
    if (yr < 100) yr += 2000;
    return new Date(yr, parseInt(m1[1], 10) - 1, parseInt(m1[2], 10));
  }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return new Date(parseInt(m2[1], 10), parseInt(m2[2], 10) - 1, parseInt(m2[3], 10));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function mentionsTrafficControl(j: Job): boolean {
  const haystack = [j.notes, j.splicingNotes].filter(Boolean).join(" ").toLowerCase();
  if (/\btraffic\s*control\b|\btc\s*order\b|\btraffic-control\b/.test(haystack)) return true;
  if (j.checklist?.trafficControl) return true;
  if (j.checklistText?.trafficControl?.trim()) return true;
  // Also count moons whose subject mentions it.
  for (const m of j.moons ?? []) {
    if (/\btraffic\s*control\b/i.test((m.subject ?? "") + " " + (m.snippet ?? ""))) return true;
  }
  return false;
}

function hasUnansweredCustomerMail(j: Job): boolean {
  const moons = j.moons ?? [];
  if (moons.length === 0) return false;
  // Newest moon first.
  const sorted = [...moons].sort((a, b) => (b.date > a.date ? 1 : -1));
  const newest = sorted[0];
  if (!newest) return false;
  // Skip if newest is from Billy's domain (i.e. we already responded).
  const from = (newest.from ?? "").toLowerCase();
  if (from.includes(NSC_DOMAIN)) return false;
  // Heuristic: a "?" in subject or snippet signals a question.
  const askish = /\?|when|status|update|confirm|need(ed)?\b/i.test(
    (newest.subject ?? "") + " " + (newest.snippet ?? ""),
  );
  if (!askish) return false;
  const d = parseDate(newest.date);
  if (!d) return false;
  return Date.now() - d.getTime() > 24 * 60 * 60 * 1000;
}

export interface SituationalSuggestion {
  text: string;
  jobId: string;
  dedupeKey: string;
}

export function computeSituationalSuggestions(jobs: Job[]): SituationalSuggestion[] {
  const out: SituationalSuggestion[] = [];
  for (const j of jobs) {
    if (!j.workOrder) continue;
    // 1. Crew + schedule + no traffic-control signal
    if (j.crew && j.crew.trim() && j.scheduleDate && !mentionsTrafficControl(j)) {
      out.push({
        text: `Need to order traffic control for ${j.workOrder}? Crew is scheduled but no TC order detected.`,
        jobId: j.id,
        dedupeKey: `sa:tc:${j.id}`,
      });
    }
    // 2. Empty permit + scheduled within 14 days
    if ((!j.permitNumber || !j.permitNumber.trim()) && inDays(j.scheduleDate, 14)) {
      out.push({
        text: `${j.workOrder} scheduled but no permit logged — chase status?`,
        jobId: j.id,
        dedupeKey: `sa:permit:${j.id}`,
      });
    }
    // 3. Unanswered customer email > 24h
    if (hasUnansweredCustomerMail(j)) {
      out.push({
        text: `Customer waiting on reply for ${j.workOrder} — draft response?`,
        jobId: j.id,
        dedupeKey: `sa:reply:${j.id}`,
      });
    }
  }
  return out;
}

/**
 *  Run the checks against the current job state and push any new
 *  suggestions to the reminder strip. Returns the count surfaced (for
 *  debugging / telemetry).
 */
export function runSituationalChecks(jobs: Job[]): number {
  const suggestions = computeSituationalSuggestions(jobs);
  const store = useReminderStore.getState();
  let added = 0;
  for (const s of suggestions) {
    const r = store.addSuggestion({
      text: s.text,
      sourceJobId: s.jobId,
      dedupeKey: s.dedupeKey,
    });
    if (r) added += 1;
  }
  return added;
}
