import { clsx } from "clsx";

interface Props {
  label: string;
  value: number | string;
  max?: number;
  tone?: "cyan" | "magenta" | "amber" | "teal" | "neutral";
  pulse?: boolean;
  onClick?: () => void;
  active?: boolean;
}

const TONE_STROKE: Record<NonNullable<Props["tone"]>, string> = {
  cyan: "#5BF3FF",
  magenta: "#FF3D9A",
  amber: "#FFB347",
  teal: "#3CFFD2",
  neutral: "#8AA0BD",
};

/**
 * A circular telemetry gauge. Real signal, cinematic presentation.
 * If max is provided, draws an arc filled to value/max. Otherwise the
 * outer ring is just framing — value is the headline.
 */
export function Gauge({
  label,
  value,
  max,
  tone = "cyan",
  pulse = false,
  onClick,
  active = false,
}: Props) {
  const v = typeof value === "number" ? value : 0;
  const ratio = typeof max === "number" && max > 0 ? Math.min(v / max, 1) : null;
  const stroke = TONE_STROKE[tone];

  const C = 88; // viewBox center
  const R = 70;
  const circumference = 2 * Math.PI * R;
  const arcOffset = ratio == null ? 0 : circumference * (1 - ratio);

  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx(
        "group relative flex flex-col items-center select-none",
        onClick && "cursor-pointer transition-transform active:scale-[0.97]",
      )}
    >
      <div className={clsx("relative", pulse && "animate-telemetry-flicker")}>
        <svg
          width={140}
          height={140}
          viewBox="0 0 176 176"
          className={clsx("drop-shadow-[0_0_18px_rgba(91,243,255,0.18)]")}
        >
          <defs>
            <radialGradient id={`g-${label}`}>
              <stop offset="0" stopColor={stroke} stopOpacity="0.18" />
              <stop offset="0.7" stopColor={stroke} stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Outer faint ring */}
          <circle
            cx={C}
            cy={C}
            r={R + 6}
            fill="none"
            stroke={stroke}
            strokeOpacity={0.1}
            strokeWidth={1}
          />
          {/* Frame ring */}
          <circle
            cx={C}
            cy={C}
            r={R}
            fill="none"
            stroke={stroke}
            strokeOpacity={0.22}
            strokeWidth={1.5}
          />
          {/* Active arc */}
          {ratio != null && (
            <circle
              cx={C}
              cy={C}
              r={R}
              fill="none"
              stroke={stroke}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={arcOffset}
              transform={`rotate(-90 ${C} ${C})`}
              style={{ transition: "stroke-dashoffset 0.6s ease-out", filter: `drop-shadow(0 0 6px ${stroke})` }}
            />
          )}
          {/* Tick marks */}
          {Array.from({ length: 36 }).map((_, i) => {
            const a = (i / 36) * Math.PI * 2;
            const r1 = R + 8;
            const long = i % 9 === 0;
            const r2 = r1 + (long ? 6 : 3);
            const x1 = C + Math.cos(a) * r1;
            const y1 = C + Math.sin(a) * r1;
            const x2 = C + Math.cos(a) * r2;
            const y2 = C + Math.sin(a) * r2;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeOpacity={long ? 0.5 : 0.2}
                strokeWidth={long ? 1.4 : 0.8}
              />
            );
          })}
          {/* Inner glow */}
          <circle cx={C} cy={C} r={R - 6} fill={`url(#g-${label})`} />
          {/* Active outline */}
          {active && (
            <circle
              cx={C}
              cy={C}
              r={R + 14}
              fill="none"
              stroke={stroke}
              strokeOpacity={0.6}
              strokeWidth={1.2}
              strokeDasharray="3 4"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-2xl text-white text-shadow-cyan">{value}</div>
          {max !== undefined && (
            <div className="font-mono text-[10px] text-cyan-glow/60">/ {max}</div>
          )}
        </div>
      </div>
      <div className="mt-1 tactical-label">{label}</div>
    </Tag>
  );
}
