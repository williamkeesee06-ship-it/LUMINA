/**
 *  Situational-awareness checks — DISABLED IN PR #12.
 *
 *  The operator does not want anything auto-imported into the notification
 *  center. Only Lumina tool calls and direct UI actions are allowed to add
 *  reminders now. See src/store/reminderStore.ts (the `addReminder` source
 *  guard is the actual choke point).
 *
 *  The compute step is still exported so a future opt-in UI surface could
 *  show suggestions WITHOUT writing into the reminder store. `runSituational
 *  Checks` is now off by default and only fires if
 *  `VITE_ENABLE_SITUATIONAL_AUTOIMPORT=1` is set at build time. It is wired
 *  to nothing from App.tsx — the App-level interval and onJobsChange hook
 *  were removed in PR #12.
 */
import type { Job } from "@/types";

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

function hasUnansweredCustomerMail(j: Job): boolean {
  const moons = j.moons ?? [];
  if (moons.length === 0) return false;
  const sorted = [...moons].sort((a, b) => (b.date > a.date ? 1 : -1));
  const newest = sorted[0];
  if (!newest) return false;
  const from = (newest.from ?? "").toLowerCase();
  if (from.includes(NSC_DOMAIN)) return false;
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
    if ((!j.permitNumber || !j.permitNumber.trim()) && inDays(j.scheduleDate, 14)) {
      out.push({
        text: `${j.workOrder} scheduled but no permit logged — chase status?`,
        jobId: j.id,
        dedupeKey: `sa:permit:${j.id}`,
      });
    }
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
 *  No-op unless explicitly opted in. Returns 0 in the default config so
 *  callers (none, in PR #12) treat it as "nothing surfaced".
 */
export function runSituationalChecks(_jobs: Job[]): number {
  // Off-by-default feature flag. Build-time env, NOT runtime config — we
  // want this dead in production unless a developer deliberately turns it
  // on for testing a future opt-in surface.
  const enabled =
    typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
      ?.VITE_ENABLE_SITUATIONAL_AUTOIMPORT === "1";
  if (!enabled) return 0;
  // Even when the flag is on, we no longer write to the reminder store
  // from this module — that path was the whole problem. Any future
  // re-enablement must route through an explicit user-confirmed UI
  // surface that calls addReminder({ source: "user" }).
  return 0;
}
