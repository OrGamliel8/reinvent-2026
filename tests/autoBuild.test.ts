import { describe, expect, it } from 'vitest';
import { add, codeOf, fixtureProfile, openPlanner } from './helpers';

describe('auto-build', () => {
  it('lands starred ANT319 in its Wednesday slot because Monday clashes with a pinned item', async () => {
    const { planner } = await openPlanner();
    const pinned = add(planner, 'SEC401');
    planner.setPinned(pinned, true);
    planner.star('ANT319');

    const { agenda, unplaced } = planner.autoBuild();
    expect(unplaced).toEqual([]);
    expect(agenda.find((i) => i.id === pinned)).toMatchObject({ pinned: true, sessionKey: 'SEC401' });
    expect(agenda.find((i) => i.sessionKey === 'ANT319')).toMatchObject({ origin: 'starred' });
    expect(codeOf(planner, 'ANT319')).toBe('ANT319-R1');
  });

  it('fills the rest with relevant suggestions, never avoided, TBA, lunch-time or out-of-hours sessions', async () => {
    const { planner } = await openPlanner();
    const { agenda } = planner.autoBuild();
    const keys = agenda.map((i) => i.sessionKey);
    expect(agenda.length).toBeGreaterThan(5);
    expect(agenda.every((i) => i.origin === 'suggested' && !i.pinned)).toBe(true);
    expect(keys).toContain('SEC401');
    expect(keys).not.toContain('BLK201'); // avoid list
    expect(keys).not.toContain('IAM333'); // TBA
    expect(keys).not.toContain('AIM210'); // during lunch
    expect(keys).not.toContain('OPS301'); // before Friday's 09:00 start
    expect(keys).not.toContain('STG201'); // irrelevant
    expect(planner.conflicts()).toEqual([]);
    expect(planner.agenda()).toEqual(agenda);
  });

  it('places starred sessions before suggestions', async () => {
    const { planner } = await openPlanner();
    planner.star('NET310'); // Tue 13:00, clashes with the higher-ranked SEC310 Tuesday slot
    const { agenda } = planner.autoBuild();
    expect(agenda.find((i) => i.sessionKey === 'NET310')).toMatchObject({ origin: 'starred' });
    expect(codeOf(planner, 'SEC310')).toBe('SEC310-R');
  });

  it('respects travel time and reports the starred session it could not fit', async () => {
    const { planner } = await openPlanner();
    planner.star('DEV320'); // Tue 09:00-10:00 MGM Grand
    planner.star('WPS330'); // Tue 10:15-11:15 Wynn/Encore: 15 min, needs 30
    const { agenda, unplaced } = planner.autoBuild();
    expect(unplaced).toHaveLength(1);
    expect(['DEV320', 'WPS330']).toContain(unplaced[0].sessionKey);
    expect(unplaced[0].reason).toMatch(/Only 15 min from .* \(needs 30\)/);
    expect(agenda.filter((i) => ['DEV320', 'WPS330'].includes(i.sessionKey))).toHaveLength(1);
  });

  it('prefers the slot that adds the least travel', async () => {
    const { planner } = await openPlanner();
    planner.setPinned(add(planner, 'WPS330'), true); // Tue at Wynn/Encore
    planner.setPinned(add(planner, 'SEC320'), true); // Thu 13:00 at Caesars Forum
    planner.star('SEC310'); // Tue 13:00 MGM Grand (30 min away) or Thu 11:00 Caesars Forum (0 min)
    planner.autoBuild();
    expect(codeOf(planner, 'SEC310')).toBe('SEC310-R');
  });

  it('respects availability, lunch and the daily maximum', async () => {
    const { planner } = await openPlanner();
    planner.updateProfile({ ...fixtureProfile(), availability: { ...fixtureProfile().availability, maxPerDay: 2 } });
    for (const key of ['OPS301', 'AIM210', 'SEC320', 'SEC330', 'SEC340']) planner.star(key);
    const { agenda, unplaced } = planner.autoBuild();
    const reasons = Object.fromEntries(unplaced.map((u) => [u.sessionKey, u.reason]));
    expect(reasons.OPS301).toMatch(/Outside your hours/);
    expect(reasons.AIM210).toMatch(/lunch/);
    const thursday = ['SEC320', 'SEC330', 'SEC340'];
    expect(agenda.filter((i) => thursday.includes(i.sessionKey))).toHaveLength(2);
    expect(unplaced.filter((u) => thursday.includes(u.sessionKey))).toHaveLength(1);
    expect(unplaced.find((u) => thursday.includes(u.sessionKey))!.reason).toMatch(/More than 2 sessions/);
    for (const day of ['mon', 'tue', 'wed', 'thu', 'fri']) {
      const count = agenda.filter((i) => planner.session(i.sessionKey)!.slots.find((s) => s.slotId === i.slotId)!.day === day).length;
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('works around personal blocks', async () => {
    const { planner } = await openPlanner();
    planner.createBlock({ title: 'Customer meeting', kind: 'personal', day: 'tue', start: '12:30', end: '14:00', venue: null, enabled: true });
    planner.star('SEC310');
    planner.autoBuild();
    expect(codeOf(planner, 'SEC310')).toBe('SEC310-R');
  });

  it('swap pass: moves a placed pick to its other slot to make room for a starred session', async () => {
    const { planner } = await openPlanner();
    const manual = add(planner, 'CMP301'); // Wed 10:00, repeats Fri 10:00
    planner.star('SEC350'); // only slot: Wed 10:00-12:00
    const { agenda, unplaced } = planner.autoBuild();
    expect(unplaced).toEqual([]);
    expect(codeOf(planner, 'SEC350')).toBe('SEC350');
    expect(codeOf(planner, 'CMP301')).toBe('CMP301-R');
    expect(agenda.find((i) => i.sessionKey === 'CMP301')).toMatchObject({ id: manual, origin: 'manual' });
  });

  it('skips TBA sessions and reports them', async () => {
    const { planner } = await openPlanner();
    planner.star('IAM333');
    const { agenda, unplaced } = planner.autoBuild();
    expect(agenda.map((i) => i.sessionKey)).not.toContain('IAM333');
    expect(unplaced).toEqual([{ sessionKey: 'IAM333', title: 'Zero trust identity for AI agents', reason: 'No time scheduled yet (TBA)' }]);
  });

  it('re-run keeps pinned items, keeps your picks (maybe in another slot) and replaces suggestions', async () => {
    const { planner } = await openPlanner();
    const pinned = add(planner, 'SEC401');
    planner.setPinned(pinned, true);
    const manual = add(planner, 'CMP301');
    planner.setReservationStatus(pinned, 'reserved');
    const first = planner.autoBuild();
    const suggested = first.agenda.filter((i) => i.origin === 'suggested').map((i) => i.sessionKey);
    expect(suggested).toContain('SEC310');

    // SEC310 becomes avoided, and SEC350 (Wed 10:00, clashing with CMP301) gets starred.
    planner.updateProfile({ ...fixtureProfile(), avoid: { keywords: ['blockchain', 'prompt injection'], topics: [], services: [] } });
    planner.star('SEC350');
    const second = planner.autoBuild();
    expect(second.agenda.find((i) => i.id === pinned)).toMatchObject({ pinned: true, reservation: 'reserved', slotId: first.agenda.find((i) => i.id === pinned)!.slotId });
    expect(second.agenda.find((i) => i.id === manual)).toMatchObject({ sessionKey: 'CMP301', origin: 'manual' });
    expect(codeOf(planner, 'CMP301')).toBe('CMP301-R');
    expect(second.agenda.map((i) => i.sessionKey)).not.toContain('SEC310');
    expect(second.agenda.find((i) => i.sessionKey === 'SEC350')).toMatchObject({ origin: 'starred' });

    // Deterministic: a third run with nothing changed gives the same plan.
    const third = planner.autoBuild();
    expect(third.agenda.map((i) => [i.sessionKey, i.slotId])).toEqual(second.agenda.map((i) => [i.sessionKey, i.slotId]));
  });

  it('only schedules pinned and starred sessions without a profile', async () => {
    const { planner } = await openPlanner({ profile: null });
    planner.star('ANT319');
    const { agenda } = planner.autoBuild();
    expect(agenda.map((i) => i.sessionKey)).toEqual(['ANT319']);
  });
});
