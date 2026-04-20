import type { JobOrbit } from '../types/lumina';
import { NeonGlobe } from './NeonGlobe';

interface DashboardProps {
  jobs: JobOrbit[];
  currentView: 'galaxy' | 'earth';
  onViewToggle: () => void;
}

export function Dashboard({ jobs, currentView, onViewToggle }: DashboardProps) {
  const onHold = jobs.filter(j => j.status.toLowerCase().includes('on hold')).length;
  const needsAttention = jobs.filter(j => 
    ['needs fielding', 'pending permit', 'routed to sub'].includes(j.status.toLowerCase())
  ).length;

  return (
    <div className="fixed top-8 left-8 z-[100] flex flex-col gap-6">
      <NeonGlobe 
        isActive={currentView === 'earth'} 
        onClick={onViewToggle} 
      />

      <div className="holograph-card !p-6 !min-w-[240px] border-t border-l border-white/10 backdrop-blur-xl bg-gradient-to-br from-white/10 to-transparent shadow-[20px_20px_50px_rgba(0,0,0,0.5)]">
        <div className="space-y-4">
          <div className="border-b border-white/5 pb-2">
            <h3 className="text-[10px] tracking-[0.3em] uppercase text-cyan-400 font-bold mb-1">Fleet Status</h3>
            <div className="flex justify-between items-baseline">
              <span className="text-2xl font-light text-white">{jobs.length}</span>
              <span className="text-[8px] tracking-widest uppercase opacity-40">Active Units</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block text-[8px] tracking-[0.2em] uppercase text-red-400 mb-1">On Hold</span>
              <span className="text-xl font-light text-red-500/80">{onHold}</span>
            </div>
            <div>
              <span className="block text-[8px] tracking-[0.2em] uppercase text-amber-400 mb-1">Attention</span>
              <span className="text-xl font-light text-amber-500/80">{needsAttention}</span>
            </div>
          </div>

          <div className="pt-2">
            <div className="w-full bg-white/5 h-[1px]" />
            <div className="flex items-center gap-2 mt-3">
              <div className={`w-1.5 h-1.5 rounded-full ${currentView === 'galaxy' ? 'bg-cyan-400 animate-pulse' : 'bg-green-400'}`} />
              <span className="text-[9px] tracking-widest uppercase opacity-60">
                {currentView === 'galaxy' ? 'Cosmic Sync Active' : 'Geospatial Lock'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
