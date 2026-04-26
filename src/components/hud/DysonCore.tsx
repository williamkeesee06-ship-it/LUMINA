import { useUI } from "@/store/uiStore";
import { sfx } from "@/lib/audio";

/**
 * The Dyson core. Iconic, central, mechanically satisfying.
 * Click returns to the universe state, clearing all focus.
 */
export function DysonCore({ size = 56 }: { size?: number }) {
  const resetToUniverse = useUI((s) => s.resetToUniverse);
  const viewMode = useUI((s) => s.viewMode);
  const isHome = viewMode === "universe";

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
      className="group relative flex items-center justify-center neon-focus"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 64 64" className="overflow-visible">
        {/* Outer rotating ring */}
        <g className="origin-center animate-ring-rotate">
          <circle
            cx={32}
            cy={32}
            r={28}
            fill="none"
            stroke="#5BF3FF"
            strokeOpacity={0.55}
            strokeWidth={1.2}
            strokeDasharray="4 6"
          />
        </g>
        {/* Static frame */}
        <circle cx={32} cy={32} r={22} fill="none" stroke="#5BF3FF" strokeOpacity={0.85} strokeWidth={1.4} />
        <circle cx={32} cy={32} r={16} fill="none" stroke="#5BF3FF" strokeOpacity={0.35} strokeWidth={1} />
        {/* Spokes */}
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <line
            key={deg}
            x1={32}
            y1={10}
            x2={32}
            y2={16}
            stroke="#5BF3FF"
            strokeOpacity={0.55}
            strokeWidth={1.2}
            transform={`rotate(${deg} 32 32)`}
          />
        ))}
        {/* Core */}
        <circle
          cx={32}
          cy={32}
          r={isHome ? 4.5 : 7}
          fill="#5BF3FF"
          className="transition-all duration-500"
          style={{ filter: "drop-shadow(0 0 10px #5BF3FF)" }}
        />
        {!isHome && (
          <circle
            cx={32}
            cy={32}
            r={9}
            fill="none"
            stroke="#5BF3FF"
            strokeOpacity={0.4}
            strokeWidth={0.8}
            className="origin-center animate-orb-pulse"
          />
        )}
      </svg>
    </button>
  );
}
