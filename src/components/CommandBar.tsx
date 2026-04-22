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
    // Single click: Focus galaxy and filter view
    setActiveStatus(activeStatus === statusText ? null : statusText);
    setFocusedGalaxy(statusText === 'Total' ? null : statusText as any);
  };

  const handleGaugeDoubleClick = (statusText: string) => {
    // Double click: Latch status for map isolation
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
    <div className="command-bar">
      {/* Reset Command */}
      <button className="command-icon-btn mb-4" onClick={resetUniverse} title="Reset Universe">
        <RotateCcw size={20} className="text-cyan-500/50 hover:text-cyan-500 transition-colors" />
      </button>
      


      {/* Tactical Gauges */}
      <div 
        className={getGaugeClass('Total')} 
        onClick={() => handleGaugeClick('Total')} 
        onDoubleClick={() => handleGaugeDoubleClick('Total')}
        title="Universe View"
      >
        <div className="gauge-circle"><span className="gauge-value">{stats.total}</span></div>
        <span className="gauge-label">Total</span>
      </div>

      <div 
        className={getGaugeClass('Complete')} 
        onClick={() => handleGaugeClick('Complete')} 
        onDoubleClick={() => handleGaugeDoubleClick('Complete')}
        title="Jump to Complete"
      >
        <div className="gauge-circle"><span className="gauge-value">{stats.complete}</span></div>
        <span className="gauge-label">Complete</span>
      </div>

      <div 
        className={getGaugeClass('Fielded-RTS', 'gauge-rts')} 
        onClick={() => handleGaugeClick('Fielded-RTS')} 
        onDoubleClick={() => handleGaugeDoubleClick('Fielded-RTS')}
        title="Jump to Fielded-RTS"
      >
        <div className="gauge-circle"><span className="gauge-value">{stats.fieldedRts}</span></div>
        <span className="gauge-label">RTS</span>
      </div>

      <div 
        className={getGaugeClass('Needs Fielding', 'gauge-fielding')} 
        onClick={() => handleGaugeClick('Needs Fielding')} 
        onDoubleClick={() => handleGaugeDoubleClick('Needs Fielding')}
        title="Jump to Needs Fielding"
      >
        <div className="gauge-circle"><span className="gauge-value">{stats.needsFielding}</span></div>
        <span className="gauge-label">Fielding</span>
      </div>

      <div 
        className={getGaugeClass('On Hold')} 
        onClick={() => handleGaugeClick('On Hold')} 
        onDoubleClick={() => handleGaugeDoubleClick('On Hold')}
        title="Jump to On Hold"
      >
        <div className="gauge-circle"><span className="gauge-value">{stats.onHold}</span></div>
        <span className="gauge-label">On Hold</span>
      </div>

      <div 
        className={getGaugeClass('Pending')} 
        onClick={() => handleGaugeClick('Pending')} 
        onDoubleClick={() => handleGaugeDoubleClick('Pending')}
        title="Jump to Pending"
      >
        <div className="gauge-circle"><span className="gauge-value">{stats.pending}</span></div>
        <span className="gauge-label">Pending</span>
      </div>

      <div 
        className={getGaugeClass('Routed to Sub')} 
        onClick={() => handleGaugeClick('Routed to Sub')} 
        onDoubleClick={() => handleGaugeDoubleClick('Routed to Sub')}
        title="Jump to Routed"
      >
        <div className="gauge-circle"><span className="gauge-value">{stats.routedToSub}</span></div>
        <span className="gauge-label">Routed</span>
      </div>

      <div 
        className={getGaugeClass('Scheduled', 'gauge-scheduled')} 
        onClick={() => handleGaugeClick('Scheduled')} 
        onDoubleClick={() => handleGaugeDoubleClick('Scheduled')}
        title="Jump to Scheduled"
      >
        <div className="gauge-circle"><span className="gauge-value">{stats.scheduled}</span></div>
        <span className="gauge-label">Scheduled</span>
      </div>

      <div className="gauge-item gauge-gmail" title="Unread Emails">
        <div className="gauge-circle">
          <span className="gauge-value">{stats.gmail}</span>
        </div>
        <span className="gauge-label">Gmail</span>
      </div>

      {/* Mode Controls */}
      <div className="flex flex-col gap-4 mt-auto mb-4 items-center">
        <button 
          className={`command-icon-btn ${voiceEnabled ? 'voice-active' : ''}`}
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          title={voiceEnabled ? "Disable Voice" : "Enable Voice"}
        >
          {voiceEnabled ? <Mic size={22} className="text-cyan-400" /> : <MicOff size={22} className="opacity-40" />}
        </button>

        <button 
          className={`command-icon-btn ${viewMode === 'map' ? 'text-cyan-400' : 'opacity-40'}`}
          onClick={() => setViewMode(viewMode === 'map' ? 'galaxy' : 'map')}
          title="Tactical Map"
        >
          <MapIcon size={22} />
        </button>

        <button 
          className={`command-icon-btn ${viewMode === 'earth' ? 'text-cyan-400' : 'opacity-40'}`}
          onClick={() => setViewMode(viewMode === 'earth' ? 'galaxy' : 'earth')}
          title="Earth Focus"
        >
          <Globe size={22} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
