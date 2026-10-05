import { describe, expect, it } from 'vitest';
import { add, openPlanner, slotId } from './helpers';

describe('conflicts, slot fit and alternatives', () => {
  it('flags an MGM→Wynn hop with a 15-minute gap as travel too tight', async () => {
    const { planner } = await openPlanner();
    const dev = add(planner, 'DEV320'); // Tue 09:00-10:00 MGM Grand
    const wps = add(planner, 'WPS330'); // Tue 10:15-11:15 Wynn/Encore
    const conflicts = planner.conflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ itemId: wps, kind: 'travel', withId: dev });
    expect(conflicts[0].message).toMatch(/Only 15 min from MGM Grand to Wynn\/Encore .*needs 30/);
    expect(planner.slotFit(slotId(planner, 'WPS330'))).toBe('travel');
  });

  it('uses the editable, symmetric travel table', async () => {
    const { planner } = await openPlanner();
    expect(planner.travelTable()).toMatchObject({ 'mgm|wynn': 30, 'venetian|wynn': 10, 'caesars-forum|caesars-palace': 10, 'caesars-palace|wynn': 20 });
    add(planner, 'DEV320');
    add(planner, 'WPS330');
    planner.setTravel('wynn', 'mgm', 15);
    expect(planner.travelTable()['mgm|wynn']).toBe(15);
    expect(planner.conflicts()).toEqual([]);
    expect(() => planner.setTravel('mgm', 'mgm', 5)).toThrow();
  });

  it('reports overlaps with alternatives: another slot of the same session and the next-best session in that window', async () => {
    const { planner } = await openPlanner();
    const sec = add(planner, 'SEC310'); // Tue 13:00-14:00 MGM Grand
    const aim = add(planner, 'AIM350'); // Tue 13:30-14:30 Caesars Palace
    const conflicts = planner.conflicts().filter((c) => c.kind === 'overlap');
    expect(conflicts.map((c) => [c.itemId, c.withId])).toEqual([
      [sec, aim],
      [aim, sec],
    ]);
    const alternatives = conflicts[0].alternatives;
    expect(alternatives[0]).toMatchObject({ kind: 'otherSlot', code: 'SEC310-R', fit: 'free', sessionKey: 'SEC310' });
    expect(alternatives.filter((a) => a.kind === 'otherSession').map((a) => a.code)).toContain('NET310');
    expect(alternatives.map((a) => a.sessionKey)).not.toContain('AIM350'); // already on the agenda
  });

  it('flags lunch, availability and the daily maximum', async () => {
    const { planner } = await openPlanner();
    add(planner, 'AIM210'); // Wed 12:20
    add(planner, 'OPS301'); // Fri 08:00, before the 09:00 start
    const kinds = planner.conflicts().map((c) => c.kind).sort();
    expect(kinds).toEqual(['availability', 'lunch']);

    const profile = planner.getProfile()!;
    planner.updateProfile({ ...profile, availability: { ...profile.availability, maxPerDay: 1 } });
    add(planner, 'SEC320');
    const thu = add(planner, 'SEC330');
    expect(planner.conflicts().filter((c) => c.kind === 'dailyMax').map((c) => c.itemId)).toEqual([thu]);
  });

  it('checks personal blocks; keynote presets ship disabled with no times', async () => {
    const { planner } = await openPlanner();
    const presets = planner.personalBlocks();
    expect(presets.map((b) => b.title)).toEqual(['CEO keynote', 'AI keynote', 'Infrastructure keynote', 'Partner keynote', 'CTO keynote (Werner Vogels)']);
    expect(presets.every((b) => b.kind === 'keynote' && !b.enabled && b.day === null && b.start === null && b.end === null)).toBe(true);

    const item = add(planner, 'SEC401'); // Mon 10:00-12:00 Venetian
    expect(planner.conflicts()).toEqual([]);
    const keynote = { ...presets[0], day: 'mon' as const, start: '11:00', end: '12:30', venue: 'venetian' as const, enabled: true };
    planner.updateBlock(keynote);
    expect(planner.conflicts()).toMatchObject([{ itemId: item, kind: 'overlap', withId: keynote.id }]);
    planner.updateBlock({ ...keynote, enabled: false });
    expect(planner.conflicts()).toEqual([]);

    const meeting = planner.createBlock({ title: 'Lunch with team', kind: 'personal', day: 'mon', start: '09:00', end: '09:55', venue: 'mgm', enabled: true });
    expect(planner.conflicts()).toMatchObject([{ itemId: item, kind: 'travel', withId: meeting.id }]);
    planner.deleteBlock(meeting.id);
    expect(planner.personalBlocks()).toHaveLength(5);
    expect(() => planner.createBlock({ title: 'Bad', kind: 'personal', day: 'mon', start: '14:00', end: '13:00', venue: null, enabled: true })).toThrow(/end/);
  });

  it('reports the fit of every slot of a session', async () => {
    const { planner } = await openPlanner();
    add(planner, 'SEC401'); // Mon 10:00-12:00
    expect(planner.slotFit(slotId(planner, 'ANT319-R'))).toBe('conflict');
    expect(planner.slotFit(slotId(planner, 'ANT319-R1'))).toBe('free');
    expect(planner.slotFit(slotId(planner, 'IAM333'))).toBe('tba');
    expect(planner.slotFit(slotId(planner, 'OPS301'))).toBe('outside');
    expect(planner.slotFit(slotId(planner, 'SEC401'))).toBe('free'); // its own slot does not conflict with itself
  });

  it('keeps one agenda item per session: adding another slot moves it', async () => {
    const { planner } = await openPlanner();
    const first = planner.addSlot(slotId(planner, 'ANT319-R'));
    const moved = planner.addSlot(slotId(planner, 'ANT319-R2'));
    expect(moved.id).toBe(first.id);
    expect(planner.agenda()).toHaveLength(1);
    expect(planner.agenda()[0].fingerprint).toMatchObject({ venue: 'mgm', exists: true });
    expect(() => planner.addSlot(slotId(planner, 'IAM333'))).toThrow(/TBA/);
    planner.removeItem(first.id);
    expect(planner.agenda()).toEqual([]);
  });

  it('lists every other slot when asked by session', async () => {
    const { planner } = await openPlanner();
    const alternatives = planner.alternatives({ sessionKey: 'ANT319' });
    expect(alternatives.map((a) => a.code).sort()).toEqual(['ANT319-R', 'ANT319-R1', 'ANT319-R2']);
    expect(alternatives.every((a) => a.kind === 'otherSlot' && a.fit === 'free')).toBe(true);
  });
});
