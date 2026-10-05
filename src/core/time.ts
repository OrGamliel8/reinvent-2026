// Time helpers shared by the core and the UI. Everything is stored in UTC and shown in Las Vegas local time.
import { DAYS, type DayId } from './types';

export const LV_TIME_ZONE = 'America/Los_Angeles';

const lvFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LV_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface LvParts {
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
}

export function lvParts(isoUtc: string | number): LvParts {
  const parts: Record<string, string> = {};
  for (const part of lvFormatter.formatToParts(new Date(isoUtc))) parts[part.type] = part.value;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

// "HH:MM" in Las Vegas local time.
export function lvTime(isoUtc: string): string {
  return lvParts(isoUtc).time;
}

export function lvDay(isoUtc: string): DayId | null {
  return dayFromDate(lvParts(isoUtc).date);
}

export function dayFromDate(date: string): DayId | null {
  return DAYS.find((day) => day.date === date)?.id ?? null;
}

export function dateOfDay(day: DayId): string {
  const found = DAYS.find((d) => d.id === day);
  if (!found) throw new Error(`Unknown day: ${day}`);
  return found.date;
}

export function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

// Converts a Las Vegas local day + "HH:MM" to an ISO UTC string (DST-aware via Intl).
export function lvToUtc(day: DayId, hhmm: string): string {
  const [year, month, date] = dateOfDay(day).split('-').map(Number);
  const wanted = Date.UTC(year, month - 1, date) + toMinutes(hhmm) * 60_000;
  let guess = wanted + 8 * 3_600_000; // PST is UTC-8 during the event
  for (let i = 0; i < 2; i++) {
    const actual = lvParts(guess);
    const [y, m, d] = actual.date.split('-').map(Number);
    const actualAsUtc = Date.UTC(y, m - 1, d) + toMinutes(actual.time) * 60_000;
    guess += wanted - actualAsUtc;
  }
  return new Date(guess).toISOString();
}
