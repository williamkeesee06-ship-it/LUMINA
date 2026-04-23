# LUMINA - Cosmic Dashboard Architecture

LUMINA is a live visual coordination dashboard for construction workflows. It translates structured backend data (e.g., Smartsheets, Drive, Gmail) into an interactive, 3D universe that developers and managers can navigate instantly.

## 1. Action Authority
By design, LUMINA is fully authorized to act on behalf of the user in three primary vectors:
- **Draft and send emails:** Trigger contextual communication directly from the interface ("LUMINA, email John that P123456 is complete"). 
- **Open documents:** Deep-link and open Drive files based on intent ("Open the latest TCP for P123456").
- **Update Smartsheets / trackers:** Push data reliably bridging chat intent with structured grids ("Move P123456 to complete").

## 2. Universe Sync (Single Source of Truth)
The core dynamic rule is **sheet status changes ↔︎ universe layout change**.
- Data updates inherently drive the 3D scene representation.
- Example: When a job's secondary status moves to "Complete", the planet transitions out of its active galaxy and animates precisely into the Completed cluster.
- All gauges, lists, and HUD indicators update in sync with these state transitions.

## 3. Project Notes Convention
LUMINA abides by a strict persistent mini-log methodology for job tracking updates:
- **Never overwrite.**
- Always prepend the date string format: `YYYY-MM-DD: <note text>`
- Append the new message to existing textual notes inside the designated Tracker.

## 4. Command Semantics
Our imperative language encompasses clear intents:
- **Status Mutations:** `"Move P123456 to complete."`
- **Notes Extensions:** `"Add a note to NSC for P123456: fielded conduit..."`
- **Email Generation:** `"Email inspector about P123456: ask if Friday is available..."`
- **Doc Retrieval:** `"Open the redlines for P123456."`
- **Map / Routes:** `"Plan a route to field P1234, P123457..."`

## 5. Fixed Interaction Model
To maintain seamless user trust, the interface provides a permanent interaction anchor at the bottom of the screen. 
- **Text Mode (Default):** Stationary input at the bottom. Exchanges are preserved in the text log.
- **Voice Query Mode (One-Shot):** Tapped via the microphone icon. A neon outline brightens into an active glow. The query is spoken, transcribed, acted upon, and automatically stopped.
- **Gemini Live Mode (Dyson Sphere):** Persistent, non-stop session. An active Dyson pulse signifies LUMINA is in open-mic, back-and-forth conversational mode helping with ongoing context tasks. 

*Voice Persona:* Sexy, professional, dry-witty (no sarcasm on critical alerts).

## 6. Premium Command Layer (HUD)
The HUD operates as the primary operational control layer with the following fixed rules:
- **Gauge-Centric:** Dashboard gauges are the core interactive elements (count + category identity + click-to-travel). The map button is visually unified into this same gauge language.
- **Dynamic Context:** The HUD persists across major modes but adapts content:
  - *Universe mode:* Gauges show top-level categories.
  - *Galaxy mode:* Gauges shift to subcategory breakdowns.
  - *Map mode:* Gauges act as filters/planners while the map takes visual priority.
- **Behavior & Alerts:**
  - Click a category gauge -> Travel to that galaxy/subcluster.
  - Click Map gauge -> Switch to Seattle tactical map.
  - Gauges glow in category color, intensifying when active.
  - *New Jobs:* Relevant gauge pulses.
  - *Comms/Email:* Dedicated mail gauge pulses separately.
  - *Critical Issues:* Stronger, elegant alert state.

## 7. Tactical Map Mode
The map is a permanent product feature that seamlessly transitions from galaxy space down to a grounded Earth view via the HUD:
- **Dark Puget Sound Basemap:** Specifically designed dark basemaps let overlaid neon data stand out clearly.
- **Job Pins:** Pins are colored by category with job-number-only labels.
- **Interactive UI:** Features clickable holographic info cards for deep-dive job info without leaving the map.
- **Tooling workflows:** Designed for interactive web maps supporting multi-point distance measurement and multi-stop route planning workflows.
- **Brand Identity:** Persistent NorthSky branding anchors the visual identity in every mode.

## 8. System Ownership
Shared behavioral state is centralized; adaptive UI patterns operate on a shared event bus to remain synchronized instead of scattered across isolated widgets.
- **App (Top-Level Controller):** Source of truth for all major state.
- **Experience:** Camera logic, 3D scene orchestration, orb escort behavior.
- **OrbController:** Orb position, mode, animation priority, escort offsets.
- **VoiceController:** Persona rules, response mode, speech style flags.
- **LearningController:** Track movement habits, revisits, dwell time, suggestions.
- **HUDController:** Gauges, cards, alerts, command surfaces.

## 9. Core State Model
A compact, intentional global state model coordinates the entire dashboard:
- `viewMode`: `universe | galaxy | planet | earth | map`
- `activeStatus`: currently focused category.
- `focusedGalaxy`: selected galaxy cluster.
- `selectedJob`: current job shown in card.
- `orbMode`: `idle | escort | minorAction | majorTaskThinking | alert`
- `orbEscortMode`: `roam | lead | inspect`
- `voiceMode`: `silent | assistive | conversational | fullGemini`
- `systemActivity`: `idle | loading | syncing | analyzing`
- `learningSignals`: recent paths, repeat selections, dwell zones, preferred actions.

## 10. Event Model
Clear, specific events drive orb animation, HUD pulses, card visibility, camera behavior, and learning updates from a central behavior system, ensuring cinematic coordination.
- `JOB_SELECTED`
- `STATUS_FOCUSED`
- `GALAXY_ENTERED`
- `PLANET_ENTERED`
- `CAMERA_TRAVEL_STARTED`
- `CAMERA_TRAVEL_COMPLETED`
- `MINOR_AI_ACTION`
- `MAJOR_AI_ACTION_STARTED`
- `MAJOR_AI_ACTION_COMPLETED`
- `NEW_JOB_ARRIVED`
- `VOICE_MODE_CHANGED`
- `USER_PATTERN_OBSERVED`

## 11. Phase Plan
- **Phase 1: Emotional Core:** Orb escort behavior tied to camera. Camera travel states. Voice persona rules/switching. Minor vs major orb feedback.
- **Phase 2: Command Surfaces:** Job detail card. HUD gauge tiles. Category focus and teleport behavior. Alert pulses for jobs and communications.
- **Phase 3: Universe Polish:** Galaxy refinement, pending subclusters, dust, stars, streaks. Watermark and finishing visual hierarchy. Premium transition tuning.
- **Phase 4: Adaptive Intelligence:** Track movement/habits. Build suggestion logic. Quiet self-improvement behavior with occasionally surfaced insights.

## 12. Build Rules
These constraints MUST remain fixed throughout development:
- **Orb Positioning:** The orb never blocks the object you are meant to inspect.
- **VFX Usage:** Rainbow mode is reserved for major operations *only*.
- **Restraint:** Minor AI responses use restrained feedback only.
- **Tone:** Sarcasm is completely disabled for risk, failure, or critical operational messaging.
- **Subtlety:** Learning changes behavior quietly first, visibly second.
- **Readability:** HUD overlays stay readable and premium, never cluttered.
