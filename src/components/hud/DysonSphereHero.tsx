/**
 * DysonSphereHero — the LUMINA hero icon.
 *
 * A real Dyson sphere construction: three orthogonal lattice rings (equator
 * plus two meridians shown in 3D perspective) wrapping a brilliant white-blue
 * star core. Diamond strut ornaments sit at the lattice junctions to read as
 * megastructure rather than a wireframe globe.
 *
 * Color language: cyan #5BF3FF lattice, magenta #FF3D9A accent struts,
 * teal #3CFFD2 highlights, white-hot core with breathing halo.
 *
 * Motion: counter-rotating lattice rings, pulsing nucleus, and sparkle
 * particles emanating outward from the star core.
 */

interface Props {
  size?: number;
}

export function DysonSphereHero({ size = 120 }: Props) {
  const CYAN = "#5BF3FF";
  const MAGENTA = "#FF3D9A";
  const TEAL = "#3CFFD2";

  // Frame larger than viewBox so the halo can bleed outside without clipping.
  const frame = size + 36;

  // 8 sparkles emanating outward at varied angles & timings
  const sparkles = [
    { angle: 12, delay: 0, dur: 2.4 },
    { angle: 58, delay: 0.6, dur: 2.8 },
    { angle: 102, delay: 1.1, dur: 2.2 },
    { angle: 148, delay: 0.3, dur: 2.6 },
    { angle: 196, delay: 1.4, dur: 2.5 },
    { angle: 238, delay: 0.9, dur: 2.3 },
    { angle: 286, delay: 1.7, dur: 2.7 },
    { angle: 332, delay: 0.45, dur: 2.4 },
  ];

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: frame, height: frame }}
      aria-hidden
    >
      {/* Inject keyframes for emanating sparkles — local to the component so
          we don't have to touch tailwind config for a one-off animation. */}
      <style>{`
        @keyframes dsh-sparkle-emanate {
          0% {
            transform: translate(0, 0) scale(0.3);
            opacity: 0;
          }
          15% {
            opacity: 1;
            transform: translate(calc(var(--dx) * 0.15), calc(var(--dy) * 0.15)) scale(1);
          }
          70% {
            opacity: 0.85;
            transform: translate(calc(var(--dx) * 0.85), calc(var(--dy) * 0.85)) scale(0.9);
          }
          100% {
            transform: translate(var(--dx), var(--dy)) scale(0.2);
            opacity: 0;
          }
        }
        @keyframes dsh-core-pulse {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(1.12); opacity: 1; }
        }
        @keyframes dsh-glint-twinkle {
          0%, 100% { opacity: 0.95; transform: scale(1) rotate(0deg); }
          50% { opacity: 0.6; transform: scale(1.18) rotate(45deg); }
        }
      `}</style>

      {/* Breathing halo behind the structure */}
      <span
        className="absolute rounded-full pointer-events-none"
        style={{
          width: frame,
          height: frame,
          background:
            "radial-gradient(circle, rgba(91,243,255,0.32) 0%, rgba(91,243,255,0.10) 35%, transparent 65%)",
          animation: "orb-pulse 4.2s ease-in-out infinite",
        }}
      />

      <svg
        width={frame}
        height={frame}
        viewBox="0 0 140 140"
        className="absolute inset-0 overflow-visible"
      >
        <defs>
          {/* Soft star halo — bright white-blue */}
          <radialGradient id="dsh-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="22%" stopColor="#A8F8FF" stopOpacity="0.95" />
            <stop offset="55%" stopColor={CYAN} stopOpacity="0.65" />
            <stop offset="100%" stopColor={CYAN} stopOpacity="0" />
          </radialGradient>

          {/* Lattice rim gradient — cyan w/ subtle magenta blend */}
          <linearGradient id="dsh-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={CYAN} />
            <stop offset="55%" stopColor="#A8F8FF" />
            <stop offset="100%" stopColor={MAGENTA} />
          </linearGradient>

          {/* Crisp glow filter shared by struts */}
          <filter
            id="dsh-glow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="0.6" result="b1" />
            <feMerge>
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer faint cyan boundary — the sphere's silhouette */}
        <circle
          cx={70}
          cy={70}
          r={56}
          fill="none"
          stroke={CYAN}
          strokeOpacity={0.18}
          strokeWidth={0.6}
        />

        {/* Equatorial ring — full ellipse (in 3D perspective, slight tilt).
            Counter-rotates slowly forward. */}
        <g
          className="animate-ring-rotate"
          style={{ transformOrigin: "70px 70px" }}
        >
          <g
            transform="rotate(-12 70 70)"
            style={{
              filter: `drop-shadow(0 0 4px ${CYAN}) drop-shadow(0 0 9px ${CYAN})`,
            }}
          >
            <ellipse
              cx={70}
              cy={70}
              rx={54}
              ry={16}
              fill="none"
              stroke="url(#dsh-rim)"
              strokeOpacity={0.95}
              strokeWidth={1.4}
            />
            {/* Inner ribbon for depth */}
            <ellipse
              cx={70}
              cy={70}
              rx={54}
              ry={16}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={0.7}
              strokeWidth={0.5}
            />
            {/* Lattice tick marks along the equator */}
            {Array.from({ length: 16 }).map((_, i) => {
              const a = (i / 16) * Math.PI * 2;
              const x1 = 70 + Math.cos(a) * 52;
              const y1 = 70 + Math.sin(a) * 14.8;
              const x2 = 70 + Math.cos(a) * 56;
              const y2 = 70 + Math.sin(a) * 17.2;
              return (
                <line
                  key={`eq-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={CYAN}
                  strokeOpacity={0.85}
                  strokeWidth={0.9}
                />
              );
            })}
          </g>
        </g>

        {/* Meridian ring 1 — vertical, slight Y tilt. Rotates the opposite
            direction from the equator for a parallax/orbital read. */}
        <g
          className="animate-ring-rotate-rev"
          style={{ transformOrigin: "70px 70px" }}
        >
          <g
            transform="rotate(78 70 70)"
            style={{
              filter: `drop-shadow(0 0 3px ${CYAN}) drop-shadow(0 0 7px ${CYAN})`,
            }}
          >
            <ellipse
              cx={70}
              cy={70}
              rx={54}
              ry={20}
              fill="none"
              stroke={CYAN}
              strokeOpacity={0.85}
              strokeWidth={1.1}
            />
          </g>
        </g>

        {/* Meridian ring 2 — opposite tilt, faster rotation in same direction
            as equator for layered motion. */}
        <g
          className="animate-ring-rotate-fast"
          style={{ transformOrigin: "70px 70px" }}
        >
          <g
            transform="rotate(132 70 70)"
            style={{
              filter: `drop-shadow(0 0 3px ${MAGENTA}) drop-shadow(0 0 6px ${MAGENTA})`,
            }}
          >
            <ellipse
              cx={70}
              cy={70}
              rx={54}
              ry={11}
              fill="none"
              stroke={MAGENTA}
              strokeOpacity={0.65}
              strokeWidth={0.9}
            />
          </g>
        </g>

        {/* Diamond strut ornaments at lattice cardinal junctions —
            the megastructure read */}
        {[
          { x: 14, y: 70, color: CYAN },
          { x: 126, y: 70, color: CYAN },
          { x: 70, y: 14, color: TEAL },
          { x: 70, y: 126, color: TEAL },
        ].map((s, i) => (
          <g
            key={`strut-${i}`}
            transform={`translate(${s.x} ${s.y})`}
            style={{ filter: `drop-shadow(0 0 4px ${s.color})` }}
          >
            <path
              d="M 0 -3.2 L 3.2 0 L 0 3.2 L -3.2 0 Z"
              fill={s.color}
              fillOpacity={0.9}
            />
            <path
              d="M 0 -3.2 L 3.2 0 L 0 3.2 L -3.2 0 Z"
              fill="none"
              stroke="#ffffff"
              strokeOpacity={0.85}
              strokeWidth={0.5}
            />
          </g>
        ))}

        {/* Magenta corner accents at 45° */}
        {[
          { angle: 45 },
          { angle: 135 },
          { angle: 225 },
          { angle: 315 },
        ].map((s, i) => {
          const a = (s.angle * Math.PI) / 180;
          const x = 70 + Math.cos(a) * 53;
          const y = 70 + Math.sin(a) * 53;
          return (
            <circle
              key={`corner-${i}`}
              cx={x}
              cy={y}
              r={1.8}
              fill={MAGENTA}
              style={{ filter: `drop-shadow(0 0 4px ${MAGENTA})` }}
            />
          );
        })}

        {/* GLOWING STAR CORE — the contained sun, gently pulsing */}
        <g style={{ transformOrigin: "70px 70px", animation: "dsh-core-pulse 3.2s ease-in-out infinite" }}>
          <circle cx={70} cy={70} r={28} fill="url(#dsh-core)" />
          {/* Bright white nucleus */}
          <circle
            cx={70}
            cy={70}
            r={6.5}
            fill="#ffffff"
            style={{
              filter: `drop-shadow(0 0 6px ${CYAN}) drop-shadow(0 0 14px ${CYAN}) drop-shadow(0 0 22px #A8F8FF)`,
            }}
          />
        </g>

        {/* Sparkle cross — that classic star glint, twinkles independently */}
        <g
          stroke="#ffffff"
          strokeWidth={0.8}
          strokeOpacity={0.95}
          strokeLinecap="round"
          style={{
            transformOrigin: "70px 70px",
            filter: `drop-shadow(0 0 4px ${CYAN})`,
            animation: "dsh-glint-twinkle 4.6s ease-in-out infinite",
          }}
        >
          <line x1={70} y1={56} x2={70} y2={84} />
          <line x1={56} y1={70} x2={84} y2={70} />
        </g>

        {/* EMANATING SPARKLES — small bright particles drifting outward
            from the core, fading as they go. Pure SVG + CSS. */}
        {sparkles.map((s, i) => {
          const a = (s.angle * Math.PI) / 180;
          const radius = 50; // travel distance from core to outer edge
          const dx = Math.cos(a) * radius;
          const dy = Math.sin(a) * radius;
          return (
            <g
              key={`spk-${i}`}
              style={{
                transformOrigin: "70px 70px",
                // CSS custom props consumed by the keyframe
                ["--dx" as never]: `${dx}px`,
                ["--dy" as never]: `${dy}px`,
                animation: `dsh-sparkle-emanate ${s.dur}s ease-out ${s.delay}s infinite`,
              }}
            >
              {/* tiny diamond glint */}
              <path
                d="M 70 68.5 L 71.4 70 L 70 71.5 L 68.6 70 Z"
                fill="#ffffff"
                style={{
                  filter: `drop-shadow(0 0 3px ${CYAN}) drop-shadow(0 0 6px #A8F8FF)`,
                }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
