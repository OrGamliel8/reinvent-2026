import { describe, expect, it } from 'vitest';
import type { Planner } from '../src/core/planner';
import { add, codeOf, openPlanner } from './helpers';

const setMax = (planner: Planner, max: number): void => planner.updateSettings({ ...planner.settings(), maxVenueSwitchesPerDay: max });
const summary = (planner: Planner, day: string) => planner.daySummaries().find((d) => d.day === day)!;

describe('venue switches per day', () => {
  it('auto-build never hops venues more than once a day by default', async () => {
    // Thu: pinned ANT319 at MGM 09:00 and starred GAM201 at Caesars Palace 13:00; SEC340 (Caesars Forum 16:00) would be a 2nd hop.
    const setup = async (max: number): Promise<Planner> => {
      const { planner } = await openPlanner();
      setMax(planner, max);
      planner.setPinned(add(planner, 'ANT319-R2'), true);
      planner.star('GAM201');
      planner.autoBuild();
      return planner;
    };

    const unlimited = await setup(5);
    expect(summary(unlimited, 'thu')).toMatchObject({ switches: 2, route: ['mgm', 'caesars-palace', 'caesars-forum'] });

    const planner = await setup(1);
    expect(planner.daySummaries().every((d) => d.switches <= 1 && d.maxSwitches === 1)).toBe(true);
    expect(summary(planner, 'thu').route).toEqual(['mgm', 'caesars-palace']);
    expect(codeOf(planner, 'GAM201')).toBe('GAM201');
    expect(planner.conflicts()).toEqual([]);
  });

  it('max 0 keeps each day in a single venue', async () => {
    const { planner } = await openPlanner();
    setMax(planner, 0);
    const { agenda } = planner.autoBuild();
    expect(agenda.length).toBeGreaterThan(3);
    for (const day of planner.daySummaries()) expect(day.route.length).toBeLessThanOrEqual(1);
  });

  it('reports a starred session that would add a 2nd switch', async () => {
    const { planner } = await openPlanner();
    planner.setPinned(add(planner, 'ANT319-R2'), true); // Thu 09:00 MGM Grand
    planner.setPinned(add(planner, 'SEC340'), true); // Thu 16:00 Caesars Forum
    planner.star('GAM201'); // only slot: Thu 13:00 Caesars Palace
    const { unplaced } = planner.autoBuild();
    expect(unplaced).toEqual([{ sessionKey: 'GAM201', title: expect.any(String), reason: expect.stringContaining('would add a 2nd venue switch on Thu (max 1)') }]);
  });

  it('flags pinned items over the limit as a venueSwitches conflict with alternatives at a neighbouring venue', async () => {
    const { planner } = await openPlanner();
    for (const code of ['ANT319-R2', 'SEC310-R', 'GAM201']) planner.setPinned(add(planner, code), true); // Thu MGM -> Forum -> Palace
    const gam = planner.agenda().find((i) => i.sessionKey === 'GAM201')!;
    const sec = planner.agenda().find((i) => i.sessionKey === 'SEC310')!;

    const conflicts = planner.conflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ itemId: gam.id, kind: 'venueSwitches', withId: sec.id });
    expect(conflicts[0].message).toBe('2 venue switches on Thu (max 1): MGM Grand → Caesars Forum → Caesars Palace');
    expect(conflicts[0].alternatives.length).toBeGreaterThan(0);
    expect(conflicts[0].alternatives[0]).toMatchObject({ venue: 'caesars-forum', fit: 'free' });
    expect(summary(planner, 'thu')).toMatchObject({ sessions: 3, switches: 2, maxSwitches: 1 });

    // Pinned items stay put on re-run, and nothing new adds a hop to that day.
    planner.autoBuild();
    expect(planner.agenda().filter((i) => i.pinned)).toHaveLength(3);
    expect(summary(planner, 'thu').switches).toBe(2);
  });

  it('counts personal blocks that have a venue', async () => {
    const { planner } = await openPlanner();
    add(planner, 'WPS330'); // Tue 10:15 Wynn/Encore
    planner.createBlock({ title: 'Lunch with team', kind: 'personal', day: 'tue', start: '12:00', end: '13:00', venue: 'venetian', enabled: true });
    planner.createBlock({ title: 'Somewhere', kind: 'personal', day: 'tue', start: '14:00', end: '14:30', venue: null, enabled: true });
    expect(summary(planner, 'tue')).toMatchObject({ sessions: 1, switches: 1, route: ['wynn', 'venetian'] });
  });

  it('defaults to 1, validates 0..5 and accepts state exported before the setting existed', async () => {
    const { planner } = await openPlanner();
    expect(planner.settings().maxVenueSwitchesPerDay).toBe(1);
    expect(() => setMax(planner, 6)).toThrow();
    expect(() => setMax(planner, -1)).toThrow();
    setMax(planner, 0);

    const state = JSON.parse(planner.exportState());
    delete state.settings.maxVenueSwitchesPerDay;
    const { planner: fresh } = await openPlanner({ profile: null });
    expect(fresh.importState(JSON.stringify(state))).toEqual({ ok: true, value: null });
    expect(fresh.settings().maxVenueSwitchesPerDay).toBe(1);
  });
});
