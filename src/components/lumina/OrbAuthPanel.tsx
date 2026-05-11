import { useEffect, useState } from "react";
import { useUI } from "@/store/uiStore";
import {
  signIn,
  signOut,
  reauth,
  switchAccount,
  fetchUserInfo,
  getGrantedScopes,
  LUMINA_SCOPES,
  SCOPE_LABELS,
} from "@/lib/googleAuth";
import { sfx } from "@/lib/audio";
import { stopWatcher, startWatcher } from "@/lib/northSkyWatcher";

/**
 *  OrbAuthPanel — Lumina's Account / OAuth surface.
 *
 *  Double-click the central LUMINA orb to open. Surfaces sign-in, sign-out,
 *  re-authorize (used to add the new gmail.modify / gmail.send scopes
 *  without forcing a full sign-out), account switch, and the live granted-
 *  scope set in plain English so the operator can see what Google approved.
 *
 *  Triggers the North Sky watcher after a successful sign-in / re-auth so
 *  moons start spawning within ~60 s of granting scopes.
 */

const NEON_GREEN = "#39FF7A";
const NEON_GREEN_BRIGHT = "#7CFFA8";
const NEON_BLUE = "#3D7BFF";
const NEON_BLUE_BRIGHT = "#6DA3FF";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Anchor (left + bottom) so the panel renders above the orb's seat. */
  anchorLeft: number;
  anchorBottom: number;
}

