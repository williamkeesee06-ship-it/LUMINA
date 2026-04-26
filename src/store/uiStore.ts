import { create } from "zustand";
import type {
  Galaxy,
  HudMode,
  Job,
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

  // Map open state (tactical map is a surface, not the home)
  isMapOpen: boolean;

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
  setChatOpen: (open: boolean) => void;
  setOrbMode: (m: OrbMode) => void;
  setShowRouteLayer: (v: boolean) => void;
  setRouteJobIds: (ids: string[]) => void;
  setMapOpen: (open: boolean) => void;
  attachSatellites: (jobId: string, sats: Satellite[]) => void;
  attachMoons: (jobId: string, moons: Moon[], folderId?: string | null) => void;
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

  hudMode: "standard",
  isMapOpen: false,

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
    const next: HudMode =
      cur === "minimized" ? "standard" : cur === "standard" ? "expanded" : "minimized";
    set({ hudMode: next });
  },

  setChatOpen: (isChatOpen) => set({ isChatOpen }),
  setOrbMode: (orbMode) => set({ orbMode }),
  setShowRouteLayer: (showRouteLayer) => set({ showRouteLayer }),
  setRouteJobIds: (routeJobIds) => set({ routeJobIds, showRouteLayer: routeJobIds.length > 0 }),
  setMapOpen: (isMapOpen) => set({ isMapOpen }),

  attachSatellites: (jobId, sats) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === jobId ? { ...j, satellites: sats, satellitesLoaded: true } : j,
      ),
    })),

  attachMoons: (jobId, moons, folderId = null) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === jobId
          ? { ...j, moons, moonsLoaded: true, driveFolderId: folderId }
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
