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
  const isMapOpen = useUI((s) => s.isMapOpen);
  const mapTransition = useUI((s) => s.mapTransition);
  const diveToMap = useUI((s) => s.diveToMap);
  const riseFromMap = useUI((s) => s.riseFromMap);

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
              setHudMode("expanded");
            }}
            label="Expand HUD"
          />
          <ChevronModeButton
            direction="down"
            disabled={hudMode === "minimized"}
            onClick={() => {
              sfx.select();
              setHudMode("minimized");
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

      {/* Bezel wrapper */}
      <div className="relative">
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
              {/* Black-chrome engraved plate stacked over the reset-view core */}
              <div className="flex flex-col items-center gap-1.5">
                <ChromePlate label="NORTH SKY · COMMAND" />
                <DysonCore size={56} />
              </div>
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
                aria-label="Voice (disabled)"
                className="w-10 h-10 rounded-full border border-cyan-glow/25 bg-cyan-glow/5 flex items-center justify-center cursor-not-allowed"
                style={{ boxShadow: "0 0 10px rgba(91, 243, 255, 0.18), inset 0 0 6px rgba(91, 243, 255, 0.08)" }}
              >
                <NeonMicIcon size={20} dim />
              </button>
              <button
                type="button"
                onMouseEnter={() => sfx.hover()}
                onClick={() => {
                  // Ignore clicks while a warp is in flight — the dive owns
                  // the camera and double-triggering would re-snapshot mid-tween.
                  if (mapTransition === "diving" || mapTransition === "rising") return;
                  sfx.select();
                  if (isMapOpen) riseFromMap();
                  else diveToMap();
                }}
                title={isMapOpen ? "Warp out to universe" : "Hyperspace dive to tactical map"}
                className={clsx(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                  isMapOpen
                    ? "border border-cyan-glow/70 bg-cyan-glow/10 text-cyan-glow glow-cyan"
                    : "border border-cyan-glow/25 text-cyan-glow/70 hover:text-cyan-glow hover:border-cyan-glow/60",
                  (mapTransition === "diving" || mapTransition === "rising") && "opacity-60 cursor-wait",
                )}
              >
                <NeonGlobeIcon size={22} active={isMapOpen} />
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

/**
 * Neon globe icon — dark sphere with multi-color glowing continents
 * (cyan / magenta / teal / amber). Matches the reference globe asset.
 */
function NeonGlobeIcon({ size = 22, active = false }: { size?: number; active?: boolean }) {
  const opacity = active ? 1 : 0.92;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className="overflow-visible">
      <defs>
        <radialGradient id="globe-body" cx="42%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#0a0f18" />
          <stop offset="100%" stopColor="#000" />
        </radialGradient>
        <linearGradient id="globe-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5BF3FF" />
          <stop offset="45%" stopColor="#FF3D9A" />
          <stop offset="100%" stopColor="#FFB347" />
        </linearGradient>
      </defs>
      {/* Outer glow halo */}
      <circle cx={16} cy={16} r={14} fill="none" stroke="#5BF3FF" strokeOpacity={0.35} strokeWidth={0.6} style={{ filter: "drop-shadow(0 0 4px #5BF3FF) drop-shadow(0 0 8px #FF3D9A)" }} />
      {/* Sphere body */}
      <circle cx={16} cy={16} r={12.5} fill="url(#globe-body)" stroke="url(#globe-rim)" strokeWidth={1} opacity={opacity} />
      {/* Latitude lines */}
      <ellipse cx={16} cy={16} rx={12.5} ry={4.5} fill="none" stroke="#5BF3FF" strokeOpacity={0.32} strokeWidth={0.5} />
      <ellipse cx={16} cy={16} rx={12.5} ry={9} fill="none" stroke="#5BF3FF" strokeOpacity={0.22} strokeWidth={0.4} />
      {/* Longitude */}
      <ellipse cx={16} cy={16} rx={5} ry={12.5} fill="none" stroke="#5BF3FF" strokeOpacity={0.28} strokeWidth={0.4} />
      <line x1={16} y1={3.5} x2={16} y2={28.5} stroke="#5BF3FF" strokeOpacity={0.4} strokeWidth={0.5} />
      {/* Continent silhouettes — stylized, multi-color neon */}
      {/* Americas (magenta) */}
      <path
        d="M10 9 Q9 11 10 13 L11 15 L10 17 Q10 19 12 21 L13 23 L14 22 L13 19 L14 17 L13 14 L12 12 L11 10 Z"
        fill="#FF3D9A"
        opacity={0.85}
        style={{ filter: "drop-shadow(0 0 2px #FF3D9A)" }}
      />
      {/* Europe + Africa (cyan) */}
      <path
        d="M17 8 L19 9 L20 11 L19 13 L20 15 L19 17 L18 19 L17 21 L16 22 L16 18 L17 15 L16 12 L17 10 Z"
        fill="#5BF3FF"
        opacity={0.9}
        style={{ filter: "drop-shadow(0 0 2px #5BF3FF)" }}
      />
      {/* Asia/Australia (green-teal) */}
      <path
        d="M21 9 Q23 10 24 12 L23 14 L22 13 L21 12 Z M22 17 L24 18 L23 20 L21 19 Z"
        fill="#7CFFA8"
        opacity={0.9}
        style={{ filter: "drop-shadow(0 0 2px #7CFFA8)" }}
      />
      {/* Highlight specular */}
      <ellipse cx={11} cy={9} rx={2.4} ry={1.4} fill="#fff" opacity={0.15} />
    </svg>
  );
}

/**
 * Neon microphone icon — bright cyan glowing mic (capsule + arc + stand).
 * Matches the reference mic image.
 */
function NeonMicIcon({ size = 20, dim = false }: { size?: number; dim?: boolean }) {
  const C = dim ? "#5BF3FF" : "#5BF3FF";
  const opacity = dim ? 0.55 : 1;
  const glow = dim ? 2.5 : 5;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="overflow-visible" style={{ opacity }}>
      <defs>
        <linearGradient id="mic-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A8F8FF" />
          <stop offset="100%" stopColor="#5BF3FF" />
        </linearGradient>
      </defs>
      {/* Mic capsule */}
      <rect
        x={9}
        y={3}
        width={6}
        height={11}
        rx={3}
        fill="none"
        stroke="url(#mic-fill)"
        strokeWidth={1.6}
        style={{ filter: `drop-shadow(0 0 ${glow}px ${C})` }}
      />
      {/* U-arc */}
      <path
        d="M5.5 11 a6.5 6.5 0 0 0 13 0"
        fill="none"
        stroke={C}
        strokeWidth={1.6}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 ${glow}px ${C})` }}
      />
      {/* Stand */}
      <line x1={12} y1={17.5} x2={12} y2={20.5} stroke={C} strokeWidth={1.6} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 ${glow * 0.6}px ${C})` }} />
      <line x1={8} y1={20.5} x2={16} y2={20.5} stroke={C} strokeWidth={1.6} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 ${glow * 0.6}px ${C})` }} />
    </svg>
  );
}

/**
 * Black-chrome engraved nameplate. Brushed dark-metal background with a sharp
 * inner shadow + bright top-edge highlight to fake the milled-then-engraved
 * look. Letters use a cool cyan-tinted dark fill with a 1px white top-light
 * and a black bottom-shadow — classic emboss/engrave reversal.
 */
function ChromePlate({ label }: { label: string }) {
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{
        padding: "5px 14px",
        // Brushed black-chrome: dark gradient + horizontal grain via repeating
        // linear gradient. Looks like polished gunmetal plate.
        background:
          "linear-gradient(180deg, #2a2f38 0%, #14171d 38%, #0a0c10 62%, #1d2128 100%), repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, rgba(0,0,0,0.04) 1px, rgba(0,0,0,0.04) 2px)",
        backgroundBlendMode: "overlay",
        border: "1px solid #050608",
        borderTop: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 3,
        // Outer cast shadow + bright top edge + dark inner ring for depth
        boxShadow: [
          "inset 0 1px 0 rgba(255,255,255,0.22)",   // top highlight (bezel light)
          "inset 0 -1px 0 rgba(0,0,0,0.85)",         // bottom shadow (bezel dark)
          "inset 0 0 0 1px rgba(255,255,255,0.04)", // micro inner outline
          "0 1px 0 rgba(255,255,255,0.05)",         // outer rim catch
          "0 2px 4px rgba(0,0,0,0.65)",             // drop shadow under plate
        ].join(", "),
      }}
    >
      {/* Tiny corner screws */}
      <span
        className="absolute"
        style={{
          top: 2,
          left: 3,
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, #6a7280 0%, #0a0c10 70%)",
          boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.9)",
        }}
      />
      <span
        className="absolute"
        style={{
          top: 2,
          right: 3,
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, #6a7280 0%, #0a0c10 70%)",
          boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.9)",
        }}
      />
      <span
        className="absolute"
        style={{
          bottom: 2,
          left: 3,
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, #6a7280 0%, #0a0c10 70%)",
          boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.9)",
        }}
      />
      <span
        className="absolute"
        style={{
          bottom: 2,
          right: 3,
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, #6a7280 0%, #0a0c10 70%)",
          boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.9)",
        }}
      />

      {/* Engraved label — stack two text layers (white top-light + black drop)
          underneath a dark cool-gray fill to fake a chiseled-into-the-metal feel. */}
      <span
        className="font-display uppercase"
        style={{
          position: "relative",
          fontSize: 10,
          letterSpacing: "0.32em",
          fontWeight: 700,
          color: "#0a0d12",
          // Engrave: white below to simulate light skipping over the lower lip,
          // black above to simulate the recess shadow. This is the standard
          // CSS "engraved text" trick.
          textShadow:
            "0 -1px 0 rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.18), 0 0 1px rgba(0,0,0,0.6)",
        }}
      >
        {label}
      </span>
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
