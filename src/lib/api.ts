import type { Job, Moon, Satellite } from "@/types";
import { mapStatusToGalaxy } from "./statusMap";

interface RawJobRow {
  rowId: string;
  workOrder: string;
  status: string;
  jobStatus: string;
  address: string;
  city: string;
  zip: string;
  notes: string;
  splicingNotes: string;
  workType: string;
  base: string;
  scheduleDate: string;
  endDate: string;
  dueDate: string;
  receivedDate: string;
  bidValue: string;
  crew: string;
  permitNumber: string;
}

export async function fetchJobs(): Promise<Job[]> {
  const r = await fetch("/api/jobs");
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.message || `Smartsheet failed (${r.status})`);
  }
  const { jobs } = (await r.json()) as { jobs: RawJobRow[] };

  const mapped: Job[] = [];
  for (const row of jobs) {
    const galaxy = mapStatusToGalaxy(row.status);
    if (!galaxy) continue; // Cancelled — not part of the universe
    const fullAddress =
      [row.address, row.city, row.zip].filter(Boolean).join(", ").trim() || undefined;
    mapped.push({
      id: row.rowId,
      rowId: row.rowId,
      workOrder: row.workOrder,
      status: galaxy,
      rawSecondaryStatus: row.status,
      jobStatus: row.jobStatus,
      address: row.address || undefined,
      city: row.city || undefined,
      zip: row.zip || undefined,
      fullAddress,
      notes: row.notes || undefined,
      splicingNotes: row.splicingNotes || undefined,
      workType: row.workType || undefined,
      base: row.base || undefined,
      scheduleDate: row.scheduleDate || undefined,
      endDate: row.endDate || undefined,
      dueDate: row.dueDate || undefined,
      receivedDate: row.receivedDate || undefined,
      bidValue: row.bidValue || undefined,
      crew: row.crew || undefined,
      permitNumber: row.permitNumber || undefined,
      satellites: [],
      moons: [],
      satellitesLoaded: false,
      moonsLoaded: false,
    });
  }
  return mapped;
}

/**
 * Persist edited NSC Project Notes back to Smartsheet for a row.
 * Server resolves the column ID and uses the SMARTSHEET_TOKEN env secret.
 */
export async function updateJobNotes(
  rowId: string,
  notes: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const r = await fetch("/api/jobs-update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowId, notes }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.ok) {
      return {
        ok: false,
        message: data?.message ?? `Smartsheet update failed (${r.status})`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error.",
    };
  }
}

/**
 * Persist edited Secondary Job Status back to Smartsheet. Server uses
 * strict:true so an unknown picklist value is rejected by Smartsheet
 * rather than silently written.
 */
export async function updateJobSecondaryStatus(
  rowId: string,
  secondaryStatus: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const r = await fetch("/api/jobs-update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowId, secondaryStatus }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.ok) {
      return {
        ok: false,
        message: data?.message ?? `Smartsheet update failed (${r.status})`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error.",
    };
  }
}

/**
 * Live snapshot of the Smartsheet "Secondary Job Status" PICKLIST options,
 * in the exact order they appear in the sheet. Smartsheet validates picklist
 * writes when strict:true, so these strings must match exactly. If the column
 * is edited in Smartsheet, mirror the change here.
 */
export const SECONDARY_STATUS_OPTIONS: readonly string[] = [
  "In Progress",
  "Needs Fielding",
  "Scheduled",
  "Fielded",
  "Pending BAA/BEA",
  "Pending Splicing",
  "Pending HSR",
  "Pending Permit",
  "PENDING UNITS IN BM",
  "On Hold",
  "On Hold / Partial Bill",
  "In Billing",
  "Pending GIGs",
  "Cancelled",
  "Pending Consolidation Report",
  "In Review",
  "Complete",
  "Complete/Pending Prod",
  "Routed to SUB",
  "Pending Pole Removal",
  "Pending Customer",
  "NEEDS LOCATES",
  "PENDING OTHER UTILITIES",
  "FIELDED - RTS",
  "FIELDED - NEEDS COORDINATION",
  "FIELDED - NEEDS INFO",
  "Ready to move to billing",
  "PENDING ENGINEERING",
] as const;

