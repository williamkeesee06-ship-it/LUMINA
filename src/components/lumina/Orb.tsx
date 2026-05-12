import { clsx } from "clsx";
import { useUI } from "@/store/uiStore";
import type { OrbMode } from "@/types";
import { sfx } from "@/lib/audio";

interface Props {
  size?: number;
  onActivate?: () => void;
  /** Fires on double-click — used by LuminaDock to open the OrbAuthPanel. */
  onDoubleActivate?: () => void;
}

/**
 * LUMINA — bright electric-blue plasma orb with a single thick rim ring
 * and curved arc segments crossing the face (like a glowing energy ball).
 * Sparkle particles inside flicker constantly. Color shifts by mode.
 *
 * Reference: bright neon sphere with curved white longitude arcs and
 * dense sparkle particles concentrated near the center.
 */

const COLOR_BY_MODE: Record<OrbMode, { rim: string; glow: string; halo: string }> = {
  // Quantum Singularity — Deep purple core, neon blue rim
  idle:       { rim: "#00F0FF", glow: "#7000FF", halo: "rgba(112,0,255,0.65)" },
  escort:     { rim: "#3CFFD2", glow: "#00B8FF", halo: "rgba(60,255,210,0.65)" },
  thinking:   { rim: "#E020FF", glow: "#4A00E0", halo: "rgba(224,32,255,0.65)" },
  navigating: { rim: "#FF007F", glow: "#7000FF", halo: "rgba(255,0,127,0.65)" },
  listening:  { rim: "#FFB347", glow: "#FF3D00", halo: "rgba(255,179,71,0.65)" },
  live:       { rim: "#FF1F8A", glow: "#9D00FF", halo: "rgba(255,31,138,0.85)" },
};

// Stable particle positions — placed within an inner radius
const PARTICLES = [
  { x: 50, y: 50, r: 1.4, d: 0 },
  { x: 47, y: 48, r: 1.0, d: 0.2 },
  { x: 53, y: 51, r: 0.9, d: 0.4 },
  { x: 49, y: 53, r: 0.8, d: 0.6 },
  { x: 51, y: 47, r: 0.8, d: 0.8 },
  { x: 45, y: 50, r: 0.7, d: 1.0 },
  { x: 55, y: 49, r: 0.7, d: 1.2 },
  { x: 48, y: 45, r: 0.6, d: 1.4 },
  { x: 52, y: 55, r: 0.6, d: 1.6 },
  { x: 44, y: 52, r: 0.5, d: 1.8 },
  { x: 56, y: 51, r: 0.5, d: 2.0 },
  { x: 50, y: 43, r: 0.5, d: 2.2 },
  { x: 50, y: 57, r: 0.5, d: 2.4 },
  { x: 42, y: 47, r: 0.4, d: 2.6 },
  { x: 58, y: 53, r: 0.4, d: 2.8 },
  { x: 46, y: 56, r: 0.4, d: 3.0 },
  { x: 54, y: 44, r: 0.4, d: 3.2 },
  { x: 41, y: 51, r: 0.35, d: 3.4 },
  { x: 59, y: 48, r: 0.35, d: 3.6 },
  { x: 50, y: 41, r: 0.35, d: 3.8 },
  { x: 50, y: 59, r: 0.35, d: 4.0 },
];

