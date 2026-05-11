import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Gmail list proxy. Lists messages under a Gmail label (default "North Sky"
 * — the user's forwarded work-mail label) with optional Gmail-search query
 * appended. Returns one batched metadata fetch per result so the client
 * can paint message rows without a follow-up round-trip.
 *
 * Token policy: the user's OAuth access token rides in the Authorization
 * header. We never persist it server-side. New scopes (gmail.modify /
 * gmail.send) are added on the client; this proxy works with read-only too.
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

  let body: {
    label?: string;
    query?: string;
    unreadOnly?: boolean;
    pageToken?: string;
    limit?: number;
  };
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "bad_request" });
    return;
  }

  const label = (body.label ?? "North Sky").trim();
  const userQuery = (body.query ?? "").trim();
  const unreadOnly = Boolean(body.unreadOnly);
  const limit = Math.min(Math.max(body.limit ?? 50, 1), 100);

  const qParts: string[] = [];
  if (label) qParts.push(`label:"${label}"`);
  if (unreadOnly) qParts.push("is:unread");
  if (userQuery) qParts.push(userQuery);
  const q = qParts.join(" ");

  try {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("maxResults", String(limit));
    if (body.pageToken) params.set("pageToken", body.pageToken);
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`;
    const list = await fetch(listUrl, { headers: { Authorization: auth } });
    if (!list.ok) {
      const text = await list.text().catch(() => "");
      res.status(list.status).json({
        error: "gmail_list_failed",
        status: list.status,
        detail: text.slice(0, 400),
      });
      return;
    }
    const listJson = (await list.json()) as {
      messages?: { id: string; threadId: string }[];
      nextPageToken?: string;
    };
    const messages = listJson.messages ?? [];
    if (messages.length === 0) {
      res.status(200).json({ messages: [], nextPageToken: listJson.nextPageToken });
      return;
    }

    const detailed = await Promise.all(
      messages.map(async (m) => {
        const u = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date&metadataHeaders=Message-Id`;
        const r = await fetch(u, { headers: { Authorization: auth } });
        if (!r.ok) return null;
        const j = (await r.json()) as {
          id: string;
          threadId: string;
          snippet?: string;
          labelIds?: string[];
          internalDate?: string;
          payload?: { headers?: { name: string; value: string }[] };
        };
        const headers = j.payload?.headers ?? [];
        const h = (n: string) =>
          headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
        const labelIds = j.labelIds ?? [];
        return {
          id: j.id,
          threadId: j.threadId,
          subject: h("Subject"),
          from: h("From"),
          to: h("To"),
          cc: h("Cc"),
          date: h("Date"),
          messageId: h("Message-Id"),
          snippet: j.snippet ?? "",
          internalDate: j.internalDate ?? "",
          unread: labelIds.includes("UNREAD"),
          labelIds,
        };
      }),
    );
    res.status(200).json({
      messages: detailed.filter(Boolean),
      nextPageToken: listJson.nextPageToken,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: "gmail_proxy_failed", message });
  }
}
