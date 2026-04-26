import { clsx } from "clsx";

interface Props {
  label: string;
  value: number | string;
  tone?: "cyan" | "magenta" | "amber" | "teal";
  pulse?: boolean;
  onClick?: () => void;
  /** Hero gauges scale up for the wide vertical HUD column. */
  size?: number;
}

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  cyan: "#5BF3FF",
  magenta: "#FF3D9A",
  amber: "#FFB347",
  teal: "#3CFFD2",
};

/**
 * Hero stacked gauge for the vertical HUD telemetry stack.
 *
 * Concentric neon rings sized to fill the HUD column. Outer primary ring
 * (tone-colored), inner secondary ring (complementary), tick-mark cardinal
 * accents to read tactical, dark inner face with crisp label + value.
 */
export function MiniGauge({
  label,
  value,
  tone = "cyan",
  pulse = false,
  onClick,
  size = 92,
}: Props) {
  const primary = TONE[tone];
  const secondary = tone === "magenta" ? "#5BF3FF" : "#FF3D9A";

  // Type sizes scale with disc — hero gauges read big and bold.
  const labelSize = Math.round(size * 0.105); // ~9.5 at 92
  const valueSize =
    typeof value === "string" && value.length > 3
      ? Math.round(size * 0.18) // ~16
      : Math.round(size * 0.24); // ~22

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx(
        "relative flex items-center justify-center select-none",
        onClick &&
          "cursor-pointer transition-transform active:scale-[0.95] hover:scale-[1.04]",
        pulse && "animate-telemetry-flicker",
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="block overflow-visible"
      >
        {/* Outer broad halo ring (primary) */}
        <circle
          cx={50}
          cy={50}
          r={45}
          fill="none"
          stroke={primary}
          strokeOpacity={0.35}
          strokeWidth={6}
          style={{ filter: `drop-shadow(0 0 9px ${primary})` }}
        />
        <circle
          cx={50}
          cy={50}
          r={45}
          fill="none"
          stroke={primary}
          strokeWidth={2.2}
          style={{ filter: `drop-shadow(0 0 4px ${primary})` }}
        />
        <circle
          cx={50}
          cy={50}
          r={45}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.7}
          strokeWidth={0.6}
        />

        {/* Cardinal tick marks — tactical detail at N/E/S/W */}
        {[0, 90, 180, 270].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 50 50)`}>
            <line
              x1={50}
              y1={2.5}
              x2={50}
              y2={7}
              stroke={primary}
              strokeWidth={1.6}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 3px ${primary})` }}
            />
          </g>
        ))}
        {/* Diagonal magenta accent dots */}
        {[45, 135, 225, 315].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 50 50)`}>
            <circle
              cx={50}
              cy={4}
              r={1.1}
              fill={secondary}
              style={{ filter: `drop-shadow(0 0 3px ${secondary})` }}
            />
          </g>
        ))}

        {/* Inner secondary ring */}
        <circle
          cx={50}
          cy={50}
          r={36}
          fill="none"
          stroke={secondary}
          strokeOpacity={0.28}
          strokeWidth={3.4}
          style={{ filter: `drop-shadow(0 0 4px ${secondary})` }}
        />
        <circle
          cx={50}
          cy={50}
          r={36}
          fill="none"
          stroke={secondary}
          strokeOpacity={0.85}
          strokeWidth={1.5}
          style={{ filter: `drop-shadow(0 0 3px ${secondary})` }}
        />

        {/* Dark inner face */}
        <circle cx={50} cy={50} r={31} fill="#04060c" />
        {/* Subtle inner rim highlight */}
        <circle
          cx={50}
          cy={50}
          r={31}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.18}
          strokeWidth={0.5}
        />
      </svg>

      {/* Center text — label on top, number below */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div
          className="font-display uppercase leading-none"
          style={{
            fontSize: labelSize,
            letterSpacing: "0.24em",
            color: primary,
            opacity: 0.95,
            marginBottom: 4,
            textShadow: `0 0 4px ${primary}, 0 0 8px rgba(255,255,255,0.4)`,
          }}
        >
          {label}
        </div>
        <div
          className="font-mono font-semibold leading-none tabular-nums"
          style={{
            fontSize: valueSize,
            color: "#ffffff",
            textShadow:
              "0 0 6px rgba(255,255,255,0.95), 0 0 12px rgba(255,255,255,0.55)",
          }}
        >
          {value}
        </div>
      </div>
    </Tag>
  );
}
