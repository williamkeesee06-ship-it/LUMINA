import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUI } from "@/store/uiStore";
import { GALAXY_COLORS } from "@/lib/statusMap";
import {
  searchGmail,
  updateJobNotes,
  updateJobSecondaryStatus,
  SECONDARY_STATUS_OPTIONS,
  listJobAttachments,
  getAttachmentUrl,
  uploadJobAttachment,
  deleteJobAttachment,
} from "@/lib/api";
import { sfx } from "@/lib/audio";
import { requestGoogleToken } from "@/lib/googleAuth";
import {
  CHECKLIST_LABELS,
  CHECKLIST_TEXT_FIELDS,
  type JobChecklist,
  type Satellite,
} from "@/types";

/**
 * Job intelligence panel — luxurious dark metal w/ neon data readouts.
 * Accent color tracks the selected planet's status color.
 */
export function JobPanel() {
  const selectedJobId = useUI((s) => s.selectedJobId);
  const jobs = useUI((s) => s.jobs);
  const selectJob = useUI((s) => s.selectJob);
  const googleToken = useUI((s) => s.googleToken);
  const setGoogleToken = useUI((s) => s.setGoogleToken);
  const attachSatellites = useUI((s) => s.attachSatellites);
  const addSatellite = useUI((s) => s.addSatellite);
  const removeSatellite = useUI((s) => s.removeSatellite);
  const attachMoons = useUI((s) => s.attachMoons);
  const toggleChecklistItem = useUI((s) => s.toggleChecklistItem);
  const setChecklistText = useUI((s) => s.setChecklistText);
  const hudOrientation = useUI((s) => s.hudOrientation);

  const job = useMemo(
    () => (selectedJobId ? jobs.find((j) => j.id === selectedJobId) : undefined),
    [selectedJobId, jobs],
  );

  // SATELLITES = Smartsheet row attachments. No Google auth required —
  // hits /api/jobs-attachments which uses the server-side SMARTSHEET_TOKEN.
  // MOONS = Gmail email threads (still gated on Google OAuth, blocked
  // by Workspace policy at the moment but harmless if token is null).
  useEffect(() => {
    if (!job) return;
    if (!job.satellitesLoaded) {
      listJobAttachments(job.rowId).then((result) => {
        if (result.ok) {
          attachSatellites(job.id, result.satellites);
        } else {
          // Mark as loaded with empty list so the spinner doesn't hang —
          // the panel surfaces the failure as "No documents linked yet."
          attachSatellites(job.id, []);
        }
      });
    }
    if (googleToken && !job.moonsLoaded) {
      // Always scope to the North Sky label — the server enforces this too,
      // but prepending here keeps the UI free of personal email even if the
      // server check ever regresses.
      const q = `label:"North Sky" (${job.workOrder}${job.address ? ` OR \"${job.address}\"` : ""})`;
      searchGmail(googleToken, q).then((moons) => attachMoons(job.id, moons));
    }
  }, [job, googleToken, attachSatellites, attachMoons]);

  if (!job) return null;
  const color = GALAXY_COLORS[job.status];
  const accentRgb = hexToRgbTriplet(color);
  // Avoid colliding with the right-docked vertical HUD (≈280px wide + 24px margin).
  const rightOffset = hudOrientation === "vertical" ? 244 : 24;
  const bottomOffset = hudOrientation === "vertical" ? 24 : 210;
  const styleVar = {
    ["--panel-accent" as string]: accentRgb,
    right: rightOffset,
    bottom: bottomOffset,
  } as React.CSSProperties;

  return (
    <div
      // z-40 so the panel paints OVER the tactical map (which is z-30 inset-0).
      // Without this, clicking a map pin set selectedJobId but the panel was
      // hidden behind the map surface.
      className="pointer-events-auto fixed top-6 z-40 w-[420px] max-w-[42vw]"
      style={styleVar}
    >
      <div className="panel-luxe clip-corner h-full flex flex-col relative overflow-hidden">
        {/* Top accent bar */}
        <span
          className="pointer-events-none absolute top-0 left-0 right-0 h-px"
          style={{ background: "rgb(var(--panel-accent))", boxShadow: "0 0 12px rgba(var(--panel-accent), 0.8)" }}
        />

        {/* Header */}
        <header className="relative px-6 pt-5 pb-4">
          <div className="flex items-center justify-end gap-1.5 mb-3">
            <button
              type="button"
              onMouseEnter={() => sfx.hover()}
              onClick={() => {
                useUI.getState().enterFocus(job.id);
              }}
              className="font-mono uppercase tracking-[0.22em] text-[9px] font-semibold px-2.5 py-1 rounded-sm border transition-colors"
              style={{
                color,
                borderColor: `${color}88`,
                background: `${color}14`,
                textShadow: `0 0 8px ${color}66`,
              }}
              title="Focus mode — fullscreen edit + map (F)"
            >
              FOCUS · F
            </button>
            <button
              type="button"
              onMouseEnter={() => sfx.hover()}
              onClick={() => {
                sfx.select();
                selectJob(null);
              }}
              className="text-white/40 hover:text-white text-base leading-none w-6 h-6 flex items-center justify-center border border-white/10 hover:border-white/30 transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Hero work order */}
          <div className="flex items-baseline gap-3">
            <span className="font-display uppercase tracking-tactical text-[9px] text-white/40 self-start mt-2">
              W/O
            </span>
            <div className="work-order-hero text-[28px] leading-none font-semibold flex-1 truncate">
              {job.workOrder}
            </div>
          </div>

          {/* Status line — galaxy badge + editable secondary-status dropdown */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: color, boxShadow: `0 0 10px ${color}` }}
            />
            <span
              className="font-mono text-[10px] uppercase tracking-[0.2em] font-semibold"
              style={{ color, textShadow: `0 0 12px ${color}66` }}
            >
              {job.status}
            </span>
            <span className="font-mono text-[9px] text-white/30 uppercase">·</span>
            <EditableSecondaryStatus
              rowId={job.rowId}
              jobId={job.id}
              current={job.rawSecondaryStatus ?? ""}
              accent={color}
            />
          </div>

          {/* Header underline */}
          <div className="absolute left-0 right-0 bottom-0 h-px section-rail" />
        </header>

        {/* Body */}
        <div className="relative flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Coordinates */}
          <Section label="coordinates">
            {job.fullAddress ? (
              <div className="space-y-1">
                <div className="text-[17px] text-white/95 font-medium leading-snug">{job.address}</div>
                <div className="text-white/65 text-sm font-mono uppercase tracking-wide">
                  {[job.city, job.zip].filter(Boolean).join(" · ")}
                </div>
              </div>
            ) : (
              <Empty>No address recorded.</Empty>
            )}
          </Section>

          {/* Operational tiles */}
          <Section label="operational telemetry">
            <div className="grid grid-cols-2 gap-2">
              <Tile label="base" value={job.base} />
              <Tile label="work type" value={job.workType} />
              <Tile label="schedule" value={fmtDate(job.scheduleDate)} accent />
              <Tile label="due" value={fmtDate(job.dueDate)} accent />
              <Tile label="received" value={fmtDate(job.receivedDate)} />
              <Tile label="bid value" value={job.bidValue} accent />
              <Tile label="permit" value={job.permitNumber} />
              <Tile label="crew" value={job.crew} />
            </div>
          </Section>

          {/* Moons — Gmail email threads (email = moon, closer orbit).
              PR #5: this section IS the "Email Thread" stacked below the job
              card. Font sizes are bumped (subject 15-16px, snippet ~13px) so
              the operator can actually read the inbox without leaning in. */}
          <Section
            label="email thread · moons"
            count={job.moons.length || undefined}
            action={
              !googleToken ? (
                <ConnectButton
                  onClick={async () => {
                    try {
                      sfx.select();
                      const { accessToken } = await requestGoogleToken();
                      setGoogleToken(accessToken);
                      sfx.confirm();
                    } catch {
                      sfx.error();
                    }
                  }}
                />
              ) : null
            }
          >
            {!googleToken ? (
              <Empty>Connect Google to surface email threads.</Empty>
            ) : !job.moonsLoaded ? (
              <Loading>Acquiring moons…</Loading>
            ) : job.moons.length === 0 ? (
              <Empty>No email threads found.</Empty>
            ) : (
              <ul className="space-y-2">
                {job.moons.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onMouseEnter={() => sfx.hover()}
                      onClick={() => {
                        // Clicking a moon opens the in-cockpit EmailThreadView
                        // (which still hits /api/gmail with the North Sky
                        // scope guard). Keeps the email-rendering path
                        // single-sourced through the dispatch in api/gmail.ts.
                        useUI.getState().openThread(m.threadId, job.id);
                      }}
                      className="panel-row w-full text-left block px-3 py-2.5 flex flex-col gap-1"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            m.unread ? "bg-magenta-signal shadow-[0_0_8px_#FF3D9A]" : "bg-white/30"
                          }`}
                        />
                        <span className="text-[15px] text-white/95 truncate flex-1 leading-snug font-medium">
                          {m.subject}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono uppercase tracking-wide text-white/55 truncate pl-4">
                        {m.from}
                      </div>
                      {m.snippet && (
                        <div className="text-[13px] text-white/70 line-clamp-2 pl-4 leading-relaxed">
                          {m.snippet}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Satellites — Smartsheet row attachments. Drag a file anywhere
              on this section to upload; click a row to open. */}
          <SatellitesSection
            jobId={job.id}
            rowId={job.rowId}
            satellites={job.satellites}
            satellitesLoaded={job.satellitesLoaded}
            color={color}
            onAdd={(sat) => addSatellite(job.id, sat)}
            onRemove={(satId) => removeSatellite(job.id, satId)}
          />

          {/* Operational checklist — neon red empty / neon green checked */}
          <Section label="operational checklist">
            <ul className="space-y-1.5">
              {(Object.entries(CHECKLIST_LABELS) as [keyof JobChecklist, string][]).map(
                ([key, label]) => {
                  const checked = job.checklist?.[key] ?? false;
                  const textField = CHECKLIST_TEXT_FIELDS[key];
                  const textValue = job.checklistText?.[key] ?? "";
                  return (
                    <li key={key}>
                      <div
                        className="panel-row w-full flex items-center gap-3 px-3 py-2"
                        aria-pressed={checked}
                      >
                        <button
                          type="button"
                          onMouseEnter={() => sfx.hover()}
                          onClick={() => {
                            sfx.select();
                            toggleChecklistItem(job.id, key);
                          }}
                          className="shrink-0 w-[18px] h-[18px] rounded-[3px] flex items-center justify-center transition-all"
                          aria-label={`Toggle ${label}`}
                          style={
                            checked
                              ? {
                                  border: "2px solid #3CFF7E",
                                  background: "rgba(60, 255, 126, 0.08)",
                                  boxShadow:
                                    "0 0 8px rgba(60, 255, 126, 0.55), inset 0 0 6px rgba(60, 255, 126, 0.25)",
                                }
                              : {
                                  border: "2px solid #FF3D5C",
                                  background: "rgba(255, 61, 92, 0.04)",
                                  boxShadow:
                                    "0 0 8px rgba(255, 61, 92, 0.45), inset 0 0 4px rgba(255, 61, 92, 0.18)",
                                }
                          }
                        >
                          {checked && (
                            <svg
                              viewBox="0 0 16 16"
                              width="12"
                              height="12"
                              fill="none"
                              stroke="#3CFF7E"
                              strokeWidth="2.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ filter: "drop-shadow(0 0 4px #3CFF7E)" }}
                            >
                              <path d="M3 8.5 L6.5 12 L13 4.5" />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          onMouseEnter={() => sfx.hover()}
                          onClick={() => {
                            sfx.select();
                            toggleChecklistItem(job.id, key);
                          }}
                          className="text-left"
                          style={{ minWidth: textField ? "6.5rem" : undefined }}
                        >
                          <span
                            className={`text-[13px] font-mono uppercase tracking-[0.14em] transition-colors ${
                              checked ? "text-white/95" : "text-white/70"
                            }`}
                            style={
                              checked
                                ? { textShadow: "0 0 8px rgba(60, 255, 126, 0.35)" }
                                : undefined
                            }
                          >
                            {label}
                          </span>
                        </button>
                        {textField && (
                          <input
                            type="text"
                            value={textValue}
                            onChange={(e) => setChecklistText(job.id, key, e.target.value)}
                            placeholder={textField.placeholder}
                            className="flex-1 min-w-0 bg-transparent outline-none px-2 py-1 rounded-[3px] text-[13px] font-mono tracking-wide transition-all"
                            style={
                              checked
                                ? {
                                    border: "1px solid rgba(60, 255, 126, 0.55)",
                                    background: "rgba(60, 255, 126, 0.06)",
                                    color: "#3CFF7E",
                                    textShadow: "0 0 6px rgba(60, 255, 126, 0.45)",
                                    boxShadow:
                                      "0 0 6px rgba(60, 255, 126, 0.25), inset 0 0 4px rgba(60, 255, 126, 0.12)",
                                  }
                                : {
                                    border: "1px solid rgba(255, 255, 255, 0.14)",
                                    background: "rgba(255, 255, 255, 0.02)",
                                    color: "rgba(255, 255, 255, 0.85)",
                                  }
                            }
                          />
                        )}
                      </div>
                    </li>
                  );
                },
              )}
            </ul>
          </Section>

          {/* Notes — NSC Project Notes column is now editable.
              Save persists back to Smartsheet for the row. */}
          <Section label="operational notes">
            <div className="space-y-2">
              <EditableNotes
                rowId={job.rowId}
                jobId={job.id}
                notes={job.notes ?? ""}
                accent={color}
              />
              {job.splicingNotes && (
                <div className="panel-tile px-3 py-2.5">
                  <div className="section-bracket mb-1">// splicing</div>
                  <div className="text-xs text-white/80 whitespace-pre-wrap leading-relaxed">
                    {job.splicingNotes}
                  </div>
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  count,
  action,
  children,
}: {
  label: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="section-bracket">// {label}</span>
          {count !== undefined && (
            <span className="font-mono text-[10px] text-white/35">[{String(count).padStart(2, "0")}]</span>
          )}
        </div>
        {action}
      </div>
      <div className="section-rail mb-2.5" />
      <div>{children}</div>
    </section>
  );
}

function Tile({ label, value, accent }: { label: string; value?: string; accent?: boolean }) {
  return (
    <div className="panel-tile px-2.5 py-2 rounded-[2px]">
      <div className="font-display uppercase tracking-tactical text-[9px] text-white/40 mb-0.5">
        {label}
      </div>
      <div
        className={`font-mono text-[13px] truncate tabular-nums ${accent ? "" : "text-white/90"}`}
        style={accent && value ? { color: "rgb(var(--panel-accent))", textShadow: "0 0 10px rgba(var(--panel-accent), 0.45)" } : undefined}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-white/35 italic font-mono py-1 pl-1">{children}</div>
  );
}

function Loading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono py-1 pl-1" style={{ color: "rgb(var(--panel-accent))" }}>
      <span className="w-1.5 h-1.5 rounded-full neon-dot animate-pulse" />
      {children}
    </div>
  );
}

function ConnectButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseEnter={() => sfx.hover()}
      onClick={onClick}
      className="text-[10px] font-mono uppercase tracking-[0.2em] px-2.5 py-1 border transition-colors"
      style={{
        color: "rgb(var(--panel-accent))",
        borderColor: "rgba(var(--panel-accent), 0.5)",
        background: "rgba(var(--panel-accent), 0.04)",
      }}
    >
      connect
    </button>
  );
}

/**
 * EditableNotes — inline editor for NSC Project Notes.
 *
 * Shows the current value in a textarea styled like the other panel tiles.
 * Tracks dirty state (when textarea content differs from the saved notes).
 * On save: optimistic local update, then PUT /api/jobs-update. On failure,
 * the inline status flips to an error state but the local edit is kept so
 * the user doesn't lose their work.
 */
function EditableNotes({
  rowId,
  jobId,
  notes,
  accent,
}: {
  rowId: string;
  jobId: string;
  notes: string;
  accent: string;
}) {
  const setJobNotes = useUI((s) => s.setJobNotes);
  const [draft, setDraft] = useState(notes);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved"; at: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  // When the user selects a different planet (or the upstream notes change
  // via a fresh Smartsheet pull), reset the draft to match.
  useEffect(() => {
    setDraft(notes);
    setStatus({ kind: "idle" });
  }, [jobId, notes]);

  const dirty = draft !== notes;

  async function handleSave() {
    if (!dirty || status.kind === "saving") return;
    setStatus({ kind: "saving" });
    sfx.select();
    // Optimistic local update so the universe reflects the change instantly.
    setJobNotes(jobId, draft);
    const result = await updateJobNotes(rowId, draft);
    if (result.ok) {
      setStatus({ kind: "saved", at: Date.now() });
      sfx.confirm();
    } else {
      // Roll back local notes only if it makes sense — we keep the draft
      // editable so the user can retry without re-typing.
      setStatus({ kind: "error", message: result.message });
      sfx.error();
    }
  }

  function handleRevert() {
    setDraft(notes);
    setStatus({ kind: "idle" });
  }

  const statusText =
    status.kind === "saving"
      ? "saving…"
      : status.kind === "saved"
        ? "synced to smartsheet"
        : status.kind === "error"
          ? `error: ${status.message}`
          : dirty
            ? "unsaved changes"
            : "in sync";

  const statusColor =
    status.kind === "error"
      ? "#FF6464"
      : status.kind === "saved"
        ? "#39FF7A"
        : dirty
          ? "#FFB347"
          : "rgba(255,255,255,0.4)";

  return (
    <div className="panel-tile px-3 py-2.5 space-y-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="No notes recorded. Add operational notes here — they sync to the Smartsheet 'NSC Project Notes' column on save."
        rows={Math.max(3, Math.min(10, draft.split("\n").length + 1))}
        className="w-full bg-black/40 border border-white/10 rounded-sm px-2.5 py-2 text-[13px] text-white/95 placeholder:text-white/30 leading-relaxed resize-y focus:outline-none transition-colors"
        style={{
          fontFamily: "inherit",
          minHeight: 70,
          borderColor: dirty ? `${accent}66` : "rgba(255,255,255,0.1)",
          boxShadow: dirty
            ? `inset 0 0 0 1px ${accent}33`
            : "inset 0 0 0 1px rgba(0,0,0,0.4)",
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span
          className="font-mono uppercase text-[9px]"
          style={{
            color: statusColor,
            letterSpacing: "0.18em",
            textShadow:
              status.kind === "saved" || status.kind === "error"
                ? `0 0 4px ${statusColor}`
                : undefined,
          }}
        >
          {statusText}
        </span>
        <div className="flex items-center gap-1.5">
          {dirty && status.kind !== "saving" && (
            <button
              type="button"
              onClick={handleRevert}
              className="font-mono uppercase text-[10px] tracking-[0.18em] px-2.5 py-1 rounded-sm border border-white/15 text-white/65 hover:text-white hover:border-white/35 transition-colors"
            >
              revert
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || status.kind === "saving"}
            className="font-mono uppercase text-[10px] tracking-[0.22em] px-3 py-1 rounded-sm border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              borderColor: dirty ? accent : "rgba(255,255,255,0.18)",
              color: dirty ? "#000" : "rgba(255,255,255,0.55)",
              background: dirty ? accent : "transparent",
              boxShadow: dirty
                ? `0 0 8px ${accent}, 0 0 16px ${accent}66`
                : "none",
              fontWeight: 700,
            }}
          >
            {status.kind === "saving" ? "saving…" : "save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Satellites — Smartsheet attachments orbit                          */
/* ------------------------------------------------------------------ */

/**
 * Satellites section: lists Smartsheet row attachments, click-to-open
 * (mints a fresh signed URL), drag-drop or click-to-upload, hover-to-delete.
 * Self-contained so JobPanel stays readable.
 */
function SatellitesSection({
  jobId,
  rowId,
  satellites,
  satellitesLoaded,
  color,
  onAdd,
  onRemove,
}: {
  jobId: string;
  rowId: string;
  satellites: Satellite[];
  satellitesLoaded: boolean;
  color: string;
  onAdd: (sat: Satellite) => void;
  onRemove: (id: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<
    Array<{ id: string; name: string; progress: "working" | "error"; message?: string }>
  >([]);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset transient state on job change.
  useEffect(() => {
    setUploading([]);
    setError(null);
    setDragOver(false);
  }, [jobId]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setError(null);
      // Use a stable temp id per upload so we can correlate row -> result.
      const newRows = list.map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: f.name,
        progress: "working" as const,
      }));
      setUploading((u) => [...u, ...newRows]);
      sfx.select();
      // Upload in parallel — each completes independently.
      await Promise.all(
        list.map(async (f, i) => {
          const tempId = newRows[i].id;
          const result = await uploadJobAttachment(rowId, f);
          if (result.ok) {
            onAdd(result.satellite);
            setUploading((u) => u.filter((x) => x.id !== tempId));
            sfx.confirm();
          } else {
            setUploading((u) =>
              u.map((x) =>
                x.id === tempId
                  ? { ...x, progress: "error", message: result.message }
                  : x,
              ),
            );
            sfx.error();
          }
        }),
      );
    },
    [rowId, onAdd],
  );

  async function handleOpen(satelliteId: string, name: string, mimeType: string) {
    if (openingId) return;
    setOpeningId(satelliteId);
    sfx.select();
    // Server-side proxy strips Content-Disposition: attachment and emits the
    // file inline with the correct MIME type, so the browser previews it
    // (PDFs, images, video) instead of downloading. Non-previewable types
    // (DWG, ZIP, DOC, XLS) still download — nothing the browser can render.
    void name; void mimeType; // kept for future extension-based fallback
    const proxyUrl = `/api/jobs-attachments?openId=${encodeURIComponent(satelliteId)}`;
    window.open(proxyUrl, "_blank", "noopener,noreferrer");
    setOpeningId(null);
  }

  async function handleDelete(satelliteId: string, name: string) {
    if (!window.confirm(`Delete \"${name}\" from Smartsheet? This cannot be undone.`))
      return;
    sfx.select();
    // Optimistic remove — reinsert on failure.
    onRemove(satelliteId);
    const result = await deleteJobAttachment(satelliteId);
    if (!result.ok) {
      // Reload list to recover the row that was optimistically removed.
      const fresh = await listJobAttachments(rowId);
      if (fresh.ok) {
        const lost = fresh.satellites.find((s) => s.id === satelliteId);
        if (lost) onAdd(lost);
      }
      setError(result.message);
      sfx.error();
      setTimeout(() => setError(null), 4500);
    } else {
      sfx.confirm();
    }
  }

  // Drag handlers — only react to file drags.
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
    // Only count as leaving when crossing out of the section, not when
    // moving between child elements (relatedTarget will be inside).
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

  const showEmpty = satellitesLoaded && satellites.length === 0 && uploading.length === 0;

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative"
    >
      <Section
        label="satellites · smartsheet"
        count={satellites.length || undefined}
        action={
          <button
            type="button"
            onMouseEnter={() => sfx.hover()}
            onClick={() => {
              sfx.select();
              fileInputRef.current?.click();
            }}
            className="font-mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 border transition-colors hover:bg-white/5"
            style={{
              color: "rgba(255,255,255,0.7)",
              borderColor: "rgba(255,255,255,0.15)",
            }}
            title="Upload a file to this job's Smartsheet row"
          >
            + upload
          </button>
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            // Reset so re-selecting the same file refires onChange.
            e.target.value = "";
          }}
        />

        {!satellitesLoaded ? (
          <Loading>Acquiring satellites…</Loading>
        ) : showEmpty ? (
          <Empty>
            No documents linked yet. Drag files here or click + upload.
          </Empty>
        ) : (
          <ul className="space-y-1">
            {satellites.map((s) => (
              <li key={s.id}>
                <div className="panel-row flex items-center gap-2 px-3 py-1.5 group">
                  <span
                    className="w-1 h-1 rounded-full shrink-0"
                    style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                  />
                  <button
                    type="button"
                    onMouseEnter={() => sfx.hover()}
                    onClick={() => handleOpen(s.id, s.name, s.mimeType)}
                    disabled={openingId === s.id}
                    className="text-[13px] text-white/90 truncate flex-1 text-left hover:text-white disabled:opacity-60 transition-colors"
                    title={`${s.name}${s.sizeInKb ? ` — ${formatKb(s.sizeInKb)}` : ""}`}
                  >
                    {openingId === s.id ? "opening…" : s.name}
                  </button>
                  {s.category && (
                    <span
                      className="text-[9px] font-mono uppercase tracking-[0.18em] px-1.5 py-0.5 border shrink-0"
                      style={{
                        color,
                        borderColor: `${color}55`,
                        background: `${color}08`,
                      }}
                    >
                      {s.category}
                    </span>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => sfx.hover()}
                    onClick={() => handleDelete(s.id, s.name)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-red-400 text-xs leading-none w-4 h-4 flex items-center justify-center shrink-0"
                    aria-label={`Delete ${s.name}`}
                    title="Delete from Smartsheet"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
            {uploading.map((u) => (
              <li key={u.id}>
                <div
                  className="panel-row flex items-center gap-2 px-3 py-1.5"
                  style={{
                    borderColor:
                      u.progress === "error"
                        ? "rgba(255,100,100,0.4)"
                        : "rgba(255,255,255,0.1)",
                  }}
                >
                  <span
                    className="w-1 h-1 rounded-full shrink-0"
                    style={{
                      background:
                        u.progress === "error" ? "#FF6464" : "rgba(255,255,255,0.4)",
                      animation:
                        u.progress === "working"
                          ? "pulse 1.4s ease-in-out infinite"
                          : undefined,
                    }}
                  />
                  <span className="text-[13px] text-white/60 truncate flex-1">
                    {u.name}
                  </span>
                  <span
                    className="text-[9px] font-mono uppercase tracking-[0.18em]"
                    style={{
                      color: u.progress === "error" ? "#FF6464" : "rgba(255,255,255,0.5)",
                    }}
                    title={u.message}
                  >
                    {u.progress === "error" ? "failed" : "uploading…"}
                  </span>
                  {u.progress === "error" && (
                    <button
                      type="button"
                      onClick={() =>
                        setUploading((s) => s.filter((x) => x.id !== u.id))
                      }
                      className="text-white/40 hover:text-white text-xs leading-none w-4 h-4 flex items-center justify-center"
                      aria-label="Dismiss"
                    >
                      ×
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div
            className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] px-2 py-1 border"
            style={{
              color: "#FF6464",
              borderColor: "rgba(255,100,100,0.45)",
              background: "rgba(255,100,100,0.05)",
            }}
          >
            {error}
          </div>
        )}
      </Section>

      {/* Drag overlay — only paints when files are being dragged. */}
      {dragOver && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
          style={{
            background: `${color}1a`,
            border: `1.5px dashed ${color}aa`,
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            className="font-mono text-[11px] uppercase tracking-[0.28em] px-3 py-2"
            style={{ color, textShadow: `0 0 8px ${color}aa` }}
          >
            Drop to attach to row
          </div>
        </div>
      )}
    </div>
  );
}

function hasFiles(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes("Files");
}

function formatKb(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * EditableSecondaryStatus — click-to-open dropdown matching the Smartsheet
 * "Secondary Job Status" picklist. Sets local state optimistically (so the
 * planet recolors / regalaxies instantly) then PUTs to /api/jobs-update.
 * On failure, rolls back to the previous value and shows an error pill.
 */
function EditableSecondaryStatus({
  rowId,
  jobId,
  current,
  accent,
}: {
  rowId: string;
  jobId: string;
  current: string;
  accent: string;
}) {
  const setJobSecondaryStatus = useUI((s) => s.setJobSecondaryStatus);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click / ESC.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Reset error when the job changes.
  useEffect(() => {
    setError(null);
    setOpen(false);
  }, [jobId]);

  const display = current || "—";

  async function handleChoose(next: string) {
    setOpen(false);
    if (next === current || saving) return;
    const previous = current;
    setError(null);
    setSaving(true);
    sfx.select();
    // Optimistic local update so the planet jumps galaxies immediately.
    setJobSecondaryStatus(jobId, next);
    const result = await updateJobSecondaryStatus(rowId, next);
    setSaving(false);
    if (result.ok) {
      sfx.confirm();
    } else {
      // Rollback local state, surface error briefly.
      setJobSecondaryStatus(jobId, previous);
      setError(result.message);
      sfx.error();
      // Auto-clear error after a few seconds so it doesn't linger.
      setTimeout(() => setError(null), 4500);
    }
  }

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => sfx.hover()}
        onClick={() => {
          sfx.select();
          setOpen((v) => !v);
        }}
        disabled={saving}
        className="font-mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-sm border transition-colors disabled:opacity-60"
        style={{
          color: error ? "#FF6464" : "rgba(255,255,255,0.7)",
          borderColor: open
            ? `${accent}99`
            : error
              ? "rgba(255,100,100,0.55)"
              : "rgba(255,255,255,0.15)",
          background: open ? `${accent}14` : "rgba(255,255,255,0.02)",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Click to change secondary status — syncs to Smartsheet"
      >
        <span className="truncate inline-block max-w-[200px] align-middle">
          {saving ? "saving…" : display}
        </span>
        <span className="ml-1 opacity-60" aria-hidden>
          ▾
        </span>
      </button>

      {error && !open && (
        <span
          className="ml-2 font-mono text-[8px] uppercase tracking-[0.2em]"
          style={{ color: "#FF6464", textShadow: "0 0 4px #FF6464" }}
          title={error}
        >
          sync failed
        </span>
      )}

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1.5 z-50 min-w-[240px] max-h-[320px] overflow-y-auto rounded-sm border shadow-2xl"
          style={{
            background: "rgba(8, 12, 20, 0.97)",
            borderColor: `${accent}55`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.65), 0 0 12px ${accent}33`,
            backdropFilter: "blur(8px)",
          }}
        >
          {SECONDARY_STATUS_OPTIONS.map((opt) => {
            const selected = opt === current;
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => sfx.hover()}
                onClick={() => handleChoose(opt)}
                className="w-full text-left font-mono text-[11px] uppercase tracking-[0.12em] px-3 py-1.5 transition-colors hover:bg-white/5 focus:outline-none focus:bg-white/5 flex items-center gap-2"
                style={{
                  color: selected ? accent : "rgba(255,255,255,0.85)",
                  background: selected ? `${accent}14` : "transparent",
                  textShadow: selected ? `0 0 6px ${accent}66` : undefined,
                }}
              >
                <span
                  className="inline-block w-1 h-1 rounded-full shrink-0"
                  style={{
                    background: selected ? accent : "rgba(255,255,255,0.18)",
                    boxShadow: selected ? `0 0 6px ${accent}` : undefined,
                  }}
                />
                <span className="truncate">{opt}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fmtDate(d?: string): string | undefined {
  if (!d) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return d;
}

function hexToRgbTriplet(hex: string): string {
  const h = hex.replace("#", "");
  const n = h.length === 3
    ? h.split("").map((c) => c + c).join("")
    : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}
