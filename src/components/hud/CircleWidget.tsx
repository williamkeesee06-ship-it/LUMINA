import { clsx } from "clsx";
import type { CSSProperties } from "react";

interface Props {
  label: string;
  value: number | string;
  color: string; // hex
  rgb: string; // "r g b"
  active?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
}

/**
 * Galaxy widget — clean cyberpunk badge.
 * Thin neon ring (single, vivid). Big white numeral centered.
 * Label sits OUTSIDE/below the circle in matching neon color.
 * Inspired by user's reference: simple, legible, luxe.
 */
export function CircleWidget({
  label,
  value,
  color,
  rgb,
  active = false,
  onClick,
  onMouseEnter,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className="group relative flex flex-col items-center select-none cursor-pointer"
      style={{ ["--w-rgb" as string]: rgb } as CSSProperties}
      title={label}
    >
      {/* The disc */}
      <div
        className={clsx(
          "relative flex items-center justify-center rounded-full transition-all duration-200",
          "group-hover:scale-[1.04]",
        )}
        style={{
          width: 60,
          height: 60,
          background:
            "radial-gradient(circle at 50% 35%, #0e1320 0%, #060912 70%, #03050a 100%)",
          border: `1.6px solid ${color}`,
          boxShadow: active
            ? `0 0 0 1px ${color}, 0 0 14px ${color}, 0 0 28px rgba(${rgb}, 0.55), inset 0 0 14px rgba(${rgb}, 0.2)`
            : `0 0 8px ${color}, 0 0 18px rgba(${rgb}, 0.45), inset 0 0 10px rgba(0,0,0,0.65)`,
        }}
      >
        <div
          className="font-mono font-semibold tabular-nums leading-none"
          style={{
            fontSize: 22,
            color: "#ffffff",
            textShadow:
              "0 0 6px rgba(255,255,255,0.9), 0 0 14px rgba(255,255,255,0.5)",
          }}
        >
          {value}
        </div>
      </div>

      {/* Label below, OUTSIDE the disc */}
      <div
        className="font-display uppercase tracking-[0.22em] mt-1.5"
        style={{
          fontSize: 9,
          color,
          textShadow: `0 0 6px ${color}cc, 0 0 12px rgba(${rgb}, 0.4)`,
          letterSpacing: "0.18em",
        }}
      >
        {label}
      </div>
    </button>
  );
}
