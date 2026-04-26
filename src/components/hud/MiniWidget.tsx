import { clsx } from "clsx";
import type { CSSProperties } from "react";

interface Props {
  label: string;
  value: number | string;
  color: string;
  rgb: string;
  active?: boolean;
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
  onClick,
  onMouseEnter,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className="group flex flex-col items-center select-none cursor-pointer"
      style={{ ["--w-rgb" as string]: rgb } as CSSProperties}
      title={label}
    >
      <div
        className="font-display uppercase leading-none"
        style={{
          fontSize: 7.5,
          letterSpacing: "0.22em",
          color,
          textShadow: `0 0 4px ${color}cc`,
          marginBottom: 3,
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
          width: 36,
          height: 36,
          background:
            "radial-gradient(circle at 50% 35%, #0e1320 0%, #060912 70%, #03050a 100%)",
          border: `1.4px solid ${color}`,
          boxShadow: active
            ? `0 0 0 1px ${color}, 0 0 10px ${color}, 0 0 18px rgba(${rgb}, 0.55), inset 0 0 10px rgba(${rgb}, 0.2)`
            : `0 0 5px ${color}, 0 0 11px rgba(${rgb}, 0.45), inset 0 0 8px rgba(0,0,0,0.65)`,
        }}
      >
        <div
          className="font-mono font-semibold tabular-nums leading-none"
          style={{
            fontSize: 14,
            color: "#ffffff",
            textShadow:
              "0 0 5px rgba(255,255,255,0.9), 0 0 10px rgba(255,255,255,0.5)",
          }}
        >
          {value}
        </div>
      </div>
    </button>
  );
}
