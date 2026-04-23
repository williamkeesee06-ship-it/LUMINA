/**
 * LUMINA DATA CONTRACT
 * Defines the mapping between Smartsheet API response and the 3D Cosmic Dashboard.
 */

export type SatelliteKind = 'communication' | 'attachment' | 'scheduling' | 'route' | 'ai_status' | 'other';
export type MoonKind = 'permit' | 'prints' | 'redlines' | 'bidmaster' | 'revisit' | 'other';
export type MoonState = 'ok' | 'warning' | 'alert' | 'inactive' | 'waiting' | 'needs_reply';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GmailSatellite {
  id: string;
  label: string;
  kind: SatelliteKind;
  state: MoonState;
  snippet?: string;
  threadId?: string;
  payload?: any;
}

export interface DriveMoon {
  id: string;
  kind: MoonKind;
  label: string;
  state: MoonState;
  link?: string;
  payload?: any;
}

export interface ConstructionJob {
  rowId: string; // Smartsheet Row ID (was 'id')
  jobNumber: string; // From "Primary" column
  status: string; // From "Secondary Status" column
  address: string; // From "Address" column
  city: string; // From "City" column
  notes: string; // From "NSC Project Notes" column
  crew: string; // From "Construction Crew/Foreman" column
  scheduleDate: string; // From "Schedule Date" column
  cpaSro: string; // From "CPA/SRO" column
  supervisor: string; // From "Construction Supervisor" column (Filter: "Billy Keesee")
  lat?: number;
  lng?: number;
  driveFolderId?: string;
}

/**
 * JobOrbit encompasses a job and its associated cosmic bodies.
 */
export interface JobOrbit extends ConstructionJob {
  moons: DriveMoon[];
  satellites: GmailSatellite[];
}

export interface SmartsheetColumn {
  id: number;
  title: string;
}

export interface SmartsheetCell {
  columnId: number;
  value: string | number | boolean;
  displayValue?: string;
}

export interface SmartsheetAttachment {
  id: number;
  name: string;
  attachmentType: string;
  mimeType?: string;
  url?: string;
  createdAt: string;
}

export interface SmartsheetRow {
  id: number;
  cells: SmartsheetCell[];
  attachments?: SmartsheetAttachment[];
}

export interface SmartsheetResponse {
  rows: SmartsheetRow[];
  columns: SmartsheetColumn[];
}

/**
 * 3D SCENE TYPES
 */
export interface PlanetData extends JobOrbit {
  position: [number, number, number];
  color: string;
  size: number;
}

export const STATUS_COLORS = [
  '#2a9d8f', // Complete: Muted Teal/Soft Cyan-Green
  '#00d2ff', // Fielded-RTS: Bright Cyan-Blue
  '#e76f51', // Needs Fielding: Orange-Red
  '#ffcc33', // On Hold: Gold/Amber
  '#9d4edd', // Pending: Violet-Blue
  '#0077ff', // Routed to Sub: Electric Blue-Cyan
  '#7209b7', // Scheduled: Magenta-Violet
];

// Galaxy Tier Hierarchy
export const GALAXY_CATEGORIES = [
  'Complete',
  'Fielded-RTS',
  'Needs Fielding',
  'On Hold',
  'Pending',
  'Routed to Sub',
  'Scheduled'
] as const;

export type GalaxyType = typeof GALAXY_CATEGORIES[number];

export const PENDING_SUBTYPES = [
  'Pending Customer',
  'Pending Engineering',
  'Pending Gigs',
  'Pending HSR',
  'Pending Permit',
  'Pending Splicing'
];

export const resolveGalaxy = (status: string): GalaxyType => {
  const s = (status || '').trim();
  if (PENDING_SUBTYPES.some(sub => s.includes(sub))) return 'Pending';
  const found = GALAXY_CATEGORIES.find(cat => cat.toLowerCase() === s.toLowerCase());
  return found || 'Scheduled'; // Fallback
};


