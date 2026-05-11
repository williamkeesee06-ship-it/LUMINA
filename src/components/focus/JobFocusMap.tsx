import { useEffect, useRef, useState } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { GALAXY_COLORS } from "@/lib/statusMap";
import { sfx } from "@/lib/audio";
import type { Job } from "@/types";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// Same teardrop shape used by TacticalMap so the visual language matches.
const PIN_PATH =
  "M 0 0 C -7 -8 -12 -14 -12 -22 A 12 12 0 1 1 12 -22 C 12 -14 7 -8 0 0 Z";

/**
 * JobFocusMap — single-pin map locked to one job, with an on-demand
 * Street View overlay.
 *
 * Per Billy's spec:
 *   - Always opens to the map first
 *   - "STREET VIEW" toggle switches to a Street View pano
 *   - Closing Street View returns to the map
 */
export function JobFocusMap({
  job,
  toggleAnchor = "right",
}: {
  job: Job;
  /**
   *  Where to dock the MAP/STREET VIEW sub-toggle. Defaults to top-right
   *  to preserve legacy callers; set to "left" inside Focus Mode so the
   *  parent's neon-blue EMAIL/MAP pill owns the top-right corner.
   */
  toggleAnchor?: "right" | "left";
}) {
  const [streetView, setStreetView] = useState(false);
  const color = GALAXY_COLORS[job.status];

  // If the focused job changes (defensive), drop back to the map view first.
  useEffect(() => {
    setStreetView(false);
  }, [job.id]);

  if (!MAPS_KEY) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-white/40 font-mono text-xs uppercase tracking-[0.2em]">
        Maps key missing
      </div>
    );
  }

  if (!job.coords) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white/45 font-mono text-xs uppercase tracking-[0.2em] gap-2 px-8 text-center">
        <span style={{ color }}>NO COORDINATES</span>
        <span className="text-white/35 text-[11px] normal-case tracking-normal">
          {job.fullAddress ?? "Address not yet geocoded — edit the address on the left to attempt a fix."}
        </span>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      {!streetView ? (
        <APIProvider apiKey={MAPS_KEY}>
          <Map
            defaultCenter={job.coords}
            defaultZoom={18}
            gestureHandling="greedy"
            disableDefaultUI={true}
            colorScheme="DARK"
            styles={DARK_TACTICAL_STYLES}
            clickableIcons={false}
            backgroundColor="#02040A"
            mapTypeId="roadmap"
          >
            <RuntimeMarker position={job.coords} color={color} />
          </Map>
        </APIProvider>
      ) : (
        <APIProvider apiKey={MAPS_KEY}>
          {/* Street View needs the JS SDK loaded; APIProvider handles it. */}
          <StreetViewPano position={job.coords} />
        </APIProvider>
      )}

      {/* Map ↔ Street View toggle */}
      <div
        className={`absolute top-4 ${
          toggleAnchor === "left" ? "left-4" : "right-4"
        } flex gap-1 pointer-events-auto z-10`}
      >
        <ToggleBtn active={!streetView} accent={color} label="MAP" onClick={() => setStreetView(false)} />
        <ToggleBtn active={streetView} accent={color} label="STREET VIEW" onClick={() => setStreetView(true)} />
      </div>
    </div>
  );
}

function ToggleBtn({
  active,
  accent,
  label,
  onClick,
}: {
  active: boolean;
  accent: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={() => sfx.hover()}
      onClick={() => {
        sfx.select();
        onClick();
      }}
      className="font-mono uppercase tracking-[0.2em] text-[10px] px-3 py-1.5 rounded-sm border transition-colors"
      style={{
        color: active ? accent : "rgba(255,255,255,0.6)",
        borderColor: active ? `${accent}99` : "rgba(255,255,255,0.15)",
        background: active ? `${accent}1f` : "rgba(0,0,0,0.55)",
        textShadow: active ? `0 0 8px ${accent}80` : undefined,
        backdropFilter: "blur(6px)",
      }}
    >
      {label}
    </button>
  );
}

/**
 * Single neon teardrop marker, painted on the parent <Map />. Uses the
 * runtime-resolved google.maps namespace via window so we don't need
 * @types/google.maps as a dev dep (mirrors TacticalMap's pattern).
 */
function RuntimeMarker({
  position,
  color,
}: {
  position: { lat: number; lng: number };
  color: string;
}) {
  const map = useMap();
  useEffect(() => {
    const g = (window as unknown as { google?: { maps?: any } }).google?.maps;
    if (!map || !g) return;
    const marker = new g.Marker({
      position,
      map,
      icon: {
        path: PIN_PATH,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: "#0A0E16",
        strokeOpacity: 0.9,
        strokeWeight: 1.2,
        scale: 1.7,
        anchor: new g.Point(0, 0),
      },
      zIndex: 999,
    });
    return () => marker.setMap(null);
  }, [map, position.lat, position.lng, color]);
  return null;
}

/**
 * StreetViewPano — uses the Street View JS SDK directly. Renders a
 * panorama centered on the job. If imagery isn't available, surface a
 * clear "no street view" message rather than a blank black square.
 */
function StreetViewPano({ position }: { position: { lat: number; lng: number } }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const g = (window as unknown as { google?: { maps?: any } }).google?.maps;
    const el = containerRef.current;
    if (!g || !el) {
      // The SDK might not be ready yet; retry once on the next tick.
      const t = window.setTimeout(() => {
        const g2 = (window as unknown as { google?: { maps?: any } }).google?.maps;
        if (!g2 || !containerRef.current) return;
        mountPano(g2, containerRef.current);
      }, 250);
      return () => window.clearTimeout(t);
    }
    mountPano(g, el);

    function mountPano(g: any, el: HTMLDivElement) {
      const svService = new g.StreetViewService();
      svService.getPanorama(
        { location: position, radius: 50, source: g.StreetViewSource.OUTDOOR },
        (data: any, status: any) => {
          if (status !== g.StreetViewStatus.OK || !data?.location?.latLng) {
            setUnavailable(true);
            return;
          }
          new g.StreetViewPanorama(el, {
            position: data.location.latLng,
            pov: { heading: 0, pitch: 0 },
            zoom: 1,
            motionTracking: false,
            motionTrackingControl: false,
            fullscreenControl: false,
            addressControl: false,
            enableCloseButton: false,
            showRoadLabels: false,
            panControl: true,
            zoomControl: true,
          });
        },
      );
    }
  }, [position.lat, position.lng]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      {unavailable && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 text-white/65 font-mono text-xs uppercase tracking-[0.2em] text-center px-8">
          No street view imagery within 50 m of this address
        </div>
      )}
    </>
  );
}

const DARK_TACTICAL_STYLES: any[] = [
  { elementType: "geometry", stylers: [{ color: "#0a0f1c" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5b6c8c" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0f1c" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#1a2332" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1f2a3d" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#243248" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7b8aa8" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c3a55" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#03070f" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4762a3" }] },
];
