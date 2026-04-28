import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * /api/jobs-attachments
 *
 * Single endpoint for all Smartsheet row-attachment ops. Method + query
 * decide what happens:
 *
 *   GET  ?rowId=<n>                         -> list attachments on a row
 *   GET  ?attachmentId=<n>                  -> resolve a fresh download URL
 *                                              (Smartsheet URLs expire ~2min,
 *                                              so we mint just-in-time)
 *   GET  ?openId=<n>                        -> server-side proxy that streams
 *                                              the file back inline so the
 *                                              browser previews it instead of
 *                                              forcing a download. Smartsheet's
 *                                              signed URL ships with
 *                                              Content-Disposition: attachment
 *                                              which we strip here.
 *   POST ?rowId=<n>&filename=<x>            -> upload a file to a row.
 *                                              Body is the raw file bytes.
 *                                              Content-Type header is the
 *                                              file's MIME type.
 *   DELETE ?attachmentId=<n>                -> delete an attachment.
 *
 * Auth: SMARTSHEET_TOKEN env (server-only).
 *
 * Why one endpoint instead of four files: keeps Vercel function count
 * down, and all four ops share identical token + sheet-id boilerplate.
 */

const SHEET_ID = "1833739362822020";

interface SmartsheetAttachment {
  id: number;
  name: string;
  mimeType?: string;
  sizeInKb?: number;
  attachmentType?: string;     // "FILE" | "GOOGLE_DRIVE" | "LINK" | etc.
  attachmentSubType?: string;  // e.g. "PDF", "DOCUMENT"
  url?: string;                // only present on GET-by-id (temp signed URL)
  urlExpiresInMillis?: number;
  createdAt?: string;
  createdBy?: { name?: string; email?: string };
  parentId?: number;           // the row id we attached to
  parentType?: string;         // "ROW" | "SHEET" | "COMMENT" | "DISCUSSION"
}

interface SmartsheetAttachmentList {
  data: SmartsheetAttachment[];
}

// Disable body parsing so POST bodies stream through as raw bytes for the
// Smartsheet upload. Without this Vercel JSON-parses the body and we lose
// the binary payload.
export const config = {
  api: {
    bodyParser: false,
    sizeLimit: "25mb",
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) {
    res
      .status(500)
      .json({ ok: false, message: "Smartsheet token not configured on server." });
    return;
  }

  try {
    if (req.method === "GET") return await handleGet(req, res, token);
    if (req.method === "POST") return await handlePost(req, res, token);
    if (req.method === "DELETE") return await handleDelete(req, res, token);
    res.status(405).json({ ok: false, message: "Method not allowed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, message });
  }
}

/* ------------------------------------------------------------------ */
/*  GET                                                                */
/* ------------------------------------------------------------------ */

async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  token: string,
) {
  const { rowId, attachmentId, openId } = req.query as {
    rowId?: string;
    attachmentId?: string;
    openId?: string;
  };

  // Mode C: stream the file back inline so the browser previews instead
  // of downloading. We resolve the temp URL on the server, fetch the
  // bytes, and re-emit with Content-Disposition: inline + correct type.
  if (openId) {
    const meta = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${SHEET_ID}/attachments/${encodeURIComponent(openId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!meta.ok) {
      res.status(502).json({
        ok: false,
        message: `Smartsheet attachment lookup failed (${meta.status})`,
      });
      return;
    }
    const a = (await meta.json()) as SmartsheetAttachment;
    if (!a.url) {
      res.status(502).json({ ok: false, message: "No download URL on attachment" });
      return;
    }
    const fileResp = await fetch(a.url);
    if (!fileResp.ok || !fileResp.body) {
      res.status(502).json({
        ok: false,
        message: `Smartsheet file fetch failed (${fileResp.status})`,
      });
      return;
    }
    const mime = a.mimeType || guessMimeFromName(a.name) || "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${sanitizeFilename(a.name || "file")}"`,
    );
    res.setHeader("Cache-Control", "private, max-age=300");
    const len = fileResp.headers.get("content-length");
    if (len) res.setHeader("Content-Length", len);
    // Pipe Web ReadableStream into Node response.
    const reader = fileResp.body.getReader();
    res.status(200);
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    res.end();
    return;
  }

  // Mode A: fresh download URL for one attachment.
  if (attachmentId) {
    const r = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${SHEET_ID}/attachments/${encodeURIComponent(attachmentId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!r.ok) {
      res.status(502).json({
        ok: false,
        message: `Smartsheet attachment lookup failed (${r.status})`,
      });
      return;
    }
    const a = (await r.json()) as SmartsheetAttachment;
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      ok: true,
      url: a.url ?? null,
      expiresInMillis: a.urlExpiresInMillis ?? null,
      name: a.name,
      mimeType: a.mimeType,
    });
    return;
  }

  // Mode B: list all attachments on a row.
  if (!rowId) {
    res.status(400).json({ ok: false, message: "rowId or attachmentId required" });
    return;
  }
  const r = await fetch(
    `https://api.smartsheet.com/2.0/sheets/${SHEET_ID}/rows/${encodeURIComponent(rowId)}/attachments?pageSize=200`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) {
    res.status(502).json({
      ok: false,
      message: `Smartsheet row attachments fetch failed (${r.status})`,
    });
    return;
  }
  const list = (await r.json()) as SmartsheetAttachmentList;
  // Strip noise; return only what the client actually consumes.
  const items = (list.data ?? []).map((a) => ({
    id: String(a.id),
    name: a.name,
    mimeType: a.mimeType ?? "",
    sizeInKb: a.sizeInKb ?? 0,
    attachmentType: a.attachmentType ?? "FILE",
    attachmentSubType: a.attachmentSubType ?? "",
    createdAt: a.createdAt ?? "",
  }));
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true, attachments: items });
}

