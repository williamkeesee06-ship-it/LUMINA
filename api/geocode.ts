import type { VercelRequest, VercelResponse } from "@vercel/node";

// Geocoding cache. Lives in module memory; warm function reuses entries.
// Bible: caches must reflect truth — if upstream fails we return null, not a guess.
const cache = new Map<string, { lat: number; lng: number } | null>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Maps key not configured." });
    return;
  }
  let body: { addresses: string[] };
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }
  const addresses = Array.isArray(body?.addresses) ? body.addresses : [];
  const out: Record<string, { lat: number; lng: number } | null> = {};

  // Google's geocoding API does not have a batch endpoint; fan out with
  // bounded concurrency to stay polite and quick.
  const queue = [...new Set(addresses)].filter(Boolean);
  const concurrency = 6;
  let idx = 0;
  async function worker() {
    while (idx < queue.length) {
      const addr = queue[idx++];
      if (cache.has(addr)) {
        out[addr] = cache.get(addr) ?? null;
        continue;
      }
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${apiKey}`;
        const r = await fetch(url);
        const j = (await r.json()) as {
          status: string;
          results?: { geometry?: { location?: { lat: number; lng: number } } }[];
        };
        if (j.status === "OK" && j.results?.[0]?.geometry?.location) {
          const { lat, lng } = j.results[0].geometry.location!;
          out[addr] = { lat, lng };
          cache.set(addr, { lat, lng });
        } else {
          out[addr] = null;
          cache.set(addr, null);
        }
      } catch {
        out[addr] = null;
        // do NOT cache transient errors
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  res.status(200).json({ results: out });
}
