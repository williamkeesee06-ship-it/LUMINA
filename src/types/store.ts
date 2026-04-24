import type { GalaxyType } from './lumina';

export type LuminaViewMode = 'universe' | 'galaxy' | 'planet' | 'earth' | 'map';
export type OrbMode = 'idle' | 'escort' | 'thinking' | 'voice' | 'navigating' | 'alert' | 'error';
export type LuminaLatchTarget = 'Total' | GalaxyType | null;

export interface LuminaUIState {
  selectedJobId: string | null;
  selectedJobNumber?: string | null;
  viewMode: LuminaViewMode;
  focusedGalaxy: GalaxyType | null;
  activeStatus: GalaxyType | null;
  latchedStatus: LuminaLatchTarget;
  isChatOpen: boolean;
  voiceEnabled: boolean;
  orbMode: OrbMode;
}

