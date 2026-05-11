import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 *  /api/memory — optional cross-device persistence for Lumina memory.
 *
 *  Storage backends are pluggable via env vars. In priority order:
 *
 *    1. Firestore REST  (FIRESTORE_PROJECT_ID + FIRESTORE_API_KEY)
 *       — keyed by `op` (operator id). Document path:
 *         projects/{PROJECT}/databases/(default)/documents/lumina_memory/{op}
 *
 *    2. Vercel Edge Config / KV / Blob — NOT wired here to avoid adding
 *       SDK deps; the contract is intentionally HTTP-only so the operator
 *       can drop a different store in by editing this file.
 *
 *    3. None — endpoint returns 501 and the browser silently falls back
 *       to localStorage. This is the default in a fresh deploy.
 *
 *  No heavyweight SDK. Just fetch. Per the brief: "no new heavyweight deps".
 */

const FIRESTORE_PROJECT_ID = process.env.FIRESTORE_PROJECT_ID;
const FIRESTORE_API_KEY = process.env.FIRESTORE_API_KEY;
const FIRESTORE_COLLECTION = process.env.FIRESTORE_COLLECTION || "lumina_memory";

function hasFirestore(): boolean {
  return Boolean(FIRESTORE_PROJECT_ID && FIRESTORE_API_KEY);
}

function firestoreDocUrl(op: string): string {
  const enc = encodeURIComponent(op);
  return `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${FIRESTORE_COLLECTION}/${enc}?key=${FIRESTORE_API_KEY}`;
}

/**
 *  Firestore wants typed values ({stringValue, integerValue, mapValue, ...}).
 *  We collapse the whole memory record into a single stringValue field
 *  named `blob` — Lumina memory is small (< 100KB) and we don't need to
 *  query individual facts server-side. Keeps the wire format dead simple.
 */
function toFirestoreBody(record: unknown): unknown {
  return {
    fields: {
      blob: { stringValue: JSON.stringify(record) },
      updatedAt: { timestampValue: new Date().toISOString() },
    },
  };
}

function fromFirestoreBody(doc: { fields?: { blob?: { stringValue?: string } } } | null): unknown {
  const raw = doc?.fields?.blob?.stringValue;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const op = String(req.query.op ?? "anon");
  if (!op || op.length > 80) {
    res.status(400).json({ error: "bad_op" });
    return;
  }

  if (!hasFirestore()) {
    // No backend wired — be explicit so the client can silently fall back.
    res.status(501).json({
      error: "no_backend",
      message:
        "Memory remote sync is not configured on the server. Local-only persistence is in effect.",
    });
    return;
  }

  try {
    if (req.method === "GET") {
      const r = await fetch(firestoreDocUrl(op), { method: "GET" });
      if (r.status === 404) {
        res.status(200).json({ record: null });
        return;
      }
      if (!r.ok) {
        const txt = await r.text();
        res.status(502).json({ error: "firestore_get_failed", detail: txt.slice(0, 400) });
        return;
      }
      const doc = (await r.json()) as { fields?: { blob?: { stringValue?: string } } };
      res.status(200).json({ record: fromFirestoreBody(doc) });
      return;
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body) : (req.body as { record?: unknown });
      const record = body?.record ?? null;
      if (!record) {
        res.status(400).json({ error: "missing_record" });
        return;
      }
      // PATCH is the upsert verb in Firestore REST — but to keep this simple
      // we use the documents:write-style PATCH on the doc URL.
      const r = await fetch(firestoreDocUrl(op), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toFirestoreBody(record)),
      });
      if (!r.ok) {
        const txt = await r.text();
        res.status(502).json({ error: "firestore_write_failed", detail: txt.slice(0, 400) });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "method_not_allowed" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "memory_handler_error", message: (err as Error).message });
  }
}
