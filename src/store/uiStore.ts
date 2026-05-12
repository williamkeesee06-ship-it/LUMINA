import { create } from "zustand";
import { sfx } from "@/lib/audio";
import { mapStatusToGalaxy } from "@/lib/statusMap";
import { updateJobFields, type EditableJobField } from "@/lib/api";
import type {
  DrawingMode,
  Galaxy,
  HudMode,
  HudOrientation,
  HudPage,
  Job,
  JobChecklist,
  MapAnnotation,
  MapTransition,
  Moon,
  OrbMode,
  Satellite,
  ViewMode,
} from "@/types";
import { fetchAnnotations, saveAnnotations as _saveAnnotations } from "@/lib/mapAnnotations";

/**
 *  The subset of `Job` fields the operator can edit through the UI.
 *  Mirrors `EditableJobField` keys in src/lib/api.ts (kept tight on purpose
 *  — receivedDate is read-only because the user said so).
 */
export type JobFieldPatch = Partial<Pick<Job,
  | "notes"
  | "splicingNotes"
  | "rawSecondaryStatus"
  | "jobStatus"
  | "address"
  | "city"
  | "zip"
  | "scheduleDate"
  | "endDate"
  | "dueDate"
  | "crew"
  | "permitNumber"
  | "workType"
  | "base"
  | "bidValue"
>>;

/**
 * Canonical UI store. All state lives here per bible's State Model doctrine.
 * Field names match the bible exactly:
 *   jobs, loading, error, googleToken, unreadCount, driveFiles,
 *   selectedJobId, selectedJobNumber, viewMode, focusedGalaxy,
 *   activeStatus, latchedStatus, isChatOpen, voiceEnabled, isDictating,
 *   isFullVoice, orbMode, showRouteLayer, plus V3-mandated `hudMode`.
 */
export interface UIState {
  // Data
  jobs: Job[];
  loading: boolean;
  error: string | null;

  // Google integration
  googleToken: string | null;
  unreadCount: number;
  driveFiles: Moon[];
  /**
   * Overwatch flag — set true by northSkyWatcher when new North Sky mail
   * arrives. Drives orbMode "alert" until the operator opens chat.
   */
  overwatchAlert: boolean;

  // Selection / focus
  selectedJobId: string | null;
  selectedJobNumber: string | null;
  viewMode: ViewMode;
  focusedGalaxy: Galaxy | null;
  activeStatus: Galaxy | null;
  latchedStatus: Galaxy | null;

  // LUMINA / chat
  isChatOpen: boolean;
  voiceEnabled: boolean;
  isDictating: boolean;
  isFullVoice: boolean;
  orbMode: OrbMode;

  // Map / route
  showRouteLayer: boolean;
  routeJobIds: string[];

  // V3 HUD (canonical addition)
  hudMode: HudMode;
  hudOrientation: HudOrientation;
  /**
   * HUD pager. The HUD now flips between two pages:
   *   - "navigation" — galaxy shortcut widgets (default; action-oriented)
   *   - "telemetry"  — system gauges + Gmail counter (passive monitoring)
   * A two-dot indicator at the top of the HUD swaps pages.
   */
  hudPage: HudPage;

  // Map open state (tactical map is a surface, not the home)
  isMapOpen: boolean;

  /**
   *  Email moon viewer state. When `openThreadId` is set, the
   *  EmailThreadView panel slides in over the cockpit and the camera
   *  focuses on the parent planet. Cleared by the panel's close button or
   *  any selectJob/enterGalaxy transition that takes the user elsewhere.
   *  `openThreadJobId` is the planet the moon belongs to so the panel can
   *  surface the WO and the parent satellites.
   */
  openThreadId: string | null;
  openThreadJobId: string | null;

  /**
   *  Cached per-thread auto-summaries (in-memory only — Lumina's durable
   *  memory persists the same summary via rememberFact in luminaMemory).
   *  Lets us avoid re-summarizing a thread the operator just opened.
   */
  threadSummaries: Record<string, string>;

