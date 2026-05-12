/**
 * mapAnnotations.ts — thin fetch wrapper over /api/annotations.
 * All persistence for tactical map drawing tools lives here.
 * Mirror of the hydrateMemoryFromRemote / pushMemoryToRemote pattern.
 */

import type { MapAnnotation } from "@/types";

const BASE = "/api/annotations";

/** Load all annotations for a job from Firestore. Returns [] on any error. */
export async function fetchAnnotations(jobId: string): Promise<MapAnnotation[]> {
  try {
    const res = await fetch(`${BASE}?jobId=${encodeURIComponent(jobId)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { annotations?: MapAnnotation[] };
    return Array.isArray(data.annotations) ? data.annotations : [];
  } catch {
    return [];
  }
}

/**
 * Upsert the full annotation array for a job.
 * We always write the full array (same blob pattern as memory.ts).
 * Debounce callers to avoid hammering Firestore on rapid edits.
 */
export async function saveAnnotations(
  jobId: string,
  annotations: MapAnnotation[],
): Promise<void> {
  try {
    await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, annotations }),
    });
  } catch {
    // Silent — offline resilience. Data is already in Zustand store.
  }
}

/** Generate a UUID v4 without a dependency. */
export function newAnnotationId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
