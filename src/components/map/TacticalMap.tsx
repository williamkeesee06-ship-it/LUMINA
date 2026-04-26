import { useMemo } from "react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { useUI } from "@/store/uiStore";
import { GALAXY_COLORS } from "@/lib/statusMap";
import { sfx } from "@/lib/audio";

const DARK_STYLE_ID = "tactical_v3"; // visual approximation; we also pass styles
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

/**
 * Tactical map. Surface, not the home. Bible:
 * - View job markers, center on selected, filter by focused galaxy, route overlays.
 * - Black pins for historical (Complete) operations.
 * - Truthful state — never decorative.
 */
export function TacticalMap() {
  const isMapOpen = useUI((s) => s.isMapOpen);
  const setMapOpen = useUI((s) => s.setMapOpen);
  const jobs = useUI((s) => s.jobs);
  const focusedGalaxy = useUI((s) => s.focusedGalaxy);
  const selectedJobId = useUI((s) => s.selectedJobId);
  const selectJob = useUI((s) => s.selectJob);
  const showRouteLayer = useUI((s) => s.showRouteLayer);
  const routeJobIds = useUI((s) => s.routeJobIds);

  const visible = useMemo(() => {
    let pool = jobs.filter((j) => j.coords);
    if (focusedGalaxy) pool = pool.filter((j) => j.status === focusedGalaxy);
    return pool;
  }, [jobs, focusedGalaxy]);

  const center = useMemo(() => {
    const sel = selectedJobId ? jobs.find((j) => j.id === selectedJobId) : undefined;
    if (sel?.coords) return sel.coords;
    if (visible.length > 0) {
      const lat = visible.reduce((a, j) => a + j.coords!.lat, 0) / visible.length;
      const lng = visible.reduce((a, j) => a + j.coords!.lng, 0) / visible.length;
      return { lat, lng };
    }
    return { lat: 47.6, lng: -122.3 }; // Western WA default
  }, [visible, selectedJobId, jobs]);

  if (!isMapOpen) return null;
  if (!MAPS_KEY) {
    return (
      <div className="pointer-events-auto fixed top-6 left-6 bottom-32 z-30 w-[520px] max-w-[44vw] metallic-plate clip-corner p-6">
        <div className="tactical-label">tactical map</div>
        <div className="text-sm text-red-alert mt-2 font-mono">
          Maps key not configured. Map surface unavailable.
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto fixed top-6 left-6 bottom-32 z-30 w-[520px] max-w-[44vw]">
      <div className="metallic-plate clip-corner h-full overflow-hidden flex flex-col relative">
        <span className="reticle opacity-25" />
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-cyan-glow/15">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-glow shadow-[0_0_8px_#5BF3FF]" />
            <span className="font-display tracking-tactical text-xs uppercase text-cyan-glow">
              tactical map
            </span>
            <span className="font-mono text-[10px] text-white/40">
              {visible.length} markers
              {focusedGalaxy ? ` · ${focusedGalaxy}` : ""}
              {showRouteLayer && routeJobIds.length > 0 ? ` · route ${routeJobIds.length}` : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              sfx.select();
              setMapOpen(false);
            }}
            className="text-cyan-glow/60 hover:text-cyan-glow"
          >
            ×
          </button>
        </div>
        <div className="flex-1 relative">
          <APIProvider apiKey={MAPS_KEY}>
            <Map
              mapId={DARK_STYLE_ID}
              defaultCenter={center}
              defaultZoom={9}
              gestureHandling="greedy"
              disableDefaultUI={true}
              colorScheme="DARK"
              styles={DARK_TACTICAL_STYLES}
            >
              {visible.map((j) => {
                const isHistorical = j.status === "Complete";
                const inRoute = showRouteLayer && routeJobIds.includes(j.id);
                const color = inRoute
                  ? "#FF3D9A"
                  : isHistorical
                    ? "#000000"
                    : GALAXY_COLORS[j.status];
                const isSelected = selectedJobId === j.id;
                return (
                  <AdvancedMarker
                    key={j.id}
                    position={j.coords!}
                    onClick={() => {
                      sfx.select();
                      selectJob(j.id);
                    }}
                  >
                    <Pin color={color} selected={isSelected} historical={isHistorical} />
                  </AdvancedMarker>
                );
              })}
              <Recenter center={center} />
            </Map>
          </APIProvider>
        </div>
      </div>
    </div>
  );
}

function Pin({
  color,
  selected,
  historical,
}: {
  color: string;
  selected: boolean;
  historical: boolean;
}) {
  return (
    <div className="relative" style={{ width: 18, height: 18 }}>
      <div
        className="rounded-full border"
        style={{
          width: 18,
          height: 18,
          background: color,
          borderColor: historical ? "#444" : "rgba(255,255,255,0.45)",
          boxShadow: selected
            ? `0 0 0 2px #fff, 0 0 14px ${color}`
            : `0 0 8px ${historical ? "rgba(0,0,0,0.6)" : color}`,
        }}
      />
    </div>
  );
}

function Recenter({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  if (map) map.panTo(center);
  return null;
}

const DARK_TACTICAL_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#0b0f1a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b0f1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5BF3FF" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1B2436" }],
  },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#141B2B" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#5A6985" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#03060B" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];
