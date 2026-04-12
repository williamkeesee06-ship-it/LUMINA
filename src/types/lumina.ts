/**
 * LUMINA DATA CONTRACT
 * Defines the mapping between Smartsheet API response and the 3D Cosmic Dashboard.
 */

export interface ConstructionJob {
  id: string; // Smartsheet Row ID
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

export interface SmartsheetRow {
  id: string;
  cells: SmartsheetCell[];
}

export interface SmartsheetResponse {
  rows: SmartsheetRow[];
  columns: SmartsheetColumn[];
}

/**
 * 3D SCENE TYPES
 */
export interface PlanetData extends ConstructionJob {
  position: [number, number, number];
  color: string;
  size: number;
}

export const STATUS_COLORS = [
  '#00ff88', // green
  '#00f2ff', // cyan
  '#ffcc00', // gold
  '#ff3333', // red
  '#aa44ff', // violet
  '#ff6600', // orange
  '#00ffcc', // mint
  '#ff44aa', // hot pink
  '#88ff00', // lime
  '#0088ff', // blue
  '#ff8844', // peach
  '#44ffee', // aqua
];
