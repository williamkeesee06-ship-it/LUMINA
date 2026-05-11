import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Consolidated Gmail proxy. Dispatches on `action` (query param or body
 * field) → "list" | "search" | "thread" | "send". Previously these were
 * four separate /api/gmail-* serverless functions; folded together to stay
 * under Vercel Hobby's 12-function-per-deploy cap.
 *
 * Token policy: the user's OAuth access token rides in the Authorization
 * header and is forwarded to Gmail. Never persisted server-side.
 */

type Action = "list" | "search" | "thread" | "send";

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
}

interface GmailThreadResp {
  id: string;
  messages?: GmailMessage[];
}

interface SendRequest {
  threadId?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  /** Plain-text body. If omitted, `body` is used as text/plain too. */
  plainBody?: string;
  inReplyTo?: string;
  references?: string[];
  /** Optional explicit From — if omitted Gmail uses the authenticated user. */
  from?: string;
}

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

  let body: Record<string, unknown>;
  try {
    body =
      typeof req.body === "string"
        ? (JSON.parse(req.body) as Record<string, unknown>)
        : ((req.body ?? {}) as Record<string, unknown>);
  } catch {
    res.status(400).json({ error: "bad_request" });
    return;
  }

  const queryAction =
    typeof req.query?.action === "string" ? req.query.action : undefined;
  const bodyAction = typeof body.action === "string" ? body.action : undefined;
  const action = (queryAction ?? bodyAction) as Action | undefined;

  switch (action) {
    case "list":
      return handleList(auth, body, res);
    case "search":
      return handleSearch(auth, body, res);
    case "thread":
      return handleThread(auth, body, res);
    case "send":
      return handleSend(auth, body, res);
    default:
      res.status(400).json({ error: "missing_or_invalid_action" });
      return;
  }
}

