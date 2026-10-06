// Feasibility rules shared by slotFit, conflicts, auto-build and change detection.
import { travelMinutes, venueName } from '../defaults';
import { lvDay, lvParts, lvToUtc, lvTime, toMinutes } from '../time';
import { DAYS, type ConflictKind, type DayId, type PersonalBlock, type Profile, type Slot, type SlotFingerprint, type SlotFit, type TravelTable, type VenueId } from '../types';

export interface TimedEvent {
  id: string; // agenda item id or personal block id
  kind: 'item' | 'block';
  sessionKey: string | null;
  title: string;
  start: number; // epoch ms
  end: number;
  day: DayId;
  venue: VenueId | null;
}

export interface PlanningContext {
  travel: TravelTable;
  availability: Profile['availability'] | null; // null = no profile, no availability limits
  maxVenueSwitches: number; // auto-build never lets a day go above this many venue changes
}

export interface Problem {
  kind: ConflictKind;
  withId: string | null;
  message: string;
}

// 'place': checking a candidate against a plan (travel both ways, daily max counts every other item).
// 'audit': checking an item already in the plan (travel from the previous event only, daily max flags only the excess items).
export type CheckMode = 'place' | 'audit';

export function slotEvent(slot: Slot, { id, title }: { id: string; title: string }): TimedEvent | null {
  if (!slot.start || !slot.end || !slot.day) return null;
  return { id, kind: 'item', sessionKey: slot.sessionKey, title, start: Date.parse(slot.start), end: Date.parse(slot.end), day: slot.day, venue: slot.venue };
}

export function blockEvent(block: PersonalBlock): TimedEvent | null {
  if (!block.enabled || !block.day || !block.start || !block.end) return null;
  return {
    id: block.id,
    kind: 'block',
    sessionKey: null,
    title: block.title,
    start: Date.parse(lvToUtc(block.day, block.start)),
    end: Date.parse(lvToUtc(block.day, block.end)),
    day: block.day,
    venue: block.venue,
  };
}

export function fingerprintOf(slot: Slot | null): SlotFingerprint {
  if (!slot) return { start: null, end: null, venue: null, room: null, exists: false };
  return { start: slot.start, end: slot.end, venue: slot.venue, room: slot.room, exists: true };
}

// "Wed Dec 2 15:00–16:00, Venetian, Room 1" (or "TBA").
export function describeSlot(fp: Pick<SlotFingerprint, 'start' | 'end' | 'venue' | 'room'>): string {
  if (!fp.start || !fp.end) return 'TBA';
  const day = DAYS.find((d) => d.id === lvDay(fp.start!))?.label ?? '';
  return `${day} ${lvTime(fp.start)}–${lvTime(fp.end)}, ${venueName(fp.venue)}${fp.room ? `, ${fp.room}` : ''}`;
}

export function sameFingerprint(a: SlotFingerprint, b: SlotFingerprint): boolean {
  return a.start === b.start && a.end === b.end && a.venue === b.venue && a.room === b.room && a.exists === b.exists;
}

export function fitOf(problems: Problem[]): SlotFit {
  if (problems.some((p) => p.kind === 'overlap')) return 'conflict';
  if (problems.some((p) => p.kind === 'travel')) return 'travel';
  return problems.length ? 'outside' : 'free';
}

const overlaps = (a: TimedEvent, b: { start: number; end: number }): boolean => a.start < b.end && b.start < a.end;
const dayLabel = (day: DayId): string => DAYS.find((d) => d.id === day)?.label ?? day;
const minutesBetween = (from: number, to: number): number => Math.round((to - from) / 60_000);

const localMinutesCache = new Map<number, number>();
function localMinutes(epoch: number): number {
  let minutes = localMinutesCache.get(epoch);
  if (minutes === undefined) {
    minutes = toMinutes(lvParts(epoch).time);
    localMinutesCache.set(epoch, minutes);
  }
  return minutes;
}

function lvMinutes(event: TimedEvent): { start: number; end: number } {
  const start = localMinutes(event.start);
  const end = localMinutes(event.end);
  return { start, end: end < start || event.end - event.start >= 86_400_000 ? 24 * 60 : end };
}

