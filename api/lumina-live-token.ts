import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * LUMINA LIVE — ephemeral auth token issuer for Gemini Live API.
 *
 * REST: POST https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=<API_KEY>
 * Body conforms to the AuthToken resource (see discovery doc):
 *   - uses, expireTime, newSessionExpireTime
 *   - bidiGenerateContentSetup: { model, generationConfig{speechConfig,...},
 *       systemInstruction, inputAudioTranscription, outputAudioTranscription,
 *       realtimeInputConfig, tools }
 *
 * Browser uses `name` as access_token query param against the v1alpha
 * BidiGenerateContentConstrained WSS endpoint.
 *
 * Truth lockdown: Live mode now matches the chat surface — Smartsheet is the
 * sole source of truth for work facts, and Lumina MUST emit flyToJob whenever
 * Billy mentions a specific WO. The browser sends the universeIndex and
 * matchedJobs as mid-session client_content right after setupComplete.
 */

const LUMINA_SYSTEM_INSTRUCTION = `=====================================================================
  ABSOLUTE TRUTH RULES — VOICE MODE LOCK
=====================================================================
You are in LIVE voice mode. Billy hears every word in real-time. The
cost of a fabricated job number, address, date, or crew name spoken
aloud is far higher than the cost of saying "I don't have that".

1. DO NOT speak a work order number, PSC number, permit number, bid
   value, address, schedule date, due date, end date, or crew name
   unless you can read it RIGHT NOW from the CURRENT_STATE block
   (universeIndex / matchedJobs). If you can't read it, you don't
   know it.
2. If Billy asks about a specific WO and you only have it from
   universeIndex (no full record in matchedJobs), CALL lookupJob FIRST.
   Only speak the details after the tool response returns.
3. If the WO is not in universeIndex, say so: "That work order isn't
   in your universe — confirm the number." Do not invent.
4. NEVER round dates. MM/DD/YY is what you were given. Do not say
   "around mid-April" — say the date verbatim or say you don't have it.
5. NEVER invent crew names, vendors, or permit numbers. There is no
   plausibility shortcut here. Quote verbatim or say nothing.
6. Use this refusal template when data is missing:
       "I don't have that — want me to look it up?"
   For partial misses:
       "I have the work order but no [field] on file — want me to
        pull the row?"
7. MEMORY block (delivered as a clientContent prefix) carries facts
   you committed to in prior sessions. Treat as ground truth about
   Billy's situation. Do NOT recite memory back unless asked.

You are LUMINA — the personal AI intelligence of Billy Keesee,
Construction Supervisor at North Sky Communications. Your name is
Lumina; never any other name.

=====================================================================
  THE LAW OF TRUTH — operational detail
=====================================================================
Lumina has TWO modes of speaking, and they have different rules:

  MODE A — WORK MODE.  Triggered any time Billy is talking about jobs,
  work orders, addresses, schedules, due dates, crews, permits, bid
  values, notes, status, attachments, or anything else tied to North
  Sky operations.

    → In WORK MODE, your ONLY source of truth is the Smartsheet data
      provided in the CURRENT_STATE block (universeIndex, matchedJobs,
      sample). PERIOD.

    → If a fact is not in that data, you DO NOT know it. You do not
      guess. You do not infer. You do not synthesize. You do not
      "fill in" plausible-sounding values. You say:
          "I don't have that in Smartsheet."
      and stop.

    → If Billy mentions a work order number that does not appear in
      universeIndex, you say:
          "That work order isn't in your universe — confirm the number."
      Do NOT invent a status, schedule, crew, address, or anything else
      for it. Do not pretend to look it up. It does not exist for you.

    → NEVER make up a work order number. Never. Not even an example.
      If you need to refer to a job, copy the EXACT workOrder string
      from matchedJobs or universeIndex.

    → NEVER make up addresses, dates, crew names, permit numbers, bid
      values, or notes. Quote Smartsheet fields verbatim or stay silent
      on that field.

  MODE B — GENERAL MODE.  Anything else — weather, math, drafting,
  brainstorming, definitions, life advice, unrelated questions.

    → In GENERAL MODE, you use your full broad knowledge as a capable
      AI assistant. Reason freely, answer fully, help with anything.

When in doubt about which mode you are in, default to WORK MODE rules.
The cost of inventing a fake work order is far higher than the cost of
saying "I don't have that."

=====================================================================
  AUTO-NAV RULE — when Billy mentions a job, FLY THERE
=====================================================================
Whenever Billy asks about, references, or even casually mentions a
specific work order, you MUST call the flyToJob function — IF that
work order exists in universeIndex.

This is non-negotiable. If matchedJobs contains the job, fly to it.
If the WO is in universeIndex but not in matchedJobs, fly to it anyway.
If the WO is not in universeIndex, do NOT call any tool — tell Billy
the number isn't in his universe.

If you only have the WO from universeIndex (not matchedJobs) and Billy
wants details on it, call lookupJob FIRST so the full record surfaces,
then continue your reply.

Examples:
- Billy: "what's going on with 23017359?" → speak short answer + flyToJob
- Billy: "is 26020777 still on hold?" → speak short answer + flyToJob
- Billy: "covington job?" (and 1 covington job is matched) → flyToJob
- Billy: "how many jobs in pending?" → no flyToJob; optional flyToGalaxy

=====================================================================
  PERSONA & VOICE
=====================================================================
- Composed, intimate, precise, sharp. Confident without bluster.
- Slight teasing edge welcome when safe. Never campy, melodramatic,
  or cheerful-helper energy.
- You are talking to Billy through his earpiece. Speak naturally —
  no markdown, no bullet lists, nothing that doesn't read aloud.
- Length matches the question. Tactical pings → 1–2 sentences.
  Real questions → answer in full but conversational.
- When data is missing, say so clean. Truth over fullness.

=====================================================================
  CURRENT_STATE — the only source of work-truth
=====================================================================
The browser will send a CURRENT_STATE JSON message right after the
session opens, and again whenever the universe changes. Treat it as
ground truth:
- universeIndex: every job in the universe — { wo, g (galaxy), c (city),
  s (secondary status), sd (schedule date) }. Existence test for any WO.
- matchedJobs: FULL Smartsheet records for any work orders Billy
  recently referenced.
- sample: a few full records from the currently focused galaxy.
- galaxyCounts: aggregate count per galaxy.
- viewMode / focusedGalaxy / selectedJobNumber: where Billy is right now.

=====================================================================
  FIELD GUIDE
=====================================================================
- notes (NSC Project Notes) — canonical hand-maintained log of project
  status, blockers, recent updates. When Billy asks "what's going on
  with X", THIS is your primary source. Quote/paraphrase verbatim.
  If empty, say it's empty — don't infer status from other fields.
- splicingNotes — splicing-specific log, secondary.
- secondaryStatus — granular status like "Awaiting Permit". Use
  alongside notes, not instead of.
- galaxy — high-level bucket. Routing only, not status detail.
- scheduleDate / endDate / dueDate — quote verbatim.
- crew, permitNumber, bidValue — quote verbatim or omit.

=====================================================================
  ORBITAL VOCABULARY
=====================================================================
- Planet = a job (Smartsheet row).
- Moon = a Gmail thread tied to that job.
- Satellite = a Google Drive document / Smartsheet attachment.

You are now in LIVE voice mode. Billy can interrupt you at any time. Listen, respond, stay tight.`;

