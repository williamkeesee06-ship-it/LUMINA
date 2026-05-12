/**
 * DrawingToolbar — My Maps-style floating toolbar for the tactical map.
 * Sits in the top-left of the map surface. Controls drawing mode and
 * shows active style settings (color, stroke weight) for the selected tool.
 */

import { useUI } from "@/store/uiStore";
import type { DrawingMode } from "@/types";
import { useEffect, useRef, useState } from "react";

const PRESET_COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#0EA5E9", // sky
  "#14B8A6", // teal
  "#000000", // black
];

interface ToolConfig {
  color: string;
  strokeWeight: number;
  fillOpacity: number;
}

interface Props {
  config: ToolConfig;
  onConfigChange: (patch: Partial<ToolConfig>) => void;
}

export function DrawingToolbar({ config, onConfigChange }: Props) {
  const drawingMode = useUI((s) => s.drawingMode);
  const setDrawingMode = useUI((s) => s.setDrawingMode);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close color picker on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const tools: { mode: DrawingMode; icon: string; label: string }[] = [
    { mode: "cursor",   icon: "↖",  label: "Select / Pan" },
    { mode: "marker",   icon: "📍", label: "Place Marker" },
    { mode: "polyline", icon: "〰", label: "Draw Line" },
    { mode: "polygon",  icon: "⬡",  label: "Draw Area" },
  ];

  return (
    <div
      className="absolute top-14 left-3 z-20 flex flex-col gap-1.5 select-none"
      style={{ pointerEvents: "auto" }}
    >
      {/* Mode buttons */}
      <div className="flex flex-col gap-0.5 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        {tools.map((t) => (
          <button
            key={t.mode}
            type="button"
            title={t.label}
            onClick={() => setDrawingMode(drawingMode === t.mode ? "cursor" : t.mode)}
            className={[
              "w-10 h-10 flex items-center justify-center text-lg transition-colors",
              drawingMode === t.mode
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100",
            ].join(" ")}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {/* Style panel — only shown for drawing modes */}
      {drawingMode !== "cursor" && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex flex-col gap-2 w-44">
          {/* Color */}
          <div ref={pickerRef} className="relative">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Color
            </label>
            <button
              type="button"
              onClick={() => setShowColorPicker((v) => !v)}
              className="flex items-center gap-2 w-full border border-gray-300 rounded px-2 py-1 hover:border-blue-400"
            >
              <span
                className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0"
                style={{ background: config.color }}
              />
              <span className="text-xs text-gray-700 font-mono">{config.color}</span>
            </button>
            {showColorPicker && (
              <div className="absolute left-0 top-full mt-1 z-30 bg-white rounded-lg shadow-xl border border-gray-200 p-2">
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { onConfigChange({ color: c }); setShowColorPicker(false); }}
                      className="w-6 h-6 rounded-full border-2 hover:scale-110 transition-transform"
                      style={{
                        background: c,
                        borderColor: config.color === c ? "#2563EB" : "transparent",
                      }}
                    />
                  ))}
                </div>
                {/* Custom hex input */}
                <input
                  type="color"
                  value={config.color}
                  onChange={(e) => onConfigChange({ color: e.target.value })}
                  className="w-full h-7 rounded cursor-pointer border border-gray-200"
                  title="Custom color"
                />
              </div>
            )}
          </div>

          {/* Stroke weight — lines + polygons */}
          {(drawingMode === "polyline" || drawingMode === "polygon") && (
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                Thickness — {config.strokeWeight}px
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={config.strokeWeight}
                onChange={(e) => onConfigChange({ strokeWeight: Number(e.target.value) })}
                className="w-full accent-blue-600"
              />
            </div>
          )}

          {/* Fill opacity — polygon only */}
          {drawingMode === "polygon" && (
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                Fill opacity — {Math.round(config.fillOpacity * 100)}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(config.fillOpacity * 100)}
                onChange={(e) => onConfigChange({ fillOpacity: Number(e.target.value) / 100 })}
                className="w-full accent-blue-600"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
