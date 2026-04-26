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

export async function requestGoogleToken(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) throw new Error("Google Client ID not configured.");
  await loadGisScript();
  return new Promise((res, rej) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) rej(new Error(resp.error));
        else if (resp.access_token) res(resp.access_token);
        else rej(new Error("No access token returned."));
      },
      error_callback: (e) => rej(e instanceof Error ? e : new Error(String(e))),
    });
    client.requestAccessToken({ prompt: "" });
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
