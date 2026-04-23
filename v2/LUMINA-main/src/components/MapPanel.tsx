import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useLumina } from '../store/LuminaContext';
import { Crosshair } from 'lucide-react';

// Seattle center
const SEATTLE_CENTER: [number, number] = [47.6062, -122.3321];

// Neon Pin Icon
const neonIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: '<div class="neon-pin"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Helper to generate stable mock coordinates if missing
const getJobCoord = (job: any): [number, number] => {
  if (job.lat && job.lng) return [job.lat, job.lng];
  
  // Deterministic mock based on jobNumber
  const str = job.jobNumber || job.rowId;
  const hash = str.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
  const latOffset = ((hash % 100) - 50) * 0.002;
  const lngOffset = ((hash % 150) - 75) * 0.002;
  
  return [SEATTLE_CENTER[0] + latOffset, SEATTLE_CENTER[1] + lngOffset];
};

// Component to handle map view updates
function MapUpdater({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

export function MapPanel() {
  const { jobs, selectedJobId, viewMode, selectJob } = useLumina();
  const isMapMode = viewMode === 'map';
  
  const selectedJob = useMemo(() => 
    jobs.find(j => j.rowId === selectedJobId) || null
  , [jobs, selectedJobId]);

  const mapCenter = selectedJob ? getJobCoord(selectedJob) : SEATTLE_CENTER;
  const mapZoom = selectedJob ? 16 : 12;

  const showOverlay = isMapMode;

  if (!isMapMode && !selectedJob) return null;

  return (
    <AnimatePresence>
      {showOverlay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-[#020205]"
        >
          {/* Tactical Overlay UI */}
          <div className="absolute top-8 left-8 z-[100] pointer-events-none">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-cyan-500/20 border border-cyan-400 rounded-sm">
                <Crosshair size={24} className="text-cyan-400 animate-pulse" />
              </div>
              <div>
                <h1 className="text-cyan-400 font-bold tracking-[0.4em] uppercase text-xl">Tactical Map Alpha</h1>
                <p className="text-[10px] text-cyan-400/60 tracking-widest uppercase">Seattle Metro Area // Active Operations</p>
              </div>
            </div>
            <div className="h-0.5 w-64 bg-gradient-to-r from-cyan-500 to-transparent opacity-40" />
          </div>

          {/* Legend / Stats */}
          <div className="absolute bottom-12 left-8 z-[100] holograph-card !w-64 !p-4 !bg-[#05050fcc]">
            <div className="holograph-label">Status Overview</div>
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex justify-between items-center text-[10px] uppercase tracking-tighter">
                <span className="text-white/60">Total Jobs</span>
                <span className="text-cyan-400 font-bold">{jobs.length}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] uppercase tracking-tighter">
                <span className="text-white/60">Metro Coverage</span>
                <span className="text-cyan-400 font-bold">100%</span>
              </div>
            </div>
          </div>

          <MapContainer 
            center={SEATTLE_CENTER} 
            zoom={12} 
            style={{ height: '100%', width: '100%', background: '#020205' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <MapUpdater center={mapCenter} zoom={mapZoom} />
            
            {jobs.map(job => {
              const pos = getJobCoord(job);
              return (
                <Marker 
                  key={job.rowId} 
                  position={pos} 
                  icon={neonIcon}
                  eventHandlers={{
                    click: () => selectJob(job.rowId, job.jobNumber)
                  }}
                >
                  <Popup className="tactical-popup">
                    <div className="bg-[#05050f] p-3 border border-cyan-500/30 rounded text-cyan-400 font-sans">
                      <div className="text-[10px] uppercase tracking-widest opacity-60 mb-1">{job.jobNumber}</div>
                      <div className="text-sm font-bold mb-2">{job.address}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] px-1.5 py-0.5 border border-cyan-500/40 rounded uppercase">{job.status}</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Scanline Effect */}
          <div className="scanline" />
        </motion.div>
      )}

      {/* Mini map mode for selected job when not in full map view */}
      {!isMapMode && selectedJob && (
        <motion.div
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -100, opacity: 0 }}
          className="fixed bottom-12 left-12 z-50 w-[450px] h-[300px] holograph-card !p-0 overflow-hidden"
        >
          <MapContainer 
            center={getJobCoord(selectedJob)} 
            zoom={16} 
            style={{ height: '100%', width: '100%', background: '#020205' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <MapUpdater center={getJobCoord(selectedJob)} zoom={16} />
            <Marker position={getJobCoord(selectedJob)} icon={neonIcon} />
          </MapContainer>
          <div className="absolute top-4 left-4 pointer-events-none">
            <div className="text-[10px] text-cyan-400 font-bold tracking-[0.2em] uppercase">Target Coordinates</div>
            <div className="h-0.5 w-16 bg-cyan-400/50 mt-1" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
