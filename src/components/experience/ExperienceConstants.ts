import { GALAXY_CATEGORIES, type GalaxyType } from '../../types/lumina';

export const GALAXY_CENTERS: Record<string, [number, number, number]> = {
  'Complete': [0, 0, 0],
  'Fielded-RTS': [0, 0, 0],
  'Needs Fielding': [0, 0, 0],
  'On Hold': [0, 0, 0],
  'Pending': [0, 0, 0],
  'Routed to Sub': [0, 0, 0],
  'Scheduled': [0, 0, 0]
};

GALAXY_CATEGORIES.forEach((galaxy, idx) => {
  const phi = Math.acos(-1 + (2 * idx) / GALAXY_CATEGORIES.length);
  const theta = Math.sqrt(GALAXY_CATEGORIES.length * Math.PI) * phi;
  const dist = 600;
  GALAXY_CENTERS[galaxy] = [
    dist * Math.cos(theta) * Math.sin(phi),
    (dist * 0.5) * Math.cos(phi),
    dist * Math.sin(theta) * Math.sin(phi)
  ];
});

export function normalizeStatusKey(status: string): GalaxyType | null {
  const s = status.toLowerCase();
  if (s.includes('complete')) return 'Complete';
  if (s.includes('fielded-rts') || s === 'fielding') return 'Fielded-RTS';
  if (s.includes('needs fielding')) return 'Needs Fielding';
  if (s.includes('hold')) return 'On Hold';
  if (s.includes('pending')) return 'Pending';
  if (s.includes('routed')) return 'Routed to Sub';
  if (s.includes('scheduled')) return 'Scheduled';
  return null;
}
