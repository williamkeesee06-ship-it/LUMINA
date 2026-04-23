export type LuminaViewMode = 'universe' | 'galaxy' | 'planet' | 'earth' | 'map';
export type OrbMode = 'idle' | 'escort' | 'thinking' | 'voice' | 'navigating' | 'alert' | 'error';
export type LuminaLatchTarget = 'Total' | 'Complete' | 'Fielded-RTS' | 'Needs Fielding' | 'On Hold' | 'Pending' | 'Routed to Sub' | 'Scheduled' | null;

export interface LuminaUIState {
  selectedJobId: string | null;
  selectedJobNumber?: string | null;
  viewMode: LuminaViewMode;
  focusedGalaxy: string | null;
  activeStatus: string | null;
  latchedStatus: LuminaLatchTarget;
  isChatOpen: boolean;
  voiceEnabled: boolean;
  orbMode: OrbMode;
}

