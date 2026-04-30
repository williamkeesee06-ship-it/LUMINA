import { useCallback, useRef, useState } from "react";
import { useUI } from "@/store/uiStore";
import {
  uploadJobAttachment,
  deleteJobAttachment,
  listJobAttachments,
} from "@/lib/api";
import { sfx } from "@/lib/audio";
import type { Job, Satellite } from "@/types";

/**
 * Per-category neon colors. Mirrors PlanetField's SATELLITE_COLORS
 * and the JobPanel chip colors so the same file reads the same color
 * across the universe, the panel, and focus mode.
 */
const CATEGORY_COLORS: Record<NonNullable<Satellite["category"]>, string> = {
  permit: "#FFC857",
  print: "#5BF3FF",
  redline: "#FF3D9A",
  bidmaster: "#A78BFA",
  revisit: "#F97316",
  photo: "#22D3EE",
  other: "#9CA3AF",
};
const DEFAULT_COLOR = "#E5E7EB";

/**
 * JobFocusAttachmentList — list of Smartsheet row attachments rendered
 * inside the Focus Mode card. Clicking a row hands the satellite up to
 * JobFocusMode which then takes over the right pane with a preview.
 *
 * Drag-and-drop upload mirrors the JobPanel behavior so operators don't
 * have to leave focus to attach a new file.
 */
export function JobFocusAttachmentList({
  job,
  accent,
  openId,
  onOpen,
}: {
  job: Job;
  accent: string;
  openId: string | null;
  onOpen: (sat: Satellite) => void;
}) {
  const addSatellite = useUI((s) => s.addSatellite);
  const removeSatellite = useUI((s) => s.removeSatellite);
  const attachSatellites = useUI((s) => s.attachSatellites);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList) => {
      const arr = Array.from(files);
      if (arr.length === 0) return;
      setError(null);
      for (const file of arr) {
        setUploading((u) => [...u, file.name]);
        const result = await uploadJobAttachment(job.rowId, file);
        setUploading((u) => u.filter((n) => n !== file.name));
        if (result.ok) {
          addSatellite(job.id, result.satellite);
          sfx.confirm();
        } else {
          setError(result.message);
          sfx.error();
          setTimeout(() => setError(null), 4500);
        }
      }
    },
    [job.id, job.rowId, addSatellite],
  );

  async function handleDelete(sat: Satellite, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${sat.name}" from Smartsheet? This cannot be undone.`))
      return;
    sfx.select();
    removeSatellite(job.id, sat.id);
    const result = await deleteJobAttachment(sat.id);
    if (!result.ok) {
      // Roll back on failure by reloading the attachment list.
      const fresh = await listJobAttachments(job.rowId);
      if (fresh.ok) attachSatellites(job.id, fresh.satellites);
      setError(result.message);
      sfx.error();
      setTimeout(() => setError(null), 4500);
    } else {
      sfx.confirm();
    }
  }

  function hasFiles(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types ?? []).includes("Files");
  }
  function onDragEnter(e: React.DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }
  function onDragOver(e: React.DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }
  function onDragLeave(e: React.DragEvent) {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length) void handleFiles(files);
  }

  const showLoading = !job.satellitesLoaded;
  const showEmpty =
    job.satellitesLoaded && job.satellites.length === 0 && uploading.length === 0;

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative space-y-2"
    >
      {/* Upload control + status */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">
          drag files here or
        </span>
        <button
          type="button"
          onMouseEnter={() => sfx.hover()}
          onClick={() => {
            sfx.select();
            fileInputRef.current?.click();
          }}
          className="font-mono text-[9px] uppercase tracking-[0.2em] px-2 py-1 rounded-sm border transition-colors"
          style={{
            color: accent,
            borderColor: `${accent}66`,
            background: `${accent}10`,
          }}
        >
          + upload
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {error && (
        <div
          className="font-mono text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded-sm border"
          style={{ color: "#FF6464", borderColor: "rgba(255,100,100,0.55)", background: "rgba(255,40,80,0.08)" }}
        >
          error · {error}
        </div>
      )}

      {/* Drop overlay */}
      {dragOver && (
        <div
          className="pointer-events-none absolute inset-0 -m-1 rounded-sm border-2 border-dashed flex items-center justify-center font-mono uppercase tracking-[0.22em] text-[11px] z-10"
          style={{
            borderColor: `${accent}aa`,
            background: `${accent}14`,
            color: accent,
            textShadow: `0 0 8px ${accent}`,
          }}
        >
          drop to attach
        </div>
      )}

      {showLoading ? (
        <div className="font-mono text-[11px] text-white/45 py-3">
          Acquiring satellites…
        </div>
      ) : showEmpty ? (
        <div className="font-mono text-[11px] text-white/45 py-3">
          No documents linked yet.
        </div>
      ) : (
        <ul className="space-y-1">
          {uploading.map((name) => (
            <li
              key={`up-${name}`}
              className="px-2.5 py-1.5 rounded-sm border border-white/10 bg-white/[0.02] flex items-center gap-2"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
              <span className="font-mono text-[11px] text-white/55 truncate">
                uploading · {name}
              </span>
            </li>
          ))}
          {job.satellites.map((sat) => {
            const dotColor = CATEGORY_COLORS[sat.category ?? "other"] ?? DEFAULT_COLOR;
            const isOpen = openId === sat.id;
            return (
              <li key={sat.id}>
                <button
                  type="button"
                  onMouseEnter={() => sfx.hover()}
                  onClick={() => onOpen(sat)}
                  className="w-full text-left px-2.5 py-1.5 rounded-sm border transition-colors flex items-center gap-2.5 group"
                  style={{
                    borderColor: isOpen ? `${accent}88` : "rgba(255,255,255,0.1)",
                    background: isOpen ? `${accent}14` : "rgba(255,255,255,0.02)",
                  }}
                  title={`Open "${sat.name}" in the right pane`}
                >
                  {/* Category dot */}
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background: dotColor,
                      boxShadow: `0 0 8px ${dotColor}`,
                    }}
                  />
                  {/* Filename */}
                  <span
                    className="font-mono text-[12px] text-white/90 truncate flex-1"
                    style={{
                      color: isOpen ? "#fff" : undefined,
                      textShadow: isOpen ? `0 0 10px ${accent}80` : undefined,
                    }}
                  >
                    {sat.name}
                  </span>
                  {/* Size */}
                  {sat.sizeInKb !== undefined && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
                      {formatSize(sat.sizeInKb)}
                    </span>
                  )}
                  {/* Delete (×) */}
                  <span
                    role="button"
                    tabIndex={0}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      sfx.hover();
                    }}
                    onClick={(e) => handleDelete(sat, e)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleDelete(sat, e as unknown as React.MouseEvent);
                      }
                    }}
                    className="opacity-30 group-hover:opacity-80 hover:opacity-100 text-white/70 hover:text-red-400 text-base leading-none w-5 h-5 flex items-center justify-center border border-white/0 hover:border-white/20 rounded-sm transition-all flex-shrink-0"
                    aria-label={`Delete ${sat.name}`}
                    title="Delete attachment"
                  >
                    ×
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatSize(kb: number): string {
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
