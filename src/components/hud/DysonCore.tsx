import { useUI } from "@/store/uiStore";
import { sfx } from "@/lib/audio";

/**
 * The Dyson core reset button — luxurious gold pulsing rings.
 * Click returns to the universe state, clearing all focus.
 */
export function DysonCore({ size = 56 }: { size?: number }) {
  const resetToUniverse = useUI((s) => s.resetToUniverse);
  const viewMode = useUI((s) => s.viewMode);
  const isHome = viewMode === "universe";

  const GOLD = "#FFD56B";
  const GOLD_BRIGHT = "#FFE9A8";
  const GOLD_DEEP = "#C99518";

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
          <radialGradient id="dyson-core-grad" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor="#fff7d6" />
            <stop offset="35%" stopColor={GOLD_BRIGHT} />
            <stop offset="75%" stopColor={GOLD} />
            <stop offset="100%" stopColor={GOLD_DEEP} />
          </radialGradient>
          <linearGradient id="dyson-rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff1be" />
            <stop offset="0.5" stopColor={GOLD} />
            <stop offset="1" stopColor="#7a560a" />
          </linearGradient>
        </defs>

        {/* Outer pulsing gold halo (largest, slowest) */}
        <g className="origin-center animate-gold-pulse" style={{ transformOrigin: "32px 32px" }}>
          <circle
            cx={32}
            cy={32}
            r={30}
            fill="none"
            stroke={GOLD}
            strokeOpacity={0.7}
            strokeWidth={1.4}
            style={{ filter: `drop-shadow(0 0 10px ${GOLD}) drop-shadow(0 0 18px ${GOLD})` }}
          />
        </g>

        {/* Mid pulsing gold ring (offset phase) */}
        <g className="origin-center animate-gold-pulse-2" style={{ transformOrigin: "32px 32px" }}>
          <circle
            cx={32}
            cy={32}
            r={26}
            fill="none"
            stroke={GOLD_BRIGHT}
            strokeOpacity={0.85}
            strokeWidth={1.6}
            style={{ filter: `drop-shadow(0 0 6px ${GOLD_BRIGHT})` }}
          />
        </g>

        {/* Rotating dashed gold orbit */}
        <g className="origin-center animate-ring-rotate" style={{ transformOrigin: "32px 32px" }}>
          <circle
            cx={32}
            cy={32}
            r={23}
            fill="none"
            stroke={GOLD}
            strokeOpacity={0.9}
            strokeWidth={1.2}
            strokeDasharray="3 5"
            style={{ filter: `drop-shadow(0 0 4px ${GOLD})` }}
          />
        </g>

        {/* Counter-rotating thin orbit */}
        <g className="origin-center animate-ring-rotate-rev" style={{ transformOrigin: "32px 32px" }}>
          <circle
            cx={32}
            cy={32}
            r={19}
            fill="none"
            stroke={GOLD_BRIGHT}
            strokeOpacity={0.55}
            strokeWidth={0.9}
            strokeDasharray="1 3"
          />
        </g>

        {/* Solid gold rim */}
        <circle
          cx={32}
          cy={32}
          r={15}
          fill="none"
          stroke="url(#dyson-rim)"
          strokeWidth={1.6}
          style={{ filter: `drop-shadow(0 0 4px ${GOLD})` }}
        />

        {/* 6 gold spokes */}
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <line
            key={deg}
            x1={32}
            y1={9}
            x2={32}
            y2={15}
            stroke={GOLD_BRIGHT}
            strokeOpacity={0.85}
            strokeWidth={1.4}
            transform={`rotate(${deg} 32 32)`}
            style={{ filter: `drop-shadow(0 0 3px ${GOLD})` }}
          />
        ))}

        {/* Inner gold core sphere */}
        <circle
          cx={32}
          cy={32}
          r={isHome ? 6 : 8}
          fill="url(#dyson-core-grad)"
          className="transition-all duration-500"
          style={{ filter: `drop-shadow(0 0 12px ${GOLD}) drop-shadow(0 0 24px ${GOLD})` }}
        />
        {/* Specular highlight on core */}
        <ellipse cx={30} cy={29} rx={2.4} ry={1.6} fill="#fffbe6" opacity={0.85} />

        {!isHome && (
          <circle
            cx={32}
            cy={32}
            r={11}
            fill="none"
            stroke={GOLD_BRIGHT}
            strokeOpacity={0.6}
            strokeWidth={0.8}
            className="origin-center animate-orb-pulse"
            style={{ transformOrigin: "32px 32px" }}
          />
        )}
      </svg>
    </button>
  );
}
