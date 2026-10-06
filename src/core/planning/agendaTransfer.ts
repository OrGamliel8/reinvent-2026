// Agenda-only export/import: resolves exported items against the current catalog and merges personal blocks.
import type { CatalogRepository } from '../catalog/catalogRepository';
import { AGENDA_KIND, type AgendaExport } from '../stateSchema';
import type { AgendaImportReport, AgendaItem, PersonalBlock, Slot } from '../types';
import { describeSlot, fingerprintOf, sameFingerprint } from './schedule';

export type ExportedItem = AgendaExport['items'][number];

export function buildAgendaExport({
  catalog,
  items,
  stars,
  manualScores,
  blocks,
}: {
  catalog: CatalogRepository;
  items: AgendaItem[];
  stars: string[];
  manualScores: Record<string, number>;
  blocks: PersonalBlock[];
}): AgendaExport {
  return {
    kind: AGENDA_KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    items: items.map((item) => {
      const slot = catalog.slot(item.slotId);
      const { start, end, venue, room } = slot ? fingerprintOf(slot) : item.fingerprint;
      return {
        sessionKey: item.sessionKey,
        code: slot?.code ?? item.code ?? item.sessionKey,
        title: catalog.session(item.sessionKey)?.title ?? item.title ?? '',
        slotId: item.slotId,
        start,
        end,
        venue,
        room,
        pinned: item.pinned,
        origin: item.origin,
        reservation: item.reservation,
      };
    }),
    starred: stars.map((key) => {
      const session = catalog.session(key);
      return { sessionKey: key, code: session?.code ?? key, title: session?.title ?? '' };
    }),
    scores: Object.entries(manualScores).map(([key, score]) => {
      const session = catalog.session(key);
      return { sessionKey: key, code: session?.code ?? key, title: session?.title ?? '', score };
    }),
    blocks,
  };
}

// `existing` is the current agenda in merge mode and empty in replace mode. Imported items win per session.
export function resolveAgendaImport({
  catalog,
  payload,
  existing,
  newId,
}: {
  catalog: CatalogRepository;
  payload: AgendaExport;
  existing: AgendaItem[];
  newId: () => string;
}): { items: AgendaItem[]; stars: string[]; scores: Record<string, number>; report: Omit<AgendaImportReport, 'blocks'> } {
  const report: Omit<AgendaImportReport, 'blocks'> = { added: 0, replaced: 0, movedToOtherSlot: [], skipped: [], starred: 0, scores: 0 };
  const byKey = new Map(existing.map((item) => [item.sessionKey, item]));
  const imported = new Map<string, AgendaItem>();

  for (const entry of payload.items) {
    const resolved = resolveSlot(catalog, entry);
    if (typeof resolved === 'string') {
      report.skipped.push({ code: entry.code, title: entry.title, reason: resolved });
      continue;
    }
    const { slot, moved } = resolved;
    const session = catalog.session(slot.sessionKey)!;
    if (moved) {
      report.movedToOtherSlot.push({ code: entry.code, title: session.title, from: `${entry.code}, ${describeSlot(entry)}`, to: `${slot.code}, ${describeSlot(slot)}` });
    }
    imported.set(session.key, {
      id: byKey.get(session.key)?.id ?? newId(),
      sessionKey: session.key,
      slotId: slot.slotId,
      origin: entry.origin,
      pinned: entry.pinned,
      // Fingerprint what the exporter saw, so change detection flags any difference with the current catalog.
      fingerprint: { start: entry.start, end: entry.end, venue: entry.venue, room: entry.room, exists: true },
      reservation: moved ? 'none' : entry.reservation, // a reservation belongs to the old slot
      title: session.title,
      code: session.code,
    });
  }
  for (const [key, item] of imported) {
    const before = byKey.get(key);
    if (!before) report.added++;
    else if (!sameItem(before, item)) report.replaced++;
  }

  const stars: string[] = [];
  for (const star of payload.starred) {
    if (catalog.session(star.sessionKey)) stars.push(star.sessionKey);
    else report.skipped.push({ code: star.code, title: star.title, reason: 'starred session not in catalog' });
  }
  report.starred = stars.length;

  const scores: Record<string, number> = {};
  for (const entry of payload.scores ?? []) {
    if (catalog.session(entry.sessionKey)) scores[entry.sessionKey] = entry.score;
    else report.skipped.push({ code: entry.code, title: entry.title, reason: 'scored session not in catalog' });
  }
  report.scores = Object.keys(scores).length;
  return { items: [...new Map([...byKey, ...imported]).values()], stars, scores, report };
}

function sameItem(a: AgendaItem, b: AgendaItem): boolean {
  return a.slotId === b.slotId && a.origin === b.origin && a.pinned === b.pinned && a.reservation === b.reservation && sameFingerprint(a.fingerprint, b.fingerprint);
}

// Same slot (by id, then short code); else the session's timed slot closest to the exported start; else a skip reason.
export function resolveSlot(catalog: CatalogRepository, entry: ExportedItem): { slot: Slot; moved: boolean } | string {
  const session = catalog.session(entry.sessionKey);
  const same = [catalog.slot(entry.slotId), session?.slots.find((s) => s.code === entry.code)].find((s) => s?.start);
  if (same) return { slot: same, moved: false };
  if (!session) return 'session not in catalog';
  const timed = session.slots.filter((s) => s.start);
  if (!timed.length) return 'session is TBA now';
  const target = entry.start ? Date.parse(entry.start) : 0;
  const distance = (s: Slot): number => Math.abs(Date.parse(s.start!) - target);
  return { slot: timed.reduce((best, s) => (distance(s) < distance(best) ? s : best)), moved: true };
}

// replace: personal blocks are swapped for the imported ones; keynote presets are updated by title.
// merge: blocks are added unless one with the same (title, day, start) exists; unscheduled keynote presets are filled in by title.
export function importBlocks({
  existing,
  imported,
  mode,
  newId,
}: {
  existing: PersonalBlock[];
  imported: PersonalBlock[];
  mode: 'replace' | 'merge';
  newId: () => string;
}): { put: PersonalBlock[]; remove: string[] } {
  const remove = mode === 'replace' ? existing.filter((b) => b.kind === 'personal').map((b) => b.id) : [];
  const kept = existing.filter((b) => !remove.includes(b.id));
  const put: PersonalBlock[] = [];
  for (const block of imported) {
    const duplicate = [...kept, ...put].some((b) => b.title === block.title && b.day === block.day && b.start === block.start);
    if (mode === 'merge' && duplicate) continue;
    const preset = kept.find((b) => b.kind === 'keynote' && block.kind === 'keynote' && b.title === block.title && (mode === 'replace' || b.day === null));
    put.push({ ...block, id: preset?.id ?? newId() });
  }
  return { put, remove };
}
