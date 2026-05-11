import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Gmail send proxy. Builds RFC 5322 MIME, base64url-encodes, posts to
 * users.messages.send. When `threadId` is provided, Gmail threads the reply
 * automatically — we still set In-Reply-To and References for client
 * interop (Apple Mail, Outlook).
 *
 * Requires gmail.send scope. The client surfaces a re-auth prompt via the
 * OrbAuthPanel when this returns 403.
 */

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

  let body: SendRequest;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "bad_request" });
    return;
  }

  if (!Array.isArray(body?.to) || body.to.length === 0) {
    res.status(400).json({ error: "missing_to" });
    return;
  }
  if (typeof body.subject !== "string") {
    res.status(400).json({ error: "missing_subject" });
    return;
  }
  if (typeof body.body !== "string" || body.body.length === 0) {
    res.status(400).json({ error: "missing_body" });
    return;
  }

  try {
    const mime = buildMime(body);
    const raw = base64url(mime);
    const payload: Record<string, unknown> = { raw };
    if (body.threadId) payload.threadId = body.threadId;

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
  const plain =
    req.plainBody ?? (hasHtml ? stripTags(req.body) : req.body);
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
  // RFC 2047 "encoded-word" for any non-ASCII chars so subjects with em-dashes
  // and unicode quotes don't arrive mangled.
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
