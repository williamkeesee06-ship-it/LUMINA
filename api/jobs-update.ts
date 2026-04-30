import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * PUT/POST /api/jobs-update
 *
 * Updates editable cells on a Smartsheet row. Generalized so the focus-mode
 * job card can patch any editable field (or several) in a single round-trip.
 *
 * Request body:
 *   { rowId: string, fields: Record<EditableFieldKey, string | null> }
 *
 *   - Each value is the desired cell text. `null` clears the cell.
 *   - Date fields must be sent as `YYYY-MM-DD` (Smartsheet's wire format
 *     for DATE columns). The client converts MM/DD/YY → YYYY-MM-DD.
 *
 * Auth: server-side SMARTSHEET_TOKEN (never exposed to browser).
 *
 * Returns: { ok: true, updated: string[] } on success
 *          { ok: false, message } on failure
 *
 * Notes on column resolution:
 *   We resolve column IDs by title at request time. Smartsheet column IDs
 *   are stable per-sheet but we don't hard-code them here so a sheet
 *   rename or column reorder doesn't silently break writes.
 */

const SHEET_ID = "1833739362822020";

/**
 * Whitelist of fields the client is allowed to patch, mapped to the
 * Smartsheet column title and a "kind" hint that controls how we send
 * the value to Smartsheet. Anything not in this list is rejected.
 *
 * `kind`:
 *   - "text"     -> string passthrough
 *   - "picklist" -> strict:true on the cell so Smartsheet rejects values
 *                   that aren't in the column's defined options
 *   - "date"     -> objectValue: { objectType: "DATE", value: YYYY-MM-DD }
 *   - "currency" -> string passthrough; Smartsheet stores as text
 */
const EDITABLE_FIELDS: Record<
  string,
  { title: string; kind: "text" | "picklist" | "date" | "currency" }
> = {
  notes:           { title: "NSC Project Notes",      kind: "text" },
  splicingNotes:   { title: "Splicing Notes",         kind: "text" },
  secondaryStatus: { title: "Secondary Job Status",   kind: "picklist" },
  jobStatus:       { title: "Job Status",             kind: "text" },
  address:         { title: "Address",                kind: "text" },
  city:            { title: "City",                   kind: "text" },
  zip:             { title: "Zip Code",               kind: "text" },
  scheduleDate:    { title: "Schedule Date",          kind: "date" },
  endDate:         { title: "End Date",               kind: "date" },
  dueDate:         { title: "Due Date",               kind: "date" },
  crew:            { title: "Construction Crew/Forman", kind: "text" },
  permitNumber:    { title: "Permit #",               kind: "text" },
  workType:        { title: "Work Type",              kind: "text" },
  base:            { title: "Construction Base",      kind: "text" },
  bidValue:        { title: "BidMaster Value",        kind: "currency" },
};

interface SmartsheetColumn {
  id: number;
  title: string;
}

let columnCache: { byTitle: Map<string, number>; ts: number } | null = null;
const COLUMN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getColumnsByTitle(token: string): Promise<Map<string, number>> {
  if (columnCache && Date.now() - columnCache.ts < COLUMN_CACHE_TTL_MS) {
    return columnCache.byTitle;
  }
  const r = await fetch(
    `https://api.smartsheet.com/2.0/sheets/${SHEET_ID}/columns?pageSize=200`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) throw new Error(`Smartsheet columns fetch failed: ${r.status}`);
  const data = (await r.json()) as { data: SmartsheetColumn[] };
  const byTitle = new Map<string, number>();
  for (const c of data.data) byTitle.set(c.title, c.id);
  columnCache = { byTitle, ts: Date.now() };
  return byTitle;
}

interface CellWrite {
  columnId: number;
  value?: string | number | null;
  strict?: boolean;
  objectValue?: { objectType: "DATE"; value: string };
}

/** Backwards-compat: support legacy { notes, secondaryStatus } shape too. */
function normalizeBody(
  raw: Record<string, unknown>,
): { rowId?: string; fields: Record<string, string | null> } {
  const rowId = typeof raw.rowId === "string" ? raw.rowId : undefined;
  // New shape: { rowId, fields: {...} }
  if (raw.fields && typeof raw.fields === "object") {
    const fields = raw.fields as Record<string, unknown>;
    const out: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v === null) out[k] = null;
      else if (typeof v === "string") out[k] = v;
    }
    return { rowId, fields: out };
  }
  // Legacy shape: top-level notes / secondaryStatus
  const out: Record<string, string | null> = {};
  if (typeof raw.notes === "string") out.notes = raw.notes;
  if (typeof raw.secondaryStatus === "string")
    out.secondaryStatus = raw.secondaryStatus;
  return { rowId, fields: out };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PUT" && req.method !== "POST") {
    res.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }
  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) {
    res
      .status(500)
      .json({ ok: false, message: "Smartsheet token not configured on server." });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const { rowId, fields } = normalizeBody(body);
  if (!rowId) {
    res.status(400).json({ ok: false, message: "rowId is required" });
    return;
  }
  const fieldKeys = Object.keys(fields);
  if (fieldKeys.length === 0) {
    res.status(400).json({ ok: false, message: "No fields to update" });
    return;
  }

  // Validate all keys against the whitelist before doing any work.
  for (const k of fieldKeys) {
    if (!EDITABLE_FIELDS[k]) {
      res.status(400).json({ ok: false, message: `Field not editable: ${k}` });
      return;
    }
  }

  try {
    const columns = await getColumnsByTitle(token);
    const cells: CellWrite[] = [];
    const updated: string[] = [];

    for (const [key, value] of Object.entries(fields)) {
      const meta = EDITABLE_FIELDS[key];
      const colId = columns.get(meta.title);
      if (!colId) {
        res.status(502).json({
          ok: false,
          message: `Could not resolve "${meta.title}" column on the sheet.`,
        });
        return;
      }
      // Clearing a cell: send empty string for text/picklist/currency,
      // or omit objectValue for dates (Smartsheet treats empty value as clear).
      if (value === null || value === "") {
        cells.push({ columnId: colId, value: "" });
        updated.push(key);
        continue;
      }
      switch (meta.kind) {
        case "picklist":
          // strict:true so Smartsheet rejects non-picklist values rather
          // than silently writing free text into a constrained column.
          cells.push({ columnId: colId, value, strict: true });
          break;
        case "date":
          // Validate YYYY-MM-DD shape before sending; Smartsheet will reject
          // anything else with a generic 400.
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            res.status(400).json({
              ok: false,
              message: `Invalid date for ${key} — expected YYYY-MM-DD, got "${value}"`,
            });
            return;
          }
          cells.push({
            columnId: colId,
            objectValue: { objectType: "DATE", value },
          });
          break;
        case "currency":
        case "text":
        default:
          cells.push({ columnId: colId, value });
          break;
      }
      updated.push(key);
    }

    const updateRes = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${SHEET_ID}/rows`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{ id: Number(rowId), cells }]),
      },
    );
    if (!updateRes.ok) {
      const errBody = await updateRes.text();
      res.status(502).json({
        ok: false,
        message: `Smartsheet update failed (${updateRes.status})`,
        detail: errBody.slice(0, 500),
      });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, message });
  }
}