  /**
   *  Account state surfaced by the Orb Auth Panel — email + picture + the
   *  scope set Google actually granted. Filled in after sign-in / re-auth.
   *  Independent of `googleToken` so an expired token can keep the panel
   *  showing the right user while the OAuth flow reruns.
   */
  googleAccount: { email: string; name?: string; picture?: string } | null;
  googleGrantedScopes: string[];

  /**
   *  Job Focus Mode — fullscreen 50/50 overlay locked to a single job.
   *  When set, the universe and tactical map step aside and the operator
   *  works on this one work order with every Smartsheet field editable
   *  on the left and an isolated map (with optional Street View) on the
   *  right.
   */
  focusedJobId: string | null;

  /**
   *  Job Focus Mode split ratio. Default (false) = 70/30 card/email — the
   *  job card dominates with a sliver of email. Toggled true = 50/50 split.
   *  PR #10: matches the operator brief — "card + sliver of email default;
   *  focus mode 50/50". Tools `enterFocusMode()` / `exitFocusMode()` flip
   *  this directly from Lumina.
   */
  focusFiftyFifty: boolean;

  // Map-only filters — toggled via the HUD galaxy widgets while the map is
  // open. Galaxies in `hiddenGalaxies` are excluded from the map only
  // (universe view is unaffected). `showHistoryOnMap` controls whether
  // Complete jobs (the black history markers) appear; OFF by default for
  // focus.
  hiddenGalaxies: Galaxy[];
  showHistoryOnMap: boolean;

  // Hyperspace dive state machine — drives the warp transition
  // between the universe and the tactical map.
  mapTransition: MapTransition;

  /**
   *  Recent-changes feed (PR #6). When a job enters the universe for the
   *  first time, moves to a different galaxy, or otherwise signals a
   *  "something changed" event, an entry lands here. The HUD nav widgets
   *  read this slice to render a pulsating ring while the change is fresh.
   *  Entries auto-expire after `RECENT_TTL_MS` (5 min) or clear when the
   *  matching widget is clicked.
   */
  recentChanges: { type: "new_job" | "galaxy_move"; jobId: string; galaxy: Galaxy; ts: number }[];

  /** Note a job entered the universe or moved galaxies. Drives the pulsating
   *  ring on the corresponding nav widget. */
  noteRecentChange: (entry: { type: "new_job" | "galaxy_move"; jobId: string; galaxy: Galaxy }) => void;
  /** Clear pulse for a specific galaxy (called on widget click or TTL sweep). */
  clearRecentChangesForGalaxy: (galaxy: Galaxy) => void;
  /** Drop entries older than `RECENT_TTL_MS`. Called by the watcher and on widget render. */
  sweepRecentChanges: () => void;

  // Actions
  setJobs: (jobs: Job[]) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setGoogleToken: (t: string | null) => void;
  setUnreadCount: (n: number) => void;
  /** Clear the Overwatch alert flag (called when operator opens chat). */
  setOverwatchAlert: (v: boolean) => void;
  setDriveFiles: (f: Moon[]) => void;
  selectJob: (jobId: string | null) => void;
  enterGalaxy: (galaxy: Galaxy | null) => void;
  resetToUniverse: () => void;
  setHudMode: (m: HudMode) => void;
  toggleHud: () => void;
  setHudOrientation: (o: HudOrientation) => void;
  toggleHudOrientation: () => void;
  setHudPage: (p: HudPage) => void;
  toggleHudPage: () => void;
  setChatOpen: (open: boolean) => void;
  setOrbMode: (m: OrbMode) => void;
  setShowRouteLayer: (v: boolean) => void;
  setRouteJobIds: (ids: string[]) => void;
  setMapOpen: (open: boolean) => void;

