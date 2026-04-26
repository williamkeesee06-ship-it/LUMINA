import { useEffect, useMemo } from "react";
import { useUI } from "@/store/uiStore";
import { GALAXY_COLORS } from "@/lib/statusMap";
import { listDrive, searchGmail } from "@/lib/api";
import { sfx } from "@/lib/audio";
import { requestGoogleToken } from "@/lib/googleAuth";

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
  const accentRgb = hexToRgbTriplet(color);
  const styleVar = { ["--panel-accent" as string]: accentRgb } as React.CSSProperties;

  return (
    <div
      className="pointer-events-auto fixed top-6 right-6 bottom-[210px] z-30 w-[420px] max-w-[42vw]"
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
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="neon-dot w-1.5 h-1.5 rounded-full" />
              <span className="section-bracket">// job intelligence</span>
            </div>
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

          {/* Status line */}
          <div className="mt-3 flex items-center gap-2">
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
            {job.rawSecondaryStatus && job.rawSecondaryStatus !== job.status && (
              <span className="font-mono text-[9px] text-white/35 uppercase tracking-[0.18em]">
                · {job.rawSecondaryStatus}
              </span>
            )}
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
                <div className="text-[15px] text-white/95 font-medium">{job.address}</div>
                <div className="text-white/55 text-xs font-mono uppercase tracking-wide">
                  {[job.city, job.zip].filter(Boolean).join(" · ")}
                </div>
                {job.coords && (
                  <div className="font-mono text-[10px] text-white/45 mt-1.5 flex items-center gap-2">
                    <span className="opacity-60">LAT</span>
                    <span style={{ color }}>{job.coords.lat.toFixed(4)}</span>
                    <span className="opacity-30">|</span>
                    <span className="opacity-60">LNG</span>
                    <span style={{ color }}>{job.coords.lng.toFixed(4)}</span>
                  </div>
                )}
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
              <ul className="space-y-1.5">
                {job.satellites.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`https://mail.google.com/mail/u/0/#inbox/${s.threadId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="panel-row block px-3 py-2 flex flex-col gap-0.5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            s.unread ? "bg-magenta-signal shadow-[0_0_8px_#FF3D9A]" : "bg-white/30"
                          }`}
                        />
                        <span className="text-[13px] text-white/95 truncate flex-1 leading-tight">
                          {s.subject}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-wide text-white/45 truncate pl-3.5">
                        {s.from}
                      </div>
                      {s.snippet && (
                        <div className="text-xs text-white/55 line-clamp-2 pl-3.5">{s.snippet}</div>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Moons — Drive */}
          <Section label="moons · drive" count={job.moons.length || undefined}>
            {!googleToken ? (
              <Empty>Connect Google to surface job artifacts.</Empty>
            ) : !job.moonsLoaded ? (
              <Loading>Acquiring moons…</Loading>
            ) : job.moons.length === 0 ? (
              <Empty>No documents linked yet.</Empty>
            ) : (
              <ul className="space-y-1">
                {job.moons.map((m) => (
                  <li key={m.id}>
                    <a
                      href={m.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="panel-row flex items-center gap-2 px-3 py-1.5"
                    >
                      <span
                        className="w-1 h-1 rounded-full shrink-0"
                        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                      />
                      <span className="text-[13px] text-white/90 truncate flex-1">{m.name}</span>
                      {m.category && (
                        <span
                          className="text-[9px] font-mono uppercase tracking-[0.18em] px-1.5 py-0.5 border"
                          style={{
                            color,
                            borderColor: `${color}55`,
                            background: `${color}08`,
                          }}
                        >
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
                  <div className="panel-tile px-3 py-2.5 text-[13px] text-white/90 whitespace-pre-wrap leading-relaxed">
                    {job.notes}
                  </div>
                )}
                {job.splicingNotes && (
                  <div className="panel-tile px-3 py-2.5">
                    <div className="section-bracket mb-1">// splicing</div>
                    <div className="text-xs text-white/80 whitespace-pre-wrap leading-relaxed">
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
