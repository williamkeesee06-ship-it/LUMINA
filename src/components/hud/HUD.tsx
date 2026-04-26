import { clsx } from "clsx";
import { useMemo } from "react";
import { useUI, selectGalaxyCounts } from "@/store/uiStore";
import { GALAXIES } from "@/types";
import { GALAXY_COLORS } from "@/lib/statusMap";
import type { Galaxy } from "@/types";

const GALAXY_SHORT: Record<Galaxy, string> = {
  Complete: "Complete",
  "Fielded-RTS": "Fielded",
  "Needs Fielding": "Needs Fld",
  "On Hold": "On Hold",
  Pending: "Pending",
  "Routed to Sub": "Sub",
  Scheduled: "Sched",
};
import { Gauge } from "./Gauge";
import { CircleWidget } from "./CircleWidget";
import { DysonCore } from "./DysonCore";
import { Orb } from "@/components/lumina/Orb";
import { sfx } from "@/lib/audio";
import { requestGoogleToken } from "@/lib/googleAuth";

/**
 * The three-mode tactical HUD — industrial command bezel with multi-band
 * gauges and stat tiles. Inspired by deep-space command-deck dashboards.
 */
export function HUD() {
  const hudMode = useUI((s) => s.hudMode);
  const setHudMode = useUI((s) => s.setHudMode);
  const toggleHud = useUI((s) => s.toggleHud);
  const counts = useUI(selectGalaxyCounts);
  const enterGalaxy = useUI((s) => s.enterGalaxy);
  const focusedGalaxy = useUI((s) => s.focusedGalaxy);
  const jobs = useUI((s) => s.jobs);
  const loading = useUI((s) => s.loading);
  const error = useUI((s) => s.error);
  const unreadCount = useUI((s) => s.unreadCount);
  const googleToken = useUI((s) => s.googleToken);
  const setGoogleToken = useUI((s) => s.setGoogleToken);
  const setMapOpen = useUI((s) => s.setMapOpen);
  const isMapOpen = useUI((s) => s.isMapOpen);

  const universeVitality = useMemo(() => {
    if (loading) return 18;
    if (error) return 0;
    let v = 60;
    if (jobs.length > 0) v += 24;
    if (googleToken) v += 14;
    return Math.min(v, 100);
  }, [loading, error, jobs.length, googleToken]);

  const total = jobs.length;

  return (
    <div className="pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 z-30 w-[min(96vw,1480px)]">
      {/* Top rails row — sits above the plate */}
      <div className="pointer-events-auto flex items-center justify-between px-6 mb-1.5 font-mono text-[10px] uppercase tracking-tactical relative">
        <div className="flex items-center gap-2 text-cyan-glow/70">
          {/* placeholder so center chevrons stay truly centered */}
          <span className="opacity-0 select-none">.</span>
        </div>

        {/* Centered glowing-orange chevron mode switcher */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-1 flex items-center gap-3 pointer-events-auto">
          <ChevronModeButton
            direction="up"
            disabled={hudMode === "expanded"}
            onClick={() => {
              sfx.select();
              setHudMode(hudMode === "minimized" ? "standard" : "expanded");
            }}
            label="Expand HUD"
          />
          <ChevronModeButton
            direction="down"
            disabled={hudMode === "minimized"}
            onClick={() => {
              sfx.select();
              setHudMode(hudMode === "expanded" ? "standard" : "minimized");
            }}
            label="Minimize HUD"
          />
        </div>

        <div className="flex items-center gap-2 text-cyan-glow/70">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-glow shadow-[0_0_10px_#3CFFD2]" />
          <span>posture</span>
          <span className="text-white">{focusedGalaxy ? focusedGalaxy : "universe"}</span>
        </div>
      </div>

      {/* Bezel wrapper — holds bezel and an unclipped caption strip */}
      <div className="relative">
        {/* Brand caption — floats above clipped bezel */}
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-2.5 z-30">
          <div className="caption-strip">NORTH SKY · COMMAND</div>
        </div>

      {/* Command bezel */}
      <div
        className={clsx(
          "pointer-events-auto command-bezel clip-corner-md relative",
          "transition-[height,padding,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        )}
      >

        {/* Body */}
        {hudMode === "minimized" && (
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <DysonCore size={44} />
              <div className="font-display text-xs uppercase tracking-tactical text-cyan-glow/70">
                LUMINA · standby
              </div>
            </div>
            <Orb size={36} />
          </div>
        )}

        {/* Decorative rivets along bezel edges */}
        {hudMode !== "minimized" && (
          <>
            <span className="rivet" style={{ left: 8, top: 8 }} />
            <span className="rivet" style={{ right: 8, top: 8 }} />
            <span className="rivet" style={{ left: 8, bottom: 8 }} />
            <span className="rivet" style={{ right: 8, bottom: 8 }} />
            <span className="rivet" style={{ left: "25%", top: 8 }} />
            <span className="rivet" style={{ left: "50%", top: 8 }} />
            <span className="rivet" style={{ left: "75%", top: 8 }} />
            <span className="rivet" style={{ left: "25%", bottom: 8 }} />
            <span className="rivet" style={{ left: "50%", bottom: 8 }} />
            <span className="rivet" style={{ left: "75%", bottom: 8 }} />
          </>
        )}

        {hudMode !== "minimized" && (
          <div className="flex items-stretch px-6 py-3 gap-4">
            {/* Left bay: Dyson + identity */}
            <div className="flex items-center gap-4 pr-2">
              <DysonCore size={56} />
              <div className="hidden lg:block">
                <div className="font-display text-[11px] uppercase tracking-tactical text-cyan-glow/70">
                  LUMINA V3
                </div>
                <div className="font-mono text-[10px] text-white/50">
                  Operator · Billy Keesee
                </div>
                <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 border border-cyan-glow/20 bg-black/40 rounded-sm">
                  <span className="w-1 h-1 rounded-full bg-teal-glow shadow-[0_0_6px_#3CFFD2]" />
                  <span className="font-mono text-[8px] uppercase tracking-[0.24em] text-teal-glow">
                    online
                  </span>
                </div>
              </div>
            </div>

            <Divider />

            {/* Gauge bay — three core telemetry gauges */}
            <div className="gauge-bay px-4 py-2 rounded-[2px] flex items-center gap-3">
              <Gauge label="Total" value={total} tone="cyan" rainbow />
              <Gauge
                label={googleToken ? "Gmail" : "Connect"}
                value={googleToken ? unreadCount : "→"}
                tone={unreadCount > 0 ? "magenta" : googleToken ? "cyan" : "amber"}
                pulse={!googleToken || unreadCount > 0}
                onClick={async () => {
                  if (googleToken) return;
                  try {
                    sfx.select();
                    const tk = await requestGoogleToken();
                    setGoogleToken(tk);
                    sfx.confirm();
                  } catch (err) {
                    sfx.error();
                    const msg = err instanceof Error ? err.message : String(err);
                    // Visible error so the user knows what happened
                    // (popup_blocked / popup_closed / unauthorized_client / etc.)
                    console.warn("[Lumina] Google sign-in failed:", msg);
                    if (msg === "popup_failed_to_open") {
                      alert(
                        "Google sign-in popup was blocked. Allow popups for this site, then click Connect again.",
                      );
                    } else if (msg !== "popup_closed") {
                      alert(`Google sign-in error: ${msg}`);
                    }
                  }
                }}
              />
              <Gauge
                label="Universe"
                value={`${universeVitality}%`}
                max={100}
                tone={universeVitality > 60 ? "teal" : universeVitality > 30 ? "amber" : "magenta"}
                pulse={universeVitality < 40}
              />
            </div>

            {/* Galaxy circular widgets — only in expanded */}
            {hudMode === "expanded" && (
              <>
                <Divider />
                <div className="flex-1 flex items-center justify-around gap-2 min-w-0 px-1">
                  {GALAXIES.map((g) => {
                    const c = GALAXY_COLORS[g];
                    const rgb = hexToRgbTriplet(c);
                    const active = focusedGalaxy === g;
                    const cnt = counts[g];
                    return (
                      <CircleWidget
                        key={g}
                        label={GALAXY_SHORT[g]}
                        value={cnt}
                        color={c}
                        rgb={rgb}
                        active={active}
                        onMouseEnter={() => sfx.hover()}
                        onClick={() => {
                          sfx.select();
                          enterGalaxy(active ? null : g);
                        }}
                      />
                    );
                  })}
                </div>
              </>
            )}

            {/* Right bay: utilities + Orb */}
            <Divider />
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled
                title="Voice — reserved for V3 phase two"
                className="w-10 h-10 rounded-full border border-cyan-glow/15 text-cyan-glow/35 flex items-center justify-center cursor-not-allowed"
              >
                <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                  <rect x={6} y={2} width={4} height={8} rx={2} stroke="currentColor" />
                  <path d="M3 8a5 5 0 0010 0M8 13v2" stroke="currentColor" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                onMouseEnter={() => sfx.hover()}
                onClick={() => {
                  sfx.select();
                  setMapOpen(!isMapOpen);
                }}
                title="Tactical map"
                className={clsx(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                  isMapOpen
                    ? "border border-cyan-glow/70 bg-cyan-glow/10 text-cyan-glow glow-cyan"
                    : "border border-cyan-glow/25 text-cyan-glow/70 hover:text-cyan-glow hover:border-cyan-glow/60",
                )}
              >
                <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                  <path
                    d="M2 4l4-1.5L10 4l4-1.5v9.5L10 13.5 6 12l-4 1.5V4z"
                    stroke="currentColor"
                    strokeWidth={1.2}
                    strokeLinejoin="round"
                  />
                  <path d="M6 2.5v9.5M10 4v9.5" stroke="currentColor" strokeWidth={1.2} />
                </svg>
              </button>
              <Orb size={44} />
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <span
      className="w-px self-stretch"
      style={{
        background:
          "linear-gradient(180deg, transparent 0%, rgba(91,243,255,0.25) 30%, rgba(91,243,255,0.25) 70%, transparent 100%)",
      }}
    />
  );
}

function hexToRgbTriplet(hex: string): string {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/**
 * Glowing neon-orange chevron button — beveled arrow with inner highlight
 * and outer halo. Used for the HUD expand/minimize control at the top center.
 */
function ChevronModeButton({
  direction,
  disabled,
  onClick,
  label,
}: {
  direction: "up" | "down";
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => sfx.hover()}
      aria-label={label}
      title={label}
      className={clsx(
        "group relative inline-flex items-center justify-center w-14 h-10",
        "transition-all duration-200",
        disabled
          ? "opacity-25 cursor-default"
          : "opacity-100 hover:scale-110 cursor-pointer",
      )}
    >
      <svg
        viewBox="0 0 40 28"
        width="56"
        height="40"
        className={clsx(
          "overflow-visible",
          direction === "down" && "rotate-180",
        )}
        aria-hidden
      >
        <defs>
          <linearGradient id={`chev-fill-${direction}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFD27A" />
            <stop offset="45%" stopColor="#FFA73A" />
            <stop offset="100%" stopColor="#E06A00" />
          </linearGradient>
          <linearGradient id={`chev-edge-${direction}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE5B4" />
            <stop offset="100%" stopColor="#FF8A1F" />
          </linearGradient>
          <filter id={`chev-glow-${direction}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.4" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b2" />
            <feMerge>
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Outer soft halo */}
        <path
          d="M4 22 L20 6 L36 22 L30 22 L20 12 L10 22 Z"
          fill="#FF7A14"
          opacity="0.55"
          filter={`url(#chev-glow-${direction})`}
        />
        {/* Body */}
        <path
          d="M5 21 L20 7 L35 21 L29 21 L20 12.5 L11 21 Z"
          fill={`url(#chev-fill-${direction})`}
          stroke={`url(#chev-edge-${direction})`}
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        {/* Inner highlight stripe */}
        <path
          d="M9 19.5 L20 9 L31 19.5"
          fill="none"
          stroke="#FFF1CC"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
      </svg>
    </button>
  );
}
