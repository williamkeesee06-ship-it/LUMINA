/**
 * AnnotationPopup — callout/info window shown when an annotation is clicked.
 * Matches the Google My Maps popup style: white card, editable name + notes,
 * style preview, delete action. Appears anchored near the annotation.
 */

import { useEffect, useRef, useState } from "react";
import { useUI } from "@/store/uiStore";
import type { MapAnnotation } from "@/types";

interface Props {
  annotation: MapAnnotation;
  /** Screen-space position to anchor the popup near (from overlay click event). */
  anchorX: number;
  anchorY: number;
  onClose: () => void;
}

export function AnnotationPopup({ annotation, anchorX, anchorY, onClose }: Props) {
  const updateAnnotation = useUI((s) => s.updateAnnotation);
  const deleteAnnotation = useUI((s) => s.deleteAnnotation);

  const [name, setName] = useState(annotation.name);
  const [description, setDescription] = useState(annotation.description);
  const nameRef = useRef<HTMLInputElement>(null);

  // Focus the name field on mount so operator can type immediately
  useEffect(() => { nameRef.current?.focus(); }, []);

  // Flush edits when the popup closes (click elsewhere)
  function flush() {
    if (name !== annotation.name || description !== annotation.description) {
      updateAnnotation(annotation.jobId, annotation.id, { name, description });
    }
  }

  function handleDelete() {
    deleteAnnotation(annotation.jobId, annotation.id);
    onClose();
  }

  // Position popup: prefer right of anchor, flip left if too close to edge
  const LEFT_OFFSET = 12;
  const top = Math.max(8, anchorY - 80);
  const left = anchorX + LEFT_OFFSET;

  return (
    <>
      {/* Backdrop to capture outside clicks */}
      <div
        className="fixed inset-0 z-30"
        onClick={() => { flush(); onClose(); }}
      />
      <div
        className="fixed z-40 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        style={{ top, left }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color accent bar */}
        <div className="h-1.5" style={{ background: annotation.color }} />

        <div className="p-3">
          {/* Name */}
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={flush}
            placeholder="Untitled annotation"
            className="w-full text-sm font-semibold text-gray-900 border-b border-transparent focus:border-blue-400 focus:outline-none pb-1 mb-2 placeholder:text-gray-400"
          />

          {/* Description / notes */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={flush}
            placeholder="Add notes, details, or context…"
            rows={3}
            className="w-full text-xs text-gray-700 border border-gray-200 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:border-blue-400 placeholder:text-gray-400"
          />

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-2">
            {/* Type badge */}
            <span className="text-[10px] font-mono uppercase tracking-wide bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
              {annotation.type}
            </span>
            {/* Color swatch */}
            <span
              className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0"
              style={{ background: annotation.color }}
            />
            {annotation.type !== "marker" && (
              <span className="text-[10px] text-gray-400">
                {annotation.strokeWeight}px
              </span>
            )}
            <div className="flex-1" />
            {/* Actions */}
            <button
              type="button"
              onClick={handleDelete}
              title="Delete annotation"
              className="text-red-400 hover:text-red-600 text-xs px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => { flush(); onClose(); }}
              className="text-gray-400 hover:text-gray-600 text-xs px-2 py-0.5 rounded hover:bg-gray-100 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
