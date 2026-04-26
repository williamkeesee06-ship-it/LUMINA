import { useEffect, useMemo } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useUI } from "@/store/uiStore";
import { GALAXY_COLORS } from "@/lib/statusMap";
import { sfx } from "@/lib/audio";

/**
 * Build a teardrop pin SVG (Google Maps Symbol path) at the given color.
 * Path is centered such that the tip sits exactly at the marker's position.
 * The inner dot is drawn as a separate marker to get the bright "glowing
 * core" look from the reference.
 */
function pinPath() {
  // Classic teardrop: tip at (0,0), bulb above. Coordinates in SVG units.
  return "M 0 0 C -8 -10 -10 -16 -10 -22 A 10 10 0 1 1 10 -22 C 10 -16 8 -10 0 0 Z";
}

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
    // Seattle metro center — between Seattle, Bellevue, and Lynnwood.
    return { lat: 47.6515, lng: -122.2735 };
  }, [visible, selectedJobId, jobs]);

  // Compute lat/lng bounds across all visible jobs so we can auto-fit.
  const bounds = useMemo(() => {
    if (visible.length === 0) return null;
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (const j of visible) {
      const { lat, lng } = j.coords!;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
    return { minLat, maxLat, minLng, maxLng };
  }, [visible]);

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
        <div className="text-sm text-cyan-glow mt-2 font-mono">
          Awaiting maps key. Add VITE_GOOGLE_MAPS_API_KEY in Vercel env to bring this surface online.
        </div>
        <button
          type="button"
          onClick={() => {
            sfx.select();
            riseFromMap();
          }}
          className="mt-4 text-cyan-glow/70 hover:text-cyan-glow font-mono text-xs uppercase tracking-tactical border border-cyan-glow/30 px-3 py-1.5"
        >
          Warp out to universe
        </button>
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
              defaultZoom={10}
              gestureHandling="greedy"
              disableDefaultUI={true}
              colorScheme="DARK"
              styles={DARK_TACTICAL_STYLES}
              clickableIcons={false}
              backgroundColor="#02040A"
            >
              {visible.map((j) => {
                const isHistorical = j.status === "Complete";
                const inRoute = showRouteLayer && routeJobIds.includes(j.id);
                const color = inRoute
                  ? "#FF3D9A"
                  : isHistorical
                    ? "#1A1F2E"
                    : GALAXY_COLORS[j.status];
                const isSelected = selectedJobId === j.id;
                return (
                  <NeonPin
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
              <FitToBounds bounds={bounds} selectedId={selectedJobId} center={center} />
            </Map>
          </APIProvider>
        </div>
      </div>
    </div>
  );
}

/**
 * NeonPin — a teardrop pin with a bright glowing dot at its bulb,
 * matching the reference vibe. Built from two stacked legacy Markers:
 *   1. The teardrop body (SVG path, color = category color, dropping a glow)
 *   2. A bright white inner dot anchored to the bulb center
 *
 * Historical jobs use a near-black body with a faint white outline so
 * they read as "ghost" markers without disappearing into the map.
 */
function NeonPin({
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
    const g = (window as unknown as { google?: { maps?: any } }).google?.maps;
    if (!map || !g) return;

    const scale = selected ? 1.55 : 1.25;
    const stroke = historical ? "#3A4258" : "#FFFFFF";
    const strokeWeight = selected ? 1.6 : historical ? 0.9 : 1.1;
    const fillOpacity = historical ? 0.85 : 1;

    // Outer teardrop body
    const body = new g.Marker({
      position,
      map,
      icon: {
        path: pinPath(),
        fillColor: color,
        fillOpacity,
        strokeColor: stroke,
        strokeOpacity: historical ? 0.6 : 0.85,
        strokeWeight,
        scale,
        anchor: new g.Point(0, 0), // tip of teardrop sits on the coord
      },
      zIndex: selected ? 1000 : historical ? 5 : 50,
      cursor: "pointer",
    });
    body.addListener("click", onClick);

    // Inner glowing dot — sits inside the bulb. Skipped for historical pins
    // so they read as "empty/inactive".
    let dot: any = null;
    if (!historical) {
      dot = new g.Marker({
        position,
        map,
        clickable: false,
        icon: {
          path: g.SymbolPath.CIRCLE,
          scale: selected ? 4 : 3.2,
          fillColor: "#FFFFFF",
          fillOpacity: 1,
          strokeColor: color,
          strokeOpacity: 0.9,
          strokeWeight: 1.2,
          // Anchor the dot up into the bulb center (the bulb sits ~22px above tip).
          anchor: new g.Point(0, 22),
        },
        zIndex: (selected ? 1000 : 50) + 1,
      });
    }

    return () => {
      body.setMap(null);
      if (dot) dot.setMap(null);
    };
  }, [map, position.lat, position.lng, color, selected, historical, onClick]);
  return null;
}

/**
 * Auto-fit the map to all visible markers on first open. When a specific
 * job is selected, smoothly recenter on that single job instead.
 */
function FitToBounds({
  bounds,
  selectedId,
  center,
}: {
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
  selectedId: string | null;
  center: { lat: number; lng: number };
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const g = (window as unknown as { google?: { maps?: any } }).google?.maps;
    if (!g) return;

    if (selectedId) {
      map.panTo(center);
      return;
    }

    if (bounds) {
      const sw = new g.LatLng(bounds.minLat, bounds.minLng);
      const ne = new g.LatLng(bounds.maxLat, bounds.maxLng);
      const llb = new g.LatLngBounds(sw, ne);
      // Padding leaves room for the right-rail HUD and top header.
      map.fitBounds(llb, { top: 80, right: 380, bottom: 60, left: 60 });
    }
  }, [map, bounds?.minLat, bounds?.maxLat, bounds?.minLng, bounds?.maxLng, selectedId, center.lat, center.lng]);
  return null;
}

// Quiet, dramatic dark map style — the reference vibe.
// Land is near-black, water is even deeper void, only faint white admin
// borders show. Every road, label, and POI is silenced so the only thing
// the eye locks onto is the glowing pins.
const DARK_TACTICAL_STYLES = [
  // Base land — deep charcoal-black
  { elementType: "geometry", stylers: [{ color: "#0A0E16" }] },
  { elementType: "labels", stylers: [{ visibility: "off" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },

  // Admin outlines — the only visible structure: faint white state/county
  // borders, exactly like the reference.
  {
    featureType: "administrative",
    elementType: "geometry.fill",
    stylers: [{ color: "#0A0E16" }],
  },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#FFFFFF" }, { weight: 0.4 }, { lightness: -50 }],
  },
  {
    featureType: "administrative.country",
    elementType: "geometry.stroke",
    stylers: [{ color: "#FFFFFF" }, { weight: 0.7 }, { lightness: -30 }],
  },
  {
    featureType: "administrative.province",
    elementType: "geometry.stroke",
    stylers: [{ color: "#FFFFFF" }, { weight: 0.5 }, { lightness: -40 }],
  },
  { featureType: "administrative", elementType: "labels", stylers: [{ visibility: "off" }] },

  // Landscape — slightly lighter than water for subtle continental shape
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#0C111B" }],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#0B0F18" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry",
    stylers: [{ color: "#0E1320" }],
  },

  // Parks — barely-there green tint, no labels
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#0B1318" }],
  },

  // Roads — silent. Filled to match land so they vanish; only barely-visible
  // strokes remain at the highest zoom levels.
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#0A0E16" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  {
    featureType: "road.highway",
    elementType: "geometry.fill",
    stylers: [{ color: "#0E1422" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ visibility: "off" }],
  },

  // Water — deepest void, slightly inkier than the land
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#04070C" }],
  },
  { featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] },

  // Kill all POI / transit / business clutter
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
  { featureType: "poi.school", stylers: [{ visibility: "off" }] },
  { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "transit.station", stylers: [{ visibility: "off" }] },
  { featureType: "transit.line", stylers: [{ visibility: "off" }] },
] as const;
