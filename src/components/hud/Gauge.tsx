import { clsx } from "clsx";

interface Props {
  label: string;
  value: number | string;
  max?: number;
  tone?: "cyan" | "magenta" | "amber" | "teal" | "neutral";
  pulse?: boolean;
  onClick?: () => void;
  active?: boolean;
  /** When true, the outer bezel ring is animated rainbow neon */
  rainbow?: boolean;
}

const TONE: Record<NonNullable<Props["tone"]>, { primary: string; secondary: string; accent: string }> = {
  cyan: { primary: "#5BF3FF", secondary: "#FF3D9A", accent: "#FFB347" },
  magenta: { primary: "#FF3D9A", secondary: "#5BF3FF", accent: "#FFB347" },
  amber: { primary: "#FFB347", secondary: "#FF3D9A", accent: "#5BF3FF" },
  teal: { primary: "#3CFFD2", secondary: "#FF3D9A", accent: "#FFB347" },
  neutral: { primary: "#8AA0BD", secondary: "#5BF3FF", accent: "#FFB347" },
};

/**
 * Industrial telemetry gauge — concentric multi-color arcs, dial needle,
 * tactical caption strip, deep gloss inner face. Inspired by command-deck
 * gauges with chunky bezel + multi-band readouts.
 */
export function Gauge({
  label,
  value,
  max,
  tone = "cyan",
  pulse = false,
  onClick,
  active = false,
  rainbow = false,
}: Props) {
  const v = typeof value === "number" ? value : 0;
  const ratio = typeof max === "number" && max > 0 ? Math.min(v / max, 1) : null;
  const { primary, secondary, accent } = TONE[tone];

  // Compact viewBox so we can render dense detail without scaling artifacts.
  const C = 100;
  const R_BEZEL = 92;
  const R_OUTER = 78;
  const R_MID = 64;
  const R_INNER = 48;

  // Needle angle: maps ratio to -135deg..+135deg sweep, like an instrument dial.
  const needleRatio = ratio ?? Math.min(1, v / Math.max(1, v));
  const needleAngleDeg = -135 + needleRatio * 270;

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
        {/* Rainbow neon ring (overrides plain neon when rainbow=true) */}
        {rainbow && (
          <>
            {/* Outer soft glow */}
            <span
              className="absolute rounded-full pointer-events-none rainbow-spin"
              style={{
                width: 132,
                height: 132,
                top: 0,
                left: 0,
                background:
                  "conic-gradient(from 0deg, #FF1F8A, #FFB347, #FFFB3D, #3CFFD2, #5BF3FF, #A78BFA, #FF1F8A)",
                WebkitMask:
                  "radial-gradient(circle, transparent 56px, #000 56px, #000 64px, transparent 64px)",
                mask:
                  "radial-gradient(circle, transparent 56px, #000 56px, #000 64px, transparent 64px)",
                filter: "blur(6px)",
                opacity: 0.95,
              }}
            />
            {/* Crisp neon ring */}
            <span
              className="absolute rounded-full pointer-events-none rainbow-spin-2"
              style={{
                width: 132,
                height: 132,
                top: 0,
                left: 0,
                background:
                  "conic-gradient(from 0deg, #FF1F8A, #FFB347, #FFFB3D, #3CFFD2, #5BF3FF, #A78BFA, #FF1F8A)",
                WebkitMask:
                  "radial-gradient(circle, transparent 58px, #000 58px, #000 62px, transparent 62px)",
                mask:
                  "radial-gradient(circle, transparent 58px, #000 58px, #000 62px, transparent 62px)",
              }}
            />
            {/* White inner edge for definition */}
            <span
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 132,
                height: 132,
                top: 0,
                left: 0,
                border: "1px solid rgba(255,255,255,0.85)",
                boxSizing: "border-box",
                clipPath:
                  "path('M 66 8 a 58 58 0 1 1 0 116 a 58 58 0 1 1 0 -116 z M 66 16 a 50 50 0 1 0 0 100 a 50 50 0 1 0 0 -100 z')",
              }}
            />
          </>
        )}
        <svg width={132} height={132} viewBox="0 0 200 200" className="block">
          <defs>
            {/* Inner face gradient — deep dark face */}
            <radialGradient id={`face-${label}`}>
              <stop offset="0" stopColor="#0c1220" />
              <stop offset="0.55" stopColor="#05080f" />
              <stop offset="1" stopColor="#02040a" />
            </radialGradient>
            {/* Bezel rim gradient — brushed dark metal */}
            <linearGradient id={`bezel-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2a3344" />
              <stop offset="0.5" stopColor="#0e131c" />
              <stop offset="1" stopColor="#1a2230" />
            </linearGradient>
            {/* Inner-face vignette */}
            <radialGradient id={`vignette-${label}`}>
              <stop offset="0.5" stopColor={primary} stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.6" />
            </radialGradient>
            {/* Soft accent glow on primary arc */}
            <radialGradient id={`glow-${label}`}>
              <stop offset="0.4" stopColor={primary} stopOpacity="0.18" />
              <stop offset="1" stopColor={primary} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Bezel disk */}
          <circle cx={C} cy={C} r={R_BEZEL} fill={`url(#bezel-${label})`} />
          {/* Bezel highlight & shadow rings */}
          <circle cx={C} cy={C} r={R_BEZEL - 1} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          <circle cx={C} cy={C} r={R_BEZEL - 6} fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth={1} />

          {/* SUPER-BRIGHT NEON RING — thick, layered glow (skipped when rainbow) */}
          {!rainbow && (
            <>
              <circle
                cx={C} cy={C} r={R_BEZEL - 3}
                fill="none"
                stroke={primary}
                strokeOpacity={0.35}
                strokeWidth={9}
                style={{ filter: `drop-shadow(0 0 14px ${primary}) drop-shadow(0 0 28px ${primary})` }}
              />
              <circle
                cx={C} cy={C} r={R_BEZEL - 3}
                fill="none"
                stroke={primary}
                strokeOpacity={1}
                strokeWidth={3.5}
                style={{ filter: `drop-shadow(0 0 6px ${primary})` }}
              />
              <circle
                cx={C} cy={C} r={R_BEZEL - 3}
                fill="none"
                stroke="#ffffff"
                strokeOpacity={0.85}
                strokeWidth={1.2}
              />
            </>
          )}

          {/* Inner face */}
          <circle cx={C} cy={C} r={R_OUTER} fill={`url(#face-${label})`} />
          <circle cx={C} cy={C} r={R_OUTER} fill={`url(#vignette-${label})`} />

          {/* Outer tick ring — fine */}
          {Array.from({ length: 60 }).map((_, i) => {
            const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
            const long = i % 5 === 0;
            const r1 = R_OUTER - 2;
            const r2 = r1 - (long ? 7 : 3);
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
                stroke={primary}
                strokeOpacity={long ? 0.55 : 0.22}
                strokeWidth={long ? 1.1 : 0.7}
              />
            );
          })}

          {/* Concentric arc bands — primary / secondary / accent. Each band is a
              partial sweep of 270 degrees (-135 -> +135), but each color owns
              a different segment so the gauge reads as multi-band telemetry. */}
          <ArcBand C={C} R={R_MID + 6} startDeg={-135} endDeg={-30} stroke={primary} width={3} opacity={0.95} />
          <ArcBand C={C} R={R_MID + 6} startDeg={-30} endDeg={70} stroke={secondary} width={3} opacity={0.85} />
          <ArcBand C={C} R={R_MID + 6} startDeg={70} endDeg={135} stroke={accent} width={3} opacity={0.85} />

          {/* Inner reference ring — thin */}
          <circle cx={C} cy={C} r={R_MID} fill="none" stroke={primary} strokeOpacity={0.12} strokeWidth={1} />
          <circle cx={C} cy={C} r={R_INNER} fill="none" stroke={primary} strokeOpacity={0.18} strokeWidth={1} />

          {/* Active fill arc — driven by ratio (or full sweep) */}
          {ratio != null && (
            <ArcBand
              C={C}
              R={R_OUTER - 4}
              startDeg={-135}
              endDeg={-135 + ratio * 270}
              stroke={primary}
              width={2.5}
              opacity={1}
              glow
            />
          )}

          {/* Needle — only when ratio defined, else hide for headline-only gauges */}
          {ratio != null && (
            <g transform={`rotate(${needleAngleDeg} ${C} ${C})`}>
              <line
                x1={C}
                y1={C}
                x2={C}
                y2={C - (R_MID - 2)}
                stroke={primary}
                strokeWidth={1.6}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 4px ${primary})` }}
              />
              <circle cx={C} cy={C - (R_MID - 2)} r={2.2} fill={primary} />
            </g>
          )}

          {/* Centre hub */}
          <circle cx={C} cy={C} r={4.5} fill="#0a0e16" stroke={primary} strokeOpacity={0.7} strokeWidth={1} />
          <circle cx={C} cy={C} r={1.5} fill={primary} style={{ filter: `drop-shadow(0 0 4px ${primary})` }} />

          {/* Soft inner glow */}
          <circle cx={C} cy={C} r={R_INNER} fill={`url(#glow-${label})`} />

          {/* Active outline — outer dashed ring on hover/active */}
          {active && (
            <circle
              cx={C}
              cy={C}
              r={R_BEZEL + 4}
              fill="none"
              stroke={primary}
              strokeOpacity={0.7}
              strokeWidth={1.2}
              strokeDasharray="3 4"
            />
          )}
        </svg>

        {/* Headline numeral — overlaid */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div
            className="font-mono text-[26px] font-semibold tracking-wider leading-none"
            style={{
              color: "#ffffff",
              textShadow:
                "0 0 8px rgba(255,255,255,0.95), 0 0 18px rgba(255,255,255,0.7), 0 0 30px rgba(255,255,255,0.35)",
            }}
          >
            {value}
          </div>
          {max !== undefined && (
            <div
              className="font-mono text-[9px] mt-0.5 uppercase tracking-[0.18em]"
              style={{ color: "#fff", opacity: 0.85, textShadow: "0 0 6px rgba(255,255,255,0.7)" }}
            >
              / {max}
            </div>
          )}
        </div>

        {/* Caption strip overlay (top of bezel) — tactical title */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 px-1.5 py-px bg-black/70 border border-white/15 rounded-sm pointer-events-none">
          <div
            className="font-display text-[8px] uppercase tracking-[0.32em]"
            style={{ color: "#ffffff", textShadow: "0 0 8px rgba(255,255,255,0.85), 0 0 14px rgba(255,255,255,0.5)" }}
          >
            {label}
          </div>
        </div>
      </div>
    </Tag>
  );
}

/**
 * SVG arc band — circular sweep from startDeg to endDeg.
 * 0deg = top (12 o'clock); positive = clockwise.
 */
function ArcBand({
  C,
  R,
  startDeg,
  endDeg,
  stroke,
  width,
  opacity,
  glow,
}: {
  C: number;
  R: number;
  startDeg: number;
  endDeg: number;
  stroke: string;
  width: number;
  opacity: number;
  glow?: boolean;
}) {
  const start = polarToCart(C, R, startDeg);
  const end = polarToCart(C, R, endDeg);
  const sweep = endDeg - startDeg;
  const large = Math.abs(sweep) > 180 ? 1 : 0;
  const direction = sweep >= 0 ? 1 : 0;
  const d = `M ${start.x} ${start.y} A ${R} ${R} 0 ${large} ${direction} ${end.x} ${end.y}`;
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeOpacity={opacity}
      strokeWidth={width}
      strokeLinecap="round"
      style={glow ? { filter: `drop-shadow(0 0 6px ${stroke})` } : undefined}
    />
  );
}

function polarToCart(C: number, R: number, deg: number) {
  // 0deg = 12 o'clock (top); positive = clockwise
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: C + R * Math.cos(rad), y: C + R * Math.sin(rad) };
}
