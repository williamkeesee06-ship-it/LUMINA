import { Suspense, useState, useEffect, lazy } from 'react';
import { Canvas } from '@react-three/fiber';
import { ChatInterface } from '../ChatInterface';
import { CommandBar } from '../CommandBar';
import { UniversalJobCard } from '../UniversalJobCard';
import { useUIStore } from '../../store/useUIStore';
import { ErrorBoundary, SceneErrorFallback } from '../shared/ErrorBoundary';

const Experience = lazy(() => import('../Experience').then(m => ({ default: m.Experience })));
const MapPanel = lazy(() => import('../MapPanel').then(m => ({ default: m.MapPanel })));
const EarthView = lazy(() => import('../EarthView').then(m => ({ default: m.EarthView })));

export function LuminaLayout() {
  const loading = useUIStore(s => s.loading);
  const error = useUIStore(s => s.error);
  const viewMode = useUIStore(s => s.viewMode);
  const isChatOpen = useUIStore(s => s.isChatOpen);
  const selectedJobId = useUIStore(s => s.selectedJobId);
  const googleToken = useUIStore(s => s.googleToken);
  const setOrbMode = useUIStore(s => s.setOrbMode);


  // Orb Sync (Coordinate UI state based on data & user interaction)
  useEffect(() => {
    if (loading) return;
    if (isChatOpen) {
      setOrbMode('thinking');
    } else if (selectedJobId) {
      setOrbMode('navigating');
    } else {
      setOrbMode(googleToken ? 'escort' : 'idle');
    }
  }, [isChatOpen, selectedJobId, googleToken, loading, setOrbMode]);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 150);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="relative w-screen h-screen bg-[#020205] overflow-hidden">
      <div className="noise-overlay pointer-events-none" />
      
      {isMounted && (
        <div 
          className="w-full h-full transition-opacity duration-1000"
          style={{ 
            visibility: viewMode === 'map' ? 'hidden' : 'visible',
            opacity: isMounted ? 1 : 0 
          }}
        >
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
            
            <Suspense fallback={null}>
              <ErrorBoundary fallback={SceneErrorFallback}>
                {(viewMode === 'universe' || viewMode === 'galaxy' || viewMode === 'planet') && <Experience />}
                {viewMode === 'earth' && <EarthView />}
              </ErrorBoundary>
            </Suspense>
          </Canvas>
        </div>
      )}

      {/* Map Mode Overlay */}
      {viewMode === 'map' && (
        <Suspense fallback={<div className="absolute inset-0 bg-[#020205] z-10" />}>
          <div className="absolute inset-0 z-10 animate-in fade-in duration-700">
            <MapPanel />
          </div>
        </Suspense>
      )}

      {/* HUD Layer */}
      <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-10 overflow-hidden">
        <header className="flex justify-between items-start">
          <div className="watermark-container pointer-events-auto">
            <div className="watermark-wordmark">LUMINA</div>
            <div className="watermark-subline">North Sky Tactical</div>
            <div className="flex items-center gap-2 mt-4">
              <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-cyan-400 drop-shadow-[0_0_5px_#00f2ff]'}`} />
              <span className="text-[8px] font-black tracking-[0.3em] text-cyan-400/50 uppercase">
                {loading ? 'Syncing Universe' : 'Neural Uplink Active'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6 pointer-events-auto" />
        </header>

        <main className="flex-1 pointer-events-none relative" />

        <footer className="w-full pointer-events-auto">
          <CommandBar />
        </footer>
      </div>

      {/* Overlays */}
      <UniversalJobCard />
      <ChatInterface />

      {error && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl">
          <div className="max-w-md p-8 border border-red-500/30 bg-red-500/5 text-center">
            <h2 className="text-2xl font-bold text-red-400 mb-4 tracking-tight">SYSTEM COLLAPSE</h2>
            <p className="text-red-200/70 text-sm mb-6 leading-relaxed uppercase tracking-wider">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 transition-all uppercase text-[10px] font-bold tracking-widest"
            >
              Reboot Matrix
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
