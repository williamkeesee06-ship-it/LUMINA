import { useEffect, useState } from "react";
import { useUI } from "@/store/uiStore";
import { fetchJobs, geocodeAddresses } from "@/lib/api";
import { UniverseScene } from "@/components/universe/UniverseScene";
import { HUD } from "@/components/hud/HUD";
import { JobPanel } from "@/components/panel/JobPanel";
import { LuminaPanel } from "@/components/lumina/LuminaPanel";
import { TacticalMap } from "@/components/map/TacticalMap";
import { Boot } from "@/components/effects/Boot";
import { FailureOverlay } from "@/components/effects/FailureOverlay";
import { HyperspaceTransition } from "@/components/effects/HyperspaceTransition";

export default function App() {
  const setJobs = useUI((s) => s.setJobs);
  const setLoading = useUI((s) => s.setLoading);
  const setError = useUI((s) => s.setError);
  const error = useUI((s) => s.error);
  const loading = useUI((s) => s.loading);
  const jobs = useUI((s) => s.jobs);
  const googleToken = useUI((s) => s.googleToken);
  const setUnreadCount = useUI((s) => s.setUnreadCount);

  const [booted, setBooted] = useState(false);

  // Initial load — Smartsheet first.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const fetched = await fetchJobs();
        if (!alive) return;
        setJobs(fetched);
        setLoading(false);
        // Geocode in background; merge as results arrive.
        const addresses = fetched
          .map((j) => j.fullAddress)
          .filter((a): a is string => Boolean(a));
        const unique = [...new Set(addresses)];
        if (unique.length > 0) {
          // Chunk to avoid one giant request
          const CHUNK = 60;
          for (let i = 0; i < unique.length; i += CHUNK) {
            const slice = unique.slice(i, i + CHUNK);
            geocodeAddresses(slice).then((results) => {
              if (!alive) return;
              useUI.setState((s) => ({
                jobs: s.jobs.map((j) => {
                  if (!j.fullAddress) return j;
                  const c = results[j.fullAddress];
                  if (!c) return j;
                  return { ...j, coords: c };
                }),
              }));
            });
          }
        }
      } catch (e) {
        if (!alive) return;
        setLoading(false);
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [setJobs, setLoading, setError]);

  // Refresh Gmail unread count when token arrives.
  useEffect(() => {
    if (!googleToken) {
      setUnreadCount(0);
      return;
    }
    fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX", {
      headers: { Authorization: `Bearer ${googleToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { messagesUnread?: number } | null) => {
        if (data?.messagesUnread != null) setUnreadCount(data.messagesUnread);
      })
      .catch(() => {});
  }, [googleToken, setUnreadCount]);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* 3D universe — primary navigation surface */}
      <UniverseScene />

      {/* Subtle scanlines over the whole world */}
      <div className="pointer-events-none fixed inset-0 z-10 scanlines" />

      {/* HUD — three modes */}
      <HUD />

      {/* Planet intelligence panel */}
      <JobPanel />

      {/* LUMINA chat */}
      <LuminaPanel />

      {/* Tactical map — fullscreen surface, lives inside the universe */}
      <TacticalMap />

      {/* Hyperspace warp overlay between universe and map */}
      <HyperspaceTransition />

      {/* Editorial pillar watermark — bright neon cyan crisp glow */}
      <div className="pointer-events-none fixed top-5 left-6 z-20 select-none">
        <EditorialWatermark
          status={
            loading
              ? "syncing channel"
              : error
                ? "channel offline"
                : `${jobs.length} jobs · western wa`
          }
        />
      </div>

      {/* Boot overlay */}
      {!booted && <Boot onDone={() => setBooted(true)} />}

      {/* Failure overlay */}
      {error && (
        <FailureOverlay
          message={error}
          onRetry={() => {
            setError(null);
            setLoading(true);
            fetchJobs()
              .then((js) => {
                setJobs(js);
                setLoading(false);
              })
              .catch((e) => {
                setLoading(false);
                setError(e instanceof Error ? e.message : "Unknown error");
              });
          }}
        />
      )}
    </div>
  );
}

/**
 * Editorial pillar watermark.
 *
 * Composition (left → right):
 *   1. Vertical "NORTHSKY" caps in tracked condensed (rotated 180°, runs bottom-to-top)
 *   2. A bright neon cyan vertical pillar with crisp high glow (stacked tight
 *      box-shadow blurs, NOT a soft gaussian halo)
 *   3. Big white "LUMINA" display sans + small cyan "V3" superscript
 *   4. Tiny status row beneath: cyan dot + jobs count in faded mono
 */
function EditorialWatermark({ status }: { status: string }) {
  // Crisp high-glow stack — tight blur radii so the line stays razor sharp
  // while still throwing a bright halo. This is the spec the user asked for.
  const PILLAR_GLOW = [
    "0 0 1px #FFFFFF",
    "0 0 2px #5BF3FF",
    "0 0 4px #5BF3FF",
    "0 0 8px rgba(91,243,255,0.85)",
    "0 0 14px rgba(91,243,255,0.55)",
    "0 0 22px rgba(91,243,255,0.32)",
  ].join(", ");

  return (
    <div className="flex flex-col items-start">
      <div className="flex items-stretch gap-3">
        {/* Vertical NORTHSKY caps — runs bottom-to-top alongside the pillar */}
        <div
          className="flex items-center justify-center font-display text-[10px] uppercase text-white/85"
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            letterSpacing: "0.55em",
            fontWeight: 600,
            textShadow: "0 0 6px rgba(91,243,255,0.35)",
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          NORTHSKY
        </div>

        {/* Bright neon cyan pillar — crisp high glow */}
        <div
          aria-hidden
          style={{
            width: 2,
            background: "#FFFFFF",
            borderRadius: 2,
            boxShadow: PILLAR_GLOW,
            alignSelf: "stretch",
            minHeight: 78,
            animation: "neon-flicker 7s ease-in-out infinite",
          }}
        />

        {/* LUMINA wordmark + V3 superscript */}
        <div className="flex flex-col justify-center pl-1">
          <div className="flex items-start">
            <span
              className="font-display text-white"
              style={{
                fontSize: 44,
                fontWeight: 600,
                letterSpacing: "0.04em",
                lineHeight: 0.9,
                textShadow:
                  "0 0 1px rgba(255,255,255,0.9), 0 0 8px rgba(255,255,255,0.25)",
              }}
            >
              LUMINA
            </span>
            <span
              className="font-display"
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.18em",
                color: "#5BF3FF",
                marginLeft: 6,
                marginTop: 2,
                textShadow:
                  "0 0 2px #5BF3FF, 0 0 6px rgba(91,243,255,0.7), 0 0 12px rgba(91,243,255,0.4)",
              }}
            >
              V3
            </span>
          </div>
          <div
            className="font-mono text-[9px] uppercase text-white/50"
            style={{ letterSpacing: "0.32em", marginTop: 4 }}
          >
            COMMAND
          </div>
        </div>
      </div>

      {/* Status row beneath the wordmark — cyan dot + jobs count */}
      <div className="flex items-center gap-2 mt-2.5 ml-[34px]">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{
            background: "#5BF3FF",
            boxShadow:
              "0 0 3px #5BF3FF, 0 0 7px rgba(91,243,255,0.7)",
          }}
        />
        <span
          className="font-mono text-[10px] uppercase text-white/55"
          style={{ letterSpacing: "0.32em" }}
        >
          {status}
        </span>
      </div>
    </div>
  );
}

// Legacy neon wordmark kept for reference; unused.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function NeonWordmark() {
  const FONT = "'Rajdhani', system-ui, sans-serif";
  return (
    <div className="flex flex-col items-start animate-neon-flicker">
      {/* NORTH SKY — large neon-tube */}
      <svg
        width={260}
        height={60}
        viewBox="0 0 260 60"
        className="overflow-visible"
        aria-label="NORTH SKY"
      >
        <defs>
          <filter id="ns-halo-far" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id="ns-halo-mid" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
          <filter id="ns-halo-tight" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1" />
          </filter>
        </defs>
        {/* Far cyan halo wash */}
        <text
          x="130"
          y="44"
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="46"
          fontWeight={700}
          letterSpacing="3"
          fill="#5BF3FF"
          opacity={0.55}
          filter="url(#ns-halo-far)"
        >
          NORTH SKY
        </text>
        {/* Mid white halo */}
        <text
          x="130"
          y="44"
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="46"
          fontWeight={700}
          letterSpacing="3"
          fill="#A8F8FF"
          opacity={0.85}
          filter="url(#ns-halo-mid)"
        >
          NORTH SKY
        </text>
        {/* Tube body — white outer */}
        <text
          x="130"
          y="44"
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="46"
          fontWeight={700}
          letterSpacing="3"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={2}
          filter="url(#ns-halo-tight)"
        >
          NORTH SKY
        </text>
        {/* Bright tube core — razor-thin white */}
        <text
          x="130"
          y="44"
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="46"
          fontWeight={700}
          letterSpacing="3"
          fill="#FFFFFF"
        >
          NORTH SKY
        </text>
      </svg>

      {/* LUMINA V3 — smaller solid neon (no halo wash, just glow) */}
      <svg
        width={180}
        height={30}
        viewBox="0 0 180 30"
        className="overflow-visible -mt-1.5"
        aria-label="LUMINA V3"
      >
        <defs>
          <filter id="lv3-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>
        <text
          x="90"
          y="22"
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="24"
          fontWeight={700}
          letterSpacing="3"
          fill="#5BF3FF"
          opacity={0.55}
          filter="url(#lv3-glow)"
        >
          LUMINA V3
        </text>
        <text
          x="90"
          y="22"
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="24"
          fontWeight={700}
          letterSpacing="3"
          fill="#FFFFFF"
        >
          LUMINA V3
        </text>
      </svg>
    </div>
  );
}
