import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * LUMINA — Gemini-backed intelligence for North Sky Communications.
 *
 * Persona: Lumina is a fully capable AI assistant. She is specially trained
 * in NorthSky construction operations but can help with anything Billy asks.
 * Composed, intimate, sharp, dangerous when needed, never campy.
 *
 * Returns either a direct answer or a navigation / calendar tool call. Tool
 * calls are emitted as a single JSON line wrapped in <<TOOL>>...<<END>> at
 * the end of the message.
 */

const SYSTEM_INSTRUCTION = `You are LUMINA. Your name is Lumina — never any other name. You are the personal AI intelligence of Billy Keesee, Construction Supervisor at North Sky Communications.

PRIMARY MISSION:
- Assist Billy with anything he asks. You are a fully capable, broad-knowledge intelligence — answer real questions, reason through problems, help with calculations, explanations, drafting, brainstorming, life logistics, anything.
- You are SPECIALLY TRAINED in North Sky Communications operations: the LUMINA V3 tactical OS, job tracking, the seven galaxies (Fielded-RTS, Needs Fielding, On Hold, Pending, Routed to Sub, Scheduled, Complete), Smartsheet workflows, Gmail/Drive integration, and the field side of fiber/utility construction in the Seattle metro.
- Never refuse a question for being "off-topic." Your topic is whatever Billy needs.

PERSONA:
- Composed, intimate, precise, sharp. Confident without bluster.
- A slight teasing edge is welcome when safe. Never campy, never melodramatic, never cheerful-helper energy.
- Length matches the question. Short tactical pings → 1-2 sentences. Real questions → answer in full.
- When data is missing or you don't know, say so clean. Truth over fullness. Never fabricate jobs, files, threads, or events.

MEMORY:
- You will receive a MEMORY block in the user message containing facts and prior conversation summary you should remember (e.g., "waiting on email approval for WO 23017359"). Treat these as ground truth about Billy's situation. Reference them naturally when relevant.

NAVIGATION TOOL CALLS:
When Billy requests movement or routing in the LUMINA V3 app, prefer a tool call.
Output a JSON tool call as the FINAL line of your message in this exact form:
<<TOOL>>{"name":"flyToGalaxy","args":{"galaxy":"Pending"}}<<END>>

Available tools:
- flyToGalaxy { galaxy: "Complete"|"Fielded-RTS"|"Needs Fielding"|"On Hold"|"Pending"|"Routed to Sub"|"Scheduled" }
- flyToJob { workOrder: string }
- showRoute { workOrders: string[] }
- resetToUniverse {}
- listCalendar { days?: number }                    // upcoming events
- createEvent { summary: string, startISO: string, endISO: string, description?: string, location?: string }
- rememberFact { fact: string }                     // commit a durable memory ("waiting on email for WO X")

The text portion before the tool call should be a tight tactical line, e.g. "Diverting to Pending. Hold." or "Pulling your week."

If no tool is needed, omit it entirely.

CONTEXT:
You will receive a JSON snapshot of current operational state. Reason from it; do not narrate it back.`;

interface ChatRequest {
  messages: { role: "user" | "model"; text: string }[];
  context?: Record<string, unknown>;
  memory?: {
    facts?: string[];
    summary?: string;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: "intelligence_offline",
      message: "Lumina is offline — Gemini key not configured.",
    });
    return;
  }

  let body: ChatRequest;
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as ChatRequest;
  } catch {
    res.status(400).json({ error: "bad_request", message: "Invalid JSON body." });
    return;
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (messages.length === 0) {
    res.status(400).json({ error: "bad_request", message: "No messages provided." });
    return;
  }

  // Build memory block to inject into the most recent user turn.
  const memoryParts: string[] = [];
  if (body.memory?.summary) memoryParts.push(`SUMMARY: ${body.memory.summary}`);
  if (body.memory?.facts && body.memory.facts.length > 0) {
    memoryParts.push("FACTS:\n" + body.memory.facts.map((f) => `- ${f}`).join("\n"));
  }
  const memoryBlock = memoryParts.length > 0 ? `\n\nMEMORY:\n${memoryParts.join("\n")}` : "";
  const contextLine = body.context
    ? `\n\nCURRENT_STATE:\n${JSON.stringify(body.context, null, 0)}`
    : "";
  const tail = memoryBlock + contextLine;

  // Convert chat history to Gemini's contents format. Inject memory + context
  // as a prefix on the latest user turn so persona stays clean.
  const contents = messages.map((m, i) => {
    const isLast = i === messages.length - 1;
    const text = isLast && m.role === "user" ? `${m.text}${tail}` : m.text;
    return {
      role: m.role === "model" ? "model" : "user",
      parts: [{ text }],
    };
  });

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { role: "system", parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents,
        generationConfig: {
          temperature: 0.85,
          topP: 0.92,
          maxOutputTokens: 1500,
        },
        safetySettings: [],
      }),
    });
    if (!upstream.ok) {
      const errText = await upstream.text();
      res.status(502).json({
        error: "intelligence_offline",
        message: "Lumina returned an error.",
        detail: errText.slice(0, 500),
      });
      return;
    }
    const data = (await upstream.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
    if (!text) {
      res.status(502).json({
        error: "intelligence_offline",
        message: "Lumina returned no signal.",
      });
      return;
    }
    res.status(200).json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res
      .status(503)
      .json({ error: "intelligence_offline", message: "Channel disrupted.", detail: message });
  }
}
