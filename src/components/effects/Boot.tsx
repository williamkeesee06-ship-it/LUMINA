import { useEffect, useState } from "react";

const LINES = [
  "BOOTING TACTICAL CORE",
  "ESTABLISHING CHANNEL · SMARTSHEET",
  "CALIBRATING UNIVERSE",
  "AWAKENING LUMINA",
];

export function Boot({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= LINES.length) {
      const t = setTimeout(onDone, 320);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 380);
    return () => clearTimeout(t);
  }, [step, onDone]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-void">
      <div className="absolute inset-0 reticle opacity-20" />
      <div className="text-center">
        <div className="mb-8">
          <svg width={88} height={88} viewBox="0 0 88 88" className="mx-auto">
            <circle cx={44} cy={44} r={40} stroke="#5BF3FF" strokeOpacity={0.3} fill="none" />
            <circle cx={44} cy={44} r={28} stroke="#5BF3FF" strokeOpacity={0.6} fill="none" />
            <circle
              cx={44}
              cy={44}
              r={10}
              fill="#5BF3FF"
              style={{ filter: "drop-shadow(0 0 14px #5BF3FF)" }}
            />
          </svg>
        </div>
        <div className="font-display tracking-tactical text-sm uppercase text-cyan-glow mb-1">
          LUMINA V3
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wide text-white/40 mb-8">
          tactical command system
        </div>
        <div className="font-mono text-[11px] text-cyan-glow/80 space-y-1">
          {LINES.map((l, i) => (
            <div
              key={l}
              className={i < step ? "opacity-100" : i === step ? "opacity-100 animate-pulse" : "opacity-20"}
            >
              {i < step ? "✓ " : i === step ? "› " : "  "}
              {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
