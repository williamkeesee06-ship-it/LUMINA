import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Suspense, useState, useEffect } from 'react';
import { Experience } from './components/Experience';
import { ChatInterface } from './components/ChatInterface';
import { CommandBar } from './components/CommandBar';
import { MapPanel } from './components/MapPanel';
import { EarthView } from './components/EarthView';
import { fetchConstructionJobs } from './services/smartsheet';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { useVoiceCommands } from './hooks/useVoiceCommands';
import { fetchGmailUnreadCount, fetchDriveFiles, fetchFilesInFolder, classifyFile, fetchMoonForJob } from './services/google';
import { resolveGalaxy } from './types/lumina';
import type { JobOrbit } from './types/lumina';
import React from 'react';

class ErrorBoundary extends React.Component<{ fallback: React.ReactNode, children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}

export default function App() {
  const [jobs, setJobs] = useState<JobOrbit[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobOrbit | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'galaxy' | 'earth'>('galaxy');
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isLimited, setIsLimited] = useState(false);
  const [viewLevel, setViewLevel] = useState<'universe' | 'galaxy' | 'planet'>('universe');
  const [focusedGalaxy, setFocusedGalaxy] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 150);
    return () => clearTimeout(timer);
  }, []);
  
  useVoiceCommands(voiceEnabled);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleToken(tokenResponse.access_token);
      const count = await fetchGmailUnreadCount(tokenResponse.access_token);
      setUnreadCount(count);
      
      // Initial drive list (as backup or general context)
      const files = await fetchDriveFiles(tokenResponse.access_token);
      setDriveFiles(files);
      
      console.log('Google Auth Success | Gmail:', count, '| Feed:', files?.length);
    },
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly'
  });

  // Enrichment Logic: Once logged in, populate satellites and moons
  useEffect(() => {
    if (!googleToken || jobs.length === 0) return;

    const enrich = async () => {
      console.log('[LuminaHub] Starting Planetary Enrichment...');
      const updatedJobs = await Promise.all(jobs.map(async (job) => {
        try {
          // 1. Fetch Satellites (Drive)
          let satellites = job.satellites;
          if (job.driveFolderId) {
            const files = await fetchFilesInFolder(googleToken, job.driveFolderId);
            satellites = files.map(f => ({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              webViewLink: f.webViewLink,
              kind: classifyFile(f.name)
            }));
          }

          // 2. Fetch Moon (Gmail)
          const moon = await fetchMoonForJob(googleToken, job.jobNumber);

          return { ...job, satellites, moon: moon || undefined };
        } catch (err) {
          console.error(`[LuminaHub] Failed to enrich Job ${job.jobNumber}:`, err);
          return job;
        }
      }));
      
      setJobs(updatedJobs);
      console.log('[LuminaHub] Orbital Data Synced | System Ready');
    };

    enrich();
  }, [googleToken, jobs.length]); // jobs.length check to prevent re-triggering on local job updates

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchConstructionJobs();
        if (data.length === 0) {
          console.warn('[Lumina] No jobs found for Billy Keesee');
        }
        setJobs(data);
        console.log('[Lumina] Initial Load Sequence Complete. Jobs:', data.length);
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
    const handleToggleView = () => {
      setViewMode(prev => prev === 'galaxy' ? 'earth' : 'galaxy');
    };
    window.addEventListener('lumina-toggle-view', handleToggleView);
    return () => window.removeEventListener('lumina-toggle-view', handleToggleView);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#020205' }}>
      <div className="noise-overlay" />
      {isMounted && (
        <Canvas
          shadows
          camera={{ position: [0, 500, 1500], fov: 45, near: 1, far: 8000 }}
          gl={{ 
            antialias: true, 
            alpha: true, 
            stencil: false, 
            powerPreference: "high-performance",
            preserveDrawingBuffer: true 
          }}
        >
          <color attach="background" args={['#020205']} />
          
          <Suspense key={viewMode} fallback={null}>
            <ErrorBoundary fallback={(error) => (
              <Html center>
                <div style={{ color: 'red', background: 'black', padding: 20 }}>
                  <h2>Experience crashed</h2>
                  <p>{error?.message}</p>
                </div>
              </Html>
            )}>
              {viewMode === 'galaxy' ? (
                <Experience 
                  jobs={jobs} 
                  onSelectJob={(job) => setSelectedJob(job)} 
                  selectedJob={selectedJob}
                  onOpenAI={() => setIsChatOpen(!isChatOpen)}
                  onGoogleLogin={login}
                  isGoogleConnected={!!googleToken}
                  voiceEnabled={voiceEnabled}
                  isThinking={isThinking}
                  isLimited={isLimited}
                  viewLevel={viewLevel}
                  setViewLevel={setViewLevel}
                  focusedGalaxy={focusedGalaxy}
                  setFocusedGalaxy={setFocusedGalaxy}
                />
              ) : (
                <EarthView 
                  jobs={jobs} 
                  onSelectJob={(job) => setSelectedJob(job)} 
                />
              )}
            </ErrorBoundary>
          </Suspense>
        </Canvas>
      )}

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
        gmailUnreadCount={unreadCount} 
        voiceEnabled={voiceEnabled}
        onVoiceToggle={() => setVoiceEnabled(!voiceEnabled)}
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
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
          <div className="holograph-card border-red border-l-4">
            <h2 className="text-xl font-bold mb-2 text-red-500 tracking-widest uppercase">System Interruption</h2>
            <p className="text-white/80 font-light mb-6 leading-relaxed">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-500/10 border border-red-500/30 text-red-500 rounded hover:bg-red-500/20 transition-all uppercase tracking-widest text-xs"
            >
              Force Uplink Reset
            </button>
          </div>
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="fixed inset-0 flex items-center justify-center z-40 p-4 pointer-events-none">
          <div className="holograph-card opacity-80 border-cyan-500">
            <h2 className="text-lg font-bold mb-2 text-cyan-400 tracking-widest uppercase">Zero Signal</h2>
            <p className="text-white/60 font-light mb-0 leading-relaxed">No active construction vectors detected for Billy Keesee.</p>
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
              key={selectedJob.rowId}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="mission-panel-sidebar"
            >
              <div className="mission-console">
                {/* Tech Corners */}
                <div className="tech-corner tech-corner-tl" />
                <div className="tech-corner tech-corner-tr" />
                <div className="tech-corner tech-corner-bl" />
                <div className="tech-corner tech-corner-br" />
                
                <button 
                  onClick={() => setSelectedJob(null)}
                  className="absolute top-4 right-4 p-2 text-cyan-400/50 hover:text-cyan-400 transition-colors z-[60]"
                >
                  <X size={18} />
                </button>
                
                <header className="mb-6 border-b border-cyan-500/20 pb-4">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-500/60 mb-1">Active Vector</div>
                  <h2 className="text-3xl font-bold tracking-tighter text-white uppercase italic">
                    {selectedJob.jobNumber}
                  </h2>
                </header>

                <div className="space-y-6">
                  <section>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">Operational Status</div>
                    <div className="inline-block px-3 py-1 bg-cyan-500/10 border border-cyan-500/40 rounded-sm">
                      <span className="text-xs font-bold text-cyan-400 uppercase tracking-[0.15em]">
                        {selectedJob.status}
                      </span>
                    </div>
                  </section>

                  <section>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">Location Coordinates</div>
                    <div className="text-sm text-white font-medium tracking-wide uppercase">
                      {selectedJob.address}
                    </div>
                    <div className="text-[11px] text-cyan-500/80 uppercase tracking-widest mt-0.5">
                      {selectedJob.city}, US-NW
                    </div>
                  </section>

                  <section className="flex flex-col">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">NSC Project Notes</div>
                    <div className="mission-notes-box neon-scrollbar">
                      <p className="text-xs text-white/70 leading-relaxed font-light italic">
                        {selectedJob.notes || "SIGNAL STABLE: No additional telemetry recorded for this vector."}
                      </p>
                      
                      <div className="mt-4 pt-4 border-t border-white/5 opacity-20 text-[9px] uppercase tracking-[0.3em]">
                        End of Log | Data Auth: Lumina-SYS
                      </div>
                    </div>
                  </section>
                </div>

                <div className="absolute bottom-4 left-6 right-6 flex justify-between items-center opacity-30">
                  <div className="text-[8px] uppercase tracking-widest">Secure Uplink 882-X</div>
                  <div className="signal-dot" />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <MapPanel job={selectedJob} />

      <ChatInterface 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(!isChatOpen)} 
        jobs={jobs}
        driveFiles={driveFiles}
        onFlyTo={(job) => {
          setFocusedGalaxy(resolveGalaxy(job.status));
          setSelectedJob(job);
          setIsChatOpen(false);
        }}
        viewLevel={viewLevel}
        focusedGalaxy={focusedGalaxy}
      />

      {/* Voice Status Indicator */}
      {voiceEnabled && (
        <div className="fixed bottom-8 left-8 z-[100] flex items-center gap-3 bg-cyan-500/10 border border-cyan-500/30 px-4 py-2 rounded-full backdrop-blur-md">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">Lumina Listening</span>
        </div>
      )}

      <div className="watermark-container">
        <div className="watermark-wordmark">North Sky</div>
        <div className="watermark-subline">project Lumina // North Metro</div>
      </div>
    </div>
  );
}
