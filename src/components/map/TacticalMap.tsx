import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useUI } from "@/store/uiStore";
import { GALAXY_COLORS } from "@/lib/statusMap";
import { sfx } from "@/lib/audio";
import { newAnnotationId } from "@/lib/mapAnnotations";
import type { MapAnnotation } from "@/types";
import { DrawingToolbar } from "./DrawingToolbar";
import { AnnotationPopup } from "./AnnotationPopup";

// ─── Pin helpers ─────────────────────────────────────────────────────────────

function pinPath() {
  return "M 0 0 C -7 -8 -12 -14 -12 -22 A 12 12 0 1 1 12 -22 C 12 -14 7 -8 0 0 Z";
}
function innerHolePath() {
  return "M -4.5 -22 A 4.5 4.5 0 1 1 4.5 -22 A 4.5 4.5 0 1 1 -4.5 -22 Z";
}

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// ─── TacticalMap ─────────────────────────────────────────────────────────────

export function TacticalMap() {
  const isMapOpen        = useUI((s) => s.isMapOpen);
  const mapTransition    = useUI((s) => s.mapTransition);
  const riseFromMap      = useUI((s) => s.riseFromMap);
  const jobs             = useUI((s) => s.jobs);
  const focusedGalaxy    = useUI((s) => s.focusedGalaxy);
  const selectedJobId    = useUI((s) => s.selectedJobId);
  const selectJob        = useUI((s) => s.selectJob);
  const showRouteLayer   = useUI((s) => s.showRouteLayer);
  const routeJobIds      = useUI((s) => s.routeJobIds);
  const hiddenGalaxies   = useUI((s) => s.hiddenGalaxies);

  // Annotation store
  const loadAnnotations     = useUI((s) => s.loadAnnotations);
  const addAnnotation       = useUI((s) => s.addAnnotation);
  const annotationsByJob    = useUI((s) => s.annotationsByJob);
  const drawingMode         = useUI((s) => s.drawingMode);
  const setDrawingMode      = useUI((s) => s.setDrawingMode);
  const activeAnnotationId  = useUI((s) => s.activeAnnotationId);
  const setActiveAnnotationId = useUI((s) => s.setActiveAnnotationId);

  // Local drawing style config (not persisted — defaults applied on each new annotation)
  const [toolConfig, setToolConfig] = useState({ color: "#3B82F6", strokeWeight: 3, fillOpacity: 0.2 });
  const [popupAnchor, setPopupAnchor] = useState<{ x: number; y: number } | null>(null);

  const visible = useMemo(() => {
    let pool = jobs.filter((j) => j.coords);
    if (focusedGalaxy) pool = pool.filter((j) => j.status === focusedGalaxy);
    if (hiddenGalaxies.length > 0) pool = pool.filter((j) => !hiddenGalaxies.includes(j.status));
    return pool;
  }, [jobs, focusedGalaxy, hiddenGalaxies]);

  const center = useMemo(() => {
    const sel = selectedJobId ? jobs.find((j) => j.id === selectedJobId) : undefined;
    if (sel?.coords) return sel.coords;
    if (visible.length > 0) {
      const lat = visible.reduce((a, j) => a + j.coords!.lat, 0) / visible.length;
      const lng = visible.reduce((a, j) => a + j.coords!.lng, 0) / visible.length;
      return { lat, lng };
    }
    return { lat: 47.6515, lng: -122.2735 };
  }, [visible, selectedJobId, jobs]);

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

  // Load annotations for the focused job when map opens
  useEffect(() => {
    if (isMapOpen && selectedJobId) {
      void loadAnnotations(selectedJobId);
    }
  }, [isMapOpen, selectedJobId, loadAnnotations]);

  // Resolve the active annotation for the popup
  const annotations = selectedJobId ? (annotationsByJob[selectedJobId] ?? []) : [];
  const activeAnnotation = activeAnnotationId
    ? annotations.find((a) => a.id === activeAnnotationId) ?? null
    : null;

  const handleAnnotationClick = useCallback(
    (id: string, x: number, y: number) => {
      setActiveAnnotationId(id);
      setPopupAnchor({ x, y });
    },
    [setActiveAnnotationId],
  );

  const handleMapClick = useCallback(
    (lat: number, lng: number, screenX: number, screenY: number) => {
      if (!selectedJobId) return;
      if (drawingMode === "cursor") return;

      if (drawingMode === "marker") {
        const ann: MapAnnotation = {
          id: newAnnotationId(),
          jobId: selectedJobId,
          type: "marker",
          name: "New Marker",
          description: "",
          createdAt: new Date().toISOString(),
          position: { lat, lng },
          color: toolConfig.color,
          strokeWeight: toolConfig.strokeWeight,
          fillOpacity: toolConfig.fillOpacity,
        };
        addAnnotation(ann);
        setActiveAnnotationId(ann.id);
        setPopupAnchor({ x: screenX, y: screenY });
        setDrawingMode("cursor");
      }
    },
    [selectedJobId, drawingMode, toolConfig, addAnnotation, setActiveAnnotationId, setDrawingMode],
  );

  if (!isMapOpen) return null;

  const surfaceOpacity   = mapTransition === "open" ? 1 : 0.0;
  const surfaceTransition =
    mapTransition === "open" ? "opacity 380ms ease-out 80ms" : "opacity 220ms ease-in";

  if (!MAPS_KEY) {
    return (
      <div
        className="pointer-events-auto fixed inset-0 z-30 bg-gray-100 p-6"
        style={{ opacity: surfaceOpacity, transition: surfaceTransition }}
      >
        <div className="text-sm text-gray-600 font-mono mt-2">
          Awaiting maps key. Add VITE_GOOGLE_MAPS_API_KEY in Vercel env to bring this surface online.
        </div>
        <button
          type="button"
          onClick={() => { sfx.select(); riseFromMap(); }}
          className="mt-4 text-blue-600 hover:text-blue-800 font-mono text-xs uppercase tracking-wider border border-blue-300 px-3 py-1.5 rounded"
        >
          Back to Universe
        </button>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-30"
      style={{ opacity: surfaceOpacity, transition: surfaceTransition }}
    >
      <div className="h-full w-full overflow-hidden flex flex-col relative bg-gray-50">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm z-10">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="font-semibold text-sm text-gray-800">
              Tactical Map
            </span>
            <span className="text-xs text-gray-400 font-mono">
              {visible.length} markers
              {focusedGalaxy ? ` · ${focusedGalaxy}` : ""}
              {showRouteLayer && routeJobIds.length > 0 ? ` · route ${routeJobIds.length}` : ""}
              {selectedJobId ? ` · drawing for job` : ""}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {drawingMode !== "cursor" && (
              <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full">
                {drawingMode === "marker" ? "📍 Click to place" :
                 drawingMode === "polyline" ? "〰 Click to draw line" :
                 "⬡ Click to draw area"}
              </span>
            )}
            {!selectedJobId && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Select a job pin to enable drawing
              </span>
            )}
            <button
              type="button"
              onClick={() => { sfx.select(); riseFromMap(); }}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2 transition-colors"
              title="Back to Universe"
            >
              ×
            </button>
          </div>
        </div>

        {/* Map container */}
        <div className="flex-1 relative">
          <APIProvider apiKey={MAPS_KEY}>
            <Map
              defaultCenter={center}
              defaultZoom={10}
              gestureHandling="greedy"
              disableDefaultUI={true}
              mapTypeId="roadmap"
              styles={LIGHT_MAP_STYLES}
              clickableIcons={false}
              backgroundColor="#F8FAFC"
            >
              {/* Job pins */}
              {visible.map((j) => {
                const isHistorical = j.status === "Complete";
                const inRoute = showRouteLayer && routeJobIds.includes(j.id);
                const color = inRoute ? "#3B82F6" : isHistorical ? "#94A3B8" : GALAXY_COLORS[j.status];
                const isSelected = selectedJobId === j.id;
                const showLabel = (focusedGalaxy !== null || inRoute) && !isHistorical;
                return (
                  <NeonPin
                    key={j.id}
                    position={j.coords!}
                    color={color}
                    selected={isSelected}
                    historical={isHistorical}
                    workOrder={j.workOrder}
                    showLabel={showLabel}
                    onClick={() => { sfx.select(); selectJob(j.id); }}
                  />
                );
              })}

              {/* Saved annotation overlays for selected job */}
              {annotations.map((ann) => (
                <AnnotationOverlay
                  key={ann.id}
                  annotation={ann}
                  isActive={ann.id === activeAnnotationId}
                  onClickAnnotation={handleAnnotationClick}
                />
              ))}

              <FitToBounds bounds={bounds} selectedId={selectedJobId} center={center} />
              <MapClickHandler
                drawingMode={drawingMode}
                selectedJobId={selectedJobId}
                toolConfig={toolConfig}
                annotationsByJob={annotationsByJob}
                addAnnotation={addAnnotation}
                setActiveAnnotationId={setActiveAnnotationId}
                setPopupAnchor={setPopupAnchor}
                setDrawingMode={setDrawingMode}
                onMapClick={handleMapClick}
              />
            </Map>
          </APIProvider>

          {/* Drawing toolbar */}
          <DrawingToolbar
            config={toolConfig}
            onConfigChange={(patch) => setToolConfig((c) => ({ ...c, ...patch }))}
          />

          {/* Annotation popup */}
          {activeAnnotation && popupAnchor && (
            <AnnotationPopup
              annotation={activeAnnotation}
              anchorX={popupAnchor.x}
              anchorY={popupAnchor.y}
              onClose={() => { setActiveAnnotationId(null); setPopupAnchor(null); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AnnotationOverlay — renders saved overlays using google.maps imperatively ─

function AnnotationOverlay({
  annotation,
  isActive,
  onClickAnnotation,
}: {
  annotation: MapAnnotation;
  isActive: boolean;
  onClickAnnotation: (id: string, x: number, y: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const g = (window as unknown as { google?: { maps?: any } }).google?.maps;
    if (!map || !g) return;

    let overlay: any = null;

    if (annotation.type === "marker" && annotation.position) {
      overlay = new g.Marker({
        position: annotation.position,
        map,
        title: annotation.name,
        icon: {
          path: g.SymbolPath.CIRCLE,
          fillColor: annotation.color,
          fillOpacity: 1,
          strokeColor: isActive ? "#1D4ED8" : "#fff",
          strokeWeight: isActive ? 3 : 2,
          scale: 10,
        },
        label: annotation.markerLabel
          ? { text: annotation.markerLabel, color: "#fff", fontSize: "10px", fontWeight: "bold" }
          : undefined,
        zIndex: isActive ? 200 : 100,
        cursor: "pointer",
      });
      overlay.addListener("click", (e: any) => {
        onClickAnnotation(annotation.id, e.domEvent?.clientX ?? 400, e.domEvent?.clientY ?? 300);
      });
    } else if (annotation.type === "polyline" && annotation.path) {
      overlay = new g.Polyline({
        path: annotation.path,
        map,
        strokeColor: annotation.color,
        strokeWeight: annotation.strokeWeight,
        strokeOpacity: 0.9,
        clickable: true,
        zIndex: isActive ? 150 : 50,
      });
      overlay.addListener("click", (e: any) => {
        onClickAnnotation(annotation.id, e.domEvent?.clientX ?? 400, e.domEvent?.clientY ?? 300);
      });
    } else if (annotation.type === "polygon" && annotation.path) {
      overlay = new g.Polygon({
        paths: annotation.path,
        map,
        strokeColor: annotation.color,
        strokeWeight: annotation.strokeWeight,
        strokeOpacity: 0.9,
        fillColor: annotation.color,
        fillOpacity: annotation.fillOpacity,
        clickable: true,
        zIndex: isActive ? 150 : 50,
      });
      overlay.addListener("click", (e: any) => {
        onClickAnnotation(annotation.id, e.domEvent?.clientX ?? 400, e.domEvent?.clientY ?? 300);
      });
    }

    return () => { if (overlay) overlay.setMap(null); };
  }, [map, annotation, isActive, onClickAnnotation]);

  return null;
}

// ─── MapClickHandler — polyline/polygon drawing state machine ─────────────────

function MapClickHandler({
  drawingMode,
  selectedJobId,
  toolConfig,
  annotationsByJob: _annotationsByJob,
  addAnnotation,
  setActiveAnnotationId,
  setPopupAnchor,
  setDrawingMode,
  onMapClick,
}: {
  drawingMode: string;
  selectedJobId: string | null;
  toolConfig: { color: string; strokeWeight: number; fillOpacity: number };
  annotationsByJob: Record<string, MapAnnotation[]>;
  addAnnotation: (a: MapAnnotation) => void;
  setActiveAnnotationId: (id: string | null) => void;
  setPopupAnchor: (p: { x: number; y: number } | null) => void;
  setDrawingMode: (m: any) => void;
  onMapClick: (lat: number, lng: number, sx: number, sy: number) => void;
}) {
  const map = useMap();
  // Accumulate polyline/polygon vertices as the operator clicks
  const pathRef = useRef<{ lat: number; lng: number }[]>([]);
  // Preview overlay drawn while user is placing points
  const previewRef = useRef<any>(null);

  // Reset path when mode changes
  useEffect(() => {
    pathRef.current = [];
    if (previewRef.current) { previewRef.current.setMap(null); previewRef.current = null; }
  }, [drawingMode]);

  useEffect(() => {
    const g = (window as unknown as { google?: { maps?: any } }).google?.maps;
    if (!map || !g) return;

    // Set cursor based on drawing mode
    map.setOptions({
      draggableCursor: drawingMode === "cursor" ? "default"
        : drawingMode === "marker" ? "crosshair"
        : "crosshair",
    });

    const clickListener = map.addListener("click", (e: any) => {
      const lat = e.latLng?.lat();
      const lng = e.latLng?.lng();
      const sx = e.domEvent?.clientX ?? 400;
      const sy = e.domEvent?.clientY ?? 300;
      if (lat == null || lng == null) return;

      if (drawingMode === "marker") {
        onMapClick(lat, lng, sx, sy);
        return;
      }

      if ((drawingMode === "polyline" || drawingMode === "polygon") && selectedJobId) {
        pathRef.current = [...pathRef.current, { lat, lng }];

        // Rebuild preview overlay
        if (previewRef.current) previewRef.current.setMap(null);
        if (drawingMode === "polyline") {
          previewRef.current = new g.Polyline({
            path: pathRef.current,
            map,
            strokeColor: toolConfig.color,
            strokeWeight: toolConfig.strokeWeight,
            strokeOpacity: 0.7,
            icons: [{ icon: { path: g.SymbolPath.FORWARD_OPEN_ARROW }, offset: "100%" }],
          });
        } else {
          previewRef.current = new g.Polygon({
            paths: pathRef.current,
            map,
            strokeColor: toolConfig.color,
            strokeWeight: toolConfig.strokeWeight,
            strokeOpacity: 0.7,
            fillColor: toolConfig.color,
            fillOpacity: toolConfig.fillOpacity * 0.5,
          });
        }
      }
    });

    // Double-click = finish polyline/polygon
    const dblListener = map.addListener("dblclick", (e: any) => {
      e.stop?.();
      if (
        (drawingMode === "polyline" || drawingMode === "polygon") &&
        selectedJobId &&
        pathRef.current.length >= 2
      ) {
        if (previewRef.current) { previewRef.current.setMap(null); previewRef.current = null; }
        const sx = e.domEvent?.clientX ?? 400;
        const sy = e.domEvent?.clientY ?? 300;
        const ann: MapAnnotation = {
          id: newAnnotationId(),
          jobId: selectedJobId,
          type: drawingMode as "polyline" | "polygon",
          name: drawingMode === "polyline" ? "New Line" : "New Area",
          description: "",
          createdAt: new Date().toISOString(),
          path: [...pathRef.current],
          color: toolConfig.color,
          strokeWeight: toolConfig.strokeWeight,
          fillOpacity: toolConfig.fillOpacity,
        };
        addAnnotation(ann);
        setActiveAnnotationId(ann.id);
        setPopupAnchor({ x: sx, y: sy });
        pathRef.current = [];
        setDrawingMode("cursor");
      }
    });

    return () => {
      clickListener.remove();
      dblListener.remove();
      map.setOptions({ draggableCursor: "default" });
    };
  }, [map, drawingMode, selectedJobId, toolConfig, addAnnotation,
      setActiveAnnotationId, setPopupAnchor, setDrawingMode, onMapClick]);

  return null;
}

// ─── NeonPin — adapted for light map (darker stroke, lighter glow) ────────────

function NeonPin({
  position, color, selected, historical, workOrder, showLabel, onClick,
}: {
  position: { lat: number; lng: number };
  color: string;
  selected: boolean;
  historical: boolean;
  workOrder: string;
  showLabel: boolean;
  onClick: () => void;
}) {
  const map = useMap();
  const clickRef = useRef(onClick);
  useEffect(() => { clickRef.current = onClick; }, [onClick]);

  useEffect(() => {
    const g = (window as unknown as { google?: { maps?: any } }).google?.maps;
    if (!map || !g) return;

    const scale = selected ? 1.35 : 1.05;
    const stroke = historical ? "#94A3B8" : "#1E293B"; // dark stroke on light map
    const strokeWeight = selected ? 2.5 : 1.8;
    const fillOpacity = historical ? 0.55 : 1;

    const body = new g.Marker({
      position, map,
      icon: {
        path: pinPath(),
        fillColor: color,
        fillOpacity,
        strokeColor: stroke,
        strokeOpacity: historical ? 0.4 : 1,
        strokeWeight,
        scale,
        anchor: new g.Point(0, 0),
      },
      zIndex: selected ? 1000 : historical ? 5 : 50,
      cursor: "pointer",
    });
    const listener = body.addListener("click", () => clickRef.current());

    let hole: any = null;
    if (!historical) {
      hole = new g.Marker({
        position, map,
        clickable: false,
        icon: {
          path: innerHolePath(),
          fillColor: "#1E293B", // dark dot for contrast on any pin color
          fillOpacity: 0.85,
          strokeColor: "#fff",
          strokeOpacity: 0.4,
          strokeWeight: 0.5,
          scale,
          anchor: new g.Point(0, 0),
        },
        zIndex: (selected ? 1000 : 50) + 1,
      });
    }


    let labelMarker: any = null;
    if (showLabel) {
      labelMarker = new g.Marker({
        position, map,
        clickable: false,
        icon: {
          path: "M 0 0", fillOpacity: 0, strokeOpacity: 0, scale: 0,
          anchor: new g.Point(0, 0),
          labelOrigin: new g.Point(0, -34),
        },
        label: {
          text: workOrder,
          color: color,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: "10px",
          fontWeight: "700",
        },
        zIndex: (selected ? 1000 : 50) + 2,
      });
    }

    return () => {
      if (listener?.remove) listener.remove();
      body.setMap(null);
      if (hole) hole.setMap(null);
      if (labelMarker) labelMarker.setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, position.lat, position.lng, color, selected, historical, showLabel, workOrder]);

  return null;
}

// ─── FitToBounds ──────────────────────────────────────────────────────────────

function FitToBounds({
  bounds, selectedId, center,
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

    if (selectedId) { map.panTo(center); return; }

    if (bounds) {
      const llb = new g.LatLngBounds(
        new g.LatLng(bounds.minLat, bounds.minLng),
        new g.LatLng(bounds.maxLat, bounds.maxLng),
      );
      map.fitBounds(llb, { top: 80, right: 260, bottom: 60, left: 80 });
      const idle = map.addListener("idle", () => {
        const z = map.getZoom?.();
        if (typeof z === "number" && z < 9) map.setZoom(9);
        if (typeof z === "number" && z > 13) map.setZoom(13);
        idle.remove();
      });
    }
  }, [map, bounds?.minLat, bounds?.maxLat, bounds?.minLng, bounds?.maxLng, selectedId, center.lat, center.lng]);
  return null;
}

// ─── Light map style ─────────────────────────────────────────────────────────
// Clean professional style — full road network visible, POI off, subtle palette.
// Easy to read hand-drawn lines and annotation overlays against.

const LIGHT_MAP_STYLES = [
  // Kill POI and transit clutter
  { featureType: "poi",              stylers: [{ visibility: "off" }] },
  { featureType: "transit",          stylers: [{ visibility: "off" }] },

  // Subtle road colors
  { featureType: "road",             elementType: "geometry.fill",   stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road",             elementType: "geometry.stroke", stylers: [{ color: "#E2E8F0" }, { weight: 1 }] },
  { featureType: "road.highway",     elementType: "geometry.fill",   stylers: [{ color: "#FEF3C7" }] },
  { featureType: "road.highway",     elementType: "geometry.stroke", stylers: [{ color: "#FDE68A" }, { weight: 1 }] },
  { featureType: "road.arterial",    elementType: "geometry.fill",   stylers: [{ color: "#F8FAFC" }] },

  // Land + landscape
  { featureType: "landscape",        elementType: "geometry", stylers: [{ color: "#F1F5F9" }] },
  { featureType: "landscape.natural",elementType: "geometry", stylers: [{ color: "#E8F5E9" }] },

  // Water
  { featureType: "water",            elementType: "geometry", stylers: [{ color: "#BFDBFE" }] },
  { featureType: "water",            elementType: "labels.text.fill", stylers: [{ color: "#3B82F6" }] },

  // Parks
  { featureType: "poi.park",         elementType: "geometry", stylers: [{ color: "#D1FAE5" }] },
  { featureType: "poi.park",         elementType: "labels.text.fill", stylers: [{ color: "#059669" }] },
  { featureType: "poi.park",         elementType: "labels",   stylers: [{ visibility: "on" }] },

  // Label colors — keep legible on light background
  { featureType: "road",             elementType: "labels.text.fill",   stylers: [{ color: "#475569" }] },
  { featureType: "road.highway",     elementType: "labels.text.fill",   stylers: [{ color: "#92400E" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#1E293B" }] },
  { featureType: "administrative.province", elementType: "labels.text.fill", stylers: [{ color: "#334155" }] },
] as const;
