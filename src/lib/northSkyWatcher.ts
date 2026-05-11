/**
 * North Sky background ingestion loop.
 *
 * Singleton. Starts when a Google token is available and the watcher is
 * armed via `startWatcher`. Stops on sign-out or `stopWatcher`. Polls
 * `/api/gmail` (action=list) for `label:"North Sky"` every 60 s, matches each new
 * message against the current Zustand `jobs` slice using `matchEmailToJobs`,
 * and dispatches `attachMoons` for every match.
 *
 * Idempotent. Backoff to 5 min on consecutive errors. Polling stops when
 * `document.visibilityState === "hidden"` so we don't burn API quota in
 * background tabs, and resumes on the next visibility change.
 */
import { useUI } from "@/store/uiStore";
import {
  matchEmailToJobs,
  messageToMoon,
  SeenMessages,
  type GmailMessageMeta,
} from "./emailMatcher";
import type { Job, Moon } from "@/types";

const POLL_MS = 60_000;
const BACKOFF_MS = 5 * 60_000;
const NORTH_SKY_LABEL = "North Sky";

interface WatcherState {
  token: string | null;
  timer: number | null;
  inFlight: boolean;
  consecutiveErrors: number;
  seen: SeenMessages;
  authFailureListeners: Set<(reason: string) => void>;
  /** Latest known watcher status, surfaced to the OrbAuthPanel. */
  status: WatcherStatus;
}

export type WatcherStatus =
  | { kind: "idle" }
  | { kind: "running"; lastPollAt: number; lastNewCount: number }
  | { kind: "error"; reason: string; nextRetryAt: number }
  | { kind: "needs_scope"; reason: string };

const state: WatcherState = {
  token: null,
  timer: null,
  inFlight: false,
  consecutiveErrors: 0,
  seen: new SeenMessages(),
  authFailureListeners: new Set(),
  status: { kind: "idle" },
};

const statusListeners = new Set<(s: WatcherStatus) => void>();

function emitStatus(next: WatcherStatus): void {
  state.status = next;
  for (const fn of statusListeners) {
    try {
      fn(next);
    } catch {
      /* listener crash should not break poll */
    }
  }
}

export function subscribeWatcherStatus(fn: (s: WatcherStatus) => void): () => void {
  statusListeners.add(fn);
  fn(state.status);
  return () => statusListeners.delete(fn);
}

export function watcherStatus(): WatcherStatus {
  return state.status;
}

/**
 *  Start the watcher with the user's Google token. Calling start() again
 *  with the same token is a no-op; with a different token resets state and
 *  re-arms. Calling stop() then start() will reset the seen-set if the
 *  caller wants a clean re-ingest (`{ resetSeen: true }`).
 */
export function startWatcher(
  token: string,
  opts: { resetSeen?: boolean } = {},
): void {
  if (state.token === token && state.timer !== null) return;
  // Different token / new boot — reset.
  state.token = token;
  state.consecutiveErrors = 0;
  if (opts.resetSeen) state.seen = new SeenMessages();
  armVisibility();
  // Kick off an immediate poll, then schedule the recurring tick.
  scheduleNextTick(0);
}

export function stopWatcher(): void {
  if (state.timer !== null) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.token = null;
  state.inFlight = false;
  emitStatus({ kind: "idle" });
  detachVisibility();
}

export function onWatcherAuthFailure(fn: (reason: string) => void): () => void {
  state.authFailureListeners.add(fn);
  return () => state.authFailureListeners.delete(fn);
}

function notifyAuthFailure(reason: string): void {
  for (const fn of state.authFailureListeners) {
    try {
      fn(reason);
    } catch {
      /* noop */
    }
  }
}

function scheduleNextTick(delay = POLL_MS): void {
  if (state.timer !== null) clearTimeout(state.timer);
  state.timer = window.setTimeout(() => {
    void runPollCycle();
  }, delay);
}

