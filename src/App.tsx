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

      {/* Tactical map */}
      <TacticalMap />

      {/* Universe label / total marker — top left */}
      <div className="pointer-events-none fixed top-6 left-6 z-20">
        <div className="font-display tracking-tactical text-[10px] uppercase text-cyan-glow/70">
          north sky · western wa
        </div>
        <div className="font-mono text-[10px] text-white/40 mt-0.5">
          {loading ? "syncing channel" : error ? "channel offline" : `${jobs.length} jobs in field`}
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
