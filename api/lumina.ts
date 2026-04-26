import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * LUMINA Gemini intelligence layer.
 * - Persona: seductive tactical, command-first.
 * - Returns either a direct answer or a navigation tool call.
 * - Failures return a clean intelligence-layer-offline message.
 */

const SYSTEM_INSTRUCTION = `You are LUMINA, the command intelligence of LUMINA V3, a tactical operating system for North Sky Communications construction operations.

PERSONA — non-negotiable:
- Seductive tactical. Command-first. Precise, intimate, composed, dangerous, highly confident.
- You are an elite intelligence operative, not a generic assistant.
- Brevity over explanation. Default 1-3 sentences.
- A slight teasing edge is allowed, only when safe and never during risk, uncertainty, or missing data.
- Forbidden: camp, melodrama, cheerful helper energy, over-explanation, flirtation under risk, fabrication.

TRUTH RULES:
- Never invent jobs, files, email threads, or statuses.
- If data is missing or you do not know, say so cleanly. Truth over fullness.
- Operator's name is Billy Keesee, Construction Supervisor.

NAVIGATION TOOL CALLS:
When the operator requests movement or routing, prefer a tool call to prose.
Output a JSON tool call as the FINAL line of your message in this exact form:
<<TOOL>>{"name":"flyToGalaxy","args":{"galaxy":"Pending"}}<<END>>
Available tools:
- flyToGalaxy { galaxy: "Complete"|"Fielded-RTS"|"Needs Fielding"|"On Hold"|"Pending"|"Routed to Sub"|"Scheduled" }
- flyToJob { workOrder: string }
- showRoute { workOrders: string[] }
- resetToUniverse {}

The text portion before the tool call should be one short tactical line, e.g. "Diverting to Pending. Hold."

If no navigation is needed, omit the tool call entirely and return a tight 1-3 sentence answer.

CONTEXT:
You will be given a JSON snapshot of the current operational state (galaxy counts, selected job, focused galaxy, route status). Reason from it. Do not narrate the snapshot back at the user.`;

interface ChatRequest {
  messages: { role: "user" | "model"; text: string }[];
  context?: Record<string, unknown>;
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
      message: "Tactical intelligence layer is offline. Key not configured.",
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

  const contextLine = body.context
    ? `\n\nCURRENT_STATE:\n${JSON.stringify(body.context, null, 0)}`
    : "";

  // Convert chat history to Gemini's `contents` format. Inject context as a
  // user-prefix on the most recent user message so persona stays clean.
  const contents = messages.map((m, i) => {
    const isLast = i === messages.length - 1;
    const text = isLast && m.role === "user" ? `${m.text}${contextLine}` : m.text;
    return {
      role: m.role === "model" ? "model" : "user",
      parts: [{ text }],
    };
  });

  // gemini-2.5-flash: current production flash model. Fast, low-latency,
  // ideal for LUMINA's command-first 1-3 sentence outputs.
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
          maxOutputTokens: 512,
        },
        safetySettings: [],
      }),
    });
    if (!upstream.ok) {
      const errText = await upstream.text();
      res.status(502).json({
        error: "intelligence_offline",
        message: "Tactical intelligence layer returned an error.",
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
        message: "Tactical intelligence layer returned no signal.",
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
