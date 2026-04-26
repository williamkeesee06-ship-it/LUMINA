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
        opacity: disabled ? 0.32 : 1,
        transition: "opacity 220ms ease",
      } as CSSProperties}
      title={disabled ? `${label} — filtered off` : label}
    >
      <div
        className="font-display uppercase leading-none"
        style={{
          fontSize: 7,
          letterSpacing: "0.22em",
          color,
          textShadow: disabled ? "none" : `0 0 4px ${color}cc`,
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
          border: `1.4px solid ${disabled ? "#3a4258" : color}`,
          boxShadow: disabled
            ? "inset 0 0 6px rgba(0,0,0,0.85)"
            : active
              ? `0 0 0 1px ${color}, 0 0 10px ${color}, 0 0 18px rgba(${rgb}, 0.55), inset 0 0 10px rgba(${rgb}, 0.2)`
              : `0 0 5px ${color}, 0 0 11px rgba(${rgb}, 0.45), inset 0 0 8px rgba(0,0,0,0.65)`,
        }}
      >
        <div
          className="font-mono font-semibold tabular-nums leading-none"
          style={{
            fontSize: 12.5,
            color: "#ffffff",
            textShadow:
              "0 0 5px rgba(255,255,255,0.9), 0 0 10px rgba(255,255,255,0.5)",
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
