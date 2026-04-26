import { clsx } from "clsx";
import { useMemo } from "react";
import { useUI, selectGalaxyCounts } from "@/store/uiStore";
import { GALAXIES } from "@/types";
import { GALAXY_COLORS } from "@/lib/statusMap";
import type { Galaxy } from "@/types";
import { Gauge } from "./Gauge";
import { CircleWidget } from "./CircleWidget";
import { DysonCore } from "./DysonCore";
import { MiniGauge } from "./MiniGauge";
import { MiniWidget } from "./MiniWidget";
import { DysonSphereHero } from "./DysonSphereHero";
import { NeonGlobeV2 } from "./NeonGlobeV2";
import { ActiveMicIcon } from "./ActiveMicIcon";
import { Orb } from "@/components/lumina/Orb";
import { sfx } from "@/lib/audio";
import { requestGoogleToken } from "@/lib/googleAuth";

const GALAXY_SHORT: Record<Galaxy, string> = {
  Complete: "Complete",
  "Fielded-RTS": "Fielded",
  "Needs Fielding": "Needs Fld",
  "On Hold": "On Hold",
  Pending: "Pending",
  "Routed to Sub": "Sub",
  Scheduled: "Sched",
};

/**
 * Tactical HUD — two orientations:
 *   - vertical (default): right-docked column, LUMINA orb is hero at top.
 *   - horizontal: legacy bottom rail.
 *
 * The orientation toggle is a rotate icon in the top corner of either layout.
 */
