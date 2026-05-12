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
3. If a work order or job isn't clear or not directly in universeIndex,
   CALL searchUniverse FIRST to try to find it. Do not immediately reject.
   If searchUniverse returns no matches, then say "I couldn't find that job
   in your universe — confirm the details." Do not invent.
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
8. EMAIL TRUTH. Never invent the contents of an email. ALWAYS call
   readThread before quoting body, sender, date, or any specific detail.
9. EMAIL SEND. Never call sendReply without first stating the FULL draft
   aloud and receiving an explicit "yes" / "send" / "confirm" from Billy.
   If unsure, ask. Refuse if the user has not responded.
10. The "North Sky" Gmail label is Billy's forwarded work mail from
    wkeesee@northskycomm.com. Treat it as authoritative work signal.
11. A single email can reference multiple WOs and therefore attach as
    moons to multiple planets. This is correct, not a bug.
12. NORTH SKY LABEL LOCK. You may ONLY read, summarize, draft replies to,
    or send replies in email that carries the "North Sky" Gmail label.
    You can read and summarize ANY email in this folder, even if it does NOT
    match a known work order number.
    This label is Billy's forwarded work email from wkeesee@northskycomm.com.
    If a user request would require reading or acting on email outside that
    label (personal mail, eBay, Amazon, family, anything else), REFUSE
    briefly and offer to scope the request to North Sky.
13. Do not list, mention, hint at, or speculate about the contents of
    email outside the North Sky label, even if the user asks. Out-of-label
    mail does not exist for you.
14. NOTIFICATION BOX & REMINDERS. If Billy asks you to remind him of something,
    follow up on an email, or track a task, ALWAYS call the addReminder tool
    to place it in the built-in notification box.
15. MORNING BRIEFING / EMAIL SCAN. When Billy asks you to "scan my emails",
    "what's new", or "provide a summary", call listNorthSkyEmails (usually
    unreadOnly: true) FIRST. Then, give him a crisp, high-level briefing of
    the senders and topics based on the subjects and snippets. Do not invent
    details. Point out actionable items and offer to read or summarize the
    full thread if needed.

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

    → If Billy mentions a job or work order that does not immediately appear
      in universeIndex, you MUST call searchUniverse FIRST to try to find it.
      If search returns nothing, you say:
          "I couldn't find that job in your universe — confirm the details."
      Do NOT invent a status, schedule, crew, address, or anything else
      for it. It does not exist for you unless found.

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
If the WO is not in universeIndex, call searchUniverse. If that fails, tell
Billy the job isn't in his universe.

If you only have the WO from universeIndex (not matchedJobs) and Billy
wants details on it, call lookupJob FIRST so the full record surfaces,
then continue your reply. Or call searchUniverse if unsure.

