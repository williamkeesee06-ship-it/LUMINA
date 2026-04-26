import { useEffect, useMemo } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useUI } from "@/store/uiStore";
import { GALAXY_COLORS } from "@/lib/statusMap";
import { sfx } from "@/lib/audio";

// We rely on inline `styles` for the dark tactical look. A custom mapId would
// require Cloud-console map style and is unnecessary here.
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

/**
 * Tactical map. Surface, not the home. Bible:
 * - View job markers, center on selected, filter by focused galaxy, route overlays.
 * - Black pins for historical (Complete) operations.
 * - Truthful state — never decorative.
 */
export function TacticalMap() {
  const isMapOpen = useUI((s) => s.isMapOpen);
  const mapTransition = useUI((s) => s.mapTransition);
  const riseFromMap = useUI((s) => s.riseFromMap);
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

  // Mount-in / mount-out fade so the surface bleeds through the warp flash
  // instead of popping. "open" = fully visible. "diving"/"rising" = behind
  // flash, still mounted but at low opacity.
  const surfaceOpacity = mapTransition === "open" ? 1 : 0.0;
  const surfaceTransition =
    mapTransition === "open"
      ? "opacity 380ms ease-out 80ms"
      : "opacity 220ms ease-in";

  if (!MAPS_KEY) {
    return (
      <div
        className="pointer-events-auto fixed inset-0 z-30 metallic-plate p-6"
        style={{ opacity: surfaceOpacity, transition: surfaceTransition }}
      >
        <div className="tactical-label">tactical map</div>
        <div className="text-sm text-red-alert mt-2 font-mono">
          Maps key not configured. Map surface unavailable.
        </div>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-30"
      style={{ opacity: surfaceOpacity, transition: surfaceTransition }}
    >
      <div className="metallic-plate h-full w-full overflow-hidden flex flex-col relative">
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
              riseFromMap();
            }}
            className="text-cyan-glow/60 hover:text-cyan-glow text-lg leading-none px-2"
            title="Warp out to universe"
          >
            ×
          </button>
        </div>
        <div className="flex-1 relative">
          <APIProvider apiKey={MAPS_KEY}>
            <Map
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
                // AdvancedMarker requires a mapId; without one, fall back
                // to a styled <Marker>-style div via plain marker color.
                return (
                  <PlainMarker
                    key={j.id}
                    position={j.coords!}
                    color={color}
                    selected={isSelected}
                    historical={isHistorical}
                    onClick={() => {
                      sfx.select();
                      selectJob(j.id);
                    }}
                  />
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

/**
 * Marker that draws itself directly onto the Google map using the legacy
 * `google.maps.Marker` API. This avoids the AdvancedMarker requirement of a
 * mapId and works with our inline-styled tactical map.
 */
function PlainMarker({
  position,
  color,
  selected,
  historical,
  onClick,
}: {
  position: { lat: number; lng: number };
  color: string;
  selected: boolean;
  historical: boolean;
  onClick: () => void;
}) {
  const map = useMap();
  useEffect(() => {
    // Access google.maps via the global without leaning on @types/google.maps.
    // The OAuth-flavored Window.google declaration in googleAuth.ts intentionally
    // does not include `maps`, so we narrow through any here.
    const g = (window as unknown as { google?: { maps?: any } }).google?.maps;
    if (!map || !g) return;
    const marker = new g.Marker({
      position,
      map,
      icon: {
        path: g.SymbolPath.CIRCLE,
        scale: selected ? 9 : 7,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: selected ? "#FFFFFF" : historical ? "#444444" : "rgba(255,255,255,0.55)",
        strokeWeight: selected ? 2 : 1,
      },
      zIndex: selected ? 1000 : historical ? 1 : 50,
    });
    marker.addListener("click", onClick);
    return () => marker.setMap(null);
  }, [map, position.lat, position.lng, color, selected, historical, onClick]);
  return null;
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
