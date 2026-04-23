import { useState } from 'react';
import { Globe, Mic, MicOff, Map as MapIcon, RotateCcw } from 'lucide-react';
import type { LuminaLatchTarget } from '../types/store';
import { useLumina } from '../store/LuminaContext';

export function CommandBar() {
  const { 
    jobs, 
    viewMode, 
    setViewMode, 
    resetUniverse,
    setActiveStatus,
    setLatchedStatus,
    activeStatus,
    latchedStatus,
    unreadCount,
    voiceEnabled,
    setVoiceEnabled,
    setFocusedGalaxy,
  } = useLumina();

  const [isCollapsed, setIsCollapsed] = useState(false);

  const stats = {
    total: jobs.length,
    complete: jobs.filter(j => j.status?.toLowerCase().includes('complete')).length,
    fieldedRts: jobs.filter(j => j.status?.toLowerCase().includes('fielded') || j.status?.toLowerCase().includes('rts')).length,
    needsFielding: jobs.filter(j => j.status?.toLowerCase().includes('fielding') && !j.status?.toLowerCase().includes('fielded')).length,
    onHold: jobs.filter(j => j.status?.toLowerCase().includes('hold')).length,
    pending: jobs.filter(j => j.status?.toLowerCase().includes('pending')).length,
    routedToSub: jobs.filter(j => j.status?.toLowerCase().includes('routed')).length,
    scheduled: jobs.filter(j => j.status?.toLowerCase().includes('scheduled') || !!j.scheduleDate).length,
    gmail: unreadCount
  };

  const handleGaugeClick = (statusText: string) => {
    const isClearing = activeStatus === statusText || statusText === 'Total';
    setActiveStatus(isClearing ? null : statusText);
    setFocusedGalaxy(isClearing ? null : statusText as any);
    setViewMode(isClearing ? 'universe' : 'galaxy');
  };

  const handleGaugeDoubleClick = (statusText: string) => {
    const target = statusText as LuminaLatchTarget;
    setLatchedStatus(latchedStatus === target ? null : target);
  };

  const getGaugeClass = (statusText: string, extraClasses = "") => {
    const isActive = activeStatus === statusText;
    const isLatched = latchedStatus === statusText;
    const anyLatched = latchedStatus !== null;
    
    return `gauge-item ${extraClasses} ${isActive ? 'active-ring' : ''} ${isLatched ? 'latched-ring' : ''} ${anyLatched && !isLatched ? 'opacity-30' : ''}`;
  };

  return (
    <div className={`command-bar ${isCollapsed ? 'w-[60px]' : 'w-[100px]'} transition-all duration-300 flex flex-col items-center py-8 z-[100] fixed right-0 top-0 h-screen bg-[#0a0a14b3] backdrop-blur-2xl border-l-2 border-white/10`}>
      {/* Collapse Toggle */}
      <button 
        className="absolute -left-3 top-12 w-6 h-12 bg-cyan-500/20 border border-cyan-500/30 rounded-l flex items-center justify-center hover:bg-cyan-500/40 transition-colors z-[110]"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className={`w-1 h-4 bg-cyan-400 rounded-full transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
      </button>

      <div className="flex flex-col items-center w-full h-full pt-4">
        {/* Reset Command */}
        <button className="command-icon-btn mb-6 flex-shrink-0" onClick={resetUniverse} title="Reset Universe">
          <RotateCcw size={20} className="text-cyan-500/50 hover:text-cyan-500 transition-colors" />
        </button>
        
        {/* Tactical Gauges (Scrollable) */}
        <div className="flex flex-col items-center gap-6 pb-4 overflow-y-auto no-scrollbar flex-1 w-full min-h-0">
          <div 
            className={getGaugeClass('Total')} 
            onClick={() => handleGaugeClick('Total')} 
            onDoubleClick={() => handleGaugeDoubleClick('Total')}
            title="Universe View"
          >
            <div className={`gauge-circle ${isCollapsed ? 'scale-75' : ''} transition-transform`}>
              <span className="gauge-value">{stats.total}</span>
            </div>
            {!isCollapsed && <span className="gauge-label">Total</span>}
          </div>

          <div 
            className={getGaugeClass('Complete')} 
            onClick={() => handleGaugeClick('Complete')} 
            onDoubleClick={() => handleGaugeDoubleClick('Complete')}
            title="Jump to Complete"
          >
            <div className={`gauge-circle ${isCollapsed ? 'scale-75' : ''} transition-transform`}>
              <span className="gauge-value">{stats.complete}</span>
            </div>
            {!isCollapsed && <span className="gauge-label">Complete</span>}
          </div>

          <div 
            className={getGaugeClass('Fielded-RTS', 'gauge-rts')} 
            onClick={() => handleGaugeClick('Fielded-RTS')} 
            onDoubleClick={() => handleGaugeDoubleClick('Fielded-RTS')}
            title="Jump to Fielded-RTS"
          >
            <div className={`gauge-circle ${isCollapsed ? 'scale-75' : ''} transition-transform`}>
              <span className="gauge-value">{stats.fieldedRts}</span>
            </div>
            {!isCollapsed && <span className="gauge-label">RTS</span>}
          </div>

          <div 
            className={getGaugeClass('Needs Fielding', 'gauge-fielding')} 
            onClick={() => handleGaugeClick('Needs Fielding')} 
            onDoubleClick={() => handleGaugeDoubleClick('Needs Fielding')}
            title="Jump to Needs Fielding"
          >
            <div className={`gauge-circle ${isCollapsed ? 'scale-75' : ''} transition-transform`}>
              <span className="gauge-value">{stats.needsFielding}</span>
            </div>
            {!isCollapsed && <span className="gauge-label">Fielding</span>}
          </div>

          <div 
            className={getGaugeClass('On Hold')} 
            onClick={() => handleGaugeClick('On Hold')} 
            onDoubleClick={() => handleGaugeDoubleClick('On Hold')}
            title="Jump to On Hold"
          >
            <div className={`gauge-circle ${isCollapsed ? 'scale-75' : ''} transition-transform`}>
              <span className="gauge-value">{stats.onHold}</span>
            </div>
            {!isCollapsed && <span className="gauge-label">On Hold</span>}
          </div>

          <div 
            className={getGaugeClass('Pending')} 
            onClick={() => handleGaugeClick('Pending')} 
            onDoubleClick={() => handleGaugeDoubleClick('Pending')}
            title="Jump to Pending"
          >
            <div className={`gauge-circle ${isCollapsed ? 'scale-75' : ''} transition-transform`}>
              <span className="gauge-value">{stats.pending}</span>
            </div>
            {!isCollapsed && <span className="gauge-label">Pending</span>}
          </div>

          <div 
            className={getGaugeClass('Routed to Sub')} 
            onClick={() => handleGaugeClick('Routed to Sub')} 
            onDoubleClick={() => handleGaugeDoubleClick('Routed to Sub')}
            title="Jump to Routed"
          >
            <div className={`gauge-circle ${isCollapsed ? 'scale-75' : ''} transition-transform`}>
              <span className="gauge-value">{stats.routedToSub}</span>
            </div>
            {!isCollapsed && <span className="gauge-label">Routed</span>}
          </div>

          <div 
            className={getGaugeClass('Scheduled', 'gauge-scheduled')} 
            onClick={() => handleGaugeClick('Scheduled')} 
            onDoubleClick={() => handleGaugeDoubleClick('Scheduled')}
            title="Jump to Scheduled"
          >
            <div className={`gauge-circle ${isCollapsed ? 'scale-75' : ''} transition-transform`}>
              <span className="gauge-value">{stats.scheduled}</span>
            </div>
            {!isCollapsed && <span className="gauge-label">Scheduled</span>}
          </div>

          <div className="gauge-item gauge-gmail" title="Unread Emails">
            <div className={`gauge-circle ${isCollapsed ? 'scale-75' : ''} transition-transform`}>
              <span className="gauge-value">{stats.gmail}</span>
            </div>
            {!isCollapsed && <span className="gauge-label">Gmail</span>}
          </div>
        </div>

        {/* Mode Controls (Fixed at bottom) */}
        <div className="flex flex-col gap-6 items-center border-t border-white/10 pt-6 pb-6 w-full bg-[#0a0a14b3] flex-shrink-0">
          <button 
            className={`command-icon-btn !mt-0 ${voiceEnabled ? 'voice-active' : ''}`}
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            title={voiceEnabled ? "Disable Voice" : "Enable Voice"}
          >
            {voiceEnabled ? <Mic size={22} className="text-cyan-400" /> : <MicOff size={22} className="opacity-40" />}
          </button>

          <button 
            className={`command-icon-btn !mt-0 flex-col gap-1 !rounded-lg px-2 py-3 h-auto ${viewMode === 'map' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(0,242,255,0.3)]' : 'opacity-40 hover:opacity-100'}`}
            onClick={() => setViewMode(viewMode === 'map' ? 'galaxy' : 'map')}
            id="tactical-map-btn"
            title="Tactical Map"
          >
            <MapIcon size={20} />
            <span className="text-[8px] uppercase tracking-tighter font-bold">Map</span>
          </button>

          <button 
            className={`command-icon-btn !mt-0 ${viewMode === 'earth' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400' : 'opacity-40 hover:opacity-100'}`}
            onClick={() => setViewMode(viewMode === 'earth' ? 'galaxy' : 'earth')}
            title="Earth Focus"
          >
            <Globe size={22} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

