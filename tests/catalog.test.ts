import { describe, expect, it } from 'vitest';
import { lvTime } from '../src/core/time';
import { openPlanner } from './helpers';

describe('catalog through the planner', () => {
  it('groups repeats into one session, following asymmetric repeat links', async () => {
    const { planner } = await openPlanner();
    const session = planner.session('ANT319')!;
    expect(session.code).toBe('ANT319');
    expect(session.slots.map((s) => s.code)).toEqual(['ANT319-R', 'ANT319-R1', 'ANT319-R2']);
    expect(session.slots.map((s) => s.day)).toEqual(['mon', 'wed', 'thu']);
    expect(session.slots.map((s) => s.venue)).toEqual(['wynn', 'wynn', 'mgm']);
  });

  it('falls back to the base code when entries have no repeat links', async () => {
    const { planner } = await openPlanner();
    expect(planner.session('CMP301')!.slots.map((s) => s.code)).toEqual(['CMP301', 'CMP301-R']);
    expect(planner.session('CMP301-R')).toBeNull();
  });

  it('keeps TBA sessions findable, with a slot that has no time', async () => {
    const { planner } = await openPlanner();
    const session = planner.session('IAM333')!;
    expect(session.tba).toBe(true);
    expect(session.slots).toHaveLength(1);
    expect(session.slots[0]).toMatchObject({ start: null, end: null, day: null, venue: null, seats: null });
    expect(planner.rank({ tbaOnly: true }).map((r) => r.session.key)).toEqual(['IAM333']);
  });

  it('normalizes slots: UTC times, Las Vegas day, venue ids, rooms and seats', async () => {
    const { planner } = await openPlanner();
    const slot = planner.session('SEC401')!.slots[0];
    expect(slot).toMatchObject({ start: '2026-11-30T18:00:00.000Z', end: '2026-11-30T20:00:00.000Z', day: 'mon', venue: 'venetian', room: 'Level 3 | Lido 3001', seats: 50 });
    expect(lvTime(slot.start!)).toBe('10:00');
    // 15:00 Wednesday in Las Vegas is already Thursday in UTC; the day stays Wednesday.
    expect(planner.session('ANT319')!.slots[1]).toMatchObject({ start: '2026-12-02T23:00:00.000Z', day: 'wed' });
  });

  it('exposes meta and the tag vocabulary', async () => {
    const { planner } = await openPlanner();
    expect(planner.meta()).toEqual({ sourceUrl: 'https://example.test/catalog', fetchedAt: '2026-10-05T12:00:00.000Z', etag: 'etag-1', sessionCount: 20, slotCount: 24 });
    const vocabulary = planner.vocabulary();
    expect(vocabulary.venues).toHaveLength(5);
    expect(vocabulary.topics).toContain('Security & Identity');
    expect(vocabulary.services).toContain('Amazon GuardDuty');
    expect(vocabulary.types).toContain("Builders' session");
    expect(vocabulary.levels).toEqual([100, 200, 300, 400]);
    expect(vocabulary.features).toContain('Hands-on');
  });

  it('merges speakers and tags across the group', async () => {
    const { planner } = await openPlanner();
    const session = planner.session('SEC401')!;
    expect(session.speakers).toEqual([
      { name: 'Marcus Lee', company: 'AWS' },
      { name: 'Dana Ortiz', company: 'Acme Corp' },
    ]);
    expect(session.topics).toEqual(['Security & Identity', 'Artificial Intelligence']);
    expect(session.level).toBe(400);
    expect(planner.session('GAM201')!.level).toBeNull();
  });
});