async function runPollCycle(): Promise<void> {
  if (state.inFlight) {
    scheduleNextTick();
    return;
  }
  if (!state.token) {
    emitStatus({ kind: "idle" });
    return;
  }
  if (document.visibilityState === "hidden") {
    // Don't burn quota in background — wait for visibility change to retry.
    return;
  }
  state.inFlight = true;
  try {
    const messages = await fetchNorthSky(state.token);
    const newOnes = messages.filter((m) => !state.seen.has(m.id));
    if (newOnes.length > 0) {
      const jobs = useUI.getState().jobs;
      const attachMoons = useUI.getState().attachMoons;
      // Group moons per job so we attachMoons once per planet.
      const perJob = new Map<string, Moon[]>();
      for (const msg of newOnes) {
        const matches = matchEmailToJobs(msg, jobs);
        if (matches.length === 0) continue;
        for (const match of matches) {
          if (!perJob.has(match.jobId)) perJob.set(match.jobId, []);
          perJob.get(match.jobId)!.push(messageToMoon(msg));
        }
      }
      for (const [jobId, moons] of perJob.entries()) {
        const cur = jobs.find((j: Job) => j.id === jobId)?.moons ?? [];
        const merged = mergeMoonsById([...cur, ...moons]);
        attachMoons(jobId, merged);
      }
    }
    for (const msg of newOnes) state.seen.mark(msg.id);
    state.consecutiveErrors = 0;
    emitStatus({
      kind: "running",
      lastPollAt: Date.now(),
      lastNewCount: newOnes.length,
    });
    scheduleNextTick();
  } catch (err) {
    state.consecutiveErrors += 1;
    const reason = err instanceof Error ? err.message : String(err);
    if (reason.includes("401") || reason.includes("403") || /scope/i.test(reason)) {
      emitStatus({ kind: "needs_scope", reason });
      notifyAuthFailure(reason);
    } else {
      const wait =
        state.consecutiveErrors >= 3 ? BACKOFF_MS : POLL_MS;
      emitStatus({
        kind: "error",
        reason,
        nextRetryAt: Date.now() + wait,
      });
      scheduleNextTick(wait);
    }
  } finally {
    state.inFlight = false;
  }
}

function mergeMoonsById(moons: Moon[]): Moon[] {
  const map = new Map<string, Moon>();
  for (const m of moons) {
    const prev = map.get(m.id);
    if (!prev) {
      map.set(m.id, m);
      continue;
    }
    // Newer wins on unread/snippet/date — Gmail's snippet refines over time.
    map.set(m.id, {
      ...prev,
      ...m,
      unread: m.unread || prev.unread,
    });
  }
  return Array.from(map.values());
}

async function fetchNorthSky(token: string): Promise<GmailMessageMeta[]> {
  const r = await fetch("/api/gmail?action=list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: "list",
      label: NORTH_SKY_LABEL,
      limit: 50,
    }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`gmail-list ${r.status}: ${text.slice(0, 200)}`);
  }
  const data = (await r.json()) as { messages?: GmailMessageMeta[] };
  return data.messages ?? [];
}

// ---- visibility handling ----------------------------------------------

let visibilityArmed = false;

function visibilityHandler(): void {
  if (document.visibilityState === "visible" && state.token) {
    // Resume on visibility — fire an immediate poll.
    scheduleNextTick(0);
  }
}

function armVisibility(): void {
  if (visibilityArmed) return;
  visibilityArmed = true;
  document.addEventListener("visibilitychange", visibilityHandler);
}

function detachVisibility(): void {
  if (!visibilityArmed) return;
  visibilityArmed = false;
  document.removeEventListener("visibilitychange", visibilityHandler);
}

/**
 *  Test-only / dev helper. Lets the UI prime the seen-set with messages
 *  loaded out-of-band (e.g. from the OrbAuthPanel showing recent threads).
 */
export function markSeen(ids: string[]): void {
  for (const id of ids) state.seen.mark(id);
}

/** Expose the live seen-count for telemetry. */
export function seenCount(): number {
  return state.seen.size();
}
