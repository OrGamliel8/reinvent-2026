// Display helpers. All times render in Las Vegas local time, regardless of the laptop's zone.
import { DAYS, VENUES, type DayId, type Slot, type VenueId } from '@/core/types';
import { HANDS_ON_TYPES } from '@/core/defaults';
import { LV_TIME_ZONE, lvDay as coreLvDay, lvTime, toMinutes } from '@/core/time';

const LV_TZ = LV_TIME_ZONE;

const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: LV_TZ, hour: 'numeric', minute: '2-digit' });
const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: LV_TZ,
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

export function fmtTime(iso: string | null): string {
  return iso ? timeFmt.format(new Date(iso)) : 'TBA';
}

export function fmtRange(start: string | null, end: string | null): string {
  if (!start) return 'TBA';
  return end ? `${fmtTime(start)} – ${fmtTime(end)}` : fmtTime(start);
}

export function fmtDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

// Minutes since Las Vegas midnight, for positioning blocks on a time grid.
export function lvMinutes(iso: string): number {
  return toMinutes(lvTime(iso));
}

export const hhmmToMinutes = toMinutes;

// The conference day (Las Vegas local) an instant falls on, or null outside the event.
export function lvDay(iso: string | null): DayId | null {
  return iso ? coreLvDay(iso) : null;
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function fmtMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function dayLabel(day: DayId | null): string {
  return DAYS.find((d) => d.id === day)?.label ?? 'TBA';
}

export function dayShort(day: DayId | null): string {
  return day ? day.charAt(0).toUpperCase() + day.slice(1) : 'TBA';
}

export function venueName(venue: VenueId | null): string {
  return VENUES.find((v) => v.id === venue)?.name ?? '—';
}

const VENUE_SHORT: Record<VenueId, string> = { venetian: 'Venetian', wynn: 'Wynn', 'caesars-forum': 'Forum', 'caesars-palace': 'Palace', mgm: 'MGM' };

export function venueShort(venue: VenueId | null): string {
  return venue ? VENUE_SHORT[venue] : '—';
}

export function slotWhen(slot: Pick<Slot, 'day' | 'start' | 'end'>): string {
  return slot.start ? `${dayShort(slot.day)} ${fmtRange(slot.start, slot.end)}` : 'TBA';
}

export function levelLabel(level: number | null): string {
  return level == null ? '—' : String(level);
}

// One stable color per venue, used by the timeline, agenda and map.
export const VENUE_COLORS: Record<VenueId, string> = {
  venetian: '#6366f1',
  wynn: '#d97706',
  'caesars-forum': '#0891b2',
  'caesars-palace': '#db2777',
  mgm: '#16a34a',
};

// Compact session-type marks for the timeline, hands-on formats first.
export const TYPE_ABBR: Record<string, string> = {
  Workshop: 'WS',
  "Builders' session": 'BS',
  Lab: 'LAB',
  Bootcamp: 'BC',
  'Gamified learning': 'GL',
  'Code talk': 'CODE',
  'Chalk talk': 'CT',
  'Breakout session': 'BO',
  'Lightning talk': 'LT',
  'Exam prep': 'EP',
};

export function typeAbbr(type: string): string {
  return TYPE_ABBR[type] ?? type.split(/\s+/).map((word) => word.charAt(0).toUpperCase()).join('');
}

export function isHandsOn(type: string): boolean {
  return HANDS_ON_TYPES.has(type);
}