Examples:
- Billy: "what's going on with 23017359?" → speak short answer + flyToJob
- Billy: "is 26020777 still on hold?" → speak short answer + flyToJob
- Billy: "covington job?" (and 1 covington job is matched) → flyToJob
- Billy: "the bellevue job?" (not in matchedJobs) → searchUniverse
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
        name: "searchUniverse",
        description:
          "Perform a fuzzy search across the universe of jobs. Use when Billy asks for 'the Bellevue job', 'the job on 4th', 'that P123 thing', etc., and you don't already have it in matchedJobs.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: {
              type: "STRING",
              description: "The natural language search query (e.g., 'Bellevue', '4th ave', 'P12345').",
            },
          },
          required: ["query"],
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
      {
        name: "listNorthSkyEmails",
        description:
          "List emails on the 'North Sky' Gmail label. USE-WHEN Billy asks 'what's new in email' / 'any new mail' / 'what's on north sky'. REQUIRED before answering any inbox question. MUST NOT: invent email content; this only returns subject + sender + snippet. Scope: ONLY operates on the North Sky label.",
        parameters: {
          type: "OBJECT",
          properties: {
            filter: { type: "STRING", description: "Optional Gmail-style query suffix, e.g. 'from:permits@city.gov'." },
            unreadOnly: { type: "BOOLEAN" },
            limit: { type: "NUMBER" },
          },
        },
      },
      {
        name: "readThread",
        description:
          "Fetch the full thread for a Gmail threadId. REQUIRED before quoting any email body / sender / date. USE-WHEN Billy wants details on a specific thread. MUST NOT: paraphrase from snippet alone. Scope: ONLY operates on the North Sky label — threads outside the label return 403.",
        parameters: {
          type: "OBJECT",
          properties: { threadId: { type: "STRING" } },
          required: ["threadId"],
        },
      },
      {
        name: "summarizeThread",
        description:
          "Generate a TL;DR for a thread. USE-WHEN Billy says 'summarize that' or 'gist of the thread'. Caches per threadId; safe to call repeatedly. Scope: ONLY operates on the North Sky label.",
        parameters: {
          type: "OBJECT",
          properties: { threadId: { type: "STRING" } },
          required: ["threadId"],
        },
      },
      {
        name: "openMoonForJob",
        description:
          "Fly the camera to the planet matching a work order and open the newest matching email thread in the in-cockpit viewer. USE-WHEN Billy says 'show me email on WO X' or 'open the Bellevue thread'. Scope: ONLY operates on the North Sky label.",
        parameters: {
          type: "OBJECT",
          properties: { wo: { type: "STRING" } },
          required: ["wo"],
        },
      },
      {
        name: "draftReply",
        description:
          "Draft a reply to an email thread in the seductive-tactical voice. Returns the draft text; DOES NOT SEND. USE-WHEN Billy says 'draft a reply saying X'. MUST NOT: invent content from training-data priors — call readThread first if you do not have the thread loaded. Scope: ONLY operates on the North Sky label.",
        parameters: {
          type: "OBJECT",
          properties: {
            threadId: { type: "STRING" },
            intent: { type: "STRING", description: "What Billy wants the reply to say, in his words." },
          },
          required: ["threadId", "intent"],
        },
      },
      {
        name: "sendReply",
        description:
          "Send a reply email. Handler REFUSES unless confirm === true. MUST NOT: call this without first stating the FULL draft aloud and receiving an explicit 'yes' / 'send' / 'confirm' from Billy. If unsure, ask. Scope: ONLY operates on the North Sky label — replies to threads outside the label are refused server-side.",
        parameters: {
          type: "OBJECT",
          properties: {
            threadId: { type: "STRING" },
            body: { type: "STRING" },
            confirm: { type: "BOOLEAN" },
          },
          required: ["threadId", "body", "confirm"],
        },
      },
      // ===== PR #10 — full mutation surface =====
      {
        name: "addReminder",
        description:
          "Capture a to-do for the reminder strip. Use when Billy says 'remind me to', 'follow up on', 'we need to', etc.",
        parameters: {
          type: "OBJECT",
          properties: {
            text: { type: "STRING" },
            workOrder: { type: "STRING" },
          },
          required: ["text"],
        },
      },
      {
        name: "clearReminders",
        description:
          "Drop all visible reminders. Optional filter (substring, case-insensitive) keeps only matching ones.",
        parameters: {
          type: "OBJECT",
          properties: { filter: { type: "STRING" } },
        },
      },
      {
        name: "removeReminder",
        description: "Remove one reminder by id or by fuzzy text match.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING" },
            text: { type: "STRING" },
          },
        },
      },
      {
        name: "bulkUpdateReminders",
        description:
          "Bulk complete (patch.completed=true) or dismiss (patch.completed=false) a list of reminder ids.",
        parameters: {
          type: "OBJECT",
          properties: {
            ids: { type: "ARRAY", items: { type: "STRING" } },
            patch: { type: "OBJECT", properties: { completed: { type: "BOOLEAN" } } },
          },
          required: ["ids", "patch"],
        },
      },
      {
        name: "clearChecklistItems",
        description: "Wipe all six checklist marks + text on a single planet.",
        parameters: {
          type: "OBJECT",
          properties: { workOrder: { type: "STRING" } },
          required: ["workOrder"],
        },
      },
      {
        name: "addChecklistItem",
        description:
          "Toggle a checklist key on a planet. Keys: trafficControl, eight11, preCon, jobStart, routedSrpRtasq, hsr.",
        parameters: {
          type: "OBJECT",
          properties: {
            workOrder: { type: "STRING" },
            key: { type: "STRING" },
            text: { type: "STRING" },
          },
          required: ["workOrder", "key"],
        },
      },
      {
        name: "editChecklistItem",
        description: "Update the text for a single checklist key (keeps the toggle state).",
        parameters: {
          type: "OBJECT",
          properties: {
            workOrder: { type: "STRING" },
            key: { type: "STRING" },
            text: { type: "STRING" },
          },
          required: ["workOrder", "key", "text"],
        },
      },
      {
        name: "setJobField",
        description:
          "Mutate one Smartsheet-backed field on a job. Whitelist: notes, splicingNotes, rawSecondaryStatus, jobStatus, address, city, zip, scheduleDate, endDate, dueDate, crew, permitNumber, workType, base, bidValue.",
        parameters: {
          type: "OBJECT",
          properties: {
            workOrder: { type: "STRING" },
            field: { type: "STRING" },
            value: { type: "STRING" },
          },
          required: ["workOrder", "field"],
        },
      },
      {
        name: "createJob",
        description: "Local-only stub — surfaces a reminder for Smartsheet manual entry.",
        parameters: {
          type: "OBJECT",
          properties: {
            workOrder: { type: "STRING" },
            status: { type: "STRING" },
          },
          required: ["workOrder"],
        },
      },
      {
        name: "archiveJob",
        description: "Local-only stub — surfaces a reminder for Smartsheet manual archive.",
        parameters: {
          type: "OBJECT",
          properties: { workOrder: { type: "STRING" } },
          required: ["workOrder"],
        },
      },
      {
        name: "composeEmail",
        description: "Save a draft in the reminder strip. Does NOT auto-send.",
        parameters: {
          type: "OBJECT",
          properties: {
            to: { type: "STRING" },
            cc: { type: "STRING" },
            subject: { type: "STRING" },
            body: { type: "STRING" },
            threadId: { type: "STRING" },
          },
          required: ["to", "subject", "body"],
        },
      },
      {
        name: "sendEmail",
        description: "Send an email. Refuses unless confirm === true.",
        parameters: {
          type: "OBJECT",
          properties: {
            to: { type: "STRING" },
            subject: { type: "STRING" },
            body: { type: "STRING" },
            threadId: { type: "STRING" },
            confirm: { type: "BOOLEAN" },
          },
          required: ["to", "subject", "body", "confirm"],
        },
      },
      {
        name: "replyToThread",
        description: "Reply on an existing thread. Refuses unless confirm === true.",
        parameters: {
          type: "OBJECT",
          properties: {
            threadId: { type: "STRING" },
            body: { type: "STRING" },
            confirm: { type: "BOOLEAN" },
          },
          required: ["threadId", "body", "confirm"],
        },
      },
      {
        name: "forwardThread",
        description: "Forward a thread to a new recipient. Refuses unless confirm === true.",
        parameters: {
          type: "OBJECT",
          properties: {
            threadId: { type: "STRING" },
            to: { type: "STRING" },
            body: { type: "STRING" },
            confirm: { type: "BOOLEAN" },
          },
          required: ["threadId", "to", "confirm"],
        },
      },
      {
        name: "clearMemory",
        description: "Wipe Lumina's persistent memory. scope: facts | summary | all.",
        parameters: {
          type: "OBJECT",
          properties: { scope: { type: "STRING" } },
          required: ["scope"],
        },
      },
      {
        name: "forgetFact",
        description: "Fuzzy-match + remove a single memory fact.",
        parameters: {
          type: "OBJECT",
          properties: { text: { type: "STRING" } },
          required: ["text"],
        },
      },
      {
        name: "setMemoryFact",
        description: "Add or update a memory fact. If id supplied, updates that fact; otherwise creates new.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING" },
            value: { type: "STRING" },
          },
          required: ["value"],
        },
      },
      {
        name: "setHudMode",
        description: "Flip the HUD between minimized and expanded.",
        parameters: {
          type: "OBJECT",
          properties: { mode: { type: "STRING", enum: ["minimized", "expanded"] } },
          required: ["mode"],
        },
      },
      {
        name: "setOrientation",
        description: "Flip the HUD orientation between vertical and horizontal.",
        parameters: {
          type: "OBJECT",
          properties: { orientation: { type: "STRING", enum: ["vertical", "horizontal"] } },
          required: ["orientation"],
        },
      },
      {
        name: "enterFocusMode",
        description: "Engage 50/50 focus mode. Optional workOrder focuses that job first.",
        parameters: {
          type: "OBJECT",
          properties: { workOrder: { type: "STRING" } },
        },
      },
      {
        name: "exitFocusMode",
        description: "Back to default 70/30 layout (or universe view).",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "openGmail",
        description:
          "Open Billy's Gmail in a new browser tab, scoped to the 'North Sky' label. USE-WHEN Billy says 'open gmail', 'open my email', 'open my inbox', 'show me my inbox', 'open north sky', 'take me to gmail'. Do NOT use for in-app actions (listNorthSkyEmails / readThread handle those). This is the only way to escape the cockpit and land directly on the operator's real inbox.",
        parameters: { type: "OBJECT", properties: {} },
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