  // ── Map Annotations (drawing tools) ──────────────────────────────────────
  /** All loaded annotations for the currently-open job map. Keyed by jobId. */
  annotationsByJob: Record<string, MapAnnotation[]>;
  /** Active drawing mode — controls cursor + which overlay is being placed. */
  drawingMode: DrawingMode;
  /** The annotation currently open in the edit popup (null = popup closed). */
  activeAnnotationId: string | null;
  /** Load annotations from Firestore for a job (no-op if already loaded). */
  loadAnnotations: (jobId: string) => Promise<void>;
  /** Add a new annotation and persist. */
  addAnnotation: (annotation: MapAnnotation) => void;
  /** Patch an existing annotation by id and persist. */
  updateAnnotation: (jobId: string, id: string, patch: Partial<MapAnnotation>) => void;
  /** Remove an annotation and persist. */
  deleteAnnotation: (jobId: string, id: string) => void;
  setDrawingMode: (mode: DrawingMode) => void;
  setActiveAnnotationId: (id: string | null) => void;
  toggleMapFilter: (g: Galaxy) => void;
  toggleHistoryOnMap: () => void;
  resetMapFilters: () => void;
  /** Trigger the hyperspace warp into the tactical map. */
  diveToMap: () => void;
  /** Trigger the reverse warp back to the universe. */
  riseFromMap: () => void;
  // Drive documents (satellites) come with the parent Drive folderId
  attachSatellites: (jobId: string, sats: Satellite[], folderId?: string | null) => void;
  // Gmail email threads (moons) — no folder concept
  attachMoons: (jobId: string, moons: Moon[]) => void;
  /** Open the in-cockpit EmailThreadView for a specific thread. Resolves the
   *  parent planet (job) automatically by searching every job's moons. */
  openThread: (threadId: string, jobId?: string | null) => void;
  closeThread: () => void;
  /** Mark a moon read locally — used after the user opens or replies in the
   *  in-cockpit thread viewer so the pulsing glow turns matte without a
   *  second Gmail fetch. */
  markMoonRead: (threadId: string) => void;
  /** Cache a per-thread summary in-memory (separate from durable Lumina
   *  memory persistence). */
  setThreadSummary: (threadId: string, summary: string) => void;
  /** Set / clear the signed-in Google account profile. */
  setGoogleAccount: (
    account: { email: string; name?: string; picture?: string } | null,
  ) => void;
  setGoogleGrantedScopes: (scopes: string[]) => void;
  toggleChecklistItem: (jobId: string, key: keyof JobChecklist) => void;
  setChecklistText: (jobId: string, key: keyof JobChecklist, value: string) => void;
  /** Local update to a job's NSC Project Notes — persistence to Smartsheet
   *  is handled by the JobPanel save action via updateJobNotes(). */
  setJobNotes: (jobId: string, notes: string) => void;
  /** Local update to a job's Secondary Job Status. Also recomputes the
   *  derived galaxy (`status`) so the planet jumps to the correct galaxy
   *  immediately. Persistence to Smartsheet is handled by the JobPanel
   *  via updateJobSecondaryStatus(). */
  setJobSecondaryStatus: (jobId: string, secondaryStatus: string) => void;
  /** Insert a new satellite (uploaded attachment) at the head of the
   *  job's satellite list — newest-first ordering. */
  addSatellite: (jobId: string, sat: Satellite) => void;
  /** Remove a satellite by id (after Smartsheet delete). */
  removeSatellite: (jobId: string, satelliteId: string) => void;

