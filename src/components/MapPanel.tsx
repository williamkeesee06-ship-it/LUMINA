import { motion, AnimatePresence } from 'framer-motion';
import type { ConstructionJob } from '../types/lumina';

interface MapPanelProps {
  job: ConstructionJob | null;
}

export function MapPanel({ job }: MapPanelProps) {
  const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const address = job ? encodeURIComponent(`${job.address}, ${job.city}`) : '';
  const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${API_KEY}&q=${address}`;

  return (
    <AnimatePresence>
      {job && (
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          className="fixed bottom-12 right-12 z-50 w-[450px] h-[300px]"
        >
          <div className="holograph-card !p-1 overflow-hidden border-[#00f2ff40] h-full shadow-[0_0_30px_rgba(0,242,255,0.15)]">
            {API_KEY && API_KEY !== 'your_google_maps_key_here' ? (
              <iframe
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                src={mapUrl}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-cyan-400 text-xs tracking-widest uppercase opacity-40">
                Maps API Key Required
              </div>
            )}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none border-2 border-[#ffffff10] rounded-lg" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
