// src/components/CommandBar.tsx
import React, { useState } from 'react';
import { useLumina } from '../store/LuminaContext';
import { Mic, MicOff, Map, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { STATUS_COLORS } from '../lib/lumina';

const STATUS_CONFIG = [
  { key: 'Complete', label: 'Complete' },
  { key: 'Fielded-RTS', label: 'RTS' },
  { key: 'Needs Fielding', label: 'Fielding' },
  { key: 'On Hold', label: 'On Hold' },
  { key: 'Pending', label: 'Pending' },
  { key: 'Routed to Sub', label: 'Routed to Sub' },
  { key: 'Scheduled', label: 'Scheduled' },
] as const;

function DysonSphereReset({ small = false }: { small?: boolean }) {
  const { resetUniverse } = useLumina();
  
  return (
    <div 
      className={`relative cursor-pointer group flex flex-col items-center transition-all duration-500 ${small ? 'scale-75 -my-2' : 'scale-100'}`}
      onClick={(e) => {
        e.stopPropagation();
        resetUniverse();
      }}
    >
      <div className="dyson-sphere">
        <div className="dyson-star bg-white shadow-[0_0_20px_#fff,0_0_40px_var(--neon-gold)]" />
        <div className="dyson-shell border-cyan-400/30" />
        <div className="dyson-shell border-amber-400/20" />
        <div className="dyson-shell border-dotted border-white/10" />
      </div>
      {!small && (
        <span className="mt-4 text-[9px] tracking-[0.5em] text-white/40 uppercase font-bold group-hover:text-amber-400 group-hover:opacity-100 transition-all duration-300">
          Core Reset
        </span>
      )}
    </div>
  );
}

export function CommandBar() {
  const {
    jobs,
    voiceEnabled,
    setVoiceEnabled,
    viewMode,
    setViewMode,
    latchedStatus,
    focusGalaxy,
    resetUniverse,
    unreadCount,
  } = useLumina();

  const [isExpanded, setIsExpanded] = useState(false);

  const counts = React.useMemo(() => {
    const res = STATUS_CONFIG.reduce((acc, { key }) => {
      acc[key] = jobs.filter(j => j.status === key).length;
      return acc;
    }, {} as Record<string, number>);
    
    // DEV-ONLY SANITY CHECK: 
    // This proof-of-work log confirms Smartsheet raw data vs HUD canonicalization
    if (import.meta.env.DEV && jobs.length > 0) {
      console.table(
        STATUS_CONFIG.map(({ key }) => ({
          Status: key,
          Count: jobs.filter(j => j.status === key).length
        }))
      );
    }

    return { ...res, Gmail: unreadCount };
  }, [jobs, unreadCount]);


  const totalJobs = jobs.length;

  const handleGaugeClick = (statusKey: (typeof STATUS_CONFIG)[number]['key']) => {
    if (latchedStatus === statusKey) {
      focusGalaxy?.(null);
    } else {
      focusGalaxy?.(statusKey);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[100] flex items-center pointer-events-none">
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          /* COLLAPSED HUD SPINE */
          <motion.div
            key="collapsed"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            className="h-full w-14 glass-morphism-premium border-l border-white/10 flex flex-col items-center py-8 gap-8 shadow-[-10px_0_40px_rgba(0,0,0,0.8)] pointer-events-auto cursor-pointer group"
            onClick={() => setIsExpanded(true)}
          >
            {/* Top Cap: Mini Dyson Sphere Reset */}
            <DysonSphereReset small />

            <div className="flex-1 flex flex-col items-center gap-10">
              {/* Vertical status color ticks with desync pulses */}
              <div className="flex flex-col gap-2.5">
                {STATUS_CONFIG.map(({ key }, idx) => (
                  <div 
                    key={key}
                    className={`w-1 h-3 rounded-full transition-all duration-500 ${
                      latchedStatus === key 
                        ? 'scale-x-200 h-5 shadow-[0_0_12px_currentColor] opacity-100' 
                        : `opacity-30 pulse-sync-${(idx % 4) + 1}`
                    }`}
                    style={{ 
                      color: STATUS_COLORS[key as keyof typeof STATUS_COLORS] as string, 
                      backgroundColor: 'currentColor' 
                    }}
                  />
                ))}
              </div>

              {/* Counter mini */}
              <div className="flex flex-col items-center">
                <span className="text-xl font-light text-white tracking-tighter">{totalJobs}</span>
                <span className="text-[8px] tracking-[0.3em] text-cyan-400 font-black uppercase opacity-40">JBS</span>
              </div>

              {/* Gmail Mini - Always Visible */}
              <div className="flex flex-col items-center -mt-2">
                <span className={`text-sm font-black transition-all duration-500 ${
                  unreadCount > 0 
                    ? 'text-red-500 animate-pulse drop-shadow-[0_0_10px_rgba(239,68,68,0.6)] scale-110' 
                    : 'text-white/20'
                }`}>
                  {unreadCount}
                </span>
                <span className="text-[7px] tracking-tight text-white/30 uppercase font-bold">INTEL</span>
              </div>

              {/* Action Icons */}
              <div className="flex flex-col gap-6 mt-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); setVoiceEnabled(!voiceEnabled); }}
                  className={`transition-all duration-300 hover:scale-110 ${voiceEnabled ? 'text-cyan-400 drop-shadow-[0_0_8px_#00f2ff]' : 'text-white/20 hover:text-white/50'}`}
                >
                  {voiceEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setViewMode(viewMode === 'map' ? 'universe' : 'map'); }}
                  className={`transition-all duration-300 hover:scale-110 ${viewMode === 'map' ? 'text-cyan-400 drop-shadow-[0_0_8px_#00f2ff]' : 'text-white/20 hover:text-white/50'}`}
                >
                  <Map size={16} />
                </button>
              </div>
            </div>

            {/* Expand Handle */}
            <div className="text-white/10 group-hover:text-white/40 group-hover:translate-x-[-2px] transition-all pb-4">
              <ChevronLeft size={20} />
            </div>
          </motion.div>
        ) : (
          /* EXPANDED TACTICAL DRAWER */
          <motion.div
            key="expanded"
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="h-full w-[440px] glass-morphism-premium border-l border-white/10 flex flex-col shadow-[-40px_0_100px_rgba(0,0,0,0.9)] pointer-events-auto"
          >
            {/* Header Area */}
            <div className="p-10 border-b border-white/5 flex flex-col items-center gap-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 metallic-neon-led opacity-50" />
              
              <div className="w-full flex justify-between items-start">
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/20 hover:text-white transition-all duration-300"
                >
                  <ChevronRight size={20} />
                </button>
                
                <DysonSphereReset />

                <div className="w-10" /> {/* Spacer */}
              </div>

              <div className="text-center">
                <div className="text-7xl font-light text-white tracking-tighter mb-1 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                  {totalJobs}
                </div>
                <div className="text-[11px] tracking-[0.5em] text-cyan-400 uppercase font-black opacity-60">
                  Tactical Inventory
                </div>
              </div>
            </div>

            {/* Gauges Grid - 2 Column Premium Spacing */}
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
              <div className="grid grid-cols-2 gap-x-12 gap-y-12">
                {STATUS_CONFIG.map(({ key, label }, idx) => {
                  const value = counts[key as keyof typeof counts] ?? 0;
                  const color = STATUS_COLORS[key as keyof typeof STATUS_COLORS];
                  const isLatched = latchedStatus === key;

                  return (
                    <motion.div
                      key={key}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex flex-col items-center cursor-pointer group"
                      onClick={() => handleGaugeClick(key)}
                    >
                      <div
                        className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-700 ${
                          isLatched ? 'ring-2 ring-white/30' : `pulse-sync-${(idx % 4) + 1}`
                        }`}
                        style={{
                          '--pulse-color': `${color}22`,
                          '--pulse-glow': color,
                        } as React.CSSProperties}
                      >
                        {/* Metallic neon outer ring */}
                        <div
                          className="absolute inset-0 rounded-full border-[1.5px] transition-all duration-700"
                          style={{
                            borderColor: isLatched ? '#fff' : `${color}44`,
                            boxShadow: isLatched 
                              ? `0 0 40px ${color}, inset 0 0 20px ${color}`
                              : `0 0 20px ${color}22`,
                          }}
                        />

                        {/* Inner status core */}
                        <div 
                          className="absolute inset-[10px] rounded-full bg-[#020205] shadow-[inset_0_0_25px_rgba(0,0,0,0.9)] flex flex-col items-center justify-center overflow-hidden"
                        >
                           <div 
                            className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity"
                            style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
                          />
                          
                          <span className="text-4xl font-light text-white z-10 transition-all duration-500" style={{ textShadow: isLatched ? `0 0 15px ${color}` : `0 0 10px ${color}66` }}>
                            {value}
                          </span>
                          <span className="text-[7px] tracking-[0.3em] uppercase text-white/30 font-black z-10 mt-1">
                            {label}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Gmail Intelligence Gauge */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="flex flex-col items-center cursor-pointer group"
                >
                  <div
                    className="relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-700 pulse-sync-1"
                    style={{
                      '--pulse-color': 'rgba(239, 68, 68, 0.1)',
                      '--pulse-glow': '#ef4444',
                    } as React.CSSProperties}
                  >
                    <div
                      className="absolute inset-0 rounded-full border-[1.5px] border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                    />
                    <div className="absolute inset-[10px] rounded-full bg-[#020205] shadow-[inset_0_0_25px_rgba(0,0,0,0.9)] flex flex-col items-center justify-center overflow-hidden">
                       <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-red-500/10 to-transparent group-hover:opacity-30 transition-opacity" />
                      <span className="text-4xl font-black text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                        {unreadCount}
                      </span>
                      <span className="text-[7px] tracking-[0.3em] uppercase text-red-400/40 font-black z-10 mt-1">
                        INTEL
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Footer Area */}
            <div className="p-10 border-t border-white/5 bg-black/40 flex items-center justify-between">
              <div className="flex gap-4">
                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    voiceEnabled
                      ? 'bg-cyan-400 text-black shadow-[0_0_30px_rgba(0,242,255,0.4)]'
                      : 'bg-white/5 hover:bg-white/10 text-white/20'
                  }`}
                >
                  {voiceEnabled ? <Mic size={22} /> : <MicOff size={22} />}
                </button>
                <button
                  onClick={() => setViewMode(viewMode === 'map' ? 'universe' : 'map')}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    viewMode === 'map'
                      ? 'bg-cyan-400 text-black shadow-[0_0_30px_rgba(0,242,255,0.4)]'
                      : 'bg-white/5 hover:bg-white/10 text-white/20'
                  }`}
                >
                  <Map size={22} />
                </button>
              </div>

              <button 
                onClick={() => resetUniverse()}
                className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/20 hover:text-white transition-all duration-300 uppercase text-[9px] font-black tracking-[0.3em] border border-white/5"
              >
                <RotateCcw size={14} />
                Reset Core
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