  /** Enter Job Focus Mode for the given job (or exit if null). */
  enterFocus: (jobId: string) => void;
  exitFocus: () => void;
  /** Flip the focus-mode split ratio. true = 50/50, false = 70/30 default. */
  setFocusFiftyFifty: (v: boolean) => void;
  /**
   *  Optimistically patch one or more fields on a job and persist to
   *  Smartsheet. Returns ok/false; on failure the local state is rolled
   *  back so the UI never lies about what's saved.
   *
   *  Date fields should be passed in YYYY-MM-DD wire format (helpers in
   *  src/lib/api.ts convert from MM/DD/YY display).
   */
  setJobFields: (
    jobId: string,
    patch: JobFieldPatch,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
}

/** Recent-changes TTL: pulse drops automatically 5 minutes after the
 *  triggering event. Same constant referenced by the HUD selector. */
export const RECENT_TTL_MS = 5 * 60 * 1000;

function pruneRecent<T extends { ts: number }>(items: T[]): T[] {
  const cutoff = Date.now() - RECENT_TTL_MS;
  return items.filter((i) => i.ts >= cutoff);
}

export const useUI = create<UIState>((set, get) => ({
  jobs: [],
  loading: false,
  error: null,

  googleToken: null,
  unreadCount: 0,
  driveFiles: [],

  selectedJobId: null,
  selectedJobNumber: null,
  viewMode: "universe",
  focusedGalaxy: null,
  activeStatus: null,
  latchedStatus: null,

  isChatOpen: false,
  voiceEnabled: false,
  isDictating: false,
  isFullVoice: false,
  orbMode: "idle",

  showRouteLayer: false,
  routeJobIds: [],

  // Annotation drawing tool state
  annotationsByJob: {},
  drawingMode: "cursor",
  activeAnnotationId: null,

  hudMode: "expanded",
  hudOrientation: "vertical",
  // Default to navigation page — action-oriented; users open the app to do something.
  hudPage: "navigation",
  isMapOpen: false,
  mapTransition: "idle",
  // History (Complete) starts hidden so the map opens focused on active work.
  // Complete is also added to hiddenGalaxies so the toggleMapFilter logic
  // stays consistent (one source of truth for whether a galaxy renders).
  hiddenGalaxies: ["Complete"],
  showHistoryOnMap: false,

  focusedJobId: null,
  focusFiftyFifty: false,
  recentChanges: [],
  openThreadId: null,
  openThreadJobId: null,
  threadSummaries: {},
  googleAccount: null,
  googleGrantedScopes: [],
  overwatchAlert: false,

  setJobs: (jobs) => {
    // Diff against the previous job set to detect new arrivals and
    // galaxy moves. Both surface as recent-changes entries so the HUD
    // nav widgets can pulse.
    const prev = get().jobs;
    const prevById = new Map(prev.map((j) => [j.id, j] as const));
    const diffs: { type: "new_job" | "galaxy_move"; jobId: string; galaxy: Galaxy; ts: number }[] = [];
    const now = Date.now();
    for (const j of jobs) {
      const p = prevById.get(j.id);
      if (!p) {
        // First sync after boot floods this — skip recent-change noise
        // when the prior list was empty.
        if (prev.length > 0) {
          diffs.push({ type: "new_job", jobId: j.id, galaxy: j.status, ts: now });
        }
      } else if (p.status !== j.status) {
        diffs.push({ type: "galaxy_move", jobId: j.id, galaxy: j.status, ts: now });
      }
    }
    set((s) => ({
      jobs,
      recentChanges: pruneRecent([...s.recentChanges, ...diffs]),
    }));
  },
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setGoogleToken: (googleToken) => set({ googleToken }),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setOverwatchAlert: (overwatchAlert: boolean) => set({ overwatchAlert }),
  setDriveFiles: (driveFiles) => set({ driveFiles }),

  // ── Annotation CRUD ─────────────────────────────────────────────────────
  loadAnnotations: async (jobId: string) => {
    // Idempotent: skip if we already have this job's annotations in memory.
    if (get().annotationsByJob[jobId]) return;
    const annotations = await fetchAnnotations(jobId);
    set((s) => ({
      annotationsByJob: { ...s.annotationsByJob, [jobId]: annotations },
    }));
  },

  addAnnotation: (annotation: MapAnnotation) => {
    const { jobId } = annotation;
    set((s) => {
      const existing = s.annotationsByJob[jobId] ?? [];
      const next = [...existing, annotation];
      _debounceAnnotationSave(jobId, next);
      return { annotationsByJob: { ...s.annotationsByJob, [jobId]: next } };
    });
  },

  updateAnnotation: (jobId: string, id: string, patch: Partial<MapAnnotation>) => {
    set((s) => {
      const existing = s.annotationsByJob[jobId] ?? [];
      const next = existing.map((a) => (a.id === id ? { ...a, ...patch } : a));
      _debounceAnnotationSave(jobId, next);
      return { annotationsByJob: { ...s.annotationsByJob, [jobId]: next } };
    });
  },

  deleteAnnotation: (jobId: string, id: string) => {
    set((s) => {
      const existing = s.annotationsByJob[jobId] ?? [];
      const next = existing.filter((a) => a.id !== id);
      _debounceAnnotationSave(jobId, next);
      return {
        annotationsByJob: { ...s.annotationsByJob, [jobId]: next },
        activeAnnotationId: s.activeAnnotationId === id ? null : s.activeAnnotationId,
      };
    });
  },

  setDrawingMode: (drawingMode: DrawingMode) => set({ drawingMode }),
  setActiveAnnotationId: (activeAnnotationId: string | null) => set({ activeAnnotationId }),


  selectJob: (jobId) => {
    if (!jobId) {
      set({
        selectedJobId: null,
        selectedJobNumber: null,
        viewMode: get().focusedGalaxy ? "galaxy" : "universe",
      });
      return;
    }
    const job = get().jobs.find((j) => j.id === jobId);
    set({
      selectedJobId: jobId,
      selectedJobNumber: job?.workOrder ?? null,
      viewMode: "planet",
      focusedGalaxy: job?.status ?? get().focusedGalaxy,
      activeStatus: job?.status ?? get().activeStatus,
    });
  },

  enterGalaxy: (galaxy) => {
    if (!galaxy) {
      set({
        focusedGalaxy: null,
        activeStatus: null,
        viewMode: "universe",
        selectedJobId: null,
        selectedJobNumber: null,
      });
      return;
    }
    set({
      focusedGalaxy: galaxy,
      activeStatus: galaxy,
      latchedStatus: galaxy,
      viewMode: "galaxy",
      selectedJobId: null,
      selectedJobNumber: null,
    });
  },

  resetToUniverse: () =>
    set({
      viewMode: "universe",
      focusedGalaxy: null,
      activeStatus: null,
      selectedJobId: null,
      selectedJobNumber: null,
      isChatOpen: false,
      showRouteLayer: false,
      routeJobIds: [],
    }),

  setHudMode: (hudMode) => set({ hudMode }),
  toggleHud: () => {
    const cur = get().hudMode;
    set({ hudMode: cur === "expanded" ? "minimized" : "expanded" });
  },
  setHudOrientation: (hudOrientation) => set({ hudOrientation }),
  toggleHudOrientation: () => {
    const cur = get().hudOrientation;
    set({ hudOrientation: cur === "vertical" ? "horizontal" : "vertical" });
  },
  setHudPage: (hudPage) => set({ hudPage }),
  toggleHudPage: () => {
    const cur = get().hudPage;
    set({ hudPage: cur === "navigation" ? "telemetry" : "navigation" });
  },

  setChatOpen: (isChatOpen) => set({ isChatOpen }),
  setOrbMode: (orbMode) => set({ orbMode }),
  setShowRouteLayer: (showRouteLayer) => set({ showRouteLayer }),
  setRouteJobIds: (routeJobIds) => set({ routeJobIds, showRouteLayer: routeJobIds.length > 0 }),
  setMapOpen: (isMapOpen) => set({ isMapOpen, mapTransition: isMapOpen ? "open" : "idle" }),

  toggleMapFilter: (g) =>
    set((s) => {
      const isHidden = s.hiddenGalaxies.includes(g);
      sfx.select();
      return {
        hiddenGalaxies: isHidden
          ? s.hiddenGalaxies.filter((x) => x !== g)
          : [...s.hiddenGalaxies, g],
      };
    }),

  toggleHistoryOnMap: () =>
    set((s) => {
      sfx.select();
      const next = !s.showHistoryOnMap;
      return {
        showHistoryOnMap: next,
        hiddenGalaxies: next
          ? s.hiddenGalaxies.filter((g) => g !== "Complete")
          : s.hiddenGalaxies.includes("Complete")
            ? s.hiddenGalaxies
            : [...s.hiddenGalaxies, "Complete"],
      };
    }),

  resetMapFilters: () =>
    set({ hiddenGalaxies: ["Complete"], showHistoryOnMap: false }),

  diveToMap: () => {
    const cur = get().mapTransition;
    if (cur !== "idle") return; // ignore re-entry while a dive is mid-flight
    set({ mapTransition: "diving" });
    // Mid-flight: at peak warp the map mounts behind the white flash.
    // Auto-filter to the two actionable statuses so the map opens clean.
    setTimeout(() => {
      // Guard against the user cancelling/closing during the dive
      if (get().mapTransition !== "diving") return;
      set({
        isMapOpen: true,
        // Show only "Needs Fielding" and "Scheduled" by default.
        // The operator can click any galaxy widget to toggle the rest.
        hiddenGalaxies: [
          "Complete",
          "Fielded-RTS",
          "On Hold",
          "Pending",
          "Routed to Sub",
        ],
        showHistoryOnMap: false,
      });
    }, 850); // peak velocity / flash crest
    // Land: full warp completes ~1600ms total.
    setTimeout(() => {
      if (get().mapTransition !== "diving") return;
      set({ mapTransition: "open" });
    }, 1600);
  },

  riseFromMap: () => {
    const cur = get().mapTransition;
    if (cur !== "open") return;
    set({ mapTransition: "rising" });
    // Reverse-warp peak: unmount the map under the flash so the universe is
    // already revealed when the streaks decelerate.
    setTimeout(() => {
      if (get().mapTransition !== "rising") return;
      set({ isMapOpen: false });
    }, 750);
    setTimeout(() => {
      if (get().mapTransition !== "rising") return;
      set({ mapTransition: "idle" });
    }, 1400);
  },

  attachSatellites: (jobId, sats, folderId = null) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === jobId
          ? { ...j, satellites: sats, satellitesLoaded: true, driveFolderId: folderId }
          : j,
      ),
    })),

  attachMoons: (jobId, moons) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === jobId
          ? { ...j, moons, moonsLoaded: true }
          : j,
      ),
    })),

  openThread: (threadId, jobId = null) => {
    const state = get();
    let parentId = jobId;
    if (!parentId) {
      for (const j of state.jobs) {
        if (j.moons?.some((m) => m.threadId === threadId)) {
          parentId = j.id;
          break;
        }
      }
    }
    // Focus the parent planet so the camera lands on it. selectJob handles
    // viewMode / focusedGalaxy bookkeeping.
    if (parentId) {
      const job = state.jobs.find((j) => j.id === parentId);
      if (job) {
        set({
          selectedJobId: job.id,
          selectedJobNumber: job.workOrder,
          viewMode: "planet",
          focusedGalaxy: job.status,
          activeStatus: job.status,
        });
      }
    }
    set({ openThreadId: threadId, openThreadJobId: parentId });
    sfx.confirm();
  },

  closeThread: () => set({ openThreadId: null, openThreadJobId: null }),

  markMoonRead: (threadId) =>
    set((s) => ({
      jobs: s.jobs.map((j) => ({
        ...j,
        moons: j.moons?.map((m) =>
          m.threadId === threadId ? { ...m, unread: false } : m,
        ),
      })),
    })),

  setThreadSummary: (threadId, summary) =>
    set((s) => ({
      threadSummaries: { ...s.threadSummaries, [threadId]: summary },
    })),

  setGoogleAccount: (googleAccount) => set({ googleAccount }),
  setGoogleGrantedScopes: (googleGrantedScopes) => set({ googleGrantedScopes }),

  toggleChecklistItem: (jobId, key) =>
    set((s) => ({
      jobs: s.jobs.map((j) => {
        if (j.id !== jobId) return j;
        const cur: JobChecklist = j.checklist ?? {
          trafficControl: false,
          eight11: false,
          preCon: false,
          jobStart: false,
          routedSrpRtasq: false,
          hsr: false,
        };
        return { ...j, checklist: { ...cur, [key]: !cur[key] } };
      }),
    })),

  setChecklistText: (jobId, key, value) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === jobId
          ? { ...j, checklistText: { ...(j.checklistText ?? {}), [key]: value } }
          : j,
      ),
    })),

  setJobNotes: (jobId, notes) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === jobId ? { ...j, notes: notes || undefined } : j,
      ),
    })),

  setJobSecondaryStatus: (jobId, secondaryStatus) =>
    set((s) => ({
      jobs: s.jobs.map((j) => {
        if (j.id !== jobId) return j;
        const nextGalaxy = mapStatusToGalaxy(secondaryStatus);
        // If the new status is "Cancelled" mapStatusToGalaxy returns null —
        // we keep the job in the universe but pin it to its current galaxy
        // until the next Smartsheet refresh drops it. Server still writes.
        return {
          ...j,
          rawSecondaryStatus: secondaryStatus,
          status: nextGalaxy ?? j.status,
        };
      }),
    })),

  addSatellite: (jobId, sat) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              // Newest-first so the just-uploaded file lands at the top.
              satellites: [sat, ...j.satellites.filter((x) => x.id !== sat.id)],
              satellitesLoaded: true,
            }
          : j,
      ),
    })),

  removeSatellite: (jobId, satelliteId) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === jobId
          ? { ...j, satellites: j.satellites.filter((x) => x.id !== satelliteId) }
          : j,
      ),
    })),

  enterFocus: (jobId) => {
    const job = get().jobs.find((j) => j.id === jobId);
    if (!job) return;
    sfx.select();
    // Make sure the panel knows about this job too — Focus is a superset
    // of "selected" so the rest of the app (galaxy / planet view)
    // stays in sync if the user later exits focus.
    set({
      focusedJobId: jobId,
      selectedJobId: jobId,
      selectedJobNumber: job.workOrder,
      viewMode: "planet",
      focusedGalaxy: job.status,
      activeStatus: job.status,
      isChatOpen: false,
    });
  },

  exitFocus: () => {
    sfx.select();
    set({ focusedJobId: null, focusFiftyFifty: false });
  },

  setFocusFiftyFifty: (v) => set({ focusFiftyFifty: v }),

  noteRecentChange: ({ type, jobId, galaxy }) =>
    set((s) => ({
      recentChanges: pruneRecent([
        ...s.recentChanges,
        { type, jobId, galaxy, ts: Date.now() },
      ]),
    })),

  clearRecentChangesForGalaxy: (galaxy) =>
    set((s) => ({
      recentChanges: s.recentChanges.filter((r) => r.galaxy !== galaxy),
    })),

  sweepRecentChanges: () =>
    set((s) => ({ recentChanges: pruneRecent(s.recentChanges) })),

  setJobFields: async (jobId, patch) => {
    const before = get().jobs.find((j) => j.id === jobId);
    if (!before) return { ok: false, message: "Job not found in local state." };

    // Build the wire payload for /api/jobs-update. Map Job-shaped keys to
    // EditableJobField keys (the only difference is rawSecondaryStatus →
    // secondaryStatus).
    const wire: Partial<Record<EditableJobField, string | null>> = {};
    if (patch.notes !== undefined) wire.notes = patch.notes ?? null;
    if (patch.splicingNotes !== undefined) wire.splicingNotes = patch.splicingNotes ?? null;
    if (patch.rawSecondaryStatus !== undefined) wire.secondaryStatus = patch.rawSecondaryStatus ?? null;
    if (patch.jobStatus !== undefined) wire.jobStatus = patch.jobStatus ?? null;
    if (patch.address !== undefined) wire.address = patch.address ?? null;
    if (patch.city !== undefined) wire.city = patch.city ?? null;
    if (patch.zip !== undefined) wire.zip = patch.zip ?? null;
    if (patch.scheduleDate !== undefined) wire.scheduleDate = patch.scheduleDate ?? null;
    if (patch.endDate !== undefined) wire.endDate = patch.endDate ?? null;
    if (patch.dueDate !== undefined) wire.dueDate = patch.dueDate ?? null;
    if (patch.crew !== undefined) wire.crew = patch.crew ?? null;
    if (patch.permitNumber !== undefined) wire.permitNumber = patch.permitNumber ?? null;
    if (patch.workType !== undefined) wire.workType = patch.workType ?? null;
    if (patch.base !== undefined) wire.base = patch.base ?? null;
    if (patch.bidValue !== undefined) wire.bidValue = patch.bidValue ?? null;

    if (Object.keys(wire).length === 0) {
      return { ok: true };
    }

    // Optimistic local update — and recompute galaxy if secondary status
    // changed (mirrors the legacy setJobSecondaryStatus behavior).
    set((s) => ({
      jobs: s.jobs.map((j) => {
        if (j.id !== jobId) return j;
        const next: Job = { ...j, ...patch };
        if (patch.rawSecondaryStatus !== undefined) {
          const nextGalaxy = mapStatusToGalaxy(patch.rawSecondaryStatus ?? "");
          if (nextGalaxy) next.status = nextGalaxy;
        }
        return next;
      }),
    }));

    const result = await updateJobFields(before.rowId, wire);
    if (!result.ok) {
      // Roll back to the pre-edit copy so the UI never lies.
      set((s) => ({
        jobs: s.jobs.map((j) => (j.id === jobId ? before : j)),
      }));
      sfx.error();
      return result;
    }
    sfx.confirm();
    return { ok: true };
  },
}));

