import { describe, expect, it } from 'vitest';
import { add, openPlanner } from './helpers';

describe('state export/import', () => {
  it('round-trips the whole planner state into a fresh store', async () => {
    const { planner } = await openPlanner();
    const item = add(planner, 'SEC401');
    planner.setPinned(item, true);
    planner.setReservationStatus(item, 'waitlisted');
    add(planner, 'ANT319-R1');
    planner.star('IAM333');
    planner.createBlock({ title: 'Expo hall', kind: 'personal', day: 'wed', start: '13:00', end: '14:00', venue: 'venetian', enabled: true });
    planner.setTravel('venetian', 'wynn', 12);
    planner.updateSettings({ ...planner.settings(), theme: 'dark', weights: { text: 2, tags: 1, level: 0.5, format: 0 } });

    const exported = planner.exportState();
    const { planner: fresh } = await openPlanner({ profile: null });
    expect(fresh.importState(exported)).toEqual({ ok: true, value: null });

    expect(fresh.getProfile()).toEqual(planner.getProfile());
    expect(fresh.agenda()).toEqual(planner.agenda());
    expect(fresh.starred()).toEqual(['IAM333']);
    expect(fresh.personalBlocks()).toEqual(planner.personalBlocks());
    expect(fresh.travelTable()['venetian|wynn']).toBe(12);
    expect(fresh.settings()).toEqual(planner.settings());
    expect(fresh.rank({}).map((r) => [r.session.key, r.score])).toEqual(planner.rank({}).map((r) => [r.session.key, r.score]));
    const strip = (json: string): unknown => ({ ...JSON.parse(json), exportedAt: null });
    expect(strip(fresh.exportState())).toEqual(strip(exported));
  });

  it('rejects invalid state with field paths and leaves the store untouched', async () => {
    const { planner } = await openPlanner();
    add(planner, 'SEC401');
    const state = JSON.parse(planner.exportState());
    state.items[0].origin = 'magic';
    const result = planner.importState(JSON.stringify(state));
    expect(result).toMatchObject({ ok: false, errors: [{ path: 'items[0].origin' }] });
    expect(planner.importState('[]')).toMatchObject({ ok: false });
    expect(planner.agenda()).toHaveLength(1);
  });
});
