import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Calendar proxy. Two operations:
 *   action: "list"    -> upcoming events for the next N days (default 14)
 *   action: "create"  -> create a new event
 *
 * Auth via Google access token from the browser (Authorization: Bearer ...).
 * The token already includes the `calendar.events` scope (see googleAuth.ts).
 */

interface ListBody {
  action: "list";
  days?: number;
  maxResults?: number;
}

interface CreateBody {
  action: "create";
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
  location?: string;
  timeZone?: string;
}

type Body = ListBody | CreateBody;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "Missing bearer token." });
    return;
  }
  const token = auth.slice("Bearer ".length);

  let body: Body;
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as Body;
  } catch {
    res.status(400).json({ error: "bad_request", message: "Invalid JSON body." });
    return;
  }

  try {
    if (body.action === "list") {
      const days = Math.max(1, Math.min(60, body.days ?? 14));
      const maxResults = Math.max(1, Math.min(50, body.maxResults ?? 20));
      const now = new Date();
      const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const params = new URLSearchParams({
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: String(maxResults),
      });
      const r = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!r.ok) {
        const text = await r.text();
        res.status(r.status).json({
          error: "calendar_failed",
          message: "Calendar list failed.",
          detail: text.slice(0, 400),
        });
        return;
      }
      const data = (await r.json()) as {
        items?: Array<{
          id: string;
          summary?: string;
          description?: string;
          location?: string;
          start?: { dateTime?: string; date?: string; timeZone?: string };
          end?: { dateTime?: string; date?: string };
          htmlLink?: string;
        }>;
      };
      const events = (data.items ?? []).map((ev) => ({
        id: ev.id,
        summary: ev.summary ?? "(no title)",
        description: ev.description ?? "",
        location: ev.location ?? "",
        start: ev.start?.dateTime ?? ev.start?.date ?? "",
        end: ev.end?.dateTime ?? ev.end?.date ?? "",
        link: ev.htmlLink ?? "",
      }));
      res.status(200).json({ events });
      return;
    }

    if (body.action === "create") {
      const { summary, description, startISO, endISO, location, timeZone } = body;
      if (!summary || !startISO || !endISO) {
        res
          .status(400)
          .json({ error: "bad_request", message: "summary, startISO, endISO required." });
        return;
      }
      const tz = timeZone || "America/Los_Angeles";
      const r = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary,
            description: description ?? "",
            location: location ?? "",
            start: { dateTime: startISO, timeZone: tz },
            end: { dateTime: endISO, timeZone: tz },
          }),
        },
      );
      if (!r.ok) {
        const text = await r.text();
        res.status(r.status).json({
          error: "calendar_create_failed",
          message: "Could not create event.",
          detail: text.slice(0, 400),
        });
        return;
      }
      const data = (await r.json()) as {
        id?: string;
        htmlLink?: string;
        summary?: string;
        start?: { dateTime?: string };
      };
      res.status(200).json({
        id: data.id,
        link: data.htmlLink,
        summary: data.summary,
        start: data.start?.dateTime,
      });
      return;
    }

    res.status(400).json({ error: "bad_request", message: "Unknown action." });
  } catch (err) {
    res.status(503).json({
      error: "calendar_offline",
      message: err instanceof Error ? err.message : "Calendar channel disrupted.",
    });
  }
}
