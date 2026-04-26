import { useEffect, useRef } from "react";
import { useUI } from "@/store/uiStore";

/**
 * Hyperspace dive overlay. Renders a fullscreen canvas of radial star streaks
 * that accelerate outward from screen center, plus a crescendo white flash at
 * peak velocity. Driven entirely by the `mapTransition` state machine in the
 * UI store:
 *   diving  -> streaks ramp 0 -> peak (forward warp), flash crests at ~55%
 *   rising  -> streaks ramp peak -> 0 (reverse warp), flash mirrors
 *   idle    -> overlay parks invisible (still mounted, no work)
 *   open    -> overlay invisible (map is the active surface)
 *
 * Sits above the universe and the tactical map (z-50). Pointer events disabled
 * so it never intercepts clicks.
 */
export function HyperspaceTransition() {
  const transition = useUI((s) => s.mapTransition);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const flashRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  // Lock the active phase for the duration of the animation so a state flip
  // (diving -> open) mid-tween doesn't snap the streaks to zero — we keep
  // animating the same dive curve until the timer completes.
  const phaseRef = useRef<"idle" | "diving" | "rising">("idle");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stars: { angle: number; r0: number; speed: number; len: number; hue: number }[] = [];
    const seedStars = () => {
      stars = [];
      const N = 320;
      for (let i = 0; i < N; i += 1) {
        stars.push({
          angle: Math.random() * Math.PI * 2,
          r0: Math.random() * 0.18, // start near center (normalized)
          speed: 0.55 + Math.random() * 1.55, // varies streak velocity
          len: 0.04 + Math.random() * 0.16,
          hue: Math.random() < 0.7 ? 195 : Math.random() < 0.5 ? 320 : 0, // mostly cyan, some magenta, some white
        });
      }
    };
    seedStars();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const DIVE_MS = 1600;
    const RISE_MS = 1400;

    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // ease-out cubic

    const render = (now: number) => {
      const phase = phaseRef.current;
      if (phase === "idle") {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        if (flashRef.current) flashRef.current.style.opacity = "0";
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      const elapsed = now - startRef.current;
      const total = phase === "diving" ? DIVE_MS : RISE_MS;
      const tRaw = Math.min(1, Math.max(0, elapsed / total));
      // For rising, mirror the curve so velocity ramps DOWN as time progresses.
      const t = phase === "diving" ? tRaw : 1 - tRaw;
      const e = ease(t); // 0..1 velocity envelope

      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.hypot(cx, cy);

      // Persistent motion blur — fade the previous frame instead of clearing,
      // which gives the streaks their tail.
      ctx.fillStyle = `rgba(2, 5, 10, ${0.18 + e * 0.18})`;
      ctx.fillRect(0, 0, w, h);

      ctx.lineCap = "round";

      for (const s of stars) {
        // Radial position grows outward with envelope `e`. We loop r0 so the
        // field stays dense across the whole ramp.
        const r = ((s.r0 + e * s.speed * 0.85) % 1.05) * maxR;
        const r2 = Math.max(0, r - e * s.len * maxR);
        const x1 = cx + Math.cos(s.angle) * r;
        const y1 = cy + Math.sin(s.angle) * r;
        const x2 = cx + Math.cos(s.angle) * r2;
        const y2 = cy + Math.sin(s.angle) * r2;

        // Streak alpha tied to envelope so they fade in/out smoothly.
        const alpha = Math.min(1, 0.1 + e * 1.4);
        const stroke =
          s.hue === 0
            ? `rgba(255,255,255,${alpha})`
            : s.hue === 320
              ? `rgba(255, 61, 154, ${alpha * 0.85})`
              : `rgba(140, 230, 255, ${alpha})`;

        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1 + e * 1.6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Flash crest near peak velocity (t≈0.55 for diving, t≈0.45 for rising
      // since we mirrored). Use raw timing for a clean bell.
      if (flashRef.current) {
        const ft = phase === "diving" ? tRaw : 1 - tRaw;
        // Bell curve centered at 0.55 with width 0.18
        const bell = Math.exp(-Math.pow((ft - 0.55) / 0.18, 2));
        flashRef.current.style.opacity = String(bell * 0.92);
      }

      // Done? park back to idle visuals; the state machine itself will flip
      // mapTransition on its own timer.
      if (tRaw >= 1) {
        phaseRef.current = "idle";
        ctx.clearRect(0, 0, w, h);
        if (flashRef.current) flashRef.current.style.opacity = "0";
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // React to state machine flips: start a new run, lock the phase.
  useEffect(() => {
    if (transition === "diving" || transition === "rising") {
      phaseRef.current = transition;
      startRef.current = performance.now();
    }
    // We deliberately don't reset phaseRef on "open" or "idle" — the render
    // loop itself parks back to idle once the curve completes, which keeps
    // the trailing streaks decelerating naturally instead of snapping to 0.
  }, [transition]);

  // Hide the overlay completely when nothing's happening so it never affects
  // composite cost or visuals.
  const visible = transition === "diving" || transition === "rising";

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms linear" }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div
        ref={flashRef}
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.95) 0%, rgba(168,248,255,0.55) 18%, rgba(91,243,255,0.18) 38%, rgba(2,5,10,0) 70%)",
          opacity: 0,
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}
