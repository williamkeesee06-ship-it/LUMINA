import { useMemo } from "react";
import { sfx } from "@/lib/audio";
import type { Satellite } from "@/types";

/**
 * JobFocusAttachmentViewer — takes over the right pane of Focus Mode
 * with an inline preview of the selected attachment. Closing returns
 * the user to the map.
 *
 * Strategy:
 *   - PDF / image / video / plain text → render inline via <iframe>
 *     (the /api/jobs-attachments?openId=... proxy strips Smartsheet's
 *     force-download Content-Disposition so the browser previews it).
 *   - Office docs / DWG / ZIP → no in-browser preview is reliable.
 *     Surface a clean "open in new tab / download" call-to-action.
 */
export function JobFocusAttachmentViewer({
  satellite,
  accent,
  onClose,
}: {
  satellite: Satellite;
  accent: string;
  onClose: () => void;
}) {
  const proxyUrl = useMemo(
    () => `/api/jobs-attachments?openId=${encodeURIComponent(satellite.id)}`,
    [satellite.id],
  );

  const previewable = isInlinePreviewable(satellite);

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col"
      style={{
        background:
          "linear-gradient(180deg, rgba(4,8,16,0.98) 0%, rgba(2,4,10,1) 100%)",
      }}
    >
      {/* Header strip */}
      <header
        className="flex items-center gap-3 px-4 py-2.5 border-b"
        style={{ borderColor: `${accent}33`, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
        />
        <div className="min-w-0 flex-1">
          <div
            className="font-mono uppercase tracking-[0.22em] text-[9px]"
            style={{ color: accent, textShadow: `0 0 8px ${accent}66` }}
          >
            attachment
          </div>
          <div className="font-mono text-[12px] text-white/95 truncate">
            {satellite.name}
          </div>
        </div>
        <a
          href={proxyUrl}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => sfx.hover()}
          onClick={() => sfx.select()}
          className="font-mono uppercase tracking-[0.2em] text-[9px] px-2.5 py-1.5 rounded-sm border transition-colors hover:bg-white/5 text-white/70 hover:text-white"
          style={{ borderColor: "rgba(255,255,255,0.18)" }}
          title="Open in a new tab"
        >
          NEW TAB ↗
        </a>
        <button
          type="button"
          onMouseEnter={() => sfx.hover()}
          onClick={onClose}
          className="font-mono uppercase tracking-[0.2em] text-[9px] px-2.5 py-1.5 rounded-sm border transition-colors"
          style={{
            color: accent,
            borderColor: `${accent}88`,
            background: `${accent}14`,
            textShadow: `0 0 8px ${accent}66`,
          }}
          title="Close attachment and return to map (ESC)"
        >
          CLOSE · ESC
        </button>
      </header>

      {/* Body */}
      <div className="relative flex-1 overflow-hidden bg-black">
        {previewable ? (
          <iframe
            key={satellite.id}
            src={proxyUrl}
            title={satellite.name}
            className="w-full h-full"
            style={{ border: "none", background: "#0a0f1c" }}
          />
        ) : (
          <FallbackCTA satellite={satellite} accent={accent} proxyUrl={proxyUrl} />
        )}
      </div>
    </div>
  );
}

function FallbackCTA({
  satellite,
  accent,
  proxyUrl,
}: {
  satellite: Satellite;
  accent: string;
  proxyUrl: string;
}) {
  const ext = (satellite.name.split(".").pop() ?? "").toUpperCase();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-12 text-center">
      <div
        className="font-display text-[60px] leading-none font-semibold"
        style={{ color: accent, textShadow: `0 0 24px ${accent}80` }}
      >
        {ext || "FILE"}
      </div>
      <div className="font-mono text-[12px] text-white/65 max-w-md">
        This file type can't be previewed in the browser.
      </div>
      <div className="flex gap-2 mt-2">
        <a
          href={proxyUrl}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => sfx.hover()}
          onClick={() => sfx.select()}
          className="font-mono uppercase tracking-[0.2em] text-[10px] px-3 py-1.5 rounded-sm border transition-colors"
          style={{
            color: accent,
            borderColor: `${accent}99`,
            background: `${accent}1f`,
            textShadow: `0 0 8px ${accent}66`,
          }}
        >
          OPEN IN NEW TAB ↗
        </a>
        <a
          href={proxyUrl}
          download={satellite.name}
          onMouseEnter={() => sfx.hover()}
          onClick={() => sfx.select()}
          className="font-mono uppercase tracking-[0.2em] text-[10px] px-3 py-1.5 rounded-sm border transition-colors hover:bg-white/5 text-white/75"
          style={{ borderColor: "rgba(255,255,255,0.2)" }}
        >
          DOWNLOAD
        </a>
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30 mt-1">
        {satellite.mimeType || "application/octet-stream"}
      </div>
    </div>
  );
}

/**
 * Decide whether the browser can render this file inline. We prefer to
 * preview when possible — operators want to see the file, not download it.
 *
 * Inline-friendly types:
 *   - PDFs (application/pdf)
 *   - Images (image/*)
 *   - Video (video/*)
 *   - Audio (audio/*)
 *   - Plain text (text/*)
 *
 * Office docs (.docx, .xlsx, .pptx), CAD (.dwg), and archives won't
 * render natively — those fall back to the OPEN IN NEW TAB / DOWNLOAD CTA.
 */
function isInlinePreviewable(sat: Satellite): boolean {
  const mt = (sat.mimeType ?? "").toLowerCase();
  if (mt.startsWith("image/")) return true;
  if (mt.startsWith("video/")) return true;
  if (mt.startsWith("audio/")) return true;
  if (mt.startsWith("text/")) return true;
  if (mt === "application/pdf") return true;

  // MIME-type fallback by extension. Smartsheet sometimes returns generic
  // "application/octet-stream" for files that the browser actually knows
  // how to render (especially photos uploaded from phones).
  const ext = (sat.name.split(".").pop() ?? "").toLowerCase();
  if (["pdf"].includes(ext)) return true;
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic", "heif"].includes(ext)) return true;
  if (["mp4", "webm", "mov", "m4v"].includes(ext)) return true;
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return true;
  if (["txt", "log", "csv", "md"].includes(ext)) return true;

  return false;
}
