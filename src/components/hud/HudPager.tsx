/**
 * HudPager — vertical neon segmented bar that flips the HUD between
 * the Navigation page (galaxy shortcuts) and the Telemetry page
 * (system gauges + Gmail).
 *
 * Visual design:
 *  - Two stacked vertical neon bars (segments). The active one glows
 *    bright cyan with a strong halo, the inactive one is a dim white.
 *  - A small uppercase label sits to the right of each bar so the
 *    function is unambiguous (NAV / SYS).
 *  - Click anywhere on a bar (or its label) to jump to that page.
 *
 * Sizing: meant to anchor the top of the vertical HUD column. In the
 * horizontal HUD it can flip to a horizontal segmented bar via the
 * `orientation` prop.
 */
import { clsx } from "clsx";
import type { CSSProperties } from "react";
import { useUI } from "@/store/uiStore";
import type { HudPage } from "@/types";
import { sfx } from "@/lib/audio";

const PAGES: { id: HudPage; label: string; longLabel: string }[] = [
  { id: "navigation", label: "NAV", longLabel: "Navigation" },
  { id: "telemetry", label: "SYS", longLabel: "System" },
];

interface Props {
  /** Layout direction. Vertical = stacked bars. Horizontal = side-by-side. */
  orientation?: "vertical" | "horizontal";
  /** Compact mode hides the labels and uses shorter bars. */
  compact?: boolean;
}

export function HudPager({ orientation = "vertical", compact = false }: Props) {
  const hudPage = useUI((s) => s.hudPage);
  const setHudPage = useUI((s) => s.setHudPage);

  const isVertical = orientation === "vertical";

  // Bar geometry. Bigger bars in vertical because they have the column
  // width to fill.
  const barLength = compact ? 22 : isVertical ? 28 : 22;
  const barThickness = 3;

  return (
    <div
      className={clsx(
        "flex select-none",
        isVertical ? "flex-col items-start gap-2" : "flex-row items-center gap-3",
      )}
    >
      {PAGES.map((p) => {
        const active = hudPage === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onMouseEnter={() => sfx.hover()}
            onClick={() => {
              if (active) return;
              sfx.select();
              setHudPage(p.id);
            }}
            title={`${p.longLabel} page`}
            aria-label={`Switch to ${p.longLabel} page`}
            aria-pressed={active}
            className={clsx(
              "group flex items-center transition-all duration-200",
              isVertical ? "flex-row gap-2" : "flex-col gap-1.5",
              active ? "scale-100" : "opacity-65 hover:opacity-100",
            )}
          >
            <span
              aria-hidden
              style={
                {
                  display: "block",
                  width: isVertical ? barThickness : barLength,
                  height: isVertical ? barLength : barThickness,
                  borderRadius: 2,
                  background: active ? "#5BF3FF" : "rgba(255,255,255,0.32)",
                  boxShadow: active
                    ? "0 0 4px #5BF3FF, 0 0 10px rgba(91,243,255,0.85), 0 0 18px rgba(91,243,255,0.55)"
                    : "0 0 2px rgba(255,255,255,0.25)",
                  transition:
                    "background 200ms ease, box-shadow 200ms ease, transform 200ms ease",
                } as CSSProperties
              }
            />
            {!compact && (
              <span
                className="font-mono uppercase leading-none"
                style={{
                  fontSize: 8,
                  letterSpacing: "0.32em",
                  color: active
                    ? "#5BF3FF"
                    : "rgba(255,255,255,0.48)",
                  textShadow: active
                    ? "0 0 3px #5BF3FF, 0 0 7px rgba(91,243,255,0.6)"
                    : "none",
                }}
              >
                {p.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
