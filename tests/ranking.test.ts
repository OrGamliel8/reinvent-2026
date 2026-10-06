import { describe, expect, it } from 'vitest';
import { firstMatchingSlot } from '../src/core/types';
import { add, fixtureProfile, openPlanner } from './helpers';

describe('ranking', () => {
  it('ranks sessions that match the profile first', async () => {
    const { planner } = await openPlanner();
    const ranked = planner.rank({});
    const keys = ranked.map((r) => r.session.key);
    expect(keys[0]).toBe('SEC401');
    expect(keys.indexOf('SEC310')).toBeLessThan(keys.indexOf('STG201'));
    expect(keys.indexOf('ANT319')).toBeLessThan(keys.indexOf('STG201'));
    expect(ranked[0].score).toBeGreaterThan(70);
    expect(ranked[0].score).toBeLessThanOrEqual(100);
    expect(ranked.find((r) => r.session.key === 'STG201')!.score).toBeLessThan(15);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
  });

  it('explains matched interests, keywords, tags, level and format', async () => {
    const { planner } = await openPlanner();
    const { explanation, score } = planner.explain('SEC401')!;
    const threat = explanation.interests.find((i) => i.label === 'Threat detection')!;
    expect(threat.keywords).toEqual(expect.arrayContaining(['threat detection', 'GuardDuty']));
    expect(explanation.interests.map((i) => i.label)).toContain('Securing AI agents');
    expect(explanation.tags).toContainEqual({ kind: 'service', name: 'Amazon GuardDuty', weight: 0.8 });
    expect(explanation.tags).toContainEqual({ kind: 'topic', name: 'Security & Identity', weight: 0.9 });
    expect(explanation.level).toMatchObject({ fit: 'in' });
    expect(explanation.format).toMatchObject({ type: 'Workshop', recorded: false });
    expect(explanation.format.contribution).toBeGreaterThan(0);
    expect(explanation.avoided).toEqual([]);
    const parts = explanation.interests.reduce((sum, i) => sum + i.contribution, 0) + explanation.level.contribution + explanation.format.contribution;
    expect(parts).toBeLessThan(score);
  });

  it('excludes avoid-list hits unless showAvoided is set', async () => {
    const { planner } = await openPlanner();
    expect(planner.rank({}).map((r) => r.session.key)).not.toContain('BLK201');
    const avoided = planner.rank({ showAvoided: true }).find((r) => r.session.key === 'BLK201')!;
    expect(avoided.explanation.avoided).toEqual(['keyword "blockchain"']);

    const profile = fixtureProfile();
    profile.avoid = { keywords: [], topics: ['Storage'], services: ['Amazon Inspector'] };
    planner.updateProfile(profile);
    const keys = planner.rank({}).map((r) => r.session.key);
    expect(keys).toContain('BLK201');
    expect(keys).not.toContain('STG201');
    expect(keys).not.toContain('DEV320');
    expect(planner.explain('DEV320')!.explanation.avoided).toEqual(['service "Amazon Inspector"']);
  });

  it('penalizes sessions outside the level range', async () => {
    const { planner } = await openPlanner();
    const before = planner.explain('SEC101')!;
    expect(before.explanation.level.fit).toBe('below');
    expect(before.explanation.level.contribution).toBeLessThan(0);

    planner.updateProfile({ ...fixtureProfile(), level: { min: 100, max: 400 } });
    const after = planner.explain('SEC101')!;
    expect(after.explanation.level.fit).toBe('in');
    expect(after.score).toBeGreaterThan(before.score);
    expect(planner.explain('GAM201')!.explanation.level).toEqual({ fit: 'unknown', contribution: 0 });
  });

  it('prefers unrecorded formats, using the editable recorded map and profile format preferences', async () => {
    const { planner } = await openPlanner();
    const breakout = planner.explain('SEC310')!;
    expect(breakout.explanation.format).toMatchObject({ type: 'Breakout session', recorded: true });
    expect(breakout.explanation.format.contribution).toBeLessThan(0);

    const settings = planner.settings();
    planner.updateSettings({ ...settings, recorded: { ...settings.recorded, 'Breakout session': false } });
    const unrecorded = planner.explain('SEC310')!;
    expect(unrecorded.explanation.format).toMatchObject({ recorded: false });
    expect(unrecorded.score).toBeGreaterThan(breakout.score);

    planner.updateProfile({ ...fixtureProfile(), formats: { 'Breakout session': -1 } });
    expect(planner.explain('SEC310')!.score).toBeLessThan(breakout.score);
  });

  it('lets ranking weights be tuned in settings', async () => {
    const { planner } = await openPlanner();
    const settings = planner.settings();
    planner.updateSettings({ ...settings, weights: { text: 0, tags: 0, level: 0, format: 1 } });
    const ranked = planner.rank({});
    const top = ranked.filter((r) => r.score === ranked[0].score).map((r) => r.session.type);
    expect(new Set(top)).toEqual(new Set(['Workshop']));
  });

  it('filters by day, time range, venue, type, level and tags', async () => {
    const { planner } = await openPlanner();
    const keys = (filters: Parameters<typeof planner.rank>[0]): string[] => planner.rank(filters).map((r) => r.session.key).sort();
    expect(keys({ days: ['tue'], timeFrom: '13:00', timeTo: '14:30' })).toEqual(['AIM350', 'NET310', 'SEC310']);
    expect(keys({ venues: ['mgm'], days: ['thu'] })).toEqual(['ANT319']);
    expect(keys({ types: ['Workshop'] })).toEqual(['SEC350', 'SEC401']);
    expect(keys({ levels: [100] })).toEqual(['SEC101']);
    expect(keys({ services: ['Amazon Detective', 'AWS Secrets Manager'] })).toEqual(['SEC330', 'SEC340']);
    expect(keys({ topics: ['Storage'], roles: ['Solution / Systems Architect'] })).toEqual(['STG201']);
    expect(keys({ industries: ['Financial Services'], showAvoided: true })).toEqual(['BLK201']);
    expect(keys({ features: ['Hands-on'], days: ['wed'] })).toEqual(['SEC350']);
  });

  it('searches titles, abstracts, speakers, companies, tags and codes', async () => {
    const { planner } = await openPlanner();
    const keys = (q: string): string[] => planner.rank({ q }).map((r) => r.session.key).sort();
    expect(keys('Priya')).toEqual(['ANT319']);
    expect(keys('acme')).toEqual(['SEC401']);
    expect(keys('ANT319-R1')).toEqual(['ANT319']);
    expect(keys('iceberg tables')).toEqual(['ANT319']);
    expect(keys('Detective graphs')).toEqual(['SEC330']);
    expect(keys('cloudwat')).toEqual(['OPS301']);
  });

  it('filters starred, on-agenda and conflicting sessions', async () => {
    const { planner } = await openPlanner();
    planner.star('SEC330');
    add(planner, 'SEC350');
    expect(planner.rank({ starredOnly: true }).map((r) => r.session.key)).toEqual(['SEC330']);
    const onAgenda = planner.rank({ onAgendaOnly: true });
    expect(onAgenda.map((r) => r.session.key)).toEqual(['SEC350']);
    expect(onAgenda[0].onAgenda).toBe(true);

    const visible = planner.rank({ hideConflicting: true }).map((r) => r.session.key);
    expect(visible).not.toContain('SEC360'); // its only slot overlaps SEC350
    expect(visible).toContain('CMP301'); // its Friday repeat is free
    expect(visible).toContain('SEC350');
    expect(visible).toContain('IAM333');
  });

  it('sorts by time, seats, level and venue, and honours limit', async () => {
    const { planner } = await openPlanner();
    const byTime = planner.rank({ sort: { by: 'time', dir: 'asc' } });
    expect(byTime.slice(0, 2).map((r) => r.session.key)).toEqual(['SEC401', 'ANT319']); // same start, higher score first
    expect(byTime[byTime.length - 1].session.key).toBe('IAM333'); // TBA last
    const seats = planner.rank({ sort: { by: 'seats', dir: 'desc' } }).map((r) => firstMatchingSlot(r)?.seats ?? 0);
    for (let i = 1; i < seats.length; i++) expect(seats[i - 1]).toBeGreaterThanOrEqual(seats[i]);
    expect(planner.rank({ sort: { by: 'level', dir: 'asc' } })[0].session.level).toBe(100);
    expect(planner.rank({ sort: { by: 'venue', dir: 'asc' }, limit: 1 })[0].session.slots[0].venue).toBe('caesars-forum');
    expect(planner.rank({ limit: 3 })).toHaveLength(3);
  });

  it('shows and sorts a repeat session by the slot that matches the day filter', async () => {
    const { planner } = await openPlanner();
    const ant319 = planner.session('ANT319')!;
    const wednesday = ant319.slots.find((s) => s.day === 'wed')!;

    expect(planner.rank({}).find((r) => r.session.key === 'ANT319')!.matchingSlotIds).toEqual(ant319.slots.map((s) => s.slotId));

    const byTime = planner.rank({ days: ['wed'], sort: { by: 'time', dir: 'asc' } });
    const ranked = byTime.find((r) => r.session.key === 'ANT319')!;
    expect(ranked.matchingSlotIds).toEqual([wednesday.slotId]);
    expect(firstMatchingSlot(ranked)?.code).toBe('ANT319-R1');
    const starts = byTime.map((r) => firstMatchingSlot(r)!);
    for (const slot of starts) expect(slot.day).toBe('wed');
    for (let i = 1; i < starts.length; i++) expect(starts[i - 1].start! <= starts[i].start!).toBe(true);
    expect(byTime[0].session.key).not.toBe('ANT319'); // its Monday slot no longer puts it first
  });

  it('works without a profile', async () => {
    const { planner } = await openPlanner({ profile: null });
    const ranked = planner.rank({});
    expect(ranked).toHaveLength(20);
    expect(ranked.every((r) => r.score >= 0 && r.explanation.interests.length === 0)).toBe(true);
  });
  it('keeps scores spread out when a profile picks many high-weight topics and services', async () => {
    const { planner } = await openPlanner({ profile: null });
    const draft = {
      ...planner.profileDraft(),
      topics: { 'Artificial Intelligence': 'high', 'Security & Identity': 'high', Analytics: 'high' },
      services: { 'Amazon Bedrock': 'high', 'Amazon GuardDuty': 'high', 'AWS Security Hub': 'high', 'Amazon Athena': 'high' },
    } as const;
    const result = planner.profileFromDraft(draft);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    planner.updateProfile(result.value);
    const scores = planner.rank({}).map((r) => r.score);
    expect(scores[0]).toBeLessThan(99);
    expect(scores.filter((score) => score === scores[0])).toHaveLength(1);
  });
});
