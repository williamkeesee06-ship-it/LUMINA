import { useEffect, useRef, useState } from "react";
import { useUI } from "@/store/uiStore";
import { mmddyyToISO, isoToMMDDYY } from "@/lib/api";
import { sfx } from "@/lib/audio";
import type { JobFieldPatch } from "@/store/uiStore";

/**
 * EditableField — one inline editor for any single editable field on a Job.
 *
 * Behavior:
 *  - Click to enter edit mode, Enter (or blur) to commit, Escape to revert.
 *  - Optimistic local update, server PUT, rollback on failure.
 *  - Variants:
 *      • text     — single-line free-form text
 *      • multiline — textarea (used for notes / splicing notes)
 *      • date     — MM/DD/YY display, YYYY-MM-DD wire
 *      • currency — strips leading "$" and commas before sending
 *      • picklist — fixed list of choices (rendered as a select)
 *
 *  All variants share the same dirty-state, saving-spinner, and error-pill
 *  language so the focus screen feels uniform.
 */
type Variant = "text" | "multiline" | "date" | "currency" | "picklist";

export interface EditableFieldProps {
  jobId: string;
  /** Job-shaped key (matches JobFieldPatch keys; e.g. "address" or "rawSecondaryStatus"). */
  field: keyof JobFieldPatch;
  /** Display label above the field. */
  label: string;
  /** Current value from the job object (string | undefined). */
  value: string | undefined;
  variant?: Variant;
  /** Picklist options when variant === "picklist". */
  options?: string[];
  accent: string;
  /** Optional placeholder when empty. */
  placeholder?: string;
  /** When true, render the editor full-width (stacks above). */
  fullWidth?: boolean;
}

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

