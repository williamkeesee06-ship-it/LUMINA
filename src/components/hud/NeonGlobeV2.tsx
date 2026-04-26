/**
 * NeonGlobeV2 — clean elegant globe icon for the map utility button.
 *
 * Pure neon wireframe — meridians, parallels, and an equator pole — sitting
 * in front of a soft cyan halo. No continent paths (the prior version read as
 * messy color blobs); this is type-design–grade geometric clarity.
 */

interface Props {
  size?: number;
  active?: boolean;
}

export function NeonGlobeV2({ size = 22, active = false }: Props) {
  const CYAN = "#5BF3FF";
  const MAGENTA = "#FF3D9A";
  const opacity = active ? 1 : 0.95;
  const glow = active ? 6 : 4;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className="overflow-visible"
      aria-hidden
    >
      <defs>
        <radialGradient id="ngv2-core" cx="42%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#0a1320" stopOpacity={0.95} />
          <stop offset="70%" stopColor="#03060c" stopOpacity={1} />
          <stop offset="100%" stopColor="#000000" stopOpacity={1} />
        </radialGradient>
        <linearGradient id="ngv2-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#A8F8FF" />
          <stop offset="60%" stopColor={CYAN} />
          <stop offset="100%" stopColor={MAGENTA} />
        </linearGradient>
      </defs>

      {/* Halo behind */}
      <circle
        cx={16}
        cy={16}
        r={14.5}
        fill="none"
        stroke={CYAN}
        strokeOpacity={active ? 0.45 : 0.25}
        strokeWidth={0.5}
        style={{ filter: `drop-shadow(0 0 ${glow}px ${CYAN})` }}
      />

      {/* Globe body */}
      <circle
        cx={16}
        cy={16}
        r={12.5}
        fill="url(#ngv2-core)"
        stroke="url(#ngv2-rim)"
        strokeWidth={1.2}
        opacity={opacity}
        style={{ filter: `drop-shadow(0 0 ${glow}px ${CYAN})` }}
      />

      {/* Equator (horizontal great circle) */}
      <line
        x1={3.5}
        y1={16}
        x2={28.5}
        y2={16}
        stroke={CYAN}
        strokeOpacity={0.7}
        strokeWidth={0.6}
        style={{ filter: `drop-shadow(0 0 2px ${CYAN})` }}
      />
      {/* Equator ellipse highlight (front-facing band) */}
      <ellipse
        cx={16}
        cy={16}
        rx={12.5}
        ry={3.6}
        fill="none"
        stroke={CYAN}
        strokeOpacity={0.45}
        strokeWidth={0.5}
      />

      {/* Parallels (latitude lines) */}
      <ellipse
        cx={16}
        cy={16}
        rx={12.5}
        ry={8}
        fill="none"
        stroke={CYAN}
        strokeOpacity={0.32}
        strokeWidth={0.45}
      />
      <ellipse
        cx={16}
        cy={16}
        rx={12.5}
        ry={11}
        fill="none"
        stroke={CYAN}
        strokeOpacity={0.22}
        strokeWidth={0.4}
      />

      {/* Meridians (longitude lines) */}
      <line
        x1={16}
        y1={3.5}
        x2={16}
        y2={28.5}
        stroke={CYAN}
        strokeOpacity={0.55}
        strokeWidth={0.55}
      />
      <ellipse
        cx={16}
        cy={16}
        rx={4.2}
        ry={12.5}
        fill="none"
        stroke={CYAN}
        strokeOpacity={0.35}
        strokeWidth={0.45}
      />
      <ellipse
        cx={16}
        cy={16}
        rx={8.5}
        ry={12.5}
        fill="none"
        stroke={CYAN}
        strokeOpacity={0.25}
        strokeWidth={0.4}
      />

      {/* Pole markers — magenta dots */}
      <circle
        cx={16}
        cy={3.5}
        r={1}
        fill={MAGENTA}
        style={{ filter: `drop-shadow(0 0 3px ${MAGENTA})` }}
      />
      <circle
        cx={16}
        cy={28.5}
        r={1}
        fill={MAGENTA}
        style={{ filter: `drop-shadow(0 0 3px ${MAGENTA})` }}
      />

      {/* Specular highlight — top-left */}
      <ellipse
        cx={11}
        cy={10}
        rx={3.2}
        ry={1.8}
        fill="#ffffff"
        opacity={0.18}
      />
    </svg>
  );
}
