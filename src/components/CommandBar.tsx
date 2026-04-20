import { Globe, Mic, MicOff } from 'lucide-react';
import type { JobOrbit } from '../types/lumina';

interface CommandBarProps {
  jobs: JobOrbit[];
  viewMode: 'galaxy' | 'earth';
  onViewToggle: () => void;
  onReset: () => void;
  onStatusClick: (status: string) => void;
  gmailUnreadCount?: number;
  voiceEnabled: boolean;
  onVoiceToggle: () => void;
}

export function CommandBar({ 
  jobs, 
  viewMode, 
  onViewToggle, 
  onReset, 
  onStatusClick, 
  gmailUnreadCount = 0,
  voiceEnabled,
  onVoiceToggle
}: CommandBarProps) {
  const stats = {
    total: jobs.length,
    complete: jobs.filter(j => j.status?.toLowerCase().includes('complete')).length,
    fieldedRts: jobs.filter(j => j.status?.toLowerCase().includes('fielded') || j.status?.toLowerCase().includes('rts')).length,
    needsFielding: jobs.filter(j => j.status?.toLowerCase().includes('fielding') && !j.status?.toLowerCase().includes('fielded')).length,
    onHold: jobs.filter(j => j.status?.toLowerCase().includes('hold')).length,
    pending: jobs.filter(j => j.status?.toLowerCase().includes('pending')).length,
    routedToSub: jobs.filter(j => j.status?.toLowerCase().includes('routed')).length,
    scheduled: jobs.filter(j => j.status?.toLowerCase().includes('scheduled') || !!j.scheduleDate).length,
    gmail: gmailUnreadCount
  };

  return (
    <div className="command-bar">
      {/* Dyson Sphere Reset at the Top */}
      <div className="dyson-button" onClick={onReset} title="Reset Cosmic View">
        <div className="dyson-sphere">
          <div className="dyson-star" />
          <div className="dyson-shell" />
          <div className="dyson-shell" />
          <div className="dyson-shell" />
        </div>
        <div className="dyson-label mt-2" style={{ textAlign: 'center', fontSize: '0.4rem' }}>Reset</div>
      </div>

      {/* Tactical Gauges */}
      <div className="gauge-item" onClick={() => onStatusClick('Total')} title="Universe View">
        <div className="gauge-circle">
          <span className="gauge-value">{stats.total}</span>
        </div>
        <span className="gauge-label">Total</span>
      </div>

      <div className="gauge-item" onClick={() => onStatusClick('Complete')} title="Jump to Complete">
        <div className="gauge-circle">
          <span className="gauge-value">{stats.complete}</span>
        </div>
        <span className="gauge-label">Complete</span>
      </div>

      <div className="gauge-item gauge-rts" onClick={() => onStatusClick('Fielded-RTS')} title="Jump to Fielded-RTS">
        <div className="gauge-circle">
          <span className="gauge-value">{stats.fieldedRts}</span>
        </div>
        <span className="gauge-label">RTS</span>
      </div>

      <div className="gauge-item gauge-fielding" onClick={() => onStatusClick('Needs Fielding')} title="Jump to Needs Fielding">
        <div className="gauge-circle">
          <span className="gauge-value">{stats.needsFielding}</span>
        </div>
        <span className="gauge-label">Fielding</span>
      </div>

      <div className="gauge-item" onClick={() => onStatusClick('On Hold')} title="Jump to On Hold">
        <div className="gauge-circle">
          <span className="gauge-value">{stats.onHold}</span>
        </div>
        <span className="gauge-label">On Hold</span>
      </div>

      <div className="gauge-item" onClick={() => onStatusClick('Pending')} title="Jump to Pending (All Subtypes)">
        <div className="gauge-circle">
          <span className="gauge-value">{stats.pending}</span>
        </div>
        <span className="gauge-label">Pending</span>
      </div>

      <div className="gauge-item" onClick={() => onStatusClick('Routed to Sub')} title="Jump to Routed">
        <div className="gauge-circle">
          <span className="gauge-value">{stats.routedToSub}</span>
        </div>
        <span className="gauge-label">Routed</span>
      </div>

      <div className="gauge-item gauge-scheduled" onClick={() => onStatusClick('Scheduled')} title="Jump to Scheduled">
        <div className="gauge-circle">
          <span className="gauge-value">{stats.scheduled}</span>
        </div>
        <span className="gauge-label">Scheduled</span>
      </div>

      <div className="gauge-item gauge-gmail" title="Unread Emails">
        <div className="gauge-circle">
          <span className="gauge-value">{stats.gmail}</span>
        </div>
        <span className="gauge-label">Gmail</span>
      </div>

      <button 
        className={`command-icon-btn ${voiceEnabled ? 'voice-active' : ''}`}
        onClick={onVoiceToggle}
        title={voiceEnabled ? "Disable Voice Control" : "Enable Voice Control"}
      >
        {voiceEnabled ? (
          <Mic size={24} className="text-cyan-400" />
        ) : (
          <MicOff size={24} className="opacity-40" />
        )}
      </button>

      <button 
        className="command-icon-btn" 
        onClick={onViewToggle}
        title={viewMode === 'galaxy' ? "Switch to Earth View" : "Switch to Galaxy View"}
        style={{ marginTop: 'auto', marginBottom: '1rem' }}
      >
        <Globe size={28} strokeWidth={1.5} className="globe-icon-neon" />
      </button>
    </div>
  );
}
