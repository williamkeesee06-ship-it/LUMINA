import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Gmail search proxy. The user's OAuth access token is sent in the
 * Authorization header; we forward it to Gmail. The token never persists
 * server-side. This proxy exists so the browser can avoid CORS pitfalls
 * and so we can shape responses consistently.
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
  let body: { query: string; maxResults?: number };
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "bad_request" });
    return;
  }
  const q = body?.query?.trim();
  if (!q) {
    res.status(400).json({ error: "missing_query" });
    return;
  }
  const max = Math.min(Math.max(body.maxResults ?? 8, 1), 25);

  try {
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${max}`;
    const list = await fetch(listUrl, { headers: { Authorization: auth } });
    if (!list.ok) {
      res.status(list.status).json({ error: "gmail_list_failed", status: list.status });
      return;
    }
    const listJson = (await list.json()) as { messages?: { id: string; threadId: string }[] };
    const messages = listJson.messages ?? [];
    if (messages.length === 0) {
      res.status(200).json({ messages: [] });
      return;
    }
    // Fetch metadata for each message in parallel.
    const detailed = await Promise.all(
      messages.map(async (m) => {
        const u = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`;
        const r = await fetch(u, { headers: { Authorization: auth } });
        if (!r.ok) return null;
        const j = (await r.json()) as {
          id: string;
          threadId: string;
          snippet: string;
          labelIds?: string[];
          payload?: { headers?: { name: string; value: string }[] };
        };
        const headers = j.payload?.headers ?? [];
        const h = (n: string) => headers.find((x) => x.name === n)?.value ?? "";
        return {
          id: j.id,
          threadId: j.threadId,
          subject: h("Subject"),
          from: h("From"),
          date: h("Date"),
          snippet: j.snippet ?? "",
          unread: (j.labelIds ?? []).includes("UNREAD"),
        };
      }),
    );
    res.status(200).json({ messages: detailed.filter(Boolean) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: "gmail_proxy_failed", message });
  }
}