/* ------------------------------------------------------------------ */
/*  POST — upload                                                      */
/* ------------------------------------------------------------------ */

async function handlePost(
  req: VercelRequest,
  res: VercelResponse,
  token: string,
) {
  const { rowId, filename } = req.query as { rowId?: string; filename?: string };
  if (!rowId) {
    res.status(400).json({ ok: false, message: "rowId required" });
    return;
  }
  if (!filename) {
    res.status(400).json({ ok: false, message: "filename required" });
    return;
  }

  // Read raw body into a Buffer. With bodyParser off, req is a Node stream.
  const chunks: Buffer[] = [];
  for await (const chunk of req as unknown as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const body = Buffer.concat(chunks);
  if (body.length === 0) {
    res.status(400).json({ ok: false, message: "Empty file body" });
    return;
  }

  const contentType =
    (req.headers["content-type"] as string | undefined) || "application/octet-stream";

  // Smartsheet "Attach a file (simple upload)" — POST raw bytes with
  // Content-Disposition naming the file. Critically, Content-Length must
  // match the byte count Smartsheet receives.
  // https://smartsheet.redoc.ly/tag/attachments
  const r = await fetch(
    `https://api.smartsheet.com/2.0/sheets/${SHEET_ID}/rows/${encodeURIComponent(rowId)}/attachments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${sanitizeFilename(filename)}"`,
        "Content-Length": String(body.length),
      },
      // Cast: undici types don't love Buffer here, but it works at runtime.
      body: body as unknown as BodyInit,
    },
  );

  if (!r.ok) {
    const detail = await r.text();
    res.status(502).json({
      ok: false,
      message: `Smartsheet upload failed (${r.status})`,
      detail,
    });
    return;
  }
  const data = (await r.json()) as { result?: SmartsheetAttachment };
  const a = data.result;
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    attachment: a
      ? {
          id: String(a.id),
          name: a.name,
          mimeType: a.mimeType ?? contentType,
          sizeInKb: a.sizeInKb ?? Math.ceil(body.length / 1024),
          attachmentType: a.attachmentType ?? "FILE",
          attachmentSubType: a.attachmentSubType ?? "",
          createdAt: a.createdAt ?? new Date().toISOString(),
        }
      : null,
  });
}

/* ------------------------------------------------------------------ */
/*  DELETE                                                             */
/* ------------------------------------------------------------------ */

async function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  token: string,
) {
  const { attachmentId } = req.query as { attachmentId?: string };
  if (!attachmentId) {
    res.status(400).json({ ok: false, message: "attachmentId required" });
    return;
  }
  const r = await fetch(
    `https://api.smartsheet.com/2.0/sheets/${SHEET_ID}/attachments/${encodeURIComponent(attachmentId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!r.ok) {
    res.status(502).json({
      ok: false,
      message: `Smartsheet delete failed (${r.status})`,
    });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true });
}

/* ------------------------------------------------------------------ */

function sanitizeFilename(name: string): string {
  // Strip quotes, control chars, and path separators. Keep it simple — we
  // don't want a header-injection vector via Content-Disposition.
  return name.replace(/["\r\n\\/]/g, "_").slice(0, 200) || "upload.bin";
}

function guessMimeFromName(name: string | undefined): string {
  if (!name) return "";
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    pdf: "application/pdf",
    mp4: "video/mp4",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    svg: "image/svg+xml",
  };
  return map[ext] || "";
}
