import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * PUT /api/jobs-update
 *
 * Updates editable cells on a Smartsheet row.
 *
 * Currently supports:
 *   - notes            -> "NSC Project Notes" column
 *   - secondaryStatus  -> "Secondary Job Status" column (PICKLIST)
 *
 * Body:  { rowId: string, notes?: string, secondaryStatus?: string }
 * Auth:  server-side SMARTSHEET_TOKEN (never exposed to browser)
 *
 * Either notes or secondaryStatus (or both) must be provided. Each updates
 * its own cell in the same row in a single PUT — Smartsheet supports many
 * cells per row update.
 *
 * Returns: { ok: true } on success, or { ok: false, message } on failure.
 *
 * NOTE: We resolve the column ID by title at request time. Smartsheet column
 * IDs are stable per-sheet but we don't hard-code them here so a sheet rename
 * or column reorder doesn't silently break writes.
 */

const SHEET_ID = "1833739362822020";

interface SmartsheetColumn {
  id: number;
  title: string;
}

async function resolveColumnId(token: string, title: string): Promise<number | null> {
  // /columns lists all columns with id + title in one shot — much cheaper
  // than pulling the whole sheet just to grab two columns.
  const r = await fetch(`https://api.smartsheet.com/2.0/sheets/${SHEET_ID}/columns?pageSize=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const data = (await r.json()) as { data: SmartsheetColumn[] };
  const match = data.data.find((c) => c.title === title);
  return match ? match.id : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PUT" && req.method !== "POST") {
    res.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }
  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) {
    res.status(500).json({ ok: false, message: "Smartsheet token not configured on server." });
    return;
  }

  const { rowId, notes, secondaryStatus } = (req.body ?? {}) as {
    rowId?: string;
    notes?: string;
    secondaryStatus?: string;
  };
  if (!rowId) {
    res.status(400).json({ ok: false, message: "rowId is required" });
    return;
  }
  const hasNotes = typeof notes === "string";
  const hasStatus = typeof secondaryStatus === "string";
  if (!hasNotes && !hasStatus) {
    res
      .status(400)
      .json({ ok: false, message: "Provide notes and/or secondaryStatus" });
    return;
  }

  try {
    // Resolve the column IDs we need in parallel — only the ones we'll write.
    const [notesColId, statusColId] = await Promise.all([
      hasNotes ? resolveColumnId(token, "NSC Project Notes") : Promise.resolve(null),
      hasStatus ? resolveColumnId(token, "Secondary Job Status") : Promise.resolve(null),
    ]);

    if (hasNotes && !notesColId) {
      res.status(502).json({
        ok: false,
        message: "Could not resolve 'NSC Project Notes' column on the sheet.",
      });
      return;
    }
    if (hasStatus && !statusColId) {
      res.status(502).json({
        ok: false,
        message: "Could not resolve 'Secondary Job Status' column on the sheet.",
      });
      return;
    }

    const cells: Array<{ columnId: number; value: string; strict: boolean }> = [];
    if (hasNotes && notesColId) {
      cells.push({ columnId: notesColId, value: notes as string, strict: false });
    }
    if (hasStatus && statusColId) {
      // strict:true on the picklist — we want Smartsheet to reject unknown
      // values rather than silently writing free text into a constrained col.
      cells.push({
        columnId: statusColId,
        value: secondaryStatus as string,
        strict: true,
      });
    }

    // Smartsheet update-rows: PUT /sheets/{id}/rows with array of row updates.
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
        detail: errBody,
      });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, message });
  }
}
