export const GALAXY_CATEGORIES = [
  'Complete',
  'Fielded-RTS',
  'Needs Fielding',
  'On Hold',
  'Pending',
  'Routed to Sub',
  'Scheduled'
] as const;

export type GalaxyType = typeof GALAXY_CATEGORIES[number];

export const STATUS_COLORS = {
  Complete: '#2a9d8f',        // Muted teal / soft cyan-green
  'Fielded-RTS': '#00d2ff',   // Bright cyan-blue
  'Needs Fielding': '#e76f51',// Orange-red
  'On Hold': '#ffcc33',       // Gold/amber
  'Pending': '#9d4edd',         // Violet-blue
  'Routed to Sub': '#0077ff', // Electric blue-cyan
  'Scheduled': '#7209b7',       // Magenta-violet
} as const;

export function resolveGalaxy(rawStatus?: string): GalaxyType {
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

  // Fallback for unknown statuses
  return 'Scheduled';
}
