import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Gmail thread proxy. Returns a full thread parsed into per-message objects
 * with sanitized HTML bodies (allow-list, hand-rolled — no new dep) and
 * plain-text fallbacks. The client renders sanitized HTML directly when
 * available and falls back to plain text otherwise.
 *
 * The sanitizer is intentionally conservative — it strips <script>, <style>,
 * <iframe>, <object>, <embed>, on* event handlers, and javascript: / data:
 * URLs that aren't images. It leaves layout-safe tags and basic styling in
 * place so the thread reads like a real email instead of a stripped wall of
 * text.
 */

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

  let body: { threadId: string };
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "bad_request" });
    return;
  }
  const threadId = body?.threadId?.trim();
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
  // First, strip block tags + their contents. Run in a loop because nested
  // blocks (script-in-style etc.) can leave residue after one pass.
  let s = input;
  let prev = "";
  while (prev !== s) {
    prev = s;
    for (const tag of DROP_BLOCK_TAGS) {
      const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, "gi");
      s = s.replace(re, "");
      // Self-closing or unterminated block tags — strip to the next > so we
      // don't leave an open <iframe... lying around.
      const re2 = new RegExp(`<${tag}\\b[^>]*/?>`, "gi");
      s = s.replace(re2, "");
    }
  }

  // Now process individual tags: keep allowed, strip attributes we don't want.
  s = s.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (_, slash, name, attrs) => {
    const tag = String(name).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return ""; // strip tag, keep nothing
    if (slash) return `</${tag}>`;
    const cleanedAttrs = sanitizeAttrs(String(attrs ?? ""));
    return `<${tag}${cleanedAttrs ? " " + cleanedAttrs : ""}>`;
  });

  // Strip stray HTML comments (can hide payloads in some clients).
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  return s;
}

function sanitizeAttrs(raw: string): string {
  const out: string[] = [];
  // Match attr="value" / attr='value' / attr=value / bare attr
  const re = /([a-zA-Z_:][a-zA-Z0-9_:\.-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const name = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    if (name.startsWith("on")) continue; // onclick, onerror, etc.
    if (name === "srcdoc" || name === "formaction") continue;
    if (name === "href" || name === "src" || name === "action") {
      const v = value.trim().toLowerCase();
      if (v.startsWith("javascript:") || v.startsWith("vbscript:")) continue;
      if (v.startsWith("data:") && !v.startsWith("data:image/")) continue;
    }
    // re-emit attribute, escaping double-quotes in the value
    const safe = value.replace(/"/g, "&quot;");
    out.push(value ? `${name}="${safe}"` : name);
  }
  return out.join(" ");
}
