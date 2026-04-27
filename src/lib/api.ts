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

export async function searchGmail(token: string, query: string): Promise<Satellite[]> {
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

export async function listDrive(
  token: string,
  workOrder: string,
): Promise<{ folderId: string | null; moons: Moon[] }> {
  const r = await fetch("/api/drive-list", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ workOrder }),
  });
  if (!r.ok) return { folderId: null, moons: [] };
  const data = (await r.json()) as {
    folder: { id: string; name: string } | null;
    files: { id: string; name: string; mimeType: string; webViewLink?: string; modifiedTime?: string }[];
  };
  if (!data.folder) return { folderId: null, moons: [] };
  const moons: Moon[] = data.files.map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    webViewLink: f.webViewLink,
    modifiedTime: f.modifiedTime,
    category: categorizeMoon(f.name),
  }));
  return { folderId: data.folder.id, moons };
}

function categorizeMoon(name: string): Moon["category"] {
  const n = name.toLowerCase();
  if (n.includes("permit")) return "permit";
  if (n.includes("redline")) return "redline";
  if (n.includes("bidmaster") || n.includes("bid master")) return "bidmaster";
  if (n.includes("revisit")) return "revisit";
  if (n.includes("print") || n.includes(".pdf")) return "print";
  return "other";
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
