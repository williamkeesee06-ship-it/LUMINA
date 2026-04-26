import { clsx } from "clsx";

interface Props {
  label: string;
  value: number | string;
  tone?: "cyan" | "magenta" | "amber" | "teal";
  pulse?: boolean;
  onClick?: () => void;
  /** Show secondary inner ring in cyan/magenta to match mockup. */
  size?: number;
}

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  cyan: "#5BF3FF",
  magenta: "#FF3D9A",
  amber: "#FFB347",
  teal: "#3CFFD2",
};

/**
 * Compact stacked gauge for the vertical HUD.
 *
 * Mockup spec: outer cyan ring + inner magenta ring + center label/number.
 * No needle, no caption strip, no rainbow conic — those overpowered the small
 * footprint. Just clean concentric neon rings sized for a ~64px disc so three
 * stack neatly down the left column with the widget tower on the right.
 */
export function MiniGauge({
  label,
  value,
  tone = "cyan",
  pulse = false,
  onClick,
  size = 64,
}: Props) {
  const primary = TONE[tone];
  const secondary = tone === "magenta" ? "#5BF3FF" : "#FF3D9A";

  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx(
        "relative flex items-center justify-center select-none",
        onClick && "cursor-pointer transition-transform active:scale-[0.95] hover:scale-[1.04]",
        pulse && "animate-telemetry-flicker",
      )}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 64 64" className="block overflow-visible">
        {/* Outer bright neon ring (primary) */}
        <circle
          cx={32}
          cy={32}
          r={28}
          fill="none"
          stroke={primary}
          strokeOpacity={0.35}
          strokeWidth={5}
          style={{ filter: `drop-shadow(0 0 8px ${primary})` }}
        />
        <circle
          cx={32}
          cy={32}
          r={28}
          fill="none"
          stroke={primary}
          strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 4px ${primary})` }}
        />
        <circle
          cx={32}
          cy={32}
          r={28}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.7}
          strokeWidth={0.6}
        />

        {/* Inner secondary ring (magenta when tone=cyan, cyan when tone=magenta) */}
        <circle
          cx={32}
          cy={32}
          r={22}
          fill="none"
          stroke={secondary}
          strokeOpacity={0.25}
          strokeWidth={3}
          style={{ filter: `drop-shadow(0 0 4px ${secondary})` }}
        />
        <circle
          cx={32}
          cy={32}
          r={22}
          fill="none"
          stroke={secondary}
          strokeOpacity={0.85}
          strokeWidth={1.4}
          style={{ filter: `drop-shadow(0 0 3px ${secondary})` }}
        />

        {/* Dark inner face */}
        <circle cx={32} cy={32} r={19} fill="#04060c" />
      </svg>

      {/* Center text — label on top, number below */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div
          className="font-display uppercase leading-none"
          style={{
            fontSize: 7,
            letterSpacing: "0.22em",
            color: "#ffffff",
            opacity: 0.78,
            marginBottom: 2,
            textShadow: "0 0 4px rgba(255,255,255,0.7)",
          }}
        >
          {label}
        </div>
        <div
          className="font-mono font-semibold leading-none tabular-nums"
          style={{
            fontSize: typeof value === "string" && value.length > 3 ? 11 : 14,
            color: "#ffffff",
            textShadow: "0 0 6px rgba(255,255,255,0.9), 0 0 12px rgba(255,255,255,0.5)",
          }}
        >
          {value}
        </div>
      </div>
    </Tag>
  );
}
