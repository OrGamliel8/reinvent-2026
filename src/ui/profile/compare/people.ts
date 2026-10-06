import type { ComparePerson } from '@/core/types';

// One stable color per column, from the theme's chart palette (works in light and dark).
const PERSON_COLORS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'];

export interface PersonInfo {
  name: string;
  color: string;
}

export function personInfo(people: ComparePerson[]): Map<string, PersonInfo> {
  return new Map(people.map((p, i) => [p.id, { name: p.name, color: PERSON_COLORS[i % PERSON_COLORS.length] }]));
}
