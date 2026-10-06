// Pure helpers for the Explore timeline: which slots of the filtered sessions land on the grid, and where.
import { VENUES, type DayId, type Filters, type RankedSession, type Slot, type VenueId } from '@/core/types';
import { lvMinutes } from '../format';
import { packRows } from '../views/timelineLayout';

export const DAY_START = 8 * 60;
export const DAY_END = 20 * 60;

export interface Block {
  key: string;
  slotId: string;
  code: string;
  title: string;
  type: string; // session type, e.g. "Workshop"
  start: string;
  end: string;
  startMin: number;
  endMin: number;
  venue: VenueId;
  relevance: number; // 0..1
  onAgenda: boolean;
  starred: boolean;
  row: number;
}

export interface Lane {
  venue: (typeof VENUES)[number];
  blocks: Block[];
  rows: number;
}

// The timeline always ranks by relevance, so "Top N" means the N most relevant sessions of that day.
export function timelineFilters(filters: Filters, day: DayId): Filters {
  return { ...filters, days: [day], sort: { by: 'score', dir: 'desc' }, limit: undefined };
}

// Only the slots the planner matched (day, venue, Las Vegas time window), so a session matched by one slot doesn't drag
// its other slots (other venue, other hour) onto the grid.
function slotShown(slot: Slot, r: RankedSession): slot is Slot & { start: string; end: string; venue: VenueId } {
  return !!(slot.start && slot.end && slot.venue) && r.matchingSlotIds.includes(slot.slotId);
}

// `ranked` must come from rank(timelineFilters(...)), so the matching slots are that day's.
export function buildLanes(ranked: RankedSession[], agendaSlots: Set<string>): Lane[] {
  const maxScore = ranked.reduce((m, r) => Math.max(m, r.score), 0) || 1;
  const blocks: Omit<Block, 'row'>[] = [];
  for (const r of ranked) {
    for (const slot of r.session.slots) {
      if (!slotShown(slot, r)) continue;
      blocks.push({
        key: r.session.key,
        slotId: slot.slotId,
        code: slot.code,
        title: r.session.title,
        type: r.session.type,
        start: slot.start,
        end: slot.end,
        startMin: Math.max(DAY_START, lvMinutes(slot.start)),
        endMin: Math.min(DAY_END, lvMinutes(slot.end)),
        venue: slot.venue,
        relevance: Math.max(0, r.score) / maxScore,
        onAgenda: agendaSlots.has(slot.slotId),
        starred: r.starred,
      });
    }
  }
  return VENUES.map((venue) => {
    const packed = packRows(blocks.filter((b) => b.venue === venue.id));
    return { venue, blocks: packed, rows: packed.reduce((m, b) => Math.max(m, b.row + 1), 1) };
  });
}
