/**
 *  Optional remote sync for Lumina memory.
 *
 *  Talks to `/api/memory` (server endpoint, see api/memory.ts). The server
 *  can be backed by Firestore REST, a flat JSON blob, or anything else
 *  the operator wires up later — the contract is the same:
 *
 *    GET  /api/memory                 -> { record: MemoryRecord | null }
 *    POST /api/memory  { record }     -> { ok: true }
 *
 *  If the endpoint isn't configured (returns 404/501), both calls quietly
 *  no-op and localStorage stays the source of truth. This keeps the app
 *  fully functional offline / on bare Vercel deploys without Firestore.
 */
import type { MemoryRecord } from "./luminaMemory";

// Unique per-browser identity so multi-device sync can scope per user.
// Falls back to "anon" if storage is blocked.
const ID_KEY = "lumina:operator:id";

function operatorId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export async function hydrateMemoryFromRemote(): Promise<MemoryRecord | null> {
  try {
    const r = await fetch(`/api/memory?op=${encodeURIComponent(operatorId())}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { record?: MemoryRecord | null };
    return data.record ?? null;
  } catch {
    return null;
  }
}

let inflight: Promise<void> | null = null;
let pending: MemoryRecord | null = null;

/**
 *  Coalesce rapid-fire writes — if a push is already in flight, queue the
 *  latest record and fire one trailing request after it settles. This
 *  protects against fact-storm during auto-save heuristic triggers.
 */
export async function pushMemoryToRemote(record: MemoryRecord): Promise<void> {
  pending = record;
  if (inflight) return inflight;
  inflight = (async () => {
    while (pending) {
      const next = pending;
      pending = null;
      try {
        await fetch(`/api/memory?op=${encodeURIComponent(operatorId())}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ record: next }),
        });
      } catch {
        // Network down — abandon this push, local state is still authoritative.
        break;
      }
    }
    inflight = null;
  })();
  return inflight;
}
