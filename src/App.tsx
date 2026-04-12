import { Canvas } from '@react-three/fiber';
import { Suspense, useState, useEffect, useRef } from 'react';
import { Experience } from './components/Experience';
import { ChatInterface } from './components/ChatInterface';
import { CommandBar } from './components/CommandBar';
import { MapPanel } from './components/MapPanel';
import { EarthView } from './components/EarthView';
import { fetchConstructionJobs } from './services/smartsheet';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import type { ConstructionJob } from './types/lumina';

export default function App() {
  const [jobs, setJobs] = useState<ConstructionJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<ConstructionJob | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [viewMode, setViewMode] = useState<'galaxy' | 'earth'>('galaxy');
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setGoogleToken(tokenResponse.access_token);
      console.log('Google Auth Success');
    },
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly'
  });

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchConstructionJobs();
        if (data.length === 0) {
          console.warn('[Lumina] No jobs found for Billy Keesee');
        }
        setJobs(data);
      } catch (err: any) {
        console.error('[Lumina] Initial Load Failure:', err);
        setError("The primary data stream failed to initialize. Please check your Smartsheet connection.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (audioEnabled) {
        audioRef.current.play().catch(() => setAudioEnabled(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [audioEnabled]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#020205' }}>
      <Canvas
        shadows
        camera={{ position: [0, 20, 40], fov: 45 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#020205']} />
        <Suspense fallback={null}>
          {viewMode === 'galaxy' ? (
            <Experience 
              jobs={jobs} 
              onSelectJob={(job) => setSelectedJob(job)} 
              selectedJob={selectedJob}
              onOpenAI={() => setIsChatOpen(true)}
              onGoogleLogin={login}
              isGoogleConnected={!!googleToken}
            />
          ) : (
            <EarthView 
              jobs={jobs} 
              onSelectJob={(job) => setSelectedJob(job)} 
            />
          )}
        </Suspense>
      </Canvas>

      {/* Right Command Bar Sidebar */}
      <CommandBar 
        jobs={jobs} 
        viewMode={viewMode} 
        onViewToggle={() => setViewMode(viewMode === 'galaxy' ? 'earth' : 'galaxy')} 
        onReset={() => {
          setSelectedJob(null);
          window.dispatchEvent(new CustomEvent('lumina-reset-camera'));
        }}
        onStatusClick={(status) => {
          window.dispatchEvent(new CustomEvent('lumina-zoom-to-status', { detail: { status } }));
        }}
        gmailUnreadCount={0} 
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-[#020205]">
          <div className="text-center">
            <div className="w-48 h-1 loading-gradient mb-4" />
            <div className="text-cyan-400 tracking-[0.3em] font-light uppercase text-xs">Lumina Initializing</div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-[100] bg-black/80 backdrop-blur-sm">
          <div className="max-w-md p-8 border border-red-500/50 bg-red-500/5 rounded-2xl text-center">
            <h2 className="text-red-400 font-bold mb-2 uppercase tracking-widest text-sm">System Interruption</h2>
            <p className="text-white/80 text-xs mb-6 leading-relaxed">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-100 rounded border border-red-500/50 transition-colors text-[10px] uppercase font-bold tracking-[0.2em]"
            >
              Restart Stream
            </button>
          </div>
        </div>
      )}

      {/* Holographic Card Overlay */}
      <AnimatePresence>
        {selectedJob && (
          <>
            {/* Backdrop to close on click outside */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedJob(null)}
              className="holograph-backdrop"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 20, y: "-50%" }}
              animate={{ opacity: 1, scale: 1, x: 0, y: "-50%" }}
              exit={{ opacity: 0, scale: 0.9, x: 20, y: "-50%" }}
              className="holograph-card-overlay"
            >
              <div className="holograph-card">
                <button 
                  onClick={() => setSelectedJob(null)}
                  className="absolute top-4 right-4 p-2 text-white/30 hover:text-white transition-colors z-[60] bg-white/5 rounded-full hover:bg-white/10"
                >
                  <X size={16} />
                </button>
                
                <div className="mb-6">
                  <div className="holograph-label">Job Selection</div>
                  <div className="holograph-value text-2xl font-bold tracking-tight text-white">{selectedJob.jobNumber}</div>
                </div>

                <div className="holograph-content">
                  <div className="holograph-label">Location Data</div>
                  <div className="holograph-value text-sm">{selectedJob.address}</div>
                  <div className="holograph-value text-sm opacity-60">{selectedJob.city}</div>

                  <div className="holograph-label mt-4">Operational Status</div>
                  <div className="holograph-value">
                    <span className="px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-xs text-cyan-400 uppercase tracking-widest font-semibold">
                      {selectedJob.status}
                    </span>
                  </div>

                  <div className="holograph-label mt-4">NSC Project Notes</div>
                  <div className="holograph-value text-sm opacity-80 leading-relaxed font-light italic">
                    {selectedJob.notes || 'No terminal notes found in current data stream.'}
                  </div>

                  {/* Dummy data for scroll testing if notes are short */}
                  {selectedJob.notes && selectedJob.notes.length < 100 && (
                    <div className="mt-8 opacity-20 text-[10px] uppercase tracking-widest border-t border-white/5 pt-4">
                      End of Transmission | Secure Link Stable
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <MapPanel job={selectedJob} />

      {isChatOpen && (
        <ChatInterface 
          onClose={() => setIsChatOpen(false)} 
          jobs={jobs}
          onFlyTo={(job) => {
            setSelectedJob(job);
            setIsChatOpen(false);
          }}
        />
      )}

      <div className="fixed top-8 left-8 z-[110] pointer-events-none">
        <h1 className="text-2xl font-bold tracking-[0.5em] text-white opacity-20 uppercase">LUMINA</h1>
        <p className="text-[10px] tracking-[0.2em] text-cyan-500 uppercase">Cosmic Dashboard | Construction Ops</p>
      </div>
    </div>
  );
}
