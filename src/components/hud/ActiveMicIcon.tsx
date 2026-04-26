/**
 * ActiveMicIcon — bright, glowing microphone with three sound-wave arcs.
 *
 * The reserved-for-V3-phase-two mic is shown live and luminous now (per
 * design feedback): cyan-white capsule with a magenta accent arc and
 * concentric sound waves that pulse outward subtly.
 */

interface Props {
  size?: number;
}

export function ActiveMicIcon({ size = 22 }: Props) {
  const CYAN = "#5BF3FF";
  const HOT = "#A8F8FF";
  const MAGENTA = "#FF3D9A";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="overflow-visible"
      aria-hidden
    >
      <defs>
        <linearGradient id="ami-cap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={HOT} />
          <stop offset="100%" stopColor={CYAN} />
        </linearGradient>
        <radialGradient id="ami-fill" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="60%" stopColor={CYAN} stopOpacity="0.55" />
          <stop offset="100%" stopColor={CYAN} stopOpacity="0.0" />
        </radialGradient>
      </defs>

      {/* Sound waves (left & right) — pulse outward subtly */}
      <g
        stroke={CYAN}
        strokeOpacity={0.85}
        strokeWidth={1.2}
        strokeLinecap="round"
        fill="none"
        style={{
          filter: `drop-shadow(0 0 4px ${CYAN})`,
          animation: "telemetry-flicker 2.4s ease-in-out infinite",
        }}
      >
        <path d="M 4 9.5 Q 2.6 12 4 14.5" />
        <path d="M 20 9.5 Q 21.4 12 20 14.5" />
      </g>
      <g
        stroke={CYAN}
        strokeOpacity={0.55}
        strokeWidth={1}
        strokeLinecap="round"
        fill="none"
        style={{ filter: `drop-shadow(0 0 3px ${CYAN})` }}
      >
        <path d="M 1.8 7.5 Q -0.4 12 1.8 16.5" />
        <path d="M 22.2 7.5 Q 24.4 12 22.2 16.5" />
      </g>

      {/* Mic capsule body — glowing fill */}
      <rect
        x={9}
        y={3}
        width={6}
        height={11}
        rx={3}
        fill="url(#ami-fill)"
        stroke="url(#ami-cap)"
        strokeWidth={1.6}
        style={{
          filter: `drop-shadow(0 0 4px ${CYAN}) drop-shadow(0 0 9px ${CYAN})`,
        }}
      />
      {/* Capsule inner highlight line */}
      <line
        x1={12}
        y1={5}
        x2={12}
        y2={11.5}
        stroke="#ffffff"
        strokeOpacity={0.6}
        strokeWidth={0.6}
        strokeLinecap="round"
      />
      {/* Magenta accent dot at top of capsule (recording cue) */}
      <circle
        cx={12}
        cy={5.4}
        r={0.9}
        fill={MAGENTA}
        style={{ filter: `drop-shadow(0 0 3px ${MAGENTA})` }}
      />

      {/* Stand arc */}
      <path
        d="M 5.5 11 a 6.5 6.5 0 0 0 13 0"
        fill="none"
        stroke={CYAN}
        strokeWidth={1.6}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 5px ${CYAN})` }}
      />
      {/* Stem */}
      <line
        x1={12}
        y1={17.5}
        x2={12}
        y2={20.5}
        stroke={CYAN}
        strokeWidth={1.6}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${CYAN})` }}
      />
      {/* Base */}
      <line
        x1={8.5}
        y1={20.5}
        x2={15.5}
        y2={20.5}
        stroke={CYAN}
        strokeWidth={1.6}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${CYAN})` }}
      />
    </svg>
  );
}
