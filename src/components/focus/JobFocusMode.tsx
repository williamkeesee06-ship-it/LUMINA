import { useEffect } from "react";
import { useUI } from "@/store/uiStore";
import { GALAXY_COLORS } from "@/lib/statusMap";
import { SECONDARY_STATUS_OPTIONS } from "@/lib/api";
import { sfx } from "@/lib/audio";
import { EditableField } from "./EditableField";
import { JobFocusMap } from "./JobFocusMap";

/**
 * JobFocusMode — fullscreen, top-of-stack overlay locked to a single job.
 *
 * Layout (per Billy's spec):
 *   ┌──────────────────────────┬─────────────────────────────┐
 *   │   editable job card      │      isolated map           │
 *   │   (every Smartsheet      │   ↳ STREET VIEW toggle      │
 *   │    field syncs live)     │                             │
 *   └──────────────────────────┴─────────────────────────────┘
 *
 * Hotkeys:
 *   ESC — exit focus
 *
 * Z-index: z-[60] sits above the JobPanel (z-40) and the tactical map (z-30).
 */
export function JobFocusMode() {
  const focusedJobId = useUI((s) => s.focusedJobId);
  const exitFocus = useUI((s) => s.exitFocus);
  const job = useUI((s) =>
    focusedJobId ? s.jobs.find((j) => j.id === focusedJobId) : undefined,
  );

  // ESC closes focus mode. We bind globally so the user can hit ESC even
  // when no field has focus.
  useEffect(() => {
    if (!focusedJobId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Don't fight an active dropdown / textarea — if the user is editing
        // a field, ESC reverts that edit (handled inside EditableField) and
        // we let it bubble to us only when the active element is the body.
        const ae = document.activeElement;
        const isEditingField =
          ae instanceof HTMLInputElement ||
          ae instanceof HTMLTextAreaElement ||
          ae instanceof HTMLSelectElement;
        if (isEditingField) return;
        e.preventDefault();
        exitFocus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [focusedJobId, exitFocus]);

  if (!focusedJobId || !job) return null;

  const accent = GALAXY_COLORS[job.status];

  return (
    <div
      className="fixed inset-0 z-[60] pointer-events-auto"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(8,12,22,0.96), rgba(2,4,10,0.99))",
      }}
      role="dialog"
      aria-label={`Job focus mode for work order ${job.workOrder}`}
    >
      {/* Cosmic noise underlay so it doesn't feel flat */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 0.5px, transparent 0.5px)",
          backgroundSize: "3px 3px",
        }}
      />

      {/* Frame border with neon accent */}
      <div
        className="pointer-events-none absolute inset-3 rounded-sm"
        style={{
          borderTop: `1px solid ${accent}66`,
          borderBottom: `1px solid ${accent}33`,
          borderLeft: `1px solid ${accent}33`,
          borderRight: `1px solid ${accent}33`,
          boxShadow: `inset 0 0 60px ${accent}10, 0 0 40px rgba(0,0,0,0.6)`,
        }}
      />

      <div className="relative w-full h-full flex">
        {/* LEFT: editable job card */}
        <div className="flex-1 basis-1/2 h-full flex flex-col overflow-hidden border-r border-white/5">
          {/* Top header strip */}
          <header className="px-8 pt-6 pb-4 border-b border-white/5 relative">
            <div className="flex items-center justify-between mb-3">
              <span
                className="font-display uppercase tracking-tactical text-[10px] font-semibold"
                style={{ color: accent, textShadow: `0 0 10px ${accent}66` }}
              >
                FOCUS MODE
              </span>
              <button
                type="button"
                onMouseEnter={() => sfx.hover()}
                onClick={() => {
                  sfx.select();
                  exitFocus();
                }}
                className="font-mono uppercase tracking-[0.2em] text-[10px] px-3 py-1.5 rounded-sm border border-white/15 hover:border-white/40 text-white/65 hover:text-white transition-colors"
                title="Exit focus mode (ESC)"
              >
                EXIT · ESC
              </button>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="font-display uppercase tracking-tactical text-[10px] text-white/40 self-start mt-2">
                W/O
              </span>
              <div
                className="text-[40px] leading-none font-semibold flex-1 truncate"
                style={{
                  color: "#fff",
                  textShadow: `0 0 18px ${accent}80, 0 0 32px ${accent}40`,
                  fontFamily: "var(--font-display, inherit)",
                }}
              >
                {job.workOrder}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
              />
              <span
                className="font-mono text-[11px] uppercase tracking-[0.22em] font-semibold"
                style={{ color: accent, textShadow: `0 0 10px ${accent}66` }}
              >
                {job.status}
              </span>
              {job.receivedDate && (
                <>
                  <span className="font-mono text-[10px] text-white/25 ml-2">·</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                    received {job.receivedDate}
                  </span>
                </>
              )}
            </div>

            {/* accent rail */}
            <span
              className="absolute left-0 right-0 bottom-0 h-px"
              style={{
                background: `linear-gradient(90deg, transparent, ${accent}aa, transparent)`,
              }}
            />
          </header>

          {/* Body — the editable grid */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
            {/* Status block */}
            <Section title="status">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <EditableField
                  jobId={job.id}
                  field="rawSecondaryStatus"
                  label="Secondary Status"
                  value={job.rawSecondaryStatus}
                  variant="picklist"
                  options={[...SECONDARY_STATUS_OPTIONS]}
                  accent={accent}
                />
                <EditableField
                  jobId={job.id}
                  field="jobStatus"
                  label="Job Status"
                  value={job.jobStatus}
                  accent={accent}
                />
              </div>
            </Section>

            {/* Address block */}
            <Section title="location">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <EditableField
                  jobId={job.id}
                  field="address"
                  label="Address"
                  value={job.address}
                  accent={accent}
                  fullWidth
                />
                <EditableField
                  jobId={job.id}
                  field="city"
                  label="City"
                  value={job.city}
                  accent={accent}
                />
                <EditableField
                  jobId={job.id}
                  field="zip"
                  label="ZIP"
                  value={job.zip}
                  accent={accent}
                />
              </div>
            </Section>

            {/* Schedule block */}
            <Section title="schedule">
              <div className="grid grid-cols-3 gap-x-4 gap-y-4">
                <EditableField
                  jobId={job.id}
                  field="scheduleDate"
                  label="Schedule"
                  value={job.scheduleDate}
                  variant="date"
                  accent={accent}
                />
                <EditableField
                  jobId={job.id}
                  field="endDate"
                  label="End"
                  value={job.endDate}
                  variant="date"
                  accent={accent}
                />
                <EditableField
                  jobId={job.id}
                  field="dueDate"
                  label="Due"
                  value={job.dueDate}
                  variant="date"
                  accent={accent}
                />
              </div>
            </Section>

            {/* Crew + permit + work type */}
            <Section title="operations">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <EditableField
                  jobId={job.id}
                  field="crew"
                  label="Crew / Foreman"
                  value={job.crew}
                  accent={accent}
                />
                <EditableField
                  jobId={job.id}
                  field="permitNumber"
                  label="Permit #"
                  value={job.permitNumber}
                  accent={accent}
                />
                <EditableField
                  jobId={job.id}
                  field="workType"
                  label="Work Type"
                  value={job.workType}
                  accent={accent}
                />
                <EditableField
                  jobId={job.id}
                  field="base"
                  label="Construction Base"
                  value={job.base}
                  accent={accent}
                />
              </div>
            </Section>

            {/* Money */}
            <Section title="financial">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <EditableField
                  jobId={job.id}
                  field="bidValue"
                  label="BidMaster Value"
                  value={job.bidValue}
                  variant="currency"
                  accent={accent}
                />
              </div>
            </Section>

            {/* Notes */}
            <Section title="notes">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <EditableField
                  jobId={job.id}
                  field="notes"
                  label="NSC Project Notes"
                  value={job.notes}
                  variant="multiline"
                  accent={accent}
                  fullWidth
                  placeholder="Operational notes — sync to Smartsheet on save."
                />
                <EditableField
                  jobId={job.id}
                  field="splicingNotes"
                  label="Splicing Notes"
                  value={job.splicingNotes}
                  variant="multiline"
                  accent={accent}
                  fullWidth
                  placeholder="Splicing-specific notes — sync to Smartsheet on save."
                />
              </div>
            </Section>
          </div>
        </div>

        {/* RIGHT: isolated map / street view */}
        <div className="flex-1 basis-1/2 h-full relative overflow-hidden bg-black/80">
          <JobFocusMap job={job} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-display uppercase tracking-tactical text-[10px] text-white/35 mb-2.5 pb-1 border-b border-white/5">
        {title}
      </h3>
      {children}
    </section>
  );
}
