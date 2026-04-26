# LUMINA V3

Tactical command system for North Sky operations. A cinematic 3D universe of construction work, controlled through a three-mode HUD, assisted by a command-first Gemini intelligence named LUMINA.

## What it is

- **3D universe** as the primary navigation layer (Universe → Galaxy → Planet)
- **Three-mode tactical HUD** (minimized · standard · expanded)
- **LUMINA Gemini AI** — seductive tactical, command-first, navigation tool calls
- **Honest empty states** — never fabricate jobs, threads, or files
- **Real integrations** — Smartsheet (jobs) · Google Gmail/Drive (satellites/moons) · Google Maps (tactical map)

## Stack

- Vite + React 18 + TypeScript
- react-three-fiber + drei + postprocessing (3D)
- Zustand (canonical UI store)
- Tailwind CSS (utility layer) + custom CSS (HUD/visuals)
- Vercel serverless functions for secrets

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in keys
npm run dev                  # vite on :5173
node scripts/local-api.mjs   # local /api gateway on :3001 (in another terminal)
```

`npm run dev` runs Vite. The Vite proxy forwards `/api/*` to `localhost:3001` in dev. In production, Vercel serves `api/*.ts` natively as serverless functions — no proxy needed.

To run the local API gateway you need `tsx` and `dotenv`:

```bash
npm i -D tsx dotenv
```

## Deploy (GitHub + Vercel)

1. `git init && git add -A && git commit -m "LUMINA V3 initial"`
2. Create a new GitHub repo and push.
3. Import the repo into Vercel.
4. In **Settings → Environment Variables**, add:
   - `SMARTSHEET_TOKEN` (server-side only)
   - `GEMINI_API_KEY` (server-side only)
   - `GOOGLE_MAPS_API_KEY` (server-side; can reuse the browser key but a separate unrestricted server key is cleaner)
   - `VITE_GOOGLE_MAPS_API_KEY` (browser; restrict by HTTP referrer in Google Cloud Console)
   - `VITE_GOOGLE_CLIENT_ID` (browser; OAuth client ID)
5. **Google OAuth client → Authorized JavaScript origins**: add your Vercel URL (e.g. `https://lumina-v3.vercel.app`) and any custom domains.
6. Deploy. The included `vercel.json` configures the build and the `api/*` functions.

## Data binding

- **Source sheet:** `1833739362822020` — *2023 - 2028 Western WA Project Tracker*
- **Filter:** `Construction Supervisor = "Billy Keesee"` (server-side)
- **Galaxy mapping:** `Secondary Job Status` → 7 canonical galaxies (see `src/lib/statusMap.ts`).
- **Cancelled** rows are excluded from the universe.

## Phase one scope

Voice is deferred. The mic affordance is rendered in a disabled state per the bible. Phase two adds voice and live conversational mode.

## Security notes

- `SMARTSHEET_TOKEN` and `GEMINI_API_KEY` are server-only — they never reach the browser.
- The Google **client secret** (`GOCSPX-…`) is **not used** by this app; the implicit OAuth flow uses only the public client ID. **Rotate the client secret** in Google Cloud Console — it should never have been exposed.
- The Google access token lives only in browser memory (Zustand). It is never persisted or sent server-side except as an `Authorization` header forwarded to Google APIs by our proxies (which never log it).
