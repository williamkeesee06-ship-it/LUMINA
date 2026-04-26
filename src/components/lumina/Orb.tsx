import { clsx } from "clsx";
import { useUI } from "@/store/uiStore";
import type { OrbMode } from "@/types";
import { sfx } from "@/lib/audio";

interface Props {
  size?: number;
  onActivate?: () => void;
}

const TONE: Record<OrbMode, { core: string; halo: string; speed: string }> = {
  idle: { core: "#5BF3FF", halo: "rgba(91,243,255,0.45)", speed: "3.4s" },
  escort: { core: "#3CFFD2", halo: "rgba(60,255,210,0.55)", speed: "2.4s" },
  thinking: { core: "#A78BFA", halo: "rgba(167,139,250,0.6)", speed: "1.4s" },
  navigating: { core: "#FF3D9A", halo: "rgba(255,61,154,0.55)", speed: "1.0s" },
  listening: { core: "#FFB347", halo: "rgba(255,179,71,0.55)", speed: "1.1s" },
  live: { core: "#FF1F8A", halo: "rgba(255,31,138,0.6)", speed: "0.8s" },
};

/**
 * LUMINA's default visual state: a small orb/pulse, dormant and aware.
 * Bible: "represented as a small orb/pulse, not a chip or portrait".
 * Click opens her active prompt state.
 */
export function Orb({ size = 44, onActivate }: Props) {
  const orbMode = useUI((s) => s.orbMode);
  const isChatOpen = useUI((s) => s.isChatOpen);
  const setChatOpen = useUI((s) => s.setChatOpen);

  const t = TONE[orbMode];

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
      className="group relative flex items-center justify-center neon-focus rounded-full"
      style={{ width: size + 28, height: size + 28 }}
    >
      {/* Outer breathing halo */}
      <span
        className="absolute rounded-full"
        style={{
          width: size + 26,
          height: size + 26,
          background: `radial-gradient(circle, ${t.halo} 0%, transparent 65%)`,
          animation: `orb-pulse ${t.speed} ease-in-out infinite`,
        }}
      />
      {/* Mid ring */}
      <span
        className="absolute rounded-full border"
        style={{
          width: size + 14,
          height: size + 14,
          borderColor: t.halo,
          opacity: 0.55,
        }}
      />
      {/* Inner ring */}
      <span
        className="absolute rounded-full border"
        style={{
          width: size + 4,
          height: size + 4,
          borderColor: t.core,
          opacity: 0.85,
        }}
      />
      {/* Core */}
      <span
        className={clsx("relative rounded-full", isChatOpen ? "scale-110" : "scale-100")}
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 35% 30%, #fff 0%, ${t.core} 38%, ${t.core}55 75%, transparent 100%)`,
          boxShadow: `0 0 24px ${t.halo}, 0 0 48px ${t.halo}`,
          transition: "transform 0.3s ease",
        }}
      />
      {/* Crosshair tick marks */}
      <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 100 100">
        {[0, 90, 180, 270].map((deg) => (
          <line
            key={deg}
            x1={50}
            y1={6}
            x2={50}
            y2={11}
            stroke={t.core}
            strokeOpacity={0.5}
            strokeWidth={1}
            transform={`rotate(${deg} 50 50)`}
          />
        ))}
      </svg>
    </button>
  );
}
