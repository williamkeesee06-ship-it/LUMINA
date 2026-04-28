import { clsx } from "clsx";
import type { CSSProperties } from "react";

interface Props {
  label: string;
  value: number | string;
  color: string;
  rgb: string;
  active?: boolean;
  /** Filtered-off state — widget dims and shows a diagonal slash. */
  disabled?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
}

/**
 * Mini galaxy widget for the vertical HUD's right column.
 *
 * Mockup spec: tiny label ABOVE the disc (e.g. "COMPLETE"), then a small
 * neon-bordered disc (~36px) with the count inside. 7 of these stack tightly
 * in a single column down the right side of the HUD next to the gauge column.
 */
export function MiniWidget({
  label,
  value,
  color,
  rgb,
  active = false,
  disabled = false,
  onClick,
  onMouseEnter,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className="group flex flex-col items-center select-none cursor-pointer"
      style={{
        ["--w-rgb" as string]: rgb,
        opacity: disabled ? 0.55 : 1,
        transition: "opacity 220ms ease",
      } as CSSProperties}
      title={disabled ? `${label} — filtered off (click to re-enable)` : label}
    >
      <div
        className="font-display uppercase leading-none"
        style={{
          fontSize: 7,
          letterSpacing: "0.24em",
          color,
          fontWeight: 600,
          // Brighter, tighter halo — was a single 4px blur which read fuzzy.
          textShadow: disabled
            ? "none"
            : `0 0 2px ${color}, 0 0 6px ${color}aa`,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        className={clsx(
          "relative flex items-center justify-center rounded-full transition-all duration-200",
          "group-hover:scale-[1.06]",
        )}
        style={{
          width: 32,
          height: 32,
          background:
            "radial-gradient(circle at 50% 35%, #0e1320 0%, #060912 70%, #03050a 100%)",
          // Thicker, brighter ring — 1.4 → 1.8px, plus a faint inner stroke
          // helps the rim read as a crisp neon line instead of a soft glow.
          border: `1.8px solid ${disabled ? "#3a4258" : color}`,
          boxShadow: disabled
            ? "inset 0 0 6px rgba(0,0,0,0.85)"
            : active
              ? `0 0 0 1px ${color}, 0 0 6px ${color}, 0 0 14px rgba(${rgb}, 0.85), 0 0 22px rgba(${rgb}, 0.55), inset 0 0 10px rgba(${rgb}, 0.25)`
              : `0 0 4px ${color}, 0 0 9px rgba(${rgb}, 0.7), 0 0 16px rgba(${rgb}, 0.4), inset 0 0 8px rgba(0,0,0,0.65)`,
        }}
      >
        <div
          className="font-mono font-semibold tabular-nums leading-none"
          style={{
            fontSize: 12.5,
            // Use the galaxy color for a crisp, bright readout instead of
            // pure white — white was bleeding through the soft halo and
            // looking fuzzy. A 1px white core inside a tight color halo
            // gives the number a sharp neon-tube feel.
            color: "#ffffff",
            textShadow: `0 0 1px #ffffff, 0 0 3px ${color}, 0 0 6px ${color}aa`,
            WebkitFontSmoothing: "antialiased",
          }}
        >
          {value}
        </div>
        {/* Diagonal strike line for the OFF state — SVG so the line stays
            crisp at every device pixel ratio and doesn't bleed past the disc. */}
        {disabled && (
          <svg
            className="absolute inset-0 pointer-events-none"
            viewBox="0 0 32 32"
            width="32"
            height="32"
            aria-hidden
          >
            <line
              x1="6"
              y1="26"
              x2="26"
              y2="6"
              stroke="#ffffff"
              strokeOpacity="0.85"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <line
              x1="6"
              y1="26"
              x2="26"
              y2="6"
              stroke={color}
              strokeOpacity="0.6"
              strokeWidth="3"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 3px ${color})`, mixBlendMode: "screen" }}
            />
          </svg>
        )}
      </div>
    </button>
  );
}
