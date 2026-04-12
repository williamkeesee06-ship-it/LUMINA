import { Globe, Mic, MicOff } from 'lucide-react';
import type { ConstructionJob } from '../types/lumina';

interface CommandBarProps {
  jobs: ConstructionJob[];
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
    needsFielding: jobs.filter(j => j.status?.toLowerCase().includes('fielding')).length,
    rts: jobs.filter(j => j.status?.toLowerCase().includes('rts') || j.status?.toLowerCase().includes('ready')).length,
    scheduled: jobs.filter(j => !!j.scheduleDate).length, // simplified check
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
      <div className="gauge-item" onClick={() => onStatusClick('Total')}>
        <div className="gauge-circle">
          <span className="gauge-value">{stats.total}</span>
        </div>
        <span className="gauge-label">Total Jobs</span>
      </div>

      <div className="gauge-item gauge-fielding" onClick={() => onStatusClick('Fielding')}>
        <div className="gauge-circle">
          <span className="gauge-value">{stats.needsFielding}</span>
        </div>
        <span className="gauge-label">Needs Fielding</span>
      </div>

      <div className="gauge-item gauge-rts" onClick={() => onStatusClick('RTS')}>
        <div className="gauge-circle">
          <span className="gauge-value">{stats.rts}</span>
        </div>
        <span className="gauge-label">RTS</span>
      </div>

      <div className="gauge-item gauge-scheduled" onClick={() => onStatusClick('Scheduled')}>
        <div className="gauge-circle">
          <span className="gauge-value">{stats.scheduled}</span>
        </div>
        <span className="gauge-label">Scheduled</span>
      </div>

      <div className="gauge-item gauge-gmail" onClick={() => onStatusClick('Gmail')}>
        <div className="gauge-circle">
          <span className="gauge-value">{stats.gmail}</span>
        </div>
        <span className="gauge-label">Gmail Unread</span>
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
