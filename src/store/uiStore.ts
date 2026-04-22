import { create } from 'zustand';
import type { 
  UIStore, 
  UIStoreState 
} from '../types/store';

const initialState: UIStoreState = {
  selectedJobId: null,
  selectedJobNumber: null,
  viewMode: 'galaxy',
  viewLevel: 'universe',
  focusedGalaxy: null,
  activeStatus: null,
  latchedStatus: null,
  isChatOpen: false,
  voiceEnabled: false,
  orbMode: 'connected',
  uiError: null,
};

export const useUIStore = create<UIStore>((set) => ({
  ...initialState,

  selectJob: (jobId, jobNumber) => 
    set({ selectedJobId: jobId, selectedJobNumber: jobNumber || null }),
  
  clearSelectedJob: () => 
    set({ selectedJobId: null, selectedJobNumber: null }),

  setViewMode: (mode) => set({ viewMode: mode }),
  
  setViewLevel: (level) => set({ viewLevel: level }),
  
  setFocusedGalaxy: (galaxy) => set({ focusedGalaxy: galaxy }),
  
  setActiveStatus: (status) => set({ activeStatus: status }),
  
  setLatchedStatus: (status) => set({ latchedStatus: status }),
  
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  
  setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
  
  setOrbMode: (mode) => set({ orbMode: mode }),
  
  setUIError: (error) => set({ uiError: error }),

  resetUI: () => {
    set({
      ...initialState,
      // Ensure we keep connected mode if we were idle/connected
      orbMode: 'connected'
    });
  },
}));