export async function geocodeAddresses(
  addresses: string[],
): Promise<Record<string, { lat: number; lng: number } | null>> {
  if (addresses.length === 0) return {};
  const r = await fetch("/api/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ addresses }),
  });
  if (!r.ok) return {};
  const { results } = (await r.json()) as {
    results: Record<string, { lat: number; lng: number } | null>;
  };
  return results;
}

/** Gmail email threads = MOONS in this universe (closer, communications). */
export async function searchGmail(token: string, query: string): Promise<Moon[]> {
  const r = await fetch("/api/gmail-search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, maxResults: 8 }),
  });
  if (!r.ok) return [];
  const { messages } = (await r.json()) as {
    messages: {
      id: string;
      threadId: string;
      subject: string;
      from: string;
      date: string;
      snippet: string;
      unread: boolean;
    }[];
  };
  return (messages ?? []).map((m) => ({
    id: m.id,
    threadId: m.threadId,
    subject: m.subject || "(no subject)",
    from: m.from,
    snippet: m.snippet,
    date: m.date,
    unread: m.unread,
  }));
}

/** Drive documents = SATELLITES in this universe (orbit further, structural). */
export async function listDrive(
  token: string,
  workOrder: string,
): Promise<{ folderId: string | null; satellites: Satellite[] }> {
  const r = await fetch("/api/drive-list", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ workOrder }),
  });
  if (!r.ok) return { folderId: null, satellites: [] };
  const data = (await r.json()) as {
    folder: { id: string; name: string } | null;
    files: { id: string; name: string; mimeType: string; webViewLink?: string; modifiedTime?: string }[];
  };
  if (!data.folder) return { folderId: null, satellites: [] };
  const satellites: Satellite[] = data.files.map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    webViewLink: f.webViewLink,
    modifiedTime: f.modifiedTime,
    category: categorizeSatellite(f.name),
  }));
  return { folderId: data.folder.id, satellites };
}

/**
 * Lightweight name-based categorizer used to label satellites in the job
 * panel. It's a best-effort heuristic — the file's actual MIME also bumps
 * unmatched images into "photo" so a JPEG named "IMG_3942.jpg" doesn't
 * collapse to "other".
 */
export function categorizeSatellite(
  name: string,
  mimeType?: string,
): Satellite["category"] {
  const n = name.toLowerCase();
  if (n.includes("permit")) return "permit";
  if (n.includes("redline")) return "redline";
  if (n.includes("bidmaster") || n.includes("bid master")) return "bidmaster";
  if (n.includes("revisit")) return "revisit";
  if (n.includes("print")) return "print";
  if (mimeType?.startsWith("image/") || /\.(jpe?g|png|heic|webp|gif)$/i.test(n))
    return "photo";
  if (n.endsWith(".pdf")) return "print";
  return "other";
}

/* ------------------------------------------------------------------ */
/*  Smartsheet attachments  (satellite source of truth in V3)         */
/* ------------------------------------------------------------------ */

/**
 * List all attachments on a Smartsheet row — these become the planet's
 * satellites. Server uses SMARTSHEET_TOKEN; no Google OAuth required.
 */
export async function listJobAttachments(
  rowId: string,
): Promise<{ ok: true; satellites: Satellite[] } | { ok: false; message: string }> {
  try {
    const r = await fetch(
      `/api/jobs-attachments?rowId=${encodeURIComponent(rowId)}`,
    );
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.ok) {
      return {
        ok: false,
        message: data?.message ?? `Attachment fetch failed (${r.status})`,
      };
    }
    type Raw = {
      id: string;
      name: string;
      mimeType: string;
      sizeInKb?: number;
      attachmentType?: string;
      attachmentSubType?: string;
      createdAt?: string;
    };
    const satellites: Satellite[] = (data.attachments as Raw[]).map((a) => ({
      id: a.id,
      name: a.name,
      mimeType: a.mimeType ?? "",
      sizeInKb: a.sizeInKb,
      attachmentType: a.attachmentType,
      attachmentSubType: a.attachmentSubType,
      createdAt: a.createdAt,
      category: categorizeSatellite(a.name, a.mimeType),
    }));
    return { ok: true, satellites };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error.",
    };
  }
}

