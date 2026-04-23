import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { 
  LuminaViewMode, 
  OrbMode, 
  LuminaLatchTarget 
} from '../types/store';
import type { JobOrbit } from '../types/lumina';

export interface LuminaState {
  // Data
  jobs: JobOrbit[];
  loading: boolean;
  error: string | null;
  googleToken: string | null;
  unreadCount: number;
  driveFiles: any[];

  // UI State
  selectedJobId: string | null;
  selectedJobNumber: string | null;
  viewMode: LuminaViewMode;
  focusedGalaxy: string | null;
  activeStatus: string | null;
  latchedStatus: LuminaLatchTarget;
  isChatOpen: boolean;
  voiceEnabled: boolean;
  isDictating: boolean;
  isFullVoice: boolean;
  orbMode: OrbMode;

  // Actions
  setJobs: (jobs: JobOrbit[] | ((prev: JobOrbit[]) => JobOrbit[])) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setGoogleToken: (token: string | null) => void;
  setUnreadCount: (count: number) => void;
  setDriveFiles: (files: any[]) => void;

  selectJob: (jobId: string | null, jobNumber?: string | null) => void;
  clearSelectedJob: () => void;
  setViewMode: (mode: LuminaViewMode) => void;
  setFocusedGalaxy: (galaxy: string | null) => void;
  setActiveStatus: (status: string | null) => void;
  setLatchedStatus: (status: LuminaLatchTarget) => void;
  toggleChat: () => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setIsDictating: (active: boolean) => void;
  setIsFullVoice: (active: boolean) => void;
  setOrbMode: (mode: OrbMode) => void;
  resetUniverse: () => void;
  enrichJob: (jobId: string, googleToken: string) => Promise<void>;
}

export const useUIStore = create<LuminaState>()(
  subscribeWithSelector((set, get) => ({
    // ... initial state remains same
    jobs: [],
    loading: true,
    error: null,
    googleToken: null,
    unreadCount: 0,
    driveFiles: [],

    selectedJobId: null,
    selectedJobNumber: null,
    viewMode: 'universe',
    focusedGalaxy: null,
    activeStatus: null,
    latchedStatus: null,
    isChatOpen: false,
    voiceEnabled: false,
    isDictating: false,
    isFullVoice: false,
    orbMode: 'idle',

    // Actions
    setJobs: (jobs) => set((state) => ({ 
      jobs: typeof jobs === 'function' ? jobs(state.jobs) : jobs 
    })),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    setGoogleToken: (token) => set({ googleToken: token }),
    setUnreadCount: (count) => set({ unreadCount: count }),
    setDriveFiles: (files) => set({ driveFiles: files }),

    selectJob: (jobId, jobNumber) => {
      const state = get();
      const preserveMode = (state.viewMode === 'map' || state.viewMode === 'earth');

      set({ 
        selectedJobId: jobId, 
        selectedJobNumber: jobNumber || null,
        viewMode: preserveMode ? state.viewMode : (jobId ? 'planet' : 'universe')
      });
      // Trigger enrichment if needed
      if (jobId && state.googleToken) {
        state.enrichJob(jobId, state.googleToken);
      }
    },
    clearSelectedJob: () => set((state) => {
      const preserveMode = (state.viewMode === 'map' || state.viewMode === 'earth');
      return { 
        selectedJobId: null, 
        selectedJobNumber: null,
        viewMode: preserveMode ? state.viewMode : (state.activeStatus ? 'galaxy' : 'universe')
      };
    }),
    setViewMode: (viewMode) => set({ viewMode }),
    setFocusedGalaxy: (focusedGalaxy) => set({ focusedGalaxy }),
    setActiveStatus: (activeStatus) => set({ activeStatus }),
    setLatchedStatus: (latchedStatus) => set({ latchedStatus }),
    toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
    setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
    setIsDictating: (isDictating) => set({ isDictating, isFullVoice: isDictating ? false : get().isFullVoice }),
    setIsFullVoice: (isFullVoice) => set({ isFullVoice, isDictating: isFullVoice ? false : get().isDictating }),
    setOrbMode: (orbMode) => set({ orbMode }),
    resetUniverse: () => set({
      selectedJobId: null,
      selectedJobNumber: null,
      focusedGalaxy: null,
      activeStatus: null,
      latchedStatus: null,
      viewMode: 'universe',
      orbMode: 'idle'
    }),
    enrichJob: async (jobId, googleToken) => {
      const { jobs } = get();
      const jobIndex = jobs.findIndex(j => j.rowId === jobId);
      if (jobIndex === -1) return;
      
      const job = jobs[jobIndex];
      // Only enrich if not already enriched
      if (job.moons.length > 0 || job.satellites.length > 0) return;

      const { fetchFilesInFolder, classifyFile, fetchSatelliteForJob } = await import('../services/google');
      
      try {
        const moons: any[] = [];
        if (job.driveFolderId) {
          const files = await fetchFilesInFolder(googleToken, job.driveFolderId);
          files.forEach((f: any) => {
            moons.push({
              id: f.id,
              kind: classifyFile(f.name),
              label: f.name,
              state: 'ok'
            });
          });
        }

        const satellites: any[] = [];
        const emailData = await fetchSatelliteForJob(googleToken, job.jobNumber);
        if (emailData) {
          satellites.push({
            id: emailData.threadId,
            kind: 'communication',
            label: 'COMM LINK',
            state: emailData.state,
            payload: { subject: emailData.subject, snippet: emailData.snippet, threadId: emailData.threadId }
          });
        }

        set((state) => {
          const newJobs = [...state.jobs];
          newJobs[jobIndex] = { ...job, moons, satellites };
          return { jobs: newJobs };
        });
      } catch (err) {
        console.warn(`[Lumina] Enrichment failed for ${job.jobNumber}`, err);
      }
    }
  }))
);