export function findProblems(candidate: TimedEvent, others: TimedEvent[], ctx: PlanningContext, mode: CheckMode): Problem[] {
  const problems: Problem[] = [];
  const sameDay = others.filter((o) => o.day === candidate.day && o.id !== candidate.id);

  if (candidate.kind === 'item' && ctx.availability) {
    const window = ctx.availability.days[candidate.day];
    const local = lvMinutes(candidate);
    if (!window) {
      problems.push({ kind: 'availability', withId: null, message: `You are not attending on ${dayLabel(candidate.day)}` });
    } else if (local.start < toMinutes(window.start) || local.end > toMinutes(window.end)) {
      problems.push({ kind: 'availability', withId: null, message: `Outside your hours on ${dayLabel(candidate.day)} (${window.start}–${window.end})` });
    }
    const lunch = ctx.availability.lunch;
    if (lunch && local.start < toMinutes(lunch.end) && toMinutes(lunch.start) < local.end) {
      problems.push({ kind: 'lunch', withId: null, message: `During your lunch break (${lunch.start}–${lunch.end})` });
    }
  }

  for (const other of sameDay) {
    if (overlaps(candidate, other)) problems.push({ kind: 'overlap', withId: other.id, message: `Overlaps "${other.title}"` });
  }

  const before = sameDay.filter((o) => o.venue && o.end <= candidate.start).sort((a, b) => b.end - a.end)[0];
  const after = sameDay.filter((o) => o.venue && o.start >= candidate.end).sort((a, b) => a.start - b.start)[0];
  if (before) checkTravel(before, candidate, ctx, problems, before.id);
  if (after && mode === 'place') checkTravel(candidate, after, ctx, problems, after.id);

  if (candidate.kind === 'item' && ctx.availability) {
    const max = ctx.availability.maxPerDay;
    const items = sameDay.filter((o) => o.kind === 'item' && (mode === 'place' || o.start < candidate.start || (o.start === candidate.start && o.id < candidate.id)));
    if (items.length >= max) problems.push({ kind: 'dailyMax', withId: null, message: `More than ${max} sessions on ${dayLabel(candidate.day)}` });
  }
  return problems;
}

function checkTravel(from: TimedEvent, to: TimedEvent, ctx: PlanningContext, problems: Problem[], withId: string): void {
  const needed = travelMinutes(ctx.travel, from.venue, to.venue);
  const gap = minutesBetween(from.end, to.start);
  if (gap < needed) {
    problems.push({
      kind: 'travel',
      withId,
      message: `Only ${gap} min from ${venueName(from.venue)} to ${venueName(to.venue)} between "${from.title}" and "${to.title}" (needs ${needed})`,
    });
  }
}

// Extra minutes of walking a candidate adds to its day, used to pick among feasible slots.
export function addedTravel(candidate: TimedEvent, others: TimedEvent[], ctx: PlanningContext): number {
  const sameDay = others.filter((o) => o.day === candidate.day && o.venue);
  const before = sameDay.filter((o) => o.end <= candidate.start).sort((a, b) => b.end - a.end)[0];
  const after = sameDay.filter((o) => o.start >= candidate.end).sort((a, b) => a.start - b.start)[0];
  const t = (a: TimedEvent | undefined, b: TimedEvent | undefined): number => (a && b ? travelMinutes(ctx.travel, a.venue, b.venue) : 0);
  return t(before, candidate) + t(candidate, after) - t(before, after);
}

// A day's events that have a venue, in time order.
export function dayRoute(events: TimedEvent[], day: DayId): TimedEvent[] {
  return events.filter((e) => e.day === day && e.venue).sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id));
}

// Consecutive pairs of a day's located events whose venues differ.
export function venueSwitches(events: TimedEvent[], day: DayId): [TimedEvent, TimedEvent][] {
  const route = dayRoute(events, day);
  return route.slice(1).flatMap((next, i) => (route[i].venue !== next.venue ? [[route[i], next] as [TimedEvent, TimedEvent]] : []));
}

// Venues in visiting order, consecutive repeats collapsed.
export function routeVenues(events: TimedEvent[], day: DayId): VenueId[] {
  const route = dayRoute(events, day);
  return route.filter((e, i) => i === 0 || e.venue !== route[i - 1].venue).map((e) => e.venue!);
}

// Why a candidate can't join the plan under the venue-switch limit, or null when it can.
// A day already over the limit (pinned items) may still take a candidate that adds no switch.
export function venueSwitchProblem(candidate: TimedEvent, others: TimedEvent[], ctx: PlanningContext): string | null {
  if (!candidate.venue) return null;
  const before = venueSwitches(others, candidate.day).length;
  const after = venueSwitches([...others, candidate], candidate.day).length;
  if (after <= ctx.maxVenueSwitches || after <= before) return null;
  return `would add a ${ordinal(after)} venue switch on ${dayLabel(candidate.day).slice(0, 3)} (max ${ctx.maxVenueSwitches})`;
}

export function addedSwitches(candidate: TimedEvent, others: TimedEvent[]): number {
  return venueSwitches([...others, candidate], candidate.day).length - venueSwitches(others, candidate.day).length;
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}
