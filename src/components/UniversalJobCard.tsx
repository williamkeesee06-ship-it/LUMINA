
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useLumina } from '../store/LuminaContext';


export function UniversalJobCard() {
  const { jobs, selectedJobId, clearSelectedJob } = useLumina();
  
  // Read the active job from the centralized state
  const activeJob = jobs.find((j: any) => j.rowId === selectedJobId);

  return (
    <AnimatePresence>
      {selectedJobId && activeJob && (
        <>
          {/* Backdrop to close on click outside */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={clearSelectedJob}
            className="holograph-backdrop"
          />
          
          <motion.div
            key={activeJob.rowId}
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
                onClick={clearSelectedJob}
                className="absolute top-4 right-4 p-2 text-cyan-400/50 hover:text-cyan-400 transition-colors z-[60]"
              >
                <X size={18} />
              </button>
              
              <header className="mb-6 border-b border-cyan-500/20 pb-4">
                <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-500/60 mb-1">Active Vector</div>
                <h2 className="text-3xl font-bold tracking-tighter text-white uppercase italic">
                  {activeJob.jobNumber}
                </h2>
              </header>

              <div className="space-y-6">
                <section>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">Operational Status</div>
                  <div className="inline-block px-3 py-1 bg-cyan-500/10 border border-cyan-500/40 rounded-sm">
                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-[0.15em]">
                      {activeJob.status}
                    </span>
                  </div>
                </section>

                <section>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">Location Coordinates</div>
                  <div className="text-sm text-white font-medium tracking-wide uppercase">
                    {activeJob.address}
                  </div>
                  <div className="text-[11px] text-cyan-500/80 uppercase tracking-widest mt-0.5">
                    {activeJob.city}, US-NW
                  </div>
                </section>

                {/* Telemetry Assets (Moons & Satellites) */}
                {(activeJob.moons?.length > 0 || activeJob.satellites?.length > 0) && (
                  <section>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">Enriched Telemetry</div>
                    <div className="space-y-2">
                      {/* Satellites: Operational / Gmail */}
                      {activeJob.satellites?.map((sat: any) => (
                        <div key={sat.id} className="flex items-center gap-2 p-2 border border-white/5 rounded-sm bg-white/5">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            sat.state === 'needs_reply' ? 'bg-red-500' : 
                            (sat.state === 'waiting' ? 'bg-amber-400' : 
                            (sat.state === 'inactive' ? 'bg-slate-500' : 'bg-cyan-400'))
                          }`} />
                          <div className="flex-1">
                            <div className="text-[9px] text-white/90 font-bold uppercase tracking-wider leading-none">
                              {sat.label} <span className="text-white/20 ml-1">[{sat.state}]</span>
                            </div>
                            <div className="text-[8px] text-white/40 truncate w-[160px]">{sat.payload?.subject || sat.payload?.snippet}</div>
                          </div>
                        </div>
                      ))}

                      {/* Moons: Subordinate / Drive Files */}
                      {activeJob.moons?.map((moon: any) => {
                        const getMoonColor = (kind: string) => {
                          switch (kind) {
                            case 'permit': return 'bg-[#ffcc00]';
                            case 'prints': return 'bg-[#0088ff]';
                            case 'redlines': return 'bg-[#ff3333]';
                            case 'bidmaster': return 'bg-[#00ff88]';
                            case 'revisit': return 'bg-[#ff00ea]';
                            default: return 'bg-white/40';
                          }
                        };
                        return (
                          <div 
                            key={moon.id} 
                            className="flex items-center gap-2 p-2 border border-white/5 rounded-sm bg-white/5 hover:bg-white/10 transition-colors"
                          >
                            <div className={`w-1.5 h-1.5 rounded-full ${getMoonColor(moon.kind)}`} />
                            <div className="flex-1 text-[9px] text-white/80 uppercase tracking-wider truncate w-[160px]">{moon.label}</div>
                            <div className="text-[7px] text-white/20 uppercase tracking-widest">{moon.kind}</div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                <section className="flex flex-col">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">NSC Project Notes</div>
                  <div className="mission-notes-box neon-scrollbar max-h-[120px] overflow-y-auto">
                    <p className="text-xs text-white/70 leading-relaxed font-light italic">
                      {activeJob.notes || "SIGNAL STABLE: No additional telemetry recorded for this vector."}
                    </p>
                    
                    <div className="mt-4 pt-4 border-t border-white/5 opacity-20 text-[9px] uppercase tracking-[0.3em]">
                      End of Log | Data Auth: Lumina-SYS
                    </div>
                  </div>
                </section>
              </div>

              <div className="absolute bottom-4 left-6 right-6 flex justify-between items-center">
                <button 
                  onClick={clearSelectedJob}
                  className="text-[8px] uppercase tracking-[0.2em] text-cyan-400/40 hover:text-cyan-400 transition-colors flex items-center gap-2 group"
                >
                  <div className="w-4 h-px bg-cyan-400/20 group-hover:bg-cyan-400/50" />
                  Return to Sector
                </button>
                <div className="signal-dot" />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
