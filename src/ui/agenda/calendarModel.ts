// Turns agenda items, personal blocks and the travel table into positioned calendar entries.
// Presentation only: no planning decisions are made here.
import type { AgendaItem, DayId, PersonalBlock, Session, Slot, TravelTable, VenueId } from '@/core/types';
import { hhmmToMinutes, lvMinutes } from '../format';
import { travelMinutes } from '@/core/defaults';
import { packRows } from '../views/timelineLayout';

interface EntryBase {
  id: string;
  day: DayId;
  startMin: number;
  endMin: number;
  venue: VenueId | null;
}

export interface SessionEntry extends EntryBase {
  type: 'session';
  item: AgendaItem;
  session: Session;
  slot: Slot;
}

export interface BlockEntry extends EntryBase {
  type: 'block';
  block: PersonalBlock;
}

export interface TravelEntry extends EntryBase {
  type: 'travel';
  from: VenueId;
  to: VenueId;
  minutes: number;
  tight: boolean; // the gap between the two entries is shorter than the travel time
}

export type CalendarEntry = SessionEntry | BlockEntry | TravelEntry;
export type PlacedEntry = CalendarEntry & { column: number; columns: number };

export function buildEntries(items: AgendaItem[], sessions: Map<string, Session>, blocks: PersonalBlock[], travel: TravelTable): CalendarEntry[] {
  const entries: (SessionEntry | BlockEntry)[] = [];
  for (const item of items) {
    const session = sessions.get(item.sessionKey);
    const slot = session?.slots.find((s) => s.slotId === item.slotId);
    if (!session || !slot?.start || !slot.end || !slot.day) continue;
    entries.push({ type: 'session', id: item.id, day: slot.day, startMin: lvMinutes(slot.start), endMin: lvMinutes(slot.end), venue: slot.venue, item, session, slot });
  }
  for (const block of blocks) {
    if (!block.enabled || !block.day || !block.start || !block.end) continue;
    entries.push({ type: 'block', id: block.id, day: block.day, startMin: hhmmToMinutes(block.start), endMin: hhmmToMinutes(block.end), venue: block.venue, block });
  }
  return [...entries, ...travelGaps(entries, travel)];
}

function travelGaps(entries: (SessionEntry | BlockEntry)[], travel: TravelTable): TravelEntry[] {
  const gaps: TravelEntry[] = [];
  const located = entries.filter((e) => e.venue).sort((a, b) => a.day.localeCompare(b.day) || a.startMin - b.startMin);
  for (let i = 1; i < located.length; i++) {
    const prev = located[i - 1];
    const next = located[i];
    if (prev.day !== next.day || prev.venue === next.venue) continue;
    const minutes = travelMinutes(travel, prev.venue, next.venue);
    if (minutes <= 0) continue;
    gaps.push({
      type: 'travel',
      id: `travel-${prev.id}-${next.id}`,
      day: prev.day,
      startMin: prev.endMin,
      endMin: prev.endMin + minutes,
      venue: null,
      from: prev.venue!,
      to: next.venue!,
      minutes,
      tight: next.startMin - prev.endMin < minutes,
    });
  }
  return gaps;
}

// Side-by-side columns for overlapping session/block entries; travel gaps span the full width.
export function placeDay(entries: CalendarEntry[]): PlacedEntry[] {
  const solid = entries.filter((e) => e.type !== 'travel').sort((a, b) => a.startMin - b.startMin);
  const placed: PlacedEntry[] = [];
  let cluster: CalendarEntry[] = [];
  let clusterEnd = -1;
  const flush = (): void => {
    const packed = packRows(cluster);
    const columns = packed.reduce((m, e) => Math.max(m, e.row + 1), 1);
    for (const { row, ...e } of packed) placed.push({ ...(e as CalendarEntry), column: row, columns });
    cluster = [];
  };
  for (const e of solid) {
    if (cluster.length && e.startMin >= clusterEnd) flush();
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, e.endMin);
  }
  flush();
  for (const e of entries) if (e.type === 'travel') placed.push({ ...e, column: 0, columns: 1 });
  return placed;
}
