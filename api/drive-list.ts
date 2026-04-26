import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Drive search/list proxy. Browser sends OAuth token in Authorization header.
 * We search for a folder matching the work order, then list its children.
 * If no folder matches, we return { folder: null, files: [] } so the client
 * can render the bible-mandated empty state truthfully.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const auth = req.headers["authorization"];
  if (!auth || Array.isArray(auth)) {
    res.status(401).json({ error: "missing_token" });
    return;
  }
  let body: { workOrder: string };
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "bad_request" });
    return;
  }
  const wo = body?.workOrder?.trim();
  if (!wo) {
    res.status(400).json({ error: "missing_work_order" });
    return;
  }

  try {
    // Search for a folder whose name contains the work order.
    const search = `mimeType='application/vnd.google-apps.folder' and name contains '${wo.replace(/'/g, "\\'")}' and trashed=false`;
    const folderUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(search)}&fields=files(id,name)&pageSize=5`;
    const fr = await fetch(folderUrl, { headers: { Authorization: auth } });
    if (!fr.ok) {
      res.status(fr.status).json({ error: "drive_search_failed", status: fr.status });
      return;
    }
    const fj = (await fr.json()) as { files?: { id: string; name: string }[] };
    const folder = fj.files?.[0];
    if (!folder) {
      res.status(200).json({ folder: null, files: [] });
      return;
    }
    // List children
    const childQ = `'${folder.id}' in parents and trashed=false`;
    const lUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(childQ)}&fields=files(id,name,mimeType,webViewLink,modifiedTime)&pageSize=200&orderBy=modifiedTime desc`;
    const lr = await fetch(lUrl, { headers: { Authorization: auth } });
    if (!lr.ok) {
      res.status(lr.status).json({ error: "drive_list_failed", status: lr.status });
      return;
    }
    const lj = (await lr.json()) as {
      files?: { id: string; name: string; mimeType: string; webViewLink?: string; modifiedTime?: string }[];
    };
    res.status(200).json({ folder, files: lj.files ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: "drive_proxy_failed", message });
  }
}
