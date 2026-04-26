/**
 * Tactical audio cues. Bible: hover, select, confirm, error.
 * Tones are synthesized with WebAudio so we don't ship binary assets and
 * they remain perfectly tunable. Subtle, premium, never arcade.
 */
type Cue = "hover" | "select" | "confirm" | "error" | "wake";

let ctx: AudioContext | null = null;
let muted = false;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.06) {
  const c = ensureCtx();
  if (!c || muted) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = 0;
  o.connect(g);
  g.connect(c.destination);
  const t0 = c.currentTime;
  g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sfx = {
  hover() {
    tone(880, 0.08, "sine", 0.025);
  },
  select() {
    tone(1320, 0.09, "triangle", 0.05);
    setTimeout(() => tone(1760, 0.07, "triangle", 0.035), 30);
  },
  confirm() {
    tone(660, 0.12, "sine", 0.05);
    setTimeout(() => tone(990, 0.16, "sine", 0.05), 70);
  },
  error() {
    tone(220, 0.18, "sawtooth", 0.04);
    setTimeout(() => tone(180, 0.2, "sawtooth", 0.045), 80);
  },
  wake() {
    tone(440, 0.18, "sine", 0.04);
    setTimeout(() => tone(660, 0.22, "sine", 0.05), 90);
    setTimeout(() => tone(880, 0.28, "sine", 0.04), 200);
  },
} satisfies Record<Cue, () => void>;

export function setMuted(v: boolean) {
  muted = v;
}