export function HUD() {
  const orientation = useUI((s) => s.hudOrientation);

  return orientation === "vertical" ? <HUDVertical /> : <HUDHorizontal />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared bits

function useHudData() {
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

  const handleConnectGmail = async () => {
    if (googleToken) return;
    try {
      sfx.select();
      const tk = await requestGoogleToken();
      setGoogleToken(tk);
      sfx.confirm();
    } catch (err) {
      sfx.error();
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[Lumina] Google sign-in failed:", msg);
      if (msg === "popup_failed_to_open") {
        alert(
          "Google sign-in popup was blocked. Allow popups for this site, then click Connect again.",
        );
      } else if (msg !== "popup_closed") {
        alert(`Google sign-in error: ${msg}`);
      }
    }
  };

  return {
    counts,
    enterGalaxy,
    focusedGalaxy,
    total,
    googleToken,
    unreadCount,
    universeVitality,
    isMapOpen,
    mapTransition,
    diveToMap,
    riseFromMap,
    handleConnectGmail,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERTICAL HUD — default. Right-docked column. LUMINA orb is the star.

function HUDVertical() {
  const hudMode = useUI((s) => s.hudMode);
  const setHudMode = useUI((s) => s.setHudMode);
  const toggleOrientation = useUI((s) => s.toggleHudOrientation);
  const {
    counts,
    enterGalaxy,
    focusedGalaxy,
    total,
    googleToken,
    unreadCount,
    universeVitality,
    isMapOpen,
    mapTransition,
    diveToMap,
    riseFromMap,
    handleConnectGmail,
  } = useHudData();

  const collapsed = hudMode === "minimized";

  return (
    <div
      className="pointer-events-none fixed top-6 right-6 bottom-6 z-30 flex flex-col"
      style={{ width: collapsed ? 96 : 220 }}
    >
      <div
        className={clsx(
          "pointer-events-auto command-bezel clip-corner-md relative",
          "flex flex-col h-full",
          "transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        )}
      >
        {/* Decorative rivets along the rails */}
        <span className="rivet" style={{ left: 6, top: 6 }} />
        <span className="rivet" style={{ right: 6, top: 6 }} />
        <span className="rivet" style={{ left: 6, bottom: 6 }} />
        <span className="rivet" style={{ right: 6, bottom: 6 }} />

        {/* BRAND CHIP — NORTHSKY · LUMINA V3 lockup at the very top */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-2">
          <button
            type="button"
            onMouseEnter={() => sfx.hover()}
            onClick={() => {
              sfx.select();
              toggleOrientation();
            }}
            title="Switch to horizontal HUD"
            aria-label="Switch HUD orientation"
            className="w-6 h-6 rounded-sm border border-cyan-glow/30 bg-black/40 text-cyan-glow/70 hover:text-cyan-glow hover:border-cyan-glow/70 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <RotateIcon size={11} />
          </button>
          {!collapsed && (
            <div className="flex flex-col items-center leading-none">
              <div
                className="font-mono uppercase"
                style={{
                  fontSize: 7,
                  letterSpacing: "0.32em",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                NORTHSKY
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span
                  className="font-display text-white"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textShadow: "0 0 4px rgba(255,255,255,0.6)",
                  }}
                >
                  LUMINA
                </span>
                <span
                  className="font-display"
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    color: "#5BF3FF",
                    textShadow:
                      "0 0 3px #5BF3FF, 0 0 6px rgba(91,243,255,0.6)",
                  }}
                >
                  V3
                </span>
              </div>
            </div>
          )}
          <button
            type="button"
            onMouseEnter={() => sfx.hover()}
            onClick={() => {
              sfx.select();
              setHudMode(collapsed ? "expanded" : "minimized");
            }}
            title={collapsed ? "Expand HUD" : "Collapse HUD"}
            aria-label="Toggle HUD size"
            className="w-6 h-6 rounded-sm border border-cyan-glow/30 bg-black/40 text-cyan-glow/70 hover:text-cyan-glow hover:border-cyan-glow/70 flex items-center justify-center font-mono text-[10px] transition-colors flex-shrink-0"
          >
            {collapsed ? "+" : "−"}
          </button>
        </div>

        {/* Cyan accent rule under brand */}
        <div className="px-3">
          <div
            style={{
              height: 1.5,
              background: "#5BF3FF",
              boxShadow: "0 0 6px #5BF3FF, 0 0 12px rgba(91,243,255,0.5)",
            }}
          />
        </div>

        {/* HERO — LUMINA Dyson sphere (the star of the show, literally) */}
        <button
          type="button"
          onMouseEnter={() => sfx.hover()}
          onClick={() => {
            sfx.wake();
            useUI.getState().setChatOpen(!useUI.getState().isChatOpen);
          }}
          title="Wake LUMINA"
          aria-label="Wake LUMINA"
          className="flex flex-col items-center gap-0.5 px-3 pt-2 pb-2 transition-transform hover:scale-[1.03] active:scale-[0.97]"
        >
          {collapsed ? (
            <Orb size={48} />
          ) : (
            <DysonSphereHero size={92} />
          )}
          {!collapsed && (
            <>
              <div
                className="font-display"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  color: "#ffffff",
                  textShadow:
                    "0 0 4px #5BF3FF, 0 0 9px rgba(91,243,255,0.7)",
                  marginTop: -4,
                }}
              >
                LUMINA
              </div>
              <div
                className="font-mono uppercase"
                style={{
                  fontSize: 7,
                  letterSpacing: "0.32em",
                  color: "rgba(91,243,255,0.75)",
                  textShadow: "0 0 3px rgba(91,243,255,0.55)",
                }}
              >
                tactical AI core
              </div>
            </>
          )}
        </button>

        {!collapsed && (
          <>
            {/* Cyan accent rule */}
            <div className="px-3">
              <div
                style={{
                  height: 1.5,
                  background: "#5BF3FF",
                  boxShadow: "0 0 6px #5BF3FF, 0 0 12px rgba(91,243,255,0.5)",
                }}
              />
            </div>

            {/* TELEMETRY STACK — three hero gauges fill the column width */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5">
              {/* Section caption */}
              <div
                className="font-mono uppercase mb-1.5 px-1"
                style={{
                  fontSize: 7,
                  letterSpacing: "0.32em",
                  color: "rgba(91,243,255,0.7)",
                }}
              >
                · telemetry
              </div>
              <div className="flex flex-col items-center gap-2.5 mb-3">
                <MiniGauge
                  label="TOTAL"
                  value={total}
                  tone="cyan"
                  size={86}
                />
                <MiniGauge
                  label={googleToken ? "GMAIL" : "CONNECT"}
                  value={googleToken ? unreadCount : "→"}
                  tone={
                    unreadCount > 0
                      ? "magenta"
                      : googleToken
                        ? "cyan"
                        : "amber"
                  }
                  pulse={!googleToken || unreadCount > 0}
                  onClick={handleConnectGmail}
                  size={86}
                />
                <MiniGauge
                  label="UNIVERSE"
                  value={`${universeVitality}%`}
                  tone={
                    universeVitality > 60
                      ? "teal"
                      : universeVitality > 30
                        ? "amber"
                        : "magenta"
                  }
                  pulse={universeVitality < 40}
                  size={86}
                />
              </div>

              {/* Cyan accent rule between sections */}
              <div
                style={{
                  height: 1,
                  background:
                    "linear-gradient(90deg, transparent, #5BF3FF, transparent)",
                  boxShadow: "0 0 4px rgba(91,243,255,0.6)",
                  marginBottom: 8,
                }}
              />

              {/* Galaxies caption */}
              <div
                className="font-mono uppercase mb-1.5 px-1"
                style={{
                  fontSize: 7,
                  letterSpacing: "0.32em",
                  color: "rgba(91,243,255,0.7)",
                }}
              >
                · galaxies
              </div>
              {/* 7 galaxy widgets in 2-col grid (4+3) — labels above tiny disc */}
              <div className="grid grid-cols-2 gap-x-1.5 gap-y-1.5 justify-items-center pb-1">
                {GALAXIES.map((g) => {
                  const c = GALAXY_COLORS[g];
                  const rgb = hexToRgbTriplet(c);
                  const active = focusedGalaxy === g;
                  const cnt = counts[g];
                  return (
                    <MiniWidget
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
            </div>

            {/* Cyan accent rule above utility row */}
            <div className="px-3">
              <div
                style={{
                  height: 1.5,
                  background: "#5BF3FF",
                  boxShadow: "0 0 6px #5BF3FF, 0 0 12px rgba(91,243,255,0.5)",
                }}
              />
            </div>

            {/* UTILITY ROW — labeled tactical controls */}
            <div className="px-3 py-2.5 flex items-start justify-around bg-black/40">
              <LabeledUtility
                label="RESET"
                title="Return to Universe"
                onClick={() => {
                  sfx.confirm();
                  useUI.getState().resetToUniverse();
                }}
              >
                <DysonCore size={28} />
              </LabeledUtility>
              <LabeledUtility
                label="VOICE"
                title="Voice — reserved for V3 phase two"
              >
                <ActiveMicIcon size={20} />
              </LabeledUtility>
              <LabeledUtility
                label={isMapOpen ? "WARP" : "MAP"}
                title={
                  isMapOpen
                    ? "Warp out to universe"
                    : "Hyperspace dive to tactical map"
                }
                onClick={() => {
                  if (
                    mapTransition === "diving" ||
                    mapTransition === "rising"
                  )
                    return;
                  sfx.select();
                  if (isMapOpen) riseFromMap();
                  else diveToMap();
                }}
                active={isMapOpen}
                wait={
                  mapTransition === "diving" || mapTransition === "rising"
                }
              >
                <NeonGlobeV2 size={22} active={isMapOpen} />
              </LabeledUtility>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * LabeledUtility — circular neon button with a tiny mono caption underneath.
 * Used in the vertical HUD utility row so each control reads its function
 * (RESET / VOICE / MAP) rather than relying on icon-only recognition.
 */
function LabeledUtility({
  children,
  title,
  label,
  onClick,
  active,
  wait,
}: {
  children: React.ReactNode;
  title: string;
  label: string;
  onClick?: () => void;
  active?: boolean;
  wait?: boolean;
}) {
  const interactive = !!onClick;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onMouseEnter={() => sfx.hover()}
        onClick={onClick}
        disabled={!interactive}
        title={title}
        aria-label={title}
        className={clsx(
          "rounded-full flex items-center justify-center transition-all duration-200",
          active
            ? "border border-cyan-glow/80 bg-cyan-glow/15"
            : "border border-cyan-glow/30 bg-cyan-glow/5 hover:border-cyan-glow/70 hover:bg-cyan-glow/10",
          !interactive && "cursor-default",
          wait && "opacity-60 cursor-wait",
        )}
        style={{
          width: 40,
          height: 40,
          boxShadow: active
            ? "0 0 12px rgba(91,243,255,0.55), inset 0 0 8px rgba(91,243,255,0.3)"
            : "0 0 6px rgba(91,243,255,0.18), inset 0 0 6px rgba(91,243,255,0.12)",
        }}
      >
        {children}
      </button>
      <span
        className="font-mono uppercase"
        style={{
          fontSize: 7.5,
          letterSpacing: "0.24em",
          color: active ? "#5BF3FF" : "rgba(91,243,255,0.7)",
          textShadow: active
            ? "0 0 4px #5BF3FF"
            : "0 0 3px rgba(91,243,255,0.4)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function UtilityButton({
  children,
  title,
  onClick,
  disabled,
  active,
  wait,
  size = 44,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  wait?: boolean;
  size?: number;
}) {
  return (
    <button
      type="button"
      onMouseEnter={() => sfx.hover()}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={clsx(
        "rounded-full flex items-center justify-center transition-colors",
        active
          ? "border border-cyan-glow/70 bg-cyan-glow/10 glow-cyan"
          : "border border-cyan-glow/25 bg-cyan-glow/5 hover:border-cyan-glow/60",
        disabled && "cursor-not-allowed opacity-60",
        wait && "opacity-60 cursor-wait",
      )}
      style={{
        width: size,
        height: size,
        boxShadow: active
          ? "0 0 10px rgba(91,243,255,0.5), inset 0 0 6px rgba(91,243,255,0.25)"
          : "inset 0 0 6px rgba(91,243,255,0.12)",
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HORIZONTAL HUD — legacy bottom rail. Reset core stays in the left bay here.

function HUDHorizontal() {
  const hudMode = useUI((s) => s.hudMode);
  const setHudMode = useUI((s) => s.setHudMode);
  const toggleOrientation = useUI((s) => s.toggleHudOrientation);
  const {
    counts,
    enterGalaxy,
    focusedGalaxy,
    total,
    googleToken,
    unreadCount,
    universeVitality,
    isMapOpen,
    mapTransition,
    diveToMap,
    riseFromMap,
    handleConnectGmail,
  } = useHudData();

  return (
    <div className="pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 z-30 w-[min(96vw,1480px)]">
      {/* Top rails */}
      <div className="pointer-events-auto flex items-center justify-between px-6 mb-1.5 font-mono text-[10px] uppercase tracking-tactical relative">
        <button
          type="button"
          onMouseEnter={() => sfx.hover()}
          onClick={() => {
            sfx.select();
            toggleOrientation();
          }}
          title="Switch to vertical HUD"
          aria-label="Switch HUD orientation"
          className="pointer-events-auto inline-flex items-center gap-1.5 px-2 h-6 rounded-sm border border-cyan-glow/30 bg-black/40 text-cyan-glow/70 hover:text-cyan-glow hover:border-cyan-glow/70 transition-colors"
        >
          <RotateIcon size={12} />
          <span style={{ letterSpacing: "0.24em" }}>vertical</span>
        </button>

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
          <span className="text-white">
            {focusedGalaxy ? focusedGalaxy : "universe"}
          </span>
        </div>
      </div>

      <div className="relative">
        <div
          className={clsx(
            "pointer-events-auto command-bezel clip-corner-md relative",
            "transition-[height,padding,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          )}
        >
          {hudMode === "minimized" && (
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <DysonSphereHero size={48} />
                <div className="font-display text-xs uppercase tracking-tactical text-cyan-glow/70">
                  LUMINA · standby
                </div>
              </div>
              <DysonCore size={36} />
            </div>
          )}

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

              <div className="flex items-stretch px-6 py-3 gap-4">
                {/* Left bay: LUMINA Dyson sphere hero matches vertical mode */}
                <button
                  type="button"
                  onMouseEnter={() => sfx.hover()}
                  onClick={() => {
                    sfx.wake();
                    useUI.getState().setChatOpen(
                      !useUI.getState().isChatOpen,
                    );
                  }}
                  title="Wake LUMINA"
                  aria-label="Wake LUMINA"
                  className="flex items-center gap-3 pr-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <DysonSphereHero size={68} />
                  <div className="hidden lg:block text-left">
                    <div
                      className="font-display"
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: "0.18em",
                        color: "#ffffff",
                        textShadow:
                          "0 0 4px #5BF3FF, 0 0 9px rgba(91,243,255,0.7)",
                      }}
                    >
                      LUMINA
                    </div>
                    <div
                      className="font-mono uppercase"
                      style={{
                        fontSize: 7.5,
                        letterSpacing: "0.32em",
                        color: "rgba(91,243,255,0.75)",
                        textShadow: "0 0 3px rgba(91,243,255,0.55)",
                      }}
                    >
                      tactical AI core
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 border border-cyan-glow/20 bg-black/40 rounded-sm">
                      <span className="w-1 h-1 rounded-full bg-teal-glow shadow-[0_0_6px_#3CFFD2]" />
                      <span className="font-mono text-[8px] uppercase tracking-[0.24em] text-teal-glow">
                        online
                      </span>
                    </div>
                  </div>
                </button>

                <Divider />

                <div className="gauge-bay px-4 py-2 rounded-[2px] flex items-center gap-3">
                  <Gauge label="Total" value={total} tone="cyan" rainbow />
                  <Gauge
                    label={googleToken ? "Gmail" : "Connect"}
                    value={googleToken ? unreadCount : "→"}
                    tone={
                      unreadCount > 0
                        ? "magenta"
                        : googleToken
                          ? "cyan"
                          : "amber"
                    }
                    pulse={!googleToken || unreadCount > 0}
                    onClick={handleConnectGmail}
                  />
                  <Gauge
                    label="Universe"
                    value={`${universeVitality}%`}
                    max={100}
                    tone={
                      universeVitality > 60
                        ? "teal"
                        : universeVitality > 30
                          ? "amber"
                          : "magenta"
                    }
                    pulse={universeVitality < 40}
                  />
                </div>

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

                {/* Solid divider to kill ghost-icon bleed */}
                <Divider strong />
                <div className="flex items-center gap-3">
                  <LabeledUtility
                    label="RESET"
                    title="Return to Universe"
                    onClick={() => {
                      sfx.confirm();
                      useUI.getState().resetToUniverse();
                    }}
                  >
                    <DysonCore size={28} />
                  </LabeledUtility>
                  <LabeledUtility
                    label="VOICE"
                    title="Voice — reserved for V3 phase two"
                  >
                    <ActiveMicIcon size={20} />
                  </LabeledUtility>
                  <LabeledUtility
                    label={isMapOpen ? "WARP" : "MAP"}
                    title={
                      isMapOpen
                        ? "Warp out to universe"
                        : "Hyperspace dive to tactical map"
                    }
                    onClick={() => {
                      if (
                        mapTransition === "diving" ||
                        mapTransition === "rising"
                      )
                        return;
                      sfx.select();
                      if (isMapOpen) riseFromMap();
                      else diveToMap();
                    }}
                    active={isMapOpen}
                    wait={
                      mapTransition === "diving" || mapTransition === "rising"
                    }
                  >
                    <NeonGlobeV2 size={22} active={isMapOpen} />
                  </LabeledUtility>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons / helpers

/** Rotate icon (orientation toggle). */
function RotateIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-3.5-7.1" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

function NeonGlobeIcon({
  size = 22,
  active = false,
}: {
  size?: number;
  active?: boolean;
}) {
  const opacity = active ? 1 : 0.92;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className="overflow-visible"
    >
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
      <circle
        cx={16}
        cy={16}
        r={14}
        fill="none"
        stroke="#5BF3FF"
        strokeOpacity={0.35}
        strokeWidth={0.6}
        style={{
          filter: "drop-shadow(0 0 4px #5BF3FF) drop-shadow(0 0 8px #FF3D9A)",
        }}
      />
      <circle
        cx={16}
        cy={16}
        r={12.5}
        fill="url(#globe-body)"
        stroke="url(#globe-rim)"
        strokeWidth={1}
        opacity={opacity}
      />
      <ellipse
        cx={16}
        cy={16}
        rx={12.5}
        ry={4.5}
        fill="none"
        stroke="#5BF3FF"
        strokeOpacity={0.32}
        strokeWidth={0.5}
      />
      <ellipse
        cx={16}
        cy={16}
        rx={12.5}
        ry={9}
        fill="none"
        stroke="#5BF3FF"
        strokeOpacity={0.22}
        strokeWidth={0.4}
      />
      <ellipse
        cx={16}
        cy={16}
        rx={5}
        ry={12.5}
        fill="none"
        stroke="#5BF3FF"
        strokeOpacity={0.28}
        strokeWidth={0.4}
      />
      <line
        x1={16}
        y1={3.5}
        x2={16}
        y2={28.5}
        stroke="#5BF3FF"
        strokeOpacity={0.4}
        strokeWidth={0.5}
      />
      <path
        d="M10 9 Q9 11 10 13 L11 15 L10 17 Q10 19 12 21 L13 23 L14 22 L13 19 L14 17 L13 14 L12 12 L11 10 Z"
        fill="#FF3D9A"
        opacity={0.85}
        style={{ filter: "drop-shadow(0 0 2px #FF3D9A)" }}
      />
      <path
        d="M17 8 L19 9 L20 11 L19 13 L20 15 L19 17 L18 19 L17 21 L16 22 L16 18 L17 15 L16 12 L17 10 Z"
        fill="#5BF3FF"
        opacity={0.9}
        style={{ filter: "drop-shadow(0 0 2px #5BF3FF)" }}
      />
      <path
        d="M21 9 Q23 10 24 12 L23 14 L22 13 L21 12 Z M22 17 L24 18 L23 20 L21 19 Z"
        fill="#7CFFA8"
        opacity={0.9}
        style={{ filter: "drop-shadow(0 0 2px #7CFFA8)" }}
      />
      <ellipse cx={11} cy={9} rx={2.4} ry={1.4} fill="#fff" opacity={0.15} />
    </svg>
  );
}

function NeonMicIcon({
  size = 20,
  dim = false,
}: {
  size?: number;
  dim?: boolean;
}) {
  const C = "#5BF3FF";
  const opacity = dim ? 0.55 : 1;
  const glow = dim ? 2.5 : 5;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="overflow-visible"
      style={{ opacity }}
    >
      <defs>
        <linearGradient id="mic-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A8F8FF" />
          <stop offset="100%" stopColor="#5BF3FF" />
        </linearGradient>
      </defs>
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
      <path
        d="M5.5 11 a6.5 6.5 0 0 0 13 0"
        fill="none"
        stroke={C}
        strokeWidth={1.6}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 ${glow}px ${C})` }}
      />
      <line
        x1={12}
        y1={17.5}
        x2={12}
        y2={20.5}
        stroke={C}
        strokeWidth={1.6}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 ${glow * 0.6}px ${C})` }}
      />
      <line
        x1={8}
        y1={20.5}
        x2={16}
        y2={20.5}
        stroke={C}
        strokeWidth={1.6}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 ${glow * 0.6}px ${C})` }}
      />
    </svg>
  );
}

function Divider({ strong = false }: { strong?: boolean }) {
  return (
    <span
      className="w-px self-stretch"
      style={{
        background: strong
          ? "linear-gradient(180deg, transparent 0%, rgba(91,243,255,0.55) 25%, rgba(91,243,255,0.55) 75%, transparent 100%)"
          : "linear-gradient(180deg, transparent 0%, rgba(91,243,255,0.25) 30%, rgba(91,243,255,0.25) 70%, transparent 100%)",
        boxShadow: strong ? "0 0 6px rgba(91,243,255,0.35)" : undefined,
      }}
    />
  );
}

function hexToRgbTriplet(hex: string): string {
  const h = hex.replace("#", "");
  const n =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

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
          <linearGradient
            id={`chev-fill-${direction}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#FFD27A" />
            <stop offset="45%" stopColor="#FFA73A" />
            <stop offset="100%" stopColor="#E06A00" />
          </linearGradient>
          <linearGradient
            id={`chev-edge-${direction}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#FFE5B4" />
            <stop offset="100%" stopColor="#FF8A1F" />
          </linearGradient>
          <filter
            id={`chev-glow-${direction}`}
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
            <feGaussianBlur stdDeviation="2.4" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b2" />
            <feMerge>
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M4 22 L20 6 L36 22 L30 22 L20 12 L10 22 Z"
          fill="#FF7A14"
          opacity="0.55"
          filter={`url(#chev-glow-${direction})`}
        />
        <path
          d="M5 21 L20 7 L35 21 L29 21 L20 12.5 L11 21 Z"
          fill={`url(#chev-fill-${direction})`}
          stroke={`url(#chev-edge-${direction})`}
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
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
