import { useUI } from "@/store/uiStore";
import { sfx } from "@/lib/audio";

/**
 * Reset-to-Universe button — neon tactical concentric rings.
 * Multi-color (cyan / magenta / teal) layered HUD-style ring with broken
 * arc segments, counter-rotating. Click returns the camera to the universe.
 */
export function DysonCore({ size = 56 }: { size?: number }) {
  const resetToUniverse = useUI((s) => s.resetToUniverse);
  const viewMode = useUI((s) => s.viewMode);
  const isHome = viewMode === "universe";

  const CYAN = "#5BF3FF";
  const MAGENTA = "#FF3D9A";
  const TEAL = "#3CFFD2";
  const VIOLET = "#A66BFF";

  return (
    <button
      type="button"
      onMouseEnter={() => sfx.hover()}
      onClick={() => {
        sfx.confirm();
        resetToUniverse();
      }}
      title="Return to Universe"
      aria-label="Return to Universe"
      className="group relative flex items-center justify-center neon-focus rounded-full"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 64 64" className="overflow-visible">
        <defs>
          <radialGradient id="reset-core-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.95} />
            <stop offset="40%" stopColor={CYAN} stopOpacity={0.55} />
            <stop offset="100%" stopColor="#000" stopOpacity={0} />
          </radialGradient>
          <linearGradient id="reset-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={CYAN} />
            <stop offset="55%" stopColor={MAGENTA} />
            <stop offset="100%" stopColor={VIOLET} />
          </linearGradient>
        </defs>

        {/* Outer broken ring — magenta, slow rotate */}
        <g className="origin-center animate-ring-rotate" style={{ transformOrigin: "32px 32px" }}>
          <circle
            cx={32}
            cy={32}
            r={29}
            fill="none"
            stroke={MAGENTA}
            strokeOpacity={0.9}
            strokeWidth={1.6}
            strokeDasharray="22 6 4 6 16 8 4 8"
            style={{ filter: `drop-shadow(0 0 6px ${MAGENTA}) drop-shadow(0 0 12px ${MAGENTA})` }}
          />
        </g>

        {/* Mid solid cyan rim — bright */}
        <circle
          cx={32}
          cy={32}
          r={25}
          fill="none"
          stroke="url(#reset-rim)"
          strokeWidth={1.4}
          style={{ filter: `drop-shadow(0 0 6px ${CYAN})` }}
        />

        {/* Inner cyan broken arc — counter-rotate */}
        <g className="origin-center animate-ring-rotate-rev" style={{ transformOrigin: "32px 32px" }}>
          <circle
            cx={32}
            cy={32}
            r={22}
            fill="none"
            stroke={CYAN}
            strokeOpacity={0.95}
            strokeWidth={1.4}
            strokeDasharray="14 4 6 4 12 6"
            style={{ filter: `drop-shadow(0 0 5px ${CYAN}) drop-shadow(0 0 10px ${CYAN})` }}
          />
        </g>

        {/* Teal thin orbit */}
        <g className="origin-center animate-ring-rotate" style={{ transformOrigin: "32px 32px" }}>
          <circle
            cx={32}
            cy={32}
            r={18}
            fill="none"
            stroke={TEAL}
            strokeOpacity={0.7}
            strokeWidth={0.9}
            strokeDasharray="3 4"
            style={{ filter: `drop-shadow(0 0 3px ${TEAL})` }}
          />
        </g>

        {/* Magenta inner accent ring (full) */}
        <circle
          cx={32}
          cy={32}
          r={14}
          fill="none"
          stroke={MAGENTA}
          strokeOpacity={0.55}
          strokeWidth={0.7}
          style={{ filter: `drop-shadow(0 0 3px ${MAGENTA})` }}
        />

        {/* Bracket "tick" segments at cardinals — give the tactical-HUD feel */}
        {[0, 90, 180, 270].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 32 32)`}>
            <line
              x1={32}
              y1={1.5}
              x2={32}
              y2={6.5}
              stroke={CYAN}
              strokeWidth={1.6}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 4px ${CYAN})` }}
            />
          </g>
        ))}
        {/* Diagonal bracket dots — magenta */}
        {[45, 135, 225, 315].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 32 32)`}>
            <circle
              cx={32}
              cy={4}
              r={1}
              fill={MAGENTA}
              style={{ filter: `drop-shadow(0 0 3px ${MAGENTA})` }}
            />
          </g>
        ))}

        {/* Center luminous core (looking-into-the-rings effect) */}
        <circle
          cx={32}
          cy={32}
          r={10}
          fill="url(#reset-core-grad)"
          className="transition-all duration-500"
          opacity={isHome ? 0.8 : 1}
        />
        {/* Inner crisp core dot */}
        <circle
          cx={32}
          cy={32}
          r={isHome ? 2.2 : 3}
          fill="#ffffff"
          style={{ filter: `drop-shadow(0 0 6px ${CYAN}) drop-shadow(0 0 12px ${CYAN})` }}
        />

        {/* Active-state pulsing outer halo when not home */}
        {!isHome && (
          <circle
            cx={32}
            cy={32}
            r={31}
            fill="none"
            stroke={CYAN}
            strokeOpacity={0.5}
            strokeWidth={0.8}
            className="origin-center animate-orb-pulse"
            style={{ transformOrigin: "32px 32px", filter: `drop-shadow(0 0 8px ${CYAN})` }}
          />
        )}
      </svg>
    </button>
  );
}
