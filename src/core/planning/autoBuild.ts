// Greedy, deterministic auto-build: pinned -> kept picks -> starred -> swap pass -> suggestions.
import type { CatalogRepository } from '../catalog/catalogRepository';
import { lvTime } from '../time';
import { DAYS, type AgendaItem, type AutoBuildResult, type ItemOrigin, type Session, type Slot } from '../types';
import type { ScoredSession } from './ranking';
import { addedTravel, findProblems, fingerprintOf, slotEvent, type PlanningContext, type Problem, type TimedEvent } from './schedule';

export interface AutoBuildInput {
  catalog: CatalogRepository;
  items: AgendaItem[];
  stars: string[];
  blocks: TimedEvent[];
  scores: Map<string, ScoredSession>;
  ctx: PlanningContext;
  newId: () => string;
}

interface Placement {
  item: AgendaItem;
  event: TimedEvent | null;
  movable: boolean;
}

const UNFIXABLE: Problem['kind'][] = ['availability', 'lunch', 'dailyMax'];

export function autoBuild({ catalog, items, stars, blocks, scores, ctx, newId }: AutoBuildInput): AutoBuildResult {
  const placements: Placement[] = [];
  const handled = new Set<string>();
  const unplaced: AutoBuildResult['unplaced'] = [];

  const events = (excludeId?: string): TimedEvent[] => [...blocks, ...placements.flatMap((p) => (p.event && p.item.id !== excludeId ? [p.event] : []))];
  const scoreOf = (key: string): number => scores.get(key)?.score ?? 0;
  const eventOf = (item: AgendaItem, slot: Slot): TimedEvent | null => slotEvent(slot, { id: item.id, title: catalog.session(item.sessionKey)?.title ?? item.sessionKey });
  const newItem = (session: Session, origin: ItemOrigin): AgendaItem => ({
    id: newId(),
    sessionKey: session.key,
    slotId: '',
    origin,
    pinned: false,
    fingerprint: fingerprintOf(null),
    reservation: 'none',
    title: session.title,
    code: session.code,
  });

  const bestSlot = (session: Session, itemId: string, preferSlotId?: string): Slot | null => {
    const others = events(itemId);
    const feasible = session.slots
      .map((slot) => ({ slot, event: slotEvent(slot, { id: itemId, title: session.title }) }))
      .filter((c): c is { slot: Slot; event: TimedEvent } => !!c.event && findProblems(c.event, others, ctx, 'place').length === 0);
    const preferred = feasible.find((c) => c.slot.slotId === preferSlotId);
    if (preferred) return preferred.slot;
    feasible.sort((a, b) => addedTravel(a.event, others, ctx) - addedTravel(b.event, others, ctx) || a.event.start - b.event.start);
    return feasible[0]?.slot ?? null;
  };

  const place = (item: AgendaItem, slot: Slot, movable: boolean): void => {
    const moved = item.slotId !== slot.slotId;
    const placed: AgendaItem = moved ? { ...item, slotId: slot.slotId, fingerprint: fingerprintOf(slot), reservation: 'none' } : item;
    placements.push({ item: placed, event: eventOf(placed, slot), movable });
  };

  const keepAsIs = (item: AgendaItem): void => {
    const slot = catalog.slot(item.slotId);
    placements.push({ item, event: slot ? eventOf(item, slot) : null, movable: false });
  };

  // 1. Pinned items never move.
  for (const item of items.filter((i) => i.pinned)) {
    keepAsIs(item);
    handled.add(item.sessionKey);
  }

  // 2. Your own picks keep their session; they stay in their slot when it is still feasible, else move to a feasible one.
  for (const item of items.filter((i) => !i.pinned && i.origin !== 'suggested').sort((a, b) => startOf(catalog, a) - startOf(catalog, b))) {
    if (handled.has(item.sessionKey)) continue;
    handled.add(item.sessionKey);
    const session = catalog.session(item.sessionKey);
    const slot = session ? bestSlot(session, item.id, item.slotId) : null;
    if (slot) place(item, slot, true);
    else keepAsIs(item);
  }

  // 3. Starred sessions: most constrained (fewest slots) first, then by score.
  const timedSlots = (s: Session): Slot[] => s.slots.filter((slot) => slot.start);
  const pending: { session: Session; item: AgendaItem }[] = [];
  const starredKeys = stars.filter((key) => !handled.has(key));
  for (const key of starredKeys.filter((k) => !catalog.session(k))) unplaced.push({ sessionKey: key, title: key, reason: 'No longer in the catalog' });
  const starred = starredKeys
    .map((key) => catalog.session(key))
    .filter((s): s is Session => !!s)
    .sort((a, b) => timedSlots(a).length - timedSlots(b).length || scoreOf(b.key) - scoreOf(a.key) || a.key.localeCompare(b.key));
  for (const session of starred) {
    handled.add(session.key);
    if (session.tba) {
      unplaced.push({ sessionKey: session.key, title: session.title, reason: 'No time scheduled yet (TBA)' });
      continue;
    }
    const item = newItem(session, 'starred');
    const slot = bestSlot(session, item.id);
    if (slot) place(item, slot, true);
    else pending.push({ session, item });
  }

  // 4. Swap pass: move already-placed picks to their other slots to make room for an unplaced star.
  const trySwap = (session: Session, item: AgendaItem): boolean => {
    for (const slot of timedSlots(session)) {
      const candidate = slotEvent(slot, { id: item.id, title: session.title })!;
      const problems = findProblems(candidate, events(), ctx, 'place');
      if (problems.some((p) => UNFIXABLE.includes(p.kind))) continue;
      const blockerIds = new Set(problems.map((p) => p.withId));
      const blockers = placements.filter((p) => blockerIds.has(p.item.id));
      if (blockers.length !== blockerIds.size || blockers.some((b) => !b.movable)) continue;

      const snapshot = [...placements];
      placements.splice(0, placements.length, ...placements.filter((p) => !blockers.includes(p)));
      place(item, slot, true);
      const moved = blockers.every((blocker) => {
        const blockerSession = catalog.session(blocker.item.sessionKey);
        const alternative = blockerSession ? bestSlot(blockerSession, blocker.item.id) : null;
        if (alternative) place(blocker.item, alternative, true);
        return !!alternative;
      });
      if (moved) return true;
      placements.splice(0, placements.length, ...snapshot);
    }
    return false;
  };
  for (const { session, item } of pending) {
    if (!trySwap(session, item)) unplaced.push({ sessionKey: session.key, title: session.title, reason: blockingReason(session, item.id) });
  }

  // 5. Fill with top-ranked relevant sessions, marked suggested. Re-suggesting the same slot keeps the old item.
  if (ctx.availability) {
    const availability = ctx.availability;
    const previous = new Map(items.filter((i) => i.origin === 'suggested' && !i.pinned).map((i) => [i.slotId, i]));
    const days = DAYS.map((d) => d.id).filter((d) => availability.days[d]);
    const dayFull = (): boolean => {
      const placed = events().filter((e) => e.kind === 'item');
      return days.every((day) => placed.filter((e) => e.day === day).length >= availability.maxPerDay);
    };
    const candidates = catalog
      .sessions()
      .filter((s) => !handled.has(s.key) && !s.tba && scores.get(s.key)?.relevant && !scores.get(s.key)?.explanation.avoided.length)
      .sort((a, b) => scoreOf(b.key) - scoreOf(a.key) || a.key.localeCompare(b.key));
    for (const session of candidates) {
      if (dayFull()) break;
      const reused = session.slots.map((s) => previous.get(s.slotId)).find((i) => i);
      const item = reused ?? newItem(session, 'suggested');
      const slot = bestSlot(session, item.id, reused?.slotId);
      if (slot) place(item, slot, true);
    }
  }

  return { agenda: placements.map((p) => p.item).sort((a, b) => startOf(catalog, a) - startOf(catalog, b)), unplaced };

  function blockingReason(session: Session, itemId: string): string {
    const others = events(itemId);
    return timedSlots(session)
      .map((slot) => {
        const problems = findProblems(slotEvent(slot, { id: itemId, title: session.title })!, others, ctx, 'place');
        const label = `${slot.code} ${DAYS.find((d) => d.id === slot.day)?.label ?? ''} ${lvTime(slot.start!)}`;
        return `${label}: ${problems.map((p) => p.message).join(', ') || 'no room'}`;
      })
      .join('; ');
  }
}

function startOf(catalog: CatalogRepository, item: AgendaItem): number {
  const start = catalog.slot(item.slotId)?.start ?? item.fingerprint.start;
  return start ? Date.parse(start) : Number.MAX_SAFE_INTEGER;
}