/**
 * Mint a fresh download URL for one Smartsheet attachment. Smartsheet
 * temp URLs expire ~2 minutes after creation, so we always request a new
 * one right before opening the file.
 */
export async function getAttachmentUrl(
  attachmentId: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  try {
    const r = await fetch(
      `/api/jobs-attachments?attachmentId=${encodeURIComponent(attachmentId)}`,
    );
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.ok || !data.url) {
      return {
        ok: false,
        message: data?.message ?? `Could not resolve URL (${r.status})`,
      };
    }
    return { ok: true, url: data.url as string };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error.",
    };
  }
}

/**
 * Upload a file as a row attachment. Sends the raw bytes (server forwards
 * to Smartsheet). Returns the new satellite for optimistic UI insert.
 */
export async function uploadJobAttachment(
  rowId: string,
  file: File,
): Promise<{ ok: true; satellite: Satellite } | { ok: false; message: string }> {
  try {
    const r = await fetch(
      `/api/jobs-attachments?rowId=${encodeURIComponent(rowId)}&filename=${encodeURIComponent(file.name)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      },
    );
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.ok || !data.attachment) {
      return {
        ok: false,
        message: data?.message ?? `Upload failed (${r.status})`,
      };
    }
    const a = data.attachment as {
      id: string;
      name: string;
      mimeType: string;
      sizeInKb?: number;
      attachmentType?: string;
      attachmentSubType?: string;
      createdAt?: string;
    };
    const satellite: Satellite = {
      id: a.id,
      name: a.name,
      mimeType: a.mimeType,
      sizeInKb: a.sizeInKb,
      attachmentType: a.attachmentType,
      attachmentSubType: a.attachmentSubType,
      createdAt: a.createdAt,
      category: categorizeSatellite(a.name, a.mimeType),
    };
    return { ok: true, satellite };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error.",
    };
  }
}

/**
 * Delete one attachment by id.
 */
export async function deleteJobAttachment(
  attachmentId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const r = await fetch(
      `/api/jobs-attachments?attachmentId=${encodeURIComponent(attachmentId)}`,
      { method: "DELETE" },
    );
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.ok) {
      return {
        ok: false,
        message: data?.message ?? `Delete failed (${r.status})`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Network error.",
    };
  }
}

export interface LuminaMessage {
  role: "user" | "model";
  text: string;
}

export interface LuminaMemory {
  facts?: string[];
  summary?: string;
}

export async function sendToLumina(
  messages: LuminaMessage[],
  context: Record<string, unknown>,
  memory?: LuminaMemory,
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  try {
    const r = await fetch("/api/lumina", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, context, memory }),
    });
    const data = await r.json();
    if (!r.ok) {
      return { ok: false, message: data?.message ?? "Lumina is offline." };
    }
    return { ok: true, text: data.text as string };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Channel disrupted.",
    };
  }
}

// ----- Calendar -----

export interface CalEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  link: string;
}

export async function listCalendarEvents(
  token: string,
  days = 14,
): Promise<CalEvent[]> {
  const r = await fetch("/api/calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "list", days, maxResults: 30 }),
  });
  if (!r.ok) return [];
  const { events } = (await r.json()) as { events: CalEvent[] };
  return events;
}

export async function createCalendarEvent(
  token: string,
  ev: {
    summary: string;
    startISO: string;
    endISO: string;
    description?: string;
    location?: string;
    timeZone?: string;
  },
): Promise<{ ok: boolean; link?: string; id?: string; message?: string }> {
  const r = await fetch("/api/calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "create", ...ev }),
  });
  const data = await r.json();
  if (!r.ok) return { ok: false, message: data?.message ?? "Could not create event." };
  return { ok: true, link: data.link, id: data.id };
}
