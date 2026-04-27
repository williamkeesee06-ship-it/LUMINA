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

/** Two HUD modes: expanded (default, full readouts + galaxy widgets) or minimized (slim standby bar). */
export type HudMode = "minimized" | "expanded";

/** HUD orientation: vertical (default, right-docked column) or horizontal (legacy bottom rail). */
export type HudOrientation = "vertical" | "horizontal";

/**
 * Map transition state machine. Drives the hyperspace dive into the tactical
 * map (and the reverse warp-out back to the universe).
 *  - idle: universe is the active surface, map fully closed
 *  - diving: hyperspace warp is running; universe canvas accelerates forward,
 *    star streaks rip past, white flash at peak velocity
 *  - open: tactical map is the fullscreen surface
 *  - rising: reverse warp; map fades out, universe re-emerges from forward depth
 */
export type MapTransition = "idle" | "diving" | "open" | "rising";

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

/**
 * A satellite represents a Drive-linked job artifact
 * (permits, prints, redlines, bidmaster, revisits).
 */
export interface Satellite {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  category?: "permit" | "print" | "redline" | "bidmaster" | "revisit" | "other";
  modifiedTime?: string;
}

/** A moon represents a Gmail email thread for the job. */
export interface Moon {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  unread: boolean;
}

/**
 * A Job is a Planet. Sourced from Smartsheet, enriched with
 * Drive satellites (documents) and Gmail moons (email threads).
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
  // Drive documents orbit as satellites
  satellites: Satellite[];
  // Gmail email threads orbit as moons
  moons: Moon[];
  satellitesLoaded: boolean;
  moonsLoaded: boolean;
  driveFolderId?: string | null;
  /**
   * Per-job operational checklist. Six fixed items, persisted client-side
   * for now. Later: persist to Smartsheet.
   */
  checklist?: JobChecklist;
  /**
   * Free-text inputs that ride alongside specific checklist items
   * (e.g. 811 ticket number). Keyed by checklist key.
   */
  checklistText?: Partial<Record<keyof JobChecklist, string>>;
}

/** Six fixed jobsite checklist items. Order = display order in JobPanel. */
export interface JobChecklist {
  trafficControl: boolean;
  eight11: boolean;
  preCon: boolean;
  jobStart: boolean;
  routedSrpRtasq: boolean;
  hsr: boolean;
}

export const CHECKLIST_LABELS: Record<keyof JobChecklist, string> = {
  trafficControl: "Traffic Control Req",
  eight11: "811",
  preCon: "Pre-Con",
  jobStart: "Job Start",
  routedSrpRtasq: "Routed in SRP/RTASQ",
  hsr: "HSR",
};

export const DEFAULT_CHECKLIST: JobChecklist = {
  trafficControl: false,
  eight11: false,
  preCon: false,
  jobStart: false,
  routedSrpRtasq: false,
  hsr: false,
};

/** Which checklist keys carry an inline free-text input. */
export const CHECKLIST_TEXT_FIELDS: Partial<Record<keyof JobChecklist, { placeholder: string }>> = {
  eight11: { placeholder: "811 ticket #" },
};

export interface RouteState {
  visible: boolean;
  jobIds: string[];
}
