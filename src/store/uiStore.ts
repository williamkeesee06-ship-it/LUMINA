import { create } from "zustand";
import { sfx } from "@/lib/audio";
import type {
  Galaxy,
  HudMode,
  HudOrientation,
  Job,
  JobChecklist,
  MapTransition,
  Moon,
  OrbMode,
  Satellite,
  ViewMode,
} from "@/types";

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

  // Map open state (tactical map is a surface, not the home)
  isMapOpen: boolean;

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

  // Actions
  setJobs: (jobs: Job[]) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setGoogleToken: (t: string | null) => void;
  setUnreadCount: (n: number) => void;
  setDriveFiles: (f: Moon[]) => void;
  selectJob: (jobId: string | null) => void;
  enterGalaxy: (galaxy: Galaxy | null) => void;
  resetToUniverse: () => void;
  setHudMode: (m: HudMode) => void;
  toggleHud: () => void;
  setHudOrientation: (o: HudOrientation) => void;
  toggleHudOrientation: () => void;
  setChatOpen: (open: boolean) => void;
  setOrbMode: (m: OrbMode) => void;
  setShowRouteLayer: (v: boolean) => void;
  setRouteJobIds: (ids: string[]) => void;
  setMapOpen: (open: boolean) => void;
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
  toggleChecklistItem: (jobId: string, key: keyof JobChecklist) => void;
  setChecklistText: (jobId: string, key: keyof JobChecklist, value: string) => void;
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

  hudMode: "expanded",
  hudOrientation: "vertical",
  isMapOpen: false,
  mapTransition: "idle",
  // History (Complete) starts hidden so the map opens focused on active work.
  // Complete is also added to hiddenGalaxies so the toggleMapFilter logic
  // stays consistent (one source of truth for whether a galaxy renders).
  hiddenGalaxies: ["Complete"],
  showHistoryOnMap: false,

  setJobs: (jobs) => set({ jobs }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setGoogleToken: (googleToken) => set({ googleToken }),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setDriveFiles: (driveFiles) => set({ driveFiles }),

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
    setTimeout(() => {
      // Guard against the user cancelling/closing during the dive
      if (get().mapTransition !== "diving") return;
      set({ isMapOpen: true });
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
