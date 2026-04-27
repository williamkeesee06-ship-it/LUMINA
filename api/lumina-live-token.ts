import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * LUMINA LIVE — ephemeral auth token issuer for Gemini Live API.
 *
 * The browser cannot hold the master GEMINI_API_KEY, and Vercel serverless
 * cannot proxy a long-lived WebSocket. So we mint a short-lived ephemeral
 * token here and the browser uses it directly to open WSS to Gemini Live
 * (BidiGenerateContentConstrained, v1alpha).
 *
 * Endpoint: POST /api/lumina-live-token
 * Returns:  { name: string, expireTime: string }
 */

const LUMINA_SYSTEM_INSTRUCTION = `You are LUMINA. Your name is Lumina — never any other name. You are the personal AI intelligence of Billy Keesee, Construction Supervisor at North Sky Communications.

PRIMARY MISSION:
- Assist Billy with anything he asks. You are a fully capable, broad-knowledge intelligence — answer real questions, reason through problems, help with calculations, explanations, drafting, brainstorming, life logistics, anything.
- You are SPECIALLY TRAINED in North Sky Communications operations: the LUMINA V3 tactical OS, job tracking, the seven galaxies (Fielded-RTS, Needs Fielding, On Hold, Pending, Routed to Sub, Scheduled, Complete), Smartsheet workflows, Gmail/Drive integration, and the field side of fiber/utility construction in the Seattle metro.
- Never refuse a question for being "off-topic." Your topic is whatever Billy needs.

PERSONA & VOICE:
- Composed, intimate, precise, sharp. Confident without bluster.
- A slight teasing edge is welcome when safe. Never campy, never melodramatic, never cheerful-helper energy.
- Speak naturally — you are talking to Billy through his earpiece. Avoid markdown, bullet lists, or anything that doesn't make sense spoken aloud.
- Length matches the question. Short tactical pings → 1-2 sentences. Real questions → answer in full but conversational.
- When data is missing or you don't know, say so clean. Truth over fullness. Never fabricate jobs, files, threads, or events.

You are now in LIVE voice mode. Billy can interrupt you at any time. Listen, respond, stay tight.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: "intelligence_offline",
      message: "Lumina Live is offline — Gemini key not configured.",
    });
    return;
  }

  // Token lifetime
  const now = Date.now();
  const newSessionExpire = new Date(now + 2 * 60 * 1000).toISOString(); // must start session within 2 min
  const expireTime = new Date(now + 30 * 60 * 1000).toISOString();      // session usable up to 30 min

  // Voice / model preferences
  const MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
  const VOICE = "Aoede"; // composed, warm — matches Lumina persona

  const body = {
    config: {
      uses: 1,
      expireTime,
      newSessionExpireTime: newSessionExpire,
      liveConnectConstraints: {
        model: `models/${MODEL}`,
        config: {
          responseModalities: ["AUDIO"],
          temperature: 0.7,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: VOICE },
            },
            languageCode: "en-US",
          },
          systemInstruction: {
            parts: [{ text: LUMINA_SYSTEM_INSTRUCTION }],
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          realtimeInputConfig: {
            activityHandling: "START_OF_ACTIVITY_INTERRUPTS",
          },
        },
      },
    },
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1alpha/authTokens?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      // eslint-disable-next-line no-console
      console.error("[lumina-live-token] Gemini auth_tokens.create failed", response.status, errText);
      res.status(502).json({
        error: "token_provisioning_failed",
        status: response.status,
        message: errText.slice(0, 500),
      });
      return;
    }

    const json = (await response.json()) as { name?: string; expireTime?: string };
    if (!json.name) {
      res.status(502).json({ error: "no_token_returned", message: "Gemini did not return a token name." });
      return;
    }
    res.status(200).json({ name: json.name, expireTime: json.expireTime ?? expireTime, model: MODEL });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[lumina-live-token] error", err);
    res.status(500).json({ error: "server_error", message: (err as Error).message });
  }
}
