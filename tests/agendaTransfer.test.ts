import { describe, expect, it } from 'vitest';
import type { Planner } from '../src/core/planner';
import { add, codeOf, openPlanner } from './helpers';

const stripIds = <T extends { id: string }>(list: T[]): Omit<T, 'id'>[] => list.map(({ id: _id, ...rest }) => rest);
const replace = { mode: 'replace', includeBlocks: true } as const;
const merge = { mode: 'merge', includeBlocks: true } as const;

async function plannedAgenda(): Promise<Planner> {
  const { planner } = await openPlanner();
  const sec401 = add(planner, 'SEC401');
  planner.setPinned(sec401, true);
  planner.setReservationStatus(sec401, 'reserved');
  add(planner, 'ANT319-R1');
  add(planner, 'CMP301');
  planner.star('IAM333');
  planner.star('SEC360');
  planner.createBlock({ title: 'Expo hall', kind: 'personal', day: 'wed', start: '13:00', end: '14:00', venue: 'venetian', enabled: true });
  const ceo = planner.personalBlocks().find((b) => b.title === 'CEO keynote')!;
  planner.updateBlock({ ...ceo, day: 'tue', start: '08:00', end: '10:00', venue: 'venetian', enabled: true });
  return planner;
}

describe('agenda export/import', () => {
  it('round-trips agenda, stars, pins, reservations and blocks into a fresh planner', async () => {
    const planner = await plannedAgenda();
    const exported = planner.exportAgenda();
    expect(JSON.parse(exported)).toMatchObject({ kind: 'reinvent-planner-agenda', version: 1, starred: [{ sessionKey: 'IAM333' }, { sessionKey: 'SEC360' }] });
    expect(JSON.parse(exported).items[0]).toMatchObject({ code: 'SEC401', pinned: true, reservation: 'reserved', venue: 'venetian' });

    const { planner: fresh } = await openPlanner({ profile: null });
    const result = fresh.importAgenda(exported, replace);
    expect(result).toEqual({ ok: true, value: { added: 3, replaced: 0, movedToOtherSlot: [], skipped: [], starred: 2, blocks: 6 } });
    expect(stripIds(fresh.agenda())).toEqual(stripIds(planner.agenda()));
    expect(fresh.starred().sort()).toEqual(['IAM333', 'SEC360']);
    const byTitle = (p: Planner) => stripIds(p.personalBlocks()).sort((a, b) => a.title.localeCompare(b.title));
    expect(byTitle(fresh)).toEqual(byTitle(planner));
    expect(fresh.personalBlocks()).toHaveLength(6); // keynote presets updated in place, not duplicated
    expect(fresh.detectChanges()).toEqual([]);
    expect(fresh.getProfile()).toBeNull();
  });

  it('merge keeps other items and lets the imported item win; replace clears first', async () => {
    const planner = await plannedAgenda();
    const exported = planner.exportAgenda();

    const { planner: other } = await openPlanner();
    add(other, 'DEV320');
    add(other, 'ANT319-R2'); // same session as the exported ANT319-R1
    other.star('NET310');
    other.createBlock({ title: 'Expo hall', kind: 'personal', day: 'wed', start: '13:00', end: '14:00', venue: 'venetian', enabled: true });
    const profile = other.getProfile();
    const settings = other.settings();

    const merged = other.importAgenda(exported, merge);
    expect(merged).toMatchObject({ ok: true, value: { added: 2, replaced: 1, starred: 2, blocks: 1 } }); // only the CEO keynote; Expo hall exists
    expect(other.agenda().map((i) => i.sessionKey).sort()).toEqual(['ANT319', 'CMP301', 'DEV320', 'SEC401']);
    expect(codeOf(other, 'ANT319')).toBe('ANT319-R1');
    expect(other.starred().sort()).toEqual(['IAM333', 'NET310', 'SEC360']);
    expect(other.personalBlocks().filter((b) => b.title === 'Expo hall')).toHaveLength(1);
    expect(other.getProfile()).toEqual(profile);
    expect(other.settings()).toEqual(settings);
    expect(other.importAgenda(exported, merge)).toMatchObject({ ok: true, value: { added: 0, replaced: 0, blocks: 0 } }); // identical items are not "replaced"

    const replaced = other.importAgenda(exported, { mode: 'replace', includeBlocks: false });
    expect(replaced).toMatchObject({ ok: true, value: { added: 3, replaced: 0, blocks: 0 } });
    expect(other.agenda().map((i) => i.sessionKey).sort()).toEqual(['ANT319', 'CMP301', 'SEC401']);
    expect(other.starred().sort()).toEqual(['IAM333', 'SEC360']);
  });

  it('skips unknown sessions and unknown stars with a reason, and matches by short code', async () => {
    const planner = await plannedAgenda();
    const payload = JSON.parse(planner.exportAgenda());
    payload.items.push({ ...payload.items[0], sessionKey: 'XYZ999', code: 'XYZ999', title: 'Gone', slotId: 'e-xyz999' });
    payload.items[1].slotId = 'renumbered-id'; // ANT319-R1, still findable by its short code
    payload.starred.push({ sessionKey: 'ABC123', code: 'ABC123', title: 'Unknown star' });

    const { planner: fresh } = await openPlanner();
    const result = fresh.importAgenda(JSON.stringify(payload), merge);
    expect(result).toMatchObject({
      ok: true,
      value: {
        added: 3,
        movedToOtherSlot: [],
        skipped: [
          { code: 'XYZ999', title: 'Gone', reason: 'session not in catalog' },
          { code: 'ABC123', reason: 'starred session not in catalog' },
        ],
      },
    });
    expect(codeOf(fresh, 'ANT319')).toBe('ANT319-R1');
  });

  it('imports a v1 export into a v2 catalog: other slots for cancelled ones, moved alerts for changed ones', async () => {
    const { planner: v1 } = await openPlanner();
    add(v1, 'ANT319-R1'); // v2: Wed 15:00 -> 16:30
    const secR = add(v1, 'SEC310-R'); // v2: slot cancelled, SEC310 remains
    v1.setReservationStatus(secR, 'reserved');
    add(v1, 'AIM350'); // v2: session removed
    add(v1, 'SEC401'); // unchanged
    const exported = v1.exportAgenda();

    const { planner: v2 } = await openPlanner({ fixture: 'catalog-v2.json' });
    const result = v2.importAgenda(exported, replace);
    expect(result).toMatchObject({
      ok: true,
      value: {
        added: 3,
        movedToOtherSlot: [{ code: 'SEC310-R', from: expect.stringMatching(/^SEC310-R, Thu Dec 3 11:00–/), to: expect.stringMatching(/^SEC310, Tue Dec 1 13:00–/) }],
        skipped: [{ code: 'AIM350', reason: 'session not in catalog' }],
      },
    });
    expect(codeOf(v2, 'SEC310')).toBe('SEC310');
    expect(v2.agenda().find((i) => i.sessionKey === 'SEC310')!.reservation).toBe('none');

    const alerts = v2.detectChanges().map((a) => [a.kind, a.sessionKey]);
    expect(alerts).toContainEqual(['moved', 'ANT319']);
    expect(alerts).toContainEqual(['moved', 'SEC310']);
    expect(alerts.filter(([, key]) => key === 'SEC401')).toEqual([]);
  });

  it('skips a session that is TBA in the current catalog', async () => {
    const { planner: v2 } = await openPlanner({ fixture: 'catalog-v2.json' });
    add(v2, 'IAM333'); // TBA in v1
    const { planner: v1 } = await openPlanner();
    expect(v1.importAgenda(v2.exportAgenda(), merge)).toMatchObject({ ok: true, value: { added: 0, skipped: [{ code: 'IAM333', reason: 'session is TBA now' }] } });
  });

  it('rejects invalid JSON and shapes with field paths, leaving everything untouched', async () => {
    const planner = await plannedAgenda();
    const payload = JSON.parse(planner.exportAgenda());
    payload.items[0].origin = 'magic';
    payload.blocks[0].start = '25:00';
    const result = planner.importAgenda(JSON.stringify(payload), replace);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['items[0].origin', 'blocks[0].start']));
    expect(planner.importAgenda('{ nope', replace)).toMatchObject({ ok: false });
    expect(planner.importAgenda(planner.exportState(), replace)).toMatchObject({ ok: false, errors: expect.arrayContaining([{ path: 'kind', message: expect.any(String) }]) });
    expect(planner.agenda()).toHaveLength(3);
  });
});