// ---------------------------------------------------------------------------
// list — Gmail label listing with batched metadata fetch. Default label is
// "North Sky" (the user's forwarded work-mail label).
// ---------------------------------------------------------------------------
async function handleList(
  auth: string,
  body: Record<string, unknown>,
  res: VercelResponse,
) {
  const label = ((body.label as string | undefined) ?? "North Sky").trim();
  const userQuery = ((body.query as string | undefined) ?? "").trim();
  const unreadOnly = Boolean(body.unreadOnly);
  const limitInput = (body.limit as number | undefined) ?? 50;
  const limit = Math.min(Math.max(limitInput, 1), 100);
  const pageToken = body.pageToken as string | undefined;

  const qParts: string[] = [];
  if (label) qParts.push(`label:"${label}"`);
  if (unreadOnly) qParts.push("is:unread");
  if (userQuery) qParts.push(userQuery);
  const q = qParts.join(" ");

  try {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("maxResults", String(limit));
    if (pageToken) params.set("pageToken", pageToken);
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

// ---------------------------------------------------------------------------
// search — free-text Gmail query, capped at 25 results.
// ---------------------------------------------------------------------------
async function handleSearch(
  auth: string,
  body: Record<string, unknown>,
  res: VercelResponse,
) {
  const q = ((body.query as string | undefined) ?? "").trim();
  if (!q) {
    res.status(400).json({ error: "missing_query" });
    return;
  }
  const maxInput = (body.maxResults as number | undefined) ?? 8;
  const max = Math.min(Math.max(maxInput, 1), 25);

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

// ---------------------------------------------------------------------------
// thread — full thread with sanitized HTML + plain-text fallback per message.
// ---------------------------------------------------------------------------
async function handleThread(
  auth: string,
  body: Record<string, unknown>,
  res: VercelResponse,
) {
  const threadId = ((body.threadId as string | undefined) ?? "").trim();
  if (!threadId) {
    res.status(400).json({ error: "missing_threadId" });
    return;
  }

  try {
    const u = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(
      threadId,
    )}?format=full`;
    const r = await fetch(u, { headers: { Authorization: auth } });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      res.status(r.status).json({
        error: "gmail_thread_failed",
        status: r.status,
        detail: text.slice(0, 400),
      });
      return;
    }
    const data = (await r.json()) as GmailThreadResp;
    const messages = (data.messages ?? []).map(parseMessage);
    res.status(200).json({ threadId: data.id, messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: "gmail_proxy_failed", message });
  }
}

function parseMessage(m: GmailMessage) {
  const headers = m.payload?.headers ?? [];
  const h = (n: string) =>
    headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";

  const { plain, html } = walkParts(m.payload);
  return {
    id: m.id,
    threadId: m.threadId,
    from: h("From"),
    to: h("To"),
    cc: h("Cc"),
    bcc: h("Bcc"),
    replyTo: h("Reply-To"),
    date: h("Date"),
    subject: h("Subject"),
    messageId: h("Message-Id"),
    references: h("References"),
    inReplyTo: h("In-Reply-To"),
    plainBody: plain,
    htmlBody: html ? sanitizeHtml(html) : "",
    snippet: m.snippet ?? "",
    internalDate: m.internalDate ?? "",
    unread: (m.labelIds ?? []).includes("UNREAD"),
    labelIds: m.labelIds ?? [],
  };
}

function walkParts(part: GmailPart | undefined): { plain: string; html: string } {
  if (!part) return { plain: "", html: "" };
  let plain = "";
  let html = "";

  const visit = (p: GmailPart) => {
    const mt = (p.mimeType ?? "").toLowerCase();
    if (mt === "text/plain" && p.body?.data) {
      plain += decodeBody(p.body.data);
    } else if (mt === "text/html" && p.body?.data) {
      html += decodeBody(p.body.data);
    }
    if (p.parts) for (const c of p.parts) visit(c);
  };
  visit(part);
  return { plain, html };
}

function decodeBody(b64url: string): string {
  try {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(b64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

/**
 *  Hand-rolled HTML sanitizer. Strips dangerous tags and attributes while
 *  preserving the structure that makes an email readable. Pulling in
 *  sanitize-html would add ~300 KB of deps for marginal benefit — this
 *  allow-list is sufficient for rendering trusted-but-not-trusted-enough
 *  email content from a label the user controls.
 *
 *  Rules:
 *    - drop entire <script>, <style>, <iframe>, <object>, <embed>, <link>,
 *      <meta>, <form>, <input>, <button>, <svg>, <math> blocks (incl. contents)
 *    - allow common layout/inline tags; strip everything else to its text
 *    - drop all on*, formaction, srcdoc attributes
 *    - drop href/src values starting with javascript: or vbscript:
 *    - drop data: URLs except for image/* (small inline images are OK)
 */
const DROP_BLOCK_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "form",
  "input",
  "button",
  "svg",
  "math",
  "noscript",
  "title",
  "head",
]);

const ALLOWED_TAGS = new Set([
  "a", "b", "blockquote", "br", "code", "div", "em", "h1", "h2", "h3",
  "h4", "h5", "h6", "hr", "i", "img", "li", "ol", "p", "pre", "small",
  "span", "strong", "sub", "sup", "table", "tbody", "td", "th", "thead",
  "tr", "u", "ul", "font", "center", "html", "body",
]);

export function sanitizeHtml(input: string): string {
  if (!input) return "";
  let s = input;
  let prev = "";
  while (prev !== s) {
    prev = s;
    for (const tag of DROP_BLOCK_TAGS) {
      const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, "gi");
      s = s.replace(re, "");
      const re2 = new RegExp(`<${tag}\\b[^>]*/?>`, "gi");
      s = s.replace(re2, "");
    }
  }

  s = s.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (_, slash, name, attrs) => {
    const tag = String(name).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (slash) return `</${tag}>`;
    const cleanedAttrs = sanitizeAttrs(String(attrs ?? ""));
    return `<${tag}${cleanedAttrs ? " " + cleanedAttrs : ""}>`;
  });

  s = s.replace(/<!--[\s\S]*?-->/g, "");
  return s;
}

function sanitizeAttrs(raw: string): string {
  const out: string[] = [];
  const re = /([a-zA-Z_:][a-zA-Z0-9_:\.-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const name = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    if (name.startsWith("on")) continue;
    if (name === "srcdoc" || name === "formaction") continue;
    if (name === "href" || name === "src" || name === "action") {
      const v = value.trim().toLowerCase();
      if (v.startsWith("javascript:") || v.startsWith("vbscript:")) continue;
      if (v.startsWith("data:") && !v.startsWith("data:image/")) continue;
    }
    const safe = value.replace(/"/g, "&quot;");
    out.push(value ? `${name}="${safe}"` : name);
  }
  return out.join(" ");
}

// ---------------------------------------------------------------------------
// send — RFC 5322 MIME builder, threading headers, gmail.send scope required.
// ---------------------------------------------------------------------------
async function handleSend(
  auth: string,
  body: Record<string, unknown>,
  res: VercelResponse,
) {
  const sendBody = body as unknown as SendRequest;

  if (!Array.isArray(sendBody?.to) || sendBody.to.length === 0) {
    res.status(400).json({ error: "missing_to" });
    return;
  }
  if (typeof sendBody.subject !== "string") {
    res.status(400).json({ error: "missing_subject" });
    return;
  }
  if (typeof sendBody.body !== "string" || sendBody.body.length === 0) {
    res.status(400).json({ error: "missing_body" });
    return;
  }

  try {
    const mime = buildMime(sendBody);
    const raw = base64url(mime);
    const payload: Record<string, unknown> = { raw };
    if (sendBody.threadId) payload.threadId = sendBody.threadId;

    const r = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      res.status(r.status).json({
        error: "gmail_send_failed",
        status: r.status,
        detail: text.slice(0, 500),
      });
      return;
    }
    const data = (await r.json()) as { id?: string; threadId?: string };
    res.status(200).json({ messageId: data.id, threadId: data.threadId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: "gmail_proxy_failed", message });
  }
}

function buildMime(req: SendRequest): string {
  const boundary = `lumina_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const hasHtml = req.body !== req.plainBody && /<[a-z][\s\S]*>/i.test(req.body);
  const plain = req.plainBody ?? (hasHtml ? stripTags(req.body) : req.body);
  const html = hasHtml ? req.body : null;

  const lines: string[] = [];
  lines.push("MIME-Version: 1.0");
  if (req.from) lines.push(`From: ${req.from}`);
  lines.push(`To: ${req.to.join(", ")}`);
  if (req.cc && req.cc.length > 0) lines.push(`Cc: ${req.cc.join(", ")}`);
  if (req.bcc && req.bcc.length > 0) lines.push(`Bcc: ${req.bcc.join(", ")}`);
  lines.push(`Subject: ${encodeSubject(req.subject)}`);
  if (req.inReplyTo) lines.push(`In-Reply-To: ${req.inReplyTo}`);
  if (req.references && req.references.length > 0) {
    lines.push(`References: ${req.references.join(" ")}`);
  }

  if (html) {
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(plain);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(html);
    lines.push("");
    lines.push(`--${boundary}--`);
  } else {
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(plain);
  }
  return lines.join("\r\n");
}

function encodeSubject(s: string): string {
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, "utf-8").toString("base64")}?=`;
}

function base64url(s: string): string {
  return Buffer.from(s, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function stripTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
