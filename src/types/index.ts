// Canonical V3 type system. Mirrors the bible's state model doctrine.

/**
 * Canonical galaxies per the bible. These are the 7 status clusters
 * that contain planets. Cancelled rows are excluded from the universe.
 */
export type Galaxy =
  | "Complete"
  | "Fielded-RTS"
  | "Needs Fielding"
  | "On Hold"
  | "Pending"
  | "Routed to Sub"
  | "Scheduled";

export const GALAXIES: readonly Galaxy[] = [
  "Complete",
  "Fielded-RTS",
  "Needs Fielding",
  "On Hold",
  "Pending",
  "Routed to Sub",
  "Scheduled",
] as const;

/** Three HUD modes. Bible: "exactly three modes". */
export type HudMode = "minimized" | "standard" | "expanded";

/** Spatial view tier. Universe -> Galaxy -> Planet. */
export type ViewMode = "universe" | "galaxy" | "planet";

/** Orb states reflect LUMINA's relationship to current system state. */
export type OrbMode =
  | "idle"
  | "escort"
  | "thinking"
  | "navigating"
  | "listening"
  | "live";

/** A satellite represents communications intelligence (Gmail). */
export interface Satellite {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  unread: boolean;
}

/**
 * A moon represents a Drive-linked job artifact
 * (permits, prints, redlines, bidmaster, revisits).
 */
export interface Moon {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  category?: "permit" | "print" | "redline" | "bidmaster" | "revisit" | "other";
  modifiedTime?: string;
}

/**
 * A Job is a Planet. Sourced from Smartsheet, enriched with
 * Gmail satellites and Drive moons.
 */
export interface Job {
  id: string;
  rowId: string;
  workOrder: string;
  status: Galaxy;
  rawSecondaryStatus: string;
  jobStatus?: string;
  address?: string;
  city?: string;
  zip?: string;
  fullAddress?: string;
  coords?: { lat: number; lng: number };
  notes?: string;
  splicingNotes?: string;
  workType?: string;
  base?: string;
  scheduleDate?: string;
  endDate?: string;
  dueDate?: string;
  receivedDate?: string;
  bidValue?: string;
  crew?: string;
  permitNumber?: string;
  satellites: Satellite[];
  moons: Moon[];
  satellitesLoaded: boolean;
  moonsLoaded: boolean;
  driveFolderId?: string | null;
}

export interface RouteState {
  visible: boolean;
  jobIds: string[];
}
