/**
 * SystemGauge — compact circular telemetry gauge.
 *
 * Modeled on the reference dashboard image: a thin neon arc rim, a bright
 * white tick needle pointing into the arc, a dark inner face with a small
 * value readout, and an uppercase label below the disc.
 *
 * Living glow micro-interaction:
 *  - `intensity` (0..1) drives stroke width, glow blur, and fill opacity
 *  - high values pulse subtly via the .gauge-living class so the gauge
 *    feels reactive to the energy of the universe
 *
 * Fits in a 2x3 grid in the vertical HUD column.
 */
import { clsx } from "clsx";
import type { CSSProperties } from "react";

interface Props {
  label: string;
  /** Big readout inside the disc, e.g. "240MB" or "12". */
  value: string | number;
  /** 0..1 — drives the arc fill % and glow intensity. */
  intensity: number;
  /** Hex color for ring + label. */
  color: string;
  /** Show pulsing flicker when intensity is high or pulse=true. */
  pulse?: boolean;
  onClick?: () => void;
  size?: number;
  /**
   * Hide the rotating needle for headline-only counters (e.g. TOTAL, GMAIL)
   * where the number itself is the data — a needle just adds noise.
   */
  showNeedle?: boolean;
}

export function SystemGauge({
  label,
  value,
  intensity,
  color,
  pulse = false,
  onClick,
  size = 56,
  showNeedle = true,
}: Props) {
  // Clamp intensity to [0, 1].
  const i = Math.max(0, Math.min(1, intensity));

  // Auto-pulse when intensity is high (>= 0.7) — the gauge feels alive
  // without the caller having to opt in.
  const livingPulse = pulse || i >= 0.7;

  // SVG geometry — viewBox 100x100 so we can reason in percent.
  // Arc: 270° sweep starting at top-left, ending top-right (gap at top
  // for the needle anchor). Radius 42.
  const R = 42;
  const CIRC = 2 * Math.PI * R;
  // We render only 75% of the circumference (270° arc). The dash array
  // is ARC_LEN total visible, and the FILLED portion is i * ARC_LEN.
  const ARC_LEN = CIRC * 0.75;

  // Needle angle: -135° at empty, +135° at full (270° sweep).
  const needleAngle = -135 + i * 270;

  // Glow scales with intensity so a near-empty gauge is a faint ring,
  // a near-full one throws strong color halo.
  const glowSize = 4 + i * 14; // 4..18 px
  const ringGlow = `drop-shadow(0 0 ${glowSize}px ${color})`;
  const ringStroke = 1.6 + i * 1.4; // 1.6..3.0
  const arcOpacity = 0.45 + i * 0.55; // 0.45..1.0

  const Tag = onClick ? "button" : "div";

  // Value font scales with disc size and string length so a hero-sized
  // gauge (96px) gets a big readable numeral instead of the legacy 12px.
  const valueStr = String(value);
  const valueSize =
    valueStr.length > 4
      ? Math.round(size * 0.18) // long strings (e.g. "240MB") — ~17 at 96
      : valueStr.length > 2
        ? Math.round(size * 0.24) // medium (e.g. "100%") — ~23 at 96
        : Math.round(size * 0.3); // 1-2 chars (e.g. "12") — ~29 at 96

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx(
        "relative flex flex-col items-center select-none",
        onClick && "cursor-pointer transition-transform active:scale-[0.95] hover:scale-[1.06]",
        livingPulse && "gauge-living",
      )}
      style={{ width: size + 8 } as CSSProperties}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className="block overflow-visible"
          // Rotate so the gap sits at the bottom (between -135 and +135 from top).
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Background arc (dim) */}
          <circle
            cx={50}
            cy={50}
            r={R}
            fill="none"
            stroke={color}
            strokeOpacity={0.18}
            strokeWidth={ringStroke}
            strokeDasharray={`${ARC_LEN} ${CIRC}`}
            // 12.5% offset so the gap sits at the bottom (270° arc).
            strokeDashoffset={-CIRC * 0.125}
            strokeLinecap="round"
          />
          {/* Lit arc (filled portion) */}
          <circle
            cx={50}
            cy={50}
            r={R}
            fill="none"
            stroke={color}
            strokeOpacity={arcOpacity}
            strokeWidth={ringStroke + 0.2}
            strokeDasharray={`${ARC_LEN * i} ${CIRC}`}
            strokeDashoffset={-CIRC * 0.125}
            strokeLinecap="round"
            style={{ filter: ringGlow, transition: "stroke-dasharray 380ms ease-out, filter 380ms ease-out, stroke-opacity 380ms ease-out" }}
          />
          {/* Inner dark face — sits inside the arc */}
          <circle cx={50} cy={50} r={R - ringStroke - 5} fill="#04060c" />
          {/* Subtle inner rim highlight matching color */}
          <circle
            cx={50}
            cy={50}
            r={R - ringStroke - 5}
            fill="none"
            stroke={color}
            strokeOpacity={0.25}
            strokeWidth={0.6}
          />
        </svg>

        {/* Needle — overlaid as a separate rotating element so we can
            transition it smoothly without re-rendering the SVG.
            Hidden when showNeedle=false (e.g. TOTAL / GMAIL counters where
            the number is the data and the needle just adds noise). */}
        {showNeedle && (
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: `rotate(${needleAngle}deg)`,
              transition: "transform 480ms cubic-bezier(0.34, 1.2, 0.64, 1)",
            }}
          >
            {/* The needle is a vertical line from center upward to the rim */}
            <div
              className="absolute"
              style={{
                left: "50%",
                top: "50%",
                width: 1.5,
                height: size * 0.42,
                background: "#FFFFFF",
                transform: "translate(-50%, -100%)",
                transformOrigin: "bottom center",
                boxShadow: `0 0 4px #FFFFFF, 0 0 8px ${color}, 0 0 14px ${color}`,
                borderRadius: 1,
              }}
            />
            {/* Tiny pivot dot at center */}
            <div
              className="absolute"
              style={{
                left: "50%",
                top: "50%",
                width: 3,
                height: 3,
                background: "#FFFFFF",
                transform: "translate(-50%, -50%)",
                borderRadius: 999,
                boxShadow: `0 0 4px ${color}, 0 0 8px ${color}`,
              }}
            />
          </div>
        )}

        {/* Value readout — sits inside the dark face. When the needle is
            hidden, the number is the hero element so we center it; when
            the needle is visible, push the number down slightly so the
            needle reads above. */}
        <div
          className="absolute font-mono tabular-nums leading-none pointer-events-none"
          style={{
            fontSize: valueSize,
            // PR #6 follow-up: high-contrast off-white at weight 800 with a
            // dark drop-shadow so the readout lifts cleanly off the colored
            // arc behind it (was previously fighting its accent halo).
            color: "#F0F8FF",
            fontWeight: 800,
            textShadow:
              "0 0 6px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.95), 0 0 14px rgba(0,0,0,0.55)",
            transform: showNeedle ? "translateY(2px)" : "translateY(0)",
            letterSpacing: "0.01em",
          }}
        >
          {valueStr}
        </div>
      </div>

      {/* Label below disc — scales with size so hero gauges get a readable
         caption (legacy 7.5px was illegible at 96px disc). */}
      <div
        className="font-display uppercase leading-none text-center"
        style={{
          fontSize: Math.max(8, Math.round(size * 0.11)),
          letterSpacing: "0.24em",
          color,
          marginTop: 5,
          fontWeight: 700,
          textShadow: `0 0 2px ${color}, 0 0 5px ${color}88`,
        }}
      >
        {label}
      </div>
    </Tag>
  );
}
