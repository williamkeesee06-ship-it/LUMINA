import { type GalaxyType } from '../types/lumina';

export type CanonicalStatus = GalaxyType;

export function normalizeStatus(rawStatus?: string): CanonicalStatus {
  const s = (rawStatus || '').trim().toLowerCase();

  if (s === 'complete') return 'Complete';
  if (s === 'fielded-rts') return 'Fielded-RTS';
  if (s === 'needs fielding') return 'Needs Fielding';
  if (s === 'on hold') return 'On Hold';
  if (s === 'scheduled') return 'Scheduled';
  if (s === 'routed to sub') return 'Routed to Sub';

  if (
    s === 'pending' ||
    s === 'pending splicing' ||
    s === 'pending permit' ||
    s === 'pending hsr' ||
    s === 'in review'
  ) {
    return 'Pending';
  }

  // Fallback and warning for unknown statuses
  if (s && s !== 'unknown' && s !== '') {
    console.warn(`[Lumina] Unknown Smartsheet status encountered: "${rawStatus}" - Defaulting to Scheduled`);
  }
  
  return 'Scheduled';
}


