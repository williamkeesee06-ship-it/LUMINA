import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchSmartsheetJobs, type RawJobRow } from "./_lib/smartsheet.js";

// In-memory cache to keep Smartsheet API calls reasonable.
// Vercel serverless functions can be warm for a few minutes; this cache
// helps when many users (or page reloads) hit the endpoint in quick succession.
let cache: { ts: number; data: RawJobRow[] } | null = null;
const TTL_MS = 60_000; // 60 seconds

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const token = process.env.SMARTSHEET_TOKEN;
  if (!token) {
    res.status(500).json({ error: "Smartsheet token not configured on server." });
    return;
  }

  try {
    const force = req.query.force === "1";
    if (!force && cache && Date.now() - cache.ts < TTL_MS) {
      // Audit fix #6: when serving from the warm in-memory cache we can let
      // the browser hold onto the response briefly. Force-reload (force=1)
      // bypasses this path entirely so the operator can always pull fresh.
      res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
      res.setHeader("X-Lumina-Cache", "hit");
      res.status(200).json({ jobs: cache.data, cached: true });
      return;
    }
    const jobs = await fetchSmartsheetJobs(token);
    cache = { ts: Date.now(), data: jobs };
    // Fresh fetch — keep no-store so we don't pin a just-changed row in any
    // intermediate cache. The next request inside TTL_MS will get the
    // SWR header above.
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Lumina-Cache", "miss");
    res.status(200).json({ jobs, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: "Smartsheet fetch failed", message });
  }
}
