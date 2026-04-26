import { useEffect, useMemo } from "react";
import { useUI } from "@/store/uiStore";
import { GALAXY_COLORS } from "@/lib/statusMap";
import { listDrive, searchGmail } from "@/lib/api";
import { sfx } from "@/lib/audio";
import { requestGoogleToken } from "@/lib/googleAuth";

/**
 * Job intelligence panel. Opens only when a planet is selected.
 * Bible-mandated fields: job number, status, address, satellites, moons, notes.
 */
export function JobPanel() {
  const selectedJobId = useUI((s) => s.selectedJobId);
  const jobs = useUI((s) => s.jobs);
  const selectJob = useUI((s) => s.selectJob);
  const googleToken = useUI((s) => s.googleToken);
  const setGoogleToken = useUI((s) => s.setGoogleToken);
  const attachSatellites = useUI((s) => s.attachSatellites);
  const attachMoons = useUI((s) => s.attachMoons);

  const job = useMemo(
    () => (selectedJobId ? jobs.find((j) => j.id === selectedJobId) : undefined),
    [selectedJobId, jobs],
  );

  // Auto-fetch satellites and moons when a job is selected and Google is connected.
  useEffect(() => {
    if (!job || !googleToken) return;
    if (!job.satellitesLoaded) {
      const q = `(${job.workOrder}${job.address ? ` OR \"${job.address}\"` : ""})`;
      searchGmail(googleToken, q).then((sats) => attachSatellites(job.id, sats));
    }
    if (!job.moonsLoaded) {
      listDrive(googleToken, job.workOrder).then(({ folderId, moons }) =>
        attachMoons(job.id, moons, folderId),
      );
    }
  }, [job, googleToken, attachSatellites, attachMoons]);

  if (!job) return null;
  const color = GALAXY_COLORS[job.status];

  return (
    <div className="pointer-events-auto fixed top-6 right-6 bottom-32 z-30 w-[400px] max-w-[42vw]">
      <div className="metallic-plate clip-corner h-full flex flex-col relative overflow-hidden">
        <span className="reticle opacity-30" />

        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-cyan-glow/10 flex items-start gap-3">
          <span
            className="w-2.5 h-2.5 mt-1.5 rounded-full shrink-0"
            style={{ background: color, boxShadow: `0 0 12px ${color}` }}
          />
          <div className="flex-1 min-w-0">
            <div className="tactical-label">work order</div>
            <div className="font-display text-2xl text-white text-shadow-cyan tracking-wide leading-tight">
              {job.workOrder}
            </div>
            <div className="mt-1 font-mono text-[11px] text-cyan-glow/80 uppercase tracking-wide">
              {job.status}
              {job.rawSecondaryStatus && job.rawSecondaryStatus !== job.status && (
                <span className="text-white/40 normal-case ml-2">· {job.rawSecondaryStatus}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onMouseEnter={() => sfx.hover()}
            onClick={() => {
              sfx.select();
              selectJob(null);
            }}
            className="text-cyan-glow/60 hover:text-cyan-glow text-lg leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Coordinates */}
          <Section label="coordinates">
            {job.fullAddress ? (
              <>
                <div className="text-white">{job.address}</div>
                <div className="text-white/60 text-xs">
                  {[job.city, job.zip].filter(Boolean).join(" · ")}
                </div>
                {job.coords && (
                  <div className="font-mono text-[10px] text-cyan-glow/60 mt-1">
                    {job.coords.lat.toFixed(4)}, {job.coords.lng.toFixed(4)}
                  </div>
                )}
              </>
            ) : (
              <Empty>No address recorded.</Empty>
            )}
          </Section>

          {/* Operational chips */}
          <div className="grid grid-cols-2 gap-2">
            <Chip label="base" value={job.base} />
            <Chip label="work type" value={job.workType} />
            <Chip label="schedule" value={fmtDate(job.scheduleDate)} />
            <Chip label="due" value={fmtDate(job.dueDate)} />
            <Chip label="received" value={fmtDate(job.receivedDate)} />
            <Chip label="bid value" value={job.bidValue} />
            <Chip label="permit" value={job.permitNumber} />
            <Chip label="crew" value={job.crew} />
          </div>

          {/* Satellites — Gmail */}
          <Section
            label="satellites · gmail"
            count={job.satellites.length || undefined}
            action={
              !googleToken ? (
                <ConnectButton
                  onClick={async () => {
                    try {
                      sfx.select();
                      const tk = await requestGoogleToken();
                      setGoogleToken(tk);
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
            ) : !job.satellitesLoaded ? (
              <Loading>Acquiring satellites…</Loading>
            ) : job.satellites.length === 0 ? (
              <Empty>No email threads found.</Empty>
            ) : (
              <ul className="space-y-2">
                {job.satellites.map((s) => (
                  <li
                    key={s.id}
                    className="metallic-plate-soft p-2.5 rounded-sm flex flex-col gap-0.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          s.unread ? "bg-magenta-signal shadow-[0_0_8px_#FF3D9A]" : "bg-cyan-glow/40"
                        }`}
                      />
                      <a
                        href={`https://mail.google.com/mail/u/0/#inbox/${s.threadId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-white truncate hover:text-cyan-glow"
                      >
                        {s.subject}
                      </a>
                    </div>
                    <div className="text-[10px] font-mono text-cyan-glow/60 truncate">
                      {s.from}
                    </div>
                    <div className="text-xs text-white/55 line-clamp-2">{s.snippet}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Moons — Drive */}
          <Section
            label="moons · drive"
            count={job.moons.length || undefined}
          >
            {!googleToken ? (
              <Empty>Connect Google to surface job artifacts.</Empty>
            ) : !job.moonsLoaded ? (
              <Loading>Acquiring moons…</Loading>
            ) : job.moons.length === 0 ? (
              <Empty>No documents linked yet.</Empty>
            ) : (
              <ul className="space-y-1.5">
                {job.moons.map((m) => (
                  <li key={m.id}>
                    <a
                      href={m.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-cyan-glow/5 transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-glow/70" />
                      <span className="text-sm text-white/90 truncate flex-1">{m.name}</span>
                      {m.category && (
                        <span className="text-[9px] font-mono uppercase tracking-wider text-cyan-glow/60">
                          {m.category}
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Notes */}
          <Section label="operational notes">
            {job.notes || job.splicingNotes ? (
              <div className="space-y-2">
                {job.notes && (
                  <div className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed">
                    {job.notes}
                  </div>
                )}
                {job.splicingNotes && (
                  <div className="metallic-plate-soft p-2 rounded-sm">
                    <div className="tactical-label mb-1">splicing</div>
                    <div className="text-xs text-white/75 whitespace-pre-wrap">
                      {job.splicingNotes}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Empty>No additional telemetry recorded.</Empty>
            )}
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
          <span className="tactical-label">{label}</span>
          {count !== undefined && (
            <span className="font-mono text-[10px] text-white/50">[{count}]</span>
          )}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

function Chip({ label, value }: { label: string; value?: string }) {
  return (
    <div className="metallic-plate-soft px-2.5 py-1.5 rounded-sm">
      <div className="tactical-label">{label}</div>
      <div className="font-mono text-xs text-white truncate">{value || "—"}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-white/40 italic font-mono py-1">{children}</div>
  );
}

function Loading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs text-cyan-glow/70 font-mono py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-cyan-glow animate-pulse" />
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
      className="text-[10px] font-mono uppercase tracking-tactical px-2 py-1 border border-cyan-glow/40 rounded-sm text-cyan-glow hover:bg-cyan-glow/10 transition-colors"
    >
      connect
    </button>
  );
}

function fmtDate(d?: string): string | undefined {
  if (!d) return undefined;
  // Smartsheet sends YYYY-MM-DD already.
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return d;
}
