/**
 * Bible: "operational failures must feel serious and clean, not dramatic or messy."
 * Smartsheet load failure blocks the system with a clear data-stream failure state.
 */
export function FailureOverlay({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-void/96">
      <div className="absolute inset-0 reticle opacity-20" />
      <div className="metallic-plate clip-corner relative max-w-md w-[92%] p-7">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-2 h-2 rounded-full bg-red-alert shadow-[0_0_12px_#FF5151]" />
          <div className="font-display tracking-tactical text-xs uppercase text-red-alert">
            data-stream failure
          </div>
        </div>
        <div className="font-display text-lg text-white text-shadow-cyan mb-1">
          Smartsheet channel offline.
        </div>
        <div className="text-sm text-white/60 mb-6 font-mono">{message}</div>
        <button
          type="button"
          onClick={onRetry}
          className="font-display text-xs uppercase tracking-tactical px-3 py-2 border border-cyan-glow/50 text-cyan-glow rounded-sm hover:bg-cyan-glow/10 transition-colors"
        >
          retry channel
        </button>
      </div>
    </div>
  );
}
