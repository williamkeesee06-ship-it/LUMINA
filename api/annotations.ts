import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * /api/annotations — cross-device Firestore persistence for per-job map annotations.
 *
 * Pattern is identical to /api/memory — Firestore REST, no SDK, blob storage.
 * Collection: lumina_annotations
 * Document:   {jobId}  →  blob: JSON.stringify(MapAnnotation[])
 *
 * Routes:
 *   GET  ?jobId=xxx              → { annotations: MapAnnotation[] }
 *   POST { jobId, annotations }  → { ok: true }   (full array upsert)
 *   DELETE ?jobId=xxx            → { ok: true }   (wipe all for job)
 */

const FIRESTORE_PROJECT_ID = process.env.FIRESTORE_PROJECT_ID;
const FIRESTORE_API_KEY    = process.env.FIRESTORE_API_KEY;
const ANNOTATIONS_COLLECTION = "lumina_annotations";

function hasFirestore(): boolean {
  return Boolean(FIRESTORE_PROJECT_ID && FIRESTORE_API_KEY);
}

function docUrl(jobId: string): string {
  const enc = encodeURIComponent(jobId);
  return `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${ANNOTATIONS_COLLECTION}/${enc}?key=${FIRESTORE_API_KEY}`;
}

function toFirestoreBody(annotations: unknown): unknown {
  return {
    fields: {
      blob:      { stringValue: JSON.stringify(annotations) },
      updatedAt: { timestampValue: new Date().toISOString() },
    },
  };
}

function fromFirestoreBody(
  doc: { fields?: { blob?: { stringValue?: string } } } | null,
): unknown[] {
  const raw = doc?.fields?.blob?.stringValue;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — Lumina is same-origin on Vercel but allow explicit preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  if (!hasFirestore()) {
    res.status(501).json({
      error: "no_backend",
      message: "FIRESTORE_PROJECT_ID / FIRESTORE_API_KEY not configured.",
    });
    return;
  }

  try {
    // ── GET ────────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const jobId = String(req.query.jobId ?? "").trim();
      if (!jobId) { res.status(400).json({ error: "missing_jobId" }); return; }

      const r = await fetch(docUrl(jobId), { method: "GET" });
      if (r.status === 404) { res.status(200).json({ annotations: [] }); return; }
      if (!r.ok) {
        const txt = await r.text();
        res.status(502).json({ error: "firestore_get_failed", detail: txt.slice(0, 400) });
        return;
      }
      const doc = (await r.json()) as { fields?: { blob?: { stringValue?: string } } };
      res.status(200).json({ annotations: fromFirestoreBody(doc) });
      return;
    }

    // ── POST (full upsert) ─────────────────────────────────────────────────
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body as {
        jobId?: string;
        annotations?: unknown[];
      };
      const jobId = String(body?.jobId ?? "").trim();
      const annotations = body?.annotations;
      if (!jobId) { res.status(400).json({ error: "missing_jobId" }); return; }
      if (!Array.isArray(annotations)) { res.status(400).json({ error: "annotations_must_be_array" }); return; }

      const r = await fetch(docUrl(jobId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toFirestoreBody(annotations)),
      });
      if (!r.ok) {
        const txt = await r.text();
        res.status(502).json({ error: "firestore_write_failed", detail: txt.slice(0, 400) });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    // ── DELETE (wipe job annotations) ─────────────────────────────────────
    if (req.method === "DELETE") {
      const jobId = String(req.query.jobId ?? "").trim();
      if (!jobId) { res.status(400).json({ error: "missing_jobId" }); return; }

      const r = await fetch(docUrl(jobId), { method: "DELETE" });
      if (!r.ok && r.status !== 404) {
        const txt = await r.text();
        res.status(502).json({ error: "firestore_delete_failed", detail: txt.slice(0, 400) });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "method_not_allowed" });
  } catch (err) {
    res.status(500).json({ error: "annotations_handler_error", message: (err as Error).message });
  }
}
