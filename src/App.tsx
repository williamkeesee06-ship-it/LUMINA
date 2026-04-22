import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Suspense, useState, useEffect, useCallback } from 'react';
import { Experience } from './components/Experience';
import { ChatInterface } from './components/ChatInterface';
import { CommandBar } from './components/CommandBar';
import { MapPanel } from './components/MapPanel';
import { EarthView } from './components/EarthView';
import { UniversalJobCard } from './components/UniversalJobCard';

import { useVoiceCommands } from './hooks/useVoiceCommands';
import { useLumina, LuminaProvider } from './store/LuminaContext';
import { useUIStore } from './store/uiStore';
import { useGoogleLogin } from '@react-oauth/google';
import { fetchConstructionJobs } from './services/smartsheet';
import { 
  fetchFilesInFolder, 
  classifyFile, 
  fetchMoonForJob, 
  fetchGmailUnreadCount, 
  fetchDriveFiles 
} from './services/google';
import type { JobOrbit } from './types/lumina';
import React from 'react';

class ErrorBoundary extends React.Component<{ fallback: (error: Error | null) => React.ReactNode, children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
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

function LuminaLayout() {
  const { 
    loading,
    error,
    viewMode,
    voiceEnabled,
  } = useLumina();

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 150);
    return () => clearTimeout(timer);
  }, []);
  
  useVoiceCommands(voiceEnabled);

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
            <ErrorBoundary fallback={(err: any) => (
              <Html center>
                <div style={{ color: 'red', background: 'black', padding: 20 }}>
                  <h2>Experience crashed</h2>
                  <p>{err?.message}</p>
                </div>
              </Html>
            )}>
              {viewMode === 'galaxy' && <Experience />}
              {viewMode === 'earth' && <EarthView />}
              {viewMode === 'map' && (
                <Html fullscreen>
                  <MapPanel />
                </Html>
              )}
            </ErrorBoundary>
          </Suspense>
        </Canvas>
      )}

      {/* Right Command Bar Sidebar */}
      <CommandBar />

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
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-500/10 border border-red-500/30 text-red-500 rounded hover:bg-red-500/20 transition-all uppercase tracking-widest text-xs">
              Force Uplink Reset
            </button>
          </div>
        </div>
      )}

      {/* Universal UI Overlays */}
      <UniversalJobCard />

      <ChatInterface />


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

export default function App() {
  // 1. DATA STATE (Owned by App)
  const [jobs, setJobs] = useState<JobOrbit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);

  // 2. UI STORE (Syncing data events to UI orchestration)
  const { 
    setOrbMode, 
    resetUI, 
    voiceEnabled, 
    selectedJobId, 
    isChatOpen 
  } = useUIStore();

  // 3. AUTH LOGIC
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      setGoogleToken(token);
      
      try {
        const count = await fetchGmailUnreadCount(token);
        setUnreadCount(count);
        
        const files = await fetchDriveFiles(token);
        setDriveFiles(files);
        
        setOrbMode('connected');
        console.log('Google Auth Success | Gmail:', count, '| Feed:', files?.length);
      } catch (err) {
        console.error('Google Enrichment Error:', err);
      }
    },
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly'
  });

  const resetUniverse = useCallback(() => {
    resetUI();
    // Add any data-level clear here if needed
  }, [resetUI]);

  // 4. SMARTSHEET LOADING
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchConstructionJobs();
        const initializedData = data.map(j => ({
          ...j,
          moons: [],
          satellites: []
        }));
        setJobs(initializedData);
        setLoading(false);
      } catch (err: any) {
        console.error('[Lumina] Smartsheet Load Failure:', err);
        setError("The primary data stream failed to initialize.");
        setLoading(false);
      }
    };
    load();
  }, []);

  // 5. PLANETARY ENRICHMENT
  useEffect(() => {
    if (!googleToken || jobs.length === 0) return;

    const enrich = async () => {
      const updatedJobs = await Promise.all(jobs.map(async (job) => {
        try {
          let moons: any[] = [];
          if (job.driveFolderId) {
            const files = await fetchFilesInFolder(googleToken, job.driveFolderId);
            moons = files.map((f: any) => ({
              id: f.id,
              kind: classifyFile(f.name),
              label: f.name,
              state: 'ok'
            }));
          }

          let satellites: any[] = [];
          const emailData = await fetchMoonForJob(googleToken, job.jobNumber);
          if (emailData) {
            satellites.push({
              id: emailData.threadId,
              kind: 'communication',
              label: 'COMM LINK',
              state: emailData.state,
              payload: { subject: emailData.subject, snippet: emailData.snippet, threadId: emailData.threadId }
            });
          }

          return { ...job, moons, satellites };
        } catch (err) {
          console.error(`Failed to enrich Job ${job.jobNumber}:`, err);
          return job;
        }
      }));
      
      setJobs(updatedJobs);
    };

    enrich();
  }, [googleToken, jobs.length === 0]); // Dependency on initial load only

  // 6. ORB SYNC (Coordinate UI state based on data & user interaction)
  useEffect(() => {
    if (loading) return;
    if (isChatOpen) {
      setOrbMode('thinking');
    } else if (voiceEnabled) {
      setOrbMode('voice');
    } else if (selectedJobId) {
      setOrbMode('navigating');
    } else {
      setOrbMode(googleToken ? 'connected' : 'idle');
    }
  }, [isChatOpen, voiceEnabled, selectedJobId, googleToken, loading, setOrbMode]);

  return (
    <LuminaProvider
      jobs={jobs}
      loading={loading}
      error={error}
      googleToken={googleToken}
      unreadCount={unreadCount}
      driveFiles={driveFiles}
      login={login}
      resetUniverse={resetUniverse}
    >
      <LuminaLayout />
    </LuminaProvider>
  );
}
