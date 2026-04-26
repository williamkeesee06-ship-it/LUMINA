import type { Galaxy } from "@/types";

/**
 * Maps the 28 raw Smartsheet `Secondary Job Status` values to the bible's
 * 7 canonical galaxies. Cancelled rows are excluded (return null).
 *
 * If a value is unknown, we fall through to "Pending" — pending is a holding
 * cluster, not a fabrication. Bible: never invent statuses.
 */
export function mapStatusToGalaxy(raw: string): Galaxy | null {
  const v = (raw ?? "").trim();
  if (!v) return "Pending";
  if (v === "Cancelled") return null;

  const normalized = v.toUpperCase();

  if (
    normalized === "COMPLETE" ||
    normalized === "COMPLETE/PENDING PROD" ||
    normalized === "READY TO MOVE TO BILLING" ||
    normalized === "IN BILLING"
  ) {
    return "Complete";
  }
  if (
    normalized === "FIELDED - RTS" ||
    normalized === "FIELDED" ||
    normalized === "FIELDED - NEEDS COORDINATION" ||
    normalized === "FIELDED - NEEDS INFO"
  ) {
    return "Fielded-RTS";
  }
  if (normalized === "NEEDS FIELDING" || normalized === "NEEDS LOCATES") {
    return "Needs Fielding";
  }
  if (normalized === "ON HOLD" || normalized === "ON HOLD / PARTIAL BILL") {
    return "On Hold";
  }
  if (normalized === "ROUTED TO SUB") {
    return "Routed to Sub";
  }
  if (normalized === "SCHEDULED") {
    return "Scheduled";
  }
  // Pending bucket absorbs all "Pending *" + In Progress / In Review variants.
  if (
    normalized.startsWith("PENDING") ||
    normalized === "PENDING UNITS IN BM" ||
    normalized === "IN PROGRESS" ||
    normalized === "IN REVIEW"
  ) {
    return "Pending";
  }
  return "Pending";
}

export const GALAXY_COLORS: Record<Galaxy, string> = {
  Complete: "#3CFFD2", // teal-glow
  "Fielded-RTS": "#5BF3FF", // cyan-glow
  "Needs Fielding": "#FFB347", // amber-warn
  "On Hold": "#FF5151", // red-alert
  Pending: "#A78BFA", // violet — Pending is liminal
  "Routed to Sub": "#FF3D9A", // magenta-signal
  Scheduled: "#7DFC9C", // green
};

export const GALAXY_GLYPH: Record<Galaxy, string> = {
  Complete: "✓",
  "Fielded-RTS": "◈",
  "Needs Fielding": "◇",
  "On Hold": "■",
  Pending: "◌",
  "Routed to Sub": "↗",
  Scheduled: "◑",
};
