import { clsx } from "clsx";
import { useMemo } from "react";
import { useUI, selectGalaxyCounts } from "@/store/uiStore";
import { GALAXIES } from "@/types";
import { GALAXY_COLORS, GALAXY_GLYPH } from "@/lib/statusMap";
import { Gauge } from "./Gauge";
import { DysonCore } from "./DysonCore";
import { Orb } from "@/components/lumina/Orb";
import { sfx } from "@/lib/audio";
import { requestGoogleToken, revokeGoogleToken } from "@/lib/googleAuth";

/**
 * The three-mode tactical HUD.
 *
 * - Minimized: dormant. Dyson + LUMINA orb only.
 * - Standard:  Dyson + Orb + mic-disabled + Map + 3 core gauges (Total, Gmail, Universe).
 * - Expanded:  All of standard, plus the seven galaxy widgets as direct command targets.
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

  // Universe vitality is a hybrid metric — real signal, cinematic presentation.
  // Ingredients: load state, count stability, integration health.
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
    <div className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-[min(96vw,1480px)]">
      {/* Top rails row — sits above the plate but inside wrapper bounding box for hit-testing */}
      <div className="pointer-events-auto flex items-center justify-between px-6 mb-2 font-mono text-[10px] uppercase tracking-tactical">
        {/* Mode rail */}
        <div className="flex items-center gap-1">
          {(["minimized", "standard", "expanded"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onMouseEnter={() => sfx.hover()}
              onClick={() => {
                sfx.select();
                setHudMode(m);
              }}
              className={clsx(
                "px-2 py-1 border border-cyan-glow/20 rounded-sm transition-colors",
                hudMode === m
                  ? "bg-cyan-glow/15 text-cyan-glow border-cyan-glow/60"
                  : "text-cyan-glow/60 hover:text-cyan-glow",
              )}
            >
              {m}
            </button>
          ))}
          <button
            type="button"
            onMouseEnter={() => sfx.hover()}
            onClick={() => {
              sfx.select();
              toggleHud();
            }}
            className="ml-2 px-2 py-1 text-cyan-glow/40 hover:text-cyan-glow transition-colors"
            title="Cycle HUD"
          >
            ↻
          </button>
        </div>

        {/* Status badge — tactical posture indicator */}
        <div className="flex items-center gap-2 text-cyan-glow/70">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-glow shadow-[0_0_10px_#3CFFD2]" />
          <span>posture</span>
          <span className="text-white">
            {focusedGalaxy ? focusedGalaxy : "universe"}
          </span>
        </div>
      </div>

      <div
        className={clsx(
          "pointer-events-auto metallic-plate clip-corner relative",
          "transition-[height,padding,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        )}
      >
        <span className="reticle opacity-40" />

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

        {hudMode !== "minimized" && (
          <div className="flex items-center px-6 py-5 gap-6">
            {/* Left rail: Dyson + identity */}
            <div className="flex items-center gap-4">
              <DysonCore size={56} />
              <div className="hidden lg:block">
                <div className="font-display text-[11px] uppercase tracking-tactical text-cyan-glow/70">
                  LUMINA V3
                </div>
                <div className="font-mono text-[10px] text-white/50">
                  Operator · Billy Keesee
                </div>
              </div>
            </div>

            <span className="h-14 w-px bg-cyan-glow/15" />

            {/* Core gauges */}
            <div className="flex items-center gap-6">
              <Gauge label="Total" value={total} tone="cyan" />
              <Gauge
                label="Gmail"
                value={googleToken ? unreadCount : "—"}
                tone={unreadCount > 0 ? "magenta" : "cyan"}
                pulse={unreadCount > 0}
                onClick={async () => {
                  if (googleToken) return;
                  try {
                    sfx.select();
                    const tk = await requestGoogleToken();
                    setGoogleToken(tk);
                    sfx.confirm();
                  } catch {
                    sfx.error();
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

            {/* Galaxy widgets — only in expanded mode */}
            {hudMode === "expanded" && (
              <>
                <span className="h-14 w-px bg-cyan-glow/15" />
                <div className="flex-1 grid grid-cols-7 gap-2 min-w-0">
                  {GALAXIES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onMouseEnter={() => sfx.hover()}
                      onClick={() => {
                        sfx.select();
                        enterGalaxy(focusedGalaxy === g ? null : g);
                      }}
                      className={clsx(
                        "relative group flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-sm",
                        "border border-white/5 bg-black/30 backdrop-blur-sm",
                        "transition-all duration-300",
                        focusedGalaxy === g
                          ? "border-cyan-glow/70 bg-cyan-glow/10 glow-cyan"
                          : "hover:border-cyan-glow/30 hover:bg-white/5",
                      )}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          background: GALAXY_COLORS[g],
                          boxShadow: `0 0 10px ${GALAXY_COLORS[g]}`,
                        }}
                      />
                      <div className="font-display text-[10px] uppercase tracking-tactical text-white/80 leading-tight text-center">
                        {g}
                      </div>
                      <div className="font-mono text-sm text-white">{counts[g]}</div>
                      <div className="absolute top-1 right-1 font-mono text-[10px] text-white/30">
                        {GALAXY_GLYPH[g]}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Right rail: utilities + LUMINA orb */}
            <span className="h-14 w-px bg-cyan-glow/15" />
            <div className="flex items-center gap-3">
              {/* Mic placeholder — bible: "one-shot mic affordance placeholder
                  or disabled state for future voice" */}
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
              {/* Map */}
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
  );
}
