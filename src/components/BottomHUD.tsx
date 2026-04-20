import type { JobOrbit } from '../types/lumina';
import { NeonGlobe } from './NeonGlobe';

interface BottomHUDProps {
  jobs: JobOrbit[];
  currentView: 'galaxy' | 'earth';
  onViewToggle: () => void;
  onReset: () => void;
}

export function BottomHUD({ jobs, currentView, onViewToggle, onReset }: BottomHUDProps) {
  const getCount = (status: string) => jobs.filter(j => j.status.toLowerCase().includes(status.toLowerCase())).length;

  const metrics = [
    { label: 'Total', count: jobs.length, color: 'text-cyan-400', glow: 'shadow-cyan-500/20' },
    { label: 'Needs Fielding', count: getCount('needs fielding'), color: 'text-amber-400', glow: 'shadow-amber-500/20' },
    { label: 'RTS', count: getCount('ready to schedule'), color: 'text-green-400', glow: 'shadow-green-500/20' },
    { label: 'Scheduled', count: getCount('scheduled'), color: 'text-blue-400', glow: 'shadow-blue-500/20' },
    { label: 'Complete', count: getCount('complete'), color: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full z-[100] px-8 pb-8 pointer-events-none">
      <div className="flex items-end justify-center gap-6 pointer-events-auto">
        {/* Dyson Sphere Gauge */}
        <div 
          onClick={onReset}
          className="group cursor-pointer flex flex-col items-center"
        >
          <div className="w-20 h-20 rounded-full border border-white/10 glass-panel flex items-center justify-center hover:border-cyan-400/50 transition-all shadow-lg">
             <div className="dyson-sphere scale-[0.4] !static transition-transform group-hover:scale-[0.5]">
                <div className="dyson-star" />
                <div className="dyson-shell" />
                <div className="dyson-shell" />
                <div className="dyson-shell" />
             </div>
          </div>
          <span className="mt-2 text-[8px] tracking-widest uppercase opacity-40 font-bold group-hover:opacity-100 transition-opacity">Reset</span>
        </div>

        {/* Neon Globe Gauge */}
        <div className="flex flex-col items-center">
          <div className="scale-75 -my-4">
             <NeonGlobe isActive={currentView === 'earth'} onClick={onViewToggle} />
          </div>
        </div>

        {/* Neon Status Gauges */}
        <div className="flex gap-4 items-end pb-2">
          {metrics.map((m) => (
            <div key={m.label} className="flex flex-col items-center">
              <div className={`w-16 h-16 rounded-full border border-white/5 glass-panel flex flex-col items-center justify-center shadow-xl ${m.glow}`}>
                <span className={`text-xl font-light ${m.color}`}>{m.count}</span>
              </div>
              <span className="mt-2 text-[7px] tracking-[0.2em] uppercase opacity-40 font-bold whitespace-nowrap">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Background HUD bar fade */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent -z-10 pointer-events-none" />
    </div>
  );
}
