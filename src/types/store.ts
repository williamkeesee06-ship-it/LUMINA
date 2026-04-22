import type { JobOrbit, GalaxyType } from './lumina';

export type LuminaViewMode = 'galaxy' | 'earth' | 'map';
export type LuminaViewLevel = 'universe' | 'galaxy' | 'planet';

export type OrbMode = 
  | 'idle' 
  | 'connected' 
  | 'navigating' 
  | 'thinking' 
  | 'voice' 
  | 'limited' 
  | 'error';

/**
 * Latch target can be a specific galaxy category or the 'Total' overview.
 */
export type LuminaLatchTarget = GalaxyType | 'Total' | null;

/**
 * UI_STORE_STATE
 * Handled by Zustand for high-performance orchestration.
 */
export interface UIStoreState {
  selectedJobId: string | null;
  selectedJobNumber: string | null;
  viewMode: LuminaViewMode;
  viewLevel: LuminaViewLevel;
  focusedGalaxy: GalaxyType | null;
  activeStatus: string | null;
  latchedStatus: LuminaLatchTarget;
  isChatOpen: boolean;
  voiceEnabled: boolean;
  orbMode: OrbMode;
  uiError: string | null;

}

/**
 * UI_STORE_ACTIONS
 */
export interface UIStoreActions {
  selectJob: (jobId: string, jobNumber?: string) => void;
  clearSelectedJob: () => void;
  setViewMode: (mode: LuminaViewMode) => void;
  setViewLevel: (level: LuminaViewLevel) => void;
  setFocusedGalaxy: (galaxy: GalaxyType | null) => void;
  setActiveStatus: (status: string | null) => void;
  setLatchedStatus: (status: LuminaLatchTarget) => void;
  toggleChat: () => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setOrbMode: (mode: OrbMode) => void;
  setUIError: (error: string | null) => void;

  resetUI: () => void;
}

export type UIStore = UIStoreState & UIStoreActions;

/**
 * LUMINA_DATA_STATE
 * The core data payload managed by App.tsx and bridged via Context.
 */
export interface LuminaDataState {
  jobs: JobOrbit[];
  loading: boolean;
  error: string | null;
  googleToken: string | null;
  unreadCount: number;
  driveFiles: any[];
}

/**
 * LUMINA_FULL_STORE
 * The combined surface of useLumina().
 */
export interface LuminaStore extends UIStoreState, UIStoreActions, LuminaDataState {
  login: () => void;
  resetUniverse: () => void;
}

