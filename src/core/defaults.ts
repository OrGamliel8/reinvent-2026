import { VENUES, type PersonalBlock, type Settings, type TravelTable, type VenueId } from './types';

export const SOURCE_URL = 'https://reinvent-planner.cloud/api/aws/reinvent/2026/catalog';
// Official (signed-in) catalog search; ?search=<code> filters to that session, where it can be reserved. Signed-out visitors are sent to the AWS sign-in first.
const PORTAL_SEARCH_URL = 'https://registration.awsevents.com/flow/awsevents/reinvent2026/event-catalog/page/eventCatalog?search=';

export function portalUrl(code: string): string {
  return PORTAL_SEARCH_URL + encodeURIComponent(code);
}

// Catalog venue displayName -> VenueId.
export const VENUE_BY_NAME: Record<string, VenueId> = {
  Venetian: 'venetian',
  'Wynn/Encore': 'wynn',
  'Caesars Forum': 'caesars-forum',
  'Caesars Palace': 'caesars-palace',
  'MGM Grand': 'mgm',
};

export function venueName(venue: VenueId | null): string {
  return VENUES.find((v) => v.id === venue)?.name ?? 'TBA';
}

// Session type -> recorded? Types missing from the map are treated as not recorded.
export const DEFAULT_RECORDED: Record<string, boolean> = {
  'Breakout session': true,
  'Lightning talk': true,
  'Chalk talk': false,
  Workshop: false,
  "Builders' session": false,
  'Code talk': false,
  Lab: false,
  Bootcamp: false,
  'Gamified learning': false,
  'Exam prep': false,
};

// Formats where you get hands on a keyboard; they fill first, so they rank high on the reservation checklist.
export const HANDS_ON_TYPES = new Set(['Workshop', "Builders' session", 'Lab', 'Bootcamp', 'Gamified learning']);

export const DEFAULT_SETTINGS: Settings = {
  weights: { text: 1, tags: 0.6, level: 0.2, format: 0.3 },
  theme: 'light',
  recorded: DEFAULT_RECORDED,
  maxVenueSwitchesPerDay: 1,
};

export function travelKey(a: VenueId, b: VenueId): string {
  return [a, b].sort().join('|');
}

const DEFAULT_TRAVEL_PAIRS: [VenueId, VenueId, number][] = [
  ['venetian', 'wynn', 10],
  ['venetian', 'caesars-forum', 10],
  ['venetian', 'caesars-palace', 15],
  ['wynn', 'caesars-forum', 15],
  ['wynn', 'caesars-palace', 20],
  ['caesars-forum', 'caesars-palace', 10],
  ['mgm', 'venetian', 30],
  ['mgm', 'wynn', 30],
  ['mgm', 'caesars-forum', 30],
  ['mgm', 'caesars-palace', 30],
];

export const DEFAULT_TRAVEL: TravelTable = Object.fromEntries(DEFAULT_TRAVEL_PAIRS.map(([a, b, minutes]) => [travelKey(a, b), minutes]));

export function travelMinutes(table: TravelTable, a: VenueId | null, b: VenueId | null): number {
  if (!a || !b || a === b) return 0;
  return table[travelKey(a, b)] ?? DEFAULT_TRAVEL[travelKey(a, b)] ?? 0;
}

// Keynotes are not in the catalog. Names ship with the app; times must be confirmed from the official agenda.
export const KEYNOTE_PRESETS: Omit<PersonalBlock, 'id'>[] = [
  'CEO keynote',
  'AI keynote',
  'Infrastructure keynote',
  'Partner keynote',
  'CTO keynote (Werner Vogels)',
].map((title) => ({ title, kind: 'keynote', day: null, start: null, end: null, venue: null, enabled: false }));
