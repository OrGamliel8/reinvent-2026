// Compare several people's plans side by side, resolved against the current catalog (like an agenda import).
import type { CatalogRepository } from '../catalog/catalogRepository';
import {
  DAYS,
  ME,
  type CompareCell,
  type CompareProfileSummary,
  type CompareResult,
  type CompareRow,
  type ComparePlacement,
  type CompareSession,
  type CompareSlotted,
  type Profile,
} from '../types';
import { resolveSlot, type ExportedItem } from './agendaTransfer';

const TOP_INTERESTS = 3;
const TOP_TOPICS = 5;

export interface ComparePlan {
  id: string;
  name: string;
  profile: Profile | null;
  items: ExportedItem[];
  starred: string[]; // session keys
}

// `mine` = sessions I starred or have on my agenda (for starredByOthers), whether or not I am one of the people.
export function buildCompare({ catalog, plans, mine }: { catalog: CatalogRepository; plans: ComparePlan[]; mine: Set<string> }): CompareResult {
  const placements: ComparePlacement[] = [];
  const people = plans.map((plan) => {
    const missing: { code: string; title: string }[] = [];
    let agendaCount = 0;
    for (const item of plan.items) {
      const resolved = resolveSlot(catalog, item);
      if (typeof resolved === 'string') {
        missing.push({ code: item.code, title: item.title });
        continue;
      }
      const { slot } = resolved;
      const session = catalog.session(slot.sessionKey)!;
      agendaCount++;
      placements.push({
        personId: plan.id,
        sessionKey: session.key,
        code: session.code,
        title: session.title,
        slotId: slot.slotId,
        slotCode: slot.code,
        day: slot.day!,
        start: slot.start!,
        end: slot.end!,
        venue: slot.venue,
      });
    }
    return { id: plan.id, name: plan.name, profileSummary: summarizeProfile(plan.profile), agendaCount, missing };
  });
  placements.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));

  const bySlot = groupBy(placements, (p) => p.slotId);
  const bySession = groupBy(placements, (p) => p.sessionKey);
  const days = DAYS.map(({ id }) => ({ day: id, rows: buildRows(placements.filter((p) => p.day === id), plans, bySlot) })).filter((d) => d.rows.length);

  const onlyOne: CompareResult['onlyOne'] = Object.fromEntries(plans.map((plan) => [plan.id, []]));
  for (const group of bySession.values()) {
    if (group.length === 1) onlyOne[group[0].personId].push(slotted(group[0]));
  }

  return {
    people,
    days,
    together: [...bySlot.values()]
      .filter((group) => group.length > 1)
      .map((group) => ({ ...slotted(group[0]), personIds: group.map((p) => p.personId) })),
    sameSessionDifferentSlot: [...bySession.values()]
      .filter((group) => new Set(group.map((p) => p.slotId)).size > 1)
      .map((group) => ({ ...sessionOf(group[0]), placements: group })),
    split: days.flatMap(({ rows }) =>
      rows
        .filter((row) => Object.values(row.cells).some((cell) => cell?.status === 'split'))
        .map((row) => ({
          start: row.start,
          end: row.end,
          entries: Object.entries(row.cells).flatMap(([personId, cell]) =>
            cell ? [{ personId, sessionKey: cell.sessionKey, slotId: cell.slotId, title: cell.title, venue: cell.venue }] : [],
          ),
        })),
    ),
    onlyOne,
    starredByOthers: othersPicks({ catalog, plans, placements, mine }),
  };
}

// Greedy rows over the day's placements (sorted by start): a placement joins the current row while it overlaps the row's span
// and its person has no cell there yet; otherwise it opens a new row. Keeps one cell per person per row.
function buildRows(placements: ComparePlacement[], plans: ComparePlan[], bySlot: Map<string, ComparePlacement[]>): CompareRow[] {
  const rows: { start: string; end: string; members: ComparePlacement[] }[] = [];
  for (const p of placements) {
    const row = rows.at(-1);
    if (row && Date.parse(p.start) < Date.parse(row.end) && !row.members.some((m) => m.personId === p.personId)) {
      row.members.push(p);
      if (p.end > row.end) row.end = p.end;
    } else {
      rows.push({ start: p.start, end: p.end, members: [p] });
    }
  }
  return rows.map(({ start, end, members }) => {
    const cells: Record<string, CompareCell | null> = Object.fromEntries(plans.map((plan) => [plan.id, null]));
    for (const m of members) {
      const together = bySlot.get(m.slotId)!.length > 1;
      const split = members.some((other) => other.sessionKey !== m.sessionKey);
      cells[m.personId] = { ...sessionOf(m), slotId: m.slotId, slotCode: m.slotCode, venue: m.venue, status: together ? 'together' : split ? 'split' : 'solo' };
    }
    return { start, end, cells };
  });
}

// Sessions the others put on their agenda or starred, that I have neither on my agenda nor starred.
function othersPicks({
  catalog,
  plans,
  placements,
  mine,
}: {
  catalog: CatalogRepository;
  plans: ComparePlan[];
  placements: ComparePlacement[];
  mine: Set<string>;
}): CompareResult['starredByOthers'] {
  const picks = new Map<string, { personIds: Set<string>; slotId: string | null }>();
  const pick = (sessionKey: string, personId: string, slotId: string | null): void => {
    if (mine.has(sessionKey)) return;
    const entry = picks.get(sessionKey) ?? { personIds: new Set<string>(), slotId: null };
    entry.personIds.add(personId);
    entry.slotId ??= slotId;
    picks.set(sessionKey, entry);
  };
  const others = plans.filter((plan) => plan.id !== ME);
  for (const p of placements) if (others.some((plan) => plan.id === p.personId)) pick(p.sessionKey, p.personId, p.slotId);
  for (const plan of others) for (const key of plan.starred) if (catalog.session(key)) pick(key, plan.id, null);

  return [...picks]
    .map(([sessionKey, { personIds, slotId }]) => {
      const session = catalog.session(sessionKey)!;
      return { sessionKey, code: session.code, title: session.title, personIds: [...personIds], slotId };
    })
    .sort((a, b) => b.personIds.length - a.personIds.length || a.code.localeCompare(b.code));
}

function summarizeProfile(profile: Profile | null): CompareProfileSummary {
  if (!profile) return { topInterests: [], topics: [], level: null, days: [] };
  const byWeight = <T>(list: T[], weight: (t: T) => number): T[] => [...list].sort((a, b) => weight(b) - weight(a));
  return {
    topInterests: byWeight(profile.interests, (i) => i.weight)
      .slice(0, TOP_INTERESTS)
      .map((i) => i.label),
    topics: byWeight(Object.entries(profile.topics), ([, w]) => w)
      .filter(([, w]) => w > 0)
      .slice(0, TOP_TOPICS)
      .map(([name]) => name),
    level: profile.level,
    days: DAYS.filter((d) => profile.availability.days[d.id]).map((d) => d.id),
  };
}

function slotted({ personId: _personId, ...rest }: ComparePlacement): CompareSlotted {
  return rest;
}

function sessionOf(p: ComparePlacement): CompareSession {
  return { sessionKey: p.sessionKey, code: p.code, title: p.title };
}

function groupBy<T>(list: T[], key: (t: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of list) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}