export function Orb({ size = 44, onActivate, onDoubleActivate }: Props) {
  const orbMode = useUI((s) => s.orbMode);
  const isChatOpen = useUI((s) => s.isChatOpen);
  const setChatOpen = useUI((s) => s.setChatOpen);

  const { rim, glow, halo } = COLOR_BY_MODE[orbMode];
  const frame = size + 28;

  return (
    <button
      type="button"
      aria-label="Wake LUMINA"
      title="LUMINA"
      onMouseEnter={() => sfx.hover()}
      onClick={() => {
        sfx.wake();
        if (onActivate) onActivate();
        else setChatOpen(!isChatOpen);
      }}
      onDoubleClick={(e) => {
        if (onDoubleActivate) {
          e.preventDefault();
          e.stopPropagation();
          onDoubleActivate();
        }
      }}
      className={clsx(
        "group relative flex items-center justify-center neon-focus rounded-full transition-transform duration-300",
        isChatOpen ? "scale-110" : "scale-100",
      )}
      style={{ width: frame, height: frame }}
    >
      {/* Outer breathing halo */}
      <span
        className="absolute rounded-full pointer-events-none transition-colors duration-500"
        style={{
          width: frame,
          height: frame,
          background: `radial-gradient(circle, ${halo} 0%, transparent 65%)`,
          animation: "orb-pulse 3.4s ease-in-out infinite",
        }}
      />

      <svg
        width={frame}
        height={frame}
        viewBox="0 0 100 100"
        className="absolute inset-0 overflow-visible pointer-events-none"
      >
        <defs>
          <radialGradient id="orb-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={glow} stopOpacity="0.95" />
            <stop offset="35%" stopColor={rim} stopOpacity="0.55" />
            <stop offset="70%" stopColor={rim} stopOpacity="0.18" />
            <stop offset="100%" stopColor={rim} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer Singularity Rings */}
        <circle cx={50} cy={50} r={44} fill="none" stroke={rim} strokeOpacity={0.15} strokeWidth={0.5} strokeDasharray="1 3" />
        <circle cx={50} cy={50} r={40} fill="none" stroke={glow} strokeOpacity={0.3} strokeWidth={1} strokeDasharray="4 4" style={{ transformOrigin: '50px 50px', animation: 'orb-spin-reverse 20s linear infinite' }} />

        {/* Inner glow fill — Quantum Plasma */}
        <circle cx={50} cy={50} r={36} fill="url(#orb-core)" />

        {/* THICK BRIGHT RIM RING — the defining outer boundary */}
        <circle
          cx={50}
          cy={50}
          r={36}
          fill="none"
          stroke={rim}
          strokeOpacity={0.65}
          strokeWidth={4}
          style={{ filter: `drop-shadow(0 0 12px ${rim}) drop-shadow(0 0 24px ${glow})` }}
        />
        <circle
          cx={50}
          cy={50}
          r={36}
          fill="none"
          stroke={rim}
          strokeOpacity={1}
          strokeWidth={1.5}
          style={{ filter: `drop-shadow(0 0 4px ${rim})` }}
        />
        <circle
          cx={50}
          cy={50}
          r={36}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.9}
          strokeWidth={0.5}
        />

        {/* ORBITAL RINGS & ARCS — Quantum Singularity aesthetic */}
        <g
          style={{
            transformOrigin: '50px 50px',
            animation: 'orb-spin 15s linear infinite',
            filter: `drop-shadow(0 0 2px ${glow}) drop-shadow(0 0 4px ${rim})`,
          }}
        >
          {/* Orbital Ellipses */}
          <ellipse cx="50" cy="50" rx="36" ry="10" fill="none" stroke={rim} strokeOpacity="0.8" strokeWidth="1" transform="rotate(30 50 50)" />
          <ellipse cx="50" cy="50" rx="36" ry="10" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="0.5" transform="rotate(-60 50 50)" />
          
          {/* Arc Sweeps */}
          <path
            d="M 18 38 Q 50 22 82 38"
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.8}
            strokeWidth={1.2}
            strokeLinecap="round"
          />
          <path
            d="M 18 62 Q 50 78 82 62"
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.8}
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        </g>
        
        {/* Core Geometry (Floating inner elements) */}
        <g style={{ transformOrigin: '50px 50px', animation: 'orb-spin-reverse 10s linear infinite' }}>
           <polygon points="50,25 68,60 32,60" fill="none" stroke={rim} strokeWidth="0.5" strokeOpacity="0.3" />
           <polygon points="50,75 32,40 68,40" fill="none" stroke={glow} strokeWidth="0.5" strokeOpacity="0.3" />
        </g>

        {/* FLICKERING SPARKLE PARTICLES — concentrated near center */}
        {PARTICLES.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill="#ffffff"
            style={{
              filter: `drop-shadow(0 0 1.5px ${glow}) drop-shadow(0 0 3px ${glow})`,
              animation: `sparkle-flicker ${1.4 + (i % 5) * 0.3}s ease-in-out ${p.d}s infinite`,
              transformOrigin: `${p.x}px ${p.y}px`,
              transformBox: "fill-box",
            }}
          />
        ))}
      </svg>
    </button>
  );
}
