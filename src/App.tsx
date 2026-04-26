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

      {/* Neon-tube watermark — top left */}
      <div className="pointer-events-none fixed top-5 left-6 z-20 select-none">
        <NeonWordmark />
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan-glow/55 mt-1.5 ml-0.5">
          {loading
            ? "syncing channel"
            : error
              ? "channel offline"
              : `${jobs.length} jobs · western wa`}
        </div>
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
 * Neon-tube watermark — "NORTH SKY" double-glow above "LUMINA V3".
 * Renders white tube core with stacked cyan halos. Uses Rajdhani (already
 * loaded) for the bold-condensed neon-sign feel.
 */
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