if (import.meta.env.DEV) {
  // expose for dev/testing
  (window as unknown as { __uiStore: typeof useUI }).__uiStore = useUI;
}

// Convenience selectors. Memoized at the module level so consecutive
// reads with the same `jobs` reference return the same object — this is
// what stops Zustand v5 from treating every render as a state change.
export const selectJobsByGalaxy = (state: UIState, galaxy: Galaxy) =>
  state.jobs.filter((j) => j.status === galaxy);

// Debounce Firestore annotation writes so rapid drag events don't hammer the DB.
const _annotationSaveTimers: Record<string, ReturnType<typeof setTimeout>> = {};
function _debounceAnnotationSave(jobId: string, annotations: MapAnnotation[]): void {
  clearTimeout(_annotationSaveTimers[jobId]);
  _annotationSaveTimers[jobId] = setTimeout(() => {
    void _saveAnnotations(jobId, annotations);
  }, 800);
}

let _countsKey: Job[] | null = null;
let _countsValue: Record<Galaxy, number> = {
  Complete: 0,
  "Fielded-RTS": 0,
  "Needs Fielding": 0,
  "On Hold": 0,
  Pending: 0,
  "Routed to Sub": 0,
  Scheduled: 0,
};
export const selectGalaxyCounts = (state: UIState): Record<Galaxy, number> => {
  if (state.jobs === _countsKey) return _countsValue;
  const counts: Record<Galaxy, number> = {
    Complete: 0,
    "Fielded-RTS": 0,
    "Needs Fielding": 0,
    "On Hold": 0,
    Pending: 0,
    "Routed to Sub": 0,
    Scheduled: 0,
  };
  for (const j of state.jobs) counts[j.status] += 1;
  _countsKey = state.jobs;
  _countsValue = counts;
  return counts;
};