export function EditableField({
  jobId,
  field,
  label,
  value,
  variant = "text",
  options,
  accent,
  placeholder,
  fullWidth = false,
}: EditableFieldProps) {
  const setJobFields = useUI((s) => s.setJobFields);

  // Display value the user sees & edits. Dates are MM/DD/YY in the UI even
  // though Smartsheet stores YYYY-MM-DD on the wire.
  const initialDisplay =
    variant === "date" ? isoToMMDDYY(value) : value ?? "";

  const [draft, setDraft] = useState(initialDisplay);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  // Keep draft in sync when the underlying job value changes
  // (e.g. the user picked a different focused job).
  useEffect(() => {
    setDraft(variant === "date" ? isoToMMDDYY(value) : value ?? "");
    setStatus({ kind: "idle" });
    setEditing(false);
  }, [jobId, value, variant]);

  // Auto-focus when entering edit mode.
  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    if (inputRef.current && "select" in inputRef.current) {
      try {
        (inputRef.current as HTMLInputElement).select();
      } catch {
        /* noop */
      }
    }
  }, [editing]);

  const dirty = draft !== initialDisplay;

  function revert() {
    setDraft(initialDisplay);
    setStatus({ kind: "idle" });
    setEditing(false);
  }

  async function commit() {
    setEditing(false);
    if (!dirty || status.kind === "saving") return;

    // Convert display draft → wire value for each variant.
    let wireValue: string | null;
    if (variant === "date") {
      const trimmed = draft.trim();
      if (!trimmed) {
        wireValue = null;
      } else {
        const iso = mmddyyToISO(trimmed);
        if (!iso) {
          setStatus({ kind: "error", message: "Use MM/DD/YY format" });
          sfx.error();
          return;
        }
        wireValue = iso;
      }
    } else if (variant === "currency") {
      // Strip "$", commas, spaces — keep digits/dot/minus.
      const cleaned = draft.replace(/[^\d.\-]/g, "");
      wireValue = cleaned || null;
    } else {
      const trimmed = draft.trim();
      wireValue = trimmed === "" ? null : trimmed;
    }

    setStatus({ kind: "saving" });
    sfx.select();
    const patch: JobFieldPatch = { [field]: wireValue ?? undefined } as JobFieldPatch;
    // Note: setting undefined would skip the field; we want explicit clears
    // to send, so re-cast null clears as empty string for non-date fields.
    if (wireValue === null) {
      (patch as Record<string, unknown>)[field as string] = "";
    }

    const result = await setJobFields(jobId, patch);
    if (result.ok) {
      setStatus({ kind: "saved", at: Date.now() });
    } else {
      setStatus({ kind: "error", message: result.message });
      // Keep the draft so the user can retry without losing their edit.
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      revert();
    } else if (e.key === "Enter" && variant !== "multiline") {
      e.preventDefault();
      commit();
    } else if (e.key === "Enter" && variant === "multiline" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  }

  const statusText =
    status.kind === "saving"
      ? "saving…"
      : status.kind === "error"
        ? `error · ${status.message}`
        : status.kind === "saved" && Date.now() - status.at < 4000
          ? "synced"
          : dirty
            ? "unsaved"
            : "";

  const statusColor =
    status.kind === "error"
      ? "#FF6464"
      : status.kind === "saved"
        ? "#39FF7A"
        : dirty
          ? "#FFB347"
          : "rgba(255,255,255,0.35)";

  const display = (() => {
    if (variant === "currency" && draft) {
      const num = Number(draft.replace(/[^\d.\-]/g, ""));
      if (!Number.isNaN(num) && num !== 0) {
        return num.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
      }
    }
    return draft || (placeholder ?? "—");
  })();

  const baseInputClass =
    "w-full bg-black/45 border rounded-sm px-2.5 py-1.5 text-[13px] text-white/95 placeholder:text-white/30 focus:outline-none transition-colors font-mono";
  const borderColor = dirty ? `${accent}80` : "rgba(255,255,255,0.12)";
  const boxShadow = dirty ? `inset 0 0 0 1px ${accent}33, 0 0 12px ${accent}22` : "inset 0 0 0 1px rgba(0,0,0,0.4)";

  return (
    <div className={fullWidth ? "col-span-2 space-y-1" : "space-y-1"}>
      <div className="flex items-baseline justify-between gap-2">
        <label
          className="font-display uppercase tracking-tactical text-[9px] text-white/40"
          style={{ letterSpacing: "0.18em" }}
        >
          {label}
        </label>
        {statusText && (
          <span
            className="font-mono uppercase tracking-[0.16em] text-[8px]"
            style={{ color: statusColor }}
          >
            {statusText}
          </span>
        )}
      </div>

      {!editing ? (
        <button
          type="button"
          onMouseEnter={() => sfx.hover()}
          onClick={() => {
            sfx.select();
            setEditing(true);
          }}
          className="w-full text-left text-[13px] text-white/90 px-2.5 py-1.5 rounded-sm border border-white/10 hover:border-white/30 bg-white/[0.02] transition-colors font-mono truncate"
          style={{ minHeight: variant === "multiline" ? 64 : undefined, whiteSpace: variant === "multiline" ? "pre-wrap" : undefined }}
          title="Click to edit"
        >
          {display}
        </button>
      ) : variant === "multiline" ? (
        <textarea
          ref={(el) => (inputRef.current = el)}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={commit}
          rows={Math.max(3, Math.min(10, draft.split("\n").length + 1))}
          placeholder={placeholder}
          className={`${baseInputClass} resize-y leading-relaxed`}
          style={{ minHeight: 70, borderColor, boxShadow, fontFamily: "inherit" }}
        />
      ) : variant === "picklist" ? (
        <select
          ref={(el) => (inputRef.current = el)}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            // Picklists commit on change so the operator doesn't have to
            // press Enter to confirm the dropdown selection.
            // (defer one tick so React state lands first)
            setTimeout(() => commit(), 0);
          }}
          onBlur={commit}
          onKeyDown={handleKey}
          className={baseInputClass}
          style={{ borderColor, boxShadow }}
        >
          <option value="">—</option>
          {(options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          ref={(el) => (inputRef.current = el)}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={commit}
          placeholder={
            placeholder ?? (variant === "date" ? "MM/DD/YY" : variant === "currency" ? "$0" : undefined)
          }
          inputMode={variant === "currency" ? "decimal" : variant === "date" ? "numeric" : undefined}
          className={baseInputClass}
          style={{ borderColor, boxShadow }}
        />
      )}
    </div>
  );
}
