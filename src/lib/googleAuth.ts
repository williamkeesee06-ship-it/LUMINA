/**
 * Google OAuth via Google Identity Services token client (implicit flow).
 * Browser-side only. The access token lives in memory and is sent in the
 * Authorization header to /api proxies. Token expiry is honored by GIS.
 *
 * Per OAuth spec, the user must click a button to grant access — we cannot
 * silently auth. The Orb Auth Panel exposes a "Sign in" affordance and a
 * "Re-authorize with new scopes" path for adding gmail.modify + gmail.send
 * without forcing a full sign-out.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: {
              access_token?: string;
              error?: string;
              scope?: string;
            }) => void;
            error_callback?: (err: unknown) => void;
          }) => { requestAccessToken: (overrides?: { prompt?: string }) => void };
          revoke: (token: string, cb?: () => void) => void;
        };
      };
    };
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";

/**
 *  Full scope list — Gmail moons + send + calendar.
 *  Order is significant for the consent screen rollup (Gmail group first
 *  reads cleanly to the user). gmail.readonly is kept for back-compat with
 *  the older list-only proxy; gmail.modify supersedes it for new writes.
 */
export const LUMINA_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

/**
 *  Plain-English descriptions surfaced in the Orb Auth Panel. Keyed by the
 *  full scope URL so we can render "what was granted" without parsing the
 *  scope string.
 */
export const SCOPE_LABELS: Record<string, string> = {
  "https://www.googleapis.com/auth/gmail.readonly": "Read email (legacy fallback)",
  "https://www.googleapis.com/auth/gmail.modify": "Read & modify email (mark read, draft)",
  "https://www.googleapis.com/auth/gmail.send": "Send email replies on your behalf",
  "https://www.googleapis.com/auth/drive.readonly": "Read Google Drive files",
  "https://www.googleapis.com/auth/calendar.readonly": "Read Google Calendar",
  "https://www.googleapis.com/auth/calendar.events": "Create / update calendar events",
};

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

export interface TokenResult {
  accessToken: string;
  /** Space-separated list of scopes Google actually granted (subset of asked). */
  grantedScopes: string[];
}

interface TokenOpts {
  /** Whether to show the consent screen. Defaults to "consent". */
  prompt?: "" | "consent" | "select_account";
  /** Scopes to request. Defaults to LUMINA_SCOPES. */
  scopes?: readonly string[];
}

/**
 *  Request a Google access token via GIS. Returns the granted scope set so
 *  the OrbAuthPanel can show the user which scopes Google actually approved
 *  (some users / orgs can deny individual scopes during the consent flow).
 */
export async function requestGoogleToken(
  opts: TokenOpts | { interactive?: boolean } = {},
): Promise<TokenResult> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) throw new Error("Google Client ID not configured.");
  await loadGisScript();

  // Back-compat: callers can pass { interactive: false } (legacy) — map to
  // prompt: "". Default is "consent" so first-time auth always surfaces the
  // chooser and Google reliably hands back a token.
  let promptMode: string = "consent";
  let scopes: readonly string[] = LUMINA_SCOPES;
  if ("interactive" in opts && opts.interactive === false) {
    promptMode = "";
  } else if ("prompt" in opts && typeof opts.prompt === "string") {
    promptMode = opts.prompt;
  }
  if ("scopes" in opts && Array.isArray(opts.scopes)) {
    scopes = opts.scopes;
  }

  return new Promise((res, rej) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: scopes.join(" "),
      callback: (resp) => {
        if (resp.error) {
          rej(new Error(resp.error));
          return;
        }
        if (resp.access_token) {
          const granted = (resp.scope ?? scopes.join(" ")).split(/\s+/).filter(Boolean);
          res({ accessToken: resp.access_token, grantedScopes: granted });
          return;
        }
        rej(new Error("No access token returned."));
      },
      error_callback: (e) => {
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

/**
 *  Convenience helper used by the Orb Auth Panel — first-time sign-in flow.
 *  Triggers GIS with prompt:"consent" so the consent screen always shows
 *  and the granted-scopes set arrives in the callback.
 */
export function signIn(scopes?: readonly string[]): Promise<TokenResult> {
  return requestGoogleToken({ prompt: "consent", scopes });
}

/**
 *  Re-authorize an already-signed-in user with the new scope set. Same as
 *  signIn but semantically distinct in the UI — used to add gmail.modify /
 *  gmail.send to an account that previously only granted gmail.readonly,
 *  without making the user fully sign out and back in.
 */
export function reauth(scopes?: readonly string[]): Promise<TokenResult> {
  return requestGoogleToken({ prompt: "consent", scopes });
}

/** Account switcher — GIS picker shows the chooser even if one account is signed in. */
export function switchAccount(scopes?: readonly string[]): Promise<TokenResult> {
  return requestGoogleToken({ prompt: "select_account", scopes });
}

/**
 *  Sign out — revoke the live token and clear local state. The caller is
 *  responsible for clearing the token from the Zustand store; this helper
 *  only handles the GIS-side revocation.
 */
export function signOut(token: string | null): Promise<void> {
  return new Promise((res) => {
    if (!token || !window.google?.accounts) {
      res();
      return;
    }
    window.google.accounts.oauth2.revoke(token, () => res());
  });
}

export function revokeGoogleToken(token: string): Promise<void> {
  return signOut(token);
}

/**
 *  Ask Google what scopes a live token actually has. Used by the Orb Auth
 *  Panel when the user wants to see what they granted. Returns the granted
 *  scope set or null if the token is invalid.
 */
export async function getGrantedScopes(token: string): Promise<string[] | null> {
  try {
    const r = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(
        token,
      )}`,
    );
    if (!r.ok) return null;
    const data = (await r.json()) as { scope?: string };
    return (data.scope ?? "").split(/\s+/).filter(Boolean);
  } catch {
    return null;
  }
}

/**
 *  Fetch the signed-in user's profile (email, picture). The Orb Auth Panel
 *  uses this to show the avatar + email after sign-in. The userinfo endpoint
 *  works with any token that has profile/email scopes — gmail.readonly
 *  alone is enough because Google bundles basic identity with it.
 */
export interface GoogleUserInfo {
  email: string;
  name?: string;
  picture?: string;
}
export async function fetchUserInfo(token: string): Promise<GoogleUserInfo | null> {
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return (await r.json()) as GoogleUserInfo;
  } catch {
    return null;
  }
}