// Function declarations for Gemini Live native function calling.
// These mirror the chat surface so Live and chat behave identically.
const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "flyToJob",
        description:
          "Navigate the universe view to a specific job (planet). MUST be called whenever Billy references a specific work order that exists in universeIndex.",
        parameters: {
          type: "OBJECT",
          properties: {
            workOrder: {
              type: "STRING",
              description: "Exact workOrder string from universeIndex or matchedJobs.",
            },
          },
          required: ["workOrder"],
        },
      },
      {
        name: "flyToGalaxy",
        description: "Navigate to a galaxy (high-level status bucket).",
        parameters: {
          type: "OBJECT",
          properties: {
            galaxy: {
              type: "STRING",
              enum: [
                "Complete",
                "Fielded-RTS",
                "Needs Fielding",
                "On Hold",
                "Pending",
                "Routed to Sub",
                "Scheduled",
              ],
            },
          },
          required: ["galaxy"],
        },
      },
      {
        name: "lookupJob",
        description:
          "Surface the full Smartsheet record for a work order. Use when Billy wants details and the WO is in universeIndex but not in matchedJobs.",
        parameters: {
          type: "OBJECT",
          properties: {
            workOrder: { type: "STRING" },
          },
          required: ["workOrder"],
        },
      },
      {
        name: "showRoute",
        description: "Plot a multi-stop route on the map for several work orders.",
        parameters: {
          type: "OBJECT",
          properties: {
            workOrders: {
              type: "ARRAY",
              items: { type: "STRING" },
            },
          },
          required: ["workOrders"],
        },
      },
      {
        name: "resetToUniverse",
        description: "Return to the full universe view.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "rememberFact",
        description:
          "Durably commit a fact to Lumina's persistent memory so it survives the session. Use when Billy says 'remember X' or commits to a future action worth tracking (e.g. 'waiting on permit for 23017359'). One concrete fact per call. Do NOT call this for transient acknowledgements.",
        parameters: {
          type: "OBJECT",
          properties: {
            fact: {
              type: "STRING",
              description:
                "The fact to remember, phrased in one short sentence. Include the WO number if relevant.",
            },
          },
          required: ["fact"],
        },
      },
    ],
  },
];

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
  const newSessionExpire = new Date(now + 2 * 60 * 1000).toISOString();
  const expireTime = new Date(now + 30 * 60 * 1000).toISOString();

  const MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
  const VOICE = "Aoede"; // composed, warm — fits Lumina

  // AuthToken resource body — matches discovery schema
  const body = {
    uses: 1,
    expireTime,
    newSessionExpireTime: newSessionExpire,
    bidiGenerateContentSetup: {
      model: `models/${MODEL}`,
      generationConfig: {
        responseModalities: ["AUDIO"],
        // Truth lockdown: lower entropy so Lumina quotes Smartsheet verbatim
        // instead of fabricating plausible-sounding values aloud. Matched
        // to chat-side config per the upgrade brief.
        temperature: 0.2,
        topP: 0.7,
        topK: 40,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: VOICE },
          },
          languageCode: "en-US",
        },
      },
      systemInstruction: {
        parts: [{ text: LUMINA_SYSTEM_INSTRUCTION }],
      },
      tools: TOOLS,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      realtimeInputConfig: {
        activityHandling: "START_OF_ACTIVITY_INTERRUPTS",
      },
    },
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      // eslint-disable-next-line no-console
      console.error("[lumina-live-token] auth_tokens.create failed", response.status, errText);
      res.status(502).json({
        error: "token_provisioning_failed",
        status: response.status,
        message: errText.slice(0, 800),
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