export function OrbAuthPanel({ open, onClose, anchorLeft, anchorBottom }: Props) {
  const googleToken = useUI((s) => s.googleToken);
  const setGoogleToken = useUI((s) => s.setGoogleToken);
  const googleAccount = useUI((s) => s.googleAccount);
  const setGoogleAccount = useUI((s) => s.setGoogleAccount);
  const grantedScopes = useUI((s) => s.googleGrantedScopes);
  const setGrantedScopes = useUI((s) => s.setGoogleGrantedScopes);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When the panel opens with a live token but no cached account / scopes,
  // backfill them from Google's userinfo + tokeninfo endpoints so the user
  // doesn't see "Not signed in" right after a hot reload.
  useEffect(() => {
    if (!open || !googleToken) return;
    if (!googleAccount) {
      fetchUserInfo(googleToken).then((u) => {
        if (u) setGoogleAccount(u);
      });
    }
    if (grantedScopes.length === 0) {
      getGrantedScopes(googleToken).then((sc) => {
        if (sc) setGrantedScopes(sc);
      });
    }
  }, [open, googleToken, googleAccount, grantedScopes.length, setGoogleAccount, setGrantedScopes]);

  if (!open) return null;

  const hasNewScopes =
    grantedScopes.includes("https://www.googleapis.com/auth/gmail.modify") &&
    grantedScopes.includes("https://www.googleapis.com/auth/gmail.send");

  const doSignIn = async (mode: "signIn" | "reauth" | "switch") => {
    setError(null);
    setBusy(true);
    try {
      sfx.select();
      const fn = mode === "signIn" ? signIn : mode === "reauth" ? reauth : switchAccount;
      const result = await fn(LUMINA_SCOPES);
      setGoogleToken(result.accessToken);
      setGrantedScopes(result.grantedScopes);
      const u = await fetchUserInfo(result.accessToken);
      if (u) setGoogleAccount(u);
      // Kick the watcher. resetSeen on full sign-in so we re-ingest, not on
      // re-auth which just expanded scopes — the existing seen-set is still
      // accurate.
      startWatcher(result.accessToken, { resetSeen: mode === "signIn" });
      sfx.confirm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "popup_closed") setError(msg);
      sfx.error();
    } finally {
      setBusy(false);
    }
  };

  const doSignOut = async () => {
    setError(null);
    setBusy(true);
    try {
      stopWatcher();
      await signOut(googleToken);
      setGoogleToken(null);
      setGoogleAccount(null);
      setGrantedScopes([]);
      sfx.select();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-out error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="pointer-events-auto fixed z-[70]"
      style={{ left: anchorLeft, bottom: anchorBottom, width: 360 }}
    >
      <div
        className="rounded-[2px] overflow-hidden"
        style={{
          background: "#000",
          border: `1px solid ${NEON_GREEN}55`,
          boxShadow: `0 0 32px ${NEON_GREEN}33, 0 18px 60px #000c`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: `1px solid ${NEON_GREEN}33` }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: NEON_GREEN, boxShadow: `0 0 8px ${NEON_GREEN}` }}
            />
            <span
              className="font-display tracking-tactical text-[11px] uppercase"
              style={{ color: NEON_GREEN_BRIGHT, textShadow: `0 0 6px ${NEON_GREEN}88` }}
            >
              orb · account
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-white/50 hover:text-white text-lg leading-none px-1"
          >
            ×
          </button>
        </div>

        {/* Account state */}
        <div className="px-4 py-3 flex items-center gap-3">
          {googleAccount?.picture ? (
            <img
              src={googleAccount.picture}
              alt=""
              className="w-12 h-12 rounded-full"
              style={{ border: `1px solid ${NEON_GREEN}66` }}
            />
          ) : (
            <div
              className="w-12 h-12 grid place-items-center rounded-full font-display text-sm"
              style={{
                color: NEON_GREEN_BRIGHT,
                background: "#000",
                border: `1px solid ${NEON_GREEN}55`,
              }}
            >
              ?
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div
              className="text-sm text-white truncate"
              style={{ textShadow: "0 0 4px rgba(255,255,255,0.4)" }}
            >
              {googleAccount?.email ?? (googleToken ? "Connected" : "Not signed in")}
            </div>
            <div className="font-mono text-[10px] text-white/45 truncate">
              {googleToken
                ? hasNewScopes
                  ? "all lumina scopes granted"
                  : "missing gmail.modify or gmail.send — re-authorize"
                : "click sign in to connect google"}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pb-3 grid grid-cols-2 gap-2">
          {!googleToken && (
            <button
              type="button"
              disabled={busy}
              onClick={() => doSignIn("signIn")}
              className="col-span-2 font-display text-[12px] uppercase tracking-tactical px-3 py-2 rounded-sm disabled:opacity-40"
              style={{
                color: "#000",
                background: NEON_GREEN,
                boxShadow: `0 0 14px ${NEON_GREEN}cc`,
              }}
            >
              sign in
            </button>
          )}
          {googleToken && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => doSignIn("reauth")}
                className="col-span-2 font-display text-[12px] uppercase tracking-tactical px-3 py-2 rounded-sm disabled:opacity-40"
                style={{
                  color: hasNewScopes ? NEON_GREEN_BRIGHT : "#000",
                  background: hasNewScopes ? "transparent" : NEON_GREEN,
                  border: `1px solid ${NEON_GREEN}88`,
                  boxShadow: hasNewScopes ? "none" : `0 0 14px ${NEON_GREEN}cc`,
                }}
                title="Trigger Google's consent screen with the full Lumina scope list. Use this to add gmail.modify + gmail.send to an existing account without signing out."
              >
                {hasNewScopes ? "re-authorize (refresh)" : "re-authorize with new scopes"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => doSignIn("switch")}
                className="font-mono text-[11px] uppercase tracking-tactical px-3 py-1.5 rounded-sm disabled:opacity-40"
                style={{
                  color: NEON_BLUE_BRIGHT,
                  border: `1px solid ${NEON_BLUE}66`,
                  background: "transparent",
                }}
              >
                switch account
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={doSignOut}
                className="font-mono text-[11px] uppercase tracking-tactical px-3 py-1.5 rounded-sm disabled:opacity-40"
                style={{
                  color: "#FF6B6B",
                  border: "1px solid #FF6B6B55",
                  background: "transparent",
                }}
              >
                sign out
              </button>
            </>
          )}
        </div>

        {/* Granted scopes */}
        {grantedScopes.length > 0 && (
          <div
            className="px-4 py-3 max-h-[180px] overflow-y-auto"
            style={{ borderTop: `1px solid ${NEON_GREEN}26` }}
          >
            <div className="font-mono text-[10px] uppercase tracking-tactical text-white/50 mb-2">
              granted scopes
            </div>
            <ul className="space-y-1.5">
              {grantedScopes
                .filter((s) => s.startsWith("https://"))
                .map((s) => (
                  <li
                    key={s}
                    className="flex items-start gap-2 text-[11px] text-white/80 leading-snug"
                  >
                    <span
                      className="mt-1 w-1 h-1 rounded-full shrink-0"
                      style={{ background: NEON_GREEN, boxShadow: `0 0 4px ${NEON_GREEN}` }}
                    />
                    <span>{SCOPE_LABELS[s] ?? s.replace("https://www.googleapis.com/auth/", "")}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {error && (
          <div
            className="px-4 py-2 font-mono text-[11px]"
            style={{
              color: "#FF6B6B",
              borderTop: "1px solid #FF6B6B55",
              background: "#FF6B6B11",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
