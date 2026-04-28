import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * PUT /api/jobs-update
 *
 * Updates editable cells on a Smartsheet row.
 *
 * Currently supports:
 *   - notes -> "NSC Project Notes" column
 *
 * Body:  { rowId: string, notes?: string }
 * Auth:  server-side SMARTSHEET_TOKEN (never exposed to browser)
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

  const { rowId, notes } = (req.body ?? {}) as { rowId?: string; notes?: string };
  if (!rowId) {
    res.status(400).json({ ok: false, message: "rowId is required" });
    return;
  }
  if (typeof notes !== "string") {
    res.status(400).json({ ok: false, message: "notes (string) is required" });
    return;
  }

  try {
    const colId = await resolveColumnId(token, "NSC Project Notes");
    if (!colId) {
      res.status(502).json({
        ok: false,
        message: "Could not resolve 'NSC Project Notes' column on the sheet.",
      });
      return;
    }

    // Smartsheet update-rows: PUT /sheets/{id}/rows with array of row updates.
    // strict:false lets us pass an empty string to clear the cell.
    const updateRes = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${SHEET_ID}/rows`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            id: Number(rowId),
            cells: [
              {
                columnId: colId,
                value: notes,
                strict: false,
              },
            ],
          },
        ]),
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
