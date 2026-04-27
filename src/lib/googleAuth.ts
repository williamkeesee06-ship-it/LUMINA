/**
 * Google OAuth via Google Identity Services token client (implicit flow).
 * Browser-side only. The access token lives in memory and is sent in the
 * Authorization header to /api proxies. Token expiry is honored by GIS.
 *
 * Per OAuth spec, the user must click a button to grant access — we cannot
 * silently auth. The HUD exposes a "Connect Google" affordance.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
            error_callback?: (err: unknown) => void;
          }) => { requestAccessToken: (overrides?: { prompt?: string }) => void };
          revoke: (token: string, cb?: () => void) => void;
        };
      };
    };
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

let scriptLoading: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => res();
    s.onerror = () => rej(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(s);
  });
  return scriptLoading;
}

export async function requestGoogleToken(
  opts: { interactive?: boolean } = {},
): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) throw new Error("Google Client ID not configured.");
  await loadGisScript();
  // Default to interactive consent — the first time a user connects, GIS will
  // not show a popup with prompt:"" and silently fails. Forcing "consent"
  // (or "select_account") makes it always show the picker.
  const promptMode = opts.interactive === false ? "" : "consent";
  return new Promise((res, rej) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) rej(new Error(resp.error));
        else if (resp.access_token) res(resp.access_token);
        else rej(new Error("No access token returned."));
      },
      error_callback: (e) => {
        // GIS sometimes hands back { type: "popup_closed" } or popup_failed_to_open
        const msg =
          e && typeof e === "object" && "type" in e
            ? String((e as { type: string }).type)
            : e instanceof Error
              ? e.message
              : String(e);
        rej(new Error(msg));
      },
    });
    client.requestAccessToken({ prompt: promptMode });
  });
}

export function revokeGoogleToken(token: string): Promise<void> {
  return new Promise((res) => {
    if (!window.google?.accounts) {
      res();
      return;
    }
    window.google.accounts.oauth2.revoke(token, () => res());
  });
}
